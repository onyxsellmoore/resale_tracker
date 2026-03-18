import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { createAvailableItem, getAdminToken } from './helpers/seed'

test.describe('Recording a sale as an admin', () => {
  test('I can navigate to Record a Sale from the gold button in the navigation bar', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await expect(page.getByRole('heading', { name: /record a sale/i })).toBeVisible()
  })

  test('The item dropdown shows only AVAILABLE items', async ({ page, request }) => {
    const token = await getAdminToken(request)
    await createAvailableItem(request, token, { name: `Avail Dropdown ${Date.now()}` })

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await page.waitForSelector('#sale-item')

    const options = page.locator('#sale-item option')
    const count = await options.count()
    expect(count).toBeGreaterThan(1) // placeholder + at least one item

    // No option should say SOLD
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent()
      expect(text).not.toContain('SOLD')
    }
  })

  test('When I select an item and enter a sale price the profit preview updates', async ({ page, request }) => {
    const token = await getAdminToken(request)
    const itemName = `Profit Preview ${Date.now()}`
    await createAvailableItem(request, token, { name: itemName, purchasePrice: 100 })

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await page.waitForSelector('#sale-item')

    await page.selectOption('#sale-item', { label: itemName })
    await page.fill('#sale-price', '250')

    await expect(page.locator('[data-testid="profit-preview"]')).toContainText('$150.00')
  })

  test('When I select an item and enter a sale price and platform fees the net proceeds update', async ({ page, request }) => {
    const token = await getAdminToken(request)
    const itemName = `Net Proceeds ${Date.now()}`
    await createAvailableItem(request, token, { name: itemName, purchasePrice: 100 })

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await page.waitForSelector('#sale-item')

    await page.selectOption('#sale-item', { label: itemName })
    await page.fill('#sale-price', '300')
    await page.fill('#sale-fees', '50')

    // Net proceeds = 300 - 50 = 250
    await expect(page.locator('[data-testid="profit-preview"]')).toContainText('$250.00')
  })

  test('After I submit the sale form the item status changes to SOLD in the inventory', async ({ page, request }) => {
    const token = await getAdminToken(request)
    const itemName = `Sell Me ${Date.now()}`
    await createAvailableItem(request, token, { name: itemName, purchasePrice: 80 })

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await page.waitForSelector('#sale-item')

    await page.selectOption('#sale-item', { label: itemName })
    await page.fill('#sale-platform', 'Poshmark')
    await page.fill('#sale-price', '200')
    await page.fill('#sale-fees', '20')
    await page.click('button:has-text("Record Sale")')

    // Should redirect to sales list
    await page.waitForURL(/\/sales$/)

    // Navigate to inventory and verify SOLD
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await page.waitForSelector('table')
    const row = page.locator('tr', { hasText: itemName })
    await expect(row.locator('.status-badge-sold')).toBeVisible()
  })

  test('The completed sale appears in the sales history table', async ({ page, request }) => {
    const token = await getAdminToken(request)
    const itemName = `Sales History ${Date.now()}`
    await createAvailableItem(request, token, { name: itemName, purchasePrice: 60 })

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await page.waitForSelector('#sale-item')

    await page.selectOption('#sale-item', { label: itemName })
    await page.fill('#sale-platform', 'eBay')
    await page.fill('#sale-price', '150')
    await page.fill('#sale-fees', '15')
    await page.click('button:has-text("Record Sale")')

    await page.waitForURL(/\/sales$/)
    await page.waitForSelector('table')
    await expect(page.locator('table')).toContainText(itemName)
  })
})

test.describe('Recording a sale as a seller', () => {
  test('As a seller I can see the Record a Sale button in the navigation bar', async ({ page }) => {
    await loginAs(page, 'seller')
    await expect(page.locator('a.navbar-record-sale')).toBeVisible()
  })

  test('As a seller I can record a sale for an available item', async ({ page, request }) => {
    const token = await getAdminToken(request)
    const itemName = `Seller Sale ${Date.now()}`
    await createAvailableItem(request, token, { name: itemName, purchasePrice: 40 })

    await loginAs(page, 'seller')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await page.waitForSelector('#sale-item')

    await page.selectOption('#sale-item', { label: itemName })
    await page.fill('#sale-platform', 'Mercari')
    await page.fill('#sale-price', '90')
    await page.fill('#sale-fees', '9')
    await page.click('button:has-text("Record Sale")')

    await page.waitForURL(/\/sales$/)
    await page.waitForSelector('table')
    await expect(page.locator('table')).toContainText(itemName)
  })
})

test.describe('Empty inventory guard on the Record a Sale screen', () => {
  test('When no items are available I see an empty state message instead of a dropdown', async ({ page, request }) => {
    // This tests that when all items are sold, we see empty state
    // We use a freshly-created seller or admin context where all items might be sold
    // For reliability, we'll verify the empty state component is present when no AVAILABLE items
    const token = await getAdminToken(request)

    // Sell all currently available items first via API
    const itemsRes = await request.get('http://localhost:8080/api/v1/items?status=AVAILABLE', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const items = await itemsRes.json()

    for (const item of items) {
      await request.post('http://localhost:8080/api/v1/sales', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: {
          itemId: item.id,
          platform: 'Test',
          salePrice: 999,
          platformFees: 0,
          soldAt: new Date().toISOString(),
        },
      })
    }

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await expect(page.locator('text=No items in inventory yet')).toBeVisible()
  })

  test('The empty state message contains a link to add items to inventory', async ({ page, request }) => {
    // Sell all available items via API to trigger empty state
    const token = await getAdminToken(request)
    const itemsRes = await request.get('http://localhost:8080/api/v1/items?status=AVAILABLE', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const items = await itemsRes.json()
    for (const item of items) {
      await request.post('http://localhost:8080/api/v1/sales', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        data: {
          itemId: item.id,
          platform: 'Test',
          salePrice: 999,
          platformFees: 0,
          soldAt: new Date().toISOString(),
        },
      })
    }

    await loginAs(page, 'admin')
    await page.click('a.navbar-record-sale')
    await page.waitForURL(/\/sales\/new/)
    await expect(page.locator('text=No items in inventory yet')).toBeVisible()
    await expect(page.getByRole('link', { name: /go to inventory/i })).toBeVisible()
  })
})

test.describe('Viewing sales history', () => {
  test.beforeEach(async ({ request }) => {
    // Ensure at least one sale exists by creating an item and selling it
    const token = await getAdminToken(request)
    const itemName = `History Check ${Date.now()}`
    const itemId = await createAvailableItem(request, token, {
      name: itemName,
      purchasePrice: 50,
    })
    await request.post('http://localhost:8080/api/v1/sales', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        itemId,
        platform: 'eBay',
        salePrice: 120,
        platformFees: 12,
        soldAt: new Date().toISOString(),
      },
    })
  })

  test('The sales table shows item name, platform, sale price, fees, net proceeds, and profit', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Sales")')
    await page.waitForURL(/\/sales/)
    await page.waitForSelector('table')

    const headers = page.locator('thead th')
    await expect(headers.filter({ hasText: 'Item Name' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Platform' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Sale Price' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Fees' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Net Proceeds' })).toBeVisible()
    await expect(headers.filter({ hasText: 'Profit' })).toBeVisible()
  })

  test('Profitable sales show the profit in green', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Sales")')
    await page.waitForURL(/\/sales/)
    await page.waitForSelector('table')
    // A sale with purchase price 50, sale price 120, fees 12 = profit 58
    await expect(page.locator('.profit-positive').first()).toBeVisible()
  })

  test('Sales with a loss show the profit in red', async ({ page, request }) => {
    // Create an item and sell at a loss
    const token = await getAdminToken(request)
    const itemName = `Loss Sale ${Date.now()}`
    const itemId = await createAvailableItem(request, token, {
      name: itemName,
      purchasePrice: 500,
    })
    await request.post('http://localhost:8080/api/v1/sales', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        itemId,
        platform: 'Depop',
        salePrice: 50,
        platformFees: 5,
        soldAt: new Date().toISOString(),
      },
    })

    await loginAs(page, 'admin')
    await page.click('a:has-text("Sales")')
    await page.waitForURL(/\/sales/)
    await page.waitForSelector('table')
    await expect(page.locator('.profit-negative').first()).toBeVisible()
  })

  test('As an accountant I can view the sales history table', async ({ page }) => {
    await loginAs(page, 'accountant')
    await page.click('a:has-text("Sales")')
    await page.waitForURL(/\/sales/)
    await page.waitForSelector('table')
    await expect(page.locator('table')).toBeVisible()
  })

  test('As a buyer I am redirected away from the sales page', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto('/sales')
    // Buyer shouldn't have sales access — should redirect to analytics
    await page.waitForURL(/\/(analytics|inventory|login)/)
    await expect(page.locator('h1:has-text("Sales")')).not.toBeVisible()
  })
})
