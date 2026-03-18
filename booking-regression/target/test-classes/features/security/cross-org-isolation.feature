Feature: Cross-org data isolation

  Background:
    * url baseUrl

  Scenario: org A cannot see org B items
    # Set up org A
    * def orgA = call read('classpath:helpers/auth.feature')

    # Set up org B
    * def orgB = call read('classpath:helpers/auth.feature')

    # Create item in org B
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + orgB.token
    And request { name: 'Org B Item', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def orgBItemId = response.id

    # Org A tries to GET org B's item → 404
    Given path '/api/v1/items', orgBItemId
    And header Authorization = 'Bearer ' + orgA.token
    When method GET
    Then status 404

  Scenario: org A cannot PATCH org B items
    * def orgA = call read('classpath:helpers/auth.feature')
    * def orgB = call read('classpath:helpers/auth.feature')

    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + orgB.token
    And request { name: 'Org B Patch', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def orgBItemId = response.id

    Given path '/api/v1/items', orgBItemId
    And header Authorization = 'Bearer ' + orgA.token
    And request { name: 'Hacked Name' }
    When method PATCH
    Then status 404

  Scenario: org A cannot DELETE org B items
    * def orgA = call read('classpath:helpers/auth.feature')
    * def orgB = call read('classpath:helpers/auth.feature')

    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + orgB.token
    And request { name: 'Org B Delete', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def orgBItemId = response.id

    Given path '/api/v1/items', orgBItemId
    And header Authorization = 'Bearer ' + orgA.token
    When method DELETE
    Then status 404

  Scenario: org A cannot see org B sales
    * def orgA = call read('classpath:helpers/auth.feature')
    * def orgB = call read('classpath:helpers/auth.feature')

    # Create item and sale in org B
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + orgB.token
    And request { name: 'Org B Sale Item', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201
    * def itemId = response.id

    Given path '/api/v1/sales'
    And header Authorization = 'Bearer ' + orgB.token
    And request { itemId: '#(itemId)', platform: 'eBay', salePrice: 100.00, platformFees: 10.00, soldAt: '2025-06-15T12:00:00Z' }
    When method POST
    Then status 201
    * def saleId = response.id

    # Org A tries to GET org B's sale → 404
    Given path '/api/v1/sales', saleId
    And header Authorization = 'Bearer ' + orgA.token
    When method GET
    Then status 404

  Scenario: org A list does not include org B items
    * def orgA = call read('classpath:helpers/auth.feature')
    * def orgB = call read('classpath:helpers/auth.feature')

    # Create item in org B
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + orgB.token
    And request { name: 'Org B Hidden', condition: 'GOOD', purchasePrice: 50.00, purchaseDate: '2025-01-15T00:00:00Z' }
    When method POST
    Then status 201

    # Org A list should be empty (no items created in org A)
    Given path '/api/v1/items'
    And header Authorization = 'Bearer ' + orgA.token
    When method GET
    Then status 200
    And match response == '#[0]'
