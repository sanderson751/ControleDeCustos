import { act, renderHook } from "@testing-library/react";
import type { GroceryList, GroceryListItem } from "@/domain/entities/grocery";
import { useOptimisticListItems } from "@/hooks/useOptimisticListItems";
import { convertListItems, updateListItems } from "@/services/groceryService";

vi.mock("@/services/groceryService", () => ({ updateListItems: vi.fn(), convertListItems: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

const ITEMS: GroceryListItem[] = [
  { id: "i1", productId: "arroz", name: "Arroz", quantity: 1, checked: false },
  { id: "i2", productId: "cafe", name: "Café", quantity: 1, checked: false },
];

const list = (overrides: Partial<GroceryList> = {}): GroceryList => ({
  id: "l1",
  name: "Feira",
  status: "aberta",
  items: ITEMS,
  purchaseId: null,
  paidTotal: null,
  createdAt: new Date(2026, 10, 27),
  completedAt: null,
  legacyItems: false,
  staleItemIds: [],
  ...overrides,
});

const toggle = (id: string) => (current: readonly GroceryListItem[]) =>
  current.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));

describe("useOptimisticListItems", () => {
  beforeEach(() => {
    for (const fn of [updateListItems, convertListItems]) {
      vi.mocked(fn).mockReset();
      vi.mocked(fn).mockReturnValue(new Promise(() => undefined));
    }
  });

  it("cada gravacao leva a versao anterior para gravar so a diferenca", () => {
    const { result } = renderHook(() => useOptimisticListItems("u1", list()));

    act(() => void result.current.update(toggle("i1")));
    act(() => void result.current.update(toggle("i2")));

    const [first, second] = vi.mocked(updateListItems).mock.calls;
    expect(first[3]).toEqual(ITEMS);
    expect(first[2][0].checked).toBe(true);
    // A segunda parte da primeira (ainda pendente), nao da versao do servidor.
    expect(second[3]).toEqual(first[2]);
    expect(second[2].map((item) => item.checked)).toEqual([true, true]);
    expect(result.current.items.map((item) => item.checked)).toEqual([true, true]);
  });

  it("lista antiga e convertida; depois do snapshot em mapa, volta a gravar a diferenca", () => {
    const { result, rerender } = renderHook(({ value }) => useOptimisticListItems("u1", value), {
      initialProps: { value: list({ legacyItems: true }) },
    });

    act(() => void result.current.update(toggle("i1")));
    expect(convertListItems).toHaveBeenCalledWith("u1", "l1", expect.any(Array), ITEMS);
    expect(updateListItems).not.toHaveBeenCalled();

    rerender({ value: list({ legacyItems: false }) });
    act(() => void result.current.update(toggle("i2")));
    expect(updateListItems).toHaveBeenCalledTimes(1);
  });

  it("apaga itens incompletos que sobraram no mapa junto com a proxima gravacao", () => {
    const { result } = renderHook(() => useOptimisticListItems("u1", list({ staleItemIds: ["x9"] })));
    act(() => void result.current.update(toggle("i1")));
    expect(vi.mocked(updateListItems).mock.calls[0][4]).toEqual(["x9"]);
  });
});
