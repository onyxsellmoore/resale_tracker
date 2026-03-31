import XCTest
@testable import Booking

@MainActor
final class SalesViewModelTests: XCTestCase {

    private var keychain: KeychainService!
    private var session: URLSession!
    private var apiClient: APIClient!
    private var vm: SalesViewModel!

    override func setUp() {
        super.setUp()
        keychain = KeychainService.makeTestInstance()
        try! keychain.save(key: .accessToken, data: Data("test-token".utf8))
        session = MockURLProtocol.makeMockSession()
        apiClient = APIClient(session: session, baseURL: URL(string: "http://localhost:8080")!, keychain: keychain)
        vm = SalesViewModel(apiClient: apiClient)
    }

    override func tearDown() {
        keychain.clearAll()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testRecordSale_feesExceedPrice_setsValidationError_noAPICallMade() async throws {
        var apiCalled = false
        MockURLProtocol.requestHandler = { _ in
            apiCalled = true
            return (HTTPURLResponse(url: URL(string: "http://localhost")!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        let result = await vm.recordSale(itemId: "1", platform: "eBay",
                                          salePrice: Decimal(10), platformFees: Decimal(11))

        XCTAssertFalse(result)
        XCTAssertFalse(apiCalled)
        XCTAssertNotNil(vm.validationError)
        XCTAssertEqual(vm.validationError, "Platform fees cannot exceed sale price")
    }

    func testFetchSales_withFilters_includesPlatformAndDatesInURL() async throws {
        MockURLProtocol.requestHandler = { request in
            let url = request.url!.absoluteString
            XCTAssertTrue(url.contains("platform=eBay"))
            XCTAssertTrue(url.contains("from=2024-01-01"))
            XCTAssertTrue(url.contains("to=2024-12-31"))
            let data = try JSONSerialization.data(withJSONObject: [] as [Any])
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.fetchSales(platform: "eBay", from: "2024-01-01", to: "2024-12-31")

        XCTAssertEqual(vm.sales.count, 0)
    }

    // MARK: - Filtered Sales (search)

    private func loadTestSales() async {
        let sales: [[String: Any]] = [
            ["id": "1", "itemId": "1", "platform": "eBay",
             "salePrice": 150.0, "platformFees": 15.0,
             "netProceeds": 135.0, "profit": 35.0],
            ["id": "2", "itemId": "2", "platform": "Poshmark",
             "salePrice": 200.0, "platformFees": 40.0,
             "netProceeds": 160.0, "profit": 60.0],
            ["id": "3", "itemId": "3", "platform": "eBay",
             "salePrice": 80.0, "platformFees": 10.0,
             "netProceeds": 70.0, "profit": -30.0]
        ]
        MockURLProtocol.requestHandler = { request in
            let data = try JSONSerialization.data(withJSONObject: sales)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
        await vm.fetchSales()
    }

    func testFilteredSales_emptySearchText_returnsAllSales() async throws {
        await loadTestSales()

        let result = vm.filteredSales(searchText: "")

        XCTAssertEqual(result.count, 3)
    }

    func testFilteredSales_matchesByPlatform() async throws {
        await loadTestSales()

        let result = vm.filteredSales(searchText: "poshmark")

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.platform, "Poshmark")
    }

    func testSaleProfit_formatsAsCurrency_nonEmpty() async throws {
        let sale = Sale(id: "1", itemId: "1", platform: "eBay",
                        salePrice: MoneyDecimal(Decimal(150)),
                        platformFees: MoneyDecimal(Decimal(15)),
                        netProceeds: MoneyDecimal(Decimal(135)),
                        profit: MoneyDecimal(Decimal(35)))

        let formatted = sale.profit.value.currencyFormatted()

        XCTAssertFalse(formatted.isEmpty)
        XCTAssertTrue(formatted.contains("35"))
    }
}
