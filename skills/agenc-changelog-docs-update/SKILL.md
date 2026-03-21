---
name: agenc-changelog-docs-update
description: >
  Use this skill when working in the agenc-local-dev repo and the user wants to:
  - read commits on a branch and generate or update a CHANGELOG
  - update the RUNBOOK.md with changes reflected in recent commits
  - update the README.md with changes reflected in recent commits
  - do any combination of the above after making changes to the repo
  Trigger on phrases like "update the changelog", "document these changes",
  "update the docs with what we did", "write up the changelog", or any time
  commits have been made and documentation should reflect them.
---

# AgenC Changelog and Docs Update Skill

This skill reads git commits on a branch, generates CHANGELOG entries, and
updates RUNBOOK.md and README.md to reflect what changed.

---

## When To Use

After making commits to `agenc-local-dev` (or any branch), use this skill to:
1. Append new entries to `CHANGELOG.md`
2. Update relevant sections of `docs/RUNBOOK.md`
3. Update relevant sections of `README.md`

---

## Step 1 — Read the commits

First establish what branch we're on and what commits to document:

```bash
cd ~/workshop/agencproj/agenc-local-dev

# Current branch
git branch --show-current

# Commits on this branch not yet in main
git log main..HEAD --oneline

# If on main or no divergence, show recent commits since last tag or date
git log --oneline --since="7 days ago"
```

Ask the user to confirm the commit range if unclear:
- "Should I document all commits since main diverged, or just the most recent ones?"

---

## Step 2 — Read each commit in detail

For each commit in scope:

```bash
# Full details for each commit hash
git show --stat <HASH>
git show <HASH> --format="%H%n%s%n%b%n%cd" --date=short -- . | head -40
```

Extract for each commit:
- **Date** — `%cd` short format
- **Subject** — `%s` (the first line)
- **Body** — `%b` (additional detail if present)
- **Files changed** — from `--stat`
- **Type** — infer from conventional commit prefix: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

---

## Step 3 — Generate CHANGELOG entries

Read the existing CHANGELOG if it exists:

```bash
cat ~/workshop/agencproj/agenc-local-dev/CHANGELOG.md 2>/dev/null || echo "No CHANGELOG yet"
```

Format new entries using **Keep a Changelog** style (https://keepachangelog.com):

```markdown
## [Unreleased]

### Added
- feat commits go here

### Fixed
- fix commits go here

### Changed
- refactor/chore commits that change behavior go here

### Documentation
- docs commits go here
```

Rules:
- Group by type — Added, Fixed, Changed, Documentation, Removed
- Each entry is one line, past tense, describes the user-facing change
- Skip pure chore commits (dependency bumps, CI tweaks) unless significant
- Date format: YYYY-MM-DD
- If a version tag exists on HEAD, use that version; otherwise use `[Unreleased]`

Write the updated CHANGELOG:

```bash
# Prepend new section to existing CHANGELOG or create new file
```

---

## Step 4 — Update RUNBOOK.md

Read the current runbook:

```bash
cat ~/workshop/agencproj/agenc-local-dev/docs/RUNBOOK.md
```

For each commit, identify which section of the RUNBOOK is affected:

| Commit type | Likely RUNBOOK section |
|---|---|
| Dockerfile changes | Operator Instance → Build the image |
| docker-compose changes | Operator Instance → Run the container |
| agenc-start.sh changes | Operator Instance → First-time setup |
| New known issue | Known Issues section |
| Bug fix for known issue | Remove or update Known Issues entry |
| New env var | .env / docker-compose sections |
| config changes | Config section |

Update only the affected sections — do not rewrite the whole document.
Preserve all existing content that is still accurate.

---

## Step 5 — Update README.md

Read the current README:

```bash
cat ~/workshop/agencproj/agenc-local-dev/README.md
```

README sections that commonly need updating after commits:

| What changed | README section |
|---|---|
| New requirement added | Requirements table |
| Quick start steps changed | Quick Start section |
| New env var | Step 2 (.env) |
| docker-compose changes | Step 3/4 |
| New known issue | Known Issues section |
| Issue resolved | Remove from Known Issues |
| New AgenC repo added | AgenC Ecosystem table |

Keep README concise — it is a quick-start guide, not a full reference.
For detail, direct users to RUNBOOK.md.

---

## Step 6 — Write the files

Write all three files:

```bash
# CHANGELOG
cat > ~/workshop/agencproj/agenc-local-dev/CHANGELOG.md << 'EOF'
<updated content>
EOF

# RUNBOOK (only changed sections — use str_replace pattern)

# README (only changed sections — use str_replace pattern)
```

Prefer surgical edits over full rewrites. Only touch sections that need updating.

---

## Step 7 — Stage and confirm

Show a summary of what changed:

```bash
cd ~/workshop/agencproj/agenc-local-dev
git diff --stat
```

Present a brief summary to the user:
- "Updated CHANGELOG with N entries"
- "Updated RUNBOOK: [list sections changed]"
- "Updated README: [list sections changed]"

Ask: "Does this look right? Should I commit these documentation updates?"

If confirmed:

```bash
git add CHANGELOG.md docs/RUNBOOK.md README.md
git commit -m "docs: update changelog and docs for recent changes"
```

---

## Output Format

Always produce:
- A CHANGELOG entry (even if just one line)
- At minimum a note about which RUNBOOK/README sections were checked
- A confirmation before committing

---

## Notes

- Conventional commit prefixes: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, `ci`
- If commits don't follow conventional format, infer type from the message content
- For merge commits, look at the constituent commits not the merge commit itself
- The `agenc-start.sh` script content changes are high-value — always document them
- Docker-related changes should always update both README quick start and RUNBOOK
