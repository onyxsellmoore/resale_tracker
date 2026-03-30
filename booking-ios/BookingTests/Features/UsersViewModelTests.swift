import XCTest
@testable import Booking

@MainActor
final class UsersViewModelTests: XCTestCase {

    private var keychain: KeychainService!
    private var session: URLSession!
    private var apiClient: APIClient!
    private var vm: UsersViewModel!

    override func setUp() {
        super.setUp()
        keychain = KeychainService.makeTestInstance()
        try! keychain.save(key: .accessToken, data: Data("test-token".utf8))
        session = MockURLProtocol.makeMockSession()
        apiClient = APIClient(session: session, baseURL: URL(string: "http://localhost:8080")!, keychain: keychain)
        vm = UsersViewModel(apiClient: apiClient)
    }

    override func tearDown() {
        keychain.clearAll()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testFetchUsers_callsGetUsersEndpoint() async throws {
        let users: [[String: Any]] = [
            ["id": "1", "email": "a@b.com", "displayName": "Admin", "role": "ADMIN"]
        ]
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/api/v1/users"))
            XCTAssertEqual(request.httpMethod, "GET")
            let data = try JSONSerialization.data(withJSONObject: users)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.fetchUsers()

        XCTAssertEqual(vm.users.count, 1)
        XCTAssertEqual(vm.users.first?.email, "a@b.com")
    }

    func testCreateUser_callsPostUsersEndpoint_withCorrectBody() async throws {
        var postCalled = false
        MockURLProtocol.requestHandler = { request in
            if request.httpMethod == "POST" {
                postCalled = true
                XCTAssertTrue(request.url!.path.contains("/api/v1/users"))
                let body = try JSONSerialization.jsonObject(with: request.httpBodyData!) as! [String: Any]
                XCTAssertEqual(body["email"] as? String, "new@test.com")
                XCTAssertEqual(body["displayName"] as? String, "New User")
                XCTAssertEqual(body["role"] as? String, "BUYER")
                let data = try JSONSerialization.data(withJSONObject: ["id": "2", "email": "new@test.com", "displayName": "New User", "role": "BUYER"])
                return (HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil)!, data)
            }
            // GET /users refresh after create
            let users: [[String: Any]] = [
                ["id": "1", "email": "a@b.com", "displayName": "Admin", "role": "ADMIN"],
                ["id": "2", "email": "new@test.com", "displayName": "New User", "role": "BUYER"]
            ]
            let data = try JSONSerialization.data(withJSONObject: users)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.createUser(email: "new@test.com", displayName: "New User", role: "BUYER")
        XCTAssertTrue(postCalled)
    }
}
