# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-04-20] — 5 PRs merged overnight; branch cleanup

### PRs Merged Overnight
- `tetsuo-ai/agenc-core#402` — feat(llm): openai-compat provider for locally-hosted LLMs ✅
- `tetsuo-ai/agenc-core#418` — fix(llm): generate unique tool call IDs in Ollama adapter ✅
- `tetsuo-ai/agenc-core#456` — fix(tools): rename taskDescription to avoid JSON Schema collision ✅
- `tetsuo-ai/agenc-core#458` — fix(tools): filter for active agent status in resolveAuthorityAgentPda ✅
- `tetsuo-ai/AgenC#1547` — docs(concordia): clarify event_stream.py shim role ✅

### Still Open
- `tetsuo-ai/agenc-core#454` — fix(gateway): expand tilde in keypairPath config field

### Branch Cleanup
- Resolved AgenC `experiment/local-dev-setup` conflict (SDK 1.3.1 → 1.4.0 + keep @tetsuo-ai/protocol dep)
- Deleted 7 stale branches (6 agenc-core + 1 AgenC)
- agenc-core now has 4 branches: main, experiment/local-dev-setup, experiment/local-tool-fixes, fix/keypair-path-tilde-expansion

---

## [2026-04-19] — Upstream scan; PR #402 and #418 rebased

### Morning Sync
- agenc-core: 38 new commits, 128 files changed — runtime/gateway/LLM layer work
- Rebased PR #402 (`feature/openai-compat-provider`) onto upstream/main — clean rebase;
  stateless-transport parity updates applied to `adapter.ts` (`resolveLLMStatefulResponsesConfig`
  → `resolveLLMCompactionConfig`, `getCapabilities()` removed, `previousResponseId` field removed);
  77 unit tests passing, typecheck clean
- Rebased PR #418 (`fix/ollama-tool-call-id-duplicate`) onto upstream/main — clean rebase,
  no changes needed; 28 tests passing
- `private-kernel-registry` CI check regressed overnight — failing on #402 and #418 with
  `npm error command sh -c npx tsx scripts/run-required-validation.ts`; pack-smoke still green;
  team-side issue, no action on our end

### Upstream Findings
- **Rent bug (#437):** Unresolved — 38 new commits, none touched `completion_helpers`,
  `complete_task`, or escrow/rent paths. Cascade blocker for Tasks 13, 16, 17 remains.
- **Dependent task CLI gap:** Unresolved — 38 new commits, no new `create-dependent`
  or `--parent` flag surface. Blocks Task 13 independently of the rent bug.
- **Task 9 — token usage monitoring:** Foundation now exists upstream. PR #461 (`f5ec28e`)
  adds `getSessionCostUsd(sessionId)`, `ChatUsagePayload.sessionCostUsd`, and
  `runtime/src/llm/grok/pricing.ts` with per-1M USD rates ($2/$6 grok-4.20 family,
  $0.20/$0.50 grok-4-1-fast). Internal accumulation + TUI display only, not an external
  API. Implementation path: read from `getSessionCostUsd` or parse `ChatUsagePayload`.
  Task 9 no longer fully blocked.
- **xAI model ID catalog change:** Canonical IDs are now `grok-4.20-0309-*` and
  `grok-4.20-multi-agent-0309`; old beta-infixed forms demoted to legacy aliases.
  Handled in upstream runtime — check local scripts for hardcoded old model IDs.
- **New tool helper:** `listOpenTasksForSession` added (`9eb8c01`) — potentially useful
  for dependent task workflows.

---

## [2026-04-18] — PRs #454, #456, #458 filed; morning sync PR detection fixed

### Upstream Contributions
- Filed issue tetsuo-ai/agenc-core#453 — `keypairPath` config field does not expand `~/`;
  causes `ENOENT` when keypair path is set with a tilde in config.
- Filed PR tetsuo-ai/agenc-core#454 (`fix/keypair-path-tilde-expansion`) — Fix 2 from
  local-tool-fixes backlog. Added `expandPath()` helper in `wallet-loader.ts`; 5 unit tests;
  baseline failure count unchanged (21 pre-existing upstream failures).
- Filed issue tetsuo-ai/agenc-core#455 — `description` field in `create_task` tool schema
  collides with JSON Schema keyword; causes silent field mis-parse in some LLM implementations.
- Filed PR tetsuo-ai/agenc-core#456 (`fix/task-description-field-rename`) — Fix 3 from
  local-tool-fixes backlog. Renamed `description` → `taskDescription` in schema; backwards-compat
  fallback at both call sites; 2 regression tests; baseline failure count unchanged.
- Filed issue tetsuo-ai/agenc-core#457 — `resolveAuthorityAgentPda` does not filter for
  active agent status; suspended/deregistered agents appear as valid candidates.
- Filed PR tetsuo-ai/agenc-core#458 (`fix/resolve-authority-agent-pda-status-filter`) — Fix 4
  from local-tool-fixes backlog. Fetches full account data via `fetchMultiple`, filters to
  `AgentStatus.Active`, auto-selects single active agent; 2 unit tests; happy path confirmed
  on devnet; baseline failure count unchanged.

### CI
- `private-kernel-registry` gate fixed upstream (2026-04-18) — now passing for all external
  contributor PRs. Previously failing on all new PRs from non-org contributors.
- Re-triggered CI on PR #402 and #418 after fix landed — all 4 checks green on both.
- All 5 open PRs (#402, #418, #454, #456, #458) now fully green.

### Maintenance
- Fixed morning sync PR detection — replaced `gh search prs` with GitHub Search API
  org-scoped query (`/search/issues?q=is:pr+is:open+author:letterj+org:tetsuo-ai`).
  Covers all tetsuo-ai repos in one call including cross-fork PRs. Previously missing
  tetsuo-ai/AgenC#1547 entirely.

### Research
- Investigated marketplace order `ord_research-report_mo27c3lg_pfe3z7` — confirmed task
  PDA is a mock identifier, not an on-chain account. Storefront running in simulation mode,
  likely due to V3 rent bug blocking real task settlement.

---

## [2026-04-17] — PR #418 filed; V3 rent bug issue #437 filed; Tasks 16 & 17 tested

### Upstream Contributions
- Filed issue tetsuo-ai/agenc-core#417 and PR tetsuo-ai/agenc-core#418
  (`fix/ollama-tool-call-id-duplicate`) — fixes duplicate tool call ID bug in Ollama adapter;
  closes issue #417. `randomUUID()` now used at both streaming and non-streaming paths in
  `runtime/src/llm/ollama/adapter.ts`. 30/30 tests passing, pack-smoke green.
- Filed issue tetsuo-ai/agenc-core#437 — V3 `complete_task` rent bug; cascade blocker for
  Tasks 13, 16, 17. Account (2) insufficient funds for rent at transaction level; program
  logic passes. Confirmed still present after 59-commit upstream refactor (PRs #413–#435).

### Testing
- Retested V3 `complete_task` rent bug against post-refactor program — still present after
  59-commit upstream runtime/LLM refactor (PR #413); refactor was unrelated to protocol.
- Tasks 13, 16, 17 remain cascade-blocked by V3 rent bug (issue #437).
- Task 13 additionally blocked by missing `create-dependent` / `--parent` CLI surface.
- Stuck devnet task `AySKChkQTAiyior3Yzo2LMT988R42iMNBtckFxuXqUg` — status `in_progress`,
  uncancellable; leave it.
- **Task 17 tested:** reputation staking (`reputation stake`) and delegation
  (`reputation delegate`) both working on-chain. Stake: lamport-denominated, 7-day cooldown
  enforced, reduces `baseReputation` to 0. Delegate: rep-point-denominated (100–10,000 range),
  delegation PDA created, `effectiveReputation` updated client-side. `reputation withdraw` has
  no CLI surface (`UNKNOWN_MARKET_COMMAND`). Bug: delegate validation error omits unit label
  (rep points vs lamports).
- **Task 16 retest:** still blocked. Attempted delegation workaround (worker `effectiveReputation`
  raised to 10,000 via 5,000 delegated from creator) — ineffective. `post_to_feed.rs:62` reads
  `AgentRegistration.reputation` directly; delegation accounts are not loaded by this instruction.
  SDK `effectiveReputation` is client-side only. Worker on-chain rep 5,000 (below 5,500 gate).

---

## [2026-04-15] — V3 program migration, feature branch rebase

### Changed
- Migrated all container configs and compose env vars from V2 program
  (`GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3`) to V3 program
  (`2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`); updated
  `docker/creator/config.json` (2 occurrences), `docker/worker/config.json` (1),
  and `docker-compose.yml` (2 env var entries)
- Containers stopped, recreated, and restarted with new program ID
- Both agents re-registered under V3; PDAs confirmed on-chain

### Agent Registration (V3)
- Creator agent `HYZyLSXTpC2g9XNAweud7XeCNAH8PfzMNAX2JKEKzbQY` — registered
  2026-04-15 under V3 program, tx `4HQKftu3iLRjbx6TEEr5jy4HLQ7L4wQGtLQRNX1mRxR9MLWHYBDM6qJwNqusa7Dmg6KwRVvmgzr7t84QDqzy3wXs`
- Worker2 agent `2TPP4NJ7aYJUmr51T1qf7A5rEpggGCLNwGEdy7srjFCb` — registered
  2026-04-15 under V3 program, tx `45yT9u2faxsK8aJYaRhqzsaMhtQM4S9fKbE1oc8F44BmG2Yue6gjv9UCfz3YHe1Rip3BdVfbCdhZfG9owPHtiBsw`
- V2 PDAs (`HmZqAsDz…`, `BrnCh3DZ…`) superseded; no longer active under V3

### Dev (agenc-core fork)
- Rebased `feature/openai-compat-provider` onto upstream/main (25 new commits,
  base moved from `1e17f95` to `b1f3130`); no conflicts on any watched file
- Typecheck: 0 errors; 81 openai-compat tests pass; pre-existing failure count
  moved from 14 → 19 (5 new upstream failures in `coding.test.ts` and
  `context-compaction.integration.test.ts`, none in our files)
- Rebuilt runtime dist: `0.2.0 @ cad417450839`

---

## [2026-04-13] — Shell interface discovery, agenc-watch regression, Gemma 4 E2E confirmed

### Added
- Discovered `agenc shell` as primary operator interface (coding-first-shell feature drop)
- Confirmed shell works with both creator (Grok) and worker2-local (Gemma 4)
- `agenc shell --profile general` and `--profile coding` both confirmed working
- Gemma 4 26B confirmed working end-to-end via LM Studio + `agenc shell`

### Fixed
- Rebuilt runtime dist after rebase onto upstream/main (VERSION: 0.2.0 @ 3af6399)

### Known Issues
- `agenc-watch.js` cockpit not yet functional — crashes with "Missing required watch surface helper: cockpitFeedFingerprint" (upstream issue, coding-first-shell)
- grok model display cosmetic bug confirmed — shell shows `grok-3`, API is running `grok-4-1-fast-reasoning` (reasoning_tokens > 0 confirmed)

### Upstream
- **Coding-first-shell roadmap shipped (PR #329, dcc8a74):**
  - Shell profiles and shell-first startup
  - Native coding tools: plan, files, grep, git, worktree, review, session
  - Explicit workflow stages: plan, implement, review, verify
  - Session continuity: list, inspect, history, resume, fork
  - Shell extension UX for MCP, plugins, and skills
  - Watch cockpit surfaces
  - Explicit multi-agent shell orchestration
  - Rollout gating and validation
- **AgenC umbrella reconciliation (PR #1554, cbd9a4da):**
  - Reduced root tech debt
  - TODO.MD updated to reflect actual project state
  - Coding-shell roadmap marked shipped, remaining work moved to backlog
- **Unified session surfaces (PR #330, PR #331, b05b26b):**
  - Shared daemon-backed session command surface across shell, console, web
  - Structured command result families replacing transcript-only blobs
  - Watch console convergence onto canonical daemon commands
  - Structured web rendering for command results
  - AgenC console bootstrap and auth loop fix
  - Cockpit startup regression fix
  - Removal of legacy command-name drift across canonical surfaces
  - agenc-watch-agents.mjs deleted (replaced by unified surface)
  - daemon-command-registry.ts +1800 lines

---

## [2026-04-12] — Container upgrade to 0.2.0, V2 public program, lifecycle validated

### Changed
- Upgraded containers to `@tetsuo-ai/agenc@0.2.0` / `@tetsuo-ai/runtime@0.2.0`
- Switched from private program (`9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc`) to V2 public
  program (`GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3`) across all configs and compose env vars
- `docker-compose.yml` bind mount path updated from `releases/0.1.0/linux-x64/` to `releases/0.2.0/linux-x64/`
- Bind mount level changed: `runtime/dist` → `runtime/` (full package) to prevent `EBUSY` during fresh runtime install
- Named volumes cleared (`docker compose down -v`) for clean 0.2.0 initialization
- `VERSION` file in `runtime/dist` updated to `"runtimeVersion": "0.2.0"`
- Corrected worker2 wallet: previously recorded address (`26d6kxsP…`) belonged to `worker.json`;
  confirmed `worker2.json` public key is `SFG7VnuZDg9x1Y5Kz81moJkUTLwDF1xgTZFPD3V3mT1`

### Fixed
- `EBUSY: resource busy or locked, rmdir .../dist` on container startup — caused by 0.2.0 installer
  attempting to remove a bind-mounted directory; fixed by mounting at the `@tetsuo-ai/runtime`
  package level instead of just `dist/`
- `LOCAL-FIXES.md` — corrected program ID label: `6UcJzb…` is V1 public (not V2);
  V2 public is `GN69CoB…`; added program ID reference table to Fix 1

### Agent Registration
- Creator agent `HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` — pre-existing V2 registration confirmed active
- Worker2 agent `BrnCh3DZtMR5jsak5t3it4i7si9DvWnk6tBzMteXvHGx` — registered 2026-04-12 under V2 public program,
  tx `4gHSJvv891HsxVVDeCQfSWecEXMGrS3DbU2BWpPRBGF5hQBxTcMXQ7nDCZUnDZ7YWCcxpApbm4apz182pEJT3cfr`

### Verified
- **CLI lifecycle — V2 devnet — 2026-04-12:** full create → claim → complete confirmed against
  program `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` using both containers (0.2.0 image).
  Creator (`HmZqAs…`, port 3100) created task; worker2 (`BrnCh3…`, port 3101) claimed and completed.
  Task PDA: `CqCR4mXTkr4gnqGNvZAW64PXtRKqgR8uYFnfHFVApme2`. Reward: 0.01 SOL.
  Create tx: `3kdDucoqurgEjv7UQtLMVyLmhb9rQwMHBXiZ4Pu6kJijBUL95nH4a6c6q62WB6aYQj4RAHKb7ZYD79L4J8wieuVG`
  Claim tx:  `4mnKfeHCQFtG6XfdkuxpWRPT5JE2GB9dQi3DTVNcfZVags5Dof22xzTQxb5rotYcjPu4CtGjeU9oa6HKubjcuCVK`
  Complete tx: `5kJo8iCFr7UVyJMfUo7Gy3Sp6hYLuvxx8WCZLfYjNEXr6eFCQZ6kpHG4kr52jpxARFzfSApLWxq69obRexEd5nVb`
- **Chat UI lifecycle — V2 devnet — 2026-04-12:** full create → claim → complete confirmed via
  webchat channel. Both agents correctly routed to V2 program.
- **Telegram — 2026-04-12:** confirmed wired on both containers; returning live V2 on-chain data.

### Known Issues (confirmed not fixed in 0.2.0)
- Marketplace UI `[yours:0]` bug — owner-scoped task query returns zero results; root cause is
  UI querying wrong program for owner-scoped tasks (same V1 PROGRAM_ID root cause as Fix 1)
- `requiredCapabilities` schema ambiguity — LLM passes wrong type on first attempt; requires
  2 correction cycles; Fix 5 candidate for `experiment/local-tool-fixes`

---

## [Unreleased]

### Fixed
- `docker-compose.yml` — renamed `AGENC_PROGRAM_ID` → `AGENC_RUNTIME_PROGRAM_ID` in
  both `agenc-creator` and `agenc-worker` service definitions. The CLI reads
  `AGENC_RUNTIME_PROGRAM_ID` (`cli/index.ts:1332`); the old name was silently ignored,
  meaning the env var had no effect. Containers must be restarted to pick up the change.
- `docker/creator/config.json` — added `"programId": "GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3"`
  to the `connection` block. The runtime reads program ID from `connection.programId` —
  the `protocol.programId` field that was previously set is not read by `handlers.ts`.
- `docker/worker/config.json` — same `connection.programId` fix as creator config.

### Investigated (2026-04-04)
- **Watch console replaces operator console:** The `agenc` console binary (npm 0.1.0)
  now launches a workspace watch console instead of the operator console. Free-text chat
  returns no response. `agenc.claimTask` and other operator tools are not accessible.
  Pending npm release to assess new operator surface.
- **handlers.ts V1 hardcoding:** `createProgramContext` in
  `runtime/src/channels/webchat/handlers.ts` calls `createProgram(provider)` without
  passing `programId` — always defaults to the V1 program (`6UcJzb…`). Root cause of
  two observed bugs: (1) Tasks UI showing V1 tasks (189 on devnet) instead of V2; (2)
  `"Agent HmZqAs does not belong to connected signer"` — authority mismatch from
  fetching the agent account against the wrong program. Fix applied locally to
  `forks/agenc-core` (pass `connection.programId` from config as second arg to
  `createProgram()`; build passes). **Not pushed upstream — pending npm release
  assessment.** Takes effect in containers only after image rebuild from the fork.

### Docs
- `docs/RUNBOOK.md` — expanded "Known Issues — Pending npm Release" section: watch
  console entry updated with kill procedure (`agenc status` → `kill <pid>`), note that
  `/quit`/`/exit` do not stop the daemon, and that `agenc status` is the recommended
  diagnostic. Added new entry: "Mac daemon kill procedure" — same procedure with context
  for macOS fork-binary usage. Total: four entries in the section.
- `CLAUDE.md` — added Key Rule 10: use `agenc status` / `node .../agenc.js status` to
  inspect daemon state (pid, port, config path, channel status); `/quit`/`/exit` do not
  stop the daemon on macOS; kill via pid from status output.
- `docs/RUNBOOK.md` — (prior commit) added "Known Issues — Pending npm Release" section
  with three entries: watch console regression, `connection.programId` correct config key,
  and `handlers.ts` V1 hardcoding. Corrected "Environment variables" section:
  `AGENC_PROGRAM_ID` → `AGENC_RUNTIME_PROGRAM_ID` with note that the old name is not
  read by the CLI.

### Docs
- `docs/RUNBOOK.md` — "Review before submitting" note added after upstream PR
  branch discipline section: show full content of any Issue, PR, commit message,
  or push to user before executing; wait for explicit approval; never auto-submit.
- `CLAUDE.md` — updated to 2026-04-02. Quick Reference: devnet program updated to
  V2 (`GN69C…`), protocol config PDA, creator and worker agent PDAs added, wallet
  SOL balance removed. Devnet Environment: program show command updated to V2.
  Key Rules: rules 8 (upstream PR branch discipline) and 9 (review before
  submitting) added. Reference Docs: runbook path corrected to `docs/RUNBOOK.md`
  in agenc-local-dev; stale `REFACTOR-MASTER-PROGRAM.md` entry replaced with
  project plan link.

### Added
- `docker-compose.yml` — added `AGENC_PROGRAM_ID=GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3`
  environment variable to both `agenc-creator` and `agenc-worker` service definitions.
  The Tasks UI reads the program from `AGENC_PROGRAM_ID` (or `SOLANA_PROGRAM_ID` as a
  fallback); without it the UI defaults to the V1 program (`6UcJzb…`) and V2 tasks
  are not visible. Containers must be restarted to pick up the change.
- `.env.example` — documented `AGENC_PROGRAM_ID` with description and fallback note.
- `docs/PROJECT-PLAN.md` — Task 19: **Concordia wave review** added to Observability
  track. Review concordia PRs that landed 2026-04-02 (AgenC #1541–#1545, agenc-core
  #146–#147) — planned session flow, world-scoped memory, ESM build fix, sim launch
  path, turn isolation, world-scoped host services. Identify contribution opportunities
  and file any resulting issues or PRs. Depends on: nothing. Status: not started.
- `docs/PROJECT-PLAN.md` — new **Platform Testing** track (Tasks 11–18) covering
  the full breadth of protocol features available for testing on devnet:
  Task 11 (create task via UI/console), Task 12 (work task via UI/console),
  Task 13 (dependent task chains / DAG), Task 14 (dispute resolution — all 7
  dispute instructions), Task 15 (cancellation + claim expiry), Task 16 (agent
  feed post + upvote), Task 17 (reputation staking + delegation + cooldown),
  Task 18 (ZK private task completion via RISC Zero Groth16). Suggested order
  updated: `… → 7 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 10 → 6`.
  Status table updated with all 8 new rows at "not started".

### Security
- **Pre-commit security hook (2026-04-02):** `scripts/setup-hooks.sh` installs a
  pre-commit hook at `.git/hooks/pre-commit` that runs three scan passes on every
  `git commit`: (1) full tracked-tree scan via `git ls-files`, (2) staged-files scan
  via `git diff --cached`, and (3) a docker `config.json` guard. Blocks and reports
  matches for xAI keys, Anthropic keys, Bearer tokens, and Telegram bot tokens. Hook
  tested: confirmed blocks on fake `xai-AAA…` pattern, passes on clean files.
  `.git/hooks/` is not tracked — new clones run `bash scripts/setup-hooks.sh` once.
- **Exposed API key remediation (2026-04-02):** `docker/creator/config.json` and
  `docker/worker/config.json` were present in git history (commit `c5455a0`) with a real
  xAI API key. GitHub push protection blocked the push. Key rotated, both files expunged
  from all 45 commits via `git filter-repo --invert-paths`, history force-pushed clean.
  GitHub secret scanning shows 0 open alerts post-push. Prevention notes added to
  `docs/RUNBOOK.md` under new "Security Incidents" section.

### Docs
- `docker-compose.yml` (root) — replaced legacy `agenc-operator` single-service definition
  with dual `agenc-creator` (port 3100) and `agenc-worker` (port 3101) services. Root compose
  is now canonical; `docker compose up -d` from `agenc-local-dev/` starts both containers.
  Volume names: `agenc-local-dev_agenc-creator-data`, `agenc-local-dev_agenc-worker-data`.
  Config bind-mounts from `./docker/creator/config.json` and `./docker/worker/config.json`.
- `scripts/devnet-task-lifecycle.mjs` — updated hardcoded agent PDAs from stale V1-era values
  (`GvXS49…` creator, `CmehT9…` worker) to current V2 PDAs (`HmZqAsDz…`, `DQ1drYVZ…`).
  Root cause: PDAs were set at initial script creation and never updated after the V2 re-registration.
- `CLAUDE.md` — retired "Operator Instance (Docker)" section; replaced with "Docker Containers"
  table listing `agenc-creator` and `agenc-worker` with ports, wallets, and config paths.
  Updated Quick Reference line to reference dual-container setup.
- `README.md` — replaced all `docker exec agenc-operator` commands with `agenc-creator`.
- `docs/RUNBOOK.md` — updated daily ops commands from `agenc-operator` to `agenc-creator`/
  `agenc-worker`; updated dual-container start path from `docker/` subdir to root; added
  retirement note for `agenc-operator`.
- `docs/HOW-TO/HOW-TO-DUAL-DOCKER.md` — updated directory layout note, start/stop commands
  now reference root compose instead of `docker/` subdir; updated port conflict section.
- `skills/agenc-morning-sync/SKILL.md` — Step 6 updated to check `agenc-creator` and
  `agenc-worker` independently and start via root `docker compose up -d`; summary block
  updated to show both containers.
- `docs/RUNBOOK.md` — dual-agent task lifecycle run (2026-04-02): full create→claim→complete
  confirmed against V2 program (`GN69C…`) with both containers live (creator port 3100, worker
  port 3101). Task PDA `2FVqsj…`, all three txs confirmed on devnet. Worker container was
  down at start — started via `docker compose up -d agenc-worker`.
  Fix: `scripts/devnet-task-lifecycle.mjs` had stale V1-era agent PDAs hardcoded (`GvXS49…`
  creator, `CmehT9…` worker); updated to V2 PDAs (`HmZqAsDz…`, `DQ1drYVZ…`) before running.
- `docs/RUNBOOK.md` — added creator agent confirmation entry (2026-04-02): queried
  `HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` via `getAgent()` with V2 IDL;
  account is active against `GN69C…` (V2 program), authority `BP3rDM…` (creator wallet),
  capabilities=1, status=1, stakeAmount=1,000,000 lamports, activeTasks=0, reputation=5000.
  Creator container confirmed healthy (HTTP 200, port 3100), wallet balance 33.36 SOL.
  No fresh registration was needed.
- `docs/PROJECT-PLAN.md` — updated task statuses as of 2026-04-02: Tasks 1–3, 6–8 confirmed
  done; Task 4 (TASKS UI bug) now reflects PR #43 open awaiting re-review from Pavelevich;
  Task 5 closed as n/a (too minor, low upstream value); Tasks 9–10 marked on hold /
  blocked pending dev team response on token usage logging. Added **Future PR Opportunities**
  section cataloguing the stale `PROGRAM_ID` V1 constant in `agenc-sdk/src/constants.ts`
  and downstream references in `agenc-core/mcp/src/server.ts`, soak scripts, and
  `bootstrap-cli.ts` — not blocking today but candidate for upstream PR when team has
  bandwidth.
- `docs/RUNBOOK.md` — added Known Issue #5: Pack Smoke CI failure due to PostCSS native
  binding missing in CI runner (`public-install-min-node` + `private-kernel-registry` checks);
  root cause is npm optional deps bug [npm/cli#4828](https://github.com/npm/cli/issues/4828),
  pre-existing on upstream `main` as of 2026-04-02, not PR-specific
- `docs/RUNBOOK.md` — expanded Protocol Config PDA entry with full root cause analysis
  (2026-04-02): seed is `"protocol"` (single word); V2 program `GN69C…` + seed →
  `GEXnAns2…` ✓; `agenc-sdk/src/constants.ts` `PROGRAM_ID` constant is still the V1
  program (`6UcJzb…`) so any `deriveProtocolPda()` call without an explicit `programId`
  arg derives the wrong PDA; local devnet scripts are safe (build Program object from IDL,
  pass `program.programId` explicitly); upstream stale V1 references catalogued in
  agenc-core MCP server, soak scripts, and bootstrap-cli

### Verified
- **Dual-agent task lifecycle — V2 devnet — 2026-04-02:** full create → claim → complete
  confirmed against program `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (Task Validation V2)
  using both containers running from root `docker-compose.yml`.
  Creator (`agenc-creator`, port 3100, wallet `BP3rDM…`) created task;
  worker (`agenc-worker`, port 3101, wallet `26d6kx…`) claimed and completed it.
  Task PDA: `2FVqsjXojtpsJ1tYpD22dkhyAV76XjKCpSfNxgFVRVBm`. Reward: 0.01 SOL.
  Final state: Completed at 2026-04-02T23:03:23Z.
  Solscan txs: create `2REHbJQ…`, claim `z9Zr2Aj…`, complete `4PDbvrc…`.

### Fixed
- `scripts/devnet-task-lifecycle.mjs` — corrected stale V1-era agent PDAs hardcoded at script
  creation (`GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs` creator, `CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V`
  worker). Updated to V2 PDAs (`HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` creator,
  `DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv` worker). Script was failing with
  `AccountNotInitialized` on `creator_agent` because the old PDA no longer exists under
  the V2 program.
- `heartbeat.enabled: false` added to all container configs and Dockerfile injection
  to stop idle LLM token burn. The runtime's heartbeat scheduler defaults to
  **enabled** when no `heartbeat` key is present in config — firing grok-3 requests
  every 5 minutes (2 meta-planner actions per fire) plus a `self-learning` cron
  every 6 hours and a `curiosity` cron every 2 hours, all with no user activity.
  Over ~7 days continuous this burned ~$50 in xAI tokens. The single config key
  `"heartbeat": { "enabled": false }` gates the entire autonomous features block.
  Applied to: `docker/creator/config.json`, `docker/creator/config.json.example`,
  `docker/worker/config.json`, `docker/worker/config.json.example`, and the
  `agenc-start.sh` injection script in `Dockerfile`.

### Added
- `agenc-morning-sync` skill — codifies the session-start workflow as a reusable Claude skill:
  fetches upstream changes across all AgenC repos, syncs forks that have new commits,
  checks PR status, and starts the Docker operator container
- `agenc-morning-sync` skill now checks the tetsuo-ai GitHub org for new repositories
  created since the previous session; flags anything matching `agenc-marketplace` or other
  extracted-component naming patterns against the known six-repo list
- `agenc-morning-sync` skill: Step 3b — npm release check for `@tetsuo-ai/agenc`;
  compares `dist-tags.latest` against baseline `0.1.0` (published 2026-03-19);
  prints a single-line status in the sync summary; alerts with release date and
  image rebuild prompt when a newer version is available — prevents rebuilding the
  Docker image when tetsuo-ai has not yet published
- `agenc-morning-sync` skill now includes Step 5b: rebuild `forks/agenc-sdk` dist if
  any agenc-sdk commits landed during sync (dist/ is gitignored; stale dist causes BN
  errors in devnet scripts)
- `scripts/devnet-task-lifecycle.mjs` — full create→claim→complete task lifecycle on
  devnet using separate creator (`creator.json`) and worker (`worker.json`) wallets; confirmed
  working 2026-03-24 (create `4q2d3zL…`, claim `3RwRUqC…`, complete `3FCrfT8…`)
- `package.json` — declares `@tetsuo-ai/sdk` (file path), `@coral-xyz/anchor`, and
  `@solana/web3.js` as explicit deps to ensure a single hoisted anchor instance and
  avoid the BN dual-instance error
- `docs/HOW-TO-TASK-LIFECYCLE.md` — full walkthrough for devnet task lifecycle including
  pre-flight checklist, cost breakdown, recovery paths, and verified Solscan links
- `README.md` — added Skills and Scripts sections, scripts/ to Contents table,
  and Prerequisites — Devnet Wallets table to Requirements
- `docs/PROJECT-PLAN.md` — 10-task contributor roadmap across 4 tracks:
  Infrastructure, Upstream Contributions, Protocol (on-chain work), and
  Observability; includes dependency graph and suggested execution order
- `forks/agenc-core` branch `fix/task-ownership-ui` pushed — scopes `[CANCEL TASK]`
  and `[CLAIM TASK]` buttons to wallet ownership: cancel only shows for task creator,
  claim only shows for non-creator; `agentWallet` prop threaded from
  `walletInfo.wallet?.address` through `MarketplaceView → TasksPane → TasksView → TaskCard`;
  safe default (neither button renders) when wallet not yet loaded — closes tetsuo-ai/agenc-core#32
- `agenc-core/web` dev server setup documented: build `@tetsuo-ai/desktop-tool-contracts`
  then `@tetsuo-ai/runtime` to produce `dist/browser.mjs`; start with
  `npm run dev` in `web/`; point at live container via `?ws=ws://localhost:3100`
  query param (no proxy config needed — `useWebSocket` reads `ws` from query string)

## [0.2.0] — 2026-03-21

### Investigation: gateway.bind + Docker bridge IP

The initial `[0.1.0]` setup used `gateway.bind: "0.0.0.0"` (daemon binds all
interfaces) with `AUTH_SECRET` (required by the runtime for non-loopback binding).
This session investigated the TRACE tab returning `Authentication required` and
arrived at a different architecture.

**Root cause discovered:** `auth.localBypass: true` only fires when the
connection `remoteAddress` is exactly `127.0.0.1`, `::1`, or
`::ffff:127.0.0.1`. When a browser connects to `localhost:3100` on the Mac
host, Docker translates via the bridge network and the daemon sees the
connection from the bridge gateway IP (e.g. `192.168.97.1`), not loopback.
This means `localBypass: true` cannot authenticate browser connections through
Docker port mapping on macOS — regardless of the config.

**Structural constraint:** The runtime enforces `auth.secret is required when
gateway.bind is non-local`. This creates an unavoidable incompatibility:
`bind: "0.0.0.0"` requires `auth.secret`; `auth.secret` breaks browser UI via
Docker port mapping on macOS; `bind: "127.0.0.1"` makes the daemon unreachable
through Docker port mapping without an additional bridge.

### Fixed

- Restored socat bridge: daemon binds to `127.0.0.1:3100` (no `auth.secret`
  required); socat listens on `0.0.0.0:3101` and forwards to `127.0.0.1:3100`;
  docker-compose maps `host:3100 → container:3101`
- Removed `auth.secret` and `AUTH_SECRET` from config injection entirely —
  the socat architecture makes auth.secret unnecessary for local dev
- Docker port mapping corrected: `3100:3101` (container socat port, not daemon port)
- TRACE tab (`observability.traces`) now works in browser without authentication errors
- `socat` added back to apt-get install in Dockerfile

### Changed

- Config injection: `cfg.gateway = { port: ... }` (no bind, no auth) +
  `delete cfg.auth` to clear any residual auth config from the volume
- `AUTH_SECRET` env var removed from docker-compose.yml and .env.example
  (still present in compose environment block but unused; can be removed)

### Documentation

- PR #27 on `tetsuo-ai/agenc-core` updated with two-scenario Gateway Config
  documentation: Scenario 1 (browser UI via Docker, no auth.secret) and
  Scenario 2 (CLI-only via docker exec, with auth.secret + localBypass) —
  includes explicit note about Docker bridge IP limitation

---

## [0.1.0] — 2026-03-21

### Added
- `docker-compose.yml` for container orchestration with named volume persistence
- `.env.example` with `GROK_API_KEY`, `AGENT_NAME`, and `AUTH_SECRET` fields
- `agenc-start.sh` entrypoint script — auto-onboards, injects config from env, rebuilds `better-sqlite3`, starts daemon
- `docs/` directory — runbook moved here from repo root
- `skills/agenc-changelog-docs-update/SKILL.md` — skill for updating changelog and docs from git commits
- `AUTH_SECRET` environment variable — required by runtime when `gateway.bind` is non-loopback

### Fixed
- `gateway.host` replaced with correct `gateway.bind` field in `agenc-start.sh` — `gateway.host` is silently ignored by the runtime (`GatewayBindConfig` interface uses `bind`, not `host`)
- Daemon now binds directly to `0.0.0.0:3100` — socat TCP port forward workaround removed
- `EXPOSE` port corrected from `3101` to `3100`
- Docker port mapping updated from `3100:3101` to `3100:3100`

### Changed
- Dockerfile `CMD` changed from `["bash"]` to `["/usr/local/bin/agenc-start.sh"]` — container now starts daemon automatically on `docker compose up -d`
- `socat` removed from apt-get install and startup script — no longer needed
- Config injection now sets `gateway.bind: "0.0.0.0"` and `auth.secret` from `AUTH_SECRET` env var

### Documentation
- Added README with requirements table, quick start, daily operations, troubleshooting, and known issues
- Added full runbook at `docs/RUNBOOK.md` with contributor workspace setup
- Documented `gateway.bind` vs `gateway.host` distinction and `auth.secret` requirement

---

## Related upstream contributions

| Repo | Issue/PR | Description |
|---|---|---|
| `agenc-sdk` | Issue #8, PR #9 | `anchor.BN` undefined in CJS/ESM — fixed with namespace import |
| `agenc-core` | Issue #26, PR #27 | `gateway.bind` undocumented — added Gateway Config section to `RUNTIME_API.md` — **Merged** (`c99049d`) |
