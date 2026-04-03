#!/usr/bin/env bash
# setup-hooks.sh
#
# Installs git hooks for this repo. Run once after cloning:
#
#   bash scripts/setup-hooks.sh
#
# .git/hooks/ is not tracked by git, so every new clone needs this step.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

# ---------------------------------------------------------------------------
# pre-commit — security scan
# Blocks commits containing API keys, bot tokens, or docker config.json files.
# ---------------------------------------------------------------------------

cat > "$HOOKS_DIR/pre-commit" << 'HOOK'
#!/usr/bin/env bash
# pre-commit security scan
# Blocks commits containing sensitive content.
# Install: scripts/setup-hooks.sh (or copy this file to .git/hooks/pre-commit and chmod +x)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PATTERN='xai-[A-Za-z0-9]{40,}|sk-ant-[A-Za-z0-9-]{40,}|Bearer [A-Za-z0-9_.~+/-]{20,}|[0-9]{8,10}:[A-Za-z0-9_-]{35}'

FAILED=0

# ---------------------------------------------------------------------------
# Pass 1 — full tracked tree
# ---------------------------------------------------------------------------
echo "Security scan: pass 1 (full tree)..."
TREE_HITS=$(git ls-files | xargs grep -Il '' 2>/dev/null | xargs grep -En "$PATTERN" 2>/dev/null || true)
if [ -n "$TREE_HITS" ]; then
  echo -e "${RED}[BLOCKED] Sensitive content in tracked files:${NC}"
  echo "$TREE_HITS"
  FAILED=1
fi

# ---------------------------------------------------------------------------
# Pass 2 — staged files only
# ---------------------------------------------------------------------------
echo "Security scan: pass 2 (staged files)..."
STAGED=$(git diff --cached --name-only 2>/dev/null)
if [ -n "$STAGED" ]; then
  STAGED_HITS=$(echo "$STAGED" | xargs grep -En "$PATTERN" 2>/dev/null || true)
  if [ -n "$STAGED_HITS" ]; then
    echo -e "${RED}[BLOCKED] Sensitive content in staged files:${NC}"
    echo "$STAGED_HITS"
    FAILED=1
  fi
fi

# ---------------------------------------------------------------------------
# Pass 3 — docker config.json guard
# ---------------------------------------------------------------------------
echo "Security scan: pass 3 (docker config.json guard)..."
CONFIG_HITS=$(git diff --cached --name-only 2>/dev/null | grep "^docker/.*/config\.json" || true)
if [ -n "$CONFIG_HITS" ]; then
  echo -e "${RED}[BLOCKED] docker config.json staged for commit (should be gitignored):${NC}"
  echo "$CONFIG_HITS"
  FAILED=1
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
if [ "$FAILED" -eq 1 ]; then
  echo -e "${RED}Commit blocked. Fix the issues above before committing.${NC}"
  exit 1
fi

echo -e "${GREEN}Security scan clean ✅${NC}"
exit 0
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅ pre-commit hook installed at $HOOKS_DIR/pre-commit"
