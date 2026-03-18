Feature: Unauthenticated access returns 401

  Background:
    * url baseUrl

  Scenario: POST /items without token → 401
    Given path '/api/v1/items'
    And request { name: 'X', condition: 'GOOD', purchasePrice: 10, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 401

  Scenario: GET /items without token → 401
    Given path '/api/v1/items'
    When method GET
    Then status 401

  Scenario: GET /items/:id without token → 401
    Given path '/api/v1/items', 'aaaaaaaaaaaaaaaaaaaaaaaa'
    When method GET
    Then status 401

  Scenario: PATCH /items/:id without token → 401
    Given path '/api/v1/items', 'aaaaaaaaaaaaaaaaaaaaaaaa'
    And request { name: 'X' }
    When method PATCH
    Then status 401

  Scenario: DELETE /items/:id without token → 401
    Given path '/api/v1/items', 'aaaaaaaaaaaaaaaaaaaaaaaa'
    When method DELETE
    Then status 401

  Scenario: POST /sales without token → 401
    Given path '/api/v1/sales'
    And request { itemId: 'aaaaaaaaaaaaaaaaaaaaaaaa', platform: 'eBay', salePrice: 50, platformFees: 5, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 401

  Scenario: GET /sales without token → 401
    Given path '/api/v1/sales'
    When method GET
    Then status 401

  Scenario: GET /sales/:id without token → 401
    Given path '/api/v1/sales', 'aaaaaaaaaaaaaaaaaaaaaaaa'
    When method GET
    Then status 401

  Scenario: GET /analytics without token → 401
    Given path '/api/v1/analytics'
    And param from = '2025-01-01'
    And param to = '2025-12-31'
    When method GET
    Then status 401

  Scenario: POST /users without token → 401
    Given path '/api/v1/users'
    And request { email: 'x@test.com', displayName: 'X', role: 'BUYER' }
    When method POST
    Then status 401

  Scenario: GET /users without token → 401
    Given path '/api/v1/users'
    When method GET
    Then status 401
