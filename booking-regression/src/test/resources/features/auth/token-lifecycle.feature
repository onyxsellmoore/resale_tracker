Feature: Token lifecycle (refresh and logout)

  Background:
    * url baseUrl

  Scenario: refresh with invalid token returns 401
    Given path '/api/v1/auth/refresh'
    And request { refreshToken: 'invalid-token-value' }
    When method POST
    Then status 401

  Scenario: logout with nonexistent token returns 204 (idempotent)
    Given path '/api/v1/auth/logout'
    And request { refreshToken: 'nonexistent-token' }
    When method POST
    Then status 204

  Scenario: logout with null body returns 204
    Given path '/api/v1/auth/logout'
    And request {}
    When method POST
    Then status 204
