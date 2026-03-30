# HOW-TO: Dual Docker Setup (Creator + Worker)

## Authors
- J Brett (letterj) — contributor, tester, domain context
- Claude Sonnet 4.6 — drafting, code generation, research assistance

Run two independent `agenc-operator` containers on a single Mac — one acting
as the task creator (port 3100) and one as the task worker (port 3101) — each
with its own Solana wallet, config, and persistent data volume.

---

## Prerequisites

- Docker >= 28 with `--platform linux/amd64` support (Rosetta on Apple Silicon)
- Two devnet wallets:
  - Creator: `~/.config/solana/id.json`
  - Worker: `~/.config/solana/worker.json`
- An xAI API key (Grok-3)

If the worker wallet doesn't exist yet:

```bash
solana-keygen new --outfile ~/.config/solana/worker.json --no-bip39-passphrase
solana airdrop 1 $(solana-keygen pubkey ~/.config/solana/worker.json) --url devnet
```

---

## Directory Layout

```
agenc-local-dev/
├── Dockerfile                  ← shared image (unchanged)
├── docker-compose.yml          ← original single-container setup (preserved)
└── docker/
    ├── docker-compose.yml      ← dual-container setup
    ├── creator/
    │   └── config.json         ← creator agent config (port 3100, creator wallet)
    └── worker/
        └── config.json         ← worker agent config (port 3100 internal, worker wallet)
```

Both containers use the same Docker image built from the root `Dockerfile`.
Each gets its own named volume for persistent data (config, memory DB, logs).

---

## How It Works

### Port mapping

```
Mac browser                Docker host             Container
localhost:3100  →(3100→3101)→  agenc-creator:3101  →(socat)→  127.0.0.1:3100 (daemon)
localhost:3101  →(3101→3101)→  agenc-worker:3101   →(socat)→  127.0.0.1:3100 (daemon)
```

Each container runs the same socat bridge pattern:
`socat TCP-LISTEN:3101,bind=0.0.0.0,fork,reuseaddr TCP:127.0.0.1:3100`

The daemon always binds to loopback only, so no `auth.secret` is required.

### Wallet injection

Each container has its host wallet keypair bind-mounted read-only to
`/root/.config/solana/id.json`. Both configs reference that path via
`connection.keypairPath: "~/.config/solana/id.json"`.

| Container | Host keypair | Mounted as |
|---|---|---|
| `agenc-creator` | `~/.config/solana/id.json` | `/root/.config/solana/id.json:ro` |
| `agenc-worker` | `~/.config/solana/worker.json` | `/root/.config/solana/id.json:ro` |

### Installed Tools

Both containers include `procps` (provides ps, top, free) to support
agent system status queries via the bash tool.

### Config injection

Each container has its pre-baked `config.json` bind-mounted read-only on top
of the named volume at `/root/.agenc/config.json`. The startup script sees the
config already present and skips `agenc onboard`. Since `GROK_API_KEY` is not
set in the compose env, the script also skips the config rewrite step.

---

## Starting from Scratch

### Step 1 — Populate the config files

`docker/creator/config.json` and `docker/worker/config.json` are pre-populated
with the correct structure. Verify the `llm.apiKey` field contains your xAI key:

```bash
grep apiKey docker/creator/config.json
grep apiKey docker/worker/config.json
```

### Step 2 — Build and start

```bash
cd ~/workshop/agencproj/agenc-local-dev/docker
docker compose up -d
```

Both images build from the shared `Dockerfile` in the parent directory (cached
after the first build). First start takes ~60 s; subsequent starts are instant.

### Step 3 — Verify

```bash
docker compose ps
docker exec agenc-creator agenc status
docker exec agenc-worker  agenc status
```

Expected output from `agenc status`:
```json
{ "running": true, "pid": ..., "port": 3100, ... }
```

### Step 4 — Open the UIs

| Agent | URL |
|---|---|
| Creator | http://localhost:3100/ui/ |
| Worker  | http://localhost:3101/ui/ |

---

## Daily Operations

### Start both containers

```bash
cd ~/workshop/agencproj/agenc-local-dev/docker
docker compose up -d
```

### Stop both containers

```bash
cd ~/workshop/agencproj/agenc-local-dev/docker
docker compose down
```

### Restart one container

```bash
docker compose restart agenc-creator
# or
docker compose restart agenc-worker
```

### View logs

```bash
docker logs -f agenc-creator
docker logs -f agenc-worker
```

### Open a shell

```bash
docker exec -it agenc-creator bash
docker exec -it agenc-worker  bash
```

### Check daemon status

```bash
docker exec agenc-creator agenc status
docker exec agenc-worker  agenc status
```

---

## Data Persistence

Each container has its own named Docker volume:

| Volume | Container | Contains |
|---|---|---|
| `docker_agenc-creator-data` | `agenc-creator` | memory.db, daemon.log, runtime cache |
| `docker_agenc-worker-data` | `agenc-worker` | memory.db, daemon.log, runtime cache |

The `config.json` for each is bind-mounted from `docker/creator/` and
`docker/worker/` — it is not stored in the volume, so editing the host file
and restarting the container picks up the change immediately.

```bash
# Wipe all data and start fresh (destructive)
docker compose down -v
```

---

## Troubleshooting

### UI not loading

```bash
docker exec agenc-creator agenc status
docker exec agenc-creator ss -tlnp | grep -E '3100|3101'
```

Expected: daemon on `127.0.0.1:3100`, socat on `0.0.0.0:3101`.

### Config not loading / daemon re-runs onboard

The `config.json` bind mount must exist before `docker compose up`. Confirm:

```bash
ls -la docker/creator/config.json docker/worker/config.json
```

### better-sqlite3 error on first start

```bash
docker exec agenc-creator bash -c "
  cd \$(find /root/.agenc/runtime -name better-sqlite3 -type d | head -1)
  npm rebuild
"
docker exec agenc-creator agenc-start.sh
```

Repeat for `agenc-worker` if needed. The startup script handles this
automatically on subsequent runs.

### Port conflict

If port 3100 or 3101 is already in use (e.g. the old single-container setup):

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose down   # stop the original single container
cd docker
docker compose up -d
```
