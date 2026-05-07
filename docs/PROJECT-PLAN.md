# AgenC Project Plan

## Overview

Contributor roadmap for the letterj/agenc-local-dev workspace.
Updated: 2026-04-12

### Session Notes — 2026-04-12
- Upgraded containers to `@tetsuo-ai/runtime@0.2.0`
- Switched from private program (`9dMNFL…`) to V2 public (`GN69CoB…`) — V2 superseded 2026-04-22 by V3 `2jdBSJ8U…`
- Corrected worker2 wallet: `SFG7VnuZDg9x1Y5Kz81moJkUTLwDF1xgTZFPD3V3mT1`
- Corrected worker2 agent PDA: `BrnCh3DZtMR5jsak5t3it4i7si9DvWnk6tBzMteXvHGx`
- Both agents confirmed Active under V2 public program
- Full lifecycle (create → claim → complete) confirmed via CLI and chat UI
- Marketplace `[yours:0]` bug confirmed pre-existing in 0.2.0
- Grok 114-tool silent drop observed during agent register — workaround: use CLI
- Fix 5 identified: `requiredCapabilities` schema description improvement

---

## Tracks

### Infrastructure

Tasks that unblock everything else.

**Task 1 — Dual Docker environments (creator + worker)** ✅ DONE
Two agenc containers in docker-compose with separate wallets, separate ports
(3100 creator, 3101 worker). One `docker compose up` spins up both agents.
Depends on: nothing
Note: Committed c5455a0. agenc-creator on port 3100, agenc-worker on port 3101.
Both UIs confirmed healthy (HTTP 200). docker-compose.yml in docker/.
Docs updated: README, RUNBOOK, HOW-TO-DUAL-DOCKER.md.

**Task 2 — SDK dist build step in morning sync skill** ✅ DONE
Automate `npm run build` in `forks/agenc-sdk` when upstream changes land.
Prevents stale dist breaking lifecycle scripts.
Depends on: nothing
SDK dist rebuild now automatic in morning sync when agenc-sdk has new
upstream commits. Added as Step 2b in agenc-morning-sync/SKILL.md.
Build failure reported but does not block rest of sync.

**Task 3 — Install gh CLI + enrich morning sync PR status** ✅ DONE
gh was already installed (v2.88.1) and authenticated as letterj.
PR tracking now dynamic via gh search prs. Tracked PR loop is empty —
add entries when new PRs are filed.
Depends on: nothing

### Task: Local Build from agenc-core main — Experimental
**Track:** Infrastructure
**Status:** Scoped — not started
**Priority:** Low / opportunistic
**Prerequisite:** agenc-core main CI fully green ✅ (confirmed 2026-04-08)

**Goal:**
Build `@tetsuo-ai/runtime` locally from `forks/agenc-core` and rebuild Docker containers to point at the local build instead of the `0.1.0` npm binary. Unlocks UI task lifecycle, CLI agent PDA auto-discovery, and the programId passthrough fix without waiting for an npm release.

**What it involves:**
1. `npm run build` in `forks/agenc-core` — confirm clean output
2. Update `docker-compose.yml` to mount or copy the local build instead of installing from npm
3. Rebuild `agenc-creator` and `agenc-worker` images
4. Run `devnet-task-lifecycle-test.mjs` as baseline confirmation
5. Verify UI task ownership behaviour (create/claim/complete via `http://localhost:3100/ui/`)

**Risks:**
- Phase 3 refactor still landing daily — rebuild overhead on each significant upstream push
- Private kernel tests cleared but codebase not declared stable
- Local build immediately superseded when npm release drops

**Exit criteria:**
- `devnet-task-lifecycle-test.mjs` passes against local build ✅
- UI task ownership buttons (CLAIM/CANCEL) behave correctly per upstream PR #283 logic ✅
- Treat as experimental — revert to npm binary when official release drops

**Trigger:**
Attempt when upstream commit velocity slows or npm release appears imminent. Do not attempt during active refactor sprints.

### Task: Own Protocol Authority — Isolated Program Deployment
**Track:** Infrastructure
**Status:** Scoped — not started
**Priority:** Low / exploratory
**Prerequisite:** Anchor CLI 0.32.1, Solana CLI 3.0.13, ~5 SOL devnet funding for deployment fees
**Wallet provisioned:** `EEB7R1tYTGxPziNQfB6jdADs4E58d5ZYfLoRN4NyBnhx` — 15 SOL funded 2026-04-09 (5 SOL from creator + 10 SOL devnet faucet) ✅

**Goal:**
Deploy a private instance of `programs/agenc-coordination` to devnet with a locally-controlled protocol authority keypair. This unlocks:
- Full `marketplace-tui-devnet-smoke.ts` execution including dispute resolution
- End-to-end protocol testing without dependency on the team's authority keypair or devnet state
- A self-contained environment for validating upstream changes before they ship

**Key provisions:**

1. **Create PROTOCOL_AUTHORITY_WALLET** ✅ done (2026-04-09)
   - Keypair: `~/.config/solana/protocol-authority.json` (permissions 600)
   - Public key: `EEB7R1tYTGxPziNQfB6jdADs4E58d5ZYfLoRN4NyBnhx`
   - Funded: 15 SOL (5 SOL from creator + 10 SOL devnet faucet)
   - Never use creator or worker wallets as authority — keep roles distinct

2. **Isolation strategy — evaluate before building**
   Before deploying, answer the following:
   - Does a private program instance conflict with any team-side devnet state we depend on?
   - Can creator/worker agents be re-registered against the private program without affecting their registration on the team's V2 program (`GN69Co...`)?
   - Should the private program use a separate RPC endpoint or cluster?
   - Recommended: maintain two config profiles — `config.team.json` (points to team V2) and `config.private.json` (points to private deployment). Switch between them explicitly, never mix.

3. **Docker container for Anchor toolchain** ✅ files created (2026-04-10)
   The host Mac has version constraints that make Anchor 0.32.1 + Solana CLI 3.0.13 + Rust stable fragile to manage alongside other tooling. Strongly prefer an isolated Docker build container:
   - Base image: Ubuntu 22.04
   - Install: Rust stable, Solana CLI 3.0.13, Anchor CLI 0.32.1, Node.js 20
   - Source: full `forks/agenc-protocol/` workspace mounted at `/build` (Anchor.toml at root)
   - Output: `forks/agenc-protocol/target/` — compiled `.so` artifact + IDL
   - Keypairs: mounted from host, never baked into image
   - This container is build-only — not a runtime container
   - Files: `docker/anchor-build/Dockerfile`, `docker/anchor-build/build.sh`
   - Image not yet built — awaiting explicit confirmation to run docker build
   - Note: Docker image build will take 15-30 min (Rust + Anchor compilation from source)

**Deployment steps:**
1. Build program: `cargo-build-sbf` from program dir ✅ done (2026-04-10)
2. Deploy to devnet: `anchor deploy --provider.cluster devnet` ✅ done (2026-04-10)
   — Program ID: `9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc`
   — Note: declare_id! update + upgrade required after initial deploy (standard Anchor workflow)
3. Run `initialize_protocol` via `scripts/validation-initialize.mjs` ✅ done (2026-04-10)
   — Protocol Config PDA: `6rGjoLyG4HicDqoDeweKFYFpxxrV81kWzyYZ8xsvA2Pe`
   — Bid Marketplace PDA: `EifZXrtSfKJiyexvwJdBHuUQFwdE9ZLnGkJm2sjqxeiN`
   — ZK Config PDA: `FMZHRR7NpkryTSAvPtqfjtHigjMLuDNvRYtpBys3yHVR`
   — Config: `artifacts/devnet-readiness/private-init.config.json`
   — ⚠️ Gap: `validation-initialize.mjs` does NOT call `initializeGovernance`
   — Resolution: `scripts/devnet-init-governance.mjs` created (2026-04-09, commit bff9f69)
   — Governance Config PDA: `nXZbxo5v9L2Wi7PdhTW5qXALKNAhFFgiLRUEwMfVdWq`
   — Deployment checklist: run `devnet-init-governance.mjs` after `validation-initialize.mjs`
     for any new private program deployment, before running the marketplace TUI smoke test
4. `config.private.json` created: `docker/creator/config.private.json` ✅ done (2026-04-10)
5. Register creator and worker agents ✅ done (2026-04-10)
   — Creator agent PDA: `8dHNT4zrJojCyzVmxPkBP4xnfmEwd6eDXYq2Lp12Z7nW`
   — Worker agent PDA: `4Rz7m7FfrHqMNTsDms3r2tRTKEwrx9M8FVGgATwykiqy`
   — Script: `agenc-local-dev/scripts/devnet-register-agents.mjs`
6. Run `devnet-task-lifecycle-test.mjs` against private program ✅ done (2026-04-10)
   — create → claim → complete confirmed on-chain
   — Note: treasury needed 0.01 SOL seed before first complete (rent-exempt minimum)
7. Run `marketplace-tui-devnet-smoke.ts` with all 6 wallets ✅ done (2026-04-09)
   — All phases passed: reputation, cancel, completion, skills, governance, dispute votes
   — Pre-req: initialized `governance_config` via `scripts/devnet-init-governance.mjs`
     PDA: `nXZbxo5v9L2Wi7PdhTW5qXALKNAhFFgiLRUEwMfVdWq`
   — Dispute `EPAXHFWHtGivwG4UNaq7yyiKffAzfAAfCn1FW5WcP913` pending resolution deadline 2026-04-10T20:30:22Z
   — Resume artifact: `/var/folders/pj/_0z603bs42x7dl2fchrgq8jw0000gn/T/agenc-marketplace-tui-smoke/marketplace-tui-devnet-smoke-1775766630926.json`
   — Run resume with `PROTOCOL_AUTHORITY_WALLET=~/.config/solana/protocol-authority.json npm run smoke:marketplace:tui:devnet -- --resume <artifact>`

**What this does NOT affect:**
- Team's V2 program (`GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3`) — untouched (superseded 2026-04-22 by V3 `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`)
- Existing agent registrations on team's program — untouched
- `experiment/local-dev-setup` branch — no code changes needed
- Ability to submit PRs upstream — completely independent

**Risks:**
- Anchor version pinning inside Docker adds maintenance overhead
- Private program will drift from team's deployed version as upstream evolves
- Dispute voting deadlines on devnet may require multi-session resume runs
- Protocol authority keypair must be protected — treat as sensitive as wallet keypairs

**Trigger:**
Attempt after local build task is validated and commit velocity on agenc-core slows. Do not attempt while Phase 3 refactor is actively landing.

---

### Upstream Contributions

PRs and issues against tetsuo-ai repos.

**Task 4 — Fix TASKS UI bug (Issue #32)** ✅ resolved upstream
Filter tasks by `creator == agentWallet`. Show `[CLAIM TASK]` for claimable
tasks. PR against `agenc-core` `web/src/components/dashboard/`.
Depends on: nothing
Issue: tetsuo-ai/agenc-core#32
PR: tetsuo-ai/agenc-core#43 — closed 2026-04-08 (not merged). Fix landed upstream
in PR #283 (fix: improve market agent discovery and task ownership ui).

**Task 5 — Fix GETTING_STARTED.md stale reference** ✅ closed as N/A
GETTING_STARTED.md does not exist in tetsuo-ai/AgenC or agenc-core.
Stale "private access required" text not found in either repo's docs/.
Cleaned up as part of the refactor that landed 2026-03-25
(REFACTOR-MASTER-PROGRAM.md and REFACTOR.MD deleted, replaced with structured docs/).

**Task 6 — Follow up on PR #27 (gateway.bind docs)** ✅ DONE
PR #27 merged (c99049d). Confirmed 2026-03-25.
PR: tetsuo-ai/agenc-core#27

---

### Protocol — On-Chain Work

Hands-on work with the AgenC protocol.

**Task 7 — Full task lifecycle with dual Docker agents**
Re-run `devnet-task-lifecycle.mjs` with creator and worker running as
separate agenc containers. Verify end-to-end with two live daemons.
Depends on: Task 1
Note: Devnet program redeployed 2026-03-27 to new program ID GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3 (V2, superseded 2026-04-22 by V3 `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`)
with Task Validation V2. Old program 6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab still has registered agents
but is superseded. Task 7 requires fresh agent registration against the
new program using the current IDL.
Completed 2026-03-28. Fresh agents registered (creator: HmZqAsDz..., worker: DQ1drYVZ...).
SHA-256 hash verification task completed on-chain. See docs/HOW-TO/HOW-TO-FULL-TASK-LIFECYCLE.md.
Lifecycle test suite defined in HOW-TO-LIFECYCLE-TEST-SUITE.md.
Confirmed again 2026-04-02 against V2 program with both containers running from root
docker-compose.yml (agenc-creator port 3100, agenc-worker port 3101). Full create →
claim → complete with payment confirmed. Fix required: devnet-task-lifecycle.mjs had
stale V1-era PDAs hardcoded; updated to V2 PDAs before run. ✅ complete.

**Task 8 — Telegram channel connector** ✅ DONE
Wire Telegram bot token into agenc config. Test agent receiving and
responding to messages. Documents the connector lifecycle.
Depends on: Task 1
Both bots live and responding in Telegram.
Bug filed as agenc-core #73 (double-registration).
Fix PR #74 (fix/channels-double-registration) merged 2026-03-30.
Dockerfile patch workaround in place (agenc-start.sh sed on daemon.js).
Docs: HOW-TO-TELEGRAM-CONNECTOR.md

---

### Platform Testing

End-to-end tests of protocol features using the live dual-container setup.

**Task 11 — Create a task via UI and console** ✅ DONE
Test task creation through both the web UI (`http://localhost:3100/ui/`) and the
`agenc-console` CLI. Document both paths — steps, feedback, differences in UX.
Note any gaps or friction points worth filing upstream.
Depends on: Task 1
Note: Task creation confirmed via chat UI (port 3100), CLI (`market tasks create`),
and TUI (`market tui`). `requiredCapabilities` schema ambiguity noted — LLM requires
2 correction cycles on first attempt (Fix 5 candidate). Documented in LOCAL-FIXES.md.

**Task 12 — Work a task via UI and console** ✅ DONE
Test the full claim → complete flow through both the web UI and `agenc-console`.
Document both paths. Note ownership guard behavior (CLAIM/CANCEL scoped to wallet —
landed upstream in PR #283).
Depends on: Task 11
Note: Full claim → complete confirmed via chat UI (worker at port 3101) and CLI.
Telegram also confirmed wired end-to-end against V2 public program.
TUI (`market tui`) confirmed showing live V2 data across tasks, disputes,
governance, and reputation surfaces.

**Task 13 — Complex dependent task chains** ⛔ BLOCKED
Use `create_dependent_task` to build a multi-step DAG — at least 3 tasks with
dependencies. Verify on-chain ordering and dependency enforcement. Try to claim
a dependent task before its parent completes — confirm it is blocked.
Depends on: Task 7
Tested: 2026-04-16 against V3 program `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`, devnet.
Blocker 1 — No CLI surface for dependent task creation: `agenc market tasks create-dependent`
  does not exist and `tasks create` has no `--parent` / `--depends-on` flag. The
  `createTaskFromTemplate` / AccountNotSigner path (V3 Issue 1) cannot be tested via CLI.
Blocker 2 — V3 escrow rent bug (V3 Issue 2): `complete_task` fails with
  "account (2) insufficient funds for rent" at Solana runtime. Program logic itself
  passes (`complete_task_done` logged), but transaction is rejected before settlement.
  Basic task lifecycle (create → claim → complete) is broken on V3 devnet.
Dev team notified: Yes (Telegram, 2026-04-16).
Stuck devnet task: `9cVyG56mSjbR5ZAfSt5ByvSFQ2bpjLtBMEnqG8nykR6u` — in_progress, leave it.

---
**⛔ CASCADE BLOCKER — V3 `complete_task` escrow rent bug**
Tasks 13, 16, and likely 17 are all blocked by the same root cause: the V3 program's
`complete_task` instruction fails at Solana runtime with "account (2) insufficient funds
for rent", even though program logic succeeds. Until this is fixed upstream:
  - Task 13: can't complete tasks → dependent chain can't be exercised
  - Task 16: can't earn reputation via task completion → reputation gate (5000 < 5500)
    blocks `post_to_feed` for both agents
  - Task 17: reputation staking/delegation can be tested, but `complete_task` scenarios
    that affect reputation are blocked
All three unblock simultaneously once the upstream rent fix lands in agenc-protocol.
Known V3 stuck task on devnet: `9cVyG56mSjbR5ZAfSt5ByvSFQ2bpjLtBMEnqG8nykR6u` (in_progress, leave it).
---

**Task 14 — Dispute resolution flow**
Creator creates a task, worker completes it, creator initiates a dispute with
evidence hash, arbiter votes, resolution executes. Verify refund/complete/split
outcomes and slashing mechanic. Tests all 7 dispute instructions end-to-end.
Depends on: Task 7

**Task 15 — Task cancellation and claim expiry**
Two sub-tests: (1) creator cancels a task mid-flight — verify refund. (2) Let
a claimed task go stale, trigger `expire_claim` — verify state transition.
Document both on-chain outcomes.
Depends on: Task 7

**Task 16 — Agent feed** ⛔ BLOCKED
Post to the on-chain feed from the creator agent. Upvote the post from the
worker agent. Verify both on-chain. Lightweight test of the social layer.
Depends on: Task 1
Tested: 2026-04-16, V3 program `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`.
Blocker — Reputation gate: `post_to_feed` requires `reputation >= 5500`
  (MIN_FEED_POST_REPUTATION, post_to_feed.rs:11). Both agents are at 5000 base
  reputation (500 point gap each). Reputation only increases via `complete_task`,
  which is broken by the V3 escrow rent bug. Delegation is computed off-chain only
  and is not visible to the on-chain `author.reputation` field. No admin override.
Secondary bug found: `topic` field must be non-zero — `[0u8; 32]` triggers
  `FeedInvalidTopic` at post_to_feed.rs:71. Scripts patched (hash of "task16-test").
Scripts ready: `scripts/devnet-feed-post.mjs` + `scripts/devnet-feed-upvote.mjs` —
  correct and tested up to the reputation gate. Unblock immediately once rent bug fixed.

**Task 17 — Reputation staking and delegation**
Stake tokens from creator agent via `stake_reputation`. Delegate to worker agent
via `delegate_reputation`. Verify on-chain state. Revoke delegation. Attempt
withdraw before 7-day cooldown — confirm blocked. Document full flow.
Depends on: Task 7

**Task 18 — ZK private task completion**
Use `complete_task_private` with a RISC Zero Groth16 proof instead of a public
proof. Verifies the full ZK pipeline end-to-end on devnet. Reference the
`risc0-proof-demo` example in the AgenC repo.
Depends on: Task 7

---

### Observability

Token usage tracking and benchmarking.

**Task 19 — Concordia wave review — contribution opportunity scan**
Review the concordia-related PRs that landed 2026-04-02 (AgenC #1541–#1545,
agenc-core #146–#147): planned session flow, world-scoped memory, ESM build fix,
sim launch path, turn isolation, world-scoped host services. Read the diffs,
understand the memory wiring and session checkpointing changes. Identify any
gaps, rough edges, missing tests, or doc improvements that would make a good
upstream PR. Document findings and file any issues or PRs that emerge.
Depends on: nothing

**Task 9 — Token usage monitoring** ⏸ on hold, awaiting dev team response
File issue against agenc-core requesting LLM usage logging (input + output
tokens per call). Build lightweight proxy script while waiting for upstream.
Submit benchmark data to the team.

Feature request text (for Telegram + GitHub issue):

  Would love to see per-call token usage (input + output) surfaced in the
  runtime logs. Right now there's no way to see what a task lifecycle
  actually costs in tokens — makes it hard to benchmark, optimize prompts,
  or give the team real usage data.

  Ideal would be a log line per LLM call with at minimum:
  - input tokens
  - output tokens
  - model/provider
  - call context (e.g. task ID or tool name if available)

  Even just passing through whatever the provider returns in the response
  metadata would be enough to build on. Happy to wire up a lightweight
  proxy script in the meantime — but wanted to check if this is already
  planned or if a logging hook exists somewhere I'm missing.

Telegram message sent 2026-03-25. Waiting for dev team response.
GitHub issue will be filed only if team approves.

Depends on: nothing (file issue first before building)

**Task 10 — Benchmark report — task lifecycle token costs** ⏸ blocked on Task 9
Once token tracking is in place, run the full lifecycle and capture token
counts per step. Format as a report to share with the dev team.
Depends on: Task 9

---

## Suggested Order

1 → 3 → 9 (file issue) → 7 → 2 → 8 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 10 → 6

---

## Status

| Task | Title | Status |
|---|---|---|
| 1 | Dual Docker environments | ✅ done |
| 2 | SDK dist in morning sync | ✅ done |
| 3 | gh CLI + PR status | ✅ done |
| 4 | Fix TASKS UI bug | ✅ resolved upstream (PR #283) |
| 5 | Fix GETTING_STARTED.md | ✅ closed n/a |
| 6 | Follow up PR #27 | ✅ done (merged) |
| 7 | Dual-agent lifecycle test | ✅ done |
| 8 | Telegram connector | ✅ done |
| 9 | Token usage monitoring | ⏸ on hold |
| 10 | Benchmark report | ⏸ blocked on Task 9 |
| 11 | Create task via UI and console | ✅ done (2026-04-12) |
| 12 | Work task via UI and console | ✅ done (2026-04-12) |
| 13 | Complex dependent task chains | ⛔ blocked (2026-04-16) |
| 14 | Dispute resolution flow | not started |
| 15 | Task cancellation and claim expiry | not started |
| 16 | Agent feed | ⛔ blocked (2026-04-16) |
| 17 | Reputation staking and delegation | not started |
| 18 | ZK private task completion | not started |
| 19 | Concordia wave review | not started |

---

## Future PR Opportunities

Items not blocking current work but worth upstreaming when the team has bandwidth.

**PROGRAM_ID hardcoded to V1 across multiple repos**

`agenc-sdk/src/constants.ts` exports `PROGRAM_ID` set to the V1 program address
(`6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab`). Because `deriveProtocolPda()`
defaults to this constant when called without an explicit `programId` argument,
any caller that omits the argument silently targets V1 rather than the current
V3 program (`2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`).

The same stale reference appears in:
- `agenc-core/mcp/src/server.ts`
- devnet soak scripts
- `bootstrap-cli.ts`

Local devnet scripts are not affected today (they build a `Program` object from
the IDL and pass `program.programId` explicitly). The risk is for callers that
rely on the default. Worth a targeted upstream PR — update the constant and add
a required-argument lint or JSDoc note — once the team is less busy.
