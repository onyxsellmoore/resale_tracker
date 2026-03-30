import Foundation

@MainActor
class SalesViewModel: ObservableObject {
    @Published var sales: [Sale] = []
    @Published var isLoading = false
    @Published var validationError: String?
    @Published var errorMessage: String?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchSales(platform: String? = nil, from: String? = nil, to: String? = nil) async {
        isLoading = true
        defer { isLoading = false }
        do {
            sales = try await apiClient.request(.getSales(platform: platform, from: from, to: to))
        } catch {
            errorMessage = "Failed to load sales"
        }
    }

    func recordSale(itemId: String, platform: String,
                    salePrice: Decimal, platformFees: Decimal) async -> Bool {
        validationError = nil
        guard platformFees <= salePrice else {
            validationError = "Platform fees cannot exceed sale price"
            return false
        }

        let body: [String: Any] = [
            "itemId": itemId, "platform": platform,
            "salePrice": "\(salePrice)", "platformFees": "\(platformFees)"
        ]

        do {
            let _: Sale = try await apiClient.request(.createSale(body))
            await fetchSales()
            return true
        } catch AuthError.badRequest(let msg) {
            validationError = msg
            return false
        } catch AuthError.forbidden {
            validationError = "You don't have permission to record sales"
            return false
        } catch {
            errorMessage = "Failed to record sale"
            return false
        }
    }
}
