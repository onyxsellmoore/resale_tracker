import XCTest
@testable import Booking

final class APIClientTests: XCTestCase {
    var sut: APIClient!
    var mockSession: URLSession!
    var testKeychain: KeychainService!
    var refreshInterceptor: TokenRefreshInterceptor!

    override func setUp() {
        super.setUp()
        mockSession = MockURLProtocol.makeMockSession()
        testKeychain = KeychainService.makeTestInstance()
        let baseURL = URL(string: "http://localhost:8080")!
        refreshInterceptor = TokenRefreshInterceptor(
            session: mockSession, keychain: testKeychain, baseURL: baseURL
        )
        sut = APIClient(
            session: mockSession,
            baseURL: baseURL,
            keychain: testKeychain,
            refreshInterceptor: refreshInterceptor
        )
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        testKeychain.clearAll()
        super.tearDown()
    }

    func testRequest_attachesBearerToken_whenKeychainHasToken() async throws {
        try testKeychain.save(key: .accessToken, data: Data("test-token".utf8))

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.allHTTPHeaderFields?["Authorization"], "Bearer test-token")
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
            )!
            let data = try JSONEncoder().encode(["message": "ok"])
            return (response, data)
        }

        let result: [String: String] = try await sut.request(.getUsers)
        XCTAssertEqual(result["message"], "ok")
    }

    func testRequest_returns401Error_onHTTP401Response() async throws {
        try testKeychain.save(key: .accessToken, data: Data("old-token".utf8))
        try testKeychain.save(key: .refreshToken, data: Data("refresh-token".utf8))

        MockURLProtocol.requestHandler = { request in
            if request.url?.path == "/api/v1/auth/refresh" {
                let body = try JSONEncoder().encode(
                    ["accessToken": "new-token", "refreshToken": "new-refresh"]
                )
                return (
                    HTTPURLResponse(
                        url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                    )!, body
                )
            }
            return (
                HTTPURLResponse(
                    url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil
                )!, Data()
            )
        }

        do {
            let _: [String: String] = try await sut.request(.getUsers)
            XCTFail("Expected AuthError.unauthorized")
        } catch {
            XCTAssertEqual(error as? AuthError, .unauthorized)
        }
    }

    func testRequest_returns403Error_onHTTP403Response() async throws {
        try testKeychain.save(key: .accessToken, data: Data("token".utf8))

        MockURLProtocol.requestHandler = { request in
            (
                HTTPURLResponse(
                    url: request.url!, statusCode: 403, httpVersion: nil, headerFields: nil
                )!, Data()
            )
        }

        do {
            let _: [String: String] = try await sut.request(.getUsers)
            XCTFail("Expected AuthError.forbidden")
        } catch {
            XCTAssertEqual(error as? AuthError, .forbidden)
        }
    }

    func testRequest_returnsNetworkError_onURLError() async throws {
        MockURLProtocol.requestHandler = { _ in
            throw URLError(.notConnectedToInternet)
        }

        do {
            let _: [String: String] = try await sut.request(.getUsers)
            XCTFail("Expected AuthError.networkError")
        } catch let error as AuthError {
            if case .networkError = error {
                // pass
            } else {
                XCTFail("Expected networkError, got \(error)")
            }
        }
    }

    func testRequest_returns500Error_onServerError() async throws {
        try testKeychain.save(key: .accessToken, data: Data("token".utf8))

        MockURLProtocol.requestHandler = { request in
            (
                HTTPURLResponse(
                    url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil
                )!, Data()
            )
        }

        do {
            let _: [String: String] = try await sut.request(.getUsers)
            XCTFail("Expected AuthError.serverError(500)")
        } catch {
            XCTAssertEqual(error as? AuthError, .serverError(500))
        }
    }
}
