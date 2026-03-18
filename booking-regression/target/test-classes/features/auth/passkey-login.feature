Feature: Passkey login flow (WebAuthn)

  Background:
    * url baseUrl

  Scenario: login/begin with unknown email returns 401
    Given path '/api/v1/auth/login/begin'
    And request { email: 'nobody@doesnotexist.com' }
    When method POST
    Then status 401

  Scenario: login/complete with invalid data returns 401
    Given path '/api/v1/auth/login/complete'
    And request { email: 'fake@test.com', credentialId: 'bad', authenticatorData: 'bad', clientDataJSON: 'bad', signature: 'bad' }
    When method POST
    Then status 401

  Scenario: register/begin with blank email returns 401
    Given path '/api/v1/auth/register/begin'
    And request { email: '' }
    When method POST
    Then status 401

  Scenario: register/complete with invalid data returns 401
    Given path '/api/v1/auth/register/complete'
    And request { email: 'fake@test.com', credentialId: 'bad', attestationObject: 'bad', clientDataJSON: 'bad' }
    When method POST
    Then status 401
