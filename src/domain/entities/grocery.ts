export type GroceryUnit = "un" | "kg" | "g" | "l" | "ml" | "pct";

export const GROCERY_UNITS: readonly GroceryUnit[] = ["un", "kg", "g", "l", "ml", "pct"];

export const GROCERY_UNIT_LABELS: Record<GroceryUnit, string> = {
  un: "unidade",
  kg: "kg",
  g: "g",
  l: "litro",
  ml: "ml",
  pct: "pacote",
};

/** Produto do catalogo pessoal, com o historico de preco resumido. */
export type GroceryProduct = {
  id: string;
  name: string;
  normalizedName: string;
  unit: GroceryUnit;
  /** Preco unitario pago na ultima compra (null = sem historico). */
  lastUnitPrice: number | null;
  /** Preco da compra anterior (variacao de preco). */
  previousUnitPrice: number | null;
  lastPurchasedAt: Date | null;
  lastStore: string;
  purchaseCount: number;
  /** Media de dias entre compras (sugestao de reposicao). */
  avgIntervalDays: number | null;
  /** Intervalos que compoem a media (compras retroativas e no mesmo dia nao contam). */
  intervalCount: number;
  /** Nomes lidos em comandas associados ao produto (entrega B). */
  aliases: string[];
};

export type GroceryListItem = {
  id: string;
  productId: string;
  /** Nome no momento da inclusao (exibido se o produto for excluido). */
  name: string;
  quantity: number;
  checked: boolean;
};

export type GroceryListStatus = "aberta" | "concluida";

export type GroceryList = {
  id: string;
  name: string;
  status: GroceryListStatus;
  items: GroceryListItem[];
  purchaseId: string | null;
  /** Total pago na conclusao (null enquanto aberta). */
  paidTotal: number | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type GroceryPurchaseItem = {
  productId: string | null;
  rawName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** Item da lista com a previsao calculada pelo ultimo preco pago. */
export type ForecastItem = GroceryListItem & {
  product: GroceryProduct | null;
  unitPrice: number | null;
  total: number | null;
};

export type ListForecast = {
  items: ForecastItem[];
  total: number;
  /** Itens com previsao (produto ja comprado). */
  pricedCount: number;
  /** Itens sem historico de preco. */
  missingCount: number;
};

export type CompletionInput = {
  store: string;
  purchasedAt: Date | null;
  total: number;
  /** Preco unitario pago por item da lista (id do item); ausente/NaN = nao informado. */
  unitPrices: Record<string, number>;
};

export const MAX_LIST_ITEMS = 150;
export const MAX_PRODUCT_NAME_LENGTH = 80;
export const MAX_LIST_NAME_LENGTH = 60;
export const MAX_STORE_LENGTH = 60;
export const MAX_QUANTITY = 9999;
export const MAX_GROCERY_AMOUNT = 1_000_000_000;
export const MAX_PRODUCT_ALIASES = 10;
/** Teto do intervalo medio entre compras (espelhado nas regras). */
export const MAX_INTERVAL_DAYS = 3650;
export const DEFAULT_STORE = "Mercado";
/** Categoria padrao do lancamento de mercado. */
export const GROCERY_COST_CATEGORY = "alimentacao";
