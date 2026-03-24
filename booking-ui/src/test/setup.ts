import '@testing-library/jest-dom'

// Recharts uses ResizeObserver which is not available in jsdom
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
