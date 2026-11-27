import type { GroceryList, GroceryProduct } from "@/domain/entities/grocery";
import {
  addItemToList,
  applyPurchaseToProduct,
  buildCompletion,
  defaultListName,
  forecastList,
  listBudgetCheck,
  reuseListItems,
  searchProducts,
  validateCompletion,
  validateListName,
  validateProductName,
  validateQuantity,
  formatQuantity,
  itemsTotalMismatch,
  parseQuantityInput,
} from "@/domain/rules/groceryRules";

const NOW = new Date(2026, 10, 27, 12);

const product = (overrides: Partial<GroceryProduct> = {}): GroceryProduct => ({
  id: "arroz",
  name: "Arroz 5kg",
  normalizedName: "arroz 5kg",
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

const CAFE = product({ id: "cafe", name: "Café", normalizedName: "cafe" });
const list = (overrides: Partial<GroceryList> = {}): GroceryList => ({
  id: "l1",
  name: "Compra de 27/11",
  status: "aberta",
  items: [
    { id: "i1", productId: "arroz", name: "Arroz 5kg", quantity: 2, checked: false },
    { id: "i2", productId: "cafe", name: "Café", quantity: 1, checked: true },
  ],
  purchaseId: null,
  paidTotal: null,
  createdAt: NOW,
  completedAt: null,
  ...overrides,
});

describe("validacoes", () => {
  it("nome do produto: obrigatorio, tamanho e unico sem acento/caixa", () => {
    expect(validateProductName("  Feijão   preto ", [])).toEqual({ ok: true, value: "Feijão preto" });
    expect(validateProductName(" ", [])).toEqual({ ok: false, message: "Informe o nome do produto." });
    expect(validateProductName("x".repeat(81), []).ok).toBe(false);
    expect(validateProductName("CAFÉ", [CAFE])).toEqual({
      ok: false,
      message: 'O produto "Café" já existe no seu catálogo.',
    });
  });

  it("nome da lista e nome padrao", () => {
    expect(validateListName(" Feira ")).toEqual({ ok: true, value: "Feira" });
    expect(validateListName("").ok).toBe(false);
    expect(validateListName("x".repeat(61)).ok).toBe(false);
    expect(defaultListName(new Date(2026, 0, 5))).toBe("Compra de 05/01");
  });

  it("quantidade: inteira para unidade, ate 3 casas para kg/l", () => {
    expect(validateQuantity(2, "un")).toEqual({ ok: true, value: 2 });
    expect(validateQuantity(1.5, "un").ok).toBe(false);
    expect(validateQuantity(1.2345, "kg")).toEqual({ ok: true, value: 1.235 });
    expect(validateQuantity(0, "kg").ok).toBe(false);
    expect(validateQuantity(10000, "un").ok).toBe(false);
    expect(validateQuantity(Number.NaN, "un").ok).toBe(false);
  });
});

describe("catalogo e lista", () => {
  it("busca sem acento, prefixo primeiro", () => {
    const products = [product(), CAFE, product({ id: "x", name: "Leite com café", normalizedName: "leite com cafe" })];
    expect(searchProducts(products, "CAFE").map((item) => item.id)).toEqual(["cafe", "x"]);
    expect(searchProducts(products, " ")).toEqual([]);
  });

  it("adicionar produto ja presente soma a quantidade", () => {
    const result = addItemToList(list().items, CAFE, 2, "novo");
    expect(result.ok && result.value.find((item) => item.productId === "cafe")?.quantity).toBe(3);

    const added = addItemToList(list().items, product({ id: "leite", name: "Leite" }), 6, "novo");
    expect(added.ok && added.value.at(-1)).toEqual({
      id: "novo",
      productId: "leite",
      name: "Leite",
      quantity: 6,
      checked: false,
    });
  });

  it("limita itens distintos e quantidade somada", () => {
    const many = Array.from({ length: 150 }, (_, index) => ({
      id: `i${index}`,
      productId: `p${index}`,
      name: "x",
      quantity: 1,
      checked: false,
    }));
    expect(addItemToList(many, product({ id: "novo" }), 1, "n").ok).toBe(false);
    expect(addItemToList(list().items, CAFE, 9999, "n").ok).toBe(false);
  });

  it("cenario 1 e 3: previsao pelo ultimo preco; sem historico nao soma", () => {
    expect(forecastList(list().items, [product(), CAFE])).toMatchObject({
      total: 0,
      pricedCount: 0,
      missingCount: 2,
    });

    const forecast = forecastList(list().items, [
      product({ lastUnitPrice: 25.9 }),
      { ...CAFE, lastUnitPrice: 8.2 },
    ]);
    expect(forecast.total).toBe(60);
    expect(forecast.items.map((item) => [item.unitPrice, item.total])).toEqual([
      [25.9, 51.8],
      [8.2, 8.2],
    ]);
  });

  it("previsao com peso em kg e centavos exatos", () => {
    const forecast = forecastList(
      [{ id: "i", productId: "carne", name: "Carne", quantity: 1.234, checked: false }],
      [product({ id: "carne", unit: "kg", lastUnitPrice: 39.9 })],
    );
    expect(forecast.total).toBe(49.24);
  });

  it("usar novamente desmarca e gera novos ids", () => {
    expect(reuseListItems(list(), (index) => `n${index}`)).toEqual([
      { id: "n0", productId: "arroz", name: "Arroz 5kg", quantity: 2, checked: false },
      { id: "n1", productId: "cafe", name: "Café", quantity: 1, checked: false },
    ]);
  });
});

describe("lista x orcamento", () => {
  it("cenario 4: atencao com 96%", () => {
    expect(listBudgetCheck(60, 420, 500)).toEqual({
      hasBudget: true,
      limit: 500,
      spent: 420,
      forecast: 60,
      projected: 480,
      percent: 96,
      status: "atencao",
      remaining: 20,
    });
  });

  it("estouro e sem orcamento", () => {
    expect(listBudgetCheck(100, 450, 500)).toMatchObject({ status: "estourado", remaining: -50 });
    expect(listBudgetCheck(100, 0, null)).toEqual({ hasBudget: false });
  });
});

describe("conclusao", () => {
  it("valida total, data e loja (padrao Mercado)", () => {
    const base = { store: " ", purchasedAt: NOW, total: 60, unitPrices: {} };
    expect(validateCompletion(base, NOW)).toEqual({ ok: true, value: { ...base, store: "Mercado" } });
    expect(validateCompletion({ ...base, total: 0 }, NOW)).toEqual({
      ok: false,
      message: "Informe o total pago na compra.",
    });
    expect(validateCompletion({ ...base, purchasedAt: new Date(2026, 10, 28, 9) }, NOW).ok).toBe(false);
    expect(validateCompletion({ ...base, purchasedAt: null }, NOW).ok).toBe(false);
    expect(validateCompletion({ ...base, store: "x".repeat(61) }, NOW).ok).toBe(false);
    expect(validateCompletion({ ...base, unitPrices: { i1: -1 } }, NOW).ok).toBe(false);
  });

  it("cenario 2: custo, compra e produtos so com preco informado", () => {
    const plan = buildCompletion(list(), [product(), CAFE], {
      store: "Assaí",
      purchasedAt: NOW,
      total: 60,
      unitPrices: { i1: 25.9, i2: Number.NaN },
    });

    expect(plan.cost).toEqual({
      accountName: "Mercado — Assaí",
      amount: 60,
      description: "Lista: Compra de 27/11",
      purchasedAt: NOW,
    });
    expect(plan.newProducts).toEqual([]);
    expect(plan.receipt).toBeNull();
    expect(plan.purchase.items).toEqual([
      { productId: "arroz", rawName: "Arroz 5kg", quantity: 2, unitPrice: 25.9, lineTotal: 51.8 },
    ]);
    expect(plan.productUpdates).toEqual([
      {
        productId: "arroz",
        aliases: [],
        lastUnitPrice: 25.9,
        previousUnitPrice: null,
        lastPurchasedAt: NOW,
        lastStore: "Assaí",
        purchaseCount: 1,
        avgIntervalDays: null,
        intervalCount: 0,
      },
    ]);
  });

  it("historico: anterior <- ultimo, intervalo medio incremental", () => {
    const first = new Date(2026, 9, 1, 12);
    const second = new Date(2026, 9, 15, 12);
    const third = new Date(2026, 10, 1, 12);
    let current = product();
    for (const [date, price] of [[first, 20], [second, 22], [third, 25.9]] as const) {
      current = { ...current, ...applyPurchaseToProduct(current, price, date, "Assaí") };
    }

    expect(current).toMatchObject({
      lastUnitPrice: 25.9,
      previousUnitPrice: 22,
      purchaseCount: 3,
      avgIntervalDays: 15.5,
      lastPurchasedAt: third,
    });
  });

  it("regressao: mesmo dia (hora anterior) ou produto sem preco aceitam o preco novo", () => {
    const sameDayLater = new Date(2026, 10, 27, 18);
    expect(
      applyPurchaseToProduct(product({ lastUnitPrice: 20, lastPurchasedAt: sameDayLater, purchaseCount: 1 }), 22, NOW, "A")
        .lastUnitPrice,
    ).toBe(22);
    expect(
      applyPurchaseToProduct(product({ lastPurchasedAt: new Date(2027, 0, 1) }), 8.2, NOW, "A").lastUnitPrice,
    ).toBe(8.2);
  });

  it("compra com data anterior a ultima nao reescreve o ultimo preco", () => {
    const current = product({ lastUnitPrice: 30, lastPurchasedAt: NOW, purchaseCount: 2, avgIntervalDays: 10, intervalCount: 1 });
    expect(applyPurchaseToProduct(current, 10, new Date(2026, 0, 1), "Outro")).toMatchObject({
      lastUnitPrice: 30,
      purchaseCount: 3,
      avgIntervalDays: 10,
    });
  });
});

describe("formatQuantity", () => {
  it("usa virgula e omite casas em inteiros", () => {
    expect(formatQuantity(1.2)).toBe("1,2");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1.234)).toBe("1,234");
  });
});

describe("regressoes da revisao", () => {
  it("compra retroativa nao distorce a media; mesmo dia nao conta intervalo", () => {
    let current = product();
    const buy = (date: Date, price = 10) => {
      current = { ...current, ...applyPurchaseToProduct(current, price, date, "A") };
    };
    buy(new Date(2026, 0, 1, 12));
    buy(new Date(2026, 0, 11, 12)); // intervalo 10
    buy(new Date(2025, 5, 1, 12)); // retroativa
    buy(new Date(2026, 0, 31, 12)); // intervalo 20
    buy(new Date(2026, 0, 31, 12)); // mesmo dia

    expect(current).toMatchObject({ purchaseCount: 5, intervalCount: 2, avgIntervalDays: 15 });
  });

  it("intervalo e media limitados ao teto aceito pelas regras", () => {
    const old = product({ lastUnitPrice: 5, lastPurchasedAt: new Date(2005, 0, 1), purchaseCount: 1 });
    expect(applyPurchaseToProduct(old, 6, NOW, "A").avgIntervalDays).toBe(3650);
  });

  it("quantidade digitada em pt-BR", () => {
    expect(parseQuantityInput("1,5", "kg")).toBe(1.5);
    expect(parseQuantityInput("1.5", "kg")).toBe(1.5);
    expect(parseQuantityInput("1.000", "g")).toBe(1000);
    expect(parseQuantityInput("1.000,5", "kg")).toBe(1000.5);
    expect(parseQuantityInput("1.5", "un")).toBeNull();
    expect(parseQuantityInput("12", "un")).toBe(12);
    expect(parseQuantityInput("abc", "un")).toBeNull();
  });

  it("aviso de diferenca entre soma dos itens e total pago (>= 5%)", () => {
    expect(itemsTotalMismatch(100, 100)).toBe(false);
    expect(itemsTotalMismatch(96, 100)).toBe(false);
    expect(itemsTotalMismatch(90, 100)).toBe(true);
    expect(itemsTotalMismatch(0, 100)).toBe(false);
  });
});
