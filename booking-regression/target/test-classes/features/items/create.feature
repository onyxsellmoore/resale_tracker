Feature: Create items

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: valid item returns 201 with all fields
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Gucci Marmont Bag', brand: 'Gucci', category: 'Handbags', condition: 'EXCELLENT', purchasePrice: 250.00, purchaseDate: '2025-01-15T00:00:00Z', description: 'Vintage leather', notes: 'Slight patina' }
    When method POST
    Then status 201
    And match response.id == '#notnull'
    And match response.name == 'Gucci Marmont Bag'
    And match response.brand == 'Gucci'
    And match response.category == 'Handbags'
    And match response.condition == 'EXCELLENT'
    And match response.purchasePrice == 250.00
    And match response.status == 'AVAILABLE'
    And match response.description == 'Vintage leather'
    And match response.notes == 'Slight patina'

  Scenario: missing name returns 400
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { brand: 'Gucci', condition: 'GOOD', purchasePrice: 100.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 400

  Scenario: negative purchasePrice returns 400
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Bad Item', condition: 'FAIR', purchasePrice: -10.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 400
