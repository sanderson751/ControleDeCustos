import { render, screen } from "@testing-library/react";
import { CostFormFields } from "@/components/costs/CostFormFields";
import {
  type CostFormState,
  EMPTY_COST_FORM,
} from "@/components/costs/costFormState";
import { buildCategoryCatalog } from "@/domain/rules/categoryRules";
import { useCategories } from "@/providers/CategoriesProvider";

vi.mock("@/providers/CategoriesProvider", () => ({ useCategories: vi.fn() }));

const CUSTOMS = [
  { id: "pets1", name: "Pets", archived: false },
  { id: "old1", name: "Assinaturas", archived: true },
];

function renderFields(
  value: Partial<CostFormState> = {},
  keepArchivedCategory = false,
) {
  vi.mocked(useCategories).mockReturnValue({
    catalog: buildCategoryCatalog(CUSTOMS),
    customs: CUSTOMS,
    isLoading: false,
    error: null,
  });
  render(
    <CostFormFields
      idPrefix="t"
      value={{ ...EMPTY_COST_FORM, ...value }}
      onChange={vi.fn()}
      keepArchivedCategory={keepArchivedCategory}
    />,
  );
}

describe("CostFormFields - categorias personalizadas", () => {
  it("novo lancamento lista padrao e ativas, sem arquivadas", () => {
    renderFields();

    expect(screen.getByRole("option", { name: "Pets" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Moradia" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Assinaturas/ }),
    ).not.toBeInTheDocument();
  });

  it("edicao de lancamento com categoria arquivada mantem a opcao marcada", () => {
    renderFields({ category: "old1" }, true);

    expect(
      screen.getByRole("option", { name: "Assinaturas (arquivada)" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toHaveValue("old1");
  });

  it("regressao: no cadastro, arquivada selecionada antes some e exige nova escolha", () => {
    renderFields({ category: "old1" });

    expect(
      screen.queryByRole("option", { name: /Assinaturas/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toHaveValue("");
  });
});
