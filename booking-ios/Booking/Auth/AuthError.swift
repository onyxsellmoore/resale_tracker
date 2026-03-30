import Foundation

enum AuthError: Error, Equatable {
    case unauthorized
    case forbidden
    case badRequest(String)
    case serverError(Int)
    case networkError(String)
    case tokenExpired
}
