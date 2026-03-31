import XCTest
@testable import Booking

@MainActor
final class AnalyticsViewModelTests: XCTestCase {

    private var keychain: KeychainService!
    private var session: URLSession!
    private var apiClient: APIClient!
    private var vm: AnalyticsViewModel!

    override func setUp() {
        super.setUp()
        keychain = KeychainService.makeTestInstance()
        try! keychain.save(key: .accessToken, data: Data("test-token".utf8))
        session = MockURLProtocol.makeMockSession()
        apiClient = APIClient(session: session, baseURL: URL(string: "http://localhost:8080")!, keychain: keychain)
        vm = AnalyticsViewModel(apiClient: apiClient)
    }

    override func tearDown() {
        keychain.clearAll()
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testFetchAnalytics_callsGetAnalyticsEndpoint() async throws {
        let summary: [String: Any] = [
            "totalRevenue": 1000.0,
            "totalProfit": 500.0,
            "totalSales": 10,
            "averageProfit": 50.0,
            "salesByPlatform": [
                ["platform": "eBay", "count": 5, "revenue": 600.0],
                ["platform": "Poshmark", "count": 5, "revenue": 400.0]
            ]
        ]
        MockURLProtocol.requestHandler = { request in
            XCTAssertTrue(request.url!.path.contains("/api/v1/analytics"))
            XCTAssertEqual(request.httpMethod, "GET")
            let data = try JSONSerialization.data(withJSONObject: summary)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }

        await vm.fetchAnalytics()

        XCTAssertNotNil(vm.summary)
        XCTAssertEqual(vm.summary?.totalSales, 10)
    }

    func testDefaultFrom_isApproximately30DaysAgo() throws {
        let expected = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
        let diff = abs(vm.from.timeIntervalSince(expected))
        XCTAssertLessThan(diff, 60, "Default 'from' should be ~30 days ago")
    }

    // MARK: - Date Presets

    func testApplyPreset_thisMonth_setsFromToFirstDayOfCurrentMonth() async {
        stubAnalyticsResponse()

        vm.applyPreset(.thisMonth)
        // Allow the Task to run
        try? await Task.sleep(nanoseconds: 100_000_000)

        let cal = Calendar.current
        let expected = cal.date(from: cal.dateComponents([.year, .month], from: Date()))!
        XCTAssertEqual(cal.component(.year, from: vm.from), cal.component(.year, from: expected))
        XCTAssertEqual(cal.component(.month, from: vm.from), cal.component(.month, from: expected))
        XCTAssertEqual(cal.component(.day, from: vm.from), 1)
    }

    func testApplyPreset_lastMonth_setsFromToFirstDayOfPreviousMonth() async {
        stubAnalyticsResponse()

        vm.applyPreset(.lastMonth)
        try? await Task.sleep(nanoseconds: 100_000_000)

        let cal = Calendar.current
        let lastMonth = cal.date(byAdding: .month, value: -1, to: Date())!
        let expected = cal.date(from: cal.dateComponents([.year, .month], from: lastMonth))!
        XCTAssertEqual(cal.component(.year, from: vm.from), cal.component(.year, from: expected))
        XCTAssertEqual(cal.component(.month, from: vm.from), cal.component(.month, from: expected))
        XCTAssertEqual(cal.component(.day, from: vm.from), 1)
    }

    func testApplyPreset_allTime_setsFromToDistantPast() async {
        stubAnalyticsResponse()

        vm.applyPreset(.allTime)
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertTrue(vm.from < Date.distantPast.addingTimeInterval(86400 * 365 * 100))
    }

    // MARK: - Profit Margin

    func testProfitMargin_validRevenue_computesCorrectly() {
        let summary = AnalyticsSummary(
            totalRevenue: MoneyDecimal(200),
            totalProfit: MoneyDecimal(50),
            totalSales: 5,
            averageProfit: MoneyDecimal(10),
            salesByPlatform: []
        )
        let margin = AnalyticsViewModel.profitMarginText(revenue: summary.totalRevenue.value, profit: summary.totalProfit.value)
        XCTAssertEqual(margin, "25.0%")
    }

    func testProfitMargin_zeroRevenue_showsDash() {
        let margin = AnalyticsViewModel.profitMarginText(revenue: Decimal.zero, profit: Decimal(50))
        XCTAssertEqual(margin, "—")
    }

    func testProfitMargin_negativeProfit_showsNegative() {
        let margin = AnalyticsViewModel.profitMarginText(revenue: Decimal(100), profit: Decimal(-25))
        XCTAssertEqual(margin, "-25.0%")
    }

    // MARK: - Helpers

    private func stubAnalyticsResponse() {
        let summary: [String: Any] = [
            "totalRevenue": 1000.0,
            "totalProfit": 500.0,
            "totalSales": 10,
            "averageProfit": 50.0,
            "salesByPlatform": []
        ]
        MockURLProtocol.requestHandler = { request in
            let data = try JSONSerialization.data(withJSONObject: summary)
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, data)
        }
    }
}
