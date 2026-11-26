import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useUiPreferencesSync } from "@/hooks/useUiPreferencesSync";
import { notify } from "@/lib/notify";
import { ThemeProvider } from "@/providers/ThemeProvider";
import {
  getUiPreferences,
  updateUiPreferences,
} from "@/services/uiPreferenceService";

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/uiPreferenceService", () => ({
  getUiPreferences: vi.fn(),
  updateUiPreferences: vi.fn(),
}));

const mockedGet = vi.mocked(getUiPreferences);
const mockedUpdate = vi.mocked(updateUiPreferences);

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider initialTheme="dark">{children}</ThemeProvider>
);

describe("useUiPreferencesSync", () => {
  it("aplica as preferencias salvas no Firestore", async () => {
    mockedGet.mockResolvedValue({ theme: "light", sidebarCollapsed: true });

    const { result } = renderHook(() => useUiPreferencesSync("uid-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoadingPreferences).toBe(false));
    expect(result.current.theme).toBe("light");
    expect(result.current.sidebarOpen).toBe(false);
    expect(mockedGet).toHaveBeenCalledWith("uid-1");
  });

  it("persiste a troca de tema", async () => {
    mockedGet.mockResolvedValue({ theme: "dark", sidebarCollapsed: false });
    mockedUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUiPreferencesSync("uid-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoadingPreferences).toBe(false));

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe("light");
    expect(mockedUpdate).toHaveBeenCalledWith("uid-1", { theme: "light" });
  });

  it("restaura o tema anterior e avisa quando a gravacao falha", async () => {
    mockedGet.mockResolvedValue({ theme: "dark", sidebarCollapsed: false });
    mockedUpdate.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useUiPreferencesSync("uid-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoadingPreferences).toBe(false));

    act(() => result.current.toggleTheme());

    await waitFor(() => expect(result.current.theme).toBe("dark"));
    expect(notify).toHaveBeenCalledWith(
      "warning",
      "Não foi possível salvar sua preferência de tema.",
    );
  });

  it("persiste o estado do menu lateral", async () => {
    mockedGet.mockResolvedValue({ theme: "dark", sidebarCollapsed: false });
    mockedUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUiPreferencesSync("uid-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoadingPreferences).toBe(false));

    act(() => result.current.setSidebarOpen(false));

    expect(result.current.sidebarOpen).toBe(false);
    expect(mockedUpdate).toHaveBeenCalledWith("uid-1", {
      sidebarCollapsed: true,
    });
  });

  it("mantem valores locais quando a leitura falha", async () => {
    mockedGet.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useUiPreferencesSync("uid-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoadingPreferences).toBe(false));
    expect(result.current.theme).toBe("dark");
    expect(result.current.sidebarOpen).toBe(true);
  });
});
