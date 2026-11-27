import type { GroceryListItem, GroceryProduct } from "@/domain/entities/grocery";
import { buildCompletion } from "@/domain/rules/groceryRules";
import { aliasKey } from "@/domain/rules/receiptParser";
import {
  applyDecision,
  buildReviewLines,
  groceryUnitFromReceipt,
  learnsAlias,
  listPricesFromReview,
  receiptCompletionFromReview,
  reconcileFilled,
  suggestProductName,
} from "@/domain/rules/receiptReview";

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

const PRODUCTS = [
  product("arroz", "arroz 5kg"),
  product("cafe", "cafe pilao 500g"),
  product("sabao", "sabao em po", { aliases: [aliasKey("SABAO OMO LAVAGEM PERFEITA 1,6KG")] }),
];
const LIST_ITEMS: GroceryListItem[] = [
  { id: "i1", productId: "arroz", name: "Arroz 5kg", quantity: 2, checked: true },
  { id: "i2", productId: "cafe", name: "Café Pilão 500g", quantity: 1, checked: true },
];
const LIST = {
  id: "l1",
  name: "Feira",
  status: "aberta" as const,
  items: LIST_ITEMS,
  purchaseId: null,
  paidTotal: null,
  createdAt: NOW,
  completedAt: null,
};
const line = (rawName: string, unitPrice: number, quantity = 1, unit = "UN") => ({
  rawName,
  quantity,
  unit,
  unitPrice,
  lineTotal: Math.round(unitPrice * quantity * 100) / 100,
});

describe("receiptReview", () => {
  const receipt = {
    items: [
      line("ARROZ TIPO 1 TIO JOAO 5KG", 25.9, 2),
      line("CAFE PILAO TRADICIONAL 500G", 18.9),
      line("SABAO OMO LAVAGEM PERFEITA 1,6KG", 32.5),
      line("DETERGENTE YPE 500ML", 2.79, 3),
    ],
  };

  it("decisao inicial: lista > catalogo (inclusive por apelido) > ignorar, com a nota", () => {
    const lines = buildReviewLines(receipt, LIST_ITEMS, PRODUCTS);
    expect(lines.map((item) => item.decision)).toEqual(["list:i1", "list:i2", "product:sabao", "ignore"]);
    expect(lines[2].score).toBe(1);
    expect(lines[3]).toMatchObject({ score: null, suggestedProductId: null, userChosen: false });
  });

  it("associacao global: o item da lista fica com a linha de maior nota, mesmo que venha depois", () => {
    const lines = buildReviewLines(
      { items: [line("ARROZ PARBOILIZADO TIO JOAO 5KG", 23), line("ARROZ 5KG", 25.9)] },
      LIST_ITEMS,
      PRODUCTS,
    );
    expect(lines.map((item) => item.decision)).toEqual(["ignore", "list:i1"]);
  });

  it("linhas repetidas do mesmo produto vao juntas para o mesmo item (e mudam juntas)", () => {
    const lines = buildReviewLines(
      { items: [line("CAFE PILAO 500G", 18.9), line("ARROZ 5KG", 25.9), line("CAFE PILAO 500G", 18.9)] },
      LIST_ITEMS,
      PRODUCTS,
    );
    expect(lines.map((item) => item.decision)).toEqual(["list:i2", "list:i1", "list:i2"]);
    expect(listPricesFromReview(lines, LIST_ITEMS, PRODUCTS)).toEqual({ i1: 25.9, i2: 18.9 });

    const changed = applyDecision(lines, "r0", "ignore");
    expect(changed.map((item) => [item.decision, item.userChosen])).toEqual([
      ["ignore", true],
      ["list:i1", false],
      ["ignore", true],
    ]);
  });

  it("unidade diferente (peso na comanda, unidade na lista) divide pela quantidade da lista", () => {
    const items: GroceryListItem[] = [{ id: "b1", productId: "banana", name: "Banana", quantity: 6, checked: true }];
    const products = [product("banana", "banana")];
    const lines = buildReviewLines({ items: [line("BANANA PRATA KG", 6.99, 1.2, "KG")] }, items, products);

    expect(lines[0].decision).toBe("list:b1");
    // 1,2 kg x 6,99 = 8,39 pagos por 6 unidades.
    expect(listPricesFromReview(lines, items, products)).toEqual({ b1: 1.4 });
    expect(listPricesFromReview(lines, items, [product("banana", "banana", { unit: "kg" })])).toEqual({ b1: 6.99 });
  });

  it("apelido so e aprendido com nota alta ou escolha do usuario", () => {
    const lines = buildReviewLines(receipt, LIST_ITEMS, PRODUCTS);
    // "ARROZ TIPO 1 TIO JOAO 5KG" x "arroz 5kg": associacao provavel, mas nao certa.
    expect(learnsAlias(lines[0])).toBe(false);
    expect(learnsAlias(lines[2])).toBe(true);

    const completion = receiptCompletionFromReview(lines, "h-key", 87.4);
    expect(completion.rawNames).toEqual({ i1: "ARROZ TIPO 1 TIO JOAO 5KG", i2: "CAFE PILAO TRADICIONAL 500G" });
    expect(Object.keys(completion.aliases)).not.toContain("i1");

    const chosen = applyDecision(lines, "r0", "list:i1");
    expect(receiptCompletionFromReview(chosen, "h-key", 87.4).aliases.i1).toBe("ARROZ TIPO 1 TIO JOAO 5KG");
  });

  it("precos da lista, apelidos e extras viram a conclusao com produto novo ligado a compra", () => {
    const lines = applyDecision(buildReviewLines(receipt, LIST_ITEMS, PRODUCTS), "r3", "new");
    const prices = listPricesFromReview(lines, LIST_ITEMS, PRODUCTS);
    expect(prices).toEqual({ i1: 25.9, i2: 18.9 });

    const completion = receiptCompletionFromReview(lines, "h-key", 87.4);
    expect(completion.extras).toEqual([
      {
        rawName: "SABAO OMO LAVAGEM PERFEITA 1,6KG",
        quantity: 1,
        unitPrice: 32.5,
        learnAlias: true,
        target: { kind: "product", productId: "sabao" },
      },
      {
        rawName: "DETERGENTE YPE 500ML",
        quantity: 3,
        unitPrice: 2.79,
        learnAlias: true,
        target: { kind: "new", name: "Detergente Ype 500ml", unit: "un" },
      },
    ]);

    const plan = buildCompletion(LIST, PRODUCTS, {
      store: "Assaí",
      purchasedAt: NOW,
      total: 138.17,
      unitPrices: prices,
      receipt: completion,
    });

    expect(plan.purchase.items.map((item) => [item.productId, item.rawName, item.lineTotal])).toEqual([
      ["arroz", "ARROZ TIPO 1 TIO JOAO 5KG", 51.8],
      ["cafe", "CAFE PILAO TRADICIONAL 500G", 18.9],
      ["sabao", "SABAO OMO LAVAGEM PERFEITA 1,6KG", 32.5],
      [null, "DETERGENTE YPE 500ML", 8.37],
    ]);
    // Item 3 da compra e o produto novo 0 (o id e criado no lote).
    expect(plan.purchase.newProductLinks).toEqual({ 3: 0 });
    // Associacao automatica sem certeza nao vira apelido.
    expect(plan.productUpdates.find((item) => item.productId === "arroz")?.aliases).toEqual([]);
    expect(plan.productUpdates.find((item) => item.productId === "cafe")?.aliases).toEqual([
      aliasKey("CAFE PILAO TRADICIONAL 500G"),
    ]);
    expect(plan.productUpdates.find((item) => item.productId === "sabao")).toMatchObject({
      lastUnitPrice: 32.5,
      aliases: [aliasKey("SABAO OMO LAVAGEM PERFEITA 1,6KG")],
    });
    expect(plan.newProducts).toEqual([
      expect.objectContaining({
        name: "Detergente Ype 500ml",
        normalizedName: "detergente ype 500ml",
        unit: "un",
        lastUnitPrice: 2.79,
        purchaseCount: 1,
        aliases: [aliasKey("DETERGENTE YPE 500ML")],
      }),
    ]);
    expect(plan.receipt).toEqual({ key: "h-key", confidence: 87.4 });
    expect(plan.droppedExtras).toBe(0);
  });

  it("produto novo repetido na comanda vira um so produto, ligado as duas linhas", () => {
    const plan = buildCompletion({ ...LIST, items: [] }, PRODUCTS, {
      store: "A",
      purchasedAt: NOW,
      total: 10,
      unitPrices: {},
      receipt: {
        key: null,
        confidence: null,
        rawNames: {},
        aliases: {},
        extras: [0, 1].map(() => ({
          rawName: "PAO DE QUEIJO",
          quantity: 1,
          unitPrice: 5,
          learnAlias: true,
          target: { kind: "new" as const, name: "Pao De Queijo", unit: "un" as const },
        })),
      },
    });
    expect(plan.newProducts).toHaveLength(1);
    expect(plan.purchase.newProductLinks).toEqual({ 0: 0, 1: 0 });
  });

  it("produto novo com nome ja existente no catalogo usa o existente", () => {
    const plan = buildCompletion({ ...LIST, items: [] }, PRODUCTS, {
      store: "A",
      purchasedAt: NOW,
      total: 10,
      unitPrices: {},
      receipt: {
        key: "k",
        confidence: null,
        rawNames: {},
        aliases: {},
        extras: [
          {
            rawName: "ARROZ 5KG",
            quantity: 1,
            unitPrice: 24,
            learnAlias: true,
            target: { kind: "new", name: "Arroz 5kg", unit: "un" },
          },
        ],
      },
    });

    expect(plan.newProducts).toEqual([]);
    expect(plan.productUpdates).toEqual([expect.objectContaining({ productId: "arroz", lastUnitPrice: 24 })]);
  });

  it("itens da comanda alem do limite da compra (150) ficam de fora e sao contados", () => {
    const extras = Array.from({ length: 152 }, (_, index) => ({
      rawName: `PRODUTO ${index}`,
      quantity: 1,
      unitPrice: 1,
      learnAlias: true,
      target: { kind: "new" as const, name: `Produto ${index}`, unit: "un" as const },
    }));
    const plan = buildCompletion(LIST, PRODUCTS, {
      store: "A",
      purchasedAt: NOW,
      total: 200,
      unitPrices: { i1: 25.9, i2: 18.9 },
      receipt: { key: null, confidence: null, rawNames: {}, aliases: {}, extras },
    });

    expect(plan.purchase.items).toHaveLength(150);
    expect(plan.newProducts).toHaveLength(148);
    expect(plan.droppedExtras).toBe(4);
  });

  it("campo preenchido pela leitura so muda se o usuario nao editou", () => {
    // Intocado: segue a leitura (ou volta ao valor anterior).
    expect(reconcileFilled("R$ 10,00", "R$ 10,00", "", "R$ 12,00")).toBe("R$ 12,00");
    expect(reconcileFilled("R$ 10,00", "R$ 10,00", "R$ 9,00", undefined)).toBe("R$ 9,00");
    // Editado depois da leitura: preservado.
    expect(reconcileFilled("R$ 11,00", "R$ 10,00", "", "R$ 12,00")).toBe("R$ 11,00");
    // Sem valor da leitura: so troca se ainda estiver como antes.
    expect(reconcileFilled("", undefined, "", "R$ 12,00")).toBe("R$ 12,00");
    expect(reconcileFilled("R$ 5,00", undefined, "", "R$ 12,00")).toBe("R$ 5,00");
  });

  it("unidade e nome sugerido", () => {
    expect(groceryUnitFromReceipt("KG")).toBe("kg");
    expect(groceryUnitFromReceipt("LT")).toBe("l");
    expect(groceryUnitFromReceipt("PCT")).toBe("pct");
    expect(groceryUnitFromReceipt("CX")).toBe("un");
    expect(suggestProductName("  PAO   FRANCES ")).toBe("Pao Frances");
  });
});
