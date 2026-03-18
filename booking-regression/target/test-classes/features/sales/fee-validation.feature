Feature: Sale fee validation

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: platformFees greater than salePrice returns 400
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Fee Test Item', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 100.00, platformFees: 150.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 400

  Scenario: platformFees equal to salePrice is allowed
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Fee Equal Item', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 100.00, platformFees: 100.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201
