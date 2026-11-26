import * as firestore from "firebase/firestore";
import {
  getUiPreferences,
  updateUiPreferences,
} from "@/services/uiPreferenceService";
import { docSnapshot } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

const mocked = vi.mocked(firestore);

describe("uiPreferenceService", () => {
  it("le as preferencias de users/{uid}/settings/profile", async () => {
    mocked.getDoc.mockResolvedValueOnce(
      docSnapshot("profile", {
        ui: { sidebarCollapsed: true, theme: "light" },
      }) as never,
    );

    await expect(getUiPreferences("uid-1")).resolves.toEqual({
      sidebarCollapsed: true,
      theme: "light",
    });
    expect(mocked.doc).toHaveBeenCalledWith(
      expect.anything(),
      "users",
      "uid-1",
      "settings",
      "profile",
    );
  });

  it("usa padroes (tema dark, menu expandido) quando ausente ou invalido", async () => {
    mocked.getDoc.mockResolvedValueOnce(docSnapshot("profile", null) as never);
    await expect(getUiPreferences("uid-1")).resolves.toEqual({
      sidebarCollapsed: false,
      theme: "dark",
    });

    mocked.getDoc.mockResolvedValueOnce(
      docSnapshot("profile", { ui: { theme: "sepia" } }) as never,
    );
    await expect(getUiPreferences("uid-1")).resolves.toEqual({
      sidebarCollapsed: false,
      theme: "dark",
    });
  });

  it("grava apenas os campos alterados com merge", async () => {
    await updateUiPreferences("uid-1", { theme: "light" });

    expect(mocked.setDoc).toHaveBeenCalledWith(
      { path: "users/uid-1/settings/profile" },
      {
        userId: "uid-1",
        ui: { theme: "light" },
        updatedAt: "SERVER_TIMESTAMP",
      },
      { merge: true },
    );
  });
});
