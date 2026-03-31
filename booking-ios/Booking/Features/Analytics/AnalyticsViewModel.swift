import Foundation

enum DatePreset: String, CaseIterable, Identifiable {
    case thisMonth = "This Month"
    case lastMonth = "Last Month"
    case allTime = "All Time"

    var id: String { rawValue }
}

@MainActor
class AnalyticsViewModel: ObservableObject {
    @Published var summary: AnalyticsSummary?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var from: Date = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
    @Published var to: Date = Date()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func applyPreset(_ preset: DatePreset) {
        let cal = Calendar.current
        let now = Date()
        switch preset {
        case .thisMonth:
            from = cal.date(from: cal.dateComponents([.year, .month], from: now))!
            to = now
        case .lastMonth:
            let firstOfThisMonth = cal.date(from: cal.dateComponents([.year, .month], from: now))!
            from = cal.date(byAdding: .month, value: -1, to: firstOfThisMonth)!
            to = cal.date(byAdding: .day, value: -1, to: firstOfThisMonth)!
        case .allTime:
            from = Date.distantPast
            to = now
        }
        Task { await fetchAnalytics() }
    }

    static func profitMarginText(revenue: Decimal, profit: Decimal) -> String {
        guard revenue != 0 else { return "—" }
        let margin = (profit / revenue) * 100
        let handler = NSDecimalNumberHandler(
            roundingMode: .plain, scale: 1,
            raiseOnExactness: false, raiseOnOverflow: false,
            raiseOnUnderflow: false, raiseOnDivideByZero: false
        )
        let rounded = NSDecimalNumber(decimal: margin).rounding(accordingToBehavior: handler)
        return "\(rounded)%"
    }

    func fetchAnalytics() async {
        guard from <= to else {
            errorMessage = "Start date must be before end date"
            return
        }
        isLoading = true
        defer { isLoading = false }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let fromStr = formatter.string(from: from)
        let toStr = formatter.string(from: to)

        do {
            summary = try await apiClient.request(.getAnalytics(from: fromStr, to: toStr))
            errorMessage = nil
        } catch AuthError.forbidden {
            errorMessage = "Analytics requires Admin or Accountant role"
        } catch {
            errorMessage = "Failed to load analytics"
        }
    }
}
