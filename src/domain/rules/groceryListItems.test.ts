import type { GroceryListItem } from "@/domain/entities/grocery";
import { diffListItems, toStoredItems } from "@/domain/rules/groceryListItems";

const item = (id: string, overrides: Partial<GroceryListItem> = {}): GroceryListItem => ({
  id,
  productId: `p-${id}`,
  name: `Produto ${id}`,
  quantity: 1,
  checked: false,
  ...overrides,
});

describe("toStoredItems", () => {
  it("mapa por id com a ordem atual", () => {
    expect(toStoredItems([item("a"), item("b", { quantity: 2, checked: true })])).toEqual({
      a: { productId: "p-a", name: "Produto a", quantity: 1, checked: false, order: 0 },
      b: { productId: "p-b", name: "Produto b", quantity: 2, checked: true, order: 1 },
    });
  });
});

describe("diffListItems", () => {
  const previous = [item("a"), item("b"), item("c")];

  it("grava so o campo alterado de cada item", () => {
    const next = previous.map((entry) =>
      entry.id === "b" ? { ...entry, checked: true, quantity: 3 } : entry,
    );
    expect(diffListItems(previous, next, 100)).toEqual([
      { type: "change", itemId: "b", field: "quantity", value: 3 },
      { type: "change", itemId: "b", field: "checked", value: true },
    ]);
  });

  it("inclusoes recebem ordem a partir de firstOrder; remocoes apagam o item", () => {
    const next = [item("a"), item("c"), item("d"), item("e")];
    expect(diffListItems(previous, next, 100)).toEqual([
      { type: "add", itemId: "d", value: { productId: "p-d", name: "Produto d", quantity: 1, checked: false, order: 100 } },
      { type: "add", itemId: "e", value: { productId: "p-e", name: "Produto e", quantity: 1, checked: false, order: 101 } },
      { type: "remove", itemId: "b" },
    ]);
  });

  it("sem mudanca, nada a gravar", () => {
    expect(diffListItems(previous, [...previous], 100)).toEqual([]);
  });
});
