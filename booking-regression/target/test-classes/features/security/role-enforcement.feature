Feature: Role-based access enforcement

  Full permission matrix:
  | Endpoint          | ADMIN | BUYER | SELLER | ACCOUNTANT |
  | POST /items       |  ✓    |  ✓    |  ✗     |  ✗         |
  | GET /items        |  ✓    |  ✓    |  ✓     |  ✓         |
  | GET /items/:id    |  ✓    |  ✓    |  ✓     |  ✓         |
  | PATCH /items/:id  |  ✓    |  ✓    |  ✓     |  ✓         |
  | DELETE /items/:id |  ✓    |  ✗    |  ✗     |  ✗         |
  | POST /sales       |  ✓    |  ✗    |  ✓     |  ✗         |
  | GET /sales        |  ✓    |  ✓    |  ✓     |  ✓         |
  | GET /analytics    |  ✓    |  ✗    |  ✗     |  ✓         |
  | POST /users       |  ✓    |  ✗    |  ✗     |  ✗         |
  | GET /users        |  ✓    |  ✗    |  ✗     |  ✗         |

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')
    * def buyer = callonce read('classpath:helpers/create-user.feature') { adminToken: '#(token)', role: 'BUYER' }
    * def seller = callonce read('classpath:helpers/create-user.feature') { adminToken: '#(token)', role: 'SELLER' }
    * def accountant = callonce read('classpath:helpers/create-user.feature') { adminToken: '#(token)', role: 'ACCOUNTANT' }

  # ---------- POST /items ----------

  Scenario: SELLER cannot POST /items → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + seller.token
    And request { name: 'X', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 403

  Scenario: ACCOUNTANT cannot POST /items → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + accountant.token
    And request { name: 'X', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 403

  Scenario: BUYER can POST /items → 201
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + buyer.token
    And request { name: 'Buyer Item', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201

  # ---------- GET /items ----------

  Scenario: BUYER can GET /items → 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + buyer.token
    When method GET
    Then status 200

  Scenario: SELLER can GET /items → 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + seller.token
    When method GET
    Then status 200

  Scenario: ACCOUNTANT can GET /items → 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + accountant.token
    When method GET
    Then status 200

  # ---------- PATCH /items/:id ----------

  Scenario: BUYER can PATCH /items → 200
    # Create item as admin
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Patch Test', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + buyer.token
    And request { name: 'Buyer Patched' }
    When method PATCH
    Then status 200

  Scenario: SELLER can PATCH /items → 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Seller Patch', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + seller.token
    And request { name: 'Seller Patched' }
    When method PATCH
    Then status 200

  Scenario: ACCOUNTANT can PATCH /items → 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Acct Patch', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + accountant.token
    And request { name: 'Accountant Patched' }
    When method PATCH
    Then status 200

  # ---------- DELETE /items/:id ----------

  Scenario: BUYER cannot DELETE /items → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Buyer Del', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + buyer.token
    When method DELETE
    Then status 403

  Scenario: SELLER cannot DELETE /items → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Seller Del', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + seller.token
    When method DELETE
    Then status 403

  Scenario: ACCOUNTANT cannot DELETE /items → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Acct Del', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + accountant.token
    When method DELETE
    Then status 403

  # ---------- POST /sales ----------

  Scenario: BUYER cannot POST /sales → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Buyer Sale', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + buyer.token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 50, platformFees: 5, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 403

  Scenario: ACCOUNTANT cannot POST /sales → 403
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Acct Sale', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + accountant.token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 50, platformFees: 5, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 403

  Scenario: SELLER can POST /sales → 201
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Seller Sale', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + seller.token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 50, platformFees: 5, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201

  # ---------- GET /sales ----------

  Scenario: BUYER can GET /sales → 200
    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + buyer.token
    When method GET
    Then status 200

  Scenario: SELLER can GET /sales → 200
    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + seller.token
    When method GET
    Then status 200

  Scenario: ACCOUNTANT can GET /sales → 200
    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + accountant.token
    When method GET
    Then status 200

  # ---------- GET /analytics ----------

  Scenario: BUYER cannot GET /analytics → 403
    Given path '/api/v1/analytics'
    And header Authorization = 'Bearer ' + buyer.token
    And param from = '2025-01-01'
    And param to = '2025-12-31'
    When method GET
    Then status 403

  Scenario: SELLER cannot GET /analytics → 403
    Given path '/api/v1/analytics'
    And header Authorization = 'Bearer ' + seller.token
    And param from = '2025-01-01'
    And param to = '2025-12-31'
    When method GET
    Then status 403

  Scenario: ACCOUNTANT can GET /analytics → 200
    Given path '/api/v1/analytics'
    And header Authorization = 'Bearer ' + accountant.token
    And param from = '2025-01-01'
    And param to = '2025-12-31'
    When method GET
    Then status 200

  # ---------- POST /users ----------

  Scenario: BUYER cannot POST /users → 403
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + buyer.token
    And request { email: 'x@test.com', displayName: 'X', role: 'BUYER' }
    When method POST
    Then status 403

  Scenario: SELLER cannot POST /users → 403
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + seller.token
    And request { email: 'x@test.com', displayName: 'X', role: 'BUYER' }
    When method POST
    Then status 403

  Scenario: ACCOUNTANT cannot POST /users → 403
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + accountant.token
    And request { email: 'x@test.com', displayName: 'X', role: 'BUYER' }
    When method POST
    Then status 403

  # ---------- GET /users ----------

  Scenario: BUYER cannot GET /users → 403
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + buyer.token
    When method GET
    Then status 403

  Scenario: SELLER cannot GET /users → 403
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + seller.token
    When method GET
    Then status 403

  Scenario: ACCOUNTANT cannot GET /users → 403
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + accountant.token
    When method GET
    Then status 403
