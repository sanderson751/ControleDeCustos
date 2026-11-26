import { useCallback, useEffect, useState } from "react";
import type { ThemeMode } from "@/domain/entities/user";
import { notify } from "@/lib/notify";
import { useTheme } from "@/providers/ThemeProvider";
import {
  getUiPreferences,
  updateUiPreferences,
} from "@/services/uiPreferenceService";

const THEME_SAVE_ERROR = "Não foi possível salvar sua preferência de tema.";
const SIDEBAR_SAVE_ERROR = "Não foi possível salvar a preferência do menu.";

/**
 * Sincroniza tema e menu lateral com o Firestore (users/{uid}/settings/profile).
 * Em falha de escrita o valor anterior e restaurado e um snackbar de warning e exibido.
 */
export function useUiPreferencesSync(userId: string) {
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpenState] = useState(true);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  useEffect(() => {
    let isActive = true;

    getUiPreferences(userId)
      .then((preferences) => {
        if (!isActive) {
          return;
        }

        setTheme(preferences.theme);
        setSidebarOpenState(!preferences.sidebarCollapsed);
      })
      .catch(() => {
        // Falha de leitura nao bloqueia a renderizacao: mantem valores locais.
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPreferences(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [setTheme, userId]);

  const toggleTheme = useCallback(() => {
    const previousTheme = theme;
    const nextTheme: ThemeMode = previousTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);

    updateUiPreferences(userId, { theme: nextTheme }).catch(() => {
      setTheme(previousTheme);
      notify("warning", THEME_SAVE_ERROR);
    });
  }, [setTheme, theme, userId]);

  const setSidebarOpen = useCallback(
    (open: boolean) => {
      setSidebarOpenState(open);

      updateUiPreferences(userId, { sidebarCollapsed: !open }).catch(() => {
        notify("warning", SIDEBAR_SAVE_ERROR);
      });
    },
    [userId],
  );

  return {
    theme,
    toggleTheme,
    sidebarOpen,
    setSidebarOpen,
    isLoadingPreferences,
  };
}
