---
name: agenc-morning-sync
description: >
  Run this skill at the start of every session in the AgenC workspace.
  Triggers on phrases like "good morning", "let's get started", "morning sync",
  "sync the repos", "check for upstream changes", or any session opener.
  Fetches upstream changes across all AgenC repos, syncs forks that have new
  commits, checks the tetsuo-ai GitHub org for new repositories (flags anything
  that looks like an extracted component), checks PR status, starts the Docker
  operator container, and reports a clean session-start summary.
  Always run this before doing any other work.
---

# AgenC Morning Sync Skill

Run at the start of every session to get the workspace fully up to date.

---

## Step 1 — Check upstream repos for new commits

```bash
for repo in AgenC agenc-sdk agenc-core agenc-protocol agenc-plugin-kit; do
  echo "=== $repo ==="
  git -C ~/workshop/agencproj/$repo checkout main --quiet 2>/dev/null || true
  git -C ~/workshop/agencproj/$repo fetch origin --quiet
  git -C ~/workshop/agencproj/$repo merge --ff-only origin/main 2>/dev/null \
    && git -C ~/workshop/agencproj/$repo log --oneline --since="yesterday" origin/main \
    || echo "⚠️  could not fast-forward — check $repo manually"
done
```

Report which repos have new activity.

---

## Step 2 — Sync forks that have new commits

For each repo that had new commits in Step 1:

```bash
cd ~/workshop/agencproj/forks/REPO
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
echo "✅ REPO synced"
```

If nothing changed, skip silently.

---

## Step 2b — Rebuild agenc-sdk dist if new commits landed

If agenc-sdk had new commits in Step 1, rebuild the dist:

```bash
AGENC_SDK_COMMITS=$(git -C ~/workshop/agencproj/agenc-sdk \
  log --oneline --since="yesterday" origin/main 2>/dev/null | wc -l | tr -d ' ')
if [ "$AGENC_SDK_COMMITS" -gt 0 ]; then
  echo "agenc-sdk: $AGENC_SDK_COMMITS new commit(s) — rebuilding dist..."
  if cd ~/workshop/agencproj/forks/agenc-sdk && npm run build 2>&1; then
    echo "✅ agenc-sdk dist rebuilt"
  else
    echo "⚠️  agenc-sdk dist build FAILED — scripts importing from dist/ may error"
    echo "   Run manually: cd ~/workshop/agencproj/forks/agenc-sdk && npm run build"
  fi
else
  echo "agenc-sdk: no new commits — dist unchanged"
fi
```

The `dist/` directory is gitignored. Scripts in `agenc-local-dev/scripts/`
import from `forks/agenc-sdk/dist/` — a stale dist causes BN-related or
import errors. Build failure is reported but does not block the rest of the sync.

---

## Step 3 — Rebase working branches if main changed

For each fork that was synced:

```bash
cd ~/workshop/agencproj/forks/REPO
git checkout experiment/local-dev-setup
git rebase main
```

If there are conflicts or unstaged changes, report them and stop — do not
force the rebase. Let the user decide.

---

## Step 4 — Check open PRs status

```bash
# All open PRs from letterj against tetsuo-ai repos
gh search prs --author letterj \
  --repo tetsuo-ai/agenc-core \
  --repo tetsuo-ai/agenc-sdk \
  --repo tetsuo-ai/agenc-protocol \
  --repo tetsuo-ai/AgenC \
  --state open \
  --json number,title,state,reviewDecision,updatedAt,comments \
  --jq '.[] | "#\(.number) \(.state) | reviews:\(.reviewDecision // "none") | comments:\(.comments | length) | updated:\(.updatedAt[:10]) | \(.title)"'

# For any known in-flight PRs, get full detail
# Format: "owner/repo:pr_number"
# e.g. for pr_spec in "tetsuo-ai/agenc-core:28"; do
for pr_spec in "tetsuo-ai/agenc-core:43" "tetsuo-ai/agenc-core:74"; do  # add entries as PRs are filed
  repo="${pr_spec%%:*}"
  num="${pr_spec##*:}"
  gh pr view "$num" --repo "$repo" \
    --json number,title,state,reviewDecision,comments,updatedAt \
    --jq '"#\(.number) \(.state) | reviews:\(.reviewDecision // "none") | comments:\(.comments | length) | updated:\(.updatedAt[:10]) | \(.title)"' \
    2>/dev/null || echo "  PR $repo#$num — not found"
done
```

Report: any open PRs with review state, comment count, and last-updated date.
If the search returns nothing, report "no open PRs".

---

## Step 4b — Secrets audit (run before any commit this session)

Use this pattern for all secrets scans:

```bash
grep -rn \
  -e "xai-" \
  -e "Bearer " \
  -e "[0-9]\{8,10\}:AA[A-Za-z0-9_-]\{33\}" \
  -e "\[0-9,\s\]\{100,\}" \
  <files to scan>
```

Covers: xAI API keys, Bearer tokens, Telegram bot tokens, Solana keypair arrays.

---

## Step 5 — Check tetsuo-ai org for new repositories

```bash
gh repo list tetsuo-ai --limit 50 --json name,createdAt,description \
  --jq 'sort_by(.createdAt) | reverse | .[] | [.createdAt, .name, .description] | @tsv' \
  2>/dev/null || echo "gh CLI not available — check https://github.com/tetsuo-ai manually"
```

If `gh` is not available, fetch the public API directly:

```bash
curl -s "https://api.github.com/orgs/tetsuo-ai/repos?sort=created&direction=desc&per_page=20" \
  | python3 -c "
import json,sys
repos = json.load(sys.stdin)
for r in repos:
    print(r['created_at'][:10], r['name'], '-', r.get('description',''))
"
```

Compare against the known repo list:
```
AgenC, agenc-sdk, agenc-core, agenc-protocol, agenc-plugin-kit, agenc-prover
```

Flag any repo **not** in that list, especially names matching these patterns:
- `agenc-marketplace` or `marketplace-*`
- `agenc-*` (any new AgenC component)
- Names suggesting an extracted service: `agenc-engine`, `agenc-scoring`,
  `agenc-bidder`, `agenc-settlement`, etc.

For each flagged repo, report:
- Repo name and creation date
- Description (if any)
- Whether it looks like an extracted component from agenc-core

---

## Step 6 — Start the Docker operator container

```bash
cd ~/workshop/agencproj/agenc-local-dev

if docker ps --filter "name=agenc-operator" --format "{{.Names}}" | grep -q agenc-operator; then
  echo "✅ agenc-operator already running"
  docker exec agenc-operator agenc status | grep -E "running|pid|port"
else
  docker compose up -d
  sleep 10
  docker exec agenc-operator agenc status | grep -E "running|pid|port"
  echo "✅ agenc-operator started"
fi
```

---

## Step 7 — Report session summary

Print a clean summary:

```
=== AgenC Session Start — YYYY-MM-DD ===

Repos synced:
  - agenc-core: N new commits
  - agenc-sdk: N new commits — dist rebuilt ✅
  or: agenc-sdk: no changes
  ...

New tetsuo-ai repos:
  - agenc-marketplace (created 2026-03-24) — ⚠️ extracted component?
  or: none since last session

PRs:
  - tetsuo-ai/agenc-core #NN: open | reviews: REVIEW_DECISION | comments: N | updated: YYYY-MM-DD | title
  or: no open PRs

Container:
  - agenc-operator: running | pid NNN | port 3100
  - UI: http://localhost:3100/ui/

Ready.
```

If anything failed (merge conflict, container error, unexpected PR merge),
call it out clearly and stop so the user can decide how to proceed.

---

## Workspace reference

| Item | Value |
|---|---|
| Workspace root | `~/workshop/agencproj/` |
| Reference repos (read only) | `AgenC`, `agenc-sdk`, `agenc-core`, `agenc-protocol`, `agenc-plugin-kit` |
| Fork origin | `git@github.com:letterj/REPO` |
| Fork upstream | `https://github.com/tetsuo-ai/REPO` |
| Working branch | `experiment/local-dev-setup` on all forks |
| Docker project | `~/workshop/agencproj/agenc-local-dev/` |
| Container UI | `http://localhost:3100/ui/` |
| Tracked PRs | none currently — add to Step 4 tracked loop as PRs are filed |
| agenc-protocol default branch | `feature/bootstrap-wave1` — skill checks out `main` before pulling |
