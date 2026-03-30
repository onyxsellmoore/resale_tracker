import Foundation

struct Sale: Identifiable, Codable {
    let id: String
    let itemId: String
    let platform: String
    let salePrice: MoneyDecimal
    let platformFees: MoneyDecimal
    let netProceeds: MoneyDecimal
    let profit: MoneyDecimal
}

struct CreateSaleRequest: Encodable {
    let itemId: String
    let platform: String
    let salePrice: MoneyDecimal
    let platformFees: MoneyDecimal
}
