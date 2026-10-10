import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip intro' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  for (const d of '1234') { await page.getByRole('group', { name: /number pad/i }).last().getByRole('button', { name: d, exact: true }).click(); await page.waitForTimeout(280); }
  await expect(page.getByText(/DEMO MODE/)).toBeVisible();
}
const chip = (page: Page, name: string | RegExp) => page.getByRole('group', { name: 'Suggested answers' }).getByRole('button', { name });

test('Living Ads: empty → AI questions → blocked → fix → paused → explicit approval → live', async ({ page }) => {
  await login(page);
  // Empty state
  await expect(page.getByRole('heading', { name: 'Your campaigns' })).toBeVisible();
  await expect(page.getByText('No campaigns yet')).toBeVisible();

  // Goal → AI asks only what it still needs (venue, topic and objective are read from the goal)
  await page.getByLabel('Describe your goal in your own words').fill("I want to promote a children's retreat in Bali");
  await page.getByRole('button', { name: 'Start with the AI helper' }).click();
  await expect(page.getByRole('log').getByText(/already picked up what you're promoting: Children's Retreat, where it happens: Bali/)).toBeVisible();
  await chip(page, 'Parents of children aged 6–14').click();
  await chip(page, 'Mumbai, Delhi & Bengaluru').click();
  await chip(page, 'Start tomorrow · 14 days').click();
  await chip(page, '₹25,000').click();
  await chip(page, 'Early-bird 15% off').click();
  await chip(page, 'Add it later').click();
  // Social links: typed in plain words, turned into clickable icons
  await page.getByLabel('Reply to the AI helper').fill('insta @balikids, yt @balikidsretreat');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('log').getByText(/Your plan is ready/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open Instagram: @balikids/ }).first()).toHaveAttribute('href', 'https://www.instagram.com/balikids/');
  await expect(page.getByRole('link', { name: /Open YouTube: @balikidsretreat/ }).first()).toHaveAttribute('href', 'https://www.youtube.com/@balikidsretreat');

  // New campaign is paused; budget limit is visible; blocked because the image is missing
  await expect(page.getByRole('status', { name: 'Budget limit' })).toContainText('₹25,000');
  await expect(page.getByRole('status', { name: 'Budget limit' })).toContainText('Paused · ₹0 spent');
  await expect(page.locator('.phead .badge')).toHaveText(/Needs your input/);
  await expect(page.getByText(/Facebook and Instagram ads cannot run without one/).first()).toBeVisible();

  // Edits persist across a reload
  await page.getByLabel('Headline').fill('Bali kids retreat — early-bird 15% off');
  await page.reload();
  await expect(page.getByLabel('Headline')).toHaveValue('Bali kids retreat — early-bird 15% off');

  // Review: launch is locked while blocked
  await page.getByRole('button', { name: 'Review & approve' }).click();
  await expect(page.getByText(/Not ready to launch — 1 thing missing/)).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve & launch' })).toBeDisabled();
  await expect(page.getByRole('status', { name: 'Budget limit' })).toContainText('₹25,000');

  // Fix next to the step, then come back
  await page.getByRole('button', { name: 'Fix' }).first().click();
  await page.getByRole('button', { name: 'Use sample' }).click();
  await page.getByRole('button', { name: 'Review & approve' }).click();
  await expect(page.getByText('Everything needed is ready')).toBeVisible();
  await expect(page.locator('.phead .badge')).toHaveText(/Paused/);

  // Explicit approval is required
  const launch = page.getByRole('button', { name: 'Approve & launch' });
  await expect(launch).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(launch).toBeEnabled();
  await launch.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, launch now' }).click();
  await expect(page.locator('.phead .badge')).toHaveText(/Live/);
  await expect(page.getByText('How it’s doing')).toBeVisible();
  await expect(page.getByText(/spent of your/)).toContainText('₹25,000');

  // List shows the live campaign
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Campaigns' }).click();
  await expect(page.locator('.ccard.live')).toContainText("Children's Retreat · Bali");
});

test('Living Ads: example data shows empty, blocked and live states; other channels are coming soon', async ({ page }) => {
  await login(page);
  await page.goto('/#/about');
  await page.getByRole('button', { name: 'Load example campaigns' }).click();
  await expect(page.locator('.ccard.live')).toHaveCount(1);
  await expect(page.locator('.ccard.blocked')).toHaveCount(1);
  await expect(page.locator('.ccard.paused')).toHaveCount(1);
  await page.locator('.ccard.paused').click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Google Ads' }).first()).toContainText('Coming soon');
  await page.goto('/#/about');
  await page.getByRole('button', { name: /Clear all/ }).click();
  await expect(page.getByText('No campaigns yet')).toBeVisible();
});

test('Living Ads: Ad studio makes a food-style animated ad that needs no photo', async ({ page }) => {
  await login(page);
  await page.goto('/#/studio');
  await expect(page.locator('.adplayer')).toHaveCount(4);
  await page.locator('section', { hasText: 'Food slider' }).getByRole('button', { name: 'Make an ad like this' }).click();
  await expect(page.getByRole('group', { name: 'Ad style' }).getByRole('button', { name: 'Food slider' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Brand name on the ad')).toHaveValue('Freshify');
  await expect(page.locator('.ad-food').first()).toBeVisible();
  await chip(page, 'Parents 28–45').click();
  await chip(page, 'All of India').click();
  await chip(page, 'Start tomorrow · 30 days').click();
  await chip(page, '₹25,000').click();
  await chip(page, 'No offer').click();
  await chip(page, 'Use the animated ad only').click();
  await chip(page, 'Skip for now').click();
  await expect(page.locator('.phead .badge')).toHaveText(/Paused/);
  // Switching style keeps the brand name
  await page.getByRole('group', { name: 'Ad style' }).getByRole('button', { name: 'Music app story' }).click();
  await expect(page.locator('.ad-music').first()).toBeVisible();
  await expect(page.getByLabel('Brand name on the ad')).toHaveValue('Freshify');
});
