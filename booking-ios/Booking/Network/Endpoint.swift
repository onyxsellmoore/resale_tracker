import Foundation

enum Endpoint {
    // Auth (no token required)
    case register(orgName: String, orgSlug: String, adminEmail: String, adminDisplayName: String)
    case registerBegin(email: String)
    case registerComplete([String: String])
    case loginBegin(email: String)
    case loginComplete([String: String])
    case refresh(token: String)
    case logout(token: String)
    // Items (token required)
    case getItems(status: String?)
    case getItem(id: String)
    case createItem([String: Any])
    case updateItem(id: String, body: [String: Any])
    case deleteItem(id: String)
    // Sales
    case getSales(platform: String?, from: String?, to: String?)
    case getSale(id: String)
    case createSale([String: Any])
    // Analytics
    case getAnalytics(from: String?, to: String?)
    // Users
    case getUsers
    case createUser([String: Any])
}

extension Endpoint {
    var path: String {
        switch self {
        case .register: "/api/v1/auth/register"
        case .registerBegin: "/api/v1/auth/register/begin"
        case .registerComplete: "/api/v1/auth/register/complete"
        case .loginBegin: "/api/v1/auth/login/begin"
        case .loginComplete: "/api/v1/auth/login/complete"
        case .refresh: "/api/v1/auth/refresh"
        case .logout: "/api/v1/auth/logout"
        case .getItems: "/api/v1/items"
        case .getItem(let id): "/api/v1/items/\(id)"
        case .createItem: "/api/v1/items"
        case .updateItem(let id, _): "/api/v1/items/\(id)"
        case .deleteItem(let id): "/api/v1/items/\(id)"
        case .getSales: "/api/v1/sales"
        case .getSale(let id): "/api/v1/sales/\(id)"
        case .createSale: "/api/v1/sales"
        case .getAnalytics: "/api/v1/analytics"
        case .getUsers: "/api/v1/users"
        case .createUser: "/api/v1/users"
        }
    }

    var method: String {
        switch self {
        case .register, .registerBegin, .registerComplete,
             .loginBegin, .loginComplete, .refresh, .logout,
             .createItem, .createSale, .createUser:
            "POST"
        case .getItems, .getItem, .getSales, .getSale, .getAnalytics, .getUsers:
            "GET"
        case .updateItem:
            "PATCH"
        case .deleteItem:
            "DELETE"
        }
    }

    var body: Data? {
        switch self {
        case .register(let orgName, let orgSlug, let adminEmail, let adminDisplayName):
            return try? JSONSerialization.data(withJSONObject: [
                "orgName": orgName, "orgSlug": orgSlug,
                "adminEmail": adminEmail, "adminDisplayName": adminDisplayName
            ])
        case .registerBegin(let email), .loginBegin(let email):
            return try? JSONSerialization.data(withJSONObject: ["email": email])
        case .registerComplete(let dict), .loginComplete(let dict):
            return try? JSONSerialization.data(withJSONObject: dict)
        case .refresh(let token):
            return try? JSONSerialization.data(withJSONObject: ["refreshToken": token])
        case .logout(let token):
            return try? JSONSerialization.data(withJSONObject: ["refreshToken": token])
        case .createItem(let dict), .createSale(let dict), .createUser(let dict):
            return try? JSONSerialization.data(withJSONObject: dict)
        case .updateItem(_, let dict):
            return try? JSONSerialization.data(withJSONObject: dict)
        default:
            return nil
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
        case .getItems(let status):
            guard let status else { return nil }
            return [URLQueryItem(name: "status", value: status)]
        case .getSales(let platform, let from, let to):
            var items: [URLQueryItem] = []
            if let platform { items.append(URLQueryItem(name: "platform", value: platform)) }
            if let from { items.append(URLQueryItem(name: "from", value: from)) }
            if let to { items.append(URLQueryItem(name: "to", value: to)) }
            return items.isEmpty ? nil : items
        case .getAnalytics(let from, let to):
            var items: [URLQueryItem] = []
            if let from { items.append(URLQueryItem(name: "from", value: from)) }
            if let to { items.append(URLQueryItem(name: "to", value: to)) }
            return items.isEmpty ? nil : items
        default:
            return nil
        }
    }

    var requiresAuth: Bool {
        switch self {
        case .register, .registerBegin, .registerComplete,
             .loginBegin, .loginComplete, .refresh, .logout:
            false
        default:
            true
        }
    }
}
