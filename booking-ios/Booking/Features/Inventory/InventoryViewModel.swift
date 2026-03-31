import Foundation

@MainActor
class InventoryViewModel: ObservableObject {
    @Published var items: [Item] = []
    @Published var isLoading = false
    @Published var validationError: String?
    @Published var errorMessage: String?

    var isEmpty: Bool { !isLoading && items.isEmpty }
    var availableItems: [Item] { items.filter { $0.status == "AVAILABLE" } }

    func filteredItems(searchText: String) -> [Item] {
        guard !searchText.isEmpty else { return items }
        let query = searchText.lowercased()
        return items.filter {
            $0.name.lowercased().contains(query) || $0.brand.lowercased().contains(query)
        }
    }

    func canDelete(_ item: Item) -> Bool { item.status != "SOLD" }

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchItems() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await apiClient.request(.getItems(status: nil))
        } catch {
            errorMessage = "Failed to load items"
        }
    }

    func addItem(name: String, brand: String, category: String, condition: String,
                 purchasePrice: Decimal, purchaseDate: String,
                 description: String?, notes: String?) async {
        validationError = nil
        guard !name.isEmpty else {
            validationError = "Name is required"
            return
        }
        guard purchasePrice > 0 else {
            validationError = "Purchase price must be greater than zero"
            return
        }

        let body: [String: Any] = [
            "name": name, "brand": brand, "category": category,
            "condition": condition, "purchasePrice": "\(purchasePrice)",
            "purchaseDate": purchaseDate,
            "description": description as Any, "notes": notes as Any
        ].compactMapValues { $0 }

        do {
            let _: Item = try await apiClient.request(.createItem(body))
            await fetchItems()
        } catch AuthError.forbidden {
            validationError = "You don't have permission to add items"
        } catch {
            errorMessage = "Failed to add item"
        }
    }

    func deleteItem(_ item: Item) async {
        guard canDelete(item) else { return }
        do {
            struct Empty: Decodable {}
            let _: Empty = try await apiClient.request(.deleteItem(id: item.id))
            items.removeAll { $0.id == item.id }
        } catch AuthError.forbidden {
            errorMessage = "You don't have permission to delete items"
        } catch {
            errorMessage = "Failed to delete item"
        }
    }
}
