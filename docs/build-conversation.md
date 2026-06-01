# StackSurgeon — The Conversation That Built It

A condensed transcript of the multi-turn dialogue between the user (an Android engineer at Astro) and Claude that produced this project end-to-end. Paraphrased and trimmed; each step shows the **prompt**, what was **decided**, and what **changed** in the codebase.

---

## Phase 1 — Brainstorming the idea

### Turn 1 · pick a problem worth solving

**User:**
> I'm an Android engineer. I want to create a tool-based AI, web-based, that can help me with my daily work. Give me ideas for what to build. Could be job-related or not.

**Claude:** proposed 8 ideas split between Android-focused (Crash/Stacktrace Triage, PR Description Generator, XML↔Compose Converter, Play Store Review Triage, Gradle Doctor, strings.xml localizer) and general (Standup Composer, Spec→Task Breakdown).

**User:** *(rejected first multiple-choice — wanted more criteria first)*
> Give me other ideas. Requirements: real, repetitive/slow/error-prone problem; web-based with working HTML; output must be **beyond a text answer** (file, image, structured data); mindful of data privacy.

**Claude:** re-pitched 9 candidates biased toward tangible artifacts (APK Size Diff Visualizer, Release Notes Composer, Crash→Ticket Factory, Screenshot Bug Annotator, strings.xml Audit, Gradle Migrator, Receipt→Expense, Meeting→Action Pack, Email Triage). Recommended top 3.

**User picked:** Crash → Ticket Factory.

---

## Phase 2 — Design clarification

A series of **single-question multiple-choice** clarifications:

| Question | User's pick | Why it mattered |
|---|---|---|
| Where do your crashes come from? | Crashlytics + raw logcat + Play Vitals/ANR | Drives which 3 parsers to build |
| What burns the most time? | Reading & understanding the stack | Makes the middle pane the primary feature |
| Privacy posture? | Browser-only, BYOK to LLM | `mapping.txt` parsed in a Web Worker, never uploaded |
| Where do tickets land? | *(asked clarification first)* | — |
| Connected to Claude MCP — Jira via MCP? | *(turned into:)* Direct REST via Astro SSR proxy | Browser can't reach Atlassian directly (CORS); SSR proxy keeps token in browser |
| Astro SSR proxy approach? | Yes (chose over deep-link + REST direct) | Decided architecture |
| Who uses it? | Public demo / portfolio | Drove BYOK pattern + rate limit shape |
| LLM provider? | Shared key + strict rate limit (you pay) | (Later swapped — see Phase 5) |
| Optional source context? | Paste snippet | Cheap quality lift |

---

## Phase 3 — Architecture approaches

**Claude** proposed 3 UI shapes:
- **A.** Lean single-page (2–3 days, demo-friendly)
- **B.** Wizard flow (4 days, friendlier for newcomers)
- **C.** Workspace IDE-style three-pane (5–7 days, best portfolio shot)

Recommended **A** for assignment fit.

**User:** picked **C** (workspace IDE-style).

→ Claude walked through 7 design sections (architecture, UI, components, data flow, errors, testing, deployment), pausing after each for approval. User accepted all.

**Mid-design pivot:** when the LLM model was specified as `deepseek-chat`/`deepseek-reasoner`:

**User:** *(quoting note from DeepSeek docs)*
> "The model names deepseek-chat and deepseek-reasoner will be deprecated on 2026/07/24…"

**Claude:** updated to `deepseek-v4-flash` everywhere, saved a memory note so future sessions don't propose the deprecated names.

---

## Phase 4 — Spec → plan → execution

1. Claude wrote the full design spec to `docs/superpowers/specs/2026-05-31-crash-ticket-factory-design.md`.
2. Self-review caught two inconsistencies (single-call streaming vs parallel calls; missing per-module test cases) and fixed inline.
3. **User approved spec.**
4. Claude produced a 33-task implementation plan at `docs/superpowers/plans/2026-05-31-crash-ticket-factory.md`.
5. **User picked execution mode:** Subagent-Driven (recommended) — fresh subagent per task + spec review + code review.

**Claude flagged scope reality:**
> "33 tasks × 3 subagents ≈ 100 invocations ≈ 8–11 hours wall clock. Skill says continuous, but flagging upfront."

**User:** picked **Lean mode** — spec review every task, quality review only on UI/server/security/deploy tasks.

→ Execution happened in 6 batches (foundations, parsers, mapping/classify, prompt/ticket utils, Web Worker, rate limiter, DeepSeek client, API routes, client services, React UI, sample button, privacy page, e2e, CI, README, DoD verification). 37 commits.

---

## Phase 5 — Iterations & refinements

### 5.1 LLM provider swap (DeepSeek → Claude CLI)

**User:**
> Can we use Claude subscription for the LLM on StackSurgeon?

**Claude:** explained honestly — Max plan can't auth a Vercel serverless function. Two paths: (a) Anthropic API key (paid per-token, deploys fine); (b) local `claude` CLI subprocess via OAuth (free per Max allowance, **localhost only**).

**User:** picked local `claude` CLI subprocess.

→ Wrote `src/server/claudeAgentic.ts` — wait, *first* iteration: replaced DeepSeek client with simpler `src/server/claudeCli.ts` (tools disabled, text-only). Updated `/api/llm` + tests. README, privacy page, and SettingsModal updated to reflect localhost-only.

**Verified live:** sample crash analyzed end-to-end via real Claude in 12.5s.

### 5.2 "Page is blank"

**User:**
> Run pnpm dev and try it locally.

After it ran:

**User:**
> Page still blank. Fix it.

**Claude:** debugged in layers:
1. **Layer 1:** Found CSP `script-src 'self'` blocking all inline scripts → Astro hydration runtime never executed. Relaxed to `'self' 'unsafe-inline'`.
2. **Layer 2:** Found "Invalid hook call" — two React copies loaded (Vite `optimizeDeps` pre-bundle vs Astro SSR React). Added `resolve.dedupe: ['react', 'react-dom']` + `optimizeDeps.include` for React + JSX runtimes.
3. **Layer 3:** Switched `client:only="react"` → `client:load` (gives SSR fallback so even hydration failures still show content) + added dev-mode React Fast Refresh preamble.

Verified via Playwright probe: 0 console errors, button clicks fire.

### 5.3 Feature: history tab

**User:**
> Can you add history tab? View previous requests + view result, all with Copy MD / Download JSON / File to Jira buttons.

**Claude:** designed schema, implemented:
- `src/client/history.ts` — localStorage CRUD, 50-entry cap
- `src/components/workspace/HistoryDrawer.tsx` — right-side drawer
- Auto-save on successful Analyze; auto-update with `jiraResult` on successful File-to-Jira
- Per-entry: **Load** (restore to workspace) / **Copy MD** / **Download JSON** / **File to Jira** (or "Filed ✓") / **×** delete / top-level **Clear all**

Verified live: 0 console errors, drawer shows seeded entries.

### 5.4 Feature: clear-on-re-analyze

**User:**
> Clear previous analysis output on middle pane if user inputs new crash to analyze.

**Claude:** added `clearAnalysis` store action, called at top of `analyze()`. Preserves `inputs` + `deobfMap`; wipes parsed/classified/buffer/ticketDraft/dirtyFields/jiraResult/errorMessage.

Verified live: re-Analyze with different crash shows new title immediately, prior output gone.

---

## Phase 6 — Try Fix mode (plan mode)

### 6.1 The question that opened the plan

**User:**
> If StackSurgeon connected with Claude CLI, can this trigger fixing on the project if I connect my project?

**Claude (plan mode):** yes, technically — current `claudeCli.ts` hardcodes `--disallowedTools` for all file ops; unlocking selectively + setting `cwd` to the user's repo + a new prompt = fix-attempt mode.

Asked two design knobs upfront:

| Question | User picked |
|---|---|
| Safety mode? | Branch + diff (Claude works on new branch, no commits) |
| Trigger UI? | New "Try Fix" button next to "File to Jira" |

### 6.2 Iteration: project discovery

**User:**
> How do you know what project I want to connect with StackSurgeon?

**Claude:** updated plan with explicit answer:
1. Register projects once in Settings (paste path **or** "Find Android projects" auto-scan)
2. Stored in localStorage `stacksurgeon.projects`
3. Per-crash auto-suggest by matching the crash's top-frame package to `applicationId`/`namespace` in `app/build.gradle.kts`
4. Server-side allowlist via `ALLOWED_PROJECT_ROOTS` env (default `$HOME`)

### 6.3 Iteration: base branch

**User:**
> Before I input the project, do I need to reset the branch into the targeted branch first? Or can we choose branch from StackSurgeon?

**Claude:** updated plan — base branch is a dropdown in FixDrawer:
1. Server hits `git branch --list` + `git symbolic-ref` to fetch all local branches + `origin/HEAD` default
2. UI pre-selects in order: `origin/HEAD` → `main` → `master` → `develop` → current
3. Server runs `git checkout <base>` before Claude starts. No terminal pre-step needed.

→ Plan approved, exited plan mode, executed in 6 batches (server libs, claudeAgentic, API routes, client services, UI, env+docs). 6 commits.

---

## Phase 7 — Bug-fix iterations after going live

### 7.1 "Button can't be clicked"

**User:**
> Why button "Try Fix in connected project" can't be clicked / have no actions?

**Claude:** found root cause — `Actions.tsx` read `projectStore.list().length` once in `useEffect([])`, never re-checked after Settings → Save. Made `projectStore` publish change events; `Actions.tsx` subscribes on mount, re-reads on every add/remove/clear. Verified via Playwright that the button enables immediately after Settings save with no page reload.

### 7.2 "Working tree is dirty" rejecting untracked-only repos

**User:** *(pasted error)*
> "working tree is dirty — commit, stash, or discard before fix mode: ?? .mcp.json ?? SPEC.md ?? docs/…"

**Claude:** found two bugs:
1. `/api/project-branches` was using the strict `validateProject` (dirty check included) → branches couldn't even load
2. `validateProject` refused on ANY `git status --porcelain` output, including untracked `??` (harmless for `git checkout`)

Split into two guards: `validatePath` (light, for read-only ops) and `validateProject` (heavy, only refuses tracked-file modifications). Tests updated.

### 7.3 Shell metacharacter in git command

**User:** *(pasted error)*
> "/bin/sh: -c: line 0: syntax error near unexpected token `(` … `git -C … branch --list --format=%(refname:short)`"

**Claude:** quoted the format token (`'%(refname:short)'`) so the shell doesn't try to subshell-expand `(...)`. Also stripped the `* ` / `+ ` current-branch leader from each line. Verified live: 859 branches now return.

### 7.4 "Run does nothing"

**User:**
> When I click Run button on Try Fix, there is no action.

**Claude:** Playwright probe showed Run **was** firing (POST /api/fix, phase → `fixing`), and Claude was running tool calls (`git checkout -b stacksurgeon/fix-…`, then `Glob`/`Grep`). Real issue: log area stayed visually blank for ~30s while Claude initialized → looked frozen. Added spinner + "Starting `claude` in <project>… first event in 5–20s" indicator.

### 7.5 "Fix used the wrong context"

**User:**
> The context when fixing is false. The last prompt context is NullPointer in MainActivity, but in StackSurgeon I inputted "Fix InvalidProtocolBufferException in DataStore preferences on init".

**Claude:** root cause was that editing the ticket title doesn't update the underlying `deobfCrash`/`classified` data sent to Fix. If user pasted a new stack but skipped Analyze, Fix used stale data.

Two safeguards:
1. **Crash to fix** panel at top of FixDrawer shows the actual exception + message + top frame — user can verify *before* clicking Run.
2. Store snapshots `analyzedStackText` per Analyze. FixDrawer compares to current `stackText`; if they differ → amber banner + Run button disabled until re-Analyze.

### 7.6 Astro dev toolbar collision

**User:**
> Disable Astro dev toolbar in StackSurgeon.

**Claude:** added `devToolbar: { enabled: false }` to `astro.config.mjs`. Verified `astro-dev-toolbar` markup count = 0 in served HTML.

---

## Phase 8 — Polish

### 8.1 History changes summary

**User:**
> Show changes summary on history in every crash that already fixed.

**Claude:** added `FixResultPanel` to each history entry — collapsed shows one-line outcome, expanded shows branch + confidence + files changed list + diffSummary + "Copy checkout cmd" button.

### 8.2 README summary

**User:** asked for a summary block (Project Name / Problem / How it works / Prompt that drove the build).

**Claude:** wrote it, then on follow-up:

**User:**
> Add this on README.md.

→ Claude inserted it as a top-level **Summary** section above the existing detailed docs.

### 8.3 Stakeholder one-pager

**User:**
> Can I have an HTML file for this project to present / upload for lead / stakeholder?

**Claude:** wrote `docs/presentation.html` — single self-contained 9.6 KB HTML file with dark theme, problem statement, architecture flow diagram, artifact table, privacy posture, original brainstorm prompt, try-it commands. Email-attachable, no external deps.

---

## Patterns that worked

- **Single-question multiple-choice clarifications** during design beat open-ended back-and-forth. Kept iteration tight.
- **Section-by-section design approval** (architecture → UI → components → data flow → errors → testing → deployment) caught two real inconsistencies before any code was written.
- **Subagent-driven execution with lean review** (spec review every task; quality review only on UI/server/security) hit a reasonable cost/quality balance for a 33-task plan.
- **Live verification via Playwright probes** after every batch surfaced real UX bugs (blank page, dev-toolbar collision, stale fix context) that tests alone missed.
- **Memory notes** for cross-session reference (Astro 5 hybrid removal, DeepSeek deprecation dates, test-file routing quirk) prevented re-discovering the same constraints later.

## What I would do differently

- Validate `claude` CLI session-startup cost (~$0.04/call from hook context) **before** committing to it as the LLM backend. Would have nudged toward shorter-prompt Anthropic API for shared-demo mode.
- Add `pnpm test:ui-smoke` as a Playwright npm script earlier — running probes one-off via inline scripts was lossy.
- Split `claudeCli.ts` and `claudeAgentic.ts` into a shared helper from day one. Right now both wrappers duplicate ~30 lines of subprocess + line-parsing glue.

---

*See `README.md` for setup, `docs/superpowers/specs/2026-05-31-crash-ticket-factory-design.md` for the full design, `docs/superpowers/plans/2026-05-31-crash-ticket-factory.md` for the original 33-task execution plan, and `docs/presentation.html` for the stakeholder one-pager.*
