import { useCallback, useEffect, useRef, useState } from "react";
import type { GroceryList, GroceryListItem } from "@/domain/entities/grocery";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { convertListItems, updateListItems } from "@/services/groceryService";

const EMPTY: GroceryListItem[] = [];
const NO_IDS: string[] = [];

/**
 * Itens da lista com atualizacao otimista e sequencial:
 * - cada alteracao parte da versao MAIS RECENTE (nao da que estava na tela),
 *   entao toques rapidos em sequencia (blur + clique, duplo toque) nao se anulam;
 * - a tela reflete a alteracao na hora, sem esperar o servidor (4G do mercado);
 * - enquanto ha gravacoes pendentes, o retorno do servidor nao sobrescreve o
 *   estado local; ao terminar, volta a seguir o servidor;
 * - grava so a diferenca (item a item), para nao apagar o que outra pessoa ou
 *   aparelho alterou em outros itens. Lista no formato antigo e convertida.
 */
export function useOptimisticListItems(userId: string, list: GroceryList | null) {
  const listId = list?.id ?? null;
  const legacyItems = list?.legacyItems === true;
  const source = list?.items ?? EMPTY;
  const staleIds = list?.staleItemIds ?? NO_IDS;
  const [items, setItems] = useState<readonly GroceryListItem[]>(source);
  const latest = useRef<readonly GroceryListItem[]>(source);
  const lastServer = useRef<readonly GroceryListItem[]>(source);
  const pending = useRef(0);

  useEffect(() => {
    lastServer.current = source;
    if (pending.current === 0) {
      latest.current = source;
      setItems(source);
    }
  }, [source]);

  /** Aplica a alteracao sobre a versao mais recente e grava; devolve os itens novos. */
  const update = useCallback(
    (change: (current: readonly GroceryListItem[]) => GroceryListItem[] | null) => {
      if (!listId) return null;
      const previous = latest.current;
      const next = change(previous);
      if (!next) return null;

      latest.current = next;
      setItems(next);
      pending.current += 1;

      const written = legacyItems
        ? convertListItems(userId, listId, next, previous)
        : updateListItems(userId, listId, next, previous, staleIds);

      written
        .catch((error: unknown) => {
          notify("error", friendlyFirestoreErrorMessage(error, "Falha ao atualizar a lista."));
        })
        .finally(() => {
          pending.current -= 1;
          if (pending.current === 0) {
            latest.current = lastServer.current;
            setItems(lastServer.current);
          }
        });

      return next;
    },
    [legacyItems, listId, staleIds, userId],
  );

  return { items, update };
}
