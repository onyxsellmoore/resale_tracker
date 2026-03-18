import { type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export type TestRole = 'admin' | 'buyer' | 'seller' | 'accountant'

function loadCreds(): Record<string, string> {
  const raw = readFileSync(join(__dirname, '..', '.e2e-creds.json'), 'utf-8')
  return JSON.parse(raw)
}

const credKeys: Record<TestRole, { emailKey: string; passwordKey: string }> = {
  admin: { emailKey: 'ADMIN_EMAIL', passwordKey: 'ADMIN_PASSWORD' },
  buyer: { emailKey: 'BUYER_EMAIL', passwordKey: 'BUYER_PASSWORD' },
  seller: { emailKey: 'SELLER_EMAIL', passwordKey: 'SELLER_PASSWORD' },
  accountant: { emailKey: 'ACCOUNTANT_EMAIL', passwordKey: 'ACCOUNTANT_PASSWORD' },
}

export function getCredentials(role: TestRole) {
  const creds = loadCreds()
  return {
    email: creds[credKeys[role].emailKey],
    password: creds[credKeys[role].passwordKey],
  }
}

export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const { email, password } = getCredentials(role)

  await page.goto('/login')
  await page.waitForSelector('#login-email')
  await page.fill('#login-email', email)
  await page.fill('#login-password', password)
  await page.click('button:has-text("Sign In")')

  // Wait for navigation away from login
  await page.waitForURL(/\/(analytics|inventory)/)
}
