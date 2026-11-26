import {
  ChartColumnIcon,
  HouseIcon,
  type LucideIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { UserRole } from "@/domain/entities/user";

export const ROUTES = {
  login: "/login",
  home: "/home",
  costs: "/costs",
  costEdit: (costId: string) => `/costs/${encodeURIComponent(costId)}/edit`,
  reports: "/reports",
  userProfiles: "/userProfiles",
} as const;

export type NavigationItem = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Quando definido, apenas estes papeis enxergam o item. */
  visibleTo?: readonly UserRole[];
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { key: "home", label: "Início", path: ROUTES.home, icon: HouseIcon },
  { key: "costs", label: "Custos", path: ROUTES.costs, icon: WalletIcon },
  {
    key: "reports",
    label: "Relatórios",
    path: ROUTES.reports,
    icon: ChartColumnIcon,
  },
  {
    key: "userProfiles",
    label: "Perfis de usuários",
    path: ROUTES.userProfiles,
    icon: UsersIcon,
    visibleTo: ["admin"],
  },
];

export function getNavigationForRole(role: UserRole): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(
    (item) => !item.visibleTo || item.visibleTo.includes(role),
  );
}

/** Item de navegacao ativo para o caminho atual (prefixo mais longo). */
export function findActiveNavigationItem(
  pathname: string,
): NavigationItem | undefined {
  return [...NAVIGATION_ITEMS]
    .sort((left, right) => right.path.length - left.path.length)
    .find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    );
}
