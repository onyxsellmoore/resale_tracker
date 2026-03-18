import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { createAvailableItem, getAdminToken } from './helpers/seed'

test.describe('Analytics dashboard as an admin', () => {
  test.beforeEach(async ({ request }) => {
    // Ensure at least one sale exists this month for analytics data
    const token = await getAdminToken(request)
    const itemId = await createAvailableItem(request, token, {
      name: `Analytics Item ${Date.now()}`,
      purchasePrice: 100,
    })
    await request.post('http://localhost:8080/api/v1/sales', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        itemId,
        platform: 'eBay',
        salePrice: 200,
        platformFees: 20,
        soldAt: new Date().toISOString(),
      },
    })
  })

  test('The analytics page shows a total revenue summary card', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.waitForURL(/\/analytics/)
    await expect(page.locator('[data-testid="card-totalRevenue"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="card-totalRevenue"]')).toContainText('Total Revenue')
  })

  test('The analytics page shows a total cost summary card', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.waitForURL(/\/analytics/)
    await expect(page.locator('[data-testid="card-costOfGoods"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="card-costOfGoods"]')).toContainText('Cost of Goods')
  })

  test('The analytics page shows a total profit summary card', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.waitForURL(/\/analytics/)
    await expect(page.locator('[data-testid="card-totalProfit"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="card-totalProfit"]')).toContainText('Total Profit')
  })

  test('The analytics page shows a total items sold count', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.waitForURL(/\/analytics/)
    await expect(page.locator('[data-testid="card-itemsSold"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="card-itemsSold"]')).toContainText('Items Sold')
  })
})

test.describe('Analytics access by role', () => {
  test('As an accountant I can access the analytics dashboard', async ({ page }) => {
    await loginAs(page, 'accountant')
    // Accountant lands on analytics after login
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible()
  })

  test('As a seller I am redirected away from the analytics page', async ({ page }) => {
    await loginAs(page, 'seller')
    await page.goto('/analytics')
    // Seller should not see analytics — redirected to another page
    await page.waitForURL(/\/(inventory|sales|login)/)
    await expect(page.locator('h1:has-text("Analytics")')).not.toBeVisible()
  })

  test('As a buyer I am redirected away from the analytics page', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto('/analytics')
    // Buyer should not see analytics — redirected
    await page.waitForURL(/\/(inventory|login)/)
    await expect(page.locator('h1:has-text("Analytics")')).not.toBeVisible()
  })
})
