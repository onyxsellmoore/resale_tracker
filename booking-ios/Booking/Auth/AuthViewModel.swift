import Foundation

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var role: String = ""
    @Published var orgId: String = ""
    @Published var errorMessage: String?
    @Published var isLoading = false

    private let passkeyProvider: any PasskeyLoginProvider
    private let keychain: KeychainService
    private let apiClient: APIClient

    private struct EmptyResponse: Decodable {
        init() {}
        init(from decoder: Decoder) throws {}
    }

    init(passkeyProvider: (any PasskeyLoginProvider)? = nil,
         keychain: KeychainService = .shared,
         apiClient: APIClient? = nil) {
        self.keychain = keychain
        // apiClient must be initialized before passkeyProvider since PasskeyService
        // might use .shared which reads Info.plist — tests inject both explicitly
        if let apiClient {
            self.apiClient = apiClient
        } else {
            self.apiClient = .shared
        }
        if let passkeyProvider {
            self.passkeyProvider = passkeyProvider
        } else {
            self.passkeyProvider = PasskeyService(apiClient: self.apiClient, keychain: keychain)
        }
    }

    func registerOrg(orgName: String, orgSlug: String,
                     adminEmail: String, adminDisplayName: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await passkeyProvider.createOrganization(
                orgName: orgName, orgSlug: orgSlug,
                adminEmail: adminEmail, adminDisplayName: adminDisplayName
            )
            let (accessToken, _) = try await passkeyProvider.registerPasskey(email: adminEmail)

            // Log in immediately after registration (matches web behavior)
            let claims = try decodeJWTClaims(accessToken)
            role = claims.role
            orgId = claims.orgId
            try keychain.save(key: .userRole, data: Data(claims.role.utf8))
            try keychain.save(key: .orgId, data: Data(claims.orgId.utf8))

            isAuthenticated = true
            errorMessage = nil
        } catch let e as PasskeyError {
            errorMessage = e.userMessage
        } catch {
            errorMessage = "Registration failed. Try again."
        }
    }

    func login(email: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let (accessToken, refreshToken) = try await passkeyProvider.loginWithPasskey(email: email)

            // Store tokens (may already be stored by PasskeyService.completeLogin,
            // but AuthViewModel is the authoritative owner of keychain state)
            try keychain.save(key: .accessToken, data: Data(accessToken.utf8))
            try keychain.save(key: .refreshToken, data: Data(refreshToken.utf8))

            // Decode JWT claims for role and orgId
            let claims = try decodeJWTClaims(accessToken)
            role = claims.role
            orgId = claims.orgId
            try keychain.save(key: .userRole, data: Data(claims.role.utf8))
            try keychain.save(key: .orgId, data: Data(claims.orgId.utf8))

            isAuthenticated = true
            errorMessage = nil
        } catch let e as PasskeyError {
            errorMessage = e.userMessage
        } catch {
            errorMessage = "Sign-in failed. Try again."
        }
    }

    func logout() async {
        // Best-effort server logout (swallow errors)
        if let rtData = keychain.load(key: .refreshToken),
           let rt = String(data: rtData, encoding: .utf8) {
            _ = try? await apiClient.request(.logout(token: rt)) as EmptyResponse
        }
        keychain.clearAll()
        isAuthenticated = false
        role = ""
        orgId = ""
    }

    func restoreSession() {
        // Called on app launch. If Keychain has tokens, skip login.
        // Token may be expired — TokenRefreshInterceptor handles that on first API call.
        guard keychain.load(key: .accessToken) != nil,
              let roleData = keychain.load(key: .userRole),
              let orgData = keychain.load(key: .orgId),
              let r = String(data: roleData, encoding: .utf8),
              let o = String(data: orgData, encoding: .utf8) else { return }
        role = r
        orgId = o
        isAuthenticated = true
    }
}
