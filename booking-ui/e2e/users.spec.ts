import { test, expect } from '@playwright/test'
import { loginAs, getCredentials } from './helpers/auth'

test.describe('Managing team members as an admin', () => {
  test('I can navigate to the Users page from the navigation bar', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Users")')
    await page.waitForURL(/\/users/)
    await expect(page.getByRole('heading', { name: /team members/i })).toBeVisible()
  })

  test('The Users page shows a table of existing team members with their roles', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Users")')
    await page.waitForURL(/\/users/)
    await page.waitForSelector('table', { timeout: 10000 })
    await expect(page.locator('table')).toBeVisible()

    // Should show role badges
    await expect(page.locator('.role-badge').first()).toBeVisible()
  })

  test('I can open the Add User form by clicking the Add User button', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Users")')
    await page.waitForURL(/\/users/)
    await page.click('button:has-text("Add User")')
    await expect(page.getByRole('heading', { name: /add team member/i })).toBeVisible()
  })

  test('I can create a new user with the Buyer role by filling in the form', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Users")')
    await page.waitForURL(/\/users/)
    await page.click('button:has-text("Add User")')

    const uniqueEmail = `newbuyer-${Date.now()}@test.com`
    await page.fill('#user-name', 'New E2E Buyer')
    await page.fill('#user-email', uniqueEmail)
    await page.fill('#user-password', 'NewBuyer1!')
    await page.selectOption('#user-role', 'BUYER')
    await page.click('button:has-text("Create User")')

    // Should see success toast
    await expect(page.locator('text=User created')).toBeVisible({ timeout: 10000 })
  })

  test('After creating a user they appear in the team members table', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('a:has-text("Users")')
    await page.waitForURL(/\/users/)
    await page.click('button:has-text("Add User")')

    const uniqueName = `Table User ${Date.now()}`
    const uniqueEmail = `tableuser-${Date.now()}@test.com`
    await page.fill('#user-name', uniqueName)
    await page.fill('#user-email', uniqueEmail)
    await page.fill('#user-password', 'TableUser1!')
    await page.selectOption('#user-role', 'SELLER')
    await page.click('button:has-text("Create User")')

    await expect(page.locator('text=User created')).toBeVisible({ timeout: 10000 })

    // Reload the page to refetch users and verify in table
    await page.reload()
    await page.waitForSelector('table', { timeout: 10000 })
    await expect(page.locator('table')).toContainText(uniqueName)
  })

  test('A newly created buyer can log in and reach the inventory page', async ({ page }) => {
    // First create the user as admin
    await loginAs(page, 'admin')
    await page.click('a:has-text("Users")')
    await page.waitForURL(/\/users/)
    await page.click('button:has-text("Add User")')

    const uniqueEmail = `logintest-${Date.now()}@test.com`
    const password = 'LoginTest1!'
    await page.fill('#user-name', 'Login Test User')
    await page.fill('#user-email', uniqueEmail)
    await page.fill('#user-password', password)
    await page.selectOption('#user-role', 'BUYER')
    await page.click('button:has-text("Create User")')
    await expect(page.locator('text=User created')).toBeVisible({ timeout: 10000 })

    // Log out
    await page.click('button:has-text("Log Out")')
    await page.waitForURL(/\/login/)

    // Log in as the new user
    await page.fill('#login-email', uniqueEmail)
    await page.fill('#login-password', password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(/\/(analytics|inventory)/)

    // Navigate to inventory
    await page.click('a:has-text("Inventory")')
    await page.waitForURL(/\/inventory/)
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible()
  })
})

test.describe('User management access control', () => {
  test('As a buyer I do not see a Users link anywhere in the navigation bar', async ({ page }) => {
    await loginAs(page, 'buyer')
    await expect(page.locator('nav a:has-text("Users")')).not.toBeVisible()
  })

  test('As a buyer if I navigate directly to /users I am redirected to inventory', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto('/users')
    await page.waitForURL(/\/inventory/)
    await expect(page.locator('h1:has-text("Team Members")')).not.toBeVisible()
  })

  test('As a seller if I navigate directly to /users I am redirected to inventory', async ({ page }) => {
    await loginAs(page, 'seller')
    await page.goto('/users')
    await page.waitForURL(/\/inventory/)
    await expect(page.locator('h1:has-text("Team Members")')).not.toBeVisible()
  })

  test('As an accountant if I navigate directly to /users I am redirected to inventory', async ({ page }) => {
    await loginAs(page, 'accountant')
    await page.goto('/users')
    await page.waitForURL(/\/inventory/)
    await expect(page.locator('h1:has-text("Team Members")')).not.toBeVisible()
  })
})
