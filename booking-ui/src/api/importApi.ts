import axios from 'axios'
import { API_BASE } from './config'
import type { Platform, ImportPreviewResponse, ImportResultResponse, ImportPreviewRow } from '../types/import'

/**
 * Uploads a CSV to the preview endpoint. Does not commit data.
 * Do NOT set Content-Type manually — Axios auto-detects FormData and sets
 * multipart/form-data with the correct boundary.
 * @throws AxiosError 400 (file too large/wrong type), 403 (not ADMIN), 429 (rate limited)
 */
export async function previewImport(
  platform: Platform,
  file: File,
  token: string,
): Promise<ImportPreviewResponse> {
  const form = new FormData()
  form.append('platform', platform)
  form.append('file', file)
  const res = await axios.post(`${API_BASE}/imports/preview`, form, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}

/**
 * Commits previewed rows. Server re-validates all rows.
 * @throws AxiosError 400 (row limit exceeded), 403 (not ADMIN), 429 (rate limited)
 */
export async function confirmImport(
  platform: Platform,
  rows: ImportPreviewRow[],
  token: string,
): Promise<ImportResultResponse> {
  const res = await axios.post(
    `${API_BASE}/imports/confirm`,
    { platform, rows },
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return res.data
}
