import '@testing-library/jest-dom'

class ResizeObserverMock {
  observe() {
    return undefined
  }

  unobserve() {
    return undefined
  }

  disconnect() {
    return undefined
  }
}

if (typeof global.ResizeObserver === 'undefined') {
	global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}
