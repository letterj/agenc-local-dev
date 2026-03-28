# AgenC Lifecycle Test Suite

## Authors
- J Brett (letterj) — contributor, tester, domain context
- Claude Sonnet 4.6 — drafting, code generation, research assistance

## Overview
Four variations of the full task lifecycle test covering all combinations
of programmatic and UI-driven create/claim/complete flows.

## Test Task (all tests use the same task)
Description: "Compute the SHA-256 hash of the string:
  'This is only a test of the agenc-lifecycle on 2026-03-28'"
Expected result: 91a3adb05ed70ededf6ea7cdd14255eaa7f3f93ce60730a408b7ca9ad89bdf60
Reward: 0.01 SOL

## Prerequisites
- Both Docker containers running (docker compose up -d)
  Creator UI: http://localhost:3100/ui/
  Worker UI:  http://localhost:3101/ui/
- Creator agent PDA: HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H
- Worker agent PDA:  DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv
- Devnet program: GN69... (Task Validation V2, deployed 2026-03-27)
- See HOW-TO-FULL-TASK-LIFECYCLE.md for registration steps if PDAs are stale

---

## Test 1 — Fully Programmatic ✅ DONE (2026-03-28)
Create: script | Claim: script | Complete: script
- Tx signatures: create Yj4qKiX..., claim 24ULttJ..., complete 4ut4WnX...
- See HOW-TO-FULL-TASK-LIFECYCLE.md for full runbook
- Value: baseline — proves the protocol works end-to-end

---

## Test 2 — Programmatic Create, UI Claim + Complete
Create: script | Claim: worker UI | Complete: worker UI
Status: not started

Steps:
1. Run create step from script (creator wallet):
   node scripts/devnet-task-lifecycle-test.mjs --step create
2. Open worker UI at http://localhost:3101/ui/ → Tasks tab
3. Find the newly created task by description
4. Click [CLAIM TASK]
5. Verify claim transaction on devnet
6. Submit result hash via UI completion form
7. Verify final state shows Completed on devnet

Value: validates the UI can discover and act on programmatically-created tasks

---

## Test 3 — UI Create, Programmatic Claim + Complete
Create: creator UI | Claim: script | Complete: script
Status: not started

Steps:
1. Open creator UI at http://localhost:3100/ui/ → Tasks tab
2. Fill task creation form with test task description and 0.01 SOL reward
3. Submit and capture the task PDA from the transaction
4. Run claim + complete steps from script (worker wallet) using the captured PDA
5. Verify final state shows Completed on devnet

Value: validates the UI task creation flow produces valid on-chain state
the SDK can consume

---

## Test 4 — Fully UI-Driven
Create: creator UI | Claim: worker UI | Complete: worker UI
Status: not started

Steps:
1. Open creator UI at http://localhost:3100/ui/ → Tasks tab
2. Fill task creation form with test task description and 0.01 SOL reward
3. Submit and note the task ID
4. Open worker UI at http://localhost:3101/ui/ → Tasks tab
5. Find the task → click [CLAIM TASK]
6. Submit result hash via worker UI completion form
7. Verify final state shows Completed on devnet

Value: end-to-end UI validation — no scripts involved

---

## Results Log

| Test | Date | Status | Notes |
|------|------|--------|-------|
| 1 — Fully programmatic | 2026-03-28 | ✅ done | See HOW-TO-FULL-TASK-LIFECYCLE.md |
| 2 — Script create, UI claim/complete | — | not started | |
| 3 — UI create, script claim/complete | — | not started | |
| 4 — Fully UI-driven | — | not started | |
