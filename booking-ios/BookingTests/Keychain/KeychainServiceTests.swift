import XCTest
@testable import Booking

final class KeychainServiceTests: XCTestCase {
    var sut: KeychainService!

    override func setUp() {
        super.setUp()
        sut = KeychainService.makeTestInstance()
    }

    override func tearDown() {
        sut.clearAll()
        super.tearDown()
    }

    func testSaveAndLoad_roundtripsData() throws {
        let data = Data("my-secret-token".utf8)
        try sut.save(key: .accessToken, data: data)

        let loaded = sut.load(key: .accessToken)
        XCTAssertEqual(loaded, data)
    }

    func testLoad_returnsNil_whenKeyAbsent() throws {
        let loaded = sut.load(key: .refreshToken)
        XCTAssertNil(loaded)
    }

    func testDelete_removesKey() throws {
        try sut.save(key: .accessToken, data: Data("token".utf8))
        sut.delete(key: .accessToken)

        let loaded = sut.load(key: .accessToken)
        XCTAssertNil(loaded)
    }
}
