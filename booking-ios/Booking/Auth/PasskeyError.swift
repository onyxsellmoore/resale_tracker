import Foundation

enum PasskeyError: Error {
    case deviceNotCapable
    case userCancelled
    case notFoundOnDevice
    case attestationFailed(String)
    case assertionFailed(String)
    case networkError(Error)

    var userMessage: String {
        switch self {
        case .deviceNotCapable:
            return "Face ID is not available. To use passkeys on the Simulator, go to: Features \u{2192} Face ID \u{2192} Enrolled"
        case .userCancelled:
            return "Sign-in was cancelled."
        case .notFoundOnDevice:
            return "No passkey found on this device. Register a new passkey or use the device you registered on."
        case .attestationFailed(let m):
            return "Registration failed: \(m)"
        case .assertionFailed(let m):
            return "Sign-in failed: \(m)"
        case .networkError(let e):
            return "Network error: \(e.localizedDescription)"
        }
    }
}
