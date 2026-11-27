import { expect, test } from '@playwright/test';

test('complete E2E B2B workflow across desktop and mobile viewports', async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}@ekiddy-test.example`;

  // 1. Landing page URL hero -> Register
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Enter your website/i })).toBeVisible();
  await page.getByPlaceholder(/Enter your company website/i).fill('https://example.com');
  await page.getByRole('button', { name: /Analyze Company & Start/i }).click();

  // 2. Register with pre-filled website URL
  await expect(page).toHaveURL(/\/register/);
  await page.getByLabel('Full Name').fill('E2E Operator');
  await page.getByLabel('Work Email').fill(uniqueEmail);
  await page.getByLabel('Organization Name').fill('E2E Revenue Org');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: /Create Workspace/i }).click();

  // 3. Onboarding Steps 1 -> 8
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByRole('button', { name: /Start AI Company Research/i }).click();
  await expect(page.getByText(/Step 3: Review Your AI Company Profile/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Save & Discover Competitors/i }).click();
  await expect(page.getByText(/Step 4: Discovered Competitors/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Generate Target ICPs/i }).click();
  await expect(page.getByText(/Step 5: Ideal Customer Profiles/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Preview Suggested Campaign/i }).click();
  await page.getByRole('button', { name: /Continue to Review/i }).click();
  await page.getByRole('button', { name: /Approve & Create Draft Campaign/i }).click();
  await expect(page.getByText(/workspace is ready/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Enter Main Dashboard/i }).click();
  await expect(page).toHaveURL(/\/app$/);

  // 4. People Search
  await page.getByRole('link', { name: /People Search/i }).click();
  await expect(page).toHaveURL(/\/app\/people/);
  await page.getByRole('button', { name: /Search \(2 cr\)/i }).click();
  await expect(page.getByText('Maya Lin')).toBeVisible({ timeout: 15_000 });

  // 5. AI Email Writer
  await page.getByRole('link', { name: /AI Email Writer/i }).click();
  await expect(page).toHaveURL(/\/app\/email-writer/);
  await page.getByRole('button', { name: /Generate Email/i }).click();
  await expect(page.getByLabel('Subject Line')).not.toHaveValue('', { timeout: 15_000 });

  // 6. AI Inbox simulation & classification
  await page.getByRole('link', { name: /AI Inbox/i }).click();
  await expect(page).toHaveURL(/\/app\/inbox/);
  await page.getByRole('button', { name: /Simulate Inbound Reply/i }).click();
  await page.getByRole('button', { name: /Ingest & Classify/i }).click();
  await expect(page.getByText(/Meeting request/i).first()).toBeVisible({ timeout: 15_000 });

  // 7. Credits & Billing Razorpay Test Mode Checkout
  await page.getByRole('link', { name: /Credits & Billing/i }).click();
  await expect(page).toHaveURL(/\/app\/billing/);
  await page.getByRole('button', { name: /Buy Pack/i }).first().click();
  await page.getByRole('button', { name: /Complete HMAC-Signed Test Payment/i }).click();
  await expect(page.getByText(/Purchased 500 Credits Pack/i).first()).toBeVisible({ timeout: 15_000 });

  // 8. Theme toggle & Mobile responsiveness
  await page.getByRole('button', { name: /Toggle color theme/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: /Open menu/i })).toBeVisible();
});
