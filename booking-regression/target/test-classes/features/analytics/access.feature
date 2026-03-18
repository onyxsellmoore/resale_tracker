Feature: Analytics access and data

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: ADMIN with valid date range returns 200 with summary
    # Create item and sale for non-empty analytics
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + token
    And request { name: 'Analytics Item', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + token
    And request { itemId: '#(itemId)', platform: 'Poshmark', salePrice: 200.00, platformFees: 40.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201

    Given path '/api/v1/analytics'
    And header Authorization = 'Bearer ' + token
    And param from = '2025-01-01'
    And param to = '2025-12-31'
    When method GET
    Then status 200
    And match response.summary.itemsSold == 1
    And match response.summary.totalRevenue == '#notnull'
    And match response.summary.totalFees == '#notnull'
    And match response.summary.totalNetProceeds == '#notnull'
    And match response.summary.totalProfit == '#notnull'

  Scenario: ACCOUNTANT can view analytics
    * def createUser = callonce read('classpath:helpers/create-user.feature') { adminToken: '#(token)', role: 'ACCOUNTANT' }

    Given path '/api/v1/analytics'
    And header Authorization = 'Bearer ' + createUser.token
    And param from = '2025-01-01'
    And param to = '2025-12-31'
    When method GET
    Then status 200
    And match response.summary == '#notnull'
