import { NavLink, useLocation } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { UserRole } from "@/domain/entities/user";
import { getRoleLabel } from "@/domain/rules/permissions";
import {
  buildNavigationTarget,
  findActiveNavigationItem,
  getNavigationForRole,
  ROUTES,
} from "@/routes/navigation";

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 21.5 14 15l4 3.5 5-7"
        fill="none"
        className="stroke-iris"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppSidebar({ role }: { role: UserRole }) {
  const { pathname, search } = useLocation();
  const items = getNavigationForRole(role);
  const activeItem = findActiveNavigationItem(pathname);

  return (
    <Sidebar collapsible="icon" aria-label="Menu lateral">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Controle de Custos">
              <NavLink to={ROUTES.home}>
                <BrandMark />
                <span className="flex flex-col leading-tight">
                  <span className="font-display-light text-lg">
                    Controle de Custos
                  </span>
                  <span className="eyebrow text-[10px] text-muted-foreground">
                    Finanças pessoais
                  </span>
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="eyebrow text-[10px]">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = activeItem?.key === item.key;

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <NavLink
                        to={buildNavigationTarget(item, search)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="eyebrow px-2 pb-1 text-[10px] text-muted-foreground">
          Acesso: {getRoleLabel(role)}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
