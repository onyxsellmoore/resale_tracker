import Foundation

struct JWTClaims: Decodable {
    let sub: String
    let role: String
    let orgId: String

    enum CodingKeys: String, CodingKey {
        case sub
        case role
        case orgId = "org_id"
    }
}

func decodeJWTClaims(_ jwt: String) throws -> JWTClaims {
    let parts = jwt.split(separator: ".")
    guard parts.count == 3 else {
        throw AuthError.badRequest("Invalid JWT format")
    }
    let payload = String(parts[1])
    guard let data = Data(base64URLEncoded: payload) else {
        throw AuthError.badRequest("JWT payload is not valid base64url")
    }
    return try JSONDecoder().decode(JWTClaims.self, from: data)
}
