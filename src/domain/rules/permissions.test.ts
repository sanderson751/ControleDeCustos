import { USER_ROLES } from "@/domain/entities/user";
import {
  canManageRoles,
  canMutateCosts,
  getRoleDescription,
  getRoleLabel,
  isPermitted,
  normalizeRole,
} from "@/domain/rules/permissions";

describe("isPermitted", () => {
  it("admin possui CRUD de custos e gestao de papeis", () => {
    for (const action of ["view", "add", "edit", "delete"] as const) {
      expect(isPermitted("admin", "costEntries", action)).toBe(true);
    }
    expect(isPermitted("admin", "userProfiles", "manage_roles")).toBe(true);
  });

  it("standard possui CRUD de custos mas nao acessa perfis", () => {
    expect(isPermitted("standard", "costEntries", "delete")).toBe(true);
    expect(isPermitted("standard", "userProfiles", "view")).toBe(false);
    expect(isPermitted("standard", "userProfiles", "manage_roles")).toBe(false);
  });

  it("guest e somente leitura", () => {
    expect(isPermitted("guest", "costEntries", "view")).toBe(true);
    for (const action of ["add", "edit", "delete"] as const) {
      expect(isPermitted("guest", "costEntries", action)).toBe(false);
    }
    expect(isPermitted("guest", "settings", "edit")).toBe(false);
  });

  it("nega tudo sem papel", () => {
    expect(isPermitted(null, "costEntries", "view")).toBe(false);
    expect(isPermitted(undefined, "costEntries", "view")).toBe(false);
  });
});

describe("atalhos de permissao", () => {
  it("canMutateCosts", () => {
    expect(canMutateCosts("admin")).toBe(true);
    expect(canMutateCosts("standard")).toBe(true);
    expect(canMutateCosts("guest")).toBe(false);
    expect(canMutateCosts(null)).toBe(false);
  });

  it("canManageRoles somente para admin", () => {
    expect(USER_ROLES.filter((role) => canManageRoles(role))).toEqual([
      "admin",
    ]);
  });
});

describe("normalizeRole", () => {
  it("mantem papeis validos e usa standard como fallback", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("guest")).toBe("guest");
    expect(normalizeRole("root")).toBe("standard");
    expect(normalizeRole(undefined)).toBe("standard");
  });
});

describe("rotulos de papel", () => {
  it("possui rotulo e descricao para todos os papeis", () => {
    expect(getRoleLabel("admin")).toBe("Admin");
    expect(getRoleLabel("standard")).toBe("Usuário padrão");
    expect(getRoleLabel("guest")).toBe("Convidado");
    for (const role of USER_ROLES) {
      expect(getRoleDescription(role)).not.toHaveLength(0);
    }
  });
});
