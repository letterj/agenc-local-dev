---
description: Read the AgenC project plan and produce a current-state summary with stale-item detection. Read-only — never edits the plan.
argument-hint: "[plan-path]  (default: ~/workshop/agencproj/agenc-local-dev/docs/PROJECT-PLAN-V2.md)"
---

# /agenc-plan-status

Read the project plan and give a current-state summary. This is the side-path planning command — used when you want to take stock of what's tracked before deciding what to add, move, or close.

## Resolve plan path
Use the first positional argument if provided, otherwise default to `~/workshop/agencproj/agenc-local-dev/docs/PROJECT-PLAN-V2.md`.

```bash
PLAN_PATH="${1:-$HOME/workshop/agencproj/agenc-local-dev/docs/PROJECT-PLAN-V2.md}"

if [ ! -f "$PLAN_PATH" ]; then
  echo '{"success": false, "error": "plan file not found", "path": "'$PLAN_PATH'"}'
  exit 1
fi

cat "$PLAN_PATH"
```

## Report

Produce a structured summary covering:

1. **Tasks grouped by track**, with status for each (done / in progress / blocked / not started). Include task numbers, titles, and any one-line context.
2. **Active blockers** — verbatim from the plan's blockers section if it has one.
3. **Open PRs and their states** — cross-reference with the most recent morning sync data if available in this session's context. If no morning sync was run today, note that and proceed with what the plan says.
4. **File metadata** — last-updated date stated in the plan, and date of last git commit to the file (run `git -C "$(dirname "$PLAN_PATH")" log -1 --format=%cd "$PLAN_PATH"` to confirm).
5. **Stale-item detection** — flag any item where:
   - Status references work that has since shipped, merged, or been superseded
   - Dates indicate the item has been blocked for a long stretch with no updates
   - Open PRs the plan tracks are now closed/merged
   - Repos or surfaces mentioned no longer match the org's current direction (e.g. work tracked against deprecated branches, deleted modules, or sunset features)

## Compare to recent context

Identify what's happened since the plan was last updated that is NOT yet reflected in the plan. Pull from:
- This session's recent activity (walkthroughs run, PRs filed, issues filed, observations made)
- Memory of recent sessions
- Today's morning sync output (new repos, new releases, new upstream pushes)
- Conversation history if relevant context exists

For each item, note it as **"to be added"** — describe what it is in 1-2 sentences. Do NOT add anything to the plan itself in this command. The decision about what makes the cut is for the human.

## Hard rules
- Read-only. Never edit the plan file.
- If the plan is missing or unreadable, return JSON error and stop — do not offer to create one in this command.
- Do not invent task statuses. If the plan lists a task with no status, report it as "status not stated" rather than guessing.
- Do not file issues or open PRs from this command.
- "Stale-item detection" must cite specific evidence (a date, a merged PR number, a deprecated module name) — do not flag items as stale on vibes.

## After reporting
Stop. The follow-up action (edit the plan, file an issue, mark something done) belongs in a separate explicit command or chat turn, not here.
