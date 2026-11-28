import { useEffect, useMemo, useState } from "react";
import type { GroceryList, GroceryProduct } from "@/domain/entities/grocery";
import { friendlyFirestoreErrorMessage, getErrorCode } from "@/lib/errors";
import { subscribeToLists, subscribeToProducts } from "@/services/groceryService";
import { subscribeToList } from "@/services/groceryShareService";

export type GroceryListData = {
  products: GroceryProduct[];
  list: GroceryList | null;
  /** Lista de outra pessoa, da qual participo. */
  isShared: boolean;
  isLoading: boolean;
  error: string | null;
};

/**
 * Uma lista e o catalogo do dono em tempo real. Propria: pelas listas do
 * usuario (mesma assinatura da tela de Mercado). Compartilhada: pelo documento
 * da lista e o catalogo do dono (liberado pelas regras a quem participa).
 */
export function useGroceryList(viewerId: string, ownerId: string, listId: string): GroceryListData {
  const isShared = ownerId !== viewerId;
  const [products, setProducts] = useState<GroceryProduct[] | null>(null);
  const [list, setList] = useState<GroceryList | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(null);
    setList(undefined);
    setError(null);

    const onError = (subscriptionError: Error) =>
      setError(
        isShared && getErrorCode(subscriptionError) === "permission-denied"
          ? "Você não participa mais desta lista (saiu, foi removido ou a lista foi excluída)."
          : friendlyFirestoreErrorMessage(
              subscriptionError,
              isShared ? "Não foi possível abrir a lista compartilhada." : "Não foi possível carregar suas listas de mercado.",
            ),
      );
    const stopProducts = subscribeToProducts(ownerId, setProducts, onError);
    const stopList = isShared
      ? subscribeToList(ownerId, listId, setList, onError)
      : subscribeToLists(ownerId, (lists) => setList(lists.find((item) => item.id === listId) ?? null), onError);

    return () => {
      stopProducts();
      stopList();
    };
  }, [isShared, listId, ownerId]);

  return useMemo(
    () => ({
      products: products ?? [],
      list: list ?? null,
      isShared,
      isLoading: !error && (products === null || list === undefined),
      error,
    }),
    [error, isShared, list, products],
  );
}
