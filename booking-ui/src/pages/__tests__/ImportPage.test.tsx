import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../../auth/AuthContext'
import { ImportPage } from '../ImportPage'

vi.mock('../../api/importApi', () => ({
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}))

import { previewImport, confirmImport } from '../../api/importApi'
import type { ImportPreviewResponse, ImportResultResponse } from '../../types/import'

const mockPreviewImport = vi.mocked(previewImport)
const mockConfirmImport = vi.mocked(confirmImport)

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

/** Creates a fake JWT for test auth context. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

/** Logs in before rendering children so useAuth() has a valid token/role. */
function LoginThenRender({ token, children }: { token: string; children: React.ReactNode }) {
  const { login } = useAuth()
  useEffect(() => { login(token) }, [token, login])
  return <>{children}</>
}

/** Renders ImportPage wrapped in all required providers. */
function renderPage() {
  const token = fakeJwt({ sub: 'u1', orgId: 'org1', role: 'ADMIN' })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginThenRender token={token}>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </LoginThenRender>
      </AuthProvider>
    </QueryClientProvider>
  )
}

/** Builds a mock ImportPreviewResponse with the given valid/error counts. */
function mockPreviewResponse(
  validCount: number,
  errorCount: number,
  duplicateCount = 0,
): ImportPreviewResponse {
  const rows = Array.from({ length: validCount }, (_, i) => ({
    rowNumber: i + 1,
    externalOrderId: `ORD-${i + 1}`,
    title: `Item ${i + 1}`,
    saleDate: '2025-06-15',
    salePrice: 49.99,
    platformFees: 6.50,
    netProceeds: 43.49,
    isDuplicate: false,
  }))
  const errors = Array.from({ length: errorCount }, (_, i) => ({
    rowNumber: validCount + i + 1,
    field: 'salePrice',
    message: `Error on row ${validCount + i + 1}`,
  }))
  return {
    platform: 'EBAY',
    totalRows: validCount + errorCount + duplicateCount,
    validRows: validCount,
    duplicateRows: duplicateCount,
    errorRows: errorCount,
    rowLimit: 2000,
    rows,
    errors,
  }
}

/** Creates a small File object for simulating uploads. */
function createFile(name: string, sizeBytes: number, type = 'text/csv'): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

/** Helper: selects eBay platform and returns the file input. */
async function selectPlatformAndGetFileInput(user: ReturnType<typeof userEvent.setup>): Promise<HTMLInputElement> {
  await user.click(screen.getByText('eBay'))
  return screen.getByLabelText(/file/i) as HTMLInputElement
}

/** Force-sets a file on an input, bypassing the accept attribute filter. */
function forceSetFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file], writable: false, configurable: true })
  fireEvent.change(input, { target: { files: [file] } })
}

/** Helper: completes the flow through to preview step with a valid file. */
async function advanceToPreview(
  user: ReturnType<typeof userEvent.setup>,
  previewResponse: ImportPreviewResponse,
): Promise<void> {
  mockPreviewImport.mockResolvedValue(previewResponse)
  const fileInput = await selectPlatformAndGetFileInput(user)
  const file = createFile('sales.csv', 1024)
  await user.upload(fileInput, file)
  await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
  await waitFor(() => {
    expect(screen.getByText(/rows ready/i)).toBeInTheDocument()
  })
}

/** Helper: completes the flow through to success step. */
async function advanceToSuccess(
  user: ReturnType<typeof userEvent.setup>,
  previewResponse: ImportPreviewResponse,
  confirmResult: ImportResultResponse,
): Promise<void> {
  await advanceToPreview(user, previewResponse)
  mockConfirmImport.mockResolvedValue(confirmResult)
  await user.click(screen.getByRole('button', { name: /import \d+ rows/i }))
  await waitFor(() => {
    expect(screen.getByText(/import complete/i)).toBeInTheDocument()
  })
}

describe('ImportPage', () => {
  beforeEach(() => {
    mockPreviewImport.mockReset()
    mockConfirmImport.mockReset()
    mockNavigate.mockReset()
  })

  it('renders platform selection cards', () => {
    renderPage()
    expect(screen.getByText('eBay')).toBeInTheDocument()
    expect(screen.getByText('Poshmark')).toBeInTheDocument()
    expect(screen.getByText('Mercari')).toBeInTheDocument()
  })

  it('selectPlatform advances to file upload', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByText('eBay'))
    expect(screen.getByLabelText(/file/i)).toBeInTheDocument()
    expect(screen.getByText(/ebay/i)).toBeInTheDocument()
  })

  it('fileValidation: extension checked first', async () => {
    renderPage()
    const user = userEvent.setup()
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('report.xlsx', 6 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    forceSetFile(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    expect(screen.getByText(/\.csv/i)).toBeInTheDocument()
    expect(screen.queryByText(/5 MB/i)).not.toBeInTheDocument()
  })

  it('fileValidation: rejects oversized CSV', async () => {
    renderPage()
    const user = userEvent.setup()
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('sales.csv', 6 * 1024 * 1024)
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    expect(screen.getByText(/5 MB/i)).toBeInTheDocument()
    expect(mockPreviewImport).not.toHaveBeenCalled()
  })

  it('fileValidation: rejects non-CSV extension', async () => {
    renderPage()
    const user = userEvent.setup()
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('report.xlsx', 1024, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    forceSetFile(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    expect(screen.getByText(/\.csv/i)).toBeInTheDocument()
    expect(mockPreviewImport).not.toHaveBeenCalled()
  })

  it('valid file calls previewImport and shows preview step', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(3, 0)
    mockPreviewImport.mockResolvedValue(previewResponse)
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('sales.csv', 1024)
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    await waitFor(() => {
      expect(mockPreviewImport).toHaveBeenCalledOnce()
    })
    expect(screen.getByText(/rows ready/i)).toBeInTheDocument()
  })

  it('preview step renders rows', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(3, 0)
    await advanceToPreview(user, previewResponse)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // 1 header + 3 data rows
    expect(rows.length).toBe(4)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Sale Price')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
    expect(screen.getByText('Net Proceeds')).toBeInTheDocument()
  })

  it('preview step renders error accordion', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(1, 2)
    await advanceToPreview(user, previewResponse)
    const details = screen.getByRole('group')
    expect(within(details).getByText(/show 2 errors/i)).toBeInTheDocument()
    await user.click(within(details).getByText(/show.*error/i))
    expect(screen.getByText(/error on row 2/i)).toBeInTheDocument()
    expect(screen.getByText(/error on row 3/i)).toBeInTheDocument()
  })

  it('preview step: download error report is client-side only', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(1, 2)
    await advanceToPreview(user, previewResponse)
    const mockCreateObjectURL = vi.fn(() => 'blob:test')
    const mockRevokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = mockCreateObjectURL
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL
    await user.click(screen.getByRole('button', { name: /download error report/i }))
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockPreviewImport).toHaveBeenCalledOnce() // only the initial call
    expect(mockConfirmImport).not.toHaveBeenCalled()
  })

  it('preview step: confirm button shows row count', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(5, 0)
    await advanceToPreview(user, previewResponse)
    expect(screen.getByRole('button', { name: /import 5 rows/i })).toBeInTheDocument()
  })

  it('preview step: back button resets to start', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(3, 0)
    await advanceToPreview(user, previewResponse)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText('eBay')).toBeInTheDocument()
    expect(screen.getByText('Poshmark')).toBeInTheDocument()
    expect(screen.getByText('Mercari')).toBeInTheDocument()
  })

  it('confirm button calls confirmApi and shows success step', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(3, 0)
    const confirmResult: ImportResultResponse = {
      imported: 3,
      skippedDuplicates: 0,
      itemsNeedingCostReview: 3,
      batchErrors: 0,
    }
    await advanceToSuccess(user, previewResponse, confirmResult)
    expect(mockConfirmImport).toHaveBeenCalledOnce()
    const call = mockConfirmImport.mock.calls[0]
    expect(call[0]).toBe('EBAY')
    expect(call[1]).toHaveLength(3)
    expect(screen.getByText(/import complete/i)).toBeInTheDocument()
  })

  it('success screen shows imported count', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(5, 0)
    const confirmResult: ImportResultResponse = {
      imported: 5,
      skippedDuplicates: 0,
      itemsNeedingCostReview: 5,
      batchErrors: 0,
    }
    await advanceToSuccess(user, previewResponse, confirmResult)
    expect(screen.getByText(/5/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review items/i })).toBeInTheDocument()
  })

  it('success screen CTA navigates to inventory with params', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(5, 0)
    const confirmResult: ImportResultResponse = {
      imported: 5,
      skippedDuplicates: 0,
      itemsNeedingCostReview: 5,
      batchErrors: 0,
    }
    await advanceToSuccess(user, previewResponse, confirmResult)
    await user.click(screen.getByRole('button', { name: /review items/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/inventory?imported=5&filter=costPending')
  })

  it('success screen shows batch error warning', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(6, 0)
    const confirmResult: ImportResultResponse = {
      imported: 4,
      skippedDuplicates: 0,
      itemsNeedingCostReview: 4,
      batchErrors: 2,
    }
    await advanceToSuccess(user, previewResponse, confirmResult)
    expect(screen.getByText(/2 rows could not be saved/i)).toBeInTheDocument()
    expect(screen.getByText(/import complete/i)).toBeInTheDocument()
  })

  it('success screen: import more button resets to platform select', async () => {
    renderPage()
    const user = userEvent.setup()
    const previewResponse = mockPreviewResponse(3, 0)
    const confirmResult: ImportResultResponse = {
      imported: 3,
      skippedDuplicates: 0,
      itemsNeedingCostReview: 3,
      batchErrors: 0,
    }
    await advanceToSuccess(user, previewResponse, confirmResult)
    await user.click(screen.getByRole('button', { name: /import more/i }))
    expect(screen.getByText('eBay')).toBeInTheDocument()
    expect(screen.getByText('Poshmark')).toBeInTheDocument()
    expect(screen.getByText('Mercari')).toBeInTheDocument()
  })

  it('preview API error 429 shows rate limit message', async () => {
    renderPage()
    const user = userEvent.setup()
    const axiosError = Object.assign(new Error('Too Many Requests'), {
      isAxiosError: true,
      response: { status: 429 },
    })
    mockPreviewImport.mockRejectedValue(axiosError)
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('sales.csv', 1024)
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    await waitFor(() => {
      expect(screen.getByText(/wait before retrying/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/file/i)).toBeInTheDocument()
  })

  it('preview API error 400 shows file error message', async () => {
    renderPage()
    const user = userEvent.setup()
    const axiosError = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { status: 400 },
    })
    mockPreviewImport.mockRejectedValue(axiosError)
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('sales.csv', 1024)
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    await waitFor(() => {
      expect(screen.getByText(/problem with the file/i)).toBeInTheDocument()
    })
  })

  it('preview API error 403 shows admin required message', async () => {
    renderPage()
    const user = userEvent.setup()
    const axiosError = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403 },
    })
    mockPreviewImport.mockRejectedValue(axiosError)
    const fileInput = await selectPlatformAndGetFileInput(user)
    const file = createFile('sales.csv', 1024)
    await user.upload(fileInput, file)
    await user.click(screen.getByRole('button', { name: /upload|submit|preview/i }))
    await waitFor(() => {
      expect(screen.getByText(/admin/i)).toBeInTheDocument()
    })
  })
})
