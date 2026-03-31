import Foundation
import AuthenticationServices

// Protocol for testability — AuthViewModel depends on this, not the concrete class
@MainActor
protocol PasskeyLoginProvider {
    func createOrganization(orgName: String, orgSlug: String,
                            adminEmail: String, adminDisplayName: String) async throws
    func registerPasskey(email: String) async throws -> (accessToken: String, refreshToken: String)
    func loginWithPasskey(email: String) async throws -> (accessToken: String, refreshToken: String)
}

@MainActor
class PasskeyService: NSObject, PasskeyLoginProvider {

    private let apiClient: APIClient
    private let keychain: KeychainService

    // Continuation for bridging ASAuthorizationController delegate → async/await
    private var authorizationContinuation: CheckedContinuation<ASAuthorizationCredential, Error>?

    // MARK: - Response types

    struct RegisterBeginResponse: Decodable {
        let challenge: String
        let rp: RelyingParty
        let user: WebAuthnUser

        struct RelyingParty: Decodable {
            let id: String
            let name: String
        }

        struct WebAuthnUser: Decodable {
            let id: String
            let name: String
            let displayName: String
        }
    }

    struct LoginBeginResponse: Decodable {
        let challenge: String
        let rpId: String
    }

    struct LoginCompleteResponse: Decodable {
        let accessToken: String
        let refreshToken: String
    }

    struct EmptyResponse: Decodable {
        init() {}
        init(from decoder: Decoder) throws {}
    }

    // MARK: - Init

    init(apiClient: APIClient = .shared, keychain: KeychainService = .shared) {
        self.apiClient = apiClient
        self.keychain = keychain
        super.init()
    }

    // MARK: - Testable network methods (no ASAuthorizationController)

    func createOrganization(orgName: String, orgSlug: String,
                            adminEmail: String, adminDisplayName: String) async throws {
        do {
            let _: EmptyResponse = try await apiClient.request(
                .register(orgName: orgName, orgSlug: orgSlug,
                          adminEmail: adminEmail, adminDisplayName: adminDisplayName)
            )
        } catch AuthError.serverError(409) {
            // 409 = org already exists — this is fine, continue to passkey registration
            // (matches web behavior in OrgSetupPage.tsx)
            return
        } catch {
            throw PasskeyError.networkError(error)
        }
    }

    func beginRegistration(email: String) async throws -> RegisterBeginResponse {
        do {
            return try await apiClient.request(.registerBegin(email: email))
        } catch {
            throw PasskeyError.networkError(error)
        }
    }

    func completeRegistration(email: String, credentialId: String, attestationObject: String,
                              clientDataJSON: String) async throws -> (accessToken: String, refreshToken: String) {
        let response: LoginCompleteResponse
        do {
            response = try await apiClient.request(.registerComplete([
                "email": email,
                "credentialId": credentialId,
                "attestationObject": attestationObject,
                "clientDataJSON": clientDataJSON
            ]))
        } catch {
            throw PasskeyError.attestationFailed(error.localizedDescription)
        }
        try keychain.save(key: .accessToken, data: Data(response.accessToken.utf8))
        try keychain.save(key: .refreshToken, data: Data(response.refreshToken.utf8))
        return (response.accessToken, response.refreshToken)
    }

    func beginLogin(email: String) async throws -> LoginBeginResponse {
        do {
            return try await apiClient.request(.loginBegin(email: email))
        } catch {
            throw PasskeyError.networkError(error)
        }
    }

    func completeLogin(email: String, credentialId: String, authenticatorData: String,
                       clientDataJSON: String, signature: String) async throws -> (accessToken: String, refreshToken: String) {
        let response: LoginCompleteResponse
        do {
            response = try await apiClient.request(.loginComplete([
                "email": email,
                "credentialId": credentialId,
                "authenticatorData": authenticatorData,
                "clientDataJSON": clientDataJSON,
                "signature": signature
            ]))
        } catch {
            throw PasskeyError.assertionFailed(error.localizedDescription)
        }
        // CRITICAL: store BOTH tokens — refresh tokens are single-use and rotate
        try keychain.save(key: .accessToken, data: Data(response.accessToken.utf8))
        try keychain.save(key: .refreshToken, data: Data(response.refreshToken.utf8))
        return (response.accessToken, response.refreshToken)
    }

    // MARK: - Orchestration (involves ASAuthorizationController — CI-SKIP for testing)

    func registerPasskey(email: String) async throws -> (accessToken: String, refreshToken: String) {
        let beginResponse = try await beginRegistration(email: email)

        guard let challengeData = Data(base64URLEncoded: beginResponse.challenge) else {
            throw PasskeyError.attestationFailed("Invalid challenge encoding")
        }
        guard let userIdData = Data(base64URLEncoded: beginResponse.user.id) else {
            throw PasskeyError.attestationFailed("Invalid userId encoding")
        }

        // ALWAYS use server's rpId — never hardcode
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: beginResponse.rp.id
        )
        let regRequest = provider.createCredentialRegistrationRequest(
            challenge: challengeData, name: email, userID: userIdData
        )

        let credential = try await performAuthorization(requests: [regRequest])
        guard let registration = credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration else {
            throw PasskeyError.attestationFailed("Unexpected credential type")
        }
        guard let attestation = registration.rawAttestationObject else {
            throw PasskeyError.attestationFailed("Missing attestation object")
        }

        return try await completeRegistration(
            email: email,
            credentialId: registration.credentialID.base64URLEncoded(),
            attestationObject: attestation.base64URLEncoded(),
            clientDataJSON: registration.rawClientDataJSON.base64URLEncoded()
        )
    }

    func loginWithPasskey(email: String) async throws -> (accessToken: String, refreshToken: String) {
        let beginResponse = try await beginLogin(email: email)

        guard let challengeData = Data(base64URLEncoded: beginResponse.challenge) else {
            throw PasskeyError.assertionFailed("Invalid challenge encoding")
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: beginResponse.rpId
        )
        let assertionRequest = provider.createCredentialAssertionRequest(
            challenge: challengeData
        )

        let credential = try await performAuthorization(requests: [assertionRequest])
        guard let assertion = credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            throw PasskeyError.assertionFailed("Unexpected credential type")
        }

        return try await completeLogin(
            email: email,
            credentialId: assertion.credentialID.base64URLEncoded(),
            authenticatorData: assertion.rawAuthenticatorData.base64URLEncoded(),
            clientDataJSON: assertion.rawClientDataJSON.base64URLEncoded(),
            signature: assertion.signature.base64URLEncoded()
        )
    }

    // MARK: - ASAuthorizationController bridge

    private func performAuthorization(
        requests: [ASAuthorizationRequest]
    ) async throws -> ASAuthorizationCredential {
        // Cancel any lingering continuation to avoid "request already pending"
        authorizationContinuation?.resume(throwing: PasskeyError.userCancelled)
        authorizationContinuation = nil

        return try await withCheckedThrowingContinuation { continuation in
            self.authorizationContinuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: requests)
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension PasskeyService: ASAuthorizationControllerDelegate {
    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            authorizationContinuation?.resume(returning: authorization.credential)
            authorizationContinuation = nil
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let passkeyError: PasskeyError
        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                passkeyError = .userCancelled
            case .notInteractive:
                passkeyError = .notFoundOnDevice
            default:
                passkeyError = .assertionFailed(error.localizedDescription)
            }
        } else {
            passkeyError = .assertionFailed(error.localizedDescription)
        }
        Task { @MainActor in
            authorizationContinuation?.resume(throwing: passkeyError)
            authorizationContinuation = nil
        }
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension PasskeyService: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(
        for controller: ASAuthorizationController
    ) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let window = scene.keyWindow else {
                return ASPresentationAnchor()
            }
            return window
        }
    }
}
