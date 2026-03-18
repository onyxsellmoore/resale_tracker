Feature: Sale computed fields

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: netProceeds and profit are computed correctly
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Computed Fields Bag', condition: 'EXCELLENT', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'Poshmark', salePrice: 200.00, platformFees: 40.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201
    # netProceeds = salePrice - platformFees = 200 - 40 = 160
    And match response.netProceeds == 160.00
    # profit = netProceeds - purchasePrice = 160 - 50 = 110
    And match response.profit == 110.00
