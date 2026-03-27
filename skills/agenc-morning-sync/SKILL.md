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
gh pr view 27 --repo tetsuo-ai/agenc-core \
  --json state,title,reviewDecision,comments \
  2>/dev/null || echo "gh CLI not available — check manually"
```

If `gh` is not available, note the URL:
- https://github.com/tetsuo-ai/agenc-core/pull/27

Report: merged, open with new activity, or no change since last session.

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

## Step 5b — Check SDK dist is current

If any `agenc-sdk` commits landed in Step 1, rebuild the SDK dist:

```bash
cd ~/workshop/agencproj/forks/agenc-sdk
npm run build
```

The `dist/` directory is gitignored. Scripts in `agenc-local-dev/scripts/`
import from `forks/agenc-sdk/dist/` — if the dist is stale they will fail
with BN-related or import errors.

If no `agenc-sdk` commits landed, skip silently.

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
  - agenc-sdk: no changes
  ...

New tetsuo-ai repos:
  - agenc-marketplace (created 2026-03-24) — ⚠️ extracted component?
  or: none since last session

PRs:
  - agenc-core #27: [open/merged/new comments]

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
| Open PRs | none |
| agenc-protocol default branch | `feature/bootstrap-wave1` — skill checks out `main` before pulling |
