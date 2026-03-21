# CLAUDE.md — AgenC Experiment Workspace

Last updated: 2026-03-20

---

## Who You Are Working For

**letterj** (Jay B Payne) — contributor working against the public AgenC surfaces.
GitHub: `https://github.com/letterj`. Working from forks, submitting PRs upstream.

---

## Quick Reference

- **Workspace:** `~/workshop/agencproj/`
- **Active forks:** `forks/AgenC`, `agenc-sdk`, `agenc-protocol`, `agenc-plugin-kit`, `agenc-core`
- **Active branch on all forks:** `experiment/local-dev-setup`
- **Devnet program:** `6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab`
- **Wallet:** `BP3rDSMHG4oHkJsB4voh6xiB3pp2Y2MDcT3yHhaPGxWT` (~18.4 SOL)
- **Registered agent PDA:** `GvXS49pWYMtgThmeVw32L7dPBFyCD1siYsTH4CaobpEs`
- **ADR-003 is current:** agenc-core is public
- **Operator instance:** Docker container `agenc-operator`, UI at `http://localhost:3100/ui/`

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

## Operator Instance (Docker)

The `agenc` CLI only supports Linux x64. On macOS, run in Docker.

```bash
# Build
docker build --platform linux/amd64 \
  -t agenc-operator \
  -f ~/workshop/agencproj/Dockerfile.agenc \
  ~/workshop/agencproj/

# Run
docker run -it --platform linux/amd64 \
  --name agenc-operator \
  -p 3100:3101 \
  agenc-operator

# Inside container — first time
agenc onboard
vim /root/.agenc/config.json  # add llm block + "host": "0.0.0.0"
agenc-start.sh

# UI
open http://localhost:3100/ui/
```

Config must include:
```json
"gateway": { "port": 3100, "host": "0.0.0.0" },
"llm": { "provider": "grok", "apiKey": "...", "model": "grok-3" }
```

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
solana program show 6UcJzbTEemBz3aY5wK5qKHGMD7bdRsmR4smND29gB2ab --url devnet
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

---

## Reference Docs

| Document | Location |
|---|---|
| Full runbook | `forks/AgenC/docs/AGENC-LOCAL-DEV-RUNBOOK.md` |
| Repository topology | `forks/AgenC/docs/REPOSITORY_TOPOLOGY.md` |
| Devnet compat report | `forks/agenc-sdk/docs/devnet-compatibility.md` |
| ADR-003 | `forks/agenc-core/docs/architecture/adr/adr-003-public-framework-product.md` |
| Refactor history | `forks/AgenC/REFACTOR-MASTER-PROGRAM.md` |
