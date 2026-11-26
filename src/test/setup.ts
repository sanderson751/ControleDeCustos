import * as matchers from "@testing-library/jest-dom/matchers";

// CONVENCAO: use apenas os globals do Vitest (describe/it/expect/vi), sem
// `import ... from "vitest"`. No Windows + Git Bash o import explicito carrega
// uma segunda instancia do Vitest ("failed to find the current suite").
expect.extend(matchers);

// Nenhum teste unitario fala com o Firebase real: o modulo de inicializacao e
// substituido globalmente. Servicos mockam `firebase/firestore`/`firebase/auth`.
vi.mock("@/lib/firebase", () => ({
  firebaseApp: {},
  auth: { currentUser: null },
  db: { __mock: "firestore" },
  googleProvider: { providerId: "google.com" },
}));

// Limpeza explicita do historico de chamadas: `clearMocks` do config nao cobre os
// mocks criados nas fabricas de vi.mock neste ambiente.
beforeEach(() => {
  vi.clearAllMocks();
});

// --- Polyfills de APIs de navegador ausentes no jsdom (Radix UI / shadcn) ---
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;
}

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
