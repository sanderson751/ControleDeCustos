import { useEffect, useMemo, useState } from "react";
import type { GroceryList, GroceryProduct } from "@/domain/entities/grocery";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { subscribeToLists, subscribeToProducts } from "@/services/groceryService";

export type GroceryData = {
  products: GroceryProduct[];
  lists: GroceryList[];
  isLoading: boolean;
  error: string | null;
};

/** Catalogo de produtos e listas de mercado do usuario em tempo real. */
export function useGroceryData(userId: string): GroceryData {
  const [products, setProducts] = useState<GroceryProduct[] | null>(null);
  const [lists, setLists] = useState<GroceryList[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProducts(null);
    setLists(null);
    setError(null);

    const onError = (subscriptionError: Error) =>
      setError(
        friendlyFirestoreErrorMessage(
          subscriptionError,
          "Não foi possível carregar suas listas de mercado.",
        ),
      );
    const stopProducts = subscribeToProducts(userId, setProducts, onError);
    const stopLists = subscribeToLists(userId, setLists, onError);

    return () => {
      stopProducts();
      stopLists();
    };
  }, [userId]);

  return useMemo(
    () => ({
      products: products ?? [],
      lists: lists ?? [],
      isLoading: !error && (products === null || lists === null),
      error,
    }),
    [error, lists, products],
  );
}
