import XCTest
@testable import Booking

@MainActor
final class PasskeyServiceTests: XCTestCase {
    var sut: PasskeyService!
    var mockSession: URLSession!
    var testKeychain: KeychainService!
    var apiClient: APIClient!

    override func setUp() {
        super.setUp()
        mockSession = MockURLProtocol.makeMockSession()
        testKeychain = KeychainService.makeTestInstance()
        let baseURL = URL(string: "http://localhost:8080")!
        let refreshInterceptor = TokenRefreshInterceptor(
            session: mockSession, keychain: testKeychain, baseURL: baseURL
        )
        apiClient = APIClient(
            session: mockSession, baseURL: baseURL,
            keychain: testKeychain, refreshInterceptor: refreshInterceptor
        )
        sut = PasskeyService(apiClient: apiClient, keychain: testKeychain)
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        testKeychain.clearAll()
        super.tearDown()
    }

    // MARK: - Network formatting tests (CI-safe)

    func testRegisterStep1_postsCorrectJSONBody() async throws {
        var capturedBody: [String: String]?

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertTrue(request.url!.path.contains("/auth/register"))
            if let bodyData = request.httpBodyData {
                capturedBody = try? JSONDecoder().decode([String: String].self, from: bodyData)
            }
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil
            )!
            return (response, Data("{}".utf8))
        }

        try await sut.createOrganization(
            orgName: "Test Org", orgSlug: "test-org",
            adminEmail: "admin@test.com", adminDisplayName: "Admin"
        )

        XCTAssertEqual(capturedBody?["orgName"], "Test Org")
        XCTAssertEqual(capturedBody?["orgSlug"], "test-org")
        XCTAssertEqual(capturedBody?["adminEmail"], "admin@test.com")
        XCTAssertEqual(capturedBody?["adminDisplayName"], "Admin")
    }

    func testRegisterBegin_decodesChallenge_fromBase64URLToData() async throws {
        let challenge = "abc-def_gh"

        MockURLProtocol.requestHandler = { request in
            let responseDict: [String: Any] = [
                "challenge": challenge,
                "rp": ["id": "localhost", "name": "Booking"],
                "user": ["id": "dXNlcl8xMjM", "name": "admin@test.com", "displayName": "Admin"],
                "pubKeyCredParams": [["type": "public-key", "alg": -7]],
                "timeout": 60000
            ]
            let body = try JSONSerialization.data(withJSONObject: responseDict)
            return (
                HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!, body
            )
        }

        let response = try await sut.beginRegistration(email: "admin@test.com")
        XCTAssertEqual(response.challenge, challenge)
        XCTAssertEqual(response.rp.id, "localhost")
        XCTAssertEqual(response.user.id, "dXNlcl8xMjM")

        // Verify the challenge can be decoded from base64url to Data
        let challengeData = Data(base64URLEncoded: response.challenge)
        XCTAssertNotNil(challengeData, "Challenge should be decodable from base64url to Data")
    }

    func testLoginComplete_storesBothAccessAndRefreshToken_inKeychain() async throws {
        MockURLProtocol.requestHandler = { request in
            let body = try JSONEncoder().encode([
                "accessToken": "test-access-jwt",
                "refreshToken": "test-refresh-opaque"
            ])
            return (
                HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!, body
            )
        }

        let tokens = try await sut.completeLogin(
            email: "admin@test.com", credentialId: "cred123", authenticatorData: "authdata",
            clientDataJSON: "clientjson", signature: "sig"
        )

        XCTAssertEqual(tokens.accessToken, "test-access-jwt")
        XCTAssertEqual(tokens.refreshToken, "test-refresh-opaque")

        // CRITICAL: both tokens must be in keychain
        let storedAccess = testKeychain.load(key: .accessToken)
            .flatMap { String(data: $0, encoding: .utf8) }
        let storedRefresh = testKeychain.load(key: .refreshToken)
            .flatMap { String(data: $0, encoding: .utf8) }
        XCTAssertEqual(storedAccess, "test-access-jwt")
        XCTAssertEqual(storedRefresh, "test-refresh-opaque")
    }

    func testLoginComplete_missingToken_throwsError() async throws {
        MockURLProtocol.requestHandler = { request in
            // Response is missing refreshToken — decode must fail
            let body = Data("{\"accessToken\":\"at\"}".utf8)
            return (
                HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!, body
            )
        }

        do {
            _ = try await sut.completeLogin(
                email: "admin@test.com", credentialId: "cred", authenticatorData: "auth",
                clientDataJSON: "client", signature: "sig"
            )
            XCTFail("Expected error for missing token field")
        } catch {
            // Any error is acceptable — JSONDecoder should fail on missing required field
        }
    }

    // CI-SKIP: biometric presentation tests require manual Face ID input on Simulator.
    // ASAuthorizationController cannot be unit-tested without interactive user gesture.
}
