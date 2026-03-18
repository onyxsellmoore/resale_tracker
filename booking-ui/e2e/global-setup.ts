const API_BASE = 'http://localhost:8080/api/v1'

async function globalSetup() {
  let adminToken: string

  // Step 1: Register org or login if already exists
  const registerRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgName: 'Test Org',
      orgSlug: 'test-org',
      adminEmail: 'admin@test.com',
      adminPassword: 'TestAdmin1!',
      adminDisplayName: 'Test Admin',
    }),
  })

  if (registerRes.status === 201) {
    const data = await registerRes.json()
    adminToken = data.token
  } else if (registerRes.status === 409) {
    // Org already exists — login as admin
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'TestAdmin1!',
      }),
    })
    if (!loginRes.ok) {
      throw new Error(`Admin login failed: ${loginRes.status}`)
    }
    const data = await loginRes.json()
    adminToken = data.token
  } else {
    const body = await registerRes.text()
    throw new Error(`Registration failed: ${registerRes.status} ${body}`)
  }

  // Step 2: Create test users (ignore errors if they already exist)
  const users = [
    { email: 'buyer@test.com', password: 'TestBuyer1!', displayName: 'Test Buyer', role: 'BUYER' },
    { email: 'seller@test.com', password: 'TestSeller1!', displayName: 'Test Seller', role: 'SELLER' },
    { email: 'accountant@test.com', password: 'TestAccount1!', displayName: 'Test Accountant', role: 'ACCOUNTANT' },
  ]

  for (const user of users) {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(user),
    })
    // Ignore 400/409 — user may already exist
  }

  // Step 3: Seed 3 available items
  const items = [
    {
      name: 'Vintage Chanel Bag',
      brand: 'Chanel',
      category: 'Handbags',
      condition: 'EXCELLENT',
      purchasePrice: 500.00,
      purchaseDate: new Date().toISOString(),
    },
    {
      name: 'Gucci Loafers',
      brand: 'Gucci',
      category: 'Shoes',
      condition: 'GOOD',
      purchasePrice: 200.00,
      purchaseDate: new Date().toISOString(),
    },
    {
      name: 'Prada Wallet',
      brand: 'Prada',
      category: 'Accessories',
      condition: 'FAIR',
      purchasePrice: 75.00,
      purchaseDate: new Date().toISOString(),
    },
  ]

  for (const item of items) {
    await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(item),
    })
    // Ignore errors if items already exist from prior runs
  }

  // Step 4: Write credentials to a temp file for test workers to read
  const { writeFileSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const creds = {
    ADMIN_EMAIL: 'admin@test.com',
    ADMIN_PASSWORD: 'TestAdmin1!',
    BUYER_EMAIL: 'buyer@test.com',
    BUYER_PASSWORD: 'TestBuyer1!',
    SELLER_EMAIL: 'seller@test.com',
    SELLER_PASSWORD: 'TestSeller1!',
    ACCOUNTANT_EMAIL: 'accountant@test.com',
    ACCOUNTANT_PASSWORD: 'TestAccount1!',
  }
  writeFileSync(join(__dirname, '.e2e-creds.json'), JSON.stringify(creds))
}

export default globalSetup
