# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

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
