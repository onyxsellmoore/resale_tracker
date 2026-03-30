import XCTest
@testable import Booking

final class Base64URLTests: XCTestCase {

    func testEncoding_standardBase64PlusBecomesHyphen() {
        // 0xFB in base64 is "+w==" -> base64url must use "-" not "+"
        let data = Data([0xFB])
        let encoded = data.base64URLEncoded()
        XCTAssertTrue(encoded.contains("-"), "Expected '-' in base64url output, got: \(encoded)")
        XCTAssertFalse(encoded.contains("+"), "Must not contain '+' in base64url output")
    }

    func testEncoding_noPaddingEquals() {
        // Data([0x01]) -> base64 "AQ==" -> base64url "AQ" (no padding)
        let data = Data([0x01])
        let encoded = data.base64URLEncoded()
        XCTAssertFalse(encoded.contains("="), "base64url must not contain '=' padding, got: \(encoded)")
    }

    func testRoundtrip_encodeDecodeReturnsOriginal() {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let original = Data(bytes)
        let encoded = original.base64URLEncoded()
        let decoded = Data(base64URLEncoded: encoded)
        XCTAssertEqual(decoded, original, "Round-trip encode/decode must return original data")
    }

    func testDecoding_invalidInput_returnsNil() {
        let decoded = Data(base64URLEncoded: "!!!")
        XCTAssertNil(decoded, "Invalid base64url input must return nil, not crash")
    }
}
