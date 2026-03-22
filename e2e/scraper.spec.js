import { test, expect } from '@playwright/test';

async function scrape(page, url) {
  await page.goto('/');
  await page.getByPlaceholder('https://example.com').fill(url);
  await page.getByRole('button', { name: 'Scrape' }).click();
}

test('iltalehti.fi - scrapes images from a real news page', async ({ page }) => {
  test.setTimeout(120_000);
  await scrape(page, 'https://www.iltalehti.fi');
  await expect(page.getByText(/\d+ images? found/)).toBeVisible({ timeout: 90_000 });
});

test('example.com - reports no images found', async ({ page }) => {
  await scrape(page, 'https://example.com');
  await expect(page.getByText('No images found on that page.')).toBeVisible({ timeout: 30_000 });
});

test('wikipedia Contract Bridge - scrapes images from a Wikipedia article', async ({ page }) => {
  test.setTimeout(60_000);
  await scrape(page, 'https://en.wikipedia.org/wiki/Contract_bridge');
  await expect(page.getByText(/\d+ images? found/)).toBeVisible({ timeout: 45_000 });
});

test('google.com/404 - shows error for a failing URL', async ({ page }) => {
  await scrape(page, 'https://www.google.com/404');
  await expect(page.getByText(/Error:/)).toBeVisible({ timeout: 30_000 });
});
