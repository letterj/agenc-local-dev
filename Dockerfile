FROM --platform=linux/amd64 node:20-slim

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install -y vim curl socat python3 make g++ iproute2 -qq && \
    rm -rf /var/lib/apt/lists/*

# Install agenc globally
RUN npm install -g @tetsuo-ai/agenc

# Create entrypoint script
RUN cat > /usr/local/bin/agenc-start.sh << 'SCRIPT'
#!/bin/bash
set -e

# Run onboard if no config exists
if [ ! -f /root/.agenc/config.json ]; then
  echo "Running first-time onboard..."
  agenc onboard || true
fi

# Rebuild better-sqlite3 if runtime is installed
SQLITE_PATH=$(find /root/.agenc/runtime -name "better_sqlite3.node" 2>/dev/null | head -1)
if [ -n "$SQLITE_PATH" ]; then
  SQLITE_DIR=$(dirname $(dirname $SQLITE_PATH))
  echo "Rebuilding better-sqlite3..."
  cd $SQLITE_DIR && npm rebuild 2>/dev/null || true
fi

# Start daemon
agenc start

# Forward 0.0.0.0:3101 -> 127.0.0.1:3100 so Docker can reach it
socat TCP-LISTEN:3101,fork,reuseaddr TCP:127.0.0.1:3100 &

echo "✅ AgenC running — UI at http://localhost:3100/ui/"
echo "   (mapped via socat on port 3101 inside container)"

# Keep container alive
tail -f /root/.agenc/daemon.log
SCRIPT

RUN chmod +x /usr/local/bin/agenc-start.sh

EXPOSE 3101

CMD ["bash"]
