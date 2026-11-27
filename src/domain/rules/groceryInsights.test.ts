import type { GroceryProduct } from "@/domain/entities/grocery";
import {
  describeRestock,
  formatTrend,
  marketInflation,
  priceTrend,
  restockSuggestions,
  shopProgress,
} from "@/domain/rules/groceryInsights";

const NOW = new Date(2026, 10, 27, 12);

const product = (id: string, overrides: Partial<GroceryProduct> = {}): GroceryProduct => ({
  id,
  name: id,
  normalizedName: id,
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

describe("priceTrend", () => {
  it("alta, queda e estavel sobre o preco anterior", () => {
    expect(priceTrend({ lastUnitPrice: 28, previousUnitPrice: 25 })).toEqual({
      percent: 12,
      direction: "up",
      previous: 25,
      last: 28,
    });
    expect(priceTrend({ lastUnitPrice: 9.5, previousUnitPrice: 10 })?.direction).toBe("down");
    expect(priceTrend({ lastUnitPrice: 10.04, previousUnitPrice: 10 })?.direction).toBe("stable");
    expect(formatTrend(priceTrend({ lastUnitPrice: 28.13, previousUnitPrice: 25 })!)).toBe("+12,5%");
    expect(formatTrend(priceTrend({ lastUnitPrice: 9.5, previousUnitPrice: 10 })!)).toBe("−5%");
    expect(formatTrend(priceTrend({ lastUnitPrice: 10, previousUnitPrice: 10 })!)).toBe("estável");
  });

  it("sem dois precos nao ha variacao", () => {
    expect(priceTrend({ lastUnitPrice: 10, previousUnitPrice: null })).toBeNull();
    expect(priceTrend({ lastUnitPrice: null, previousUnitPrice: null })).toBeNull();
    expect(priceTrend({ lastUnitPrice: 10, previousUnitPrice: 0 })).toBeNull();
  });
});

describe("marketInflation", () => {
  const products = [
    product("arroz", { lastUnitPrice: 28, previousUnitPrice: 25, lastPurchasedAt: new Date(2026, 10, 20) }),
    product("cafe", { lastUnitPrice: 18, previousUnitPrice: 20, lastPurchasedAt: new Date(2026, 10, 5) }),
    product("leite", { lastUnitPrice: 5, previousUnitPrice: 5, lastPurchasedAt: new Date(2026, 10, 5) }),
    // Outro mes e primeira compra nao entram.
    product("feijao", { lastUnitPrice: 12, previousUnitPrice: 6, lastPurchasedAt: new Date(2026, 9, 30) }),
    product("sal", { lastUnitPrice: 3, lastPurchasedAt: new Date(2026, 10, 10) }),
  ];

  it("variacao da cesta com uma unidade de cada produto recomprado no mes", () => {
    const inflation = marketInflation(products, 2026, 11)!;
    // (28 + 18 + 5) / (25 + 20 + 5) = 51 / 50 => +2%.
    expect(inflation).toMatchObject({ percent: 2, current: 51, previous: 50, productCount: 3 });
    expect(inflation.topUp.map((entry) => entry.product.id)).toEqual(["arroz"]);
    expect(inflation.topDown.map((entry) => entry.product.id)).toEqual(["cafe"]);
  });

  it("maiores altas e quedas: ate 3 cada, da maior variacao para a menor", () => {
    const many = [5, 10, 20, 40, -5, -10, -20, -40].map((percent, index) =>
      product(`p${index}`, {
        lastUnitPrice: 100 + percent,
        previousUnitPrice: 100,
        lastPurchasedAt: new Date(2026, 10, 10),
      }),
    );
    const inflation = marketInflation(many, 2026, 11)!;
    expect(inflation.topUp.map((entry) => entry.trend.percent)).toEqual([40, 20, 10]);
    expect(inflation.topDown.map((entry) => entry.trend.percent)).toEqual([-40, -20, -10]);
    expect(inflation.percent).toBe(0);
  });

  it("sem recompra no mes nao ha indice", () => {
    expect(marketInflation(products, 2026, 9)).toBeNull();
  });
});

describe("restockSuggestions", () => {
  const products = [
    // A cada 7 dias, ultima ha 9: acabando (mais atrasado).
    product("leite", { purchaseCount: 4, avgIntervalDays: 7, lastPurchasedAt: new Date(2026, 10, 18) }),
    // A cada 10, ultima ha 8 (80%): entra.
    product("pao", { purchaseCount: 3, avgIntervalDays: 10, lastPurchasedAt: new Date(2026, 10, 19) }),
    // A cada 30, ultima ha 10: ainda nao.
    product("sabao", { purchaseCount: 2, avgIntervalDays: 30, lastPurchasedAt: new Date(2026, 10, 17) }),
    // Uma compra so: sem padrao.
    product("cafe", { purchaseCount: 1, avgIntervalDays: null, lastPurchasedAt: new Date(2026, 8, 1) }),
    // Ja esta na lista.
    product("arroz", { purchaseCount: 5, avgIntervalDays: 15, lastPurchasedAt: new Date(2026, 9, 1) }),
  ];

  it("produtos com padrao de compra perto de acabar, fora da lista, mais atrasados primeiro", () => {
    const suggestions = restockSuggestions(products, [{ productId: "arroz" }], NOW);
    expect(suggestions.map((entry) => [entry.product.id, entry.daysSinceLast])).toEqual([
      ["leite", 9],
      ["pao", 8],
    ]);
    expect(describeRestock(suggestions[0])).toBe("comprado a cada ~7 dias · última há 9 dias");
  });

  it("dias contados por data do calendario (horario de verao nao muda a conta)", () => {
    const leite = product("leite", { purchaseCount: 3, avgIntervalDays: 10, lastPurchasedAt: new Date(2026, 9, 25, 23, 30) });
    expect(restockSuggestions([leite], [], new Date(2026, 10, 3, 0, 15))[0]?.daysSinceLast).toBe(9);
  });

  it("respeita o limite", () => {
    expect(restockSuggestions(products, [], NOW, 1).map((entry) => entry.product.id)).toEqual(["arroz"]);
  });
});

describe("shopProgress", () => {
  it("soma o previsto dos itens no carrinho e conta os sem historico", () => {
    const products = [product("arroz", { lastUnitPrice: 25.9 }), product("cafe")];
    expect(
      shopProgress(
        [
          { productId: "arroz", quantity: 2, checked: true },
          { productId: "cafe", quantity: 1, checked: true },
          { productId: "arroz", quantity: 1, checked: false },
        ],
        products,
      ),
    ).toEqual({ checkedCount: 2, total: 3, cartForecast: 51.8, cartMissing: 1 });
  });
});
