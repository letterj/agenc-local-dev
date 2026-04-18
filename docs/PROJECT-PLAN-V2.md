# AgenC Project Plan — Open Items

**Last updated:** 2026-04-17
**Full history:** `docs/PROJECT-PLAN.md`

---

## Active Blockers

- **Task 9 — Token usage monitoring:** awaiting dev team response via Telegram (message sent 2026-03-25). GitHub issue not yet filed.
- **Task 10 — Benchmark report:** blocked on Task 9.
- **V3 `complete_task` rent bug (cascade blocker):** Solana runtime rejects `complete_task` at account (2) with insufficient funds for rent-exemption. Program logic passes (`complete_task_validated` + `complete_task_done` succeed) but transaction fails at runtime level. Blocks Tasks 13, 16, and 17 simultaneously. Fix must land in `agenc-protocol` or the CLI's `complete_task` transaction builder. Dev team notified via Telegram 2026-04-17. **GitHub issue filed:** `tetsuo-ai/agenc-core#437` (2026-04-17). Stuck devnet task `AySKChkQTAiyior3Yzo2LMT988R42iMNBtckFxuXqUg` — in_progress, uncancellable, leave it.

---

## Platform Testing (next up)

All depend on the dual-container V2 setup (confirmed working 2026-04-12).

| Task | Title | Status | Notes |
|---|---|---|---|
| 13 | Complex dependent task chains | ⛔ Blocked | See below |
| 14 | Dispute resolution flow | Not started | All 7 dispute instructions; requires arbiter wallet |
| 15 | Task cancellation and claim expiry | Not started | Two sub-tests: creator cancel + `expire_claim` |
| 16 | Agent feed | ⛔ Blocked | See below |
| 17 | Reputation staking and delegation | ⛔ Likely blocked | See below |
| 18 | ZK private task completion | Not started | `complete_task_private` with RISC Zero Groth16 proof |

### Task 13 — Complex dependent task chains

**Status:** ⛔ Blocked  
**Tested:** 2026-04-16, V3 program `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`

**Blocker 1:** No CLI surface for dependent task creation — `create-dependent` / `--parent` flag
not available in `agenc market tasks`. The `create_dependent_task` instruction exists on-chain
but is not exposed via the CLI.

**Blocker 2:** V3 `complete_task` rent bug (cascade blocker — see Active Blockers). Even if the
CLI gap were filled, completing a parent task to unblock a dependent task would fail at the
`complete_task` step.

**Stuck devnet task:** `9cVyG56mSjbR5ZAfSt5ByvSFQ2bpjLtBMEnqG8nykR6u` — in_progress,
uncancellable, leave it.

### Task 16 — Agent feed

**Status:** ⛔ Blocked  
**Tested:** 2026-04-16, V3 program `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`  
**Retest:** 2026-04-17 — delegation workaround attempted; still blocked

**Root cause:** `MIN_FEED_POST_REPUTATION = 5500`; both agents start at 5000 (500 gap).
Reputation only increases via `complete_task`, which is blocked by the V3 rent bug (issue #437).

**Delegation workaround — ineffective:** Worker received 5000 delegated rep from creator
(`effectiveReputation: 10000`) but `post_to_feed.rs:62` reads `AgentRegistration.reputation`
directly — it does not load delegation accounts. SDK `effectiveReputation` is a client-side
aggregation only, not an on-chain primitive. Worker on-chain rep remains 5000 (below 5500 gate).

**Secondary bug (patched in scripts):** `topic` field must be non-zero — `[0u8; 32]` triggers
`FeedInvalidTopic`. Scripts use `sha256("task16-test")` as topic.

**Scripts ready:** `scripts/devnet-feed-post.mjs` + `scripts/devnet-feed-upvote.mjs` — correct
and tested up to the reputation gate. Will work immediately once the rent bug is fixed upstream.

### Task 17 — Reputation staking and delegation

**Status:** Partially complete — staking and delegation work; withdraw blocked  
**Tested:** 2026-04-17, V3 program `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`

**What works:**
- `reputation summary` ✅ — readable for both agents at any time
- `reputation stake <lamports>` ✅ — converts base rep to staked balance; 7-day cooldown
  enforced on-chain (`lockedUntil` set in `AgentRegistration`); staking reduces `baseReputation`
  to 0 (not additive)
- `reputation delegate <amount> --delegatee-agent-pda <pda>` ✅ — delegation PDA created
  on-chain; `inboundDelegations` visible in delegatee's summary; `effectiveReputation` updated
  client-side; amount is reputation points (100–10,000 range), not lamports

**Blocker:** `reputation withdraw` — no CLI surface. `UNKNOWN_MARKET_COMMAND` returned.
On-chain cooldown exists (`lockedUntil` populated) but is unreachable via CLI in this version.

**Bug found:** Delegate amount validation error does not specify units. Error message reads
`"amount must be between 100 and 10000"` with no indication these are reputation points (not
lamports). Confusing UX — initial attempt with 500000 (lamport-scale) failed silently.

**Note:** Delegation does NOT satisfy on-chain reputation gates. `post_to_feed.rs:62` reads
`AgentRegistration.reputation` directly. SDK `effectiveReputation` is a display convenience
only, not an on-chain primitive consulted by any instruction. Worker on-chain rep remains 5,000
(below 5,500 gate). See Task 16 above.

---

## Upstream PR Opportunities

**CI note (2026-04-18):** The `private-kernel-registry` gate was broken for external contributor
PRs; the dev team fixed it on 2026-04-18. All 5 open PRs (#402, #418, #454, #456, #458) now
have all 4 checks green. #402 and #418 required a manual CI re-trigger after the fix landed.

| # | Target | Description |
|---|---|---|
| — | `agenc-sdk/src/constants.ts`, `agenc-core/mcp/src/server.ts` | `PROGRAM_ID` hardcoded to V1 (`6UcJzb…`) — callers without explicit `programId` silently target wrong program |
| Fix 2 | `agenc-core/runtime/src/gateway/wallet-loader.ts` | Tilde expansion for `keypairPath` — ✅ PR #454 filed 2026-04-18 |
| Fix 3 | `agenc-core/runtime/src/tools/agenc/tools.ts` | `taskDescription` rename to avoid JSON Schema collision — ✅ PR #456 filed 2026-04-18 |
| Fix 4 | `agenc-core/runtime/src/tools/agenc/mutation-tools.ts` | Active-status filter in `resolveAuthorityAgentPda` — ✅ PR #458 filed 2026-04-18 |
| Fix 5 | `agenc-core/runtime/src/llm/ollama/adapter.ts` | Duplicate tool call ID bug — ✅ PR #418 filed 2026-04-17 |

### Fix 4 — Active-status filter in resolveAuthorityAgentPda

**Status:** ✅ Complete — PR #458 all checks passing, awaiting review
**Issue:** tetsuo-ai/agenc-core#457
**PR:** tetsuo-ai/agenc-core#458
**Filed:** 2026-04-18
**Target:** `agenc-core/runtime/src/tools/agenc/mutation-tools.ts`

When a signer wallet has multiple agent registrations, `resolveAuthorityAgentPda` returned an
ambiguity error listing all of them — including suspended or deregistered agents. An operator
with one active and one old deregistered registration would have to manually specify the PDA
every time.

**Fix:** Added `AgentStatus` to the import. In the multi-match branch, calls
`fetchMultiple` to fetch full account data for all candidates, filters to
`AgentStatus.Active` only. If exactly one active agent remains, returns it directly (no
ambiguity). If multiple active remain, surfaces them in the ambiguity error (suppressing
inactive entries). Falls back to all candidates if `fetchMultiple` fails or returns no data.

**Functional testing:** Happy path confirmed on devnet (task created successfully).
Suspended/deregistered agent paths require protocol authority to set — covered by unit
tests only.

**Tests:** 2 new unit tests: (1) single active auto-selected when one of two is suspended;
(2) ambiguity error count = 2 when 2 active + 1 suspended. `fetchMultiple` added to base
mock with safe `[]` default preserving all existing tests. 35/35 targeted passing, 21
pre-existing upstream failures (baseline unchanged), 0 TypeScript errors.

---

### Fix 3 — Rename description to taskDescription in create_task tool schema

**Status:** ✅ Complete — PR #456 all checks passing, awaiting review
**Issue:** tetsuo-ai/agenc-core#455
**PR:** tetsuo-ai/agenc-core#456
**Filed:** 2026-04-18
**Target:** `agenc-core/runtime/src/tools/agenc/tools.ts`

The `create_task` tool exposed a schema property named `description`, which collides with
the JSON Schema `description` metadata keyword. Some LLM implementations mis-parse the
schema when a property and its sibling metadata share the same key name, causing the field
to be silently dropped or misrouted.

**Fix:** Renamed the `description` property to `taskDescription` in the input schema
(`properties` and `required`). Added `args.taskDescription ?? args.description` fallback
at both call sites (dedup key and `parseTaskDescription`) for backwards compatibility.

**Tests:** 2 new regression tests asserting `taskDescription` present / `description` absent
in both `properties` and `required`. Also updated upstream's new "preserves task creation
when devnet lacks job spec metadata" test to pass `taskDescription` (rebased 2026-04-18 after
PR #459 added that test to the same file). Fixed missed `args.description` reference in
`persistMarketplaceJobSpec` call — added same `args.taskDescription ?? args.description`
fallback. 36/36 targeted passing, 21 pre-existing upstream failures (baseline unchanged),
0 TypeScript errors.

---

### Fix 2 — Tilde expansion in keypairPath config field

**Status:** ✅ Complete — PR #454 all checks passing, awaiting review
**Issue:** tetsuo-ai/agenc-core#453
**PR:** tetsuo-ai/agenc-core#454
**Filed:** 2026-04-18
**Target:** `agenc-core/runtime/src/gateway/wallet-loader.ts`

`keypairPath` values starting with `~/` were passed directly to the filesystem without
expansion, causing `ENOENT` when the config used a tilde path. Upstream default
`getDefaultKeypairPath()` always returns an absolute path, so the bug only surfaces when
`keypairPath` is set explicitly in config.

**Fix:** Added exported `expandPath(p: string)` helper — expands `~/` to `os.homedir()`,
passes absolute paths and relative paths through unchanged. `loadWallet` wraps the resolved
path with `expandPath()` before calling `loadKeypairFromFile`.

**Tests:** 5/5 targeted passing, 21 pre-existing upstream failures (baseline unchanged),
0 TypeScript errors.

---

### Ollama duplicate tool call ID bug

**Status:** ✅ Complete — PR #418 all checks passing, awaiting review
**Issue:** tetsuo-ai/agenc-core#417
**PR:** tetsuo-ai/agenc-core#418
**Filed:** 2026-04-17
**Target:** `agenc-core/runtime/src/llm/ollama/adapter.ts`

Ollama provider uses the tool name as the tool call ID instead of generating a unique ID per
invocation. Multi-step tool tasks (write → compile → run) fail immediately with
`Invalid tool-turn sequence (assistant_tool_call_id_duplicate)`. Single-turn responses work fine.

**Tested on:** qwen2.5:14b, M2 32GB

**Fix:** Replaced `tc.function?.name` with `randomUUID()` (named import from `node:crypto`) at
both the streaming path (`chatStream`) and non-streaming path (`parseResponse`) in
`runtime/src/llm/ollama/adapter.ts`. Same pattern as PR #402 (openai-compat fix).

**Tests:** 30/30 passing, pack-smoke green, 0 regressions

---

### openai-compat provider (issue #352)

**Status:** ✅ Complete — all checks passing, awaiting review
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
