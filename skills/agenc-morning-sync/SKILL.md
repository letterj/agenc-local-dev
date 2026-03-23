---
name: agenc-morning-sync
description: >
  Run this skill at the start of every session in the AgenC workspace.
  Triggers on phrases like "good morning", "let's get started", "morning sync",
  "sync the repos", "check for upstream changes", or any session opener.
  Fetches upstream changes across all AgenC repos, syncs forks that have new
  commits, checks PR status, starts the Docker operator container, and reports
  a clean session-start summary. Always run this before doing any other work.
---

# AgenC Morning Sync Skill

Run at the start of every session to get the workspace fully up to date.

---

## Step 1 — Check upstream repos for new commits

```bash
for repo in AgenC agenc-sdk agenc-core agenc-protocol agenc-plugin-kit; do
  echo "=== $repo ==="
  git -C ~/workshop/agencproj/$repo fetch origin --quiet
  git -C ~/workshop/agencproj/$repo log --oneline --since="yesterday" origin/main \
    2>/dev/null || echo "no new commits"
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

## Step 5 — Start the Docker operator container

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

## Step 6 — Report session summary

Print a clean summary:

```
=== AgenC Session Start — YYYY-MM-DD ===

Repos synced:
  - agenc-core: N new commits
  - agenc-sdk: no changes
  ...

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
| Open PRs | `tetsuo-ai/agenc-core` #27 |
