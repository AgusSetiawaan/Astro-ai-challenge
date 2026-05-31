# StackSurgeon

Web tool for Android engineers: paste a crash → get an editable Jira ticket in seconds.

**Live demo:** _add link after first Vercel deploy_

## What it does

- Accepts logcat / Crashlytics / Play Vitals dumps; auto-detects format.
- Deobfuscates frames using a ProGuard `mapping.txt` you drag in (parsed entirely in your browser; never uploaded).
- Sends only the deobfuscated stack to DeepSeek `deepseek-v4-flash` for a plain-English narrative + structured ticket draft.
- Lets you edit the draft inline.
- Files it as a Jira Cloud ticket via a same-origin proxy (you provide Jira API token + project key in Settings).

## Privacy

| Data | Crosses to |
|---|---|
| `mapping.txt` | Nowhere — parsed in a Web Worker in your tab |
| Stacktrace + snippet | DeepSeek (servers in China), via our same-origin proxy |
| Jira token | Atlassian (your Jira instance), via our same-origin proxy |
| Anything | We do not log request bodies on `/api/llm` or `/api/jira` |

See `/privacy` in-app for the full statement.

## BYOK

- The free demo uses our shared DeepSeek key, rate-limited to 20 calls/hour per IP.
- Add your own DeepSeek key in Settings to bypass the rate limit (you pay your own quota).

## Self-host

```bash
git clone <repo-url> stacksurgeon && cd stacksurgeon
cp .env.example .env.local && $EDITOR .env.local   # paste your DEEPSEEK_API_KEY
pnpm install
pnpm dev
```

Deploy to Vercel (or any Node host that supports SSE):

```bash
vercel
```

Set `DEEPSEEK_API_KEY` in the Vercel project's env vars.

## Known limitations

- Rate limit is in-memory per serverless instance — multi-replica deployments allow more total calls than the per-IP budget suggests.
- Prompt-injection mitigation is best-effort (`<crash_data>` tags + system instruction).
- Jira Cloud only — no Server / Data Center.
- Mapping files larger than 100 MB are rejected; run `proguard-retrace` locally first.

## Stack

Astro 5, React 18, TailwindCSS, Zustand, Vitest, Playwright, `openai` SDK pointed at DeepSeek.

## Design + plan

- Spec: `docs/superpowers/specs/2026-05-31-crash-ticket-factory-design.md`
- Plan: `docs/superpowers/plans/2026-05-31-crash-ticket-factory.md`
