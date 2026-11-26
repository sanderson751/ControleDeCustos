import type {
  PermissionAction,
  PermissionResource,
  UserRole,
} from "@/domain/entities/user";

type ActionMatrix = Record<PermissionAction, boolean>;

const NONE: ActionMatrix = {
  view: false,
  add: false,
  edit: false,
  delete: false,
  manage_roles: false,
};
const READ_ONLY: ActionMatrix = { ...NONE, view: true };
const CRUD: ActionMatrix = {
  ...NONE,
  view: true,
  add: true,
  edit: true,
  delete: true,
};

/**
 * Matriz de permissoes da interface.
 * A fonte de verdade de seguranca e `firestore.rules`: qualquer alteracao
 * aqui DEVE ser refletida nas regras do Firestore (e vice-versa).
 */
const PERMISSION_MATRIX: Record<
  UserRole,
  Record<PermissionResource, ActionMatrix>
> = {
  admin: {
    costEntries: CRUD,
    budgetLimits: CRUD,
    recurringBudgets: CRUD,
    userProfiles: { ...CRUD, manage_roles: true },
    settings: { ...READ_ONLY, edit: true },
  },
  standard: {
    costEntries: CRUD,
    budgetLimits: CRUD,
    recurringBudgets: CRUD,
    userProfiles: NONE,
    settings: { ...READ_ONLY, edit: true },
  },
  guest: {
    costEntries: READ_ONLY,
    budgetLimits: READ_ONLY,
    recurringBudgets: READ_ONLY,
    userProfiles: NONE,
    settings: READ_ONLY,
  },
};

export function isPermitted(
  role: UserRole | null | undefined,
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  if (!role) {
    return false;
  }

  return PERMISSION_MATRIX[role]?.[resource]?.[action] ?? false;
}

export function canMutateCosts(role: UserRole | null | undefined): boolean {
  return isPermitted(role, "costEntries", "add");
}

export function canManageRoles(role: UserRole | null | undefined): boolean {
  return isPermitted(role, "userProfiles", "manage_roles");
}

export function normalizeRole(value: unknown): UserRole {
  return value === "admin" || value === "standard" || value === "guest"
    ? value
    : "standard";
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  standard: "Usuário padrão",
  guest: "Convidado",
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Acesso total a todas as funcionalidades e configurações do sistema.",
  standard:
    "Acesso a todas as funcionalidades, exceto o controle de papéis de usuários.",
  guest: "Acesso somente de visualização em todas as telas.",
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function getRoleDescription(role: UserRole): string {
  return ROLE_DESCRIPTIONS[role] ?? "";
}
