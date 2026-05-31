import { test, expect } from '@playwright/test';

const SSE = [
  'data: {"delta":"{\\"narrative\\":\\"NPE in MainActivity onResume\\","}\n\n',
  'data: {"delta":"\\"title\\":\\"NPE in MainActivity\\",\\"severity\\":\\"sev2\\",\\"labels\\":[\\"crash\\",\\"android\\"],\\"summary\\":\\"NPE\\",\\"suspectedCause\\":\\"user is null\\",\\"reproGuess\\":\\"open app\\",\\"confidence\\":\\"med\\"}"}\n\n',
  'data: [DONE]\n\n',
].join('');

test('paste -> analyze -> edit title -> copy MD', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/llm', (route) => route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: SSE,
  }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample crash' }).click();
  await page.getByRole('button', { name: /Analyze/ }).click();

  const titleInput = page.getByLabel('Title');
  await expect(titleInput).toHaveValue('NPE in MainActivity');
  await titleInput.fill('Tweaked title');
  await page.getByRole('button', { name: 'Copy MD' }).click();

  const clipboard: string = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('# Tweaked title');
});
