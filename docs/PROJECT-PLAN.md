# AgenC Project Plan

## Overview

Contributor roadmap for the letterj/agenc-local-dev workspace.
Updated: 2026-04-02 (tasks 11–19 added)

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

---

### Upstream Contributions

PRs and issues against tetsuo-ai repos.

**Task 4 — Fix TASKS UI bug (Issue #32)** 🔄 PR #43 open
Filter tasks by `creator == agentWallet`. Show `[CLAIM TASK]` for claimable
tasks. PR against `agenc-core` `web/src/components/dashboard/`.
Depends on: nothing
Issue: tetsuo-ai/agenc-core#32
PR: tetsuo-ai/agenc-core#43 (fix/task-ownership-ui) — open, awaiting re-review from Pavelevich.

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
Note: Devnet program redeployed 2026-03-27 to new program ID GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3
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

**Task 11 — Create a task via UI and console**
Test task creation through both the web UI (`http://localhost:3100/ui/`) and the
`agenc-console` CLI. Document both paths — steps, feedback, differences in UX.
Note any gaps or friction points worth filing upstream.
Depends on: Task 1

**Task 12 — Work a task via UI and console**
Test the full claim → complete flow through both the web UI and `agenc-console`.
Document both paths. Note any ownership guard behavior (PR #43 related).
Depends on: Task 11

**Task 13 — Complex dependent task chains**
Use `create_dependent_task` to build a multi-step DAG — at least 3 tasks with
dependencies. Verify on-chain ordering and dependency enforcement. Try to claim
a dependent task before its parent completes — confirm it is blocked.
Depends on: Task 7

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

**Task 16 — Agent feed**
Post to the on-chain feed from the creator agent. Upvote the post from the
worker agent. Verify both on-chain. Lightweight test of the social layer.
Depends on: Task 1

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

1 → 3 → 9 (file issue) → 4 → 7 → 2 → 8 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 10 → 6

---

## Status

| Task | Title | Status |
|---|---|---|
| 1 | Dual Docker environments | ✅ done |
| 2 | SDK dist in morning sync | ✅ done |
| 3 | gh CLI + PR status | ✅ done |
| 4 | Fix TASKS UI bug | 🔄 PR #43 open, awaiting re-review |
| 5 | Fix GETTING_STARTED.md | ✅ closed n/a |
| 6 | Follow up PR #27 | ✅ done (merged) |
| 7 | Dual-agent lifecycle test | ✅ done |
| 8 | Telegram connector | ✅ done |
| 9 | Token usage monitoring | ⏸ on hold |
| 10 | Benchmark report | ⏸ blocked on Task 9 |
| 11 | Create task via UI and console | not started |
| 12 | Work task via UI and console | not started |
| 13 | Complex dependent task chains | not started |
| 14 | Dispute resolution flow | not started |
| 15 | Task cancellation and claim expiry | not started |
| 16 | Agent feed | not started |
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
V2 program (`GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3`).

The same stale reference appears in:
- `agenc-core/mcp/src/server.ts`
- devnet soak scripts
- `bootstrap-cli.ts`

Local devnet scripts are not affected today (they build a `Program` object from
the IDL and pass `program.programId` explicitly). The risk is for callers that
rely on the default. Worth a targeted upstream PR — update the constant and add
a required-argument lint or JSDoc note — once the team is less busy.
