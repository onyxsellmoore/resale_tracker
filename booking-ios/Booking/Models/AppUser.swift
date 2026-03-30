import Foundation

struct AppUser: Identifiable, Decodable {
    let id: String
    let email: String
    let displayName: String
    let role: String
}
