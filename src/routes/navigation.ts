import {
  ChartColumnIcon,
  FileUpIcon,
  HouseIcon,
  type LucideIcon,
  PiggyBankIcon,
  RepeatIcon,
  ShoppingCartIcon,
  TargetIcon,
  TagsIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { Competence } from "@/domain/entities/cost";
import type { UserRole } from "@/domain/entities/user";
import {
  getCurrentCompetence,
  isSameCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";

export const ROUTES = {
  login: "/login",
  home: "/home",
  costs: "/costs",
  costEdit: (costId: string) => `/costs/${encodeURIComponent(costId)}/edit`,
  budgets: "/budgets",
  evolution: "/evolution",
  categories: "/categories",
  import: "/import",
  recurring: "/recurring",
  goals: "/goals",
  grocery: "/grocery",
  groceryList: (listId: string) => `/grocery/${encodeURIComponent(listId)}`,
  groceryShop: (listId: string) => `/grocery/${encodeURIComponent(listId)}/shop`,
  /** Link enviado a quem foi convidado (os convites aparecem em Mercado). */
  groceryInvites: "/grocery/convites",
  sharedGroceryList: (ownerId: string, listId: string) =>
    `/grocery/compartilhada/${encodeURIComponent(ownerId)}/${encodeURIComponent(listId)}`,
  sharedGroceryShop: (ownerId: string, listId: string) =>
    `/grocery/compartilhada/${encodeURIComponent(ownerId)}/${encodeURIComponent(listId)}/shop`,
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
  /** Mantem a competencia visualizada (?mes=) ao navegar. */
  keepsCompetence?: boolean;
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    key: "home",
    label: "Início",
    path: ROUTES.home,
    icon: HouseIcon,
    keepsCompetence: true,
  },
  {
    key: "costs",
    label: "Custos",
    path: ROUTES.costs,
    icon: WalletIcon,
    keepsCompetence: true,
  },
  {
    key: "budgets",
    label: "Orçamentos",
    path: ROUTES.budgets,
    icon: PiggyBankIcon,
    keepsCompetence: true,
  },
  {
    key: "evolution",
    label: "Evolução",
    path: ROUTES.evolution,
    icon: TrendingUpIcon,
    keepsCompetence: true,
  },
  {
    key: "grocery",
    label: "Mercado",
    path: ROUTES.grocery,
    icon: ShoppingCartIcon,
  },
  {
    key: "goals",
    label: "Metas",
    path: ROUTES.goals,
    icon: TargetIcon,
  },
  {
    key: "recurring",
    label: "Recorrentes",
    path: ROUTES.recurring,
    icon: RepeatIcon,
  },
  {
    key: "import",
    label: "Importar extrato",
    path: ROUTES.import,
    icon: FileUpIcon,
    visibleTo: ["admin", "standard"],
  },
  {
    key: "categories",
    label: "Categorias",
    path: ROUTES.categories,
    icon: TagsIcon,
  },
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

/** Caminho com `?mes=AAAA-MM` (omitido quando e a competencia atual). */
export function withCompetence(path: string, competence: Competence): string {
  return isSameCompetence(competence, getCurrentCompetence())
    ? path
    : `${path}?mes=${toCompetenceParam(competence)}`;
}

/** Destino do item preservando `?mes=` quando o item trabalha por competencia. */
export function buildNavigationTarget(
  item: NavigationItem,
  currentSearch: string,
): string {
  if (!item.keepsCompetence) {
    return item.path;
  }

  const month = new URLSearchParams(currentSearch).get("mes");
  return month ? `${item.path}?mes=${encodeURIComponent(month)}` : item.path;
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
