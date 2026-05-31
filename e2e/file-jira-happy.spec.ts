import { test, expect } from '@playwright/test';

test('file to Jira happy path', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('jira', JSON.stringify({
      baseUrl: 'https://acme.atlassian.net', email: 'a@b.c', token: 't', projectKey: 'ANDROID',
    }));
  });

  await page.route('**/api/llm', (route) => route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: 'data: {"delta":"{\\"narrative\\":\\"n\\",\\"title\\":\\"t\\",\\"severity\\":\\"sev2\\",\\"labels\\":[\\"a\\"],\\"summary\\":\\"s\\",\\"suspectedCause\\":\\"c\\",\\"reproGuess\\":\\"r\\",\\"confidence\\":\\"med\\"}"}\n\ndata: [DONE]\n\n',
  }));
  await page.route('**/api/jira', (route) => route.fulfill({
    status: 201, contentType: 'application/json',
    body: JSON.stringify({ key: 'ANDROID-7', self: 'https://acme.atlassian.net/rest/api/3/issue/10001' }),
  }));

  await page.getByRole('button', { name: 'Try sample crash' }).click();
  await page.getByRole('button', { name: /Analyze/ }).click();
  await page.getByRole('button', { name: /File to Jira/ }).click();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(page.getByText('Filed:')).toContainText('ANDROID-7');
});
