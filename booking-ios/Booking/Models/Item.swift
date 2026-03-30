import Foundation

struct Item: Identifiable, Codable {
    let id: String
    let name: String
    let brand: String
    let category: String
    let condition: String
    let purchasePrice: MoneyDecimal
    let purchaseDate: String
    let description: String?
    let notes: String?
    let status: String
}

struct CreateItemRequest: Encodable {
    let name: String
    let brand: String
    let category: String
    let condition: String
    let purchasePrice: MoneyDecimal
    let purchaseDate: String
    let description: String?
    let notes: String?
}
