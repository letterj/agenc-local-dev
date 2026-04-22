# Local Fixes Reference

**Date:** 2026-04-12
**Branch:** `experiment/local-tool-fixes` (agenc-core), `experiment/local-program-id-patch` (agenc-sdk)
**Baseline:** agenc-core `f394319`, agenc-sdk main

These fixes are applied locally and are not upstream. Reapply after any
rebase or branch reset. See the Reapplication Checklist at the bottom.

---

## Fix 1 — agenc-sdk: PROGRAM_ID override for private devnet program

**File:** `forks/agenc-sdk/src/constants.ts`
**Branch:** `experiment/local-program-id-patch`

> ⚠️ This fix is NOT needed when deploying against the V1 or V2 public programs.
> Only required for the private program `9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc`.
>
> Program ID reference:
> - V1 public: `6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab`
> - V2 public: `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (superseded 2026-04-22)
> - V3 public: `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7` (current)
> - Private:   `9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc`

**Why:** The SDK ships with the V1 public program ID (`6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab`). Our local devnet uses
a private program with registered agents and tasks. Without this patch,
daemon tools (`agenc.getProtocolConfig`, `agenc.getAgent`, `agenc.createTask`)
route to the wrong program and return empty/wrong results.

**Validation:** After patching, `agenc.getProtocolConfig` returned live data
(totalAgents: 7, totalTasks: 19). Without patch, returns empty or wrong account.

**Before:**
```typescript
export const PROGRAM_ID = new PublicKey(
  "6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab",
);
```

**After:**
```typescript
export const PROGRAM_ID = new PublicKey(
  "9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc",
);
```

---

## Fix 2 — agenc-core: Tilde expansion in wallet-loader.ts

**File:** `forks/agenc-core/runtime/src/gateway/wallet-loader.ts`
**Branch:** `experiment/local-tool-fixes`

**Why:** Node.js `fs.readFile` does not expand `~` in paths. A `keypairPath`
of `"~/.config/solana/creator.json"` in config.json causes the daemon to
fail with "Cannot sign with read-only program" because the keypair can't be
loaded. Upstream has not addressed this.

**Before:**
```typescript
import type { GatewayConfig } from "./types.js";
// ...
    const kpPath = config.connection?.keypairPath ?? getDefaultKeypairPath();
```

**After:**
```typescript
import { homedir } from "node:os";
import type { GatewayConfig } from "./types.js";
// ...
    const rawPath = config.connection?.keypairPath ?? getDefaultKeypairPath();
    const kpPath = rawPath.startsWith("~")
      ? rawPath.replace(/^~/, homedir())
      : rawPath;
```

**Workaround if not reapplied:** Use absolute paths in config.json
(`/root/.config/solana/creator.json` for Docker, `/Users/letterj/...` for host).

---

## Fix 3 — agenc-core: taskDescription rename in createTask tool

**File:** `forks/agenc-core/runtime/src/tools/agenc/tools.ts`
**Branch:** `experiment/local-tool-fixes`

**Why:** The LLM was passing `description` as a tool argument key, which
conflicts with the JSON Schema `description` metadata field at the property
level. The LLM interprets the outer `description` (schema metadata) as the
input field name and ignores the inner one, causing task creation to fail
with "Missing or empty content" or silently pass wrong data.

Upstream still uses `description`. The rename adds a `?? args.description`
fallback for backward compatibility with any cached LLM context.

**4 locations changed:**

```diff
// inputSchema properties key:
-        description: {
+        taskDescription: {
           type: 'string',
           description: `Short on-chain task title/summary (max ${DESCRIPTION_BYTES} UTF-8 bytes)...`,

// required array:
-      required: ['description', 'reward', 'requiredCapabilities'],
+      required: ['taskDescription', 'reward', 'requiredCapabilities'],

// dedup key builder:
-        const dedupKey = `...|${String(args.description ?? '').trim().toLowerCase()}`;
+        const dedupKey = `...|${String(args.taskDescription ?? args.description ?? '').trim().toLowerCase()}`;

// parseTaskDescription call:
-        const [descBytes, descErr] = parseTaskDescription(args.description);
+        const [descBytes, descErr] = parseTaskDescription(args.taskDescription ?? args.description);
```

---

## Fix 4 — agenc-core: Active-status filter in resolveAuthorityAgentPda

**File:** `forks/agenc-core/runtime/src/tools/agenc/mutation-tools.ts`
**Branch:** `experiment/local-tool-fixes`

**Why:** When a wallet has more than one agent registration (e.g., after
re-registering without deregistering first), the daemon immediately returns
`MULTIPLE_AGENT_REGISTRATIONS` instead of auto-selecting the active one.
This fix fetches each candidate account, filters to `AgentStatus.Active`,
and auto-resolves if exactly one active agent remains.

**Before:**
```typescript
import { parseAgentState } from '../../agent/types.js';
// ...
  if (matches.length > 1) {
    return [null, ambiguousSignerAgentsResult(authority, signerAgentChoicesFromMatches(authority, matches), field)];
  }
```

**After:**
```typescript
import { parseAgentState, AgentStatus } from '../../agent/types.js';
// ...
  if (matches.length > 1) {
    const fetchedAccounts = await (program.account as any).agentRegistration.fetchMultiple(
      matches.map((m) => m.pubkey)
    );
    const activeMatches = matches.filter((_, i) => {
      const raw = fetchedAccounts[i];
      if (!raw) return false;
      try {
        return parseAgentState(raw).status === AgentStatus.Active;
      } catch {
        return false;
      }
    });
    if (activeMatches.length === 1) {
      return [activeMatches[0]!.pubkey, null];
    }
    const candidates = activeMatches.length > 0 ? activeMatches : matches;
    return [null, ambiguousSignerAgentsResult(authority, signerAgentChoicesFromMatches(authority, candidates), field)];
  }
```

---

## Reapplication Checklist

After any rebase to a new upstream baseline, reapply in this order:

| # | File | One-line description |
|---|------|----------------------|
| 1 | `forks/agenc-sdk/src/constants.ts` | Change PROGRAM_ID to private program (skip for V1/V2 public) |
| 2 | `forks/agenc-core/runtime/src/gateway/wallet-loader.ts` | Add homedir import + tilde expansion before loadKeypairFromFile |
| 3 | `forks/agenc-core/runtime/src/tools/agenc/tools.ts` | Rename `description` → `taskDescription` in createTask (4 locations) |
| 4 | `forks/agenc-core/runtime/src/tools/agenc/mutation-tools.ts` | Add AgentStatus import + fetchMultiple active-status filter |

After reapplying 2–4: rebuild runtime (`npm run build --workspace=@tetsuo-ai/runtime`),
clear daemon PIDs, restart containers.

---

## 0.2.0 Upgrade Notes

The `release/public-packages-2026-04-12` branch is a pure version bump on
top of `f394319` (already on our main). The runtime is `@tetsuo-ai/runtime@0.2.0`,
CLI is `@tetsuo-ai/agenc@0.2.0`.

**Breaking change for docker-compose.yml:** The 0.2.0 runtime installs to
`/root/.agenc/runtime/releases/0.2.0/linux-x64/`. The current bind mount
hardcodes `releases/0.1.0/...` — update the path in docker-compose.yml
before rebuilding with `--no-cache`.

**Fix 2 and Fix 3 are still required after the 0.2.0 rebuild.** Neither
was addressed upstream in the 0.2.0 release.

---

## 0.2.0 Upgrade — Container Bind Mount Change (2026-04-12)

**Why the bind mount level changed:**

The 0.2.0 runtime installer (`agenc start`) checks whether the runtime package
is already present by looking for `node_modules/@tetsuo-ai/runtime/` with a
valid `package.json`. On a fresh named volume it performs a full `npm install`,
which includes removing and recreating the `dist/` directory. When only `dist/`
was bind-mounted (the previous approach), the installer hit `EBUSY: resource
busy or locked, rmdir .../dist` and exited 1 — preventing the daemon from
starting.

**Fix:** Mount the entire fork runtime package instead of just `dist/`:

```
# Old (0.1.0 pattern — dist only):
${HOME}/.../forks/agenc-core/runtime/dist:/root/.agenc/runtime/releases/0.1.0/linux-x64/node_modules/@tetsuo-ai/runtime/dist:ro

# New (0.2.0 pattern — full package):
${HOME}/.../forks/agenc-core/runtime:/root/.agenc/runtime/releases/0.2.0/linux-x64/node_modules/@tetsuo-ai/runtime:ro
```

The installer finds the directory (with `package.json`) already present and
skips the npm install entirely. Our local `dist/` is included as part of the
mounted package.

**Named volumes must be cleared before any version bump rebuild:**

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose down -v          # removes agenc-creator-data and agenc-worker-data
docker compose build --no-cache
docker compose up -d
```

Skipping `down -v` leaves old-version runtime data in the volumes. On the next
start the installer may attempt a reinstall and hit the EBUSY error again.

**When upgrading versions in the future:**

Update `<VERSION>` in both places in `docker-compose.yml`:

```yaml
- ${HOME}/workshop/agencproj/forks/agenc-core/runtime:/root/.agenc/runtime/releases/<VERSION>/linux-x64/node_modules/@tetsuo-ai/runtime:ro
```

Also update `AGENC_RUNTIME_PROGRAM_ID` if the program ID changes between versions.

---

## Wallet Inventory (confirmed 2026-04-12)

Wallet addresses verified via bs58 decode on 2026-04-12.

> ⚠️ **worker2.json correction:** The wallet address previously recorded for
> `worker2.json` (`26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q`) was wrong —
> it belongs to `worker.json`, not `worker2.json`. The correct worker2 address
> is `SFG7VnuZDg9x1Y5Kz81moJkUTLwDF1xgTZFPD3V3mT1`, confirmed on 2026-04-12.

### V2 public program: `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (superseded 2026-04-22)

| Role | Keypair file | Wallet | Agent PDA | Notes |
|---|---|---|---|---|
| Creator | `~/.config/solana/creator.json` | `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` | `HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` | Superseded 2026-04-15 by V3 |
| Worker2 | `~/.config/solana/worker2.json` | `SFG7VnuZDg9x1Y5Kz81moJkUTLwDF1xgTZFPD3V3mT1` | `BrnCh3DZtMR5jsak5t3it4i7si9DvWnk6tBzMteXvHGx` | Superseded 2026-04-15 by V3 |

### V3 public program: `2jdBSJ8U5ixfwgs1bRLPtRRnpZAPm8Xv1tEdu8yjHJC7`

| Role | Keypair file | Wallet | Agent PDA | Notes |
|---|---|---|---|---|
| Creator | `~/.config/solana/creator.json` | `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` | `HYZyLSXTpC2g9XNAweud7XeCNAH8PfzMNAX2JKEKzbQY` | Registered 2026-04-15, tx `4HQKftu...wXs` |
| Worker2 | `~/.config/solana/worker2.json` | `SFG7VnuZDg9x1Y5Kz81moJkUTLwDF1xgTZFPD3V3mT1` | `2TPP4NJ7aYJUmr51T1qf7A5rEpggGCLNwGEdy7srjFCb` | Registered 2026-04-15, tx `45yT9u2...iBsw` |

Worker2 registration transaction (full):
`4gHSJvv891HsxVVDeCQfSWecEXMGrS3DbU2BWpPRBGF5hQBxTcMXQ7nDCZUnDZ7YWCcxpApbm4apz182pEJT3cfr`

### Private program only: `9dMNFLWENJSQWriPt7p5XpSqakxsdmKB4Q7gJvbbznmc`

| Role | Keypair file | Wallet | Agent PDA | Notes |
|---|---|---|---|---|
| Worker (original) | `~/.config/solana/worker.json` | `26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q` | `4Rz7m7FfrHqMNTsDms3r2tRTKEwrx9M8FVGgATwykiqy` | **DO NOT USE for V2** — slash window blocker until 2026-04-17T20:31:42 UTC |

The agenc-worker container bind-mounts `worker2.json` as `/root/.config/solana/id.json`.
Use `worker.json` only if testing against the private program after 2026-04-17.

---

## Known Open Issues (as of 2026-04-12)

### 1. Marketplace UI `[yours:0]` bug

The Tasks UI owner-scoped filter ("yours") returns zero results even when the
connected wallet has created tasks on-chain.

**Root cause:** The UI's task query uses the V1 `PROGRAM_ID` constant when
filtering by owner — the same root cause as Fix 1. Owner-scoped tasks are
fetched against the wrong program and return empty.

**Status:** Not addressed in 0.2.0. Confirmed pre-existing.

**Workaround:** Use the CLI to list tasks:
```bash
docker exec agenc-creator node .../agenc.js market tasks list --config /root/.agenc/config.json
```

---

### 2. `requiredCapabilities` schema ambiguity — ✅ RESOLVED UPSTREAM

Resolved in upstream/main (commit `aad3590`, tools.ts line 2214):
```
description: 'Required capability bitmask as integer string (u64, must be > 0).'
```
This fix is no longer needed — do not reapply after rebase.

---

### 3. Grok tool count (114 tools) — intermittent silent drop

Observed once during an agent register attempt via chat UI: the tool was not
invoked despite being listed in the tool count. Did not recur during lifecycle
testing.

**Root cause:** Unknown — may be transient context-window pressure or a
tool-routing edge case at high tool counts.

**Status:** Not reproducible. Monitoring.

**Workaround:** Use the CLI for agent registration (`agenc agent register`).
