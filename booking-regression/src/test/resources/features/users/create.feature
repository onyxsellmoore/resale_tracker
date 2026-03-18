Feature: Create users

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: ADMIN creates user with valid role returns 201
    * def unique = 'usr-' + java.lang.System.currentTimeMillis()

    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    And request { email: '#(unique + "@test.com")', displayName: 'New Buyer', role: 'BUYER' }
    When method POST
    Then status 201
    And match response.id == '#notnull'
    And match response.email == '#notnull'
    And match response.role == 'BUYER'

  Scenario: duplicate email returns 409
    * def unique = 'dup-usr-' + java.lang.System.currentTimeMillis()
    * def email = unique + '@test.com'

    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    And request { email: '#(email)', displayName: 'First', role: 'BUYER' }
    When method POST
    Then status 201

    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    And request { email: '#(email)', displayName: 'Second', role: 'SELLER' }
    When method POST
    Then status 409

  Scenario: missing email returns 400
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    And request { displayName: 'No Email', role: 'BUYER' }
    When method POST
    Then status 400
