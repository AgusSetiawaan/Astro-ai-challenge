/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DEEPSEEK_API_KEY: string;
  readonly DEEPSEEK_BASE_URL?: string;
  readonly RATE_LIMIT_PER_HOUR?: string;
  readonly RATE_LIMIT_MAX_PAYLOAD_BYTES?: string;
  readonly ALLOWED_JIRA_HOST_REGEX?: string;
  readonly ALLOWED_PROJECT_ROOTS?: string;
  readonly SENTRY_DSN?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
