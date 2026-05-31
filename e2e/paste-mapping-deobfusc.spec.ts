import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('mapping deobfuscates frames before analysis', async ({ page }) => {
  await page.goto('/');
  const obfuscated = `Fatal Exception: java.lang.NullPointerException: x
       at a.b.c.a(MainActivity.kt:1)`;
  await page.getByPlaceholder('Paste logcat / Crashlytics / Vitals dump here').fill(obfuscated);
  await page.getByRole('button', { name: 'mapping' }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(resolve(__dirname, '../public/fixtures/sample-mapping.txt'));
  await expect(page.getByText(/Parsed \d+ classes/)).toBeVisible();
  await page.getByRole('button', { name: 'stack' }).click();
  await page.route('**/api/llm', (route) => route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: 'data: [DONE]\n\n',
  }));
  await page.getByRole('button', { name: /Analyze/ }).click();
  await expect(page.locator('li', { hasText: 'com.example.app.MainActivity' })).toBeVisible();
});
