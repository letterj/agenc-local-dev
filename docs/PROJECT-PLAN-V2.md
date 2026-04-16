# AgenC Project Plan — Open Items

**Last updated:** 2026-04-15
**Full history:** `docs/PROJECT-PLAN.md`

---

## Active Blockers

- **Task 9 — Token usage monitoring:** awaiting dev team response via Telegram (message sent 2026-03-25). GitHub issue not yet filed.
- **Task 10 — Benchmark report:** blocked on Task 9.
- **Stale worker PDA deregister:** `4Rz7m7FfrHqMNTsDms3r2tRTKEwrx9M8FVGgATwykiqy` registered under private program (`9dMNFL…`) for wallet `26d6kxsP…` (`worker.json`). Slash window blocks deregister until **2026-04-17T20:31:42 UTC**. Do not use `worker.json` for V2 testing before that date.

---

## Platform Testing (next up)

All depend on the dual-container V2 setup (confirmed working 2026-04-12).

| Task | Title | Notes |
|---|---|---|
| 13 | Complex dependent task chains | Use `create_dependent_task`; verify dependency blocking |
| 14 | Dispute resolution flow | All 7 dispute instructions; requires arbiter wallet |
| 15 | Task cancellation and claim expiry | Two sub-tests: creator cancel + `expire_claim` |
| 16 | Agent feed | Post + upvote from creator/worker agents |
| 17 | Reputation staking and delegation | Stake → delegate → revoke → cooldown check |
| 18 | ZK private task completion | `complete_task_private` with RISC Zero Groth16 proof |

---

## Upstream PR Opportunities

| # | Target | Description |
|---|---|---|
| — | `agenc-sdk/src/constants.ts`, `agenc-core/mcp/src/server.ts` | `PROGRAM_ID` hardcoded to V1 (`6UcJzb…`) — callers without explicit `programId` silently target wrong program |
| Fix 2 | `agenc-core/runtime/src/gateway/wallet-loader.ts` | Tilde expansion for `keypairPath` — not yet upstreamed |
| Fix 3 | `agenc-core/runtime/src/tools/agenc/tools.ts` | `taskDescription` rename to avoid JSON Schema collision — not yet upstreamed |
| Fix 4 | `agenc-core/runtime/src/tools/agenc/mutation-tools.ts` | Active-status filter in `resolveAuthorityAgentPda` — not yet upstreamed |
| Fix 5 | `agenc-core/runtime/src/llm/ollama/adapter.ts` | Duplicate tool call ID bug — see below |

### Ollama duplicate tool call ID bug

**Status:** Not started — issue and PR not yet filed
**Target:** `agenc-core/runtime/src/llm/ollama/adapter.ts`

Ollama provider uses the tool name as the tool call ID instead of generating a unique ID per
invocation. Multi-step tool tasks (write → compile → run) fail immediately with
`Invalid tool-turn sequence (assistant_tool_call_id_duplicate)`. Single-turn responses work fine.

**Tested on:** qwen2.5:14b, M2 32GB

**Fix:** Replace tool call ID with `crypto.randomUUID()` — same fix applied to openai-compat
provider in PR #402.

**Actions:**
1. File GitHub issue against `tetsuo-ai/agenc-core`
2. PR with fix

---

### openai-compat provider (issue #352)

**Status:** ✅ Complete
**PR:** tetsuo-ai/agenc-core#402 — filed 2026-04-15, awaiting upstream review (merge date TBD)
**Branch:** feature/openai-compat-provider (4 commits on upstream/main)
**Issue:** https://github.com/tetsuo-ai/agenc-core/issues/352

Adds OpenAICompatProvider — connects to any OpenAI-compatible local
server (LM Studio, llama.cpp, vLLM) without xAI credentials.

Files created:
- runtime/src/llm/openai-compat/types.ts
- runtime/src/llm/openai-compat/openai-compat-filter.ts
- runtime/src/llm/openai-compat/adapter.ts
- runtime/src/llm/openai-compat/adapter.test.ts (40 tests)
- runtime/src/llm/openai-compat/openai-compat-filter.test.ts (41 tests)
- runtime/src/llm/openai-compat/adapter.live.test.ts (2 live tests)

Files modified:
- runtime/src/gateway/types.ts
- runtime/src/gateway/llm-provider-manager.ts
- docs/RUNTIME_API.md

Test results:
- 81 unit tests passing, 0 regressions
- 2 live tests written (adapter.live.test.ts) — not yet run this session
- Typecheck: 0 errors

**Note:** Fix 6 in `experiment/local-tool-fixes` (google_gemma-4-26b-a4b-it xai-strict-filter workaround) is superseded by this PR. Remove Fix 6 once tetsuo-ai/agenc-core#402 merges.

---

## Dev Team Architecture Notes

### Unified session model — SHIPPED (PR #330, PR #331, b05b26b)

All three frontend surfaces (shell, console, web) now share:
- One daemon-backed session command surface
- Structured command result families
- Canonical daemon commands across all surfaces

Cockpit startup regression fixed in PR #331 — agenc-watch.js
should now be functional (pending local retest after rebuild).

### Shell interface (confirmed 2026-04-13)

- `agenc shell --profile general`: line-oriented, task-oriented
- `agenc shell --profile coding`: development-focused
- `agenc-watch.js` (cockpit/console) not yet functional after
  coding-first-shell feature drop — awaiting upstream fix
- Primary operator workflow: `agenc shell`, not web UI

---

## Known Open Issues

| Issue | Status | Workaround |
|---|---|---|
| Marketplace UI `[yours:0]` — owner-scoped query broken | Pre-existing, not fixed in 0.2.0 | Use CLI: `market tasks list` |
| Grok 114-tool silent drop — intermittent, tool not invoked | Not reproducible after initial observation | Use CLI for agent registration |
| `xai-strict-filter.ts` local model patch — `google_gemma-4-26b-a4b-it` added to `DOCUMENTED_XAI_MODEL_IDS` as temp fix | Committed to `experiment/local-tool-fixes` (c472ad6) | Implement `local` provider (see Upstream PR Opportunities) |
| Gemma 4 context window — LM Studio default 4096 too small; system prompt requires >14K tokens | Must set context ≥32768 in LM Studio | Also: `workspace.hostPath` must point to neutral directory to prevent autonomous probe execution |
| Fix 5 (`requiredCapabilities` schema description) — resolved upstream in commit `aad3590`, tools.ts line 2214 | ✅ Resolved — no longer tracked | None needed |
| `agenc-watch.js` cockpit — crashes with "Missing required watch surface helper: cockpitFeedFingerprint" | Likely fixed in PR #331 — pending retest after rebuild | Use `agenc shell` instead |
| V3 createTaskFromTemplate AccountNotSigner | Reported to dev team via Telegram 2026-04-15 | Use CLI market tasks create or wait for team response |

---

## Observability

- **Task 19 — Concordia wave review:** no blockers, not started. Review PRs AgenC #1541–#1545, agenc-core #146–#147. Identify contribution opportunities.
