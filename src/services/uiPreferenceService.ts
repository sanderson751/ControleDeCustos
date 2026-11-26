import { getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  DEFAULT_UI_PREFERENCES,
  type ThemeMode,
  type UiPreferences,
} from "@/domain/entities/user";
import { userSettingsDocRef } from "@/services/firestorePaths";

function normalizeTheme(value: unknown): ThemeMode {
  return value === "light" || value === "dark"
    ? value
    : DEFAULT_UI_PREFERENCES.theme;
}

export async function getUiPreferences(userId: string): Promise<UiPreferences> {
  const snapshot = await getDoc(userSettingsDocRef(userId));
  const ui = snapshot.exists()
    ? (snapshot.data().ui as Partial<UiPreferences> | undefined)
    : undefined;

  return {
    sidebarCollapsed:
      typeof ui?.sidebarCollapsed === "boolean"
        ? ui.sidebarCollapsed
        : DEFAULT_UI_PREFERENCES.sidebarCollapsed,
    theme: normalizeTheme(ui?.theme),
  };
}

/** Atualiza apenas os campos informados (merge profundo do mapa `ui`). */
export async function updateUiPreferences(
  userId: string,
  updates: Partial<UiPreferences>,
): Promise<void> {
  await setDoc(
    userSettingsDocRef(userId),
    {
      userId,
      ui: updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
