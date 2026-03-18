Feature: Create sales

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: valid sale returns 201 with all fields
    # Create an item first
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Sale Test Bag', condition: 'EXCELLENT', purchasePrice: 100.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'Poshmark', salePrice: 200.00, platformFees: 40.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201
    And match response.id == '#notnull'
    And match response.salePrice == 200.00
    And match response.platformFees == 40.00
    And match response.platform == 'Poshmark'

  Scenario: sale on already-sold item returns 409
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Double Sale Bag', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    # First sale succeeds
    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 100.00, platformFees: 10.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201

    # Second sale on same item fails
    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'Poshmark', salePrice: 120.00, platformFees: 24.00, soldAt: '2025-06-16T12:00:00Z' }
    When method POST
    Then status 409

  Scenario: negative salePrice returns 400
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Negative Sale', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: -10.00, platformFees: 0, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 400
