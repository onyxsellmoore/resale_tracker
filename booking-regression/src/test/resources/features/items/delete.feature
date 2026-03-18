Feature: Delete items

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: delete AVAILABLE item returns 204
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'To Delete', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + token
    When method DELETE
    Then status 204

    # Confirm item no longer in AVAILABLE list
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And param status = 'AVAILABLE'
    When method GET
    Then status 200
    And match response[*].id !contains itemId

  Scenario: delete SOLD item returns 409
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Sold No Delete', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'Poshmark', salePrice: 100.00, platformFees: 20.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + token
    When method DELETE
    Then status 409

  Scenario: delete nonexistent item returns 404
    Given path '/api/v1/items', 'aaaaaaaaaaaaaaaaaaaaaaaa'
    And header Authorization = 'Bearer ' + token
    When method DELETE
    Then status 404
