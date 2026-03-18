Feature: Update items

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: PATCH updates name and condition
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Original Name', brand: 'Prada', condition: 'GOOD', purchasePrice: 200.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/items', itemId
    And header Authorization = 'Bearer ' + token
    And request { name: 'Updated Name', condition: 'FAIR' }
    When method PATCH
    Then status 200
    And match response.name == 'Updated Name'
    And match response.condition == 'FAIR'
    And match response.purchasePrice == 200.00

  Scenario: PATCH nonexistent item returns 404
    Given path '/api/v1/items', 'aaaaaaaaaaaaaaaaaaaaaaaa'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Ghost' }
    When method PATCH
    Then status 404
