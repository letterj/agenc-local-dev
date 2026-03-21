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
| `RUNBOOK.md` | Full setup and troubleshooting reference |

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
vim .env  # add your Grok API key
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

This takes ~60 seconds on first build. It installs system dependencies and
`@tetsuo-ai/agenc` inside the Linux x64 image.

### 4. Start the container

```bash
docker compose run --service-ports agenc-operator
```

### 5. Inside the container — first time only

```bash
# Generate default config
agenc onboard

# Start the daemon (auto-configures from env, rebuilds sqlite, starts socat)
agenc-start.sh
```

The startup script:
- Injects your Grok API key and agent name from environment variables
- Sets `gateway.host: 0.0.0.0` so Docker port mapping works
- Rebuilds `better-sqlite3` native addon for the current Node ABI
- Starts the daemon
- Starts a socat bridge (`0.0.0.0:3101 → 127.0.0.1:3100`)
- Tails the daemon log

### 6. Open the UI

In your Mac browser: **http://localhost:3100/ui/**

---

## Subsequent Starts

Your config, memory, and logs persist in the `agenc-data` Docker volume.
On subsequent starts you only need:

```bash
docker compose run --service-ports agenc-operator
# Inside container:
agenc-start.sh
```

---

## Stopping the Daemon

From inside the container:

```bash
# Ctrl+C to stop the log tail, then:
agenc stop
```

Or from your Mac:

```bash
docker stop agenc-operator
```

---

## Checking Status

From inside the container:

```bash
agenc status
```

From your Mac browser: http://localhost:3100/ui/ → DASH tab

---

## Known Issues

### gateway.host is hardcoded to 127.0.0.1

The AgenC daemon ignores `gateway.host` in config and always binds to
`127.0.0.1`. This prevents Docker port mapping from reaching the daemon
directly. The `agenc-start.sh` script works around this with socat.

Upstream issue pending: `tetsuo-ai/agenc-core`

### better-sqlite3 native addon compatibility

The runtime artifact ships a pre-compiled `better-sqlite3` binary. Under
Docker's Rosetta emulation it fails to load. The `agenc-start.sh` script
automatically rebuilds it using the container's build toolchain.

### agenc CLI unsupported on darwin-arm64

The `@tetsuo-ai/agenc` package checks the platform at startup and exits
with `unsupported platform darwin-arm64` on Apple Silicon Macs.
No upstream macOS release artifact exists yet.

### agenc onboard does not prompt for LLM config

The onboarding wizard generates a minimal config with no `llm` block.
The `agenc-start.sh` script injects the full LLM config from environment
variables automatically.

---

## AgenC Ecosystem

This repo works alongside the AgenC public repositories:

| Repo | Role |
|---|---|
| `tetsuo-ai/AgenC` | Umbrella — docs, examples |
| `tetsuo-ai/agenc-core` | Runtime engine, daemon, web UI |
| `tetsuo-ai/agenc-sdk` | TypeScript SDK |
| `tetsuo-ai/agenc-protocol` | Anchor program, IDL, artifacts |
| `tetsuo-ai/agenc-plugin-kit` | Plugin/adapter ABI |

See `RUNBOOK.md` for the full contributor workspace setup.
