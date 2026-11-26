import * as firestore from "firebase/firestore";
import {
  createCategory,
  renameCategory,
  setCategoryArchived,
  subscribeToCategories,
} from "@/services/categoryService";
import { querySnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

const mocked = vi.mocked(firestore);

describe("categoryService", () => {
  it("assina users/{uid}/categories e converte os documentos", () => {
    const unsubscribe = vi.fn();
    const onData = vi.fn();
    const onError = vi.fn();
    mocked.onSnapshot.mockImplementationOnce(((
      _ref: unknown,
      next: (snapshot: unknown) => void,
      error: (err: Error) => void,
    ) => {
      next(
        querySnapshot([
          { id: "c1", data: { name: "Pets", archived: false } },
          { id: "c2", data: { name: "Antiga", archived: true } },
          { id: "c3", data: {} },
        ]),
      );
      error(new Error("falha"));
      return unsubscribe;
    }) as never);

    const result = subscribeToCategories("uid-1", onData, onError);

    expect(mocked.collection).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "uid-1",
      "categories",
    );
    expect(onData).toHaveBeenCalledWith([
      { id: "c1", name: "Pets", archived: false },
      { id: "c2", name: "Antiga", archived: true },
      { id: "c3", name: "", archived: false },
    ]);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(result).toBe(unsubscribe);
  });

  it("cria categoria ativa com dono e timestamps e retorna o id", async () => {
    const id = await createCategory("uid-1", "Pets");

    expect(mocked.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/categories" }),
      {
        userId: "uid-1",
        name: "Pets",
        archived: false,
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
      },
    );
    expect(id).toMatch(/^auto-/);
  });

  it("renomeia e arquiva/reativa atualizando somente os campos necessarios", async () => {
    await renameCategory("uid-1", "c1", "Animais");
    expect(mocked.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-1/categories/c1" }),
      { name: "Animais", updatedAt: "SERVER_TIMESTAMP" },
    );

    await setCategoryArchived("uid-1", "c1", true);
    expect(mocked.updateDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "users/uid-1/categories/c1" }),
      { archived: true, updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("propaga falhas de escrita", async () => {
    mocked.updateDoc.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(setCategoryArchived("uid-1", "c1", false)).rejects.toThrow(
      "permission-denied",
    );
  });
});
