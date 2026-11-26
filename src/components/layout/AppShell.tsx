import { Outlet } from "react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUiPreferencesSync } from "@/hooks/useUiPreferencesSync";
import { useSession } from "@/providers/AuthProvider";

/** Shell autenticado: menu lateral + app bar + conteudo da rota. */
export function AppShell() {
  const { profile } = useSession();
  const { theme, toggleTheme, sidebarOpen, setSidebarOpen } =
    useUiPreferencesSync(profile.userId);

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
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
