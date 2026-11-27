import type { BudgetStatus } from "@/domain/entities/budget";
import {
  type CompletionInput,
  DEFAULT_STORE,
  type ForecastItem,
  type GroceryList,
  type GroceryListItem,
  type GroceryProduct,
  type GroceryPurchaseItem,
  type GroceryUnit,
  type ListForecast,
  MAX_GROCERY_AMOUNT,
  MAX_INTERVAL_DAYS,
  MAX_LIST_ITEMS,
  MAX_LIST_NAME_LENGTH,
  MAX_PRODUCT_NAME_LENGTH,
  MAX_QUANTITY,
  MAX_STORE_LENGTH,
} from "@/domain/entities/grocery";
import { getBudgetStatus, getConsumedPercent } from "@/domain/rules/budgetRules";
import { normalizeSearchText } from "@/domain/rules/costRules";

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const dayIndex = (date: Date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);

export type Validation<T> = { ok: true; value: T } | { ok: false; message: string };

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Nome do produto: 1-80 caracteres, unico no catalogo (sem acento/caixa). */
export function validateProductName(
  raw: string,
  products: readonly GroceryProduct[],
): Validation<string> {
  const name = cleanName(raw);

  if (!name) {
    return { ok: false, message: "Informe o nome do produto." };
  }

  if (name.length > MAX_PRODUCT_NAME_LENGTH) {
    return {
      ok: false,
      message: `O nome do produto pode ter no máximo ${MAX_PRODUCT_NAME_LENGTH} caracteres.`,
    };
  }

  const key = normalizeSearchText(name);
  const duplicate = products.find((product) => product.normalizedName === key);

  if (duplicate) {
    return { ok: false, message: `O produto "${duplicate.name}" já existe no seu catálogo.` };
  }

  return { ok: true, value: name };
}

export function validateListName(raw: string): Validation<string> {
  const name = cleanName(raw);

  if (!name) {
    return { ok: false, message: "Informe o nome da lista." };
  }

  if (name.length > MAX_LIST_NAME_LENGTH) {
    return {
      ok: false,
      message: `O nome da lista pode ter no máximo ${MAX_LIST_NAME_LENGTH} caracteres.`,
    };
  }

  return { ok: true, value: name };
}

/** Quantidade > 0 e <= 9999; inteira para unidades contaveis, ate 3 casas para peso/volume. */
export function validateQuantity(quantity: number, unit: GroceryUnit): Validation<number> {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, message: "Informe uma quantidade maior que zero." };
  }

  if (quantity > MAX_QUANTITY) {
    return { ok: false, message: `A quantidade pode ser no máximo ${MAX_QUANTITY}.` };
  }

  const fractional = unit === "kg" || unit === "l";

  if (!fractional && !Number.isInteger(quantity)) {
    return { ok: false, message: "Use uma quantidade inteira para esta unidade." };
  }

  return { ok: true, value: Math.round(quantity * 1000) / 1000 };
}

/** Nome padrao da lista: "Compra de DD/MM". */
export function defaultListName(now: Date = new Date()): string {
  return `Compra de ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Busca no catalogo por nome (sem acento/caixa), mais parecidos primeiro. */
export function searchProducts(
  products: readonly GroceryProduct[],
  term: string,
  limit = 6,
): GroceryProduct[] {
  const key = normalizeSearchText(term);

  if (!key) {
    return [];
  }

  return products
    .filter((product) => product.normalizedName.includes(key))
    .sort(
      (left, right) =>
        Number(!left.normalizedName.startsWith(key)) - Number(!right.normalizedName.startsWith(key)) ||
        left.name.localeCompare(right.name, "pt-BR"),
    )
    .slice(0, limit);
}

/**
 * Inclui o produto na lista; se ja estiver nela, soma a quantidade.
 * Limite de itens distintos por lista.
 */
export function addItemToList(
  items: readonly GroceryListItem[],
  product: Pick<GroceryProduct, "id" | "name">,
  quantity: number,
  newId: string,
): Validation<GroceryListItem[]> {
  const existing = items.find((item) => item.productId === product.id);

  if (existing) {
    const total = Math.round((existing.quantity + quantity) * 1000) / 1000;

    if (total > MAX_QUANTITY) {
      return { ok: false, message: `A quantidade pode ser no máximo ${MAX_QUANTITY}.` };
    }

    return {
      ok: true,
      value: items.map((item) =>
        item.id === existing.id ? { ...item, quantity: total } : item,
      ),
    };
  }

  if (items.length >= MAX_LIST_ITEMS) {
    return { ok: false, message: `A lista pode ter no máximo ${MAX_LIST_ITEMS} itens.` };
  }

  return {
    ok: true,
    value: [
      ...items,
      { id: newId, productId: product.id, name: product.name, quantity, checked: false },
    ],
  };
}

/** Previsao: preco unitario = ultimo preco pago; sem historico => sem valor. */
export function forecastList(
  items: readonly GroceryListItem[],
  products: readonly GroceryProduct[],
): ListForecast {
  const byId = new Map(products.map((product) => [product.id, product]));
  let totalCents = 0;
  let pricedCount = 0;

  const forecastItems = items.map<ForecastItem>((item) => {
    const product = byId.get(item.productId) ?? null;
    const unitPrice = product?.lastUnitPrice ?? null;

    if (unitPrice === null) {
      return { ...item, product, unitPrice: null, total: null };
    }

    const lineCents = Math.round(toCents(unitPrice) * item.quantity);
    totalCents += lineCents;
    pricedCount += 1;
    return { ...item, product, unitPrice, total: fromCents(lineCents) };
  });

  return {
    items: forecastItems,
    total: fromCents(totalCents),
    pricedCount,
    missingCount: items.length - pricedCount,
  };
}

export type ListBudgetCheck =
  | { hasBudget: false }
  | {
      hasBudget: true;
      limit: number;
      spent: number;
      forecast: number;
      projected: number;
      percent: number;
      status: BudgetStatus;
      remaining: number;
    };

/** Gasto do mes + previsto da lista contra o orcamento da categoria. */
export function listBudgetCheck(
  forecast: number,
  spent: number,
  limit: number | null | undefined,
): ListBudgetCheck {
  if (!limit || limit <= 0) {
    return { hasBudget: false };
  }

  const projected = fromCents(toCents(spent) + toCents(forecast));

  return {
    hasBudget: true,
    limit,
    spent,
    forecast,
    projected,
    percent: getConsumedPercent(projected, limit),
    status: getBudgetStatus(projected, limit),
    remaining: fromCents(toCents(limit) - toCents(projected)),
  };
}

/** Lista nova a partir de uma concluida: mesmos produtos e quantidades, desmarcados. */
export function reuseListItems(
  list: Pick<GroceryList, "items">,
  newId: (index: number) => string,
): GroceryListItem[] {
  return list.items.map((item, index) => ({ ...item, id: newId(index), checked: false }));
}

export function validateCompletion(
  input: CompletionInput,
  now: Date = new Date(),
): Validation<CompletionInput & { purchasedAt: Date; store: string }> {
  const store = cleanName(input.store) || DEFAULT_STORE;

  if (store.length > MAX_STORE_LENGTH) {
    return {
      ok: false,
      message: `O nome da loja pode ter no máximo ${MAX_STORE_LENGTH} caracteres.`,
    };
  }

  if (!Number.isFinite(input.total) || input.total <= 0) {
    return { ok: false, message: "Informe o total pago na compra." };
  }

  if (input.total > MAX_GROCERY_AMOUNT) {
    return { ok: false, message: "O total informado é muito alto." };
  }

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (
    !input.purchasedAt ||
    Number.isNaN(input.purchasedAt.getTime()) ||
    input.purchasedAt.getFullYear() < 2000 ||
    input.purchasedAt > endOfToday
  ) {
    return { ok: false, message: "Informe uma data de compra válida, até hoje." };
  }

  const invalidPrice = Object.values(input.unitPrices).find(
    (price) => Number.isFinite(price) && (price < 0 || price > MAX_GROCERY_AMOUNT),
  );

  if (invalidPrice !== undefined) {
    return { ok: false, message: "Revise os preços dos itens: valor inválido." };
  }

  return { ok: true, value: { ...input, store, purchasedAt: input.purchasedAt } };
}

/** Atualiza o resumo de historico do produto com o preco pago agora. */
export function applyPurchaseToProduct(
  product: GroceryProduct,
  unitPrice: number,
  purchasedAt: Date,
  store: string,
): Pick<
  GroceryProduct,
  | "lastUnitPrice"
  | "previousUnitPrice"
  | "lastPurchasedAt"
  | "lastStore"
  | "purchaseCount"
  | "avgIntervalDays"
  | "intervalCount"
> {
  const last = product.lastPurchasedAt;
  // Compra com data anterior a ultima nao reescreve o "ultimo preco" (comparado por dia;
  // produto ainda sem preco aceita sempre).
  const isNewer = !last || product.lastUnitPrice === null || dayIndex(purchasedAt) >= dayIndex(last);
  // Intervalo entre dias distintos, limitado ao teto aceito pelas regras;
  // compras retroativas ou no mesmo dia nao entram na media.
  const rawInterval = last && isNewer ? dayIndex(purchasedAt) - dayIndex(last) : 0;
  const intervalDays = rawInterval > 0 ? Math.min(rawInterval, MAX_INTERVAL_DAYS) : null;
  const intervals = product.avgIntervalDays === null ? 0 : product.intervalCount;
  const avgIntervalDays =
    intervalDays === null
      ? product.avgIntervalDays
      : intervals === 0
        ? intervalDays
        : Math.min(
            MAX_INTERVAL_DAYS,
            Math.round(((product.avgIntervalDays! * intervals + intervalDays) / (intervals + 1)) * 10) / 10,
          );
  const intervalCount = intervalDays === null ? product.intervalCount : intervals + 1;

  if (!isNewer) {
    return {
      lastUnitPrice: product.lastUnitPrice,
      previousUnitPrice: product.previousUnitPrice,
      lastPurchasedAt: product.lastPurchasedAt,
      lastStore: product.lastStore,
      purchaseCount: product.purchaseCount + 1,
      avgIntervalDays: product.avgIntervalDays,
      intervalCount: product.intervalCount,
    };
  }

  return {
    lastUnitPrice: fromCents(toCents(unitPrice)),
    previousUnitPrice: product.lastUnitPrice,
    lastPurchasedAt: purchasedAt,
    lastStore: store,
    purchaseCount: product.purchaseCount + 1,
    avgIntervalDays,
    intervalCount,
  };
}

export type CompletionPlan = {
  cost: {
    accountName: string;
    amount: number;
    description: string;
    purchasedAt: Date;
  };
  purchase: {
    store: string;
    purchasedAt: Date;
    total: number;
    items: GroceryPurchaseItem[];
  };
  productUpdates: Array<{ productId: string } & ReturnType<typeof applyPurchaseToProduct>>;
};

/** Traduz a conclusao em lancamento, compra registrada e atualizacao dos produtos. */
export function buildCompletion(
  list: GroceryList,
  products: readonly GroceryProduct[],
  input: CompletionInput & { purchasedAt: Date; store: string },
): CompletionPlan {
  const byId = new Map(products.map((product) => [product.id, product]));
  const items: GroceryPurchaseItem[] = [];
  const productUpdates: CompletionPlan["productUpdates"] = [];

  for (const item of list.items) {
    const price = input.unitPrices[item.id];
    const product = byId.get(item.productId);

    if (!Number.isFinite(price) || price <= 0) {
      continue;
    }

    items.push({
      productId: product ? product.id : null,
      rawName: item.name,
      quantity: item.quantity,
      unitPrice: fromCents(toCents(price)),
      lineTotal: fromCents(Math.round(toCents(price) * item.quantity)),
    });

    if (product) {
      productUpdates.push({
        productId: product.id,
        ...applyPurchaseToProduct(product, price, input.purchasedAt, input.store),
      });
    }
  }

  return {
    cost: {
      accountName: `Mercado — ${input.store}`.slice(0, 200),
      amount: fromCents(toCents(input.total)),
      description: `Lista: ${list.name}`.slice(0, 500),
      purchasedAt: input.purchasedAt,
    },
    purchase: {
      store: input.store,
      purchasedAt: input.purchasedAt,
      total: fromCents(toCents(input.total)),
      items,
    },
    productUpdates,
  };
}

/** Quantidade no formato brasileiro ("1,2"; inteiros sem casas). */
export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/**
 * Quantidade digitada: virgula e o separador decimal (pt-BR). Ponto sozinho e
 * decimal so em kg/l ("1.5"); nas demais unidades e milhar ("1.000" g = 1000)
 * ou invalido. Null quando nao e numero.
 */
export function parseQuantityInput(raw: string, unit: GroceryUnit): number | null {
  const value = raw.trim();

  if (!/^\d[\d.,]*$/.test(value)) {
    return null;
  }

  if (value.includes(",")) {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
  }

  if (!value.includes(".")) {
    return Number(value);
  }

  if (unit === "kg" || unit === "l") {
    return /^\d+\.\d+$/.test(value) ? Number(value) : null;
  }

  return /^\d{1,3}(\.\d{3})+$/.test(value) ? Number(value.replace(/\./g, "")) : null;
}

/** Diferenca relevante entre a soma dos itens e o total pago (>= 5%). */
export function itemsTotalMismatch(itemsTotal: number, paidTotal: number): boolean {
  return paidTotal > 0 && itemsTotal > 0 && Math.abs(itemsTotal - paidTotal) / paidTotal >= 0.05;
}
