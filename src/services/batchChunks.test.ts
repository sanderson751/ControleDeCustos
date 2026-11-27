import * as firestore from "firebase/firestore";
import {
  commitInChunks,
  MAX_CUSTOM_CATEGORIES_PER_BATCH,
  MAX_OPERATIONS_PER_BATCH,
  planChunks,
} from "@/services/batchChunks";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;

const op = (category?: string) => ({ category });

describe("planChunks", () => {
  it("mantem tudo em um lote quando cabe (padrao nao contam)", () => {
    const operations = [op("lazer"), op("c1"), op("c1"), op(), op("moradia")];
    expect(planChunks(operations)).toEqual([operations]);
  });

  it("abre novo lote ao exceder as personalizadas distintas", () => {
    const operations = Array.from(
      { length: MAX_CUSTOM_CATEGORIES_PER_BATCH + 1 },
      (_, index) => op(`c${index}`),
    );
    const chunks = planChunks([...operations, op("c0")]);

    expect(chunks.map((chunk) => chunk.length)).toEqual([
      MAX_CUSTOM_CATEGORIES_PER_BATCH,
      2,
    ]);
  });

  it("abre novo lote ao exceder o numero de operacoes", () => {
    const operations = Array.from({ length: MAX_OPERATIONS_PER_BATCH + 1 }, () =>
      op("outros"),
    );
    expect(planChunks(operations).map((chunk) => chunk.length)).toEqual([
      MAX_OPERATIONS_PER_BATCH,
      1,
    ]);
    expect(planChunks([])).toEqual([]);
  });
});

describe("commitInChunks", () => {
  it("grava lote a lote e informa o acumulado", async () => {
    const onCommitted = vi.fn();
    const operations = Array.from(
      { length: MAX_CUSTOM_CATEGORIES_PER_BATCH + 1 },
      (_, index) => ({ category: `c${index}`, write: vi.fn() }),
    );

    await commitInChunks(operations, onCommitted);

    expect(batch.commit).toHaveBeenCalledTimes(2);
    expect(onCommitted.mock.calls).toEqual([[10], [11]]);
    operations.forEach((operation) => expect(operation.write).toHaveBeenCalledTimes(1));
  });
});
