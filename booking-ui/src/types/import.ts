/** Supported import platforms. Must match backend Platform enum values exactly (case-sensitive uppercase). */
export type Platform = 'EBAY' | 'POSHMARK' | 'MERCARI'

/** A single validated row from the import preview. */
export interface ImportPreviewRow {
  rowNumber: number
  externalOrderId: string
  title: string
  saleDate: string          // ISO date string "YYYY-MM-DD"
  salePrice: number
  platformFees: number
  netProceeds: number
  isDuplicate: boolean
}

/** A parse/validation error from the import preview. */
export interface ImportError {
  rowNumber: number         // -1 for file-level errors
  field: string
  message: string
}

/** Response from POST /api/v1/imports/preview. */
export interface ImportPreviewResponse {
  platform: Platform
  totalRows: number
  validRows: number
  duplicateRows: number
  errorRows: number
  rowLimit: number          // always 2000 — cap communicated from server
  rows: ImportPreviewRow[]
  errors: ImportError[]
}

/** Response from POST /api/v1/imports/confirm. */
export interface ImportResultResponse {
  imported: number
  skippedDuplicates: number
  itemsNeedingCostReview: number  // always equals imported (every import has $0 default cost)
  batchErrors: number
}
