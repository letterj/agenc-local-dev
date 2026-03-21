# agenc-local-dev

Personal dev tooling for working with the AgenC ecosystem on macOS Apple Silicon.

The `agenc` CLI only supports Linux x64. This repo provides a Docker-based
operator environment that runs the full AgenC stack on macOS without waiting
for native arm64 support.

---

## Contents

| File | Purpose |
|---|---|
| `Dockerfile` | Linux x64 image with agenc, build tools, socat |
| `docker-compose.yml` | Container orchestration with volume persistence |
| `.env.example` | Environment variable template |
| `CLAUDE.md` | AI assistant context for this workspace |
| `docs/RUNBOOK.md` | Full setup and troubleshooting reference |
| `skills/` | Claude skills for this workspace |

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
- Rebuild `better-sqlite3` for the current Node ABI
- Start the AgenC daemon
- Start a socat bridge so the UI is reachable from your Mac

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

Use this to run `vim`, inspect files directly, or run any agenc commands
interactively inside the container.

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

The daemon binds to `127.0.0.1` internally — socat forwards it to
`0.0.0.0:3101` which Docker maps to your Mac's port 3100. Check socat:

```bash
docker exec agenc-operator ps aux | grep socat
```

If socat is not running, restart it:

```bash
docker exec agenc-operator bash -c \
  "socat TCP-LISTEN:3101,fork,reuseaddr TCP:127.0.0.1:3100 &"
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

### gateway.host is hardcoded to 127.0.0.1

The daemon ignores `gateway.host` in config. The startup script works
around this with socat. Upstream issue pending: `tetsuo-ai/agenc-core`.

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
