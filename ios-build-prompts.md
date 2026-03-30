# iOS App Build Prompts — Local Development
> Reviewed by iOS Architect + Prompt Engineer (two rounds).
> Target: Xcode Simulator only. No App Store. No production deployment.
> Send each phase to Claude Code in order. Do not start Phase N+1 until the GATE passes.

---

## Before You Start — Manual Steps (Do These First)

These cannot be automated. Complete them before running any phase:

**Required for all phases:**
- [ ] Confirm the Quarkus backend runs: `cd booking-api && ./mvnw quarkus:dev` → `http://localhost:8080`
- [ ] Confirm the web frontend runs: `cd booking-ui && npm run dev` → `http://localhost:5173`

**Required before Phase 2 (passkeys on Simulator):**
- [ ] In Xcode Simulator: menu bar → **Features → Face ID → Enrolled** (checkbox on)
- [ ] When a passkey prompt appears during testing: **Features → Face ID → Matching Face**
  *(Do this immediately when the prompt appears — it disappears quickly)*

**If you later want to test on a real personal device (not required for simulator dev):**
- [ ] Paid Apple Developer account ($99/yr)
- [ ] Add Associated Domains capability in Xcode: `webcredentials:YOURDOMAIN`
- [ ] Host `apple-app-site-association` at `https://YOURDOMAIN/.well-known/`
- [ ] Update backend `WEBAUTHN_RP_ID` + `WEBAUTHN_ALLOWED_ORIGINS` to match your domain

---

## Phase 0 — Backend: Multi-Origin WebAuthn *(mandatory before Phase 2)*

```
Read CONTEXT.md and booking-api/src/main/java/.../service/AuthService.java.

PROBLEM: The backend validates WebAuthn clientDataJSON.origin against one string:
  booking.webauthn.origin = http://localhost:5173  (default, in application.properties)

iOS native passkeys ALWAYS send origin = "https://" + rpId, regardless of rpId scheme.
With rpId=localhost (the dev default), iOS sends "https://localhost".
This does not match "http://localhost:5173" → passkey login/register ALWAYS fails.

NOTE: this is not a Safari vs Chrome difference. The iOS platform authenticator
(ASAuthorizationController) is outside the browser and always uses https://.

ALSO NOTE: application.properties line 27 sets the test profile origin:
  %test.booking.webauthn.origin=http://localhost:8081
This means the test profile uses a different value; update multi-origin logic to read
the allowed-origins list instead, and update the test profile accordingly.

━━━ TDD: WRITE TESTS RED FIRST ━━━
In the existing auth test class (SecurityEnabledProfile required):
  @Test void originValidation_iOSLocalhost_isAccepted()
    — build a fake clientDataJSON where origin = "https://localhost"
    — call whichever method in AuthService validates origin
    — assert no WebAuthnException (or equivalent rejection) is thrown

  @Test void originValidation_webLocalhost_isAccepted()
    — origin = "http://localhost:5173"
    — assert no exception thrown

  @Test void originValidation_unknownOrigin_isRejected()
    — origin = "https://evil.com"
    — assert WebAuthnException (or equivalent) is thrown

━━━ IMPLEMENT ━━━
1. application.properties — add:
     booking.webauthn.allowed-origins=${WEBAUTHN_ALLOWED_ORIGINS:http://localhost:5173,https://localhost}
   Keep existing booking.webauthn.origin for backward compat (other code may reference it).

2. Update %test profile to also use the list:
     %test.booking.webauthn.allowed-origins=http://localhost:8081,https://localhost

3. In AuthService.java:
   - Inject: @ConfigProperty(name="booking.webauthn.allowed-origins") String allowedOriginsRaw;
   - At @PostConstruct: parse into Set<String> with EXACT rules:
       • Split on comma
       • Trim whitespace from each entry
       • Lowercase each entry (origin comparison is case-insensitive per spec)
       • Reject empty strings (log a warning, skip the entry)
   - Replace the current single-string origin check with: allowedOrigins.contains(parsed.toLowerCase())
   - If allowedOrigins is empty after parsing: log ERROR and fail-fast at startup

4. Do NOT change any other test or application behavior.

━━━ GATE ━━━
./mvnw test must pass:
  — all 3 new origin tests GREEN
  — all existing tests GREEN (no regressions)
```

---

## Phase 1 — iOS Project Bootstrap + Network Layer

```
Read CONTEXT.md (§5 API Endpoints, §8 Engineering Rules, §11 Environment Variables).

━━━ PROJECT STRUCTURE ━━━
Create at the repo root:
  booking-ios/
    Booking.xcodeproj              ← Xcode project (NOT workspace; SPM only)
    Booking/
      BookingApp.swift             ← @main SwiftUI entry point
      Network/
        APIClient.swift
        Endpoint.swift
        TokenRefreshInterceptor.swift
      Keychain/
        KeychainService.swift
      Auth/
        AuthError.swift
    BookingTests/
      Helpers/
        MockURLProtocol.swift      ← URLProtocol subclass for mocking network
        TestKeychain.swift         ← Keychain wrapper with unique test service names
      Network/
        APIClientTests.swift
        TokenRefreshInterceptorTests.swift
      Keychain/
        KeychainServiceTests.swift

━━━ REQUIREMENTS ━━━
- Swift 5.9+, iOS 17+, SwiftUI, Xcode 15+
- Swift Package Manager only (no CocoaPods, no Carthage)
- Bundle ID: com.YOURCOMPANY.booking
  ← IMPORTANT: replace YOURCOMPANY with your actual reverse domain before any
     test runs. Bundle ID must be valid or Keychain operations will crash.
- In Xcode → Target → Signing & Capabilities, add:
    • Keychain Sharing: Access Group = Bundle ID (single-group, no sharing needed)
- Info.plist keys:
    API_BASE_URL  (String) = http://localhost:8080
    NSAppTransportSecurity → NSExceptionDomains → localhost →
      NSExceptionAllowsInsecureHTTPLoads = YES
  ← This is simulator dev only. Real devices need HTTPS — do NOT use this on production builds.
- URLSession only — no Alamofire, no third-party networking

━━━ HELPERS (create these before tests) ━━━

MockURLProtocol.swift:
  class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
      guard let handler = MockURLProtocol.requestHandler else {
        client?.urlProtocol(self, didFailWithError: URLError(.unknown)); return
      }
      do {
        let (response, data) = try handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
      } catch {
        client?.urlProtocol(self, didFailWithError: error)
      }
    }
    override func stopLoading() {}

    // Helper to create a URLSession that uses MockURLProtocol
    static func makeMockSession() -> URLSession {
      let config = URLSessionConfiguration.ephemeral
      config.protocolClasses = [MockURLProtocol.self]
      return URLSession(configuration: config)
    }
  }

TestKeychain.swift:
  // Provides an isolated KeychainService per test to prevent cross-test contamination
  // (Simulator Keychain is shared across all processes)
  extension KeychainService {
    static func makeTestInstance() -> KeychainService {
      // Pass a unique service string per test using UUID
      KeychainService(service: "com.test.\(UUID().uuidString)")
    }
  }
  // KeychainService must accept a service: String parameter in its init for this to work.

━━━ TDD: ALL TEST STUBS RED FIRST ━━━
Do not write implementation until all test stubs exist and fail (compile error or assertion fail).

APIClientTests.swift:
  func testRequest_attachesBearerToken_whenKeychainHasToken() async throws
    ← verify request.allHTTPHeaderFields["Authorization"] == "Bearer test-token"
  func testRequest_returns401Error_onHTTP401Response() async throws
  func testRequest_returns403Error_onHTTP403Response() async throws
  func testRequest_returnsNetworkError_onURLError() async throws
  func testRequest_returns500Error_onServerError() async throws

TokenRefreshInterceptorTests.swift:
  func testRefresh_storesBothNewTokens_onSuccess() async throws
    ← CRITICAL: backend returns {accessToken, refreshToken}; BOTH must be stored.
       Refresh tokens are SINGLE-USE and rotate on every call per CONTEXT.md §8.
       If only accessToken is stored, the next expiry cannot refresh → permanent logout.
  func testRefresh_clearsKeychain_onRefreshTokenExpired() async throws
  func testRefresh_concurrentCalls_onlyOneRefreshCallMade() async throws
    ← fire 3 concurrent async tasks that all hit the refresh path; count mock call invocations

KeychainServiceTests.swift:
  func testSaveAndLoad_roundtripsData() throws
  func testLoad_returnsNil_whenKeyAbsent() throws
  func testDelete_removesKey() throws
  ← All three tests must use TestKeychain.makeTestInstance() not KeychainService.shared

━━━ IMPLEMENT ━━━

1. AuthError.swift
   enum AuthError: Error, Equatable {
     case unauthorized           // HTTP 401
     case forbidden              // HTTP 403
     case badRequest(String)     // HTTP 400 — message from response body
     case serverError(Int)       // HTTP 5xx
     case networkError(String)   // URLError (use localizedDescription as String for Equatable)
     case tokenExpired           // refresh token is invalid/expired
   }

2. Endpoint.swift
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
     var path: String { /* e.g. case .register: return "/api/v1/auth/register" */ }
     var method: String { /* GET, POST, PATCH, DELETE */ }
     var body: Data? { /* JSON-encode associated dict or nil */ }
     var requiresAuth: Bool { /* false for auth endpoints, true for everything else */ }
   }

3. KeychainService.swift
   final class KeychainService {
     // Injectable service string makes testing safe (Simulator Keychain is global)
     let service: String
     init(service: String = Bundle.main.bundleIdentifier ?? "com.booking.app") {
       self.service = service
     }
     static let shared = KeychainService()

     enum Key: String {
       case accessToken  = "access_token"
       case refreshToken = "refresh_token"
       case userRole     = "user_role"
       case orgId        = "org_id"
     }

     func save(key: Key, data: Data) throws  // kSecItemAdd / kSecItemUpdate
     func load(key: Key) -> Data?            // kSecItemCopyMatching
     func delete(key: Key)                   // kSecItemDelete
     func clearAll()                         // call delete() for each Key case
     // kSecAttrAccessible = kSecAttrAccessibleAfterFirstUnlock for all items
   }

4. APIClient.swift
   final class APIClient {
     static let shared = APIClient()
     private let session: URLSession
     private let baseURL: URL  // read from Info.plist API_BASE_URL at init

     init(session: URLSession = .shared) {
       self.session = session
       // read Info.plist API_BASE_URL; fatal error if missing (config problem)
       guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
             let url = URL(string: urlString) else {
         fatalError("API_BASE_URL not set in Info.plist")
       }
       self.baseURL = url
     }

     func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
       var urlRequest = buildURLRequest(endpoint)  // combine baseURL + endpoint.path + params

       if endpoint.requiresAuth {
         if let tokenData = KeychainService.shared.load(key: .accessToken),
            let token = String(data: tokenData, encoding: .utf8) {
           // EXACT format required by backend SecurityFilter.java: "Authorization: Bearer <token>"
           urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
         }
       }

       let (data, response) = try await session.data(for: urlRequest)
       let http = response as! HTTPURLResponse

       switch http.statusCode {
       case 200...299:
         return try JSONDecoder().decode(T.self, from: data)
       case 401:
         // Attempt token refresh once, then retry
         let newToken = try await TokenRefreshInterceptor.shared.refresh()
         urlRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
         let (retryData, retryResponse) = try await session.data(for: urlRequest)
         let retryHTTP = retryResponse as! HTTPURLResponse
         if retryHTTP.statusCode == 401 { throw AuthError.unauthorized }
         return try JSONDecoder().decode(T.self, from: retryData)
       case 403: throw AuthError.forbidden
       case 400:
         let msg = (try? JSONDecoder().decode([String:String].self, from: data))?["message"] ?? "Bad request"
         throw AuthError.badRequest(msg)
       default: throw AuthError.serverError(http.statusCode)
       }
     }
   }

5. TokenRefreshInterceptor.swift

   // Swift actor guarantees serial execution — prevents concurrent refresh races.
   // If 3 requests get 401 simultaneously, only ONE refresh call goes to the backend.
   // The other 2 await the same Task result.

   actor TokenRefreshInterceptor {
     nonisolated static let shared = TokenRefreshInterceptor()
     private var refreshTask: Task<(access: String, refresh: String), Error>?

     struct RefreshResponse: Decodable {
       let accessToken: String
       let refreshToken: String
     }

     func refresh() async throws -> String {
       // If a refresh is already in flight, reuse it
       if let existing = refreshTask {
         let tokens = try await existing.value
         return tokens.access
       }

       let task = Task<(access: String, refresh: String), Error> {
         defer { Task { await self.clearRefreshTask() } }

         guard let rtData = KeychainService.shared.load(key: .refreshToken),
               let rt = String(data: rtData, encoding: .utf8) else {
           // Post on main thread — UI observation is on MainActor
           await MainActor.run {
             NotificationCenter.default.post(name: .authExpired, object: nil)
           }
           throw AuthError.tokenExpired
         }

         // POST /api/v1/auth/refresh
         let body = try JSONEncoder().encode(["refreshToken": rt])
         var req = URLRequest(url: URL(string: "/api/v1/auth/refresh", relativeTo: nil)!)
         req.httpMethod = "POST"
         req.httpBody = body
         req.setValue("application/json", forHTTPHeaderField: "Content-Type")

         let (data, response) = try await URLSession.shared.data(for: req)
         guard (response as? HTTPURLResponse)?.statusCode == 200 else {
           KeychainService.shared.clearAll()
           await MainActor.run {
             NotificationCenter.default.post(name: .authExpired, object: nil)
           }
           throw AuthError.tokenExpired
         }

         // CRITICAL: backend rotates BOTH tokens. Store both immediately.
         // Old refresh token is already invalid at this point.
         let result = try JSONDecoder().decode(RefreshResponse.self, from: data)
         KeychainService.shared.save(key: .accessToken,  data: Data(result.accessToken.utf8))
         KeychainService.shared.save(key: .refreshToken, data: Data(result.refreshToken.utf8))
         return (access: result.accessToken, refresh: result.refreshToken)
       }

       self.refreshTask = task
       let tokens = try await task.value
       return tokens.access
     }

     private func clearRefreshTask() { refreshTask = nil }
   }

   extension Notification.Name {
     static let authExpired = Notification.Name("booking.authExpired")
   }

━━━ GATE ━━━
xcodebuild test -scheme Booking -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
must pass all 9 tests with zero failures.
Then update CONTEXT.md §10 "Running the App":
  ### iOS (Simulator)
  Requirements: Xcode 15+, macOS 14+
  Open: open booking-ios/Booking.xcodeproj
  Run: Cmd+R — select iOS 17 simulator
  Test: Cmd+U, or:
    xcodebuild test -scheme Booking -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
  API target: http://localhost:8080 (set in Info.plist API_BASE_URL)
```

---

## Phase 2 — Passkey Auth (WebAuthn)
> **Phase 0 backend change must be deployed first.**
> **Manual step: Simulator → Features → Face ID → Enrolled before testing.**

```
Read CONTEXT.md (§5 auth endpoints, §8 security rules).
Confirm Phase 0 complete: AuthService accepts both http://localhost:5173 AND https://localhost.

━━━ CONTEXT: PASSKEY FLOWS ━━━

Registration (new org, one-time setup):
  Step 1: POST /api/v1/auth/register
    body: {orgName, orgSlug, adminEmail, adminDisplayName}
    → 201; creates Org + User in backend (no token returned at this step)

  Step 2: POST /api/v1/auth/register/begin
    body: {email: adminEmail}
    → {challenge: "base64url-string", rpId: "localhost", userId: "base64url-string"}

  Step 3: iOS presents ASAuthorizationController → user approves with Face ID

  Step 4: POST /api/v1/auth/register/complete
    body: {credentialId: base64url, attestationObject: base64url, clientDataJSON: base64url}
    → 200; credential stored in backend

  NOTE: registration does NOT return tokens. User must then log in.

Login:
  Step 1: POST /api/v1/auth/login/begin
    body: {email}
    → {challenge: "base64url-string", rpId: "localhost"}

  Step 2: iOS presents ASAuthorizationController → user approves with Face ID

  Step 3: POST /api/v1/auth/login/complete
    body: {credentialId, authenticatorData, clientDataJSON, signature, userHandle}
           — all base64url-encoded
    → {accessToken: "jwt-string", refreshToken: "opaque-string"}

ENCODING RULES:
  base64url = standard base64 with + → -, / → _, trailing = stripped, NO padding
  rpId: always read from backend response — never hardcode "localhost"
  challenge from backend arrives as base64url string → decode to Data before use
  attestationObject, clientDataJSON, authenticatorData, signature from iOS → encode to base64url before sending

━━━ SIMULATOR NOTE ━━━
rpId=localhost works on Simulator WITHOUT Associated Domains entitlement.
This ONLY works on the Simulator. On a real device, passkeys require:
  - Paid Apple Developer account
  - Associated Domains capability: webcredentials:YOURDOMAIN
  - apple-app-site-association hosted at your domain
  - Backend rpId updated to match your domain
Do not attempt device passkey testing without all four of the above.

━━━ CI NOTE ━━━
ASAuthorizationController requires interactive Face ID (manual user gesture).
Unit tests for PasskeyService CANNOT test the biometric presentation flow in CI.
Tests must mock the ASAuthorizationController response or test only the
network-call formatting layers. Mark biometric presentation tests as manual-only
with a // CI-SKIP comment and a note explaining why.

━━━ ADD FILES ━━━
booking-ios/Booking/Auth/
  Data+Base64URL.swift
  PasskeyError.swift
  PasskeyService.swift
  AuthViewModel.swift
  JWTDecoder.swift
booking-ios/Booking/Views/Auth/
  LoginView.swift
  RegisterView.swift
booking-ios/BookingTests/Auth/
  Base64URLTests.swift
  PasskeyServiceTests.swift
  AuthViewModelTests.swift

━━━ TDD: ALL STUBS RED FIRST ━━━

Base64URLTests.swift:
  func testEncoding_standardBase64PlusBecomesHyphen()
    — Data([0xFB]).base64URLEncoded() must contain "-" not "+"
  func testEncoding_noPaddingEquals()
    — any Data whose base64 would end with "=" must produce no "=" in base64url output
  func testRoundtrip_encodeDecodeReturnsOriginal()
    — random 32-byte Data → base64URLEncoded → init(base64URLEncoded:) → equals original
  func testDecoding_invalidInput_returnsNil()
    — init(base64URLEncoded: "!!!") must return nil, not crash

PasskeyServiceTests.swift (test network call formatting only — not ASAuthorizationController):
  func testRegisterStep1_postsCorrectJSONBody() async throws
    — POST /auth/register body contains orgName, orgSlug, adminEmail, adminDisplayName
  func testRegisterBegin_decodesChallenge_fromBase64URLToData() async throws
    — mock response {challenge:"abc-def_gh"} → verify decoded Data is passed to caller
  func testLoginComplete_storesBothAccessAndRefreshToken_inKeychain() async throws
    — mock /auth/login/complete → {accessToken:"at", refreshToken:"rt"}
    — verify both keys present in Keychain after call
  func testLoginComplete_missingToken_throwsError() async throws
  // CI-SKIP: biometric presentation tests require manual Face ID input on Simulator

AuthViewModelTests.swift:
  func testLogin_setsIsAuthenticated_onSuccess() async throws
  func testLogin_setsErrorMessage_onPasskeyError() async throws
  func testLogout_clearsAllKeychainKeys() async throws
  func testRestoreSession_setsIsAuthenticated_whenKeychainHasTokens()

━━━ IMPLEMENT ━━━

Data+Base64URL.swift:
  extension Data {
    func base64URLEncoded() -> String {
      base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .trimmingCharacters(in: CharacterSet(charactersIn: "="))
    }
    init?(base64URLEncoded string: String) {
      guard !string.isEmpty else { return nil }
      var b64 = string
        .replacingOccurrences(of: "-", with: "+")
        .replacingOccurrences(of: "_", with: "/")
      let remainder = b64.count % 4
      if remainder > 0 { b64 += String(repeating: "=", count: 4 - remainder) }
      self.init(base64Encoded: b64)
    }
  }

PasskeyError.swift:
  enum PasskeyError: Error {
    case deviceNotCapable    // no biometrics / passcode
    case userCancelled       // user dismissed prompt
    case notFoundOnDevice    // no passkey for this rpId on this device/iCloud account
    case attestationFailed(String)
    case assertionFailed(String)
    case networkError(Error)

    var userMessage: String {
      switch self {
      case .deviceNotCapable:
        return "Face ID is not available. To use passkeys on the Simulator, go to: Features → Face ID → Enrolled"
      case .userCancelled:
        return "Sign-in was cancelled."
      case .notFoundOnDevice:
        return "No passkey found on this device. Register a new passkey or use the device you registered on."
      case .attestationFailed(let m): return "Registration failed: \(m)"
      case .assertionFailed(let m):   return "Sign-in failed: \(m)"
      case .networkError(let e):      return "Network error: \(e.localizedDescription)"
      }
    }
  }

JWTDecoder.swift:
  // Decodes the claims payload from a JWT (middle segment, base64url-encoded JSON)
  // Does NOT verify the signature — backend already verified it when issuing the token
  struct JWTClaims: Decodable {
    let sub: String        // user ID
    let role: String       // ADMIN | BUYER | SELLER | ACCOUNTANT
    let org_id: String     // maps to "orgId" or "businessId" in backend

    // Fallback-safe: if backend adds fields later, this still works
  }

  func decodeJWTClaims(_ jwt: String) throws -> JWTClaims {
    let parts = jwt.split(separator: ".")
    guard parts.count == 3 else { throw AuthError.badRequest("Invalid JWT format") }
    let payload = String(parts[1])
    guard let data = Data(base64URLEncoded: payload) else {
      throw AuthError.badRequest("JWT payload is not valid base64url")
    }
    return try JSONDecoder().decode(JWTClaims.self, from: data)
  }

PasskeyService.swift (@MainActor, NSObject):
  Conforms to ASAuthorizationControllerDelegate + ASAuthorizationControllerPresentationContextProviding

  // Registration — two steps, called separately by AuthViewModel
  func createOrganization(orgName: String, orgSlug: String,
                          adminEmail: String, adminDisplayName: String) async throws
    // POST /api/v1/auth/register — uses APIClient.shared with .register endpoint
    // On HTTP 409: throw PasskeyError.attestationFailed("Organization slug already taken")

  func registerPasskey(email: String) async throws
    // POST /api/v1/auth/register/begin {email}
    // → decode response.challenge from base64url to Data
    // → decode response.userId from base64url to Data
    // → let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
    //       relyingPartyIdentifier: response.rpId)  // ALWAYS use server's rpId, never hardcode
    // → let regReq = provider.createCredentialRegistrationRequest(
    //       challenge: challengeData, name: email, userID: userIDData)
    // → present via ASAuthorizationController; await result via CheckedContinuation
    // → on success: POST /api/v1/auth/register/complete {
    //       credentialId:    credential.credentialID.base64URLEncoded(),
    //       attestationObject: credential.rawAttestationObject!.base64URLEncoded(),
    //       clientDataJSON:  credential.rawClientDataJSON.base64URLEncoded()
    //     }
    // → store continuation in @MainActor property; cancel it in deinit if still pending

  func loginWithPasskey(email: String) async throws -> (accessToken: String, refreshToken: String)
    // POST /api/v1/auth/login/begin {email}
    // → decode challenge; build assertion request; present ASAuthorizationController
    // → POST /api/v1/auth/login/complete {
    //       credentialId:      credential.credentialID.base64URLEncoded(),
    //       authenticatorData: credential.rawAuthenticatorData.base64URLEncoded(),
    //       clientDataJSON:    credential.rawClientDataJSON.base64URLEncoded(),
    //       signature:         credential.signature.base64URLEncoded(),
    //       userHandle:        credential.userID?.base64URLEncoded() ?? ""
    //     }
    // → return (accessToken, refreshToken) from response

  // ASAuthorizationControllerDelegate
  // ASAuthorizationError.Code.canceled      → PasskeyError.userCancelled
  // .credentialNotFound, .notInteractive   → PasskeyError.notFoundOnDevice
  // .failed + no biometric enrollment       → PasskeyError.deviceNotCapable
  // other                                   → PasskeyError.assertionFailed(error.localizedDescription)

  // presentationAnchor: return UIApplication.shared scene keyWindow

AuthViewModel.swift (@MainActor ObservableObject):
  @Published var isAuthenticated = false
  @Published var role: String = ""
  @Published var orgId: String = ""
  @Published var errorMessage: String?

  private let passkey = PasskeyService()
  private let keychain = KeychainService.shared

  func registerOrg(orgName: String, orgSlug: String,
                   adminEmail: String, adminDisplayName: String) async {
    do {
      try await passkey.createOrganization(orgName:orgName, orgSlug:orgSlug,
                                           adminEmail:adminEmail, adminDisplayName:adminDisplayName)
      try await passkey.registerPasskey(email: adminEmail)
      errorMessage = nil
      // Registration complete — user must now log in
    } catch let e as PasskeyError { errorMessage = e.userMessage }
    catch { errorMessage = "Registration failed. Try again." }
  }

  func login(email: String) async {
    do {
      let (accessToken, refreshToken) = try await passkey.loginWithPasskey(email: email)
      keychain.save(key: .accessToken,  data: Data(accessToken.utf8))
      keychain.save(key: .refreshToken, data: Data(refreshToken.utf8))
      let claims = try decodeJWTClaims(accessToken)
      role = claims.role
      orgId = claims.org_id
      keychain.save(key: .userRole, data: Data(claims.role.utf8))
      keychain.save(key: .orgId,    data: Data(claims.org_id.utf8))
      isAuthenticated = true
      errorMessage = nil
    } catch let e as PasskeyError { errorMessage = e.userMessage }
    catch { errorMessage = "Sign-in failed. Try again." }
  }

  func logout() async {
    if let rtData = keychain.load(key: .refreshToken),
       let rt = String(data: rtData, encoding: .utf8) {
      _ = try? await APIClient.shared.request(.logout(token: rt)) as EmptyResponse
    }
    keychain.clearAll()
    isAuthenticated = false
  }

  func restoreSession() {
    // Called on app launch. If Keychain has tokens, skip login.
    // The token may be expired — TokenRefreshInterceptor handles that on first API call.
    guard keychain.load(key: .accessToken) != nil,
          let roleData = keychain.load(key: .userRole),
          let orgData  = keychain.load(key: .orgId),
          let r = String(data: roleData, encoding: .utf8),
          let o = String(data: orgData,  encoding: .utf8) else { return }
    role  = r
    orgId = o
    isAuthenticated = true
  }

  // Empty codable for logout (no response body needed)
  private struct EmptyResponse: Decodable {}

LoginView.swift / RegisterView.swift:
  Visual structure matches LoginPage.tsx / OrgSetupPage.tsx:
    LoginView: app name + subtitle, email field, "Sign in with Passkey" button,
      ProgressView while loading, error banner (red bg, white text), "Register" link
    RegisterView: orgName, orgSlug, adminEmail, adminDisplayName fields,
      orgSlug validation (lowercase letters/numbers/hyphens only),
      "Create Organization & Register Passkey" button, error banner

━━━ GATE ━━━
xcodebuild test -scheme Booking passes all Phase 1 + Phase 2 tests.
Manual gate on Simulator (required — cannot be CI'd):
  1. Run app → tap Register → fill form → tap button → Face ID prompt appears
  2. Features → Face ID → Matching Face
  3. App shows "Registration complete — sign in" (or navigates to login)
  4. Tap Sign In → enter email → Face ID → navigates to main app
  5. Keychain inspector (Xcode → Debug → Keychain Viewer) shows access_token + refresh_token
```

---

## Phase 3 — Core Features (Inventory, Sales, Analytics, Users)

```
Read CONTEXT.md §4 (Role Permission Matrix) and §5 (API Endpoints).
Phases 1 and 2 must be complete and green.

━━━ MONEY RULE ━━━
Never use Double or Float for prices. All monetary values use Swift Decimal.
Backend sends prices as JSON numbers (e.g. 125.99). JSONDecoder maps these to
Double by default — this loses precision for large values.

Custom Decodable for all price fields:
  struct MoneyDecimal: Decodable {
    let value: Decimal
    init(from decoder: Decoder) throws {
      let c = try decoder.singleValueContainer()
      if let s = try? c.decode(String.self) {
        // Backend may send as string "125.99"
        value = Decimal(string: s) ?? .zero
      } else if let d = try? c.decode(Double.self) {
        // Backend sends as number 125.99 — round-trip through String to avoid float imprecision
        value = Decimal(string: String(d)) ?? .zero
      } else {
        // null or unexpected type → treat as zero, do not crash
        value = .zero
      }
    }
  }

  // Custom Encodable for POST bodies — send as String to avoid float JSON encoding
  extension MoneyDecimal: Encodable {
    func encode(to encoder: Encoder) throws {
      var c = encoder.singleValueContainer()
      try c.encode(value.description)  // sends "125.99" not 125.99 or 125.98999...
    }
  }

  // Display helper
  extension Decimal {
    func currencyFormatted() -> String {
      let f = NumberFormatter()
      f.numberStyle = .currency
      f.locale = .current
      return f.string(from: self as NSDecimalNumber) ?? "$0.00"
    }
  }

━━━ ROLE PERMISSION MATRIX (from CONTEXT.md §4) ━━━
  Feature           ADMIN  BUYER  SELLER  ACCOUNTANT
  Add Item            ✓      ✓      ✗       ✗
  Delete Item         ✓      ✗      ✗       ✗
  View Items          ✓      ✓      ✓       ✓
  Record Sale         ✓      ✗      ✓       ✗
  View Sales          ✓      ✓      ✓       ✓
  View Analytics      ✓      ✗      ✗       ✓
  Manage Users        ✓      ✗      ✗       ✗

IMPORTANT: Role checks in iOS are UI-only (hide/show buttons and tabs).
The BACKEND enforces these rules via 403 responses. Do NOT attempt to
replicate backend security in iOS — just surface the 403 error to the user
as "You don't have permission to do this."

━━━ MODELS ━━━
Add booking-ios/Booking/Models/:

Item.swift:
  struct Item: Identifiable, Codable {
    let id: String
    let name: String
    let brand: String
    let category: String
    let condition: String      // "EXCELLENT" | "GOOD" | "FAIR" | "POOR"
    let purchasePrice: MoneyDecimal
    let purchaseDate: String   // ISO8601 — format for display as needed
    let description: String?
    let notes: String?
    let status: String         // "AVAILABLE" | "SOLD"
    // Note: "DELETED" items are filtered server-side; iOS should never show them
  }

  // Separate request type — price as String for POST body
  struct CreateItemRequest: Encodable {
    let name: String; let brand: String; let category: String
    let condition: String; let purchasePrice: MoneyDecimal
    let purchaseDate: String  // ISO8601
    let description: String?; let notes: String?
    // NOTE: do NOT include businessId/orgId — backend extracts from JWT
  }

Sale.swift:
  struct Sale: Identifiable, Codable {
    let id: String; let itemId: String; let platform: String
    let salePrice: MoneyDecimal; let platformFees: MoneyDecimal
    let netProceeds: MoneyDecimal; let profit: MoneyDecimal
  }

  struct CreateSaleRequest: Encodable {
    let itemId: String; let platform: String
    let salePrice: MoneyDecimal; let platformFees: MoneyDecimal
    // NOTE: do NOT include businessId — backend extracts from JWT
  }

AnalyticsSummary.swift:
  struct AnalyticsSummary: Decodable {
    let totalRevenue: MoneyDecimal; let totalProfit: MoneyDecimal
    let totalSales: Int; let averageProfit: MoneyDecimal
    let salesByPlatform: [PlatformBreakdown]
  }
  struct PlatformBreakdown: Decodable {
    let platform: String; let count: Int; let revenue: MoneyDecimal
  }

AppUser.swift:
  struct AppUser: Identifiable, Decodable {
    let id: String; let email: String; let displayName: String; let role: String
  }

━━━ TDD: ALL TEST STUBS RED FIRST ━━━
All tests use MockURLProtocol from Phase 1. Zero real network calls.

InventoryViewModelTests.swift:
  func testFetchItems_requestsGetItemsEndpoint() async throws
  func testAddItem_emptyName_doesNotCallAPI_setsValidationError() async throws
  func testSoldItem_canDelete_returnsFalse() async throws
    ← item.status = "SOLD" → vm.canDelete(item) == false
  func testFetchItems_emptyResponse_setsIsEmptyTrue() async throws
  func testAvailableItems_filtersOutSoldItems() async throws
    ← items = [AVAILABLE, SOLD] → vm.availableItems.count == 1

SalesViewModelTests.swift:
  func testRecordSale_feesExceedPrice_setsValidationError_noAPICallMade() async throws
    ← salePrice=10.00, platformFees=11.00 → vm.validationError != nil + zero API calls
  func testFetchSales_withFilters_includesPlatformAndDatesInURL() async throws
  func testSaleProfit_formatsAsCurrency_nonEmpty() async throws

AnalyticsViewModelTests.swift:
  func testFetchAnalytics_callsGetAnalyticsEndpoint() async throws
  func testDefaultFrom_isApproximately30DaysAgo() throws
    ← abs(vm.from.timeIntervalSinceNow + 30*24*3600) < 60  (within 1 minute)
    ← use Calendar.current.date(byAdding:.day, value:-30, to:Date()) for reliable calc

UsersViewModelTests.swift:
  func testFetchUsers_callsGetUsersEndpoint() async throws
  func testCreateUser_callsPostUsersEndpoint_withCorrectBody() async throws

━━━ IMPLEMENT ━━━

### 3A — Inventory
booking-ios/Booking/Features/Inventory/

InventoryViewModel.swift (@MainActor ObservableObject):
  @Published var items: [Item] = []
  @Published var isLoading = false
  @Published var validationError: String?
  var isEmpty: Bool { !isLoading && items.isEmpty }
  var availableItems: [Item] { items.filter { $0.status == "AVAILABLE" } }
  func canDelete(_ item: Item) -> Bool { item.status != "SOLD" }

  func fetchItems() async
    — GET /api/v1/items (no status filter — fetch all for role-based display)
    — on success: set items (filter out DELETED server-side; they won't appear in response)

  func addItem(name:brand:category:condition:purchasePrice:purchaseDate:description:notes:) async
    — validate: name.isEmpty → validationError = "Name is required"; return early, no API call
    — validate: purchasePrice <= 0 → validationError = "Purchase price must be greater than zero"
    — POST /api/v1/items with CreateItemRequest
    — on 403: validationError = "You don't have permission to add items"
    — on success: call fetchItems() to refresh list

  func deleteItem(_ item: Item) async
    — guard canDelete(item) else { return }
    — DELETE /api/v1/items/:id
    — on 403: errorMessage = "You don't have permission to delete items"

ItemListView.swift:
  List of items, each row: name | brand | status badge
    AVAILABLE → green badge; SOLD → gray badge
  Pull-to-refresh (.refreshable modifier)
  Empty state when vm.isEmpty: icon + "No items yet. Add your first item to get started."
  Error banner when vm.errorMessage != nil: red background, dismissible
  Toolbar: "+" button → AddItemSheet (hidden if role == "SELLER" || role == "ACCOUNTANT")
  Swipe delete → vm.deleteItem (shown only if canDelete && role == "ADMIN")

AddItemSheet.swift:
  Required: name (TextField), purchasePrice (Decimal TextField)
  Optional: brand, category, condition (Picker: EXCELLENT/GOOD/FAIR/POOR),
            purchaseDate (DatePicker, default: today), description, notes (TextEditor)
  "Add Item" button disabled until name.nonEmpty && purchasePrice > 0
  Shows vm.validationError inline below relevant field

### 3B — Sales
booking-ios/Booking/Features/Sales/

SalesViewModel.swift (@MainActor ObservableObject):
  @Published var sales: [Sale] = []
  @Published var isLoading = false
  @Published var validationError: String?

  func fetchSales(platform: String? = nil, from: Date? = nil, to: Date? = nil) async
    — format dates as ISO8601 UTC strings for URL params
    — GET /api/v1/sales?platform=X&from=Y&to=Z (omit nil params)

  func recordSale(itemId:platform:salePrice:platformFees:) async -> Bool
    — validate: platformFees.value > salePrice.value
      → validationError = "Platform fees cannot exceed sale price"; return false (no API call)
    — POST /api/v1/sales with CreateSaleRequest
    — on 400: parse message from response body → validationError
    — on 403: validationError = "You don't have permission to record sales"
    — on success: return true, refresh sales list

SalesListView.swift:
  List rows: platform | salePrice.currencyFormatted() | profit.currencyFormatted()
  "Record Sale" button (hidden if role == "BUYER" || role == "ACCOUNTANT")
  RecordSaleSheet on tap

RecordSaleSheet.swift:
  @EnvironmentObject var inventoryVM: InventoryViewModel
  Item picker: inventoryVM.availableItems only (AVAILABLE items)
    — if empty: show "No available items. Add items first."
  Platform: TextField (free-form entry; common: eBay, Poshmark, Facebook, Depop, Other)
  salePrice, platformFees: Decimal TextFields
  Inline error if platformFees > salePrice
  "Record Sale" button disabled while error exists or required fields empty

### 3C — Analytics
booking-ios/Booking/Features/Analytics/

AnalyticsViewModel.swift (@MainActor ObservableObject):
  @Published var summary: AnalyticsSummary?
  @Published var isLoading = false
  @Published var errorMessage: String?
  @Published var from: Date = Calendar.current.date(byAdding:.day, value:-30, to:Date())!
  @Published var to: Date = Date()

  func fetchAnalytics() async
    — validate: from <= to → errorMessage = "Start date must be before end date"; return
    — GET /api/v1/analytics?from=ISO8601&to=ISO8601
    — on 403: errorMessage = "Analytics requires Admin or Accountant role"

AnalyticsView.swift:
  Date pickers: from + to (default last 30 days)
  "Fetch" button → vm.fetchAnalytics()
  Summary cards: Total Revenue | Total Profit | Total Sales | Avg Profit
  Swift Charts (import Charts) bar chart: X=platform, Y=revenue.value
  Empty state if vm.summary == nil && !vm.isLoading: "No data for this period"

### 3D — Users
booking-ios/Booking/Features/Users/

UsersViewModel.swift (@MainActor ObservableObject):
  fetchUsers() → GET /api/v1/users
  createUser(email:displayName:role:) → POST /api/v1/users {email, displayName, role}
    role must be one of: "ADMIN", "BUYER", "SELLER", "ACCOUNTANT"

UsersView.swift:
  List: displayName | email | role badge
  "Add Member" toolbar button → AddUserSheet
  Only shown in MainTabView when role == "ADMIN" (double-checked by backend 403)

### Navigation
booking-ios/Booking/Views/MainTabView.swift:
  @EnvironmentObject var authVM: AuthViewModel
  TabView — only include tabs based on authVM.role:
    Always: Inventory, Sales
    If role == "ADMIN" || role == "ACCOUNTANT": Analytics
    If role == "ADMIN": Users
  On .authExpired notification:
    dismiss any presented sheets
    authVM.isAuthenticated = false  ← triggers root view switch to LoginView
  Pass inventoryVM as @StateObject + @EnvironmentObject so Sales can access availableItems

━━━ GATE ━━━
xcodebuild test -scheme Booking passes all Phase 1 + 2 + 3 tests.
Manual gate on Simulator: add item → record sale → view analytics → verify all numbers match.
```

---

## Phase 4A — iOS Theming (Visual Parity with Web)

```
Read CONTEXT.md and booking-ui/src/theme.css (read the full file now — do not summarize).

━━━ CREATE THEME SYSTEM ━━━
booking-ios/Booking/Theme/AppTheme.swift:

Map EVERY CSS custom property in theme.css to a Swift equivalent.
For colors: add to Xcode Asset Catalog (Assets.xcassets) as Named Color Sets
with separate "Light Appearance" and "Dark Appearance" variants.
Check theme.css for @media (prefers-color-scheme: dark) overrides — use those for dark variants.

  enum AppTheme {
    enum Colors {
      // Populate from --color-* in theme.css
      // Example: static let primary = Color("Primary")
      // Add one entry per --color-* variable; add dark variant to xcassets
    }
    enum Radius {
      // Populate from --radius-* in theme.css (CGFloat values)
      // Example: static let sm: CGFloat = 4  // from --radius-sm
    }
    enum Typography {
      // Populate from --font-size-* in theme.css
      // Example: static let body = Font.system(size: 16, weight: .regular)
      // Note: web uses 'Playfair Display' (serif) + 'Inter' (sans-serif)
      // iOS equivalent: Font.system(design: .serif) for headings, .default for body
    }
    enum Spacing {
      // Populate from --spacing-* or derive from padding values in theme.css
    }
  }

  // ⚠️ MAINTENANCE: AppTheme.swift must be updated manually when theme.css changes.
  // After any design update to theme.css, diff it against this file and mirror the changes.

━━━ APPLY TO ALL VIEWS ━━━
Audit every view created in Phases 1–3. Replace ALL:
  • Hardcoded Color(hex:) or Color(.systemBlue) etc → AppTheme.Colors.*
  • Hardcoded CGFloat padding/corner radius → AppTheme.Spacing.* / AppTheme.Radius.*
  • Hardcoded Font.system(size:) → AppTheme.Typography.*

━━━ SCREEN PARITY AUDIT ━━━
For each pair below, compare visual structure and fix mismatches.
For each fix, add a comment: // PARITY FIX: <what was wrong>

  LoginView     ↔  booking-ui/src/pages/LoginPage.tsx
  RegisterView  ↔  booking-ui/src/pages/OrgSetupPage.tsx
  ItemListView  ↔  booking-ui/src/pages/InventoryPage.tsx
  SalesListView ↔  booking-ui/src/pages/SalesPage.tsx
  AnalyticsView ↔  booking-ui/src/pages/AnalyticsPage.tsx
  UsersView     ↔  booking-ui/src/pages/UsersPage.tsx

Check specifically:
  • Status badges: AVAILABLE=green, SOLD=gray — match web colors exactly
  • Primary button: background + corner radius match web
  • Error banner: red background, white text — match web error state
  • Empty state text: same message as web (or clearly adapted for iOS)
  • Currency formatting: same locale and precision as web

Test dark mode: Simulator → Features → Toggle Appearance (Shift+Cmd+A).
Note: Simulator dark mode persists only for current session; use Environment overrides
in Xcode Preview (#Preview { ... }.preferredColorScheme(.dark)) for faster iteration.

━━━ GATE ━━━
Side-by-side screenshot review: open web app and iOS Simulator simultaneously.
Each screen should look "family-similar" — same palette and tone, adapted for iOS idioms.
All hardcoded color/spacing values must be gone from view files (replaced by AppTheme.*).
```

---

## Phase 4B — Web L&F Audit + iOS Documentation

```
Read CONTEXT.md and all files in:
  booking-ui/src/pages/*.tsx
  booking-ui/src/components/**/*.tsx  (if directory exists)
  booking-ui/src/**/*.css

━━━ TASK 1: WEB L&F AUDIT ━━━

Severity definitions (apply these consistently):
  HIGH   = broken UX, user cannot complete a task, or data displayed incorrectly
  MEDIUM = confusing/inconsistent UX that hurts usability
  LOW    = stylistic nit that doesn't affect usability

Audit for these categories:
  A. Hardcoded hex/rgb/hsl color values in CSS files OR inline styles
     (anything not using a var(--color-*) CSS custom property)
  B. Inconsistent label/button text casing — pick ONE standard and flag deviations
  C. Data-fetching component with no loading indicator
  D. List/page with no empty-state message when data array is empty
  E. Error state that shows raw JSON, API error codes, or generic "Error"
     instead of a user-readable message
  F. Missing responsive styles for viewport width < 768px (check for media queries
     or flex/grid that collapses gracefully)
  G. Currency values displayed without consistent formatting
     (e.g., some show "$1000", some show "$1,000.00" — pick one standard)
  H. Any React class component or pre-hooks lifecycle method

Output a markdown table with these exact columns:
  | FILE | LINE | CATEGORY | SEVERITY | DESCRIPTION | RECOMMENDED FIX |

After the table:
  • Fix ALL high and medium severity issues directly in the source files
  • List low severity issues in the table only — do not change them
  • If any fix requires a backend change (not just frontend), mark fix as: BACKEND REQUIRED

━━━ TASK 2: CONTEXT.md §13 — iOS App ━━━
Append a new section to CONTEXT.md:

  ## 13. iOS App

  ### Requirements
  - Xcode 15+, macOS 14 Sonoma+
  - iOS 17+ Simulator (included with Xcode)

  ### Build & Run on Simulator
  ```bash
  open booking-ios/Booking.xcodeproj
  # Select iPhone 15 Pro simulator → Cmd+R
  # Or from command line:
  xcodebuild build -scheme Booking \
    -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
  ```

  ### Run iOS Tests
  ```bash
  xcodebuild test -scheme Booking \
    -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
  ```

  ### Info.plist Configuration
  - `API_BASE_URL` = `http://localhost:8080` for local dev
  - `NSExceptionDomains/localhost` = insecure HTTP allowed (dev only)

  ### Passkeys on Simulator
  Required setup before first run:
  1. Simulator menu → **Features → Face ID → Enrolled** (enables biometric capability)
  2. When the passkey prompt appears during registration or login:
     Simulator menu → **Features → Face ID → Matching Face**
     *(must do this quickly — the prompt times out)*
  3. `rpId = localhost` is automatically allowed by Simulator without Associated Domains

  Note: ASAuthorizationController (passkey UI) requires interactive Face ID input.
  Unit tests cannot automate this; the passkey presentation flow must be tested manually.

  ### Real Device Testing (Future — Not Required for Local Dev)
  - Requires paid Apple Developer account ($99/yr)
  - Requires Associated Domains capability + apple-app-site-association file at your domain
  - Requires backend `WEBAUTHN_RP_ID` updated to match your domain
  - Connect device → Xcode → Product → Run (select device as destination)
  - First run: Settings → General → VPN & Device Management → trust developer profile

  ### Passkey Cross-Device Sync (Future)
  - Passkeys sync via iCloud Keychain when rpId is a bare domain
  - Both devices must be signed into the same iCloud account with Keychain enabled
  - Simulator cannot sync passkeys between instances; use real devices for sync testing

━━━ GATE ━━━
All high + medium web issues are fixed and tests still pass.
CONTEXT.md §13 is complete.
Run: cd booking-ui && npm test -- --run  (all frontend tests still green after web fixes)
```

---

## Appendix: Key Decisions Made in These Prompts

| Topic | Decision | Reason |
|-------|----------|--------|
| Token refresh concurrency | Swift `actor` with shared `Task` | Prevents multi-refresh races; single-use tokens would be consumed by first caller |
| Both tokens on refresh | Explicit — store accessToken + refreshToken | Backend rotates both; old refreshToken is invalid immediately after use |
| Decimal precision | Custom `MoneyDecimal` + String round-trip | `JSONDecoder` → Double → silent precision loss |
| Separate request/response types | `CreateItemRequest: Encodable` vs `Item: Decodable` | POST needs String prices; GET needs Decimal parsing |
| rpId source | Always from server response | Never hardcode; makes prod migration trivial |
| Passkey tests | Network formatting only; biometric flow = manual | `ASAuthorizationController` cannot run in CI |
| Role enforcement | UI hides buttons; backend returns 403 | iOS role checks are UX only, never security |
| Associated Domains | Not needed for Simulator/localhost | Simplifies local dev; add later for real device |
| base64url encoding | Custom Data extension with tests | iOS stdlib has base64 but not base64url — silent mismatch without explicit implementation |
| JWT decode | Client-side payload only, no signature verify | Signature already verified by backend; client reads claims for UX |
