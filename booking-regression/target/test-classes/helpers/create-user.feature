@ignore
Feature: Create a user with a given role and return a token

  Scenario: create user and get dev token
    * def unique = 'user-' + java.lang.System.currentTimeMillis() + '-' + Math.floor(Math.random() * 10000)
    * def userEmail = unique + '@test.com'

    Given url baseUrl + '/api/v1/users'
    And header Authorization = 'Bearer ' + adminToken
    And request { email: '#(userEmail)', displayName: '#(role) User', role: '#(role)' }
    When method POST
    Then status 201

    Given url baseUrl + '/api/v1/auth/dev-token'
    And request { email: '#(userEmail)' }
    When method POST
    Then status 200
    * def token = response.accessToken
