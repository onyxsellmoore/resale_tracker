import XCTest
import os
@testable import Booking

final class TokenRefreshInterceptorTests: XCTestCase {
    var sut: TokenRefreshInterceptor!
    var mockSession: URLSession!
    var testKeychain: KeychainService!

    override func setUp() {
        super.setUp()
        mockSession = MockURLProtocol.makeMockSession()
        testKeychain = KeychainService.makeTestInstance()
        sut = TokenRefreshInterceptor(
            session: mockSession,
            keychain: testKeychain,
            baseURL: URL(string: "http://localhost:8080")!
        )
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        testKeychain.clearAll()
        super.tearDown()
    }

    func testRefresh_storesBothNewTokens_onSuccess() async throws {
        try testKeychain.save(key: .refreshToken, data: Data("old-refresh".utf8))

        MockURLProtocol.requestHandler = { request in
            let body = try JSONEncoder().encode(
                ["accessToken": "new-access", "refreshToken": "new-refresh"]
            )
            return (
                HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!, body
            )
        }

        let accessToken = try await sut.refresh()

        XCTAssertEqual(accessToken, "new-access")

        let storedAccess = testKeychain.load(key: .accessToken)
            .flatMap { String(data: $0, encoding: .utf8) }
        let storedRefresh = testKeychain.load(key: .refreshToken)
            .flatMap { String(data: $0, encoding: .utf8) }
        XCTAssertEqual(storedAccess, "new-access")
        XCTAssertEqual(storedRefresh, "new-refresh")
    }

    func testRefresh_clearsKeychain_onRefreshTokenExpired() async throws {
        try testKeychain.save(key: .accessToken, data: Data("old-access".utf8))
        try testKeychain.save(key: .refreshToken, data: Data("expired-refresh".utf8))

        MockURLProtocol.requestHandler = { request in
            (
                HTTPURLResponse(
                    url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil
                )!, Data()
            )
        }

        do {
            _ = try await sut.refresh()
            XCTFail("Expected AuthError.tokenExpired")
        } catch {
            XCTAssertEqual(error as? AuthError, .tokenExpired)
        }

        XCTAssertNil(testKeychain.load(key: .accessToken))
        XCTAssertNil(testKeychain.load(key: .refreshToken))
    }

    func testRefresh_concurrentCalls_onlyOneRefreshCallMade() async throws {
        try testKeychain.save(key: .refreshToken, data: Data("refresh-token".utf8))

        let refreshCallCount = OSAllocatedUnfairLock(initialState: 0)

        MockURLProtocol.requestHandler = { request in
            if request.url?.path == "/api/v1/auth/refresh" {
                refreshCallCount.withLock { $0 += 1 }
            }
            let body = try JSONEncoder().encode(
                ["accessToken": "new-access", "refreshToken": "new-refresh"]
            )
            return (
                HTTPURLResponse(
                    url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil
                )!, body
            )
        }

        async let r1 = sut.refresh()
        async let r2 = sut.refresh()
        async let r3 = sut.refresh()

        let _ = try await (r1, r2, r3)

        let count = refreshCallCount.withLock { $0 }
        XCTAssertEqual(count, 1, "Expected exactly 1 refresh call, got \(count)")
    }
}
