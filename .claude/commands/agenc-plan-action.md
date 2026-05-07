---
description: Build a structured action plan for a single task. Assumes /agenc-plan-status was just run in this session — uses the in-session plan summary as the source of truth. Read-only.
argument-hint: "[task-id-or-title]  e.g. 'Task 14' or 'dispute resolution flow'"
---

# /agenc-plan-action

Take a single task from the plan summary already in this session's context and produce an action plan. Output is for human review and editing — do not start executing without a separate approval turn.

## Source of truth

This command assumes the plan summary is already in the session — typically because `/agenc-plan-status` (or an equivalent read) ran earlier this turn or earlier this session. Do NOT re-read the plan file. Do NOT guess the plan path. Use what is in context.

If the plan summary is NOT in context, stop with one line: "No plan summary in session context — run /agenc-plan-status first, then re-invoke this command." Do not attempt to find or load the plan yourself.

## Resolve which task

If the user passed an argument, treat it as a task identifier (number, title, or partial title) and try to match against the in-context plan summary.

If no argument was provided, list the candidate tasks from the plan summary and ASK the user which one they want to plan against. Do not guess. Stop until they answer.

If the argument is ambiguous (matches multiple tasks), list the candidates and ask. Do not pick one silently.

## Read the task in full

Once the task is identified, pull together everything available about it from session context:

- The task's stated goal verbatim from the plan summary
- Its current status (done / in progress / blocked / not started)
- Any blockers noted
- Any prior session notes referencing the task (memory, conversation history)
- Any related PRs or issues already filed (cross-reference morning sync data if present in session)
- Any related working docs that have already been read into this session

If the task is already done or in progress, surface that immediately — do not produce an action plan for completed work without explicit user confirmation that they want to redo or extend it.

If you find references to working docs (e.g. issue#NNN.md) that exist on disk but haven't been loaded into this session, NOTE this in the output ("Working doc <path> exists per the plan but is not in session context — consider reading it before executing"). Do not autonomously read it as part of building the plan.

## Produce the action plan

Format the output as markdown with these sections in this order. Each section must be present even if briefly. If a section genuinely has nothing to say, write "None identified" rather than omitting the section.

### Describe the Task

A 2-4 sentence plain-English description of what the task is. Should be readable by someone who has not seen the project plan. Include the task identifier and title.

### Define the Goal

What "done" looks like, expressed as observable outcomes. Avoid vague success criteria like "improve X" — prefer concrete checks like "PR merged into upstream/main", "test suite passes with N new test cases", "specific transaction confirmed on-chain", "documented in CHANGELOG.md". Multiple criteria are fine if the task has multiple phases.

### Actions Step by Step

Numbered, sequential, executable steps. Each step is one concrete action (not a phase). Estimate complexity per step (S = under 30 min / M = 30 min to 2 hr / L = half-day or more). Mark gates where human approval is needed before proceeding (e.g. before any on-chain mutation, before any PR push, before any external service call).

Walk in this order:
1. Recon and prerequisite checks (does the env exist, is the branch clean, are needed services running)
2. Investigation or design (read source, design the change, verify assumptions)
3. Implementation
4. Testing
5. Documentation
6. Submission (PR, issue, deploy, whatever closes the task)

### Map Out External Dependencies

Anything outside the local repo that the task depends on. Be explicit:

- API keys or tokens required (which service, where it's configured, who has access)
- Funded wallets or accounts (which network, minimum balance, which keypair file)
- Network endpoints or RPCs that must be reachable
- Third-party services (registry endpoints, CDN, IPFS pin, etc.)
- People dependencies (waiting on a reviewer, waiting on a release, waiting on a meeting)
- Upstream changes that need to land first

For each, state whether it's currently satisfied. If not, what's the remediation step?

### Highlight Potential Problems

What could go wrong. For each, briefly describe the failure mode and the mitigation. Cover at minimum:

- Things that have failed in similar past work (pull from session memory and prior plan entries)
- Race conditions, concurrency, or ordering risks
- State mutations that are hard to undo (on-chain txs, file deletions, irreversible config changes)
- Cost risks (devnet vs mainnet SOL, service quotas, rate limits)
- Trust / safety risks (anything signing on behalf of the user, anything touching credentials)
- Gaps in observability (will we be able to tell if it succeeded? what's the readback?)

If a problem has a known prior issue or PR addressing it, cite it.

### Specify Tools and Platforms Required

Concrete list. For each, state version where it matters and whether it's already installed/configured:

- Languages and runtimes (node, rust, python, etc.)
- CLIs (solana, anchor, agenc-marketplace, npm, git, gh)
- IDE or editor extensions if the task relies on them
- Containers or sandboxes (Docker via Colima, podman)
- Browsers or browser automation
- Local services (LM Studio, Ollama, RPC node)
- External services (GitHub, Solana devnet, npm registry, custom registry)
- Specific files or keypairs that must be present

### Outline Testing

How the work will be verified. Cover:

- **Pre-change baseline** — what state to capture before starting (e.g. test suite pass/fail counts, current account balances, current task status)
- **Unit tests** — what to write, where they live
- **Integration tests** — what end-to-end flow to exercise
- **Regression check** — full test suite, typecheck, lint
- **Manual verification** — what to eyeball, screenshots if any, on-chain readbacks
- **Acceptance criteria** — the specific checks that gate "done"

If the task is investigation-only (no code change), substitute "Verification" for "Testing" and describe what evidence will confirm the investigation answered the question.

## Hard rules
- Read-only. This command produces a plan; it does not execute.
- Do NOT re-read the project plan file. Use what's already in session context.
- Do NOT autonomously load working docs, source files, or external URLs as part of building the plan. Note their existence and let the human decide whether to load them.
- Do not file issues, open PRs, sign transactions, run mutating CLI commands, or modify any file as part of producing the plan.
- Do not invent task content. If the in-context summary is sparse, the action plan should be sparse and flag the sparseness in "Describe the Task" — do not pad with assumed scope.
- If a section requires information that isn't available in session, write "Insufficient information — need: <specific question>" rather than fabricating.
- Do not skip sections. If "External Dependencies" is genuinely empty, write "None identified" so the human reading the plan can confirm that's accurate.

## After producing the plan
Stop. The decision to act on the plan, edit it, or shelve it is for the human. Offer one short closing line: "Ready to start? Approve and I'll work step 1." — do not begin executing.
