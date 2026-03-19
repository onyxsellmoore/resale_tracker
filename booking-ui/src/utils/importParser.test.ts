import { describe, it, expect } from 'vitest'
import { detectPlatform, validateCsvStructure, parseImportFile } from './importParser'

describe('detectPlatform', () => {
  it("returns 'Mercari' when headers include 'Mercari Selling Fee'", () => {
    expect(detectPlatform(['Item Title', 'Mercari Selling Fee', 'Item Price'])).toBe('Mercari')
  })

  it("returns 'Poshmark' when headers include 'Your Earnings'", () => {
    expect(detectPlatform(['Listing Title', 'Your Earnings', 'Order Price'])).toBe('Poshmark')
  })

  it('returns null for unrecognized headers', () => {
    expect(detectPlatform(['Name', 'Price', 'Date'])).toBeNull()
  })
})

describe('validateCsvStructure', () => {
  it('returns error for empty input', () => {
    expect(validateCsvStructure('')).toEqual({ valid: false, error: 'The file is empty.' })
    expect(validateCsvStructure('   ')).toEqual({ valid: false, error: 'The file is empty.' })
    expect(validateCsvStructure('\uFEFF')).toEqual({ valid: false, error: 'The file is empty.' })
  })

  it('returns error for single-line input with no newline', () => {
    expect(validateCsvStructure('just one line')).toEqual({
      valid: false,
      error: 'The file does not appear to be a valid CSV.',
    })
  })

  it('returns error when platform is unrecognized', () => {
    expect(validateCsvStructure('Name,Price\nFoo,10')).toEqual({
      valid: false,
      error: 'Unrecognized file format. Please upload a Mercari or Poshmark sales export.',
    })
  })

  it('returns error listing missing column names for Mercari export with columns removed', () => {
    const csv = 'Item Title,Mercari Selling Fee\nFoo,10'
    const result = validateCsvStructure(csv)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing required columns')
    expect(result.error).toContain('Item Price')
    expect(result.error).toContain('Payment Processing Fee')
    expect(result.error).toContain('Completed Date')
    expect(result.error).toContain('Order Status')
    expect(result.error).toContain('Item Id')
  })

  it('returns error listing missing column names for Poshmark export with columns removed', () => {
    const csv = 'Listing Title,Your Earnings\nFoo,10'
    const result = validateCsvStructure(csv)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing required columns')
    expect(result.error).toContain('Order Price')
    expect(result.error).toContain('Order Date')
    expect(result.error).toContain('Order Id')
  })

  it('returns error when all Mercari rows are non-Completed', () => {
    const csv = [
      '"Item Id","Sold Date","Canceled Date","Completed Date","Item Title","Order Status","Item Price","Mercari Selling Fee","Payment Processing Fee"',
      '"m1","2023-06-21","","","Title","Canceled","10.00","1.00","0.50"',
    ].join('\n')
    const result = validateCsvStructure(csv)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('No completed sales were found in this file.')
  })

  it('returns error when Poshmark file has metadata but zero data rows', () => {
    const csv = [
      'Poshmark Sales Report',
      'Notes:',
      '""',
      'Listing Date,Order Date,SKU,Order Id,Listing Title,Department,Category,Subcategory,Brand,Color,Size,Bundle Order?,Offer Order,NWT,Cost Price,Order Price,Lowest Set Price,Seller Shipping Discount,Upgraded Shipping Label Fee,Packaging Fee,Your Earnings,Buyer State',
    ].join('\n')
    const result = validateCsvStructure(csv)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('No completed sales were found in this file.')
  })

  it('returns valid: true for a well-formed minimal Mercari CSV', () => {
    const csv = [
      '"Item Id","Sold Date","Canceled Date","Completed Date","Item Title","Order Status","Item Price","Mercari Selling Fee","Payment Processing Fee"',
      '"m1","2023-06-21","","2023-06-25","Test Item","Completed","79.00","7.90","3.01"',
    ].join('\n')
    expect(validateCsvStructure(csv)).toEqual({ valid: true })
  })

  it('returns valid: true for a well-formed minimal Poshmark CSV', () => {
    const csv = [
      'Poshmark Sales Report,"","",Meow',
      '""',
      'Listing Date,Order Date,SKU,Order Id,Listing Title,Department,Category,Subcategory,Brand,Color,Size,Bundle Order?,Offer Order,NWT,Cost Price,Order Price,Lowest Set Price,Seller Shipping Discount,Upgraded Shipping Label Fee,Packaging Fee,Your Earnings,Buyer State',
      '07/02/2024,12/27/2024,"",676ef527,Off-white knitwear,Men,Sweaters,Crewneck,Off-White,"Cream",XL,N,Y,N,"",$150.00,$280.00,$0.00,$0.00,$0.00,$120.00,NC',
    ].join('\n')
    expect(validateCsvStructure(csv)).toEqual({ valid: true })
  })
})

describe('parseImportFile — Mercari', () => {
  const mercariCsv = [
    '"Item Id","Sold Date","Canceled Date","Completed Date","Item Title","Order Status","Shipped to State","Shipped from State","Item Price","Buyer Shipping Fee","Seller Shipping Fee","Mercari Selling Fee","Payment Processing Fee","Shipping Adjustment Fee","Net Seller Proceeds","Sales Tax Charged to Buyer","Merchant Fees Charged to Buyer"',
    '"m111","2023-06-21","","2023-06-25","Dior Spray","Completed","New York","Georgia","79.00","7.40","0.00","7.90","3.01","0.00","68.09","7.45","0.00"',
    '"m222","2023-06-21","","2023-06-25","Replica Perfume","Completed","California","Georgia","25.00","4.30","0.00","2.50","1.35","0.00","21.15","1.81","0.00"',
  ].join('\n')

  it('parses a minimal valid CSV string with 2 Completed rows', () => {
    const rows = parseImportFile(mercariCsv)
    expect(rows).toHaveLength(2)
    expect(rows[0].title).toBe('Dior Spray')
    expect(rows[1].title).toBe('Replica Perfume')
    expect(rows[0].platform).toBe('Mercari')
  })

  it('includes platformOrderId from Item Id column', () => {
    const rows = parseImportFile(mercariCsv)
    expect(rows[0].platformOrderId).toBe('m111')
    expect(rows[1].platformOrderId).toBe('m222')
  })

  it('sums Mercari Selling Fee and Payment Processing Fee into platformFees', () => {
    const rows = parseImportFile(mercariCsv)
    expect(rows[0].platformFees).toBeCloseTo(10.91) // 7.90 + 3.01
    expect(rows[1].platformFees).toBeCloseTo(3.85)  // 2.50 + 1.35
  })

  it('skips rows where Order Status is not Completed', () => {
    const csv = [
      '"Item Id","Sold Date","Canceled Date","Completed Date","Item Title","Order Status","Item Price","Mercari Selling Fee","Payment Processing Fee"',
      '"m1","2023-06-21","","2023-06-25","Good","Completed","10.00","1.00","0.50"',
      '"m2","2023-06-21","2023-06-22","","Bad","Canceled","10.00","1.00","0.50"',
    ].join('\n')
    const rows = parseImportFile(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Good')
  })

  it('strips BOM if present', () => {
    const csv = '\uFEFF' + mercariCsv
    const rows = parseImportFile(csv)
    expect(rows).toHaveLength(2)
  })

  it('returns empty array for unrecognized format', () => {
    const csv = 'Name,Price\nFoo,10'
    expect(parseImportFile(csv)).toEqual([])
  })
})

describe('parseImportFile — Poshmark', () => {
  const poshCsv = [
    'Poshmark Sales Report for @user,"","",Meow,Meow',
    '12/31/2024 - 12/31/2025',
    '""',
    'Listing Date,Order Date,SKU,Order Id,Listing Title,Department,Category,Subcategory,Brand,Color,Size,Bundle Order?,Offer Order,NWT,Cost Price,Order Price,Lowest Set Price,Seller Shipping Discount,Upgraded Shipping Label Fee,Packaging Fee,Your Earnings,Buyer State,Buyer Zip Code,Buyer Username,Sales Tax (Paid by Buyer),Notes,Other Info',
    '07/02/2024,12/27/2024,"",ORD001,Offwhite knitwear,Men,Sweaters,Crewneck,Off-White,"Cream",XL,N,Y,N,"",$150.00,$280.00,$0.00,$0.00,$0.00,$120.00,NC,28164,user1,$11.07,$0.00,"",',
    '06/25/2024,01/15/2025,"",ORD002,Canvas sneaker,Women,Shoes,,Prada,White,8.5,N,Y,N,$30.00,$110.00,$180.00,$0.00,$0.00,$0.00,$88.00,NC,28164,user2,$8.27,$0.00,"",',
  ].join('\n')

  it('skips metadata header lines and parses data rows', () => {
    const rows = parseImportFile(poshCsv)
    expect(rows).toHaveLength(2)
    expect(rows[0].title).toBe('Offwhite knitwear')
  })

  it('includes platformOrderId from Order Id column', () => {
    const rows = parseImportFile(poshCsv)
    expect(rows[0].platformOrderId).toBe('ORD001')
    expect(rows[1].platformOrderId).toBe('ORD002')
  })

  it('computes platformFees as Order Price minus Your Earnings', () => {
    const rows = parseImportFile(poshCsv)
    expect(rows[0].platformFees).toBeCloseTo(30) // 150 - 120
    expect(rows[1].platformFees).toBeCloseTo(22) // 110 - 88
  })

  it('converts MM/DD/YYYY Order Date to ISO string', () => {
    const rows = parseImportFile(poshCsv)
    expect(rows[0].soldAt).toBe('2024-12-27T00:00:00.000Z')
    expect(rows[1].soldAt).toBe('2025-01-15T00:00:00.000Z')
  })

  it('populates prefill.brand and prefill.category when present', () => {
    const rows = parseImportFile(poshCsv)
    expect(rows[0].prefill.brand).toBe('Off-White')
    expect(rows[0].prefill.category).toBe('Sweaters')
  })

  it('populates prefill.purchasePrice when Cost Price is non-empty and > 0', () => {
    const rows = parseImportFile(poshCsv)
    // Row 1 has empty Cost Price ("")
    expect(rows[0].prefill.purchasePrice).toBeUndefined()
    // Row 2 has Cost Price $30.00
    expect(rows[1].prefill.purchasePrice).toBe(30)
  })

  it('omits prefill.purchasePrice when Cost Price is empty or zero', () => {
    const csv = [
      '""',
      'Listing Date,Order Date,SKU,Order Id,Listing Title,Department,Category,Subcategory,Brand,Color,Size,Bundle Order?,Offer Order,NWT,Cost Price,Order Price,Lowest Set Price,Seller Shipping Discount,Upgraded Shipping Label Fee,Packaging Fee,Your Earnings,Buyer State',
      '07/02/2024,12/27/2024,"",ORD1,Item,Men,Cat,,Brand,Red,M,N,N,N,$0.00,$50.00,$50.00,$0.00,$0.00,$0.00,$40.00,NC',
    ].join('\n')
    const rows = parseImportFile(csv)
    expect(rows[0].prefill.purchasePrice).toBeUndefined()
  })
})
