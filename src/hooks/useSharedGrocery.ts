import { useEffect, useMemo, useState } from "react";
import type { GroceryInvite, GroceryList } from "@/domain/entities/grocery";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import {
  subscribeToListInvites,
  subscribeToMyInvites,
  subscribeToSharedLists,
} from "@/services/groceryShareService";

export type SharedGroceryData = {
  /** Convites pendentes para o meu e-mail (so com e-mail confirmado). */
  invites: GroceryInvite[];
  /** Listas de outras pessoas das quais participo. */
  sharedLists: GroceryList[];
  error: string | null;
};

const NONE: never[] = [];

export function useSharedGrocery(uid: string, email: string, emailVerified: boolean): SharedGroceryData {
  const [invites, setInvites] = useState<GroceryInvite[]>(NONE);
  const [sharedLists, setSharedLists] = useState<GroceryList[]>(NONE);
  const [listsError, setListsError] = useState<string | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  useEffect(() => {
    setSharedLists(NONE);
    setListsError(null);
    return subscribeToSharedLists(
      uid,
      (lists) => {
        setSharedLists(lists);
        setListsError(null);
      },
      (subscriptionError) =>
        setListsError(friendlyFirestoreErrorMessage(subscriptionError, "Não foi possível carregar as listas compartilhadas.")),
    );
  }, [uid]);

  useEffect(() => {
    setInvites(NONE);
    setInvitesError(null);
    if (!emailVerified || !email) return undefined;
    return subscribeToMyInvites(
      email,
      (next) => {
        setInvites(next);
        setInvitesError(null);
      },
      (subscriptionError) =>
        setInvitesError(friendlyFirestoreErrorMessage(subscriptionError, "Não foi possível carregar seus convites.")),
    );
  }, [email, emailVerified]);

  const error = listsError ?? invitesError;
  return useMemo(() => ({ invites, sharedLists, error }), [error, invites, sharedLists]);
}

/** Convites feitos pelo dono para uma lista (diálogo Compartilhar). */
export function useListInvites(ownerId: string, listId: string, enabled: boolean) {
  const [invites, setInvites] = useState<GroceryInvite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInvites(null);
    setError(null);
    if (!enabled) return undefined;
    return subscribeToListInvites(
      ownerId,
      listId,
      (next) => {
        setInvites(next);
        setError(null);
      },
      (subscriptionError) =>
        setError(friendlyFirestoreErrorMessage(subscriptionError, "Não foi possível carregar os convites.")),
    );
  }, [enabled, listId, ownerId]);

  return { invites: invites ?? NONE, isLoading: invites === null && !error, error };
}
