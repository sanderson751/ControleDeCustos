import type { User } from "firebase/auth";
import * as firestore from "firebase/firestore";
import {
  DEFAULT_ROLE_FOR_NEW_USER,
  ensureUserProfile,
  listUsers,
  markUserLogout,
  subscribeToUserProfile,
  updateOwnDisplayName,
  updateUserByAdmin,
} from "@/services/userService";
import { docSnapshot, querySnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

const mocked = vi.mocked(firestore);

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    uid: "uid-1",
    email: "Pessoa@Exemplo.com",
    displayName: "Pessoa Teste",
    photoURL: null,
    providerData: [{ providerId: "password" }],
    ...overrides,
  } as unknown as User;
}

function runTransactionWith(existing: Record<string, unknown> | null) {
  const transaction = {
    get: vi.fn(async () => docSnapshot("uid-1", existing)),
    set: vi.fn(),
    update: vi.fn(),
  };

  mocked.runTransaction.mockImplementationOnce((async (
    _db: unknown,
    callback: (tx: typeof transaction) => Promise<unknown>,
  ) => callback(transaction)) as never);

  return transaction;
}

describe("ensureUserProfile", () => {
  it("cria perfil com papel padrao e preferencias iniciais para usuario novo", async () => {
    const transaction = runTransactionWith(null);

    await ensureUserProfile(fakeUser());

    expect(DEFAULT_ROLE_FOR_NEW_USER).toBe("standard");
    expect(transaction.set).toHaveBeenCalledTimes(2);
    const [userRef, userData] = transaction.set.mock.calls[0];
    expect(userRef).toEqual({ path: "users/uid-1" });
    expect(userData).toMatchObject({
      uid: "uid-1",
      email: "Pessoa@Exemplo.com",
      emailNormalized: "pessoa@exemplo.com",
      displayName: "Pessoa Teste",
      provider: "password",
      role: "standard",
      createdAt: "SERVER_TIMESTAMP",
    });

    const [settingsRef, settingsData] = transaction.set.mock.calls[1];
    expect(settingsRef).toEqual({ path: "users/uid-1/settings/profile" });
    expect(settingsData).toMatchObject({
      currency: "BRL",
      locale: "pt-BR",
      ui: { sidebarCollapsed: false, theme: "dark" },
    });
  });

  it("usa o email como nome quando o provedor nao informa displayName", async () => {
    const transaction = runTransactionWith(null);

    await ensureUserProfile(fakeUser({ displayName: null }));

    expect(transaction.set.mock.calls[0][1].displayName).toBe(
      "Pessoa@Exemplo.com",
    );
  });

  it("usuario existente: atualiza login sem tocar em role/createdAt", async () => {
    const transaction = runTransactionWith({ role: "admin" });

    await ensureUserProfile(fakeUser());

    expect(transaction.set).not.toHaveBeenCalled();
    const [, updates] = transaction.update.mock.calls[0];
    expect(updates).not.toHaveProperty("role");
    expect(updates).not.toHaveProperty("createdAt");
    expect(updates).toMatchObject({
      displayName: "Pessoa Teste",
      status: "online",
      lastLoginAt: "SERVER_TIMESTAMP",
    });
  });

  it("usuario existente sem displayName no provedor preserva o nome salvo", async () => {
    const transaction = runTransactionWith({ displayName: "Nome salvo" });

    await ensureUserProfile(fakeUser({ displayName: "  " }));

    expect(transaction.update.mock.calls[0][1]).not.toHaveProperty(
      "displayName",
    );
  });
});

describe("subscribeToUserProfile", () => {
  it("emite perfil convertido ou null quando inexistente", () => {
    const onData = vi.fn();
    const unsubscribe = vi.fn();
    mocked.onSnapshot.mockImplementationOnce(((
      _ref: unknown,
      next: (snapshot: unknown) => void,
    ) => {
      next(
        docSnapshot("uid-1", {
          email: "a@b.com",
          displayName: "A",
          role: "guest",
        }),
      );
      next(docSnapshot("uid-1", null));
      return unsubscribe;
    }) as never);

    const result = subscribeToUserProfile("uid-1", onData, vi.fn());

    expect(onData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: "uid-1", role: "guest" }),
    );
    expect(onData).toHaveBeenNthCalledWith(2, null);
    expect(result).toBe(unsubscribe);
  });
});

describe("operacoes de perfil", () => {
  it("lista usuarios ordenados por nome", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        { id: "2", data: { displayName: "Zeca", role: "standard" } },
        { id: "1", data: { displayName: "Ana", role: "admin" } },
      ]) as never,
    );

    const users = await listUsers();

    expect(users.map((user) => user.displayName)).toEqual(["Ana", "Zeca"]);
    expect(users[0].role).toBe("admin");
  });

  it("admin atualiza nome e papel de outro usuario", async () => {
    await updateUserByAdmin("uid-2", { displayName: " Bia ", role: "guest" });

    expect(mocked.updateDoc).toHaveBeenCalledWith(
      { path: "users/uid-2" },
      { displayName: "Bia", role: "guest", updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("usuario atualiza apenas o proprio nome", async () => {
    await updateOwnDisplayName("uid-1", " Novo ");

    expect(mocked.updateDoc).toHaveBeenCalledWith(
      { path: "users/uid-1" },
      { displayName: "Novo", updatedAt: "SERVER_TIMESTAMP" },
    );
  });

  it("registra logout", async () => {
    await markUserLogout("uid-1");

    expect(mocked.updateDoc).toHaveBeenCalledWith(
      { path: "users/uid-1" },
      expect.objectContaining({ status: "offline" }),
    );
  });
});
