Feature: Read sales

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: list sales returns 200
    # Create item and sell it
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'List Sale Item', condition: 'GOOD', purchasePrice: 80.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 160.00, platformFees: 16.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201

    # List sales
    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response == '#[1]'

  Scenario: get sale by id returns 200
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Get Sale Item', condition: 'GOOD', purchasePrice: 60.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'Poshmark', salePrice: 120.00, platformFees: 24.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201
    * def saleId = response.id

    Given path '/api/v1/sales', saleId
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response.id == saleId
    And match response.platform == 'Poshmark'
