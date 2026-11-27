import * as firebaseAuth from "firebase/auth";
import { waitForPendingWrites } from "firebase/firestore";
import { auth, clearLocalCache } from "@/lib/firebase";
import {
  hasUnsyncedChanges,
  loginWithEmailAndPassword,
  loginWithGoogle,
  logout,
  registerWithEmailAndPassword,
  subscribeToAuthState,
} from "@/services/authService";
import * as userService from "@/services/userService";

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(async () => undefined),
  updateProfile: vi.fn(async () => undefined),
}));

vi.mock("firebase/firestore", () => ({ waitForPendingWrites: vi.fn(async () => undefined) }));

vi.mock("@/services/userService", () => ({
  ensureUserProfile: vi.fn(async () => undefined),
  markUserLogout: vi.fn(async () => undefined),
}));

const mockedAuth = vi.mocked(firebaseAuth);
const mockedUserService = vi.mocked(userService);
const fakeUser = { uid: "uid-1" } as firebaseAuth.User;


describe("authService", () => {
  afterEach(() => {
    (auth as { currentUser: unknown }).currentUser = null;
  });

  it("assina mudancas de autenticacao", () => {
    const callback = vi.fn();
    subscribeToAuthState(callback);
    expect(mockedAuth.onAuthStateChanged).toHaveBeenCalledWith(auth, callback);
  });

  it("login por email remove espacos do email", async () => {
    mockedAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
      user: fakeUser,
    } as never);

    await expect(
      loginWithEmailAndPassword("  a@b.com ", "123456"),
    ).resolves.toBe(fakeUser);
    expect(mockedAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "a@b.com",
      "123456",
    );
  });

  it("cadastro define o nome e sincroniza o perfil no Firestore", async () => {
    mockedAuth.createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: fakeUser,
    } as never);

    await registerWithEmailAndPassword(" Ana ", "a@b.com", "123456");

    expect(mockedAuth.updateProfile).toHaveBeenCalledWith(fakeUser, {
      displayName: "Ana",
    });
    expect(mockedUserService.ensureUserProfile).toHaveBeenCalledWith(fakeUser);
  });

  it("cadastro sem nome nao chama updateProfile", async () => {
    mockedAuth.createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: fakeUser,
    } as never);

    await registerWithEmailAndPassword("  ", "a@b.com", "123456");

    expect(mockedAuth.updateProfile).not.toHaveBeenCalled();
  });

  it("login com Google usa popup", async () => {
    mockedAuth.signInWithPopup.mockResolvedValueOnce({
      user: fakeUser,
    } as never);

    await expect(loginWithGoogle()).resolves.toBe(fakeUser);
  });

  it("logout registra saida e encerra a sessao mesmo se o registro falhar", async () => {
    (auth as { currentUser: unknown }).currentUser = fakeUser;
    mockedUserService.markUserLogout.mockRejectedValueOnce(new Error("offline"));

    await logout();

    expect(mockedUserService.markUserLogout).toHaveBeenCalledWith("uid-1");
    expect(mockedAuth.signOut).toHaveBeenCalledWith(auth);
    // Cache local (IndexedDB) apagado antes de encerrar a sessao (o fim da sessao recarrega o app).
    expect(clearLocalCache).toHaveBeenCalled();
    expect(vi.mocked(clearLocalCache).mock.invocationCallOrder[0]).toBeLessThan(
      mockedAuth.signOut.mock.invocationCallOrder[0],
    );
  });

  it("logout sem sinal nao trava esperando o registro de saida", async () => {
    vi.useFakeTimers();
    (auth as { currentUser: unknown }).currentUser = fakeUser;
    mockedUserService.markUserLogout.mockReturnValueOnce(new Promise(() => undefined));

    const done = logout();
    await vi.advanceTimersByTimeAsync(3000);
    await done;

    expect(mockedAuth.signOut).toHaveBeenCalledWith(auth);
    vi.useRealTimers();
  });

  it("falha ao limpar o cache nao impede a saida", async () => {
    vi.mocked(clearLocalCache).mockRejectedValueOnce(new Error("failed-precondition"));
    await logout();
    expect(mockedAuth.signOut).toHaveBeenCalled();
  });

  it("detecta alteracoes ainda nao sincronizadas", async () => {
    vi.mocked(waitForPendingWrites).mockResolvedValueOnce(undefined);
    await expect(hasUnsyncedChanges(50)).resolves.toBe(false);

    vi.mocked(waitForPendingWrites).mockReturnValueOnce(new Promise(() => undefined));
    await expect(hasUnsyncedChanges(10)).resolves.toBe(true);
  });
});
