Feature: Organisation registration

  Scenario: valid registration returns 201 with orgId, userId, and ADMIN role
    * def unique = 'reg-' + java.lang.System.currentTimeMillis()
    Given url baseUrl + '/api/v1/auth/register'
    And request { orgName: '#(unique)', orgSlug: '#(unique)', adminEmail: '#(unique + "@test.com")', adminDisplayName: 'Admin' }
    When method POST
    Then status 201
    And match response.orgId == '#notnull'
    And match response.userId == '#notnull'
    And match response.role == 'ADMIN'
    And match response contains { orgId: '#notnull', userId: '#notnull', role: 'ADMIN' }
    And match response !contains { token: '#notnull' }
    And match response !contains { password: '#notnull' }

  Scenario: duplicate slug returns 409
    * def unique = 'dup-' + java.lang.System.currentTimeMillis()
    Given url baseUrl + '/api/v1/auth/register'
    And request { orgName: '#(unique)', orgSlug: '#(unique)', adminEmail: '#(unique + "-1@test.com")', adminDisplayName: 'Admin' }
    When method POST
    Then status 201

    Given url baseUrl + '/api/v1/auth/register'
    And request { orgName: 'Other', orgSlug: '#(unique)', adminEmail: '#(unique + "-2@test.com")', adminDisplayName: 'Admin' }
    When method POST
    Then status 409

  Scenario: password login endpoint no longer exists
    Given url baseUrl + '/api/v1/auth/login'
    And request { email: 'a@b.com', password: 'secret' }
    When method POST
    Then assert responseStatus == 404 || responseStatus == 405
