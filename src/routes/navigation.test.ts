import { getCurrentCompetence } from "@/domain/rules/competence";
import {
  buildNavigationTarget,
  findActiveNavigationItem,
  getNavigationForRole,
  ROUTES,
  withCompetence,
} from "@/routes/navigation";

describe("navigation", () => {
  it("exibe Perfis de usuarios apenas para admin", () => {
    expect(getNavigationForRole("admin").map((item) => item.key)).toEqual([
      "home",
      "costs",
      "budgets",
      "reports",
      "userProfiles",
    ]);
    expect(getNavigationForRole("standard").map((item) => item.key)).toEqual([
      "home",
      "costs",
      "budgets",
      "reports",
    ]);
    expect(
      getNavigationForRole("guest").some((item) => item.key === "userProfiles"),
    ).toBe(false);
  });

  it("identifica o item ativo inclusive em subrotas", () => {
    expect(findActiveNavigationItem("/costs")?.key).toBe("costs");
    expect(findActiveNavigationItem("/costs/abc/edit")?.key).toBe("costs");
    expect(findActiveNavigationItem("/costsx")).toBeUndefined();
    expect(findActiveNavigationItem("/login")).toBeUndefined();
  });

  it("preserva a competencia apenas nos itens que trabalham por mes", () => {
    const [home, , budgets, reports] = getNavigationForRole("standard");
    expect(buildNavigationTarget(home, "?mes=2026-02")).toBe("/home?mes=2026-02");
    expect(buildNavigationTarget(budgets, "?mes=2026-02&x=1")).toBe(
      "/budgets?mes=2026-02",
    );
    expect(buildNavigationTarget(home, "")).toBe("/home");
    expect(buildNavigationTarget(reports, "?mes=2026-02")).toBe("/reports");
  });

  it("withCompetence omite o parametro no mes atual", () => {
    expect(withCompetence("/costs", { year: 2025, month: 7 })).toBe(
      "/costs?mes=2025-07",
    );
    expect(withCompetence("/costs", getCurrentCompetence())).toBe("/costs");
  });

  it("monta a rota de edicao com id codificado", () => {
    expect(ROUTES.costEdit("a/b")).toBe("/costs/a%2Fb/edit");
  });
});
