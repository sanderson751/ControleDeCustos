import { act, screen } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { buildCategoryCatalog } from "@/domain/rules/categoryRules";
import BudgetsPage from "@/pages/BudgetsPage";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import {
  listMonthBudgets,
  listRecurringBudgets,
} from "@/services/budgetService";
import { listMonthCosts } from "@/services/costService";
import { makeBudget, makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/providers/CategoriesProvider", () => ({ useCategories: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({ listMonthCosts: vi.fn() }));
vi.mock("@/services/budgetService", async () =>
  (await import("@/test/budgetServiceMock")).createBudgetServiceMock(),
);

const MARCH = { year: 2026, month: 3 };
const CUSTOMS = [
  { id: "pets1", name: "Pets", archived: false },
  { id: "old1", name: "Antiga em uso", archived: true },
  { id: "old2", name: "Antiga com limite", archived: true },
  { id: "old3", name: "Antiga sem uso", archived: true },
];

describe("BudgetsPage - categorias personalizadas", () => {
  it("lista ativas e arquivadas apenas quando em uso no mes", async () => {
    vi.mocked(useSession).mockReturnValue({
      profile: makeProfile("standard"),
      firebaseUser: {} as never,
    });
    vi.mocked(useCategories).mockReturnValue({
      catalog: buildCategoryCatalog(CUSTOMS),
      customs: CUSTOMS,
      isLoading: false,
      error: null,
    });
    vi.mocked(listMonthCosts).mockResolvedValue([
      makeCostEntry({ category: "old1", amount: 50 }),
    ]);
    vi.mocked(listMonthBudgets).mockResolvedValue([
      makeBudget("old2", 100, MARCH),
    ]);
    vi.mocked(listRecurringBudgets).mockResolvedValue([]);

    renderWithRouter(<BudgetsPage />, {
      route: "/budgets?mes=2026-03",
      path: "/budgets",
    });

    expect(await screen.findByLabelText("Pets")).toBeInTheDocument();
    expect(screen.getByLabelText("Antiga em uso")).toBeInTheDocument();
    expect(screen.getByLabelText("Antiga com limite")).toHaveValue("R$ 100,00");
    expect(screen.queryByLabelText("Antiga sem uso")).not.toBeInTheDocument();
  });
});

describe("BudgetsPage - catalogo atrasado", () => {
  it("mostra categoria em uso fora do catalogo e preserva o rascunho quando ele chega", async () => {
    vi.mocked(useSession).mockReturnValue({
      profile: makeProfile("standard"),
      firebaseUser: {} as never,
    });
    const listeners = new Set<() => void>();
    let current: ReturnType<typeof useCategories> = {
      catalog: buildCategoryCatalog([]),
      customs: [],
      isLoading: true,
      error: null,
    };
    function useCatalogStore() {
      return useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => current,
      );
    }
    vi.mocked(useCategories).mockImplementation(useCatalogStore);
    vi.mocked(listMonthCosts).mockResolvedValue([
      makeCostEntry({ category: "pets1", amount: 40 }),
    ]);
    vi.mocked(listMonthBudgets).mockResolvedValue([]);
    vi.mocked(listRecurringBudgets).mockResolvedValue([]);

    const { user } = renderWithRouter(<BudgetsPage />, {
      route: "/budgets?mes=2026-03",
      path: "/budgets",
    });

    expect(await screen.findByLabelText("Categoria removida")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Moradia"), "50000");

    act(() => {
      current = {
        catalog: buildCategoryCatalog(CUSTOMS),
        customs: CUSTOMS,
        isLoading: false,
        error: null,
      };
      listeners.forEach((listener) => listener());
    });

    expect(await screen.findByLabelText("Pets")).toBeInTheDocument();
    expect(screen.getByLabelText("Moradia")).toHaveValue("R$ 500,00");
  });
});
