# HOW-TO: Telegram Channel Connector

## Authors
- J Brett (letterj) — contributor, tester, domain context
- Claude Sonnet 4.6 — drafting, code generation, research assistance

Wire a Telegram bot into each agenc container so agents can receive and
respond to messages over Telegram. Each agent gets its own bot (creator bot
and worker bot), configured independently via `config.json`.

**Status:** Confirmed working as of 2026-03-30.
Both bots respond in Telegram with the agent welcome message on `/start`.

---

## Prerequisites

- Dual Docker setup running (see HOW-TO-DUAL-DOCKER.md)
- Two Telegram bots created via BotFather — one per agent
- Bot tokens in hand (never commit these)

### Create bots with BotFather

1. Open Telegram, search `@BotFather`
2. `/newbot` → follow prompts → note the token (`1234567890:AAH...`)
3. Repeat for the second bot
4. Recommended names: `agenc-creator` and `agenc-worker` (or similar)

---

## Known Issue: Double-Registration Bug (agenc-core)

**All external channels (Telegram, Discord, Slack, etc.) crash the daemon
on startup in `@tetsuo-ai/agenc` 0.1.0.**

Root cause: `channel-wiring.ts` calls `registerGatewayChannel(deps.gateway, channel)`
inside both `wireTelegram` and `wireExternalChannel`, but `daemon.ts` also
calls `gateway.registerChannel(channel)` for every entry in the returned
channel map. The channel gets registered twice, the second call throws
`"Channel 'telegram' is already registered"`, and the daemon exits with code 1.

**Fix branch:** `letterj/agenc-core` → `fix/channels-double-registration`
Removes the two redundant `registerGatewayChannel` calls. `daemon.ts` is
the single owner of the registration loop.

**Upstream issue:** tetsuo-ai/agenc-core#73

**Workaround (in place):** `agenc-start.sh` inside the container applies a
`sed` patch to `daemon.js` at startup, removing the duplicate calls before
`agenc start` runs. The patch is idempotent — safe to apply on every restart.

```bash
# Patch applied automatically by agenc-start.sh — no manual action needed.
# Source: agenc-local-dev/Dockerfile, "Patch channel double-registration bug" block
```

---

## Config Format

Add a `channels` block to each agent's `config.json`:

```json
"channels": {
  "webchat": { "enabled": true },
  "telegram": {
    "enabled": true,
    "botToken": "<YOUR_BOT_TOKEN>"
  }
}
```

**Field name is `botToken`** — not `token`. The daemon validates this and
will fail with a clear error if the wrong key is used.

Optional: restrict the bot to specific Telegram user IDs:

```json
"telegram": {
  "enabled": true,
  "botToken": "<YOUR_BOT_TOKEN>",
  "allowedUsers": ["123456789", "987654321"]
}
```

Empty `allowedUsers` (or omitting it) allows anyone to use the bot.

---

## File Locations

| File | Container |
|---|---|
| `docker/creator/config.json` | agenc-creator (port 3100) |
| `docker/worker/config.json` | agenc-worker (port 3101) |

Both files are in `.gitignore` — tokens will never be committed.

---

## Apply Config Changes

Config is bind-mounted read-only into each container. A full `down`/`up`
cycle is required to pick up changes (plain `restart` re-runs the entrypoint
and hits the stale PID file):

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml up -d
```

---

## Verify the Connector Started

```bash
docker logs agenc-creator 2>&1 | grep -iE "telegram|patch|channel" | tail -10
docker logs agenc-worker  2>&1 | grep -iE "telegram|patch|channel" | tail -10
```

Expected output (healthy):

```
✅ Applied channel double-registration patch to daemon.js
INFO  Telegram long-polling started
INFO  Telegram channel wired
INFO  Channel 'telegram' registered
```

The status payload will also show the channel active:

```json
"channels": ["telegram"],
"channelStatuses": [
  { "name": "telegram", "health": "healthy", "mode": "polling", "active": true }
]
```

Any error line in the grep output is a failure — stop and investigate.

---

## Test: Send a Message

1. Open Telegram, find your creator bot by username
2. Send `/start`
3. The agent should reply with its welcome message within a few seconds
4. Repeat for the worker bot

If there is no response within 10 seconds:
- Check `docker logs agenc-creator 2>&1 | grep -i error | tail -20`
- Confirm the token is correct and the bot is not already connected elsewhere
  (a single bot token can only have one active long-polling connection)

---

## Security

- `docker/creator/config.json` and `docker/worker/config.json` are both
  listed explicitly in `.gitignore` — verify with:
  ```bash
  grep "config.json" ~/workshop/agencproj/agenc-local-dev/.gitignore
  ```
- Never commit bot tokens. Never pass them via environment variables in
  `docker-compose.yml` (that file IS committed).
- If a token is accidentally exposed: revoke it immediately via BotFather
  (`/revoke`) and generate a new one.

---

## Rebuild After Runtime Update

When the `@tetsuo-ai/agenc` npm package updates, the runtime binary is
replaced. The Dockerfile patch in `agenc-start.sh` targets the installed
`daemon.js` by path pattern — it will re-apply automatically on the new
binary if the double-registration bug is still present, or skip silently
if it has been fixed upstream.

After any runtime update, rebuild the image:

```bash
cd ~/workshop/agencproj/agenc-local-dev
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml up -d
```

Then re-verify logs as above.
