import Foundation
@testable import Booking

extension KeychainService {
    static func makeTestInstance() -> KeychainService {
        KeychainService(service: "com.test.\(UUID().uuidString)")
    }
}
