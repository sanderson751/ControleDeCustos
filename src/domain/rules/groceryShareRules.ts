import {
  type GroceryInvite,
  type GroceryList,
  MAX_INVITE_EMAIL_LENGTH,
  MAX_LIST_MEMBERS,
  MAX_MEMBER_NAME_LENGTH,
} from "@/domain/entities/grocery";
import type { Validation } from "@/domain/rules/groceryRules";

/** Mesmo formato exigido pelas regras do Firestore (minusculas). */
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Id do convite: um por e-mail em cada lista do dono (convidar de novo nao duplica). */
export function inviteIdFor(ownerId: string, listId: string, email: string): string {
  return `${ownerId}_${listId}_${normalizeEmail(email)}`;
}

/** Nome exibido para os outros participantes (limitado como nas regras). */
export function memberDisplayName(name: string | null | undefined, email: string): string {
  const clean = (name ?? "").trim() || normalizeEmail(email).split("@")[0] || "Participante";
  return clean.slice(0, MAX_MEMBER_NAME_LENGTH);
}

export function listMemberIds(list: Pick<GroceryList, "memberIds">): string[] {
  return list.memberIds ?? [];
}

/**
 * Valida o e-mail convidado: formato, nao e o proprio dono, ainda nao participa
 * nem tem convite pendente, e a lista tem vaga.
 */
export function validateInvite(input: {
  email: string;
  ownerEmail: string;
  list: Pick<GroceryList, "status" | "memberIds" | "members">;
  invites: readonly Pick<GroceryInvite, "email" | "status">[];
}): Validation<string> {
  const email = normalizeEmail(input.email);

  if (!email) return { ok: false, message: "Informe o e-mail de quem você quer convidar." };
  if (email.length > MAX_INVITE_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, message: "Informe um e-mail válido." };
  }
  if (email === normalizeEmail(input.ownerEmail)) {
    return { ok: false, message: "Você já é o dono desta lista." };
  }
  if (input.list.status !== "aberta") {
    return { ok: false, message: "Só é possível compartilhar uma lista aberta." };
  }

  const members = Object.values(input.list.members ?? {});
  if (members.some((member) => normalizeEmail(member.email) === email)) {
    return { ok: false, message: "Essa pessoa já participa da lista." };
  }
  if (input.invites.some((invite) => invite.email === email && invite.status === "pendente")) {
    return { ok: false, message: "Já existe um convite pendente para esse e-mail." };
  }

  const pending = input.invites.filter((invite) => invite.status === "pendente").length;
  if (listMemberIds(input.list).length + pending >= MAX_LIST_MEMBERS) {
    return {
      ok: false,
      message: `A lista pode ter no máximo ${MAX_LIST_MEMBERS} participantes (contando convites pendentes).`,
    };
  }

  return { ok: true, value: email };
}

/**
 * O acesso ao catalogo do dono continua enquanto a pessoa participar de alguma
 * outra lista dele.
 */
export function keepsCatalogAccess(
  memberUid: string,
  ownerId: string,
  leavingListId: string,
  lists: readonly Pick<GroceryList, "id" | "ownerId" | "memberIds">[],
): boolean {
  return lists.some(
    (list) =>
      list.id !== leavingListId &&
      (list.ownerId ?? ownerId) === ownerId &&
      listMemberIds(list).includes(memberUid),
  );
}
