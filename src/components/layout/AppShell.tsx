import { Outlet } from "react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { canMutateCosts } from "@/domain/rules/permissions";
import { useRecurringSync } from "@/hooks/useRecurringSync";
import { useUiPreferencesSync } from "@/hooks/useUiPreferencesSync";
import { useSession } from "@/providers/AuthProvider";
import { CategoriesProvider } from "@/providers/CategoriesProvider";
import { RecurringSyncContext } from "@/providers/RecurringSyncContext";

/** Shell autenticado: menu lateral + app bar + conteudo da rota. */
export function AppShell() {
  const { profile } = useSession();
  const { theme, toggleTheme, sidebarOpen, setSidebarOpen } =
    useUiPreferencesSync(profile.userId);
  const { isBlocking, version } = useRecurringSync(
    profile.userId,
    canMutateCosts(profile.role),
  );

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      data-testid="app-shell-root"
    >
      <AppSidebar role={profile.role} />
      <SidebarInset>
        <AppHeader
          profile={profile}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-12">
          <CategoriesProvider userId={profile.userId}>
            <RecurringSyncContext.Provider value={version}>
              {isBlocking ? (
                <p className="text-muted-foreground" aria-live="polite">
                  Atualizando lançamentos recorrentes...
                </p>
              ) : (
                <Outlet />
              )}
            </RecurringSyncContext.Provider>
          </CategoriesProvider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
