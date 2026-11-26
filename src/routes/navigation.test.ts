import {
  findActiveNavigationItem,
  getNavigationForRole,
  ROUTES,
} from "@/routes/navigation";

describe("navigation", () => {
  it("exibe Perfis de usuarios apenas para admin", () => {
    expect(getNavigationForRole("admin").map((item) => item.key)).toEqual([
      "home",
      "costs",
      "reports",
      "userProfiles",
    ]);
    expect(getNavigationForRole("standard").map((item) => item.key)).toEqual([
      "home",
      "costs",
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

  it("monta a rota de edicao com id codificado", () => {
    expect(ROUTES.costEdit("a/b")).toBe("/costs/a%2Fb/edit");
  });
});
