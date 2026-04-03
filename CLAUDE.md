# CLAUDE.md — AgenC Experiment Workspace

Last updated: 2026-04-02

---

## Who You Are Working For

**letterj** (Jay B Payne) — contributor working against the public AgenC surfaces.
GitHub: `https://github.com/letterj`. Working from forks, submitting PRs upstream.

---

## Quick Reference

- **Workspace:** `~/workshop/agencproj/`
- **Active forks:** `forks/AgenC`, `agenc-sdk`, `agenc-protocol`, `agenc-plugin-kit`, `agenc-core`
- **Active branch on all forks:** `experiment/local-dev-setup`
- **Devnet program:** `GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3` (V2, deployed 2026-03-27)
- **Protocol config PDA:** `GEXnAns2Wq27xjG84a7BnuxJBY3R5Qu9CdFy2HQ7vsiv`
- **Creator agent PDA:** `HmZqAsDzW1Ew6SwQCcZoBvzYaYRXs2TeXBx31s8xSy7H` (wallet `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT`)
- **Worker agent PDA:** `DQ1drYVZ9WuHANrnBBLWiaHm9vifZ2p4y7HZ4EFiNDdv` (wallet `26d6kxsPVJ2tQn3AUogfHJjqu77dksX31FcPAYpCup2Q`)
- **ADR-003 is current:** agenc-core is public
- **Containers:** `agenc-creator` (port 3100) and `agenc-worker` (port 3101) via `docker compose up -d`

---

## Repository Topology

```
~/workshop/agencproj/
├── AgenC/               ← tetsuo-ai reference (READ ONLY)
├── agenc-sdk/           ← tetsuo-ai reference (READ ONLY)
├── agenc-protocol/      ← tetsuo-ai reference (READ ONLY)
├── agenc-plugin-kit/    ← tetsuo-ai reference (READ ONLY)
├── agenc-core/          ← tetsuo-ai reference (READ ONLY)
├── agenc-prover/        ← tetsuo-ai reference (READ ONLY)
├── Dockerfile.agenc     ← operator Docker image
└── forks/               ← all work goes here
```

Each fork: `origin` → SSH to `letterj/REPO`, `upstream` → `tetsuo-ai/REPO`

---

## ADR-003 Product Direction

AgenC is a **public framework product**. Install surface: `agenc` CLI.
ADR-002 (private kernel) is superseded.

---

## Docker Containers

The `agenc` CLI only supports Linux x64. On macOS, run in Docker.

Two containers are defined in the root `docker-compose.yml`:

| Container | Host port | Wallet | Config |
|---|---|---|---|
| `agenc-creator` | 3100 | `~/.config/solana/id.json` | `docker/creator/config.json` |
| `agenc-worker` | 3101 | `~/.config/solana/worker.json` | `docker/worker/config.json` |

```bash
# Start both
cd ~/workshop/agencproj/agenc-local-dev
docker compose up -d

# UIs
open http://localhost:3100/ui/   # creator
open http://localhost:3101/ui/   # worker
```

Config is bind-mounted read-only — edit `docker/creator/config.json` or
`docker/worker/config.json` and restart the container to pick up changes.

---

## Known Issues (Pending PRs)

### gateway.host is hardcoded to 127.0.0.1 — agenc-core
The daemon ignores `gateway.host` in config and always binds to `127.0.0.1`.
This breaks Docker port mapping. Workaround: socat forward (handled in agenc-start.sh).
**Candidate for issue + PR against `tetsuo-ai/agenc-core`.**

### agenc CLI unsupported on darwin-arm64
No macOS release artifact. Linux x64 only. No upstream issue filed yet.

### agenc onboard doesn't prompt for LLM config
Generates minimal config with no `llm` block. Must add manually.

---

## agenc-sdk Validation Gates

```bash
cd ~/workshop/agencproj/forks/agenc-sdk
npm run typecheck
npm test
npm run build
npm run pack:smoke
npx -y node@20 scripts/pack-smoke.mjs
```

---

## Devnet Environment

```bash
solana config set --url devnet
solana program show GN69CoBM1XUt8MJtA6Kwd7WRwLzTNtVqLwf5o3fwWDV3 --url devnet
```

Known devnet drift — happy path works, edge case error names differ from SDK.
See `forks/agenc-sdk/docs/devnet-compatibility.md`.

---

## Contributions Made

| PR | Repo | Status |
|---|---|---|
| Issue #8 | agenc-sdk | anchor.BN undefined — Closed |
| PR #9 | agenc-sdk | BN interop fix — Merged |

---

## Key Rules

1. Never edit tetsuo-ai originals — only work in `forks/`
2. Never use mainnet — always devnet
3. All fork remotes use SSH — `git@github.com:letterj/REPO.git`
4. Always branch off main — never commit to `main` directly
5. agenc-protocol fork defaults to wrong branch — verify `main` after forking
6. `better-sqlite3` must be rebuilt in Docker on first start
7. gateway.host is hardcoded — use socat workaround in Docker
8. Upstream PR branch discipline: always create upstream PRs from a dedicated branch off `upstream/main` — never from `experiment/local-dev-setup`. See RUNBOOK.md for the correct workflow.
9. Review before submitting: always show full content of any Issue, PR, commit message, or push before executing — wait for explicit approval. See RUNBOOK.md for details.

---

## Reference Docs

| Document | Location |
|---|---|
| Full runbook | `docs/RUNBOOK.md` in agenc-local-dev |
| Repository topology | `forks/AgenC/docs/REPOSITORY_TOPOLOGY.md` |
| Devnet compat report | `forks/agenc-sdk/docs/devnet-compatibility.md` |
| ADR-003 | `forks/agenc-core/docs/architecture/adr/adr-003-public-framework-product.md` |
| Project plan | `docs/PROJECT-PLAN.md` in agenc-local-dev |
