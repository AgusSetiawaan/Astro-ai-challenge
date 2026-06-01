# StackSurgeon

Web tool for Android engineers: paste a crash → get an editable Jira ticket in seconds.

**Local-only.** The LLM backend shells out to your locally-installed `claude` CLI, so this tool only runs on a machine where Claude Code is logged in (Max plan, Pro, or Anthropic API key — whichever the local CLI is authed against).

## What it does

- Accepts logcat / Crashlytics / Play Vitals dumps; auto-detects format.
- Deobfuscates frames using a ProGuard `mapping.txt` you drag in (parsed entirely in your browser; never uploaded).
- Sends only the deobfuscated stack to Claude (via the local `claude` CLI subprocess, `--print --output-format=stream-json`) for a plain-English narrative + structured ticket draft.
- Lets you edit the draft inline.
- Files it as a Jira Cloud ticket via a same-origin proxy (you provide Jira API token + project key in Settings).

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
