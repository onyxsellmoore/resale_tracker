Feature: Immutable item fields

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: PATCH with purchasePrice does not change the stored value
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Immutable Test', condition: 'GOOD', purchasePrice: 250.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + token
    And request { name: 'Immutable Test', purchasePrice: 9999.99, purchaseDate: '2099-12-31T00:00:00Z' }
    When method PATCH
    Then status 200
    And match response.purchasePrice == 250.00

    # Verify via GET
    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response.purchasePrice == 250.00
