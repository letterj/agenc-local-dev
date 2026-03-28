# AgenC Project Plan

## Overview

Contributor roadmap for the letterj/agenc-local-dev workspace.
Updated: 2026-03-25

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

**Task 2 — SDK dist build step in morning sync skill**
Automate `npm run build` in `forks/agenc-sdk` when upstream changes land.
Prevents stale dist breaking lifecycle scripts.
Depends on: nothing

**Task 3 — Install gh CLI + enrich morning sync PR status** ✅ DONE
gh was already installed (v2.88.1) and authenticated as letterj.
PR tracking now dynamic via gh search prs. Tracked PR loop is empty —
add entries when new PRs are filed.
Depends on: nothing

---

### Upstream Contributions

PRs and issues against tetsuo-ai repos.

**Task 4 — Fix TASKS UI bug (Issue #32)**
Filter tasks by `creator == agentWallet`. Show `[CLAIM TASK]` for claimable
tasks. PR against `agenc-core` `web/src/components/dashboard/`.
Depends on: nothing
Issue: tetsuo-ai/agenc-core#32

**Task 5 — Fix GETTING_STARTED.md stale reference** — N/A
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
Test 1 (fully programmatic) complete. Tests 2-4 pending.

**Task 8 — Telegram channel connector**
Wire Telegram bot token into agenc config. Test agent receiving and
responding to messages. Documents the connector lifecycle.
Depends on: Task 1

---

### Observability

Token usage tracking and benchmarking.

**Task 9 — Token usage monitoring — file upstream issue first**
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

**Task 10 — Benchmark report — task lifecycle token costs**
Once token tracking is in place, run the full lifecycle and capture token
counts per step. Format as a report to share with the dev team.
Depends on: Task 9

---

## Suggested Order

1 → 3 → 9 (file issue) → 4 → 7 → 2 → 8 → 10

---

## Status

| Task | Title | Status |
|---|---|---|
| 1 | Dual Docker environments | done |
| 2 | SDK dist in morning sync | not started |
| 3 | gh CLI + PR status | done |
| 4 | Fix TASKS UI bug | issue filed (#32) |
| 5 | Fix GETTING_STARTED.md | n/a |
| 6 | Follow up PR #27 | done |
| 7 | Dual-agent lifecycle test | done |
| 8 | Telegram connector | not started |
| 9 | Token usage monitoring | not started |
| 10 | Benchmark report | not started |
