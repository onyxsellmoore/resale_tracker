import Foundation

struct MoneyDecimal: Codable, Equatable {
    let value: Decimal

    init(_ value: Decimal) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) {
            value = Decimal(string: s) ?? .zero
        } else if let d = try? c.decode(Double.self) {
            value = Decimal(string: String(d)) ?? .zero
        } else {
            value = .zero
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(value.description)
    }
}

extension Decimal {
    func currencyFormatted() -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = .current
        return f.string(from: self as NSDecimalNumber) ?? "$0.00"
    }
}
