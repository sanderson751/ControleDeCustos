import {
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import type { Competence } from "@/domain/entities/cost";
import type {
  RecurringCost,
  RecurringCostInput,
} from "@/domain/entities/recurringCost";
import { getCurrentCompetence } from "@/domain/rules/competence";
import {
  buildOccurrenceId,
  occurrenceDate,
  pendingCompetences,
  resumeCursor,
} from "@/domain/rules/recurringCostRules";
import { db } from "@/lib/firebase";
import { toRecurringCost } from "@/services/converters";
import {
  costEntryDocRef,
  recurringCostDocRef,
  recurringCostsCollectionRef,
} from "@/services/firestorePaths";

function inputFields(input: RecurringCostInput) {
  return {
    accountName: input.accountName.trim(),
    amount: Number(input.amount),
    costType: input.costType,
    category: input.category,
    description: input.description.trim(),
    dayOfMonth: input.dayOfMonth,
    startYear: input.start.year,
    startMonth: input.start.month,
  };
}

function cursorFields(cursor: Competence | null) {
  return {
    lastGeneratedYear: cursor?.year ?? null,
    lastGeneratedMonth: cursor?.month ?? null,
  };
}

export async function listRecurringCosts(userId: string): Promise<RecurringCost[]> {
  const snapshot = await getDocs(recurringCostsCollectionRef(userId));
  return snapshot.docs.map((docSnapshot) =>
    toRecurringCost(docSnapshot.id, docSnapshot.data()),
  );
}

/** Recorrencias do usuario em tempo real, ordenadas pela conta. */
export function subscribeToRecurringCosts(
  userId: string,
  onData: (items: RecurringCost[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    recurringCostsCollectionRef(userId),
    (snapshot) => {
      onData(
        snapshot.docs
          .map((docSnapshot) => toRecurringCost(docSnapshot.id, docSnapshot.data()))
          .sort((left, right) => left.accountName.localeCompare(right.accountName, "pt-BR")),
      );
    },
    onError,
  );
}

/** Cria recorrencia ativa, ainda sem meses gerados. Retorna a recorrencia criada. */
export async function createRecurringCost(
  userId: string,
  input: RecurringCostInput,
): Promise<RecurringCost> {
  const ref = await addDoc(recurringCostsCollectionRef(userId), {
    userId,
    ...inputFields(input),
    active: true,
    ...cursorFields(null),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ...input, id: ref.id, active: true, lastGenerated: null };
}

/** Altera somente os meses gerados dali em diante (cursor preservado). */
export async function updateRecurringCost(
  userId: string,
  recurringId: string,
  input: RecurringCostInput,
): Promise<void> {
  await updateDoc(recurringCostDocRef(userId, recurringId), {
    ...inputFields(input),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Pausar grava somente `active: false` (nunca mexe no cursor). Reativar le o
 * cursor atual no servidor (transacao) e pula os meses pausados.
 */
export async function setRecurringCostActive(
  userId: string,
  recurring: RecurringCost,
  active: boolean,
  now: Date = new Date(),
): Promise<RecurringCost> {
  const ref = recurringCostDocRef(userId, recurring.id);

  if (!active) {
    await updateDoc(ref, { active: false, updatedAt: serverTimestamp() });
    return { ...recurring, active: false };
  }

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists()) {
      throw new Error("Recorrência não encontrada.");
    }

    const fresh = toRecurringCost(snapshot.id, snapshot.data());
    const lastGenerated = resumeCursor(fresh, getCurrentCompetence(now));

    transaction.update(ref, {
      active: true,
      ...cursorFields(lastGenerated),
      updatedAt: serverTimestamp(),
    });

    return { ...fresh, active: true, lastGenerated };
  });
}

/** Exclui a recorrencia; lancamentos ja gerados permanecem. */
export async function deleteRecurringCost(
  userId: string,
  recurringId: string,
): Promise<void> {
  await deleteDoc(recurringCostDocRef(userId, recurringId));
}

/**
 * Gera os meses pendentes de UMA recorrencia em transacao: le a recorrencia no
 * servidor, recalcula os meses a partir do cursor atual e grava ocorrencias +
 * cursor atomicamente. Outra aba/dispositivo que gerou antes faz esta
 * transacao recalcular (e nao regravar nada); um mes excluido nunca volta.
 * Ate 24 ocorrencias + 1 cursor por transacao.
 */
export async function generateRecurring(
  userId: string,
  recurringId: string,
  now: Date = new Date(),
): Promise<number> {
  const ref = recurringCostDocRef(userId, recurringId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists()) {
      return 0;
    }

    const recurring = toRecurringCost(snapshot.id, snapshot.data());
    const months = pendingCompetences(recurring, getCurrentCompetence(now));

    if (months.length === 0) {
      return 0;
    }

    for (const competence of months) {
      transaction.set(costEntryDocRef(userId, buildOccurrenceId(recurring.id, competence)), {
        userId,
        accountName: recurring.accountName,
        amount: recurring.amount,
        costType: recurring.costType,
        category: recurring.category,
        description: recurring.description,
        installmentsTotal: 1,
        competenceYear: competence.year,
        competenceMonth: competence.month,
        recurringId: recurring.id,
        createdAt: Timestamp.fromDate(occurrenceDate(competence, recurring.dayOfMonth)),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.update(ref, {
      ...cursorFields(months[months.length - 1]),
      updatedAt: serverTimestamp(),
    });

    return months.length;
  });
}

export type SyncResult = {
  /** Lancamentos criados. */
  created: number;
  /** Recorrencias cuja geracao falhou (as demais seguem normalmente). */
  failed: number;
};

/**
 * Gera os pendentes das recorrencias informadas (ou de todas). A lista lida
 * serve so para saber quem tem pendencia; a transacao de cada uma confirma.
 */
export async function syncRecurringCosts(
  userId: string,
  options: { recurrings?: readonly RecurringCost[]; now?: Date } = {},
): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const recurrings = options.recurrings ?? (await listRecurringCosts(userId));
  const current = getCurrentCompetence(now);
  const result: SyncResult = { created: 0, failed: 0 };

  for (const recurring of recurrings) {
    if (pendingCompetences(recurring, current).length === 0) {
      continue;
    }

    try {
      result.created += await generateRecurring(userId, recurring.id, now);
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
