# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [0.2.0] — 2026-03-21

### Investigation: gateway.bind + Docker bridge IP

The initial `[0.1.0]` setup used `gateway.bind: "0.0.0.0"` (daemon binds all
interfaces) with `AUTH_SECRET` (required by the runtime for non-loopback binding).
This session investigated the TRACE tab returning `Authentication required` and
arrived at a different architecture.

**Root cause discovered:** `auth.localBypass: true` only fires when the
connection `remoteAddress` is exactly `127.0.0.1`, `::1`, or
`::ffff:127.0.0.1`. When a browser connects to `localhost:3100` on the Mac
host, Docker translates via the bridge network and the daemon sees the
connection from the bridge gateway IP (e.g. `192.168.97.1`), not loopback.
This means `localBypass: true` cannot authenticate browser connections through
Docker port mapping on macOS — regardless of the config.

**Structural constraint:** The runtime enforces `auth.secret is required when
gateway.bind is non-local`. This creates an unavoidable incompatibility:
`bind: "0.0.0.0"` requires `auth.secret`; `auth.secret` breaks browser UI via
Docker port mapping on macOS; `bind: "127.0.0.1"` makes the daemon unreachable
through Docker port mapping without an additional bridge.

### Fixed

- Restored socat bridge: daemon binds to `127.0.0.1:3100` (no `auth.secret`
  required); socat listens on `0.0.0.0:3101` and forwards to `127.0.0.1:3100`;
  docker-compose maps `host:3100 → container:3101`
- Removed `auth.secret` and `AUTH_SECRET` from config injection entirely —
  the socat architecture makes auth.secret unnecessary for local dev
- Docker port mapping corrected: `3100:3101` (container socat port, not daemon port)
- TRACE tab (`observability.traces`) now works in browser without authentication errors
- `socat` added back to apt-get install in Dockerfile

### Changed

- Config injection: `cfg.gateway = { port: ... }` (no bind, no auth) +
  `delete cfg.auth` to clear any residual auth config from the volume
- `AUTH_SECRET` env var removed from docker-compose.yml and .env.example
  (still present in compose environment block but unused; can be removed)

### Documentation

- PR #27 on `tetsuo-ai/agenc-core` updated with two-scenario Gateway Config
  documentation: Scenario 1 (browser UI via Docker, no auth.secret) and
  Scenario 2 (CLI-only via docker exec, with auth.secret + localBypass) —
  includes explicit note about Docker bridge IP limitation

---

## [0.1.0] — 2026-03-21

### Added
- `docker-compose.yml` for container orchestration with named volume persistence
- `.env.example` with `GROK_API_KEY`, `AGENT_NAME`, and `AUTH_SECRET` fields
- `agenc-start.sh` entrypoint script — auto-onboards, injects config from env, rebuilds `better-sqlite3`, starts daemon
- `docs/` directory — runbook moved here from repo root
- `skills/agenc-changelog-docs-update/SKILL.md` — skill for updating changelog and docs from git commits
- `AUTH_SECRET` environment variable — required by runtime when `gateway.bind` is non-loopback

### Fixed
- `gateway.host` replaced with correct `gateway.bind` field in `agenc-start.sh` — `gateway.host` is silently ignored by the runtime (`GatewayBindConfig` interface uses `bind`, not `host`)
- Daemon now binds directly to `0.0.0.0:3100` — socat TCP port forward workaround removed
- `EXPOSE` port corrected from `3101` to `3100`
- Docker port mapping updated from `3100:3101` to `3100:3100`

### Changed
- Dockerfile `CMD` changed from `["bash"]` to `["/usr/local/bin/agenc-start.sh"]` — container now starts daemon automatically on `docker compose up -d`
- `socat` removed from apt-get install and startup script — no longer needed
- Config injection now sets `gateway.bind: "0.0.0.0"` and `auth.secret` from `AUTH_SECRET` env var

### Documentation
- Added README with requirements table, quick start, daily operations, troubleshooting, and known issues
- Added full runbook at `docs/RUNBOOK.md` with contributor workspace setup
- Documented `gateway.bind` vs `gateway.host` distinction and `auth.secret` requirement

---

## Related upstream contributions

| Repo | Issue/PR | Description |
|---|---|---|
| `agenc-sdk` | Issue #8, PR #9 | `anchor.BN` undefined in CJS/ESM — fixed with namespace import |
| `agenc-core` | Issue #26, PR #27 | `gateway.bind` undocumented — added Gateway Config section to `RUNTIME_API.md` |
