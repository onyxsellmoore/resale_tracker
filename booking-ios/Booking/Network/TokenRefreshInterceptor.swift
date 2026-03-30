import Foundation

actor TokenRefreshInterceptor {
    nonisolated static let shared = TokenRefreshInterceptor()

    private let session: URLSession
    private let keychain: KeychainService
    private let baseURL: URL
    private var refreshTask: Task<(access: String, refresh: String), Error>?

    struct RefreshResponse: Decodable {
        let accessToken: String
        let refreshToken: String
    }

    init(
        session: URLSession = .shared,
        keychain: KeychainService = .shared,
        baseURL: URL? = nil
    ) {
        self.session = session
        self.keychain = keychain
        if let baseURL {
            self.baseURL = baseURL
        } else {
            let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String
                ?? "http://localhost:8080"
            self.baseURL = URL(string: urlString)!
        }
    }

    func refresh() async throws -> String {
        if let existing = refreshTask {
            let tokens = try await existing.value
            return tokens.access
        }

        let task = Task<(access: String, refresh: String), Error> { [session, keychain, baseURL] in
            guard let rtData = keychain.load(key: .refreshToken),
                  let rt = String(data: rtData, encoding: .utf8) else {
                await MainActor.run {
                    NotificationCenter.default.post(name: .authExpired, object: nil)
                }
                throw AuthError.tokenExpired
            }

            let body = try JSONEncoder().encode(["refreshToken": rt])
            var req = URLRequest(url: URL(string: "/api/v1/auth/refresh", relativeTo: baseURL)!)
            req.httpMethod = "POST"
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let (data, response) = try await session.data(for: req)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                keychain.clearAll()
                await MainActor.run {
                    NotificationCenter.default.post(name: .authExpired, object: nil)
                }
                throw AuthError.tokenExpired
            }

            let result = try JSONDecoder().decode(RefreshResponse.self, from: data)
            try keychain.save(key: .accessToken, data: Data(result.accessToken.utf8))
            try keychain.save(key: .refreshToken, data: Data(result.refreshToken.utf8))
            return (access: result.accessToken, refresh: result.refreshToken)
        }

        self.refreshTask = task
        do {
            let tokens = try await task.value
            self.refreshTask = nil
            return tokens.access
        } catch {
            self.refreshTask = nil
            throw error
        }
    }
}

extension Notification.Name {
    static let authExpired = Notification.Name("booking.authExpired")
}
