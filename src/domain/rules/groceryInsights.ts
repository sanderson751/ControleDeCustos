import type { GroceryListItem, GroceryProduct } from "@/domain/entities/grocery";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayIndex = (date: Date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
const toCents = (value: number) => Math.round(value * 100);

/** Variacao abaixo disso (em %) e tratada como "estavel". */
export const STABLE_PRICE_PERCENT = 0.5;

export type PriceTrend = {
  /** Variacao do ultimo preco sobre o anterior, em % (1 casa). */
  percent: number;
  direction: "up" | "down" | "stable";
  previous: number;
  last: number;
};

/** Variacao entre o ultimo preco pago e o anterior (null sem dois precos). */
export function priceTrend(
  product: Pick<GroceryProduct, "lastUnitPrice" | "previousUnitPrice">,
): PriceTrend | null {
  const { lastUnitPrice: last, previousUnitPrice: previous } = product;

  if (last === null || previous === null || previous <= 0) {
    return null;
  }

  const percent = Math.round(((toCents(last) - toCents(previous)) / toCents(previous)) * 1000) / 10;
  const direction =
    Math.abs(percent) < STABLE_PRICE_PERCENT ? "stable" : percent > 0 ? "up" : "down";

  return { percent, direction, previous, last };
}

/** "+12,5%", "−5%", "estável". */
export function formatTrend(trend: PriceTrend): string {
  if (trend.direction === "stable") return "estável";
  const value = Math.abs(trend.percent).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${trend.direction === "up" ? "+" : "−"}${value}%`;
}

export type MarketInflation = {
  /** Variacao da cesta (1 unidade de cada produto recomprado), em %. */
  percent: number;
  /** Soma dos precos atuais e anteriores da cesta. */
  current: number;
  previous: number;
  productCount: number;
  /** Maiores altas e quedas (ate 3 cada), por variacao. */
  topUp: Array<{ product: GroceryProduct; trend: PriceTrend }>;
  topDown: Array<{ product: GroceryProduct; trend: PriceTrend }>;
};

/**
 * "Sua inflacao do mercado": produtos recomprados no mes (ultima compra no
 * mes e preco anterior conhecido). A cesta tem uma unidade de cada produto,
 * para que itens caros nao escondam a variacao dos baratos so pelo volume.
 */
export function marketInflation(
  products: readonly GroceryProduct[],
  year: number,
  month: number,
): MarketInflation | null {
  const repurchased = products
    .filter(
      (product) =>
        product.lastPurchasedAt !== null &&
        product.lastPurchasedAt.getFullYear() === year &&
        product.lastPurchasedAt.getMonth() + 1 === month,
    )
    .map((product) => ({ product, trend: priceTrend(product) }))
    .filter((entry): entry is { product: GroceryProduct; trend: PriceTrend } => entry.trend !== null);

  if (repurchased.length === 0) {
    return null;
  }

  const currentCents = repurchased.reduce((sum, entry) => sum + toCents(entry.trend.last), 0);
  const previousCents = repurchased.reduce((sum, entry) => sum + toCents(entry.trend.previous), 0);
  const byPercent = [...repurchased].sort(
    (left, right) =>
      right.trend.percent - left.trend.percent ||
      left.product.name.localeCompare(right.product.name, "pt-BR"),
  );

  return {
    percent: Math.round(((currentCents - previousCents) / previousCents) * 1000) / 10,
    current: currentCents / 100,
    previous: previousCents / 100,
    productCount: repurchased.length,
    topUp: byPercent.filter((entry) => entry.trend.direction === "up").slice(0, 3),
    topDown: byPercent
      .filter((entry) => entry.trend.direction === "down")
      .reverse()
      .slice(0, 3),
  };
}

/** A partir desta fracao do intervalo medio, o produto "talvez esteja acabando". */
export const RESTOCK_RATIO = 0.8;
export const MAX_RESTOCK_SUGGESTIONS = 6;

export type RestockSuggestion = {
  product: GroceryProduct;
  daysSinceLast: number;
  avgIntervalDays: number;
};

/**
 * Sugestao de reposicao: produto comprado ao menos 2 vezes (com intervalo
 * medio conhecido) cuja ultima compra ja passou de 80% do intervalo medio.
 * Fora da lista atual; mais "atrasados" primeiro.
 */
export function restockSuggestions(
  products: readonly GroceryProduct[],
  listItems: readonly Pick<GroceryListItem, "productId">[],
  now: Date = new Date(),
  limit = MAX_RESTOCK_SUGGESTIONS,
): RestockSuggestion[] {
  const inList = new Set(listItems.map((item) => item.productId));

  return products
    .flatMap((product) => {
      if (
        inList.has(product.id) ||
        product.purchaseCount < 2 ||
        product.avgIntervalDays === null ||
        product.avgIntervalDays <= 0 ||
        product.lastPurchasedAt === null
      ) {
        return [];
      }

      const daysSinceLast = dayIndex(now) - dayIndex(product.lastPurchasedAt);
      return daysSinceLast >= RESTOCK_RATIO * product.avgIntervalDays
        ? [{ product, daysSinceLast, avgIntervalDays: product.avgIntervalDays }]
        : [];
    })
    .sort(
      (left, right) =>
        right.daysSinceLast / right.avgIntervalDays - left.daysSinceLast / left.avgIntervalDays ||
        left.product.name.localeCompare(right.product.name, "pt-BR"),
    )
    .slice(0, limit);
}

/** "comprado a cada ~7 dias · última há 9 dias". */
export function describeRestock(suggestion: RestockSuggestion): string {
  const every = Math.max(1, Math.round(suggestion.avgIntervalDays));
  const since = suggestion.daysSinceLast;
  return `comprado a cada ~${every} ${every === 1 ? "dia" : "dias"} · última há ${since} ${since === 1 ? "dia" : "dias"}`;
}

export type ShopProgress = {
  checkedCount: number;
  total: number;
  /** Previsto dos itens ja no carrinho (com historico). */
  cartForecast: number;
  /** Itens no carrinho sem historico de preco (fora da soma). */
  cartMissing: number;
};

/** Modo mercado: soma em tempo real do previsto dos itens ja pegos. */
export function shopProgress(
  items: readonly Pick<GroceryListItem, "checked" | "quantity" | "productId">[],
  products: readonly GroceryProduct[],
): ShopProgress {
  const byId = new Map(products.map((product) => [product.id, product]));
  let cartCents = 0;
  let cartMissing = 0;
  let checkedCount = 0;

  for (const item of items) {
    if (!item.checked) continue;
    checkedCount += 1;
    const price = byId.get(item.productId)?.lastUnitPrice ?? null;
    if (price === null) cartMissing += 1;
    else cartCents += Math.round(toCents(price) * item.quantity);
  }

  return { checkedCount, total: items.length, cartForecast: cartCents / 100, cartMissing };
}
