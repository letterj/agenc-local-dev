# HOW-TO: Colima Docker Runtime + Phase 1 Sandbox Drill

## Authors
- J Brett (letterj) — contributor, tester, domain context
- Claude Sonnet 4.6 — drafting, code generation, research assistance

Set up Colima as the macOS Docker runtime and run the AgenC Phase 1 sandbox fleet drill.

Last verified: 2026-04-23 — Tested on: macOS Apple Silicon + Colima

---

## Why Colima

Docker Desktop and OrbStack do not reliably support the Phase 1 sandbox fleet drill on macOS.
Colima is the recommended lightweight Docker runtime for macOS contributors.

Colima runs a Linux VM and exposes a standard Docker daemon — containers behave as they would
on a native Linux host. The sandbox drill requires this Linux-compatible environment.

---

## Prerequisites

- macOS (Apple Silicon or Intel)
- Homebrew installed (`brew --version` should succeed)
- Existing agenc-core fork at `~/workshop/agencproj/forks/agenc-core`
- `agenc-local-dev/docker-compose.yml` present and configured

---

## Installation

```bash
brew install docker colima
```

This installs both the Docker CLI and the Colima VM manager. No Docker Desktop required.

---

## Starting Colima

```bash
colima start --runtime docker --cpu 2 --memory 4 --disk 20
```

Flag reference:

| Flag | Value | Meaning |
|---|---|---|
| `--runtime docker` | `docker` | Use Docker engine (not containerd) |
| `--cpu` | `2` | vCPUs allocated to the VM |
| `--memory` | `4` | GB of RAM allocated |
| `--disk` | `20` | GB of disk allocated |

Colima takes ~30 seconds to start on first launch. Subsequent starts are faster.

---

## Verify Docker Works

```bash
docker context show     # should print: colima
docker version          # should show Server version from the Colima VM
docker run --rm hello-world
```

**If `docker run` fails with `docker-credential-desktop not found`:**

A stale Docker Desktop credential helper entry in `~/.docker/config.json` causes this.
Remove it:

```bash
sed -i.bak '/"credsStore": "desktop",/d' ~/.docker/config.json
docker run --rm hello-world
```

---

## Bring Up agenc Containers

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose stop && docker compose up -d
docker ps   # confirm agenc-creator and agenc-worker are running
```

The `docker-compose.yml` has a volume mount that binds the local fork's `runtime/` directory
into both containers at the `@tetsuo-ai/runtime` package path. Containers automatically pick
up the local master build — no image rebuild needed.

To confirm the master build is active inside a container:

```bash
docker exec agenc-creator cat /root/.agenc/runtime/releases/0.2.0/linux-x64/node_modules/@tetsuo-ai/runtime/dist/VERSION
# Expected: 0.2.0 @ <commit hash> (<timestamp>)
```

**Rollback to stock image:** Remove the volume mount from `docker-compose.yml` and restart.

---

## Run the Phase 1 Sandbox Drill

```bash
cd ~/workshop/agencproj/forks/agenc-core
npm run drill:sandbox:fleet -- \
  --sandboxes 1 \
  --jobs-per-sandbox 1 \
  --waves 1 \
  --timeout-seconds 60 \
  --output runtime/artifacts/phase1-closeout/local-sandbox-check.json
```

Expected output:

```
[sandbox-drill] wave 1 completed: sandboxes=1 jobs=1
[sandbox-drill] artifact: .../local-sandbox-check.json
```

Verify the result:

```bash
cat runtime/artifacts/phase1-closeout/local-sandbox-check.json \
  | python3 -m json.tool | grep "overallPassed"
# Expected: "overallPassed": true
```

**If the drill fails:** Verify the containers are running (`docker ps`) and that the master
build is mounted (verification step in the section above). The drill depends on both containers
being reachable.

---

## Useful Colima Commands

```bash
colima status           # check if running
colima stop             # shut down VM (containers stop, state preserved)
colima start --runtime docker --cpu 2 --memory 4 --disk 20  # restart
colima delete           # destroy VM entirely (reclaims disk; volumes are lost)
```

---

## Notes and Gotchas

- **Separate image cache:** Colima has its own Docker daemon with its own image cache — images
  pulled or built under OrbStack or Docker Desktop are not available in Colima. Expect a fresh
  image pull on first use.
- **No volume migration:** Named volumes from OrbStack are not migrated — containers start fresh.
  The agenc containers will re-onboard on first start.
- **Switching back to OrbStack:** Run `docker context use orbstack` to restore the OrbStack context.
  The Colima context name is `colima`.
- **Runtime build is bind-mounted:** The agenc containers mount the local fork's `runtime/` directory.
  Always rebuild `runtime/dist/` before restarting containers if you want to pick up the latest
  master code.

---

## Related

- `HOW-TO-DUAL-DOCKER.md` — dual-container setup and port mapping reference
- `HOW-TO-FULL-TASK-LIFECYCLE.md` — create → claim → complete on devnet
- `docs/RUNBOOK.md` — daily operations and known issues
