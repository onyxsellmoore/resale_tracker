import Foundation

@MainActor
class UsersViewModel: ObservableObject {
    @Published var users: [AppUser] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetchUsers() async {
        isLoading = true
        defer { isLoading = false }
        do {
            users = try await apiClient.request(.getUsers)
        } catch AuthError.forbidden {
            errorMessage = "You don't have permission to view users"
        } catch {
            errorMessage = "Failed to load users"
        }
    }

    func createUser(email: String, displayName: String, role: String) async {
        let body: [String: Any] = [
            "email": email, "displayName": displayName, "role": role
        ]
        do {
            struct Created: Decodable {}
            let _: Created = try await apiClient.request(.createUser(body))
            await fetchUsers()
        } catch AuthError.forbidden {
            errorMessage = "You don't have permission to create users"
        } catch {
            errorMessage = "Failed to create user"
        }
    }
}
