FROM --platform=linux/amd64 node:20-slim

RUN apt-get update -qq && \
    apt-get install -y vim curl python3 make g++ iproute2 socat -qq && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g @tetsuo-ai/agenc

RUN cat > /usr/local/bin/agenc-start.sh << 'SCRIPT'
#!/bin/bash
set -e

# Run onboard if no config exists
if [ ! -f /root/.agenc/config.json ]; then
  echo "Running first-time onboard..."
  agenc onboard || true
fi

# Inject LLM config from environment if API key is set
if [ -n "$GROK_API_KEY" ]; then
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('/root/.agenc/config.json'));
    cfg.gateway = { port: cfg.gateway?.port ?? 3100 };
    delete cfg.auth;
    cfg.llm = { provider: 'grok', apiKey: process.env.GROK_API_KEY, model: 'grok-3' };
    cfg.memory = { backend: 'sqlite', dbPath: '/root/.agenc/memory.db' };
    cfg.agent = { name: process.env.AGENT_NAME || 'letterj-operator' };
    fs.writeFileSync('/root/.agenc/config.json', JSON.stringify(cfg, null, 2));
  "
  echo "✅ Config updated from environment"
fi

# Rebuild better-sqlite3 if runtime is installed
SQLITE_PATH=$(find /root/.agenc/runtime -name "better_sqlite3.node" 2>/dev/null | head -1)
if [ -n "$SQLITE_PATH" ]; then
  SQLITE_DIR=$(dirname $(dirname $SQLITE_PATH))
  echo "Rebuilding better-sqlite3..."
  cd $SQLITE_DIR && npm rebuild 2>/dev/null || true
fi

# Bridge external port 3101 → daemon loopback 3100 for Docker port mapping
# (daemon binds 127.0.0.1 so no auth.secret is required; socat exposes it externally)
socat TCP-LISTEN:3101,bind=0.0.0.0,fork,reuseaddr TCP:127.0.0.1:3100 &

# Start daemon
agenc start
echo "✅ AgenC running — UI at http://localhost:3100/ui/"
echo "   To open a shell: docker exec -it agenc-operator bash"
echo "   To check status: docker exec agenc-operator agenc status"

# Keep container alive by tailing the log
tail -f /root/.agenc/daemon.log
SCRIPT

RUN chmod +x /usr/local/bin/agenc-start.sh

EXPOSE 3100

# Default: start the daemon automatically
CMD ["/usr/local/bin/agenc-start.sh"]
