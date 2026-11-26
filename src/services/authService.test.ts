import * as firebaseAuth from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
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
  });
});
