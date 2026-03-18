@ignore
Feature: Create a fresh org and return an admin token

  Scenario: register org and get dev token
    * def unique = 'test-' + java.lang.System.currentTimeMillis() + '-' + Math.floor(Math.random() * 10000)
    * def email = unique + '@test.com'

    Given url baseUrl + '/api/v1/auth/register'
    And request { orgName: '#(unique)', orgSlug: '#(unique)', adminEmail: '#(email)', adminDisplayName: 'Admin' }
    When method POST
    Then status 201
    * def orgId = response.orgId
    * def userId = response.userId

    Given url baseUrl + '/api/v1/auth/dev-token'
    And request { email: '#(email)' }
    When method POST
    Then status 200
    * def token = response.accessToken
