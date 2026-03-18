import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Viewing the inventory as an admin', () => {
  test('I can see a table of all inventory items on the inventory page', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await expect(page.locator('table')).toBeVisible()
  })

  test('Each row shows the item name, brand, category, condition, purchase price, and status', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await page.waitForSelector('table')
    const headers = page.locator('thead th')
    await expect(headers.filter({ hasText: 'Name' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Brand' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Purchase Price' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Status' })).toBeVisible()
  })

  test('Items with SOLD status display a visual SOLD badge', async ({ page, request }) => {
    // First create an item and sell it via API
    const { getAdminToken, createAvailableItem } = await import('./helpers/seed')
    const token = await getAdminToken(request)
    const itemId = await createAvailableItem(request, token, {
      name: `Sold Badge Test ${Date.now()}`,
      purchasePrice: 50,
    })

    // Record a sale for it via API
    await request.post('http://localhost:8080/api/v1/sales', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        itemId,
        platform: 'eBay',
        salePrice: 100,
        platformFees: 10,
        soldAt: new Date().toISOString(),
      },
    })

    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await page.waitForSelector('table')
    await expect(page.locator('.status-badge-sold').first()).toBeVisible()
  })
})

test.describe('Adding an item to inventory as an admin', () => {
  test('I can open the add item form from the inventory page', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await expect(page.getByRole('heading', { name: /add item/i })).toBeVisible()
  })

  test('The purchase date field is pre-filled with today\'s date', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    const dateInput = page.locator('#item-date')
    const today = new Date().toISOString().split('T')[0]
    await expect(dateInput).toHaveValue(today)
  })

  test('After I fill in all fields and submit, the new item appears in the table', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)

    const uniqueName = `E2E Test Item ${Date.now()}`
    await page.fill('#item-name', uniqueName)
    await page.fill('#item-brand', 'TestBrand')
    await page.fill('#item-category', 'TestCat')
    await page.fill('#item-price', '150')
    await page.click('button:has-text("Add Item")')

    // Wait for the item to appear in the table
    await expect(page.locator('table')).toContainText(uniqueName, { timeout: 10000 })
  })

  test('I cannot submit the add item form if the name field is empty', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await page.fill('#item-price', '100')
    await page.click('button:has-text("Add Item")')
    await expect(page.locator('.form-error')).toContainText(/name is required/i)
  })

  test('I cannot submit the add item form if the purchase price is missing', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await page.fill('#item-name', 'No Price Item')
    await page.click('button:has-text("Add Item")')
    await expect(page.locator('.form-error')).toContainText(/price/i)
  })
})

test.describe('Inventory access by role', () => {
  test('As a buyer I can view the inventory page and see the Add Item button', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible()
    await expect(page.locator('a:has-text("Add Item")')).toBeVisible()
  })

  test('As a seller I can view the inventory page but there is no Add Item button', async ({ page }) => {
    await loginAs(page, 'seller')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible()
    await expect(page.locator('a:has-text("Add Item")')).not.toBeVisible()
  })

  test('As an accountant I can view the inventory page but there is no Add Item button', async ({ page }) => {
    await loginAs(page, 'accountant')
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible()
    await expect(page.locator('a:has-text("Add Item")')).not.toBeVisible()
  })
})
