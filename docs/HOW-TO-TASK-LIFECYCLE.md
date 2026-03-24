# How To: Run a Full Task Lifecycle on Devnet

**Last updated:** 2026-03-24
**Script:** `scripts/devnet-task-lifecycle.mjs`
**Network:** Solana devnet only — never mainnet

### Wallets used

| Role | Wallet file | Pubkey | Agent PDA |
|---|---|---|---|
| Creator | `~/.config/solana/id.json` | `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` | `GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs` |
| Worker | `~/.config/solana/worker.json` | `26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q` | `CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V` |

---

## What This Does

Runs the complete AgenC task lifecycle using a single wallet as both task
creator and worker:

```
Create task → Claim task → Complete task
```

Each step submits a transaction to devnet and prints the signature. After
completion the reward SOL (minus protocol fee) is returned to your wallet
and the escrow account is closed.

---

## Prerequisites

### 1. Two wallets with devnet SOL

**Creator** (`~/.config/solana/id.json`) needs at least **0.03 SOL**
(0.01 SOL reward + ~0.02 SOL for fees and escrow rent).

**Worker** (`~/.config/solana/worker.json`) needs at least **0.005 SOL**
for claim and complete transaction fees.

Check balances:
```bash
solana balance BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT --url devnet
solana balance 26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q --url devnet
```

Transfer SOL between wallets if needed (devnet airdrop is rate-limited):
```bash
solana transfer 26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q 5 \
  --from ~/.config/solana/id.json \
  --url devnet \
  --allow-unfunded-recipient
```

### 2. Both wallets registered as agents on devnet

The script fetches both agent IDs from their on-chain PDAs.

| Role | Agent PDA |
|---|---|
| Creator | `GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs` |
| Worker | `CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V` |

Verify they exist:
```bash
solana account GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs --url devnet
solana account CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V --url devnet
```

### 3. IDL file

The script needs the Anchor IDL to communicate with the on-chain program.

```bash
export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json
```

### 4. SDK installed

```bash
cd ~/workshop/agencproj/agenc-local-dev
npm install  # or: npm install ~/workshop/agencproj/agenc-sdk
```

---

## How to Run

```bash
cd ~/workshop/agencproj/agenc-local-dev

export AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json

node scripts/devnet-task-lifecycle.mjs
```

### Optional env vars

| Variable | Default | Description |
|---|---|---|
| `CREATOR_WALLET` | `~/.config/solana/id.json` | Creator keypair path |
| `WORKER_WALLET` | `~/.config/solana/worker.json` | Worker keypair path |
| `RPC_URL` | `https://api.devnet.solana.com` | Devnet RPC endpoint |
| `REWARD_LAMPORTS` | `10000000` (0.01 SOL) | Task reward amount |
| `DEADLINE_SECS` | `3600` (1 hour) | Seconds until task deadline |

---

## Pre-Flight Checklist

### Transaction Cost Breakdown

| Transaction | Compute Units | Base Fee | Accounts Created | Total |
|---|---|---|---|---|
| `createTask` | ~50,000 CU | ~0.000005 SOL | Task PDA + Escrow PDA (~0.003 SOL rent each) | ~0.006 SOL + [REWARD] escrowed |
| `claimTask` | ~45,000 CU | ~0.000005 SOL | TaskClaim PDA (~0.002 SOL rent) | ~0.002 SOL |
| `completeTask` | ~60,000 CU | ~0.000005 SOL | Closes Escrow + TaskClaim (rent reclaimed) | ~0.000005 SOL net |

**Net cost:** Well under 0.01 SOL in fees across all three transactions.
The reward circulates: creator escrow → worker wallet on completion.
Protocol fee: 250 bps (2.5%) of reward goes to treasury.

### Minimum Balance Requirements

- **Creator wallet:** reward amount + 0.02 SOL
- **Worker wallet:** 0.005 SOL

### Recovery Paths if Script Fails

**Fails before Step 1 (`createTask`):** Nothing on-chain. No recovery needed.

**Fails after Step 1, before Step 2 (task created, not claimed):**
Task is `Open` with reward locked in escrow. Fully recoverable:
```bash
# Cancel the task and reclaim escrow — taskPda is printed at Step 1
node -e "cancelTask(connection, creatorProgram, creatorKeypair, taskPda)"
```
The `taskPda` is printed to console at Step 1 — save it if running manually.

**Fails after Step 2, before Step 3 (task claimed, not completed):**
Task is `InProgress`. Two recovery options:
1. Creator cancels with the claim account passed as a remaining account
2. Wait for deadline expiry, then call `expireClaim`, then `cancelTask`

**In all failure cases the reward SOL is recoverable — it is never burned.**

### Verify Before Running

```bash
# Check creator balance (needs reward + 0.02 SOL)
solana balance ~/.config/solana/id.json --url devnet

# Check worker balance (needs 0.005 SOL)
solana balance ~/.config/solana/worker.json --url devnet

# Confirm both agents are registered
solana account GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs --url devnet
solana account CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V --url devnet
```

---

## What Each Step Does On-Chain

### Step 0 — Fetch agent registration

Calls `getAgent(program, agentPda)` to read your agent's on-chain account and
recover the original 32-byte agent ID that was used to derive the PDA. This ID
is required as a signer reference in all task instructions.

No transaction — read-only.

### Step 1 — `createTask`

Submits a `createTask` instruction to the AgenC program.

**What happens on-chain:**
- A new `Task` account is created at a PDA derived from `[task_id_bytes, creator_pubkey]`
- An `Escrow` account is created and funded with the reward amount
- The task is marked `Open` with `currentWorkers = 0`
- Your wallet is debited: reward amount + escrow rent + protocol fee (basis points)

**Key parameters used:**
- `taskType: 0` — Exclusive (one worker, first-claim-wins)
- `maxWorkers: 1`
- `constraintHash: null` — public task, no ZK constraint
- `rewardMint: null` — SOL reward (not SPL token)
- `requiredCapabilities` — matched to your agent's registered capabilities

### Step 2 — `claimTask`

Submits a `claimTask` instruction.

**What happens on-chain:**
- A `TaskClaim` account is created linking the task PDA to your agent PDA
- Task state changes from `Open` → `InProgress`
- `currentWorkers` increments to 1

Since this uses the same wallet as the creator, you are both parties. The
program permits self-claim on public tasks.

### Step 3 — `completeTask`

Submits a `completeTask` instruction with a `proofHash`.

**What happens on-chain:**
- Task state changes from `InProgress` → `Completed`
- The `Escrow` account is closed
- Reward SOL is transferred to your wallet (minus protocol fee to treasury)
- The `TaskClaim` account is closed
- `completedAt` timestamp is recorded on the task account

The `proofHash` is a 32-byte value that serves as a public work receipt. For
public tasks it is not verified on-chain — any 32 bytes are accepted. For
private tasks a ZK proof via `completeTaskPrivate` would be required instead.

---

## Verifying on Solscan

Each transaction signature can be viewed at:

```
https://solscan.io/tx/[TX_SIGNATURE]?cluster=devnet
```

The script prints direct Solscan links for each step.

**What to look for:**

| Step | Solscan tab | What to check |
|---|---|---|
| create | Account Changes | New Task + Escrow accounts created; wallet debited |
| claim | Account Changes | New TaskClaim account created; Task state updated |
| complete | Account Changes | Escrow closed; reward transferred back to wallet; TaskClaim closed |

---

## Expected Output

```
=== AgenC Task Lifecycle — devnet ===

[config] creator wallet:  BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT
[config] creator agent:   GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs
[config] worker wallet:   26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q
[config] worker agent:    CmehT9UrmeCEFNKuXKVHuoQuAjZAa6J6sgC1W8gRr58V
[config] reward:          0.01 SOL
[config] creator balance: 33.39515976 SOL
[config] worker balance:  4.89516476 SOL

[step 0] fetching agent registrations...
[step 0] creator agent — capabilities: 15 | reputation: 5000
[step 0] worker agent  — capabilities: 1  | reputation: 5000

[step 1] creating task...
[step 1] ✅ task created
         taskPda:  6beatSc8WKFpKWyMJgDK3z3CbjdRoPdgJ86kh1iBzUM3
         deadline: 2026-03-24T14:56:02.000Z
         tx:       4q2d3zLNFxh1MuP5ina8tEeVSoKutS2wGuwLtVMrZrtdjbJpg6Czkz3J55zjUvraPP7YT4EutNB1Cm254mWGk1fg
         solscan:  https://solscan.io/tx/4q2d3zLNFxh1MuP5ina8tEeVSoKutS2wGuwLtVMrZrtdjbJpg6Czkz3J55zjUvraPP7YT4EutNB1Cm254mWGk1fg?cluster=devnet

[step 2] claiming task...
[step 2] ✅ task claimed
         tx:       3RwRUqCZexGJfuu5wWn9zPLyYDrmuGfSPC5raDMZoSN7KX2wQzXnsaXqenu1d34qDziBWHr9Pswnou47LrXbjrJR
         solscan:  https://solscan.io/tx/3RwRUqCZexGJfuu5wWn9zPLyYDrmuGfSPC5raDMZoSN7KX2wQzXnsaXqenu1d34qDziBWHr9Pswnou47LrXbjrJR?cluster=devnet
[step 2] state:    In Progress (expected: In Progress)

[step 3] completing task...
[step 3] ✅ task completed
         tx:       3FCrfT8c2RwyiYHrh4dwyrAjykyucbXUkuFSbz4TEQLxYMmYjw9kS6KfQFjB1YJCaMQ9B8vWXRXjqM31P2jgFzT7
         solscan:  https://solscan.io/tx/3FCrfT8c2RwyiYHrh4dwyrAjykyucbXUkuFSbz4TEQLxYMmYjw9kS6KfQFjB1YJCaMQ9B8vWXRXjqM31P2jgFzT7?cluster=devnet

[verify] fetching final task state...
[verify] state:       Completed
[verify] completedAt: 2026-03-24T13:56:08.000Z

=== lifecycle complete ===
  create:   https://solscan.io/tx/4q2d3zLNFxh1MuP5ina8tEeVSoKutS2wGuwLtVMrZrtdjbJpg6Czkz3J55zjUvraPP7YT4EutNB1Cm254mWGk1fg?cluster=devnet
  claim:    https://solscan.io/tx/3RwRUqCZexGJfuu5wWn9zPLyYDrmuGfSPC5raDMZoSN7KX2wQzXnsaXqenu1d34qDziBWHr9Pswnou47LrXbjrJR?cluster=devnet
  complete: https://solscan.io/tx/3FCrfT8c2RwyiYHrh4dwyrAjykyucbXUkuFSbz4TEQLxYMmYjw9kS6KfQFjB1YJCaMQ9B8vWXRXjqM31P2jgFzT7?cluster=devnet
```

---

## Troubleshooting

### `insufficient balance`
Airdrop more devnet SOL: `solana airdrop 1 BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT --url devnet`

### `agent not found`
The agent PDA printed in the error is not registered on devnet. Re-run the
agent registration script (`scripts/register-agent.mjs` or `register-worker.mjs`).

### `Transaction simulation failed`
- Check the error message for the specific program error
- Common causes: deadline already passed, task type mismatch, capability mismatch
- See `forks/agenc-sdk/docs/devnet-compatibility.md` for known devnet drift

### `Account does not exist` on verify
This is expected — the task account may be closed after completion when the
escrow is reclaimed. The lifecycle still succeeded.

---

## Devnet Compatibility Notes

The AgenC devnet program may return different error names than the SDK
expects for edge cases. The happy path (public task, single worker, SOL
reward) is confirmed working. See
`forks/agenc-sdk/docs/devnet-compatibility.md` for the full drift table.

---

## Next Steps

After running the lifecycle successfully:
- Update this doc with real transaction signatures from your run
- Try with a non-zero `minReputation` to test reputation gating
- Try with a different `requiredCapabilities` bitmask
- Try claiming an existing open task from another creator using
  `scripts/devnet-claim-task.mjs`
