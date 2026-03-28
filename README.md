# agenc-local-dev

Personal dev tooling for working with the AgenC ecosystem on macOS Apple Silicon.

The `agenc` CLI only supports Linux x64. This repo provides a Docker-based
operator environment that runs the full AgenC stack on macOS without waiting
for native arm64 support.

---

## Contents

| File | Purpose |
|---|---|
| `Dockerfile` | Linux x64 image with agenc and build tools |
| `docker-compose.yml` | Container orchestration with volume persistence |
| `.env.example` | Environment variable template |
| `CLAUDE.md` | AI assistant context for this workspace |
| `docs/RUNBOOK.md` | Full setup and troubleshooting reference |
| `skills/agenc-morning-sync/` | Session-start skill: sync repos, check org for new repos, check PRs, start Docker |
| `skills/agenc-changelog-docs-update/` | Skill: update changelog and docs from git commits |
| `scripts/` | Devnet utility scripts — task lifecycle, agent management |

---

## Dual Docker — Creator + Worker

Two independent operator containers — one creator (port 3100) and one worker
(port 3101) — each with a separate Solana wallet, config, and data volume.

```
docker/
├── docker-compose.yml      ← dual-container orchestration
├── creator/
│   └── config.json         ← creator config (port 3100, id.json)
└── worker/
    └── config.json         ← worker config (port 3101, worker.json)
```

### Start both containers

```bash
cd docker
docker compose up -d
```

### UIs

| Agent | URL |
|---|---|
| Creator | http://localhost:3100/ui/ |
| Worker  | http://localhost:3101/ui/ |

### Stop

```bash
cd docker
docker compose down
```

See `docs/HOW-TO/HOW-TO-DUAL-DOCKER.md` for full setup, port architecture, and
troubleshooting.

---

## Skills

Claude skills that automate common workflows. Invoke from the Claude Code
session by saying "morning sync", "run the changelog skill", etc.

| Skill | Trigger | What it does |
|---|---|---|
| `agenc-morning-sync` | "morning sync", "let's get started" | Fetch upstream changes, sync forks, rebuild SDK dist if needed, check org for new repos, check PR status, start Docker |
| `agenc-changelog-docs-update` | "run the changelog skill" | Update CHANGELOG.md and docs from recent git commits |

---

## Scripts

Devnet utility scripts. Run from the `agenc-local-dev/` directory after
`npm install`.

> **⚠️ Before running any script, ensure the SDK dist is current:**
> ```bash
> cd ~/workshop/agencproj/forks/agenc-sdk && npm run build
> ```
> Scripts import from `forks/agenc-sdk/dist/` — a stale dist will fail
> with BN or import errors.

### `devnet-task-lifecycle.mjs`

Runs the full AgenC task lifecycle on devnet: create task → claim task →
complete task. Uses separate creator and worker wallets. Prints Solscan
links for all three transactions.

```bash
CREATOR_WALLET=~/.config/solana/id.json \
WORKER_WALLET=~/.config/solana/worker.json \
AGENC_IDL_PATH=~/workshop/agencproj/forks/agenc-protocol/artifacts/anchor/idl/agenc_coordination.json \
node scripts/devnet-task-lifecycle.mjs
```

Requires two funded wallets with registered agents on devnet.
See `docs/HOW-TO-TASK-LIFECYCLE.md` for the full walkthrough.

---

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Docker | >= 28.x | Must support `--platform linux/amd64` |
| Node.js | >= 18 | For SDK/protocol work on Mac |
| npm | >= 10 | |
| Solana CLI | 3.0.13 | For devnet operations |
| Anchor CLI | 0.32.1 | For program work |
| Git | any | |
| xAI API key | — | Grok-3 model access |

### Prerequisites — Devnet Wallets

| Role | Keypair file | Pubkey | Min balance |
|---|---|---|---|
| Creator | `~/.config/solana/id.json` | `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` | reward + 0.02 SOL |
| Worker | `~/.config/solana/worker.json` | `26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q` | 0.005 SOL |

Both wallets must have registered agents on devnet before running lifecycle
scripts. See `docs/HOW-TO-TASK-LIFECYCLE.md` for setup steps.

macOS Apple Silicon (M1/M2/M3) is the primary target.
Docker's Rosetta emulation handles the linux/amd64 translation.

---

## Quick Start

### 1. Clone this repo

```bash
git clone git@github.com:letterj/agenc-local-dev.git
cd agenc-local-dev
```

### 2. Create your `.env` file

```bash
cp .env.example .env
vim .env
```

`.env` contents:

```
GROK_API_KEY=your-grok-api-key-here
AGENT_NAME=your-agent-name
```

`GROK_API_KEY` is required. `AGENT_NAME` defaults to `letterj-operator`.

### 3. Build the Docker image

```bash
docker compose build
```

Takes ~60 seconds on first build.

### 4. Start the container

```bash
docker compose up -d
```

This starts the container in the background. It will:
- Run `agenc onboard` if no config exists
- Inject your API key and agent name from `.env`
- Start a socat bridge (`0.0.0.0:3101 → 127.0.0.1:3100`) for Docker port mapping
- Rebuild `better-sqlite3` for the current Node ABI
- Start the AgenC daemon

### 5. Open the UI

**http://localhost:3100/ui/**

---

## Daily Operations

### Start the container

```bash
docker compose up -d
```

### Stop the container

```bash
docker compose down
```

### Open a bash shell inside the running container

```bash
docker exec -it agenc-operator bash
```

### Check daemon status

```bash
docker exec agenc-operator agenc status
```

### View live logs

```bash
docker logs -f agenc-operator
```

### Stop the daemon (without stopping the container)

```bash
docker exec agenc-operator agenc stop
```

### Restart the daemon

```bash
docker exec agenc-operator agenc stop
docker exec agenc-operator agenc-start.sh
```

### Rebuild after Dockerfile changes

```bash
docker compose down
docker compose build
docker compose up -d
```

---

## Data Persistence

Config, memory, and logs are stored in the `agenc-local-dev_agenc-data`
Docker volume. It survives container restarts and rebuilds.

```bash
# Remove all data and start fresh (destructive)
docker compose down -v
```

---

## Troubleshooting

### UI not loading at localhost:3100

Check daemon status and that socat is bridging:

```bash
docker exec agenc-operator agenc status
docker exec agenc-operator ss -tlnp | grep -E '3100|3101'
```

Expected: daemon on `127.0.0.1:3100`, socat on `0.0.0.0:3101`. If the daemon
isn't running:

```bash
docker logs agenc-operator --tail 30
```

### Daemon fails with better-sqlite3 error

```bash
docker exec agenc-operator bash -c "
  cd \$(find /root/.agenc/runtime -name better-sqlite3 -type d | head -1)
  npm rebuild
"
docker exec agenc-operator agenc start
```

### Check API key is configured

```bash
docker exec agenc-operator bash -c \
  "grep apiKey /root/.agenc/config.json"
```

---

## Known Issues

### gateway.bind undocumented (upstream)

`gateway.bind` is the correct field to control the daemon bind address, but
it was not documented in any public-facing docs. `gateway.host` (the intuitive
alternative) is silently ignored by the runtime.

Filed: `tetsuo-ai/agenc-core` Issue #26, PR #27 — now documents both Docker
scenarios and the `localBypass: true` / Docker bridge IP limitation.

### agenc CLI unsupported on darwin-arm64

No macOS release artifact exists yet. Use Docker as described above.

### agenc onboard does not prompt for LLM config

The startup script injects LLM config from environment variables automatically.

---

## AgenC Ecosystem

| Repo | Role |
|---|---|
| `tetsuo-ai/AgenC` | Umbrella — docs, examples |
| `tetsuo-ai/agenc-core` | Runtime engine, daemon, web UI |
| `tetsuo-ai/agenc-sdk` | TypeScript SDK |
| `tetsuo-ai/agenc-protocol` | Anchor program, IDL, artifacts |
| `tetsuo-ai/agenc-plugin-kit` | Plugin/adapter ABI |

See `docs/RUNBOOK.md` for the full contributor workspace setup.
