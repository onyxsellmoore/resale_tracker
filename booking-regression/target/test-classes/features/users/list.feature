Feature: List users

  Background:
    * url baseUrl
    * callonce read('classpath:helpers/auth.feature')

  Scenario: ADMIN can list users and sees the admin user
    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response == '#[1]'
    And match response[0].role == 'ADMIN'

  Scenario: creating a user increases the list count
    * def unique = 'list-usr-' + java.lang.System.currentTimeMillis()

    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    And request { email: '#(unique + "@test.com")', displayName: 'Extra User', role: 'SELLER' }
    When method POST
    Then status 201

    Given path '/api/v1/users'
    And header Authorization = 'Bearer ' + token
    When method GET
    Then status 200
    And match response == '#[2]'
