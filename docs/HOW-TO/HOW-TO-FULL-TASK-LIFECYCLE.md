# HOW-TO: Full Task Lifecycle on Devnet

## Authors
- J Brett (letterj) — contributor, tester, domain context
- Claude Sonnet 4.6 — drafting, code generation, research assistance

Run a complete AgenC task lifecycle on Solana devnet:
register agents → create task → claim task → complete task.

Validated 2026-03-28 against the Task Validation V2 devnet deployment.

---

## Program Reference

| Program | ID | Status |
|---|---|---|
| New (V2, current) | `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` | Active — use this |
| Old (pre-V2) | `6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab` | Superseded — do not use |

The new program was deployed 2026-03-27. Any agents registered on the old program
are not usable with the current IDL. Fresh registration is required.

---

## Prerequisites

- Node.js >= 18, npm >= 10
- Solana CLI 3.0.13
- Two funded devnet wallets:
  - Creator: `~/.config/solana/id.json` — needs reward + ~0.02 SOL buffer
  - Worker: `~/.config/solana/worker.json` — needs ~0.005 SOL for fees
- SDK dist current: `cd ~/workshop/agencproj/forks/agenc-sdk && npm run build`
- IDL from the current protocol fork:
  `~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json`
- npm deps installed: `cd ~/workshop/agencproj/agenc-local-dev && npm install`

Export for convenience:

```bash
export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json
```

---

## Step 0 — Verify program and balances

```bash
solana program show GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3 --url devnet
solana balance BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT --url devnet
solana balance $(solana-keygen pubkey ~/.config/solana/worker.json) --url devnet
```

Expected: program exists, creator >= 0.03 SOL, worker >= 0.005 SOL.

---

## Step 1 — Register fresh agents

Agent PDAs are specific to the program they were registered against. Any time
you switch program IDs (e.g. after a devnet redeployment), register new agents.

```bash
cd ~/workshop/agencproj/agenc-local-dev
AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json \
node scripts/devnet-register-agents.mjs
```

The script prints both agent PDAs at the end:

```
=== Registration complete ===

Add these to devnet-task-lifecycle-test.mjs:
  CREATOR_AGENT_PDA = new PublicKey("HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H")
  WORKER_AGENT_PDA  = new PublicKey("DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv")
```

Copy the two `PublicKey(...)` lines into `scripts/devnet-task-lifecycle-test.mjs`,
replacing the `CREATOR_AGENT_PDA` and `WORKER_AGENT_PDA` constants at the top.

**Actual registration transactions (2026-03-28 run):**

| Agent | PDA | Tx |
|---|---|---|
| Creator | `HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` | `8729q3R9fHKMkZG9dkmKs6YFHnd1c2FaTzRqCxYetLowBM2PyLFNf5TAF33s9VM3na4aSS9fU8hb9UGBHJtiqce` |
| Worker  | `DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv` | `339CkbVf2WEQL6wv5uSd4sjrXFPeXKNept5nCKGb8UfykYZ5Nxw3jvbH1bUL8jAwSeo1PkUc8SDthjGqJMQ8GiGx` |

---

## Step 2 — Run the lifecycle test

The test script uses a fixed, verifiable task:

- **Description:** `Compute the SHA-256 hash of the string: 'This is only a test of the agenc-lifecycle on 2026-03-28'`
- **On-chain description (first 64 bytes):** `Compute the SHA-256 hash of the string: 'This is only a test o`
- **Proof hash (SHA-256 of the full test string):** `91a3adb05ed70ededf6ea7cdd14255eaa7f3f93ce60730a408b7ca9ad89bdf60`
- **Reward:** 0.01 SOL

```bash
cd ~/workshop/agencproj/agenc-local-dev
AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json \
node scripts/devnet-task-lifecycle-test.mjs
```

Expected output (abridged):

```
=== AgenC Task Lifecycle Test — devnet ===

[step 0] ✅ creator agent — capabilities: 1 | reputation: 5000
[step 0] ✅ worker agent  — capabilities: 1  | reputation: 5000

[step 1] ✅ task created
[step 2] ✅ task claimed
[step 2] state:   In Progress (expected: In Progress)
[step 3] ✅ task completed

[verify] ✅ state confirmed: Completed
[verify] ✅ proof hash matches: 91a3adb05ed70ededf6ea7cdd14255eaa7f3f93ce60730a408b7ca9ad89bdf60

=== lifecycle complete ===
```

**Actual transaction signatures (2026-03-28 run):**

| Step | Tx |
|---|---|
| create   | `Yj4qKiXbU7pNk1Zcv3Wr9k78RvN3ZiFH341j7yDbVpqLTXPX9VUkkBg3zyvLfFcDE9cUDa2UYwvzykqkbu6SLp2` |
| claim    | `24ULttJDKdXpST4X4hmPgBaQLaPuTmGG6i8EHpoykumq96z5YmVwLuLpJSbx8YebUJFy74yFubouuAQkNC4rFfB5` |
| complete | `4ut4WnXtwr2Cw8w3PBGQqKvNAaCS7F3a8Bhux4ihX2w9rgEzqnQor4zB3B4GH494W7hviHhPf3hC16Db1QmHaBUY` |

---

## Troubleshooting

### AccountNotInitialized on creator_agent or worker_agent

The agent PDA in the script does not exist on the current program. Re-run
`devnet-register-agents.mjs` and update the PDAs in `devnet-task-lifecycle-test.mjs`.

### AccountNotSigner on creator

Usually caused by mismatched IDL — the script is targeting a different program ID
than the one the agents are registered against. Confirm `AGENC_IDL_PATH` points
to the current IDL (containing `GN69...`) and that agent PDAs match.

### Insufficient balance

```bash
solana airdrop 2 BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT --url devnet
solana airdrop 1 $(solana-keygen pubkey ~/.config/solana/worker.json) --url devnet
```

Devnet airdrop is rate-limited. Wait 30 seconds between requests.

### Stale SDK dist

```bash
cd ~/workshop/agencproj/forks/agenc-sdk && npm run build
```

Scripts import from `forks/agenc-sdk/dist/` — a stale dist will fail with
BN or import errors.

---

## Re-running After a Devnet Redeployment

1. Check the new program ID: `grep address forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json`
2. Update `docs/PROJECT-PLAN.md` with the new program ID.
3. Run `devnet-register-agents.mjs` to get fresh PDAs.
4. Update `CREATOR_AGENT_PDA` and `WORKER_AGENT_PDA` in `devnet-task-lifecycle-test.mjs`.
5. Run the lifecycle test.
