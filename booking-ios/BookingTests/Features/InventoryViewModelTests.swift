import XCTest
@testable import Booking

@MainActor
final class InventoryViewModelTests: XCTestCase {

    private var keychain: KeychainService!
    private var session: URLSession!
    private var apiClient: APIClient!
    private var vm: InventoryViewModel!

    override func setUp() {
        super.setUp()
        keychain = KeychainService.makeTestInstance()
        try! keychain.save(key: .accessToken, data: Data("test-token".utf8))
        session = MockURLProtocol.makeMockSession()
        apiClient = APIClient(session: session, baseURL: URL(string: "http://localhost:8080")!, keychain: keychain)
        vm = InventoryViewModel(apiClient: apiClient)
    }

    override func tearDown() {
        keychain.clearAll()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testFetchItems_requestsGetItemsEndpoint() async throws {
        let items: [[String: Any]] = [
            ["id": "1", "name": "Bag", "brand": "LV", "category": "Bags",
             "condition": "EXCELLENT", "purchasePrice": 100.0,
             "purchaseDate": "2024-01-01", "status": "AVAILABLE"]
        ]
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/api/v1/items"))
            XCTAssertEqual(request.httpMethod, "GET")
            let data = try JSONSerialization.data(withJSONObject: items)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.fetchItems()

        XCTAssertEqual(vm.items.count, 1)
        XCTAssertEqual(vm.items.first?.name, "Bag")
    }

    func testAddItem_emptyName_doesNotCallAPI_setsValidationError() async throws {
        var apiCalled = false
        MockURLProtocol.requestHandler = { _ in
            apiCalled = true
            return (HTTPURLResponse(url: URL(string: "http://localhost")!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        await vm.addItem(name: "", brand: "LV", category: "Bags", condition: "GOOD",
                         purchasePrice: Decimal(100), purchaseDate: "2024-01-01",
                         description: nil, notes: nil)

        XCTAssertFalse(apiCalled)
        XCTAssertNotNil(vm.validationError)
        XCTAssertEqual(vm.validationError, "Name is required")
    }

    func testSoldItem_canDelete_returnsFalse() async throws {
        let item = Item(id: "1", name: "Bag", brand: "LV", category: "Bags",
                        condition: "GOOD", purchasePrice: MoneyDecimal(Decimal(100)),
                        purchaseDate: "2024-01-01", description: nil, notes: nil,
                        status: "SOLD")

        XCTAssertFalse(vm.canDelete(item))
    }

    func testFetchItems_emptyResponse_setsIsEmptyTrue() async throws {
        MockURLProtocol.requestHandler = { request in
            let data = try JSONSerialization.data(withJSONObject: [] as [Any])
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.fetchItems()

        XCTAssertTrue(vm.isEmpty)
    }

    func testAvailableItems_filtersOutSoldItems() async throws {
        let items: [[String: Any]] = [
            ["id": "1", "name": "Bag", "brand": "LV", "category": "Bags",
             "condition": "EXCELLENT", "purchasePrice": 100.0,
             "purchaseDate": "2024-01-01", "status": "AVAILABLE"],
            ["id": "2", "name": "Watch", "brand": "Rolex", "category": "Watches",
             "condition": "GOOD", "purchasePrice": 500.0,
             "purchaseDate": "2024-01-02", "status": "SOLD"]
        ]
        MockURLProtocol.requestHandler = { request in
            let data = try JSONSerialization.data(withJSONObject: items)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.fetchItems()

        XCTAssertEqual(vm.items.count, 2)
        XCTAssertEqual(vm.availableItems.count, 1)
        XCTAssertEqual(vm.availableItems.first?.name, "Bag")
    }
}
