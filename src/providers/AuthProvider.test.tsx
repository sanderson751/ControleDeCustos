import { act, render, screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/domain/entities/user";
import { AuthProvider, useAuth, useSession } from "@/providers/AuthProvider";
import { subscribeToAuthState } from "@/services/authService";
import {
  ensureUserProfile,
  subscribeToUserProfile,
} from "@/services/userService";
import { makeProfile } from "@/test/factories";

vi.mock("@/services/authService", () => ({ subscribeToAuthState: vi.fn() }));
vi.mock("@/services/userService", () => ({
  ensureUserProfile: vi.fn(),
  subscribeToUserProfile: vi.fn(),
}));

const mockedSubscribeAuth = vi.mocked(subscribeToAuthState);
const mockedEnsure = vi.mocked(ensureUserProfile);
const mockedSubscribeProfile = vi.mocked(subscribeToUserProfile);

function Probe() {
  const { status, profile, error } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="role">{profile?.role ?? "-"}</p>
      <p data-testid="error">{error ?? ""}</p>
    </div>
  );
}

function captureAuthCallback() {
  let callback: ((user: User | null) => void) | undefined;
  const unsubscribe = vi.fn();
  mockedSubscribeAuth.mockImplementation((next) => {
    callback = next;
    return unsubscribe;
  });
  return {
    emit: (user: User | null) => act(() => callback?.(user)),
    unsubscribe,
  };
}

const fakeUser = { uid: "uid-standard" } as User;

describe("AuthProvider", () => {
  it("fica unauthenticated sem usuario", () => {
    const auth = captureAuthCallback();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    auth.emit(null);
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
  });

  it("sincroniza o perfil e reage a mudancas de papel em tempo real", async () => {
    const auth = captureAuthCallback();
    mockedEnsure.mockResolvedValue(undefined);
    let emitProfile: ((profile: UserProfile | null) => void) | undefined;
    const unsubscribeProfile = vi.fn();
    mockedSubscribeProfile.mockImplementation((_uid, onData) => {
      emitProfile = onData;
      return unsubscribeProfile;
    });

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    auth.emit(fakeUser);

    await waitFor(() => expect(mockedSubscribeProfile).toHaveBeenCalled());
    expect(mockedEnsure).toHaveBeenCalledWith(fakeUser);

    act(() => emitProfile?.(makeProfile("standard")));
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("role")).toHaveTextContent("standard");

    act(() => emitProfile?.(makeProfile("guest")));
    expect(screen.getByTestId("role")).toHaveTextContent("guest");

    unmount();
    expect(auth.unsubscribe).toHaveBeenCalled();
    expect(unsubscribeProfile).toHaveBeenCalled();
  });

  it("entra em estado de erro quando o perfil nao pode ser lido", async () => {
    const auth = captureAuthCallback();
    mockedEnsure.mockRejectedValue(new Error("rules"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedSubscribeProfile.mockImplementation((_uid, _onData, onError) => {
      onError(new Error("permission-denied"));
      return vi.fn();
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    auth.emit(fakeUser);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("error"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent(
      "Não foi possível carregar seu perfil",
    );
  });

  it("useAuth e useSession exigem provider/sessao", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);

    function SessionProbe() {
      useSession();
      return null;
    }
    captureAuthCallback();
    expect(() =>
      render(
        <AuthProvider>
          <SessionProbe />
        </AuthProvider>,
      ),
    ).toThrow(/autenticado/);
  });
});
