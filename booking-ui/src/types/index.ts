export type ItemCondition = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
export type ItemStatus = 'AVAILABLE' | 'SOLD' | 'DELETED'

export interface ItemDTO {
  id: string
  businessId: string
  name: string
  brand: string | null
  category: string | null
  condition: ItemCondition
  purchasePrice: number
  purchaseDate: string
  description: string | null
  notes: string | null
  status: ItemStatus
  createdAt: string
  updatedAt: string
}

export interface CreateItemPayload {
  businessId: string
  name: string
  brand?: string
  category?: string
  condition: ItemCondition
  purchasePrice: number
  purchaseDate: string
  description?: string
  notes?: string
}

export interface UpdateItemPayload {
  name?: string
  brand?: string
  category?: string
  condition?: ItemCondition
  purchasePrice?: number
  purchaseDate?: string
  description?: string
  notes?: string
}

export interface UpdateSalePayload {
  platform?: string
  salePrice?: number
  platformFees?: number
  soldAt?: string
  notes?: string
}

export interface CreateSalePayload {
  businessId: string
  itemId: string
  platform: string
  salePrice: number
  platformFees: number
  soldAt: string
  platformOrderId?: string
  notes?: string
}

export interface SaleDTO {
  id: string
  businessId: string
  itemId: string
  itemName: string | null
  itemBrand: string | null
  platform: string
  salePrice: number
  platformFees: number
  netProceeds: number
  profit: number
  soldAt: string
  platformOrderId: string | null
  notes: string | null
  createdAt: string
}

export interface ParsedSaleRow {
  title: string
  platform: 'Mercari' | 'Poshmark'
  salePrice: number
  platformFees: number
  soldAt: string
  platformOrderId: string
  prefill: {
    brand?: string
    category?: string
    purchasePrice?: number
  }
}

export interface AnalyticsSummary {
  itemsSold: number
  totalRevenue: number
  totalFees: number
  totalNetProceeds: number
  totalCostOfGoods: number
  totalProfit: number
  averageMargin: number
}

export interface PlatformBreakdown {
  platform: string
  itemsSold: number
  totalRevenue: number
  totalProfit: number
}

export interface CategoryBreakdown {
  category: string
  itemsSold: number
  totalRevenue: number
  totalProfit: number
}

export interface MonthBreakdown {
  month: string
  itemsSold: number
  totalRevenue: number
  totalProfit: number
}

export interface AnalyticsResult {
  summary: AnalyticsSummary
  byPlatform: PlatformBreakdown[]
  byCategory: CategoryBreakdown[]
  byMonth: MonthBreakdown[]
}
