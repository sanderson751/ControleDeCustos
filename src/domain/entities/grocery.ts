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
  /** Itens ainda no formato antigo (array): a proxima gravacao converte para mapa. */
  legacyItems?: boolean;
  /** Itens incompletos no mapa (sobra de remocao concorrente): apagados na proxima gravacao. */
  staleItemIds?: string[];
  /** Dono da lista (o caminho users/{ownerId}); igual ao usuario nas listas proprias. */
  ownerId?: string;
  /** Nome do dono, exibido para quem participa. */
  ownerName?: string;
  /** Participantes (convite aceito), ate MAX_LIST_MEMBERS. */
  memberIds?: string[];
  /** Nome e e-mail de cada participante, para exibicao. */
  members?: Record<string, GroceryListMember>;
};

export type GroceryListMember = { name: string; email: string };

export type GroceryInviteStatus = "pendente" | "aceito" | "recusado";

/** Convite para uma lista (groceryInvites/{ownerId}_{listId}_{email}). */
export type GroceryInvite = {
  id: string;
  ownerId: string;
  ownerName: string;
  /** E-mail de quem convidou (conferido pelas regras: o nome e livre). */
  ownerEmail: string;
  listId: string;
  listName: string;
  email: string;
  status: GroceryInviteStatus;
  memberUid: string | null;
  createdAt: Date;
};

export const MAX_LIST_MEMBERS = 5;
export const MAX_MEMBER_NAME_LENGTH = 80;
export const MAX_INVITE_EMAIL_LENGTH = 120;

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

/** Item da comanda fora da lista: vai para um produto do catalogo ou cria um novo. */
export type ReceiptExtra = {
  rawName: string;
  quantity: number;
  unitPrice: number;
  /** Associacao confiavel (escolhida ou com nota alta): o nome lido vira apelido. */
  learnAlias: boolean;
  target: { kind: "product"; productId: string } | { kind: "new"; name: string; unit: GroceryUnit };
};

/** Dados da comanda lida por foto (entrega B). */
export type ReceiptCompletion = {
  /** Chave da NFC-e ou hash (emissor + dia + total): evita importar duas vezes (null = sem chave). */
  key: string | null;
  /** Confianca media do OCR (0-100). */
  confidence: number | null;
  /** Nome lido na comanda por item da lista (registrado na compra). */
  rawNames: Record<string, string>;
  /** Nomes que viram apelido do produto do item (associacao confiavel). */
  aliases: Record<string, string>;
  extras: ReceiptExtra[];
};

export type CompletionInput = {
  store: string;
  purchasedAt: Date | null;
  total: number;
  /** Preco unitario pago por item da lista (id do item); ausente/NaN = nao informado. */
  unitPrices: Record<string, number>;
  receipt?: ReceiptCompletion;
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
