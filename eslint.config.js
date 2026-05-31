// Minimal ESLint 9 flat config. Expand as the codebase grows.
export default [
  {
    ignores: ['node_modules/', 'dist/', '.astro/', 'coverage/', 'playwright-report/', 'test-results/'],
  },
  {
    // TS files linted via tsc (npm run typecheck). Add typescript-eslint here
    // when introducing actual code rules; current config exists so `npm run lint`
    // does not bomb in CI.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
