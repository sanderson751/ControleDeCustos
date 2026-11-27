import {
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import type {
  GoalContribution,
  GoalFormValues,
  SavingsGoal,
} from "@/domain/entities/savingsGoal";
import { type ChunkedWrite, commitInChunks } from "@/services/batchChunks";
import { toGoalContribution, toSavingsGoal } from "@/services/converters";
import {
  goalContributionDocRef,
  goalContributionsCollectionRef,
  savingsGoalDocRef,
  savingsGoalsCollectionRef,
} from "@/services/firestorePaths";

function goalFields(values: GoalFormValues) {
  return {
    name: values.name.trim(),
    targetAmount: Number(values.targetAmount),
    deadlineYear: values.deadline?.year ?? null,
    deadlineMonth: values.deadline?.month ?? null,
  };
}

export function subscribeToGoals(
  userId: string,
  onData: (goals: SavingsGoal[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    savingsGoalsCollectionRef(userId),
    (snapshot) =>
      onData(snapshot.docs.map((item) => toSavingsGoal(item.id, item.data()))),
    onError,
  );
}

/** Movimentacoes de todas as metas, mais recentes primeiro. */
export function subscribeToContributions(
  userId: string,
  onData: (items: GoalContribution[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    goalContributionsCollectionRef(userId),
    (snapshot) =>
      onData(
        snapshot.docs
          .map((item) => toGoalContribution(item.id, item.data()))
          .sort((left, right) => right.date.getTime() - left.date.getTime()),
      ),
    onError,
  );
}

export async function createGoal(userId: string, values: GoalFormValues): Promise<string> {
  const ref = await addDoc(savingsGoalsCollectionRef(userId), {
    userId,
    ...goalFields(values),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateGoal(
  userId: string,
  goalId: string,
  values: GoalFormValues,
): Promise<void> {
  await updateDoc(savingsGoalDocRef(userId, goalId), {
    ...goalFields(values),
    updatedAt: serverTimestamp(),
  });
}

/** Registra deposito (valor positivo) ou retirada (valor negativo). */
export async function addContribution(
  userId: string,
  input: { goalId: string; amount: number; date: Date; note: string },
): Promise<void> {
  await addDoc(goalContributionsCollectionRef(userId), {
    userId,
    goalId: input.goalId,
    amount: Number(input.amount),
    date: Timestamp.fromDate(input.date),
    note: input.note.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteContribution(userId: string, contributionId: string): Promise<void> {
  await deleteDoc(goalContributionDocRef(userId, contributionId));
}

/**
 * Exclui a meta e suas movimentacoes. A meta vai no PRIMEIRO lote: para o
 * usuario a exclusao e completa mesmo se um lote seguinte falhar, e as
 * movimentacoes restantes (orfas) ficam ocultas e nao entram em nenhum saldo.
 */
export async function deleteGoal(
  userId: string,
  goalId: string,
  contributions: readonly GoalContribution[],
): Promise<void> {
  const operations: ChunkedWrite[] = [
    { write: (batch) => batch.delete(savingsGoalDocRef(userId, goalId)) },
    ...contributions
      .filter((item) => item.goalId === goalId)
      .map<ChunkedWrite>((item) => ({
        write: (batch) => batch.delete(goalContributionDocRef(userId, item.id)),
      })),
  ];

  await commitInChunks(operations);
}
