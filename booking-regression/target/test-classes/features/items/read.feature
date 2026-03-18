Feature: Read items

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: list items returns 200
    # Create an item first
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'List Test Item', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201

    # List items
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response == '#[1]'
    And match response[0].name == 'List Test Item'

  Scenario: get item by id returns 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Get By Id Item', condition: 'GOOD', purchasePrice: 75.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response.name == 'Get By Id Item'

  Scenario: status filter AVAILABLE excludes SOLD items
    # Create and sell an item
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Will Sell', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def soldItemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(soldItemId)', platform: 'eBay', salePrice: 100.00, platformFees: 10.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201

    # Create an available item
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Still Available', condition: 'GOOD', purchasePrice: 30.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201

    # Filter by AVAILABLE
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And param status = 'AVAILABLE'
    When method GET
    Then status 200
    And match each response[*].status == 'AVAILABLE'
