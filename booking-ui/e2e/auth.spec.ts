import { test, expect } from '@playwright/test'
import { loginAs, getCredentials } from './helpers/auth'

test.describe('Visiting the app without logging in', () => {
  test('I am redirected to the login page when I open the app root', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })

  test('I am redirected to the login page when I try to open /inventory directly', async ({ page }) => {
    await page.goto('/inventory')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })

  test('I am redirected to the login page when I try to open /analytics directly', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })
})

test.describe('Logging in as the admin', () => {
  test('I can log in with my email and password', async ({ page }) => {
    await loginAs(page, 'admin')
    await expect(page).toHaveURL(/\/analytics/)
  })

  test('After logging in I land on the analytics dashboard', async ({ page }) => {
    await loginAs(page, 'admin')
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible()
  })

  test('I can log out using the navigation and I am returned to the login page', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('button:has-text("Log Out")')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })

  test('After logging out I cannot reach the inventory page without logging in again', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.click('button:has-text("Log Out")')
    await page.waitForURL(/\/login/)
    await page.goto('/inventory')
    await page.waitForURL(/\/login/)
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
  })
})

test.describe('Invalid login attempts', () => {
  test('I see an error message when I enter the wrong password', async ({ page }) => {
    const { email } = getCredentials('admin')
    await page.goto('/login')
    await page.fill('#login-email', email)
    await page.fill('#login-password', 'WrongPassword123!')
    await page.click('button:has-text("Sign In")')
    await expect(page.locator('.form-error')).toBeVisible()
    await expect(page.locator('.form-error')).toContainText(/failed/i)
  })

  test('I see a validation error when I submit the form with an empty email field', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#login-password', 'SomePassword1!')
    await page.click('button:has-text("Sign In")')
    // The form does early return with `if (!email.trim() || !password)` so it stays on login
    await expect(page).toHaveURL(/\/login/)
  })

  test('I see a validation error when I submit the form with an empty password field', async ({ page }) => {
    const { email } = getCredentials('admin')
    await page.goto('/login')
    await page.fill('#login-email', email)
    await page.click('button:has-text("Sign In")')
    // The form does early return when password is empty
    await expect(page).toHaveURL(/\/login/)
  })
})
