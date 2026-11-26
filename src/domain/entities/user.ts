/**
 * Niveis de acesso do sistema
 * - admin: acesso irrestrito, inclusive gestao de papeis
 * - standard: acesso a tudo exceto gestao de papeis
 * - guest: somente leitura
 */
export type UserRole = "admin" | "standard" | "guest";

export const USER_ROLES: readonly UserRole[] = ["admin", "standard", "guest"];

export type PermissionAction =
  | "view"
  | "add"
  | "edit"
  | "delete"
  | "manage_roles";

export type PermissionResource =
  | "costEntries"
  | "budgetLimits"
  | "recurringBudgets"
  | "userProfiles"
  | "settings";

export type UserProfile = {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export type ThemeMode = "light" | "dark";

export type UiPreferences = {
  sidebarCollapsed: boolean;
  theme: ThemeMode;
};

export const DEFAULT_THEME: ThemeMode = "dark";

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  sidebarCollapsed: false,
  theme: DEFAULT_THEME,
};
