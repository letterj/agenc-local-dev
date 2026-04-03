# AgenC Local Dev Environment Runbook

## Authors
- J Brett (letterj) — contributor, tester, domain context
- Claude Sonnet 4.6 — drafting, code generation, research assistance

> **Status:** Active  
> **Last updated:** 2026-03-23
> **Author:** letterj  
> **Purpose:** Reproducible setup for a contributor-ready local AgenC development environment

---

## Context

AgenC completed a whole-repository refactor program on 2026-03-17 (Gates 0–12).
On 2026-03-18 the team adopted ADR-003, making `agenc-core` and `agenc-prover`
public and reframing AgenC as a public framework product.

On 2026-03-20 the first working operator instance was confirmed running in Docker.
On 2026-03-21 the `gateway.bind` root cause was identified. Subsequent investigation
revealed that `auth.secret` + `localBypass: true` cannot authenticate browser
connections through Docker port mapping on macOS (Docker bridge IP is not loopback).
Final working state: socat bridge restored, no `auth.secret` required.

### Architecture Decision Records

| ADR | Status | Summary |
|---|---|---|
| ADR-002 | **Superseded** | Public contracts + private kernel boundary |
| ADR-003 | **Current** | AgenC is a public framework product |

### Repository Topology (as of 2026-03-21)

| Repo | Visibility | Role |
|---|---|---|
| `AgenC` | Public | Umbrella — docs, examples, bootstrap scripts |
| `agenc-sdk` | Public | TypeScript SDK (`@tetsuo-ai/sdk`) |
| `agenc-protocol` | Public | Program source, IDL, generated artifacts (`@tetsuo-ai/protocol`) |
| `agenc-plugin-kit` | Public | Plugin/channel adapter ABI (`@tetsuo-ai/plugin-kit`) |
| `agenc-core` | Public | Runtime engine, daemon, MCP, web, mobile, desktop |
| `agenc-prover` | Public | ZK prover service, admin tools |

### Published Package Versions (2026-03-21)

| Package | Version |
|---|---|
| `@tetsuo-ai/sdk` | 1.3.1 |
| `@tetsuo-ai/protocol` | 0.1.1 |
| `@tetsuo-ai/plugin-kit` | 0.1.1 |
| `@tetsuo-ai/agenc` | 0.1.0 |

The `agenc-morning-sync` skill checks `@tetsuo-ai/agenc` against this baseline on
every session start (Step 3b). When a new version is detected, a rebuild is needed
to pick up upstream changes — the Dockerfile installs the package unpinned, so
`docker compose build --no-cache` pulls whatever `dist-tags.latest` resolves to.

---

## Prerequisites

```
node      v20.20.1
npm       10.8.2
rustc     1.94.0
solana    3.0.13
anchor    0.32.1
docker    28.5.2
ollama    0.17.7 (optional)
```

---

## Devnet Setup

**Wallet:** `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT`
**Balance:** ~33 SOL
**Program ID (devnet, current):** `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (Task Validation V2, deployed 2026-03-27)
**Program ID (devnet, superseded):** `6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab`

> ⚠️ Mainnet program ID (`5j9ZbT3...`) is different. Never use mainnet for experiments.

### Active Devnet Agents (V2 Program)

Registered 2026-03-28 against the current program. Use these PDAs in lifecycle scripts.

| Role | Wallet | Agent PDA |
|---|---|---|
| Creator | `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` | `HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` |
| Worker  | `26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q` | `DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv` |

Program: `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (Task Validation V2, deployed 2026-03-27)

> If the devnet program is redeployed, run `scripts/devnet-register-agents.mjs` to get fresh PDAs
> and update `scripts/devnet-task-lifecycle-test.mjs`. See `docs/HOW-TO/HOW-TO-FULL-TASK-LIFECYCLE.md`.

**Creator agent confirmed live — 2026-04-02**

Queried via `getAgent(program, agentPda)` with V2 IDL (`GN69C…`). Account fields:

| Field | Value |
|---|---|
| authority | `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` |
| capabilities | 1 |
| status | 1 (active) |
| endpoint | `https://example.invalid/creator` |
| stakeAmount | 1,000,000 lamports (0.001 SOL) |
| activeTasks | 0 |
| reputation | 5000 |
| registeredAt | 1774734327 (2026-03-28) |

Preconditions verified: creator container running (HTTP 200 on port 3100), creator wallet balance 33.36 SOL, devnet RPC reachable. No fresh registration needed — existing account remains valid.

### Dual-Agent Task Lifecycle Run — 2026-04-02

Full create → claim → complete lifecycle run against V2 program using both containers.

**Preconditions:**
- Creator container: HTTP 200, port 3100 ✅
- Worker container: HTTP 200, port 3101 ✅ (started via `docker compose up -d agenc-worker`)
- Creator wallet: 33.36 SOL ✅
- Worker wallet: 14.91 SOL ✅
- Both agent PDAs confirmed active on V2 program

**Fix applied:** `scripts/devnet-task-lifecycle.mjs` had stale PDAs hardcoded (`GvXS49…` creator, `CmehT9…` worker — both V1-era). Updated to the V2 PDAs before running.

**Results:**

**Task PDA:** `2FVqsjXojtpsJ1tYpD22dkhyAV76XjKCpSfNxgFVRVBm`
Reward: 0.01 SOL | completedAt: 2026-04-02T23:03:23Z

| Step | Action | Status | Tx (devnet) |
|---|---|---|---|
| 0 | Fetch agent registrations | ✅ | — |
| 1 | Create task | ✅ | [2REHbJQ…](https://solscan.io/tx/2REHbJQFEqh4N95fv98bJjq9cgSaCbWJjUBciYyGiuq1eB6TickZPYp1pU98cqc6zjjCvsNCMACufJU8KFhtJdez?cluster=devnet) |
| 2 | Claim task | ✅ | [z9Zr2Aj…](https://solscan.io/tx/z9Zr2Aj9mXq2AsQUq3kBUh7RaLcaaiMCr8j6WxnxF9oiHxBAkP72rAyrTzh4e8t9EfZds2BR6kFedrQGzKNko3S?cluster=devnet) |
| 3 | Complete task | ✅ | [4PDbvrc…](https://solscan.io/tx/4PDbvrcPnCwALqtgi4quC2vR9b3EhdK4KXLHryNeXFQ9yGbq93hEPBRRSDCxLTZppWPJoBguphx3aZbXSyDgWNL?cluster=devnet) |
| — | Final state | ✅ Completed | 2026-04-02T23:03:23Z |

### Protocol Config PDA (2026-04-02)

- **Program:** `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (V2, deployed 2026-03-27)
- **Protocol config PDA (correct):** `GEXnAns2Wq27xjG84a7BnuxJBY3R5Qu9CdFy2HQ7vsiv` (initialized, devnet)
- **Wrong PDA reported by client:** `9bE5CbHLW8ZAeAkxUTSeUdSwEjbivtr5skWxzjLYfCWi`
- **Error seen:** `Failed to fetch protocol config: Account does not exist`

**Root cause — investigated 2026-04-02:**

The protocol config PDA is derived with seed `"protocol"` (single word, exact). Verified:

```
findProgramAddressSync([Buffer.from("protocol")], V1_6UcJzb...) → 5AhrM23...  (wrong)
findProgramAddressSync([Buffer.from("protocol")], V2_GN69C...) → GEXnAns2...  ✓ correct
```

The SDK constant `PROGRAM_ID` in `agenc-sdk/src/constants.ts` is hardcoded to the V1 program
(`6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab`). `deriveProtocolPda()` has a default
parameter of `PROGRAM_ID`, so **any call to `deriveProtocolPda()` without an explicit
`programId` argument will derive the wrong PDA** against the V1 program.

The IDL at `forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json` is correct —
it carries `"address": "GN69C..."`. Anchor's `Program` constructor reads this field, so
`program.programId` is correct when the Program object is built from the IDL.

**Status of local devnet scripts:** Safe. `devnet-task-lifecycle.mjs` and
`devnet-task-lifecycle-test.mjs` build the Program object via `createProgram(connection, idl,
keypair)` (which reads program ID from the IDL), and all `deriveProtocolPda` calls in the SDK
pass `program.programId` explicitly. Scripts fail fast with a clear error if `AGENC_IDL_PATH`
is unset.

**Stale V1 references that still exist upstream (not blocking local scripts):**
- `agenc-sdk/src/constants.ts` — `PROGRAM_ID` default (upstream issue, not yet updated)
- `agenc-core/mcp/src/server.ts` line 355 — comment cites V1 program for PDA derivation
- `agenc-core/scripts/agenc-devnet-soak*.{mjs,sh}` — hardcoded V1 defaults
- `agenc-core/tools/localnet-social/bootstrap-cli.ts`, `scripts/generate-real-proof-cli.ts`

**The exact derivation path that produced `9bE5CbH...` is unconfirmed** — no code in this
workspace produces that PDA with any tested seed/program combination. It was reported by the
dev team as a client-side derivation error; the likeliest cause is a call to
`deriveProtocolPda()` without a `programId` argument in a code path not present in this repo.

### Known Devnet Drift (as of 2026-03-18)

The happy path works. Edge case error names differ from SDK expectations:

| Scenario | SDK expects | Devnet returns |
|---|---|---|
| Below minimum stake | `InsufficientStake` | `InsufficientFunds` |
| Past deadline task | `InvalidInput` | `UpdateTooFrequent` |
| Self-claim own task | `SelfTaskNotAllowed` | `ProposalUnauthorizedCancel` |
| Complete without claim | `NotClaimed` | `AccountNotInitialized` |

---

## Workspace Layout

```
~/workshop/agencproj/
├── AgenC/               ← tetsuo-ai reference (read only)
├── agenc-sdk/           ← tetsuo-ai reference (read only)
├── agenc-protocol/      ← tetsuo-ai reference (read only)
├── agenc-plugin-kit/    ← tetsuo-ai reference (read only)
├── agenc-core/          ← tetsuo-ai reference (read only)
├── agenc-prover/        ← tetsuo-ai reference (read only)
├── agenc-local-dev/     ← this repo
├── CLAUDE.md            ← workspace quick reference
└── forks/
    ├── AgenC/           ← letterj fork (work here)
    ├── agenc-sdk/       ← letterj fork (work here)
    ├── agenc-protocol/  ← letterj fork (work here)
    ├── agenc-plugin-kit/ ← letterj fork (work here)
    └── agenc-core/      ← letterj fork (work here)
```

---

## Fork Setup

### Step 1 — Clone reference repos

```bash
mkdir -p ~/workshop/agencproj
cd ~/workshop/agencproj
git clone https://github.com/tetsuo-ai/AgenC.git
./AgenC/scripts/bootstrap-agenc-repos.sh --root ~/workshop/agencproj
git clone https://github.com/tetsuo-ai/agenc-core.git
git clone https://github.com/tetsuo-ai/agenc-prover.git
```

### Step 2 — Fork all five repos on GitHub

- https://github.com/tetsuo-ai/AgenC/fork
- https://github.com/tetsuo-ai/agenc-sdk/fork
- https://github.com/tetsuo-ai/agenc-protocol/fork
- https://github.com/tetsuo-ai/agenc-plugin-kit/fork
- https://github.com/tetsuo-ai/agenc-core/fork

### Step 3 — Clone forks using SSH

```bash
for repo in AgenC agenc-sdk agenc-protocol agenc-plugin-kit agenc-core; do
  git clone git@github.com:letterj/$repo.git ~/workshop/agencproj/forks/$repo
  git -C ~/workshop/agencproj/forks/$repo remote add upstream \
    https://github.com/tetsuo-ai/$repo.git
done
```

### Step 4 — Fix agenc-protocol default branch

The fork defaults to `feature/bootstrap-wave1`. Fix in GitHub:
Settings → Default branch → switch to `main`.

### Step 5 — Create working branches

```bash
for repo in AgenC agenc-sdk agenc-protocol agenc-plugin-kit agenc-core; do
  cd ~/workshop/agencproj/forks/$repo
  git checkout main
  git checkout -b experiment/local-dev-setup
done
```

---

## Daily Sync

The `agenc-morning-sync` Claude skill (`skills/agenc-morning-sync/SKILL.md`) automates
this entire section. Invoke it at session start with any phrase like "morning sync",
"let's get started", or "sync the repos". Manual steps below for reference.

The skill also checks whether tetsuo-ai has published a new `@tetsuo-ai/agenc` npm
release (Step 3b). The Dockerfile installs this package unpinned — a `docker compose
build` without a new upstream release installs the same binary already in the image.
The check avoids unnecessary rebuilds and flags when one is actually warranted.

Run at the start of each session:

```bash
for repo in AgenC agenc-sdk agenc-protocol agenc-plugin-kit agenc-core; do
  echo "=== $repo ==="
  git -C ~/workshop/agencproj/$repo fetch origin --quiet
  git -C ~/workshop/agencproj/$repo log --oneline --since="yesterday" origin/main \
    2>/dev/null || echo "no new commits"
done
```

Sync forks:

```bash
for repo in AgenC agenc-sdk agenc-core; do
  git -C ~/workshop/agencproj/forks/$repo fetch upstream
  git -C ~/workshop/agencproj/forks/$repo checkout main
  git -C ~/workshop/agencproj/forks/$repo merge upstream/main
  git -C ~/workshop/agencproj/forks/$repo push origin main
done
```

---

## agenc-sdk Validation Gates

Before committing or opening a PR against `tetsuo-ai/agenc-sdk`:

```bash
cd ~/workshop/agencproj/forks/agenc-sdk
npm run typecheck
npm test
npm run build
npm run pack:smoke
npx -y node@20 scripts/pack-smoke.mjs
```

The last command specifically tests packaged CJS/ESM interop in Node 20.
Established by PR #10 (2026-03-19).

---

## Operator Instance (Docker)

The `agenc` CLI only supports **Linux x64**. On macOS, run it in Docker.

### Dockerfile

Current Dockerfile in `~/workshop/agencproj/agenc-local-dev/`:

```dockerfile
FROM --platform=linux/amd64 node:20-slim

RUN apt-get update -qq && \
    apt-get install -y vim curl python3 make g++ iproute2 socat -qq && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g @tetsuo-ai/agenc

# agenc-start.sh: onboard, inject config from env, rebuild sqlite, start daemon
RUN cat > /usr/local/bin/agenc-start.sh << 'SCRIPT'
#!/bin/bash
set -e
if [ ! -f /root/.agenc/config.json ]; then
  agenc onboard || true
fi
if [ -n "$GROK_API_KEY" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('/root/.agenc/config.json'));
    cfg.gateway = { port: cfg.gateway?.port ?? 3100 };
    delete cfg.auth;
    cfg.llm = { provider: 'grok', apiKey: process.env.GROK_API_KEY, model: 'grok-3' };
    cfg.memory = { backend: 'sqlite', dbPath: '/root/.agenc/memory.db' };
    cfg.agent = { name: process.env.AGENT_NAME || 'letterj-operator' };
    fs.writeFileSync('/root/.agenc/config.json', JSON.stringify(cfg, null, 2));
  "
fi
SQLITE_PATH=$(find /root/.agenc/runtime -name "better_sqlite3.node" 2>/dev/null | head -1)
if [ -n "$SQLITE_PATH" ]; then
  SQLITE_DIR=$(dirname $(dirname $SQLITE_PATH))
  cd $SQLITE_DIR && npm rebuild 2>/dev/null || true
fi
# Bridge external port 3101 → daemon loopback 3100 for Docker port mapping
# (daemon binds 127.0.0.1 so no auth.secret is required; socat exposes it externally)
socat TCP-LISTEN:3101,bind=0.0.0.0,fork,reuseaddr TCP:127.0.0.1:3100 &
agenc start
tail -f /root/.agenc/daemon.log
SCRIPT

RUN chmod +x /usr/local/bin/agenc-start.sh
EXPOSE 3100
CMD ["/usr/local/bin/agenc-start.sh"]
```

**Architecture note:** The daemon binds to `127.0.0.1:3100` (no `auth.secret`
required). socat bridges `0.0.0.0:3101 → 127.0.0.1:3100`. docker-compose maps
`host:3100 → container:3101`. This makes the browser UI fully functional
including the TRACE tab.

**Why not `gateway.bind: "0.0.0.0"`?** When the daemon binds to a non-loopback
address, the runtime requires `auth.secret`. But `auth.secret` breaks browser
UI via Docker port mapping on macOS — Docker delivers connections from the
bridge gateway IP (e.g. `192.168.97.1`), not `127.0.0.1`, so `localBypass: true`
never fires. The socat bridge avoids this entirely.

### Environment variables (.env)

```
GROK_API_KEY=your-grok-api-key-here
AGENT_NAME=letterj-operator
```

`GROK_API_KEY` is required. `AGENT_NAME` defaults to `letterj-operator`.
`AUTH_SECRET` is no longer used — the socat bridge architecture does not
require `auth.secret` (daemon binds to loopback only).

### Build the image

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose build
```

### Start the containers

```bash
docker compose up -d
```

Starts both `agenc-creator` (port 3100) and `agenc-worker` (port 3101).
Each container auto-starts its daemon. No manual steps needed.

> **Note (2026-04-02):** The legacy `agenc-operator` single-container setup is retired.
> The root `docker-compose.yml` now defines `agenc-creator` and `agenc-worker` as the
> canonical containers. All ops commands use `agenc-creator` or `agenc-worker` by name.

### Daily operations (from Mac)

```bash
docker compose up -d                      # start both containers
docker compose down                       # stop both containers
docker exec -it agenc-creator bash        # open shell (creator)
docker exec -it agenc-worker  bash        # open shell (worker)
docker exec agenc-creator agenc status    # check creator daemon
docker exec agenc-worker  agenc status    # check worker daemon
docker logs -f agenc-creator              # creator logs
docker logs -f agenc-worker               # worker logs
docker exec agenc-creator agenc stop      # stop creator daemon only
docker exec agenc-worker  agenc stop      # stop worker daemon only
```

### Access the UI

Open in browser: **http://localhost:3100/ui/**

---

## Dual Container Operations (Creator + Worker)

Two containers sharing the same image: `agenc-creator` (host port 3100) and
`agenc-worker` (host port 3101). Config and wallet are bind-mounted per container;
data persists in separate named volumes.

### Layout

```
agenc-local-dev/
├── Dockerfile                  ← shared image
└── docker/
    ├── docker-compose.yml
    ├── creator/config.json     ← gateway.port 3100, creator wallet, agent name "creator-operator"
    └── worker/config.json      ← gateway.port 3100, worker wallet, agent name "worker-operator"
```

Port chain per container (same socat pattern as the single-container setup):

```
host:3100 → container agenc-creator:3101 → socat → 127.0.0.1:3100 (daemon)
host:3101 → container agenc-worker:3101  → socat → 127.0.0.1:3100 (daemon)
```

### Start both

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose up -d
```

### Stop both

```bash
cd ~/workshop/agencproj/agenc-local-dev/docker
docker compose down
```

### Restart one service

```bash
docker compose -f ~/workshop/agencproj/agenc-local-dev/docker/docker-compose.yml \
  restart agenc-creator
```

### View logs per container

```bash
docker logs -f agenc-creator
docker logs -f agenc-worker
```

### Check daemon status per container

```bash
docker exec agenc-creator agenc status
docker exec agenc-worker  agenc status
```

### Open a shell in a specific container

```bash
docker exec -it agenc-creator bash
docker exec -it agenc-worker  bash
```

### Wipe data volumes (destructive)

```bash
cd ~/workshop/agencproj/agenc-local-dev/docker
docker compose down -v
```

This removes `docker_agenc-creator-data` and `docker_agenc-worker-data`.
Config files in `docker/creator/` and `docker/worker/` are unaffected.

### Conflict with the single-container setup

The original `docker-compose.yml` at the repo root uses port 3100. Stop it
before starting the dual setup:

```bash
cd ~/workshop/agencproj/agenc-local-dev && docker compose down
cd docker && docker compose up -d
```

For the full from-scratch walkthrough, see `docs/HOW-TO/HOW-TO-DUAL-DOCKER.md`.

---

## Web UI Development (Hot Reload)

To run the `agenc-core/web` dev server (Vite HMR) against the live container:

### Prerequisites — build runtime first

The web package imports `@tetsuo-ai/runtime/browser`. Build it before starting
the dev server (only needed once, or after runtime source changes):

```bash
cd ~/workshop/agencproj/forks/agenc-core

# Step 1 — contracts (runtime dependency)
npm run build --workspace=@tetsuo-ai/desktop-tool-contracts

# Step 2 — runtime (produces dist/browser.mjs)
npm run build --workspace=@tetsuo-ai/runtime
```

### Start the dev server

```bash
cd ~/workshop/agencproj/forks/agenc-core/web
npm run dev
```

Vite starts on port `5173`. Open with the `ws=` query param to point socket
traffic at the live container:

```
http://localhost:5173/?ws=ws://localhost:3100
```

**How it works:** `useWebSocket` checks `window.location.search` for a `ws`
query param before falling back to `window.location.host`. No proxy
configuration is needed — the WebSocket connects directly to the container.

### Stop the dev server

```bash
kill $(lsof -ti:5173)
```

---

## Known Issues

### 1. `gateway.bind` undocumented in public docs *(upstream)*

**Repo:** `agenc-core`
**Symptom:** `gateway.bind` is the correct config field to control the daemon
bind address, but it was not documented anywhere. Users naturally try
`gateway.host` which is silently ignored.
**Status:** Issue #26 closed, PR #27 merged (`c99049d`) — `RUNTIME_API.md` documents `gateway.bind`,
the `auth.secret` requirement, the `gateway.host` gotcha, and two Docker
scenarios (browser UI vs CLI-only) with explicit documentation of the Docker
bridge IP limitation for `localBypass: true`.

### 2. `better-sqlite3` native addon must be rebuilt in Docker

**Symptom:** `Module did not self-register: better_sqlite3.node` on first start.  
**Fix:** The `agenc-start.sh` script handles this automatically.  
If it fails manually:
```bash
docker exec agenc-creator bash -c "
  cd \$(find /root/.agenc/runtime -name better-sqlite3 -type d | head -1)
  npm rebuild
"
```

### 3. `agenc onboard` is non-interactive and does not prompt for LLM config

**Symptom:** Onboard generates a minimal config with no `llm` block.  
**Fix:** The `agenc-start.sh` script injects the full config from environment variables automatically.

### 4. `agenc` CLI only supports Linux x64

**Symptom:** `unsupported platform darwin-arm64` on macOS Apple Silicon.
**Workaround:** Run in Docker with `--platform linux/amd64` as described above.
**Status:** No macOS issue filed upstream yet.

### 5. Pack Smoke CI failure — PostCSS native binding *(upstream, 2026-04-02)*

**Checks affected:** `public-install-min-node`, `private-kernel-registry`
**Symptom:** Both checks fail when the PostCSS native binding is missing in the CI runner. The web build fails, cascading into the runtime dashboard asset build via `build-dashboard-assets.mjs`.
**Root cause:** npm optional dependencies bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) — pre-existing on upstream `main`, not PR-specific.
**Status:** Confirmed failing on `main` as of 2026-04-02. PRs that pass `pack-smoke` but fail only these two checks are not the cause.

---

## Confirmed Working (2026-03-21)

- ✅ Agent registered on devnet: `GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs`
- ✅ Daemon running in Docker: `agenc-creator` container (port 3100); `agenc-worker` (port 3101)
- ✅ Web UI accessible: `http://localhost:3100/ui/`
- ✅ Grok LLM connected: `grok-3`
- ✅ Agent queried live devnet tasks via on-chain tools
- ✅ 4 open tasks visible on devnet with real SOL rewards
- ✅ socat bridge: daemon on `127.0.0.1:3100`, socat on `0.0.0.0:3101`, host maps `3100→3101`
- ✅ `docker compose up -d` is fully automated — zero manual steps

---

## Security Incidents

### Exposed API Key — xAI key in git history (2026-04-02)

**What happened:** `docker/creator/config.json` and `docker/worker/config.json` were
committed in commit `c5455a0` before the gitignore was fully in place, exposing a real
xAI API key in git history. GitHub push protection caught it on the first push attempt
and blocked the push.

**Resolution:**

1. Key rotated immediately at console.x.ai
2. Local configs updated with new key (files remain gitignored — not re-committed)
3. `git filter-repo` used to expunge both files from all 45 commits in history
4. Force-pushed clean history to `origin/main`
5. GitHub secret scanning confirmed 0 open alerts post-push

**Prevention:**

- Always confirm `docker/creator/` and `docker/worker/` are in `.gitignore` before
  the first commit in any new repo
- Run a security scan (grep for key patterns against `git ls-files` output) before
  every push — now part of the pre-push workflow. Run two scan passes: (1) full tree
  scan via `git ls-files` to cover all tracked files, and (2) a targeted scan of only
  the files changed in the current commit — especially important when those files
  document a security incident and may reference key patterns
- Follow the `.env.example` pattern: commit example files with placeholder values,
  never commit files containing real keys

**Pre-commit hook:**

A git pre-commit hook automates both scan passes on every `git commit`. It is
installed by running:

```bash
bash scripts/setup-hooks.sh
```

The hook lives at `.git/hooks/pre-commit` — this directory is **not** tracked by
git, so every new clone must run the setup script once. `scripts/setup-hooks.sh`
is committed to the repo and installs the hook from source.

The hook runs three passes on every commit attempt:
1. Full tree scan (`git ls-files`) — all tracked files
2. Staged files scan (`git diff --cached`) — files in the current commit
3. Docker config.json guard — blocks any `docker/*/config.json` from being staged

**Upstream PR branch discipline:**

Upstream PRs must always be opened from a dedicated branch created off
`upstream/main` — never from `experiment/local-dev-setup`. That branch carries
all local dev work and will pollute the PR with unrelated commits.

Correct workflow for any upstream contribution:

```bash
cd ~/workshop/agencproj/forks/<REPO>
git fetch upstream
git checkout -b <descriptive-branch-name> upstream/main
git cherry-pick <commit-sha>   # the specific commit(s) to contribute
git push origin <descriptive-branch-name>
gh pr create --repo tetsuo-ai/<REPO> --base main --head "letterj:<descriptive-branch-name>" ...
```

**Review before submitting:**

Always show the full content of any Issue, PR, commit message, or push to
the user before executing. Wait for explicit approval before hitting
submit/create/push. Never auto-submit. This applies to:
- `git push` (show what will be pushed)
- `gh pr create` (show full title + body)
- `gh issue create` (show full title + body)
- Any destructive or irreversible git operation

---

## Contributions Made

| Repo | PR | Description | Status |
|---|---|---|---|
| `agenc-sdk` | Issue #8 | anchor.BN undefined — diagnosed | Closed |
| `agenc-sdk` | PR #9 | fix(build): namespace import + externalize anchor | Merged |
| `agenc-core` | Issue #26 | gateway.bind undocumented | Closed (PR #27) |
| `agenc-core` | PR #27 | docs(gateway): document gateway.bind config field | Merged (`c99049d`) |
| `agenc-core` | PR (closes #32) | fix(ui): scope CANCEL/CLAIM task buttons to wallet ownership | Open — `fix/task-ownership-ui` |

---

## Reference Links

| Resource | URL |
|---|---|
| AgenC umbrella | https://github.com/tetsuo-ai/AgenC |
| agenc-core | https://github.com/tetsuo-ai/agenc-core |
| agenc-sdk | https://github.com/tetsuo-ai/agenc-sdk |
| agenc-protocol | https://github.com/tetsuo-ai/agenc-protocol |
| agenc-plugin-kit | https://github.com/tetsuo-ai/agenc-plugin-kit |
| agenc-local-dev | https://github.com/letterj/agenc-local-dev |
| Devnet program (Solscan) | https://solscan.io/account/GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3?cluster=devnet |
| ADR-003 | `forks/agenc-core/docs/architecture/adr/adr-003-public-framework-product.md` |
