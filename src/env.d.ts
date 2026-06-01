/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DEEPSEEK_API_KEY: string;
  readonly DEEPSEEK_BASE_URL?: string;
  readonly RATE_LIMIT_PER_HOUR?: string;
  readonly RATE_LIMIT_MAX_PAYLOAD_BYTES?: string;
  readonly ALLOWED_JIRA_HOST_REGEX?: string;
  readonly ALLOWED_PROJECT_ROOTS?: string;
  readonly SENTRY_DSN?: string;
  /** Set to "vercel" on the Vercel-deployed build. Drives feature gating. */
  readonly PUBLIC_DEPLOY_TARGET?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
