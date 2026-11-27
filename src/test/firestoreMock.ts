
/**
 * Fabrica de mock do modulo `firebase/firestore`.
 * Referencias viram objetos `{ path }` para facilitar asserts de caminho.
 *
 * Uso: vi.mock("firebase/firestore", async () => (await import("@/test/firestoreMock")).createFirestoreMock());
 */
export function createFirestoreMock() {
  let autoId = 0;

  type Ref = { path: string };

  const pathOf = (base: unknown, segments: string[]) => {
    const basePath =
      base && typeof base === "object" && "path" in base
        ? (base as Ref).path
        : "";
    return [basePath, ...segments].filter(Boolean).join("/");
  };

  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async () => undefined),
  };

  return {
    __batch: batch,
    collection: vi.fn((base: unknown, ...segments: string[]) => ({
      path: pathOf(base, segments),
    })),
    // Como no SDK, a referencia expoe o id (ultimo segmento do caminho). Nao
    // enumeravel: asserts existentes que comparam { path } continuam validos.
    doc: vi.fn((base: unknown, ...segments: string[]) => {
      if (segments.length === 0) {
        autoId += 1;
      }
      const path = pathOf(base, segments.length ? segments : [`auto-${autoId}`]);
      return Object.defineProperty({ path }, "id", {
        value: path.split("/").pop(),
        enumerable: false,
      });
    }),
    query: vi.fn((ref: Ref, ...constraints: unknown[]) => ({
      ref,
      constraints,
    })),
    where: vi.fn((field: string, op: string, value: unknown) => ({
      type: "where",
      field,
      op,
      value,
    })),
    limit: vi.fn((count: number) => ({ type: "limit", count })),
    orderBy: vi.fn((field: string, direction: string) => ({
      type: "orderBy",
      field,
      direction,
    })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(async () => undefined),
    addDoc: vi.fn(async (ref: Ref) => {
      autoId += 1;
      return { id: `auto-${autoId}`, path: `${ref.path}/auto-${autoId}` };
    }),
    updateDoc: vi.fn(async () => undefined),
    deleteDoc: vi.fn(async () => undefined),
    onSnapshot: vi.fn(),
    runTransaction: vi.fn(),
    writeBatch: vi.fn(() => batch),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    deleteField: vi.fn(() => "DELETE_FIELD"),
    FieldPath: class FieldPath {
      readonly segments: string[];
      constructor(...segments: string[]) {
        this.segments = segments;
      }
    },
    Timestamp: {
      fromDate: vi.fn((date: Date) => ({
        __timestamp: date.toISOString(),
        toDate: () => date,
      })),
    },
  };
}

export function timestamp(date: Date) {
  return { toDate: () => date };
}

export function docSnapshot(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? undefined,
  };
}

export function querySnapshot(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
) {
  return {
    docs: docs.map((item) => docSnapshot(item.id, item.data)),
  };
}
