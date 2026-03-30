import Foundation

struct AnalyticsSummary: Decodable {
    let totalRevenue: MoneyDecimal
    let totalProfit: MoneyDecimal
    let totalSales: Int
    let averageProfit: MoneyDecimal
    let salesByPlatform: [PlatformBreakdown]
}

struct PlatformBreakdown: Decodable {
    let platform: String
    let count: Int
    let revenue: MoneyDecimal
}
