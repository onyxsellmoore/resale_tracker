import Foundation

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
