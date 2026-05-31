import { test, expect } from '@playwright/test';

test('sample crash button populates inputs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample crash' }).click();
  await expect(page.getByPlaceholder('Paste logcat / Crashlytics / Vitals dump here')).toContainText('NullPointerException');
});
