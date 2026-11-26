import { LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ThemeMode, UserProfile } from "@/domain/entities/user";
import { getRoleLabel } from "@/domain/rules/permissions";
import { notify } from "@/lib/notify";
import { findActiveNavigationItem } from "@/routes/navigation";
import { logout } from "@/services/authService";

type AppHeaderProps = {
  profile: UserProfile;
  theme: ThemeMode;
  onToggleTheme: () => void;
};

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export function AppHeader({ profile, theme, onToggleTheme }: AppHeaderProps) {
  const { pathname } = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const activeItem = findActiveNavigationItem(pathname);
  const userName = profile.displayName.trim() || profile.email || "Usuário";
  const themeLabel =
    theme === "dark" ? "Ativar tema light" : "Ativar tema dark";

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      notify("error", "Não foi possível sair da conta. Tente novamente.");
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger aria-label="Alternar menu lateral" />
      <Separator orientation="vertical" className="h-5" />
      <p className="eyebrow text-muted-foreground">
        {activeItem?.label ?? "Controle de Custos"}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={themeLabel}
              onClick={onToggleTheme}
              data-testid="theme-toggle-button"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{themeLabel}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-3 px-2"
              aria-label="Menu do usuário"
            >
              <Avatar className="size-8">
                {profile.photoURL && (
                  <AvatarImage src={profile.photoURL} alt="" />
                )}
                <AvatarFallback className="bg-pale-iris text-xs font-medium text-tile-foreground">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-sm">{userName}</span>
                <span className="eyebrow text-[10px] text-muted-foreground">
                  {getRoleLabel(profile.role)}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{userName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {profile.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              <LogOutIcon aria-hidden="true" />
              {isLoggingOut ? "Saindo..." : "Sair do sistema"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
