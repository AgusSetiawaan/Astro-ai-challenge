# StackSurgeon

Web tool for Android engineers: paste a crash → get an editable Jira ticket in seconds.

**Local-only.** The LLM backend shells out to your locally-installed `claude` CLI, so this tool only runs on a machine where Claude Code is logged in (Max plan, Pro, or Anthropic API key — whichever the local CLI is authed against).

## Summary

### Project name

**StackSurgeon** — a local-first web tool for Android engineers that turns a pasted crash dump into a reviewable Jira ticket and (optionally) an attempted source-code fix on a new git branch.

### What problem does it solve?

Android crash triage is repetitive, slow, and error-prone:

- **Reading obfuscated stacks** — hardest part. R8/ProGuard names hide intent; framework noise drowns the app frame.
- **Writing tickets** — every crash gets the same boilerplate: title, severity, suspected cause, repro steps.
- **Acting on it** — even after triage, someone still has to open the repo, find the file, and attempt a fix.

StackSurgeon collapses that loop into **paste → Analyze → File-to-Jira and/or Try-Fix in your repo**, in under a few minutes per crash.

### How it works (AI platform + flow)

**AI platform:** Local `claude` CLI subprocess (Claude Code), authenticated against whatever account is logged in (typically Max plan or Anthropic API key). All LLM work goes through `claude --print --output-format=stream-json`. No API keys in browser; bills against the local Claude session. Two modes:

- **Ticket draft (`/api/llm`)** — tools disabled. Claude returns one JSON object: `title, severity, labels, summary, suspectedCause, reproGuess, confidence`.
- **Fix attempt (`/api/fix`)** — tools enabled (`Read`, `Grep`, `Glob`, `Edit`, `Bash`), `cwd` = your connected Android project, branch checked out first. Claude creates `stacksurgeon/fix-<id>`, investigates the repo, edits one file, leaves diff in working tree, ends with a JSON summary `{branch, filesChanged, diffSummary, summary, confidence}`.

**Flow:**

```
Browser (React island, Zustand store)
  │
  ├─ paste crash (logcat / Crashlytics / Play Vitals) → auto-detect format
  ├─ drag in mapping.txt → parsed in Web Worker (never uploaded)
  ├─ optional code snippet
  │
  ├─► Analyze ▶
  │     parse → deobfuscate → classify frames (app/framework/os/coroutine/native)
  │     /api/llm → spawn claude (text-only) → SSE stream → incremental JSON parse
  │     ticket draft populates right pane (editable)
  │     auto-saved to history (localStorage)
  │
  ├─► File to Jira → /api/jira proxy (SSRF-guarded) → Atlassian
  │
  └─► Try Fix in connected project
        FixDrawer: pick project + base branch (dropdowns from /api/project-branches)
        Run → /api/fix → projectGuard (path under ALLOWED_PROJECT_ROOTS, clean tree)
              → git checkout <base> → spawn claude (cwd=project, tools enabled)
              → SSE stream of {text|tool_use|tool_result|final|error}
              → live log in drawer → final diff summary
              → review with `cd <project> && git checkout stacksurgeon/fix-<id>`
```

### Prompt to build this project

> "I want to create a tool-based AI, web-based, that can help me with my daily work. I'm an Android engineer. Identify a real problem in my day-to-day workflow that's repetitive, slow, or error-prone, then build a working web tool with a clear intent. The tool must produce an output beyond a text answer (file, ticket, diff, etc.), and be mindful of data privacy."

That single brainstorm prompt drove the whole sequence: pick the problem (crash → ticket factory) from a list of Android dev pain points → settle on architecture (Astro hybrid + local Claude CLI for LLM, browser-only for mapping.txt, Jira proxy via SSR endpoint) → write design spec → implementation plan → execute via subagent-driven development (33 plan tasks + several follow-up feature requests). History (per-entry actions), Try Fix mode (agentic Claude with project access, branch + diff, safety guards), and UX polish (auto-clear on re-analyze, drift detection, spinners) were added iteratively while using the tool.

Source: `docs/superpowers/specs/2026-05-31-crash-ticket-factory-design.md` and `docs/superpowers/plans/2026-05-31-crash-ticket-factory.md`.

## What it does

- Accepts logcat / Crashlytics / Play Vitals dumps; auto-detects format.
- Deobfuscates frames using a ProGuard `mapping.txt` you drag in (parsed entirely in your browser; never uploaded).
- Sends only the deobfuscated stack to Claude (via the local `claude` CLI subprocess, `--print --output-format=stream-json`) for a plain-English narrative + structured ticket draft.
- Lets you edit the draft inline.
- Files it as a Jira Cloud ticket via a same-origin proxy (you provide Jira API token + project key in Settings).
- **Try Fix:** if you connect one of your Android repos in Settings, click **Try Fix in connected project** to have Claude branch off the chosen base branch (`main` by default), make a minimal edit attempt, and surface the result for you to review. No commits, no PR — branch + diff only.

## Privacy

| Data | Crosses to |
|---|---|
| `mapping.txt` | Nowhere — parsed in a Web Worker in your tab |
| Stacktrace + snippet | Anthropic (Claude API), via local `claude` CLI subprocess |
| Jira token | Atlassian (your Jira instance), via our same-origin Astro proxy |
| Anything | We do not log request bodies on `/api/llm` or `/api/jira` |

See `/privacy` in-app for the full statement.

## Prerequisites

- Node 20+, `pnpm`
- `claude` CLI installed and logged in (`claude login`). Verify with `claude --version`.

## Run locally

```bash
git clone <repo-url> stacksurgeon && cd stacksurgeon
pnpm install
pnpm dev
```

Open http://localhost:4321/. Click **Try sample crash** → **Analyze ▶** to see the end-to-end flow.

## Configure Try Fix (optional)

1. Set `ALLOWED_PROJECT_ROOTS` in `.env.local` to a `:`-separated list of absolute path prefixes you trust (default = `$HOME`).
2. In the app, open **Settings → Connected projects** and either paste your Android repo's absolute path or click **Find Android projects** to scan common dev directories.
3. Each project must have a clean working tree (stash or commit uncommitted work first).
4. After Analyze, click **Try Fix in connected project**. Pick the project + base branch in the drawer; click **Run**. Claude streams its tool calls, then leaves you a new branch named `stacksurgeon/fix-<id>` on disk for review.

## Configure Jira (optional)

Open **Settings** in the top bar and paste:
- Jira base URL (e.g. `https://acme.atlassian.net`)
- Email
- API token (create at id.atlassian.com)
- Project key (e.g. `ANDROID`)

Stored in browser localStorage or sessionStorage (your choice).

## Why not deploy to Vercel?

The LLM backend requires a `claude` CLI binary plus an interactive login session on the host. Serverless runtimes can't satisfy either. To make this deployable you'd need to either ship an Anthropic API key as an env var and rewrite `src/server/claudeCli.ts` to call the HTTP API directly, or run the app on a long-lived host (Fly machine, Hetzner box) with `claude login` performed once.

## Known limitations

- Rate limit is in-memory; restarting `pnpm dev` resets it.
- Prompt-injection mitigation is best-effort (`<crash_data>` tags + system instruction).
- Jira Cloud only — no Server / Data Center.
- Mapping files larger than 100 MB are rejected; run `proguard-retrace` locally first.
- Each `claude --print` call carries the session-startup overhead of your local Claude Code config (hooks, plugins). Budget ~5–10s and ~$0.04 per analyze.

## Stack

Astro 5, React 18, TailwindCSS, Zustand, Vitest, Playwright. Server proxy spawns `claude` for LLM; same-origin proxy for Jira REST.

## Design + plan

- Spec: `docs/superpowers/specs/2026-05-31-crash-ticket-factory-design.md`
- Plan: `docs/superpowers/plans/2026-05-31-crash-ticket-factory.md`
