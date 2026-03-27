# AgenC Project Plan

## Overview

Contributor roadmap for the letterj/agenc-local-dev workspace.
Updated: 2026-03-25

---

## Tracks

### Infrastructure

Tasks that unblock everything else.

**Task 1 — Dual Docker environments (creator + worker)**
Two agenc containers in docker-compose with separate wallets, separate ports
(3100 creator, 3101 worker). One `docker compose up` spins up both agents.
Depends on: nothing

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
Note: Task Validation V2 landed upstream 2026-03-25 but devnet program
not yet redeployed. Stick to pre-V2 task lifecycle (register → create →
claim → complete) until tetsuo-ai redeploys. V2 instructions will fail
on-chain.

**Task 8 — Telegram channel connector**
Wire Telegram bot token into agenc config. Test agent receiving and
responding to messages. Documents the connector lifecycle.
Depends on: Task 1

---

### Observability

Token usage tracking and benchmarking.

**Task 9 — Token usage monitoring — file upstream issue first**
File issue against agenc-core requesting LLM usage logging (input/output
tokens per call). Build lightweight proxy script while waiting for upstream.
Submit benchmark data to the team.
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
| 1 | Dual Docker environments | not started |
| 2 | SDK dist in morning sync | not started |
| 3 | gh CLI + PR status | done |
| 4 | Fix TASKS UI bug | issue filed (#32) |
| 5 | Fix GETTING_STARTED.md | n/a |
| 6 | Follow up PR #27 | done |
| 7 | Dual-agent lifecycle test | not started |
| 8 | Telegram connector | not started |
| 9 | Token usage monitoring | not started |
| 10 | Benchmark report | not started |
