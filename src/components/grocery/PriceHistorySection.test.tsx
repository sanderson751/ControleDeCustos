import { render, screen, within } from "@testing-library/react";
import { PriceHistorySection } from "@/components/grocery/PriceHistorySection";
import type { GroceryProduct } from "@/domain/entities/grocery";

const NOW = new Date(2026, 10, 27, 12);

const product = (id: string, name: string, overrides: Partial<GroceryProduct> = {}): GroceryProduct => ({
  id,
  name,
  normalizedName: name.toLowerCase(),
  unit: "un",
  lastUnitPrice: null,
  previousUnitPrice: null,
  lastPurchasedAt: null,
  lastStore: "",
  purchaseCount: 0,
  avgIntervalDays: null,
  intervalCount: 0,
  aliases: [],
  ...overrides,
});

describe("PriceHistorySection", () => {
  it("inflacao do mes, maiores altas/quedas e historico por produto", () => {
    render(
      <PriceHistorySection
        now={NOW}
        products={[
          product("arroz", "Arroz 5kg", {
            lastUnitPrice: 28,
            previousUnitPrice: 25,
            lastPurchasedAt: new Date(2026, 10, 20),
            lastStore: "Assaí",
          }),
          product("cafe", "Café", { lastUnitPrice: 18, previousUnitPrice: 20, lastPurchasedAt: new Date(2026, 10, 5) }),
          product("sal", "Sal", { lastUnitPrice: 3, lastPurchasedAt: new Date(2026, 10, 10) }),
          product("novo", "Nunca comprado"),
        ]}
      />,
    );

    // (28 + 18) / (25 + 20) = +2,2%.
    expect(screen.getByText("+2,2%")).toBeInTheDocument();
    expect(screen.getByText(/2 produtos recomprados: R\$ 45,00 → R\$ 46,00/)).toBeInTheDocument();
    expect(screen.getByText("Arroz 5kg +12%")).toBeInTheDocument();
    expect(screen.getByText("Café −10%")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Histórico de preços" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Arroz 5kg"),
      expect.stringContaining("Café"),
      expect.stringContaining("Sal"),
    ]);
    expect(rows[0]).toHaveTextContent("Preço subiu: +12% desde a compra anterior (R$ 25,00)");
    expect(rows[0]).toHaveTextContent("20/11/2026 · Assaí");
    expect(rows[2]).toHaveTextContent("primeira compra");
    expect(within(table).queryByText("Nunca comprado")).not.toBeInTheDocument();
  });

  it("sem historico pede a primeira compra com precos", () => {
    render(<PriceHistorySection now={NOW} products={[product("novo", "Novo")]} />);
    expect(screen.getByText(/Conclua uma compra informando os preços/)).toBeInTheDocument();
  });

  it("sem recompra no mes mostra o indice vazio", () => {
    render(
      <PriceHistorySection
        now={NOW}
        products={[product("a", "A", { lastUnitPrice: 2, previousUnitPrice: 1, lastPurchasedAt: new Date(2026, 8, 1) })]}
      />,
    );
    expect(screen.getByText("Nenhum produto recomprado neste mês ainda.")).toBeInTheDocument();
  });
});
