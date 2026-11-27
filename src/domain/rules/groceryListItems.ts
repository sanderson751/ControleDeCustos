import type { GroceryListItem } from "@/domain/entities/grocery";

/**
 * Itens da lista gravados como MAPA (`items.{itemId}`), nao como array: cada
 * alteracao grava so o campo que mudou, entao duas pessoas (ou dois aparelhos
 * offline) mexendo em itens diferentes nao apagam a alteracao uma da outra.
 * `order` fixa a posicao do item (o mapa nao tem ordem).
 */
export type StoredListItem = {
  productId: string;
  name: string;
  quantity: number;
  checked: boolean;
  order: number;
};

/** Campos que mudam depois da inclusao. */
const ITEM_FIELDS = ["productId", "name", "quantity", "checked"] as const;
export type ListItemField = (typeof ITEM_FIELDS)[number];

export type ListItemWrite =
  | { type: "add"; itemId: string; value: StoredListItem }
  | { type: "change"; itemId: string; field: ListItemField; value: string | number | boolean }
  | { type: "remove"; itemId: string };

function stored(item: GroceryListItem, order: number): StoredListItem {
  return {
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    checked: item.checked,
    order,
  };
}

/** Mapa completo (lista nova ou conversao do formato antigo), na ordem atual. */
export function toStoredItems(items: readonly GroceryListItem[]): Record<string, StoredListItem> {
  return Object.fromEntries(items.map((item, index) => [item.id, stored(item, index)]));
}

/**
 * Diferenca entre a versao anterior e a nova: inclusoes, campos alterados e
 * remocoes. Itens novos recebem ordem a partir de `firstOrder` (ex.: o horario
 * atual), ficando depois dos existentes mesmo quando incluidos em outro aparelho.
 */
export function diffListItems(
  previous: readonly GroceryListItem[],
  next: readonly GroceryListItem[],
  firstOrder: number,
): ListItemWrite[] {
  const before = new Map(previous.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));
  const writes: ListItemWrite[] = [];
  let added = 0;

  for (const item of next) {
    const old = before.get(item.id);

    if (!old) {
      writes.push({ type: "add", itemId: item.id, value: stored(item, firstOrder + added) });
      added += 1;
      continue;
    }

    for (const field of ITEM_FIELDS) {
      if (old[field] !== item[field]) {
        writes.push({ type: "change", itemId: item.id, field, value: item[field] });
      }
    }
  }

  for (const item of previous) {
    if (!nextIds.has(item.id)) writes.push({ type: "remove", itemId: item.id });
  }

  return writes;
}
