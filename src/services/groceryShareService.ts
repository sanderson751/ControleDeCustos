import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  FieldPath,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  type Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { GroceryInvite, GroceryList } from "@/domain/entities/grocery";
import { inviteIdFor, keepsCatalogAccess, listMemberIds, normalizeEmail } from "@/domain/rules/groceryShareRules";
import { db } from "@/lib/firebase";
import { toGroceryInvite, toGroceryList } from "@/services/converters";
import {
  groceryInviteDocRef,
  groceryInvitesCollectionRef,
  groceryListDocRef,
  groceryListsCollectionRef,
  groceryListsGroupRef,
  groceryMemberDocRef,
} from "@/services/firestorePaths";

/** Quem convida, aceita ou sai: uid, nome exibido e e-mail (minusculas). */
export type ShareActor = { uid: string; name: string; email: string };

const byCreation = (left: { createdAt: Date }, right: { createdAt: Date }) =>
  right.createdAt.getTime() - left.createdAt.getTime();

/**
 * Convida um e-mail para a lista. Um convite ja respondido (recusado, ou de
 * quem saiu) para o mesmo e-mail e substituido por um novo pendente.
 */
export async function inviteToList(
  owner: ShareActor,
  list: Pick<GroceryList, "id" | "name">,
  email: string,
  previous: Pick<GroceryInvite, "id" | "status"> | null,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const ref = groceryInviteDocRef(inviteIdFor(owner.uid, list.id, normalized));

  if (previous && previous.status !== "pendente") {
    await deleteDoc(ref);
  }

  const batch = writeBatch(db);
  batch.set(ref, {
    ownerId: owner.uid,
    ownerName: owner.name,
    ownerEmail: owner.email,
    listId: list.id,
    listName: list.name,
    email: normalized,
    status: "pendente",
    memberUid: null,
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
  // Nome do dono exibido para quem participar.
  batch.update(groceryListDocRef(owner.uid, list.id), {
    ownerName: owner.name,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Cancela um convite (pendente ou ja respondido). */
export async function cancelInvite(inviteId: string): Promise<void> {
  await deleteDoc(groceryInviteDocRef(inviteId));
}

/** Convites que o dono fez para uma lista. */
export function subscribeToListInvites(
  ownerId: string,
  listId: string,
  onData: (invites: GroceryInvite[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(groceryInvitesCollectionRef(), where("ownerId", "==", ownerId), where("listId", "==", listId)),
    (snapshot) => onData(snapshot.docs.map((item) => toGroceryInvite(item.id, item.data())).sort(byCreation)),
    onError,
  );
}

/** Convites pendentes para o meu e-mail (exige e-mail confirmado nas regras). */
export function subscribeToMyInvites(
  email: string,
  onData: (invites: GroceryInvite[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      groceryInvitesCollectionRef(),
      where("email", "==", normalizeEmail(email)),
      where("status", "==", "pendente"),
    ),
    (snapshot) => onData(snapshot.docs.map((item) => toGroceryInvite(item.id, item.data())).sort(byCreation)),
    onError,
  );
}

/**
 * Aceita em um unico lote: convite aceito, entrada na lista e acesso ao
 * catalogo do dono (as regras conferem um contra o outro).
 */
export async function acceptInvite(invite: GroceryInvite, me: ShareActor): Promise<void> {
  const batch = writeBatch(db);

  batch.update(groceryInviteDocRef(invite.id), {
    status: "aceito",
    memberUid: me.uid,
    respondedAt: serverTimestamp(),
  });
  batch.update(
    groceryListDocRef(invite.ownerId, invite.listId),
    new FieldPath("memberIds"),
    arrayUnion(me.uid),
    new FieldPath("members", me.uid),
    { name: me.name, email: me.email },
    new FieldPath("updatedAt"),
    serverTimestamp(),
  );
  batch.set(groceryMemberDocRef(invite.ownerId, me.uid), {
    ownerId: invite.ownerId,
    memberUid: me.uid,
    email: me.email,
    name: me.name,
    listId: invite.listId,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function declineInvite(inviteId: string): Promise<void> {
  await updateDoc(groceryInviteDocRef(inviteId), {
    status: "recusado",
    memberUid: null,
    respondedAt: serverTimestamp(),
  });
}

function removeMemberWrites(
  batch: ReturnType<typeof writeBatch>,
  ownerId: string,
  listId: string,
  member: { uid: string; email: string },
  keepCatalogAccess: boolean,
) {
  batch.update(
    groceryListDocRef(ownerId, listId),
    new FieldPath("memberIds"),
    arrayRemove(member.uid),
    new FieldPath("members", member.uid),
    deleteField(),
    new FieldPath("updatedAt"),
    serverTimestamp(),
  );
  if (member.email) batch.delete(groceryInviteDocRef(inviteIdFor(ownerId, listId, member.email)));
  if (!keepCatalogAccess) batch.delete(groceryMemberDocRef(ownerId, member.uid));
}

/** Listas do dono das quais a pessoa participa (para manter ou nao o acesso ao catalogo). */
async function memberListsOf(ownerId: string, memberUid: string, asOwner: boolean) {
  const snapshot = await getDocs(
    query(
      asOwner ? groceryListsCollectionRef(ownerId) : groceryListsGroupRef(),
      where("memberIds", "array-contains", memberUid),
    ),
  );
  return snapshot.docs.map((item) => toGroceryList(item.id, item.data()));
}

/** O dono remove um participante (e o acesso ao catalogo, se nao estiver em outra lista dele). */
export async function removeMember(
  ownerId: string,
  listId: string,
  member: { uid: string; email: string },
): Promise<void> {
  const keep = keepsCatalogAccess(member.uid, ownerId, listId, await memberListsOf(ownerId, member.uid, true));
  const batch = writeBatch(db);
  removeMemberWrites(batch, ownerId, listId, member, keep);
  await batch.commit();
}

/** O participante sai da lista. */
export async function leaveList(ownerId: string, listId: string, me: ShareActor): Promise<void> {
  const keep = keepsCatalogAccess(me.uid, ownerId, listId, await memberListsOf(ownerId, me.uid, false));
  const batch = writeBatch(db);
  removeMemberWrites(batch, ownerId, listId, me, keep);
  await batch.commit();
}

/** Listas de outras pessoas das quais participo, mais recentes primeiro. */
export function subscribeToSharedLists(
  uid: string,
  onData: (lists: GroceryList[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(groceryListsGroupRef(), where("memberIds", "array-contains", uid)),
    (snapshot) => onData(snapshot.docs.map((item) => toGroceryList(item.id, item.data())).sort(byCreation)),
    onError,
  );
}

/**
 * Uma lista (propria ou compartilhada) em tempo real; null se nao existe.
 * Sem sinal e sem copia no aparelho o cache responde "nao existe": nesse caso
 * espera o servidor em vez de dizer que a lista foi excluida.
 */
export function subscribeToList(
  ownerId: string,
  listId: string,
  onData: (list: GroceryList | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    groceryListDocRef(ownerId, listId),
    (snapshot) => {
      if (snapshot.exists()) onData(toGroceryList(snapshot.id, snapshot.data()));
      else if (!snapshot.metadata?.fromCache) onData(null);
    },
    onError,
  );
}

/**
 * Antes de excluir a lista: convites dela e acessos ao catalogo de quem nao
 * participa de outra lista do dono. Gravado no mesmo lote da exclusao.
 */
export async function listShareCleanup(
  ownerId: string,
  list: Pick<GroceryList, "id" | "memberIds">,
  otherLists: readonly Pick<GroceryList, "id" | "memberIds">[],
): Promise<{ inviteIds: string[]; memberUids: string[]; complete: boolean }> {
  const elsewhere = new Set(
    otherLists.filter((other) => other.id !== list.id).flatMap((other) => listMemberIds(other)),
  );
  // Calculado da propria lista: nao depende da consulta de convites.
  const memberUids = listMemberIds(list).filter((uid) => !elsewhere.has(uid));

  try {
    const invites = await getDocs(
      query(groceryInvitesCollectionRef(), where("ownerId", "==", ownerId), where("listId", "==", list.id)),
    );
    return { inviteIds: invites.docs.map((item) => item.id), memberUids, complete: true };
  } catch {
    return { inviteIds: [], memberUids, complete: false };
  }
}
