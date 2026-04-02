import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuth } from '../auth/AuthContext'
import { previewImport, confirmImport } from '../api/importApi'
import type { Platform, ImportPreviewResponse, ImportResultResponse } from '../types/import'
import './ImportPage.css'

type Step = 'PLATFORM_SELECT' | 'FILE_UPLOAD' | 'PREVIEW' | 'SUCCESS'

/** Platform metadata for the selection cards. */
const PLATFORMS: { id: Platform; name: string; description: string; path: string }[] = [
  { id: 'EBAY', name: 'eBay', description: 'Seller Hub orders export', path: 'Seller Hub → Orders → Download report' },
  { id: 'POSHMARK', name: 'Poshmark', description: 'Sales export', path: 'Account → My Sales → Export' },
  { id: 'MERCARI', name: 'Mercari', description: 'Transaction history export', path: 'Profile → Selling → Transaction History → Export' },
]

/** Maps API errors to user-friendly messages. */
function mapApiError(err: unknown): string {
  if (isAxiosError(err)) {
    switch (err.response?.status) {
      case 429: return 'Too many import requests — please wait before retrying'
      case 403: return 'Only Admins can run imports — contact your account admin'
      case 400: return 'There was a problem with the file — check it and try again'
    }
  }
  return 'Import failed — please try again'
}

/** Generates and downloads a client-side CSV error report. */
function downloadErrorReport(platform: Platform, errors: { rowNumber: number; field: string; message: string }[]): void {
  const header = 'Row Number,Field,Message'
  const csvRows = errors.map(e => `${e.rowNumber},"${e.field.replace(/"/g, '""')}","${e.message.replace(/"/g, '""')}"`)
  const csv = [header, ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${platform}_import_errors.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Import page — multi-step wizard for uploading platform CSV exports. */
export function ImportPage() {
  const { token } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('PLATFORM_SELECT')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [previewResponse, setPreviewResponse] = useState<ImportPreviewResponse | null>(null)
  const [confirmResult, setConfirmResult] = useState<ImportResultResponse | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previewMutation = useMutation({
    mutationFn: ({ platform, file }: { platform: Platform; file: File }) =>
      previewImport(platform, file, token!),
    onSuccess: (data) => {
      setPreviewResponse(data)
      setApiError(null)
      setStep('PREVIEW')
    },
    onError: (err) => {
      setApiError(mapApiError(err))
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmImport(selectedPlatform!, previewResponse!.rows, token!),
    onSuccess: (data) => {
      setConfirmResult(data)
      setApiError(null)
      setStep('SUCCESS')
    },
    onError: (err) => {
      setApiError(mapApiError(err))
    },
  })

  /** Handles platform card click. */
  const handleSelectPlatform = useCallback((platform: Platform) => {
    setSelectedPlatform(platform)
    setFileError(null)
    setApiError(null)
    setStep('FILE_UPLOAD')
  }, [])

  /** Resets all state back to the first step. */
  const resetToStart = useCallback(() => {
    setStep('PLATFORM_SELECT')
    setSelectedPlatform(null)
    setPreviewResponse(null)
    setConfirmResult(null)
    setFileError(null)
    setApiError(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  /** Validates the selected file and triggers the preview API call. */
  const handleSubmitFile = useCallback(() => {
    if (!selectedFile || !selectedPlatform) return

    // Extension check first
    if (!selectedFile.name.endsWith('.csv')) {
      setFileError('Only .csv files are accepted')
      return
    }
    // Size check
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFileError('File exceeds the 5 MB limit')
      return
    }

    setFileError(null)
    setApiError(null)
    previewMutation.mutate({ platform: selectedPlatform, file: selectedFile })
  }, [selectedFile, selectedPlatform, previewMutation])

  /** Handles file input change. */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setFileError(null)
    setApiError(null)
  }, [])

  /** Handles drag-and-drop file. */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0] ?? null
    setSelectedFile(file)
    setFileError(null)
    setApiError(null)
  }, [])

  /** Formats money value to 2 decimal places. */
  const formatMoney = (value: number): string => value.toFixed(2)

  /** Formats ISO date string for display. */
  const formatDate = (isoDate: string): string =>
    new Date(isoDate + 'T00:00:00').toLocaleDateString()

  return (
    <div className="page-enter import-page">
      <h1>Import Sales</h1>

      {step === 'PLATFORM_SELECT' && (
        <div className="import-step">
          <p className="import-subtitle">Select the platform you exported from</p>
          <div className="platform-cards">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="platform-card"
                onClick={() => handleSelectPlatform(p.id)}
              >
                <span className="platform-card-name">{p.name}</span>
                <span className="platform-card-desc">{p.description}</span>
                <span className="platform-card-path">{p.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'FILE_UPLOAD' && (
        <div className="import-step">
          <p className="import-subtitle">
            Upload your <strong>{PLATFORMS.find(p => p.id === selectedPlatform)?.name}</strong> CSV export
          </p>
          <div
            className="file-drop-zone"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <label htmlFor="import-file" className="file-label">
              Choose a file or drag it here
            </label>
            <input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              aria-label="file"
            />
            {selectedFile && (
              <p className="file-info">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {fileError && <p className="import-error" role="alert">{fileError}</p>}
          {apiError && <p className="import-error" role="alert">{apiError}</p>}

          <div className="import-actions">
            <button type="button" className="btn-action" onClick={resetToStart}>Back</button>
            <button
              type="button"
              className="btn-action btn-primary"
              disabled={!selectedFile || previewMutation.isPending}
              onClick={handleSubmitFile}
            >
              {previewMutation.isPending ? 'Uploading…' : 'Preview Import'}
            </button>
          </div>
        </div>
      )}

      {step === 'PREVIEW' && previewResponse && (
        <div className="import-step">
          <p className="import-summary">
            {previewResponse.validRows} rows ready · {previewResponse.duplicateRows} duplicates skipped · {previewResponse.errorRows} errors
          </p>

          <div className="preview-table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Sale Price</th>
                  <th>Fees</th>
                  <th>Net Proceeds</th>
                </tr>
              </thead>
              <tbody>
                {previewResponse.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.title}</td>
                    <td>{formatDate(row.saleDate)}</td>
                    <td>{formatMoney(row.salePrice)}</td>
                    <td>{formatMoney(row.platformFees)}</td>
                    <td>{formatMoney(row.netProceeds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {previewResponse.errorRows > 0 && (
            <details className="error-accordion" role="group">
              <summary>Show {previewResponse.errorRows} errors</summary>
              <ul className="error-list">
                {previewResponse.errors.map((err, i) => (
                  <li key={i}>Row {err.rowNumber}: {err.message}</li>
                ))}
              </ul>
            </details>
          )}

          {previewResponse.errorRows > 0 && (
            <button
              type="button"
              className="btn-action"
              onClick={() => downloadErrorReport(previewResponse.platform, previewResponse.errors)}
            >
              Download error report
            </button>
          )}

          {apiError && <p className="import-error" role="alert">{apiError}</p>}

          <div className="import-actions">
            <button type="button" className="btn-action" onClick={resetToStart}>Back</button>
            <button
              type="button"
              className="btn-action btn-primary"
              disabled={previewResponse.validRows === 0 || confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmMutation.isPending ? 'Importing…' : `Import ${previewResponse.validRows} rows`}
            </button>
          </div>
        </div>
      )}

      {step === 'SUCCESS' && confirmResult && (
        <div className="import-step import-success">
          <h2>Import complete — {confirmResult.imported} sales added.</h2>
          <p className="import-subtitle">
            Estimated profit is visible now. Add purchase prices for accurate totals.
          </p>

          {confirmResult.batchErrors > 0 && (
            <p className="import-warning" role="alert">
              Note: {confirmResult.batchErrors} rows could not be saved.
            </p>
          )}

          <div className="import-actions">
            <button
              type="button"
              className="btn-action btn-primary"
              onClick={() => navigate(`/inventory?imported=${confirmResult.imported}&filter=costPending`)}
            >
              Review items &amp; add purchase prices →
            </button>
            <button type="button" className="btn-action" onClick={resetToStart}>
              Import more
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
