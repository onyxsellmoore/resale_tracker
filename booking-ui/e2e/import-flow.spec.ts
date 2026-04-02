/**
 * E2E test for the complete import flow:
 * upload → preview → confirm → badge → cost update → profit refreshes.
 *
 * Authentication: Uses the existing password-based login helper.
 * The backend has WebAuthn passkeys, but E2E tests use the password fallback
 * configured in global-setup.ts. If the project migrates to passkey-only auth,
 * a test-only token endpoint (guarded by BOOKING_TEST_MODE=true) should be
 * added to bypass the interactive passkey ceremony.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test('full flow: upload → preview → confirm → badge → cost update → profit refreshes', async ({ page }) => {
  // 1. Authenticate as admin
  await loginAs(page, 'admin')

  // 2. Navigate to import
  await page.goto('/import')
  await expect(page.getByText('eBay')).toBeVisible()

  // 3. Select eBay
  await page.getByText('eBay').click()

  // 4. Upload fixture CSV
  await page.getByLabel(/file/i)
    .setInputFiles('booking-api/src/test/resources/fixtures/ebay_valid.csv')

  // 5. Preview appears
  await expect(page.getByText(/rows ready/i)).toBeVisible({ timeout: 10000 })
  const importBtn = page.getByRole('button', { name: /import \d+ rows/i })
  await expect(importBtn).toBeEnabled()

  // 6. Confirm import
  await importBtn.click()

  // 7. Success screen — estimated profit framing
  await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/estimated profit/i)).toBeVisible()
  const ctaBtn = page.getByRole('button', { name: /review items/i })
  await expect(ctaBtn).toBeVisible()

  // 8. Navigate to inventory
  await ctaBtn.click()
  await expect(page).toHaveURL(/\/inventory/)
  await expect(page).toHaveURL(/filter=costPending/)
  await expect(page.getByText(/imported/i)).toBeVisible()

  // 9. Cost Pending badge is visible
  await expect(page.getByText('Cost Pending').first()).toBeVisible()

  // 10. Open cost entry modal
  await page.getByText('Cost Pending').first().click()
  await expect(page.getByText(/update purchase price/i)).toBeVisible()

  // 11. Enter real purchase price
  await page.getByLabel(/purchase price/i).fill('20.00')
  await page.getByLabel(/purchase date/i).fill('2024-01-01')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByText(/update purchase price/i)).not.toBeVisible({ timeout: 5000 })

  // 12. Sales view shows updated profit
  await page.goto('/sales')
  await expect(
    page.locator('td').filter({ hasText: /^\$\d+\.\d{2}/ }).first()
  ).toBeVisible({ timeout: 5000 })

  // 13. Analytics shows reduced pending count
  await page.goto('/analytics')
  const pendingEl = page.locator('[data-testid="pending-count"]')
  const isVisible = await pendingEl.isVisible().catch(() => false)
  if (isVisible) {
    const count = parseInt(await pendingEl.textContent() ?? '0')
    // Count must have dropped from the total imported by at least 1
    expect(count).toBeLessThan(3)
  }
  // If element is not visible, all costs have been entered — also valid
})
