import Foundation

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: URL
    private let keychain: KeychainService
    private let refreshInterceptor: TokenRefreshInterceptor

    init(
        session: URLSession = .shared,
        baseURL: URL? = nil,
        keychain: KeychainService? = nil,
        refreshInterceptor: TokenRefreshInterceptor? = nil
    ) {
        self.session = session
        self.keychain = keychain ?? .shared
        if let baseURL {
            self.baseURL = baseURL
        } else {
            guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
                  let url = URL(string: urlString) else {
                fatalError("API_BASE_URL not set in Info.plist")
            }
            self.baseURL = url
        }
        self.refreshInterceptor = refreshInterceptor ?? .shared
    }

    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var urlRequest = buildURLRequest(endpoint)

        if endpoint.requiresAuth {
            if let tokenData = keychain.load(key: .accessToken),
               let token = String(data: tokenData, encoding: .utf8) {
                urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch let error as URLError {
            throw AuthError.networkError(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError("Invalid response")
        }

        switch http.statusCode {
        case 200...299:
            let decodeData = data.isEmpty ? Data("{}".utf8) : data
            return try JSONDecoder().decode(T.self, from: decodeData)
        case 401:
            // Only attempt token refresh for authenticated endpoints.
            // Auth endpoints return 401 to mean "invalid credentials", not "token expired".
            guard endpoint.requiresAuth else { throw AuthError.unauthorized }
            let newToken = try await refreshInterceptor.refresh()
            urlRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
            let (retryData, retryResponse) = try await session.data(for: urlRequest)
            let retryHTTP = retryResponse as! HTTPURLResponse
            if retryHTTP.statusCode == 401 { throw AuthError.unauthorized }
            return try JSONDecoder().decode(T.self, from: retryData)
        case 403:
            throw AuthError.forbidden
        case 400:
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["message"]
                ?? "Bad request"
            throw AuthError.badRequest(msg)
        default:
            throw AuthError.serverError(http.statusCode)
        }
    }

    private func buildURLRequest(_ endpoint: Endpoint) -> URLRequest {
        var components = URLComponents(
            url: URL(string: endpoint.path, relativeTo: baseURL)!,
            resolvingAgainstBaseURL: true
        )!
        components.queryItems = endpoint.queryItems

        var request = URLRequest(url: components.url!)
        request.httpMethod = endpoint.method
        request.httpBody = endpoint.body
        if endpoint.body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }
}
