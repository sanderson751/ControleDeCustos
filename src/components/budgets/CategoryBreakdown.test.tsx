import { render, screen } from "@testing-library/react";
import { CategoryBreakdown } from "@/components/budgets/CategoryBreakdown";

describe("CategoryBreakdown", () => {
  it("regressao: orcamento estourado (130%) mostra o percentual real e a barra limitada a 100", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <CategoryBreakdown
        totals={[{ category: "saude", total: 780, share: 1 }]}
        budgets={[
          {
            category: "saude",
            spent: 780,
            limit: 600,
            percent: 130,
            remaining: -180,
            status: "estourado",
          },
        ]}
      />,
    );

    expect(screen.getByText(/130% do orçamento/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(errors).not.toHaveBeenCalled();
  });
});
