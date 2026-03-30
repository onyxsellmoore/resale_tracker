import XCTest
@testable import Booking

@MainActor
final class AuthViewModelTests: XCTestCase {
    var sut: AuthViewModel!
    var testKeychain: KeychainService!
    var mockPasskey: MockPasskeyProvider!
    var mockSession: URLSession!

    override func setUp() {
        super.setUp()
        mockSession = MockURLProtocol.makeMockSession()
        testKeychain = KeychainService.makeTestInstance()
        mockPasskey = MockPasskeyProvider()
        let baseURL = URL(string: "http://localhost:8080")!
        let refreshInterceptor = TokenRefreshInterceptor(
            session: mockSession, keychain: testKeychain, baseURL: baseURL
        )
        let apiClient = APIClient(
            session: mockSession, baseURL: baseURL,
            keychain: testKeychain, refreshInterceptor: refreshInterceptor
        )
        sut = AuthViewModel(
            passkeyProvider: mockPasskey,
            keychain: testKeychain,
            apiClient: apiClient
        )
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        testKeychain.clearAll()
        super.tearDown()
    }

    func testLogin_setsIsAuthenticated_onSuccess() async throws {
        // Build a valid JWT with claims in the payload (middle segment)
        let claims: [String: String] = ["sub": "user1", "role": "ADMIN", "org_id": "org1"]
        let claimsData = try JSONEncoder().encode(claims)
        let payload = claimsData.base64URLEncoded()
        let jwt = "eyJhbGciOiJIUzI1NiJ9.\(payload).fake-signature"

        mockPasskey.loginResult = .success((accessToken: jwt, refreshToken: "rt-opaque"))

        await sut.login(email: "test@test.com")

        XCTAssertTrue(sut.isAuthenticated)
        XCTAssertEqual(sut.role, "ADMIN")
        XCTAssertEqual(sut.orgId, "org1")
        XCTAssertNil(sut.errorMessage)
    }

    func testLogin_setsErrorMessage_onPasskeyError() async throws {
        mockPasskey.loginResult = .failure(PasskeyError.userCancelled)

        await sut.login(email: "test@test.com")

        XCTAssertFalse(sut.isAuthenticated)
        XCTAssertEqual(sut.errorMessage, PasskeyError.userCancelled.userMessage)
    }

    func testLogout_clearsAllKeychainKeys() async throws {
        // Seed keychain with all four keys
        try testKeychain.save(key: .accessToken, data: Data("at".utf8))
        try testKeychain.save(key: .refreshToken, data: Data("rt".utf8))
        try testKeychain.save(key: .userRole, data: Data("ADMIN".utf8))
        try testKeychain.save(key: .orgId, data: Data("org1".utf8))
        sut.isAuthenticated = true

        // Mock logout endpoint to return 200
        MockURLProtocol.requestHandler = { request in
            (
                HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!, Data("{}".utf8)
            )
        }

        await sut.logout()

        XCTAssertFalse(sut.isAuthenticated)
        XCTAssertNil(testKeychain.load(key: .accessToken))
        XCTAssertNil(testKeychain.load(key: .refreshToken))
        XCTAssertNil(testKeychain.load(key: .userRole))
        XCTAssertNil(testKeychain.load(key: .orgId))
    }

    func testRestoreSession_setsIsAuthenticated_whenKeychainHasTokens() {
        try! testKeychain.save(key: .accessToken, data: Data("at".utf8))
        try! testKeychain.save(key: .userRole, data: Data("SELLER".utf8))
        try! testKeychain.save(key: .orgId, data: Data("org2".utf8))

        sut.restoreSession()

        XCTAssertTrue(sut.isAuthenticated)
        XCTAssertEqual(sut.role, "SELLER")
        XCTAssertEqual(sut.orgId, "org2")
    }
}

// MARK: - Mock for testing AuthViewModel

@MainActor
class MockPasskeyProvider: PasskeyLoginProvider {
    var loginResult: Result<(accessToken: String, refreshToken: String), Error> =
        .failure(PasskeyError.userCancelled)
    var registerResult: Result<(accessToken: String, refreshToken: String), Error>?
    var registerOrgCalled = false
    var registerPasskeyCalled = false

    func createOrganization(
        orgName: String, orgSlug: String,
        adminEmail: String, adminDisplayName: String
    ) async throws {
        registerOrgCalled = true
    }

    func registerPasskey(email: String) async throws -> (accessToken: String, refreshToken: String) {
        registerPasskeyCalled = true
        if let result = registerResult {
            switch result {
            case .success(let tokens): return tokens
            case .failure(let error): throw error
            }
        }
        // Default: return same as loginResult for convenience
        switch loginResult {
        case .success(let tokens): return tokens
        case .failure(let error): throw error
        }
    }

    func loginWithPasskey(email: String) async throws -> (accessToken: String, refreshToken: String) {
        switch loginResult {
        case .success(let tokens): return tokens
        case .failure(let error): throw error
        }
    }
}
