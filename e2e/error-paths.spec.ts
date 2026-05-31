import { test, expect } from '@playwright/test';

test('LLM 429 surfaces error', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/llm', (route) => route.fulfill({ status: 429, body: '{"error":"rate_limited"}' }));
  await page.getByRole('button', { name: 'Try sample crash' }).click();
  await page.getByRole('button', { name: /Analyze/ }).click();
  await expect(page.getByText(/LLM error: 429/)).toBeVisible();
});
