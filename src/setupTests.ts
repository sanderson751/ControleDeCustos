import '@testing-library/jest-dom'

// Mock jest.fn for tests that might call it
if (typeof jest === 'undefined') {
  ;(global as any).jest = { fn: jest.fn }
}

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
