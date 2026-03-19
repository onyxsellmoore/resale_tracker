import type { ParsedSaleRow } from '../types'

export function detectPlatform(headers: string[]): 'Mercari' | 'Poshmark' | null {
  if (headers.some((h) => h === 'Mercari Selling Fee')) return 'Mercari'
  if (headers.some((h) => h === 'Your Earnings')) return 'Poshmark'
  return null
}

export function validateCsvStructure(csvText: string): { valid: boolean; error?: string } {
  const stripped = csvText.replace(/^\uFEFF/, '').trim()
  if (!stripped) return { valid: false, error: 'The file is empty.' }
  if (!stripped.includes('\n')) return { valid: false, error: 'The file does not appear to be a valid CSV.' }

  // Try to detect platform from any row's headers
  const lines = stripped.split('\n')
  let platform: 'Mercari' | 'Poshmark' | null = null
  let headerLine = ''
  for (const line of lines) {
    const headers = parseCsvLine(line)
    platform = detectPlatform(headers)
    if (platform) {
      headerLine = line
      break
    }
  }

  if (!platform) {
    return { valid: false, error: 'Unrecognized file format. Please upload a Mercari or Poshmark sales export.' }
  }

  const headers = parseCsvLine(headerLine)

  if (platform === 'Mercari') {
    const required = ['Item Title', 'Item Price', 'Mercari Selling Fee', 'Payment Processing Fee', 'Completed Date', 'Order Status', 'Item Id']
    const missing = required.filter((r) => !headers.includes(r))
    if (missing.length > 0) {
      return { valid: false, error: `Mercari export is missing required columns: ${missing.join(', ')}.` }
    }
    // Check for at least one completed row
    const headerIdx = lines.indexOf(headerLine)
    const dataLines = lines.slice(headerIdx + 1).filter((l) => l.trim())
    const statusIdx = headers.indexOf('Order Status')
    const hasCompleted = dataLines.some((line) => {
      const vals = parseCsvLine(line)
      return vals[statusIdx] === 'Completed'
    })
    if (!hasCompleted) return { valid: false, error: 'No completed sales were found in this file.' }
  }

  if (platform === 'Poshmark') {
    const required = ['Listing Title', 'Order Price', 'Your Earnings', 'Order Date', 'Order Id']
    const missing = required.filter((r) => !headers.includes(r))
    if (missing.length > 0) {
      return { valid: false, error: `Poshmark export is missing required columns: ${missing.join(', ')}.` }
    }
    const headerIdx = lines.indexOf(headerLine)
    const dataLines = lines.slice(headerIdx + 1).filter((l) => l.trim())
    if (dataLines.length === 0) return { valid: false, error: 'No completed sales were found in this file.' }
  }

  return { valid: true }
}

export function parseImportFile(csvText: string): ParsedSaleRow[] {
  const stripped = csvText.replace(/^\uFEFF/, '')
  const lines = stripped.split('\n')

  // Find the header line and detect platform
  let platform: 'Mercari' | 'Poshmark' | null = null
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const headers = parseCsvLine(lines[i])
    platform = detectPlatform(headers)
    if (platform) {
      headerIdx = i
      break
    }
  }

  if (!platform || headerIdx === -1) return []

  const headers = parseCsvLine(lines[headerIdx])
  const dataLines = lines.slice(headerIdx + 1).filter((l) => l.trim())

  if (platform === 'Mercari') return parseMercari(headers, dataLines)
  return parsePoshmark(headers, dataLines)
}

function parseMercari(headers: string[], dataLines: string[]): ParsedSaleRow[] {
  const col = (name: string) => headers.indexOf(name)
  const rows: ParsedSaleRow[] = []

  for (const line of dataLines) {
    const vals = parseCsvLine(line)
    if (vals[col('Order Status')] !== 'Completed') continue

    const sellingFee = parseFloat(vals[col('Mercari Selling Fee')]) || 0
    const processingFee = parseFloat(vals[col('Payment Processing Fee')]) || 0

    rows.push({
      platformOrderId: vals[col('Item Id')],
      title: vals[col('Item Title')],
      platform: 'Mercari',
      salePrice: parseFloat(vals[col('Item Price')]) || 0,
      platformFees: sellingFee + processingFee,
      soldAt: formatMercariDate(vals[col('Completed Date')]),
      prefill: {},
    })
  }

  return rows
}

function parsePoshmark(headers: string[], dataLines: string[]): ParsedSaleRow[] {
  const col = (name: string) => headers.indexOf(name)
  const rows: ParsedSaleRow[] = []

  for (const line of dataLines) {
    const vals = parseCsvLine(line)
    if (vals.length < headers.length / 2) continue // skip junk lines

    const orderPrice = parseDollar(vals[col('Order Price')])
    const earnings = parseDollar(vals[col('Your Earnings')])
    const costPriceRaw = vals[col('Cost Price')]
    const costPrice = parseDollar(costPriceRaw)
    const brand = vals[col('Brand')]?.trim()
    const category = vals[col('Category')]?.trim()

    const prefill: ParsedSaleRow['prefill'] = {}
    if (brand) prefill.brand = brand
    if (category) prefill.category = category
    if (costPrice > 0) prefill.purchasePrice = costPrice

    rows.push({
      platformOrderId: vals[col('Order Id')],
      title: vals[col('Listing Title')],
      platform: 'Poshmark',
      salePrice: orderPrice,
      platformFees: orderPrice - earnings,
      soldAt: formatPoshmarkDate(vals[col('Order Date')]),
      prefill,
    })
  }

  return rows
}

function formatMercariDate(dateStr: string): string {
  // YYYY-MM-DD → ISO
  return `${dateStr}T00:00:00.000Z`
}

function formatPoshmarkDate(dateStr: string): string {
  // MM/DD/YYYY → ISO
  const [month, day, year] = dateStr.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`
}

function parseDollar(val: string | undefined): number {
  if (!val) return 0
  return parseFloat(val.replace(/[$",]/g, '')) || 0
}

/**
 * Parse a single CSV line, handling quoted fields with commas and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let i = 0
  const len = line.length

  while (i <= len) {
    if (i === len) {
      result.push('')
      break
    }

    if (line[i] === '"') {
      // Quoted field
      let val = ''
      i++ // skip opening quote
      while (i < len) {
        if (line[i] === '"') {
          if (i + 1 < len && line[i + 1] === '"') {
            val += '"'
            i += 2
          } else {
            i++ // skip closing quote
            break
          }
        } else {
          val += line[i]
          i++
        }
      }
      result.push(val)
      if (i < len && line[i] === ',') i++ // skip comma
    } else {
      // Unquoted field
      const commaIdx = line.indexOf(',', i)
      if (commaIdx === -1) {
        result.push(line.slice(i).trim())
        break
      } else {
        result.push(line.slice(i, commaIdx).trim())
        i = commaIdx + 1
      }
    }
  }

  return result
}
