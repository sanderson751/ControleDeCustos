import { useEffect, useMemo, useState } from "react";
import type {
  GoalContribution,
  GoalSummary,
  SavingsGoal,
} from "@/domain/entities/savingsGoal";
import { sortGoalSummaries, summarizeGoal } from "@/domain/rules/savingsGoalRules";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import {
  subscribeToContributions,
  subscribeToGoals,
} from "@/services/savingsGoalService";

/** Frequencia da checagem de virada do dia com a tela aberta. */
export const DAY_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type SavingsGoalsState = {
  goals: SavingsGoal[];
  /** Movimentacoes de metas existentes, mais recentes primeiro. */
  contributions: GoalContribution[];
  /** Resumos ordenados (atrasadas, em andamento por prazo, concluidas). */
  summaries: GoalSummary[];
  isLoading: boolean;
  error: string | null;
};

/** Metas e movimentacoes do usuario em tempo real. */
export function useSavingsGoals(userId: string): SavingsGoalsState {
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [rawContributions, setRawContributions] = useState<GoalContribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Hoje" muda na virada do dia: situacao e valor mensal acompanham o calendario.
  const [today, setToday] = useState(() => new Date().toDateString());

  useEffect(() => {
    const timer = setInterval(() => setToday(new Date().toDateString()), DAY_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setGoals(null);
    setRawContributions(null);
    setError(null);

    const onError = (subscriptionError: Error) =>
      setError(
        friendlyFirestoreErrorMessage(
          subscriptionError,
          "Não foi possível carregar suas metas de economia.",
        ),
      );

    const stopGoals = subscribeToGoals(userId, setGoals, onError);
    const stopContributions = subscribeToContributions(userId, setRawContributions, onError);

    return () => {
      stopGoals();
      stopContributions();
    };
  }, [userId]);

  return useMemo(() => {
    const loadedGoals = goals ?? [];
    const goalIds = new Set(loadedGoals.map((goal) => goal.id));
    // Movimentacoes de meta excluida (exclusao interrompida) sao ignoradas.
    const contributions = (rawContributions ?? []).filter((item) => goalIds.has(item.goalId));
    const now = new Date(today);
    now.setHours(12);

    return {
      goals: loadedGoals,
      contributions,
      summaries: sortGoalSummaries(
        loadedGoals.map((goal) => summarizeGoal(goal, contributions, now)),
      ),
      isLoading: !error && (goals === null || rawContributions === null),
      error,
    };
  }, [error, goals, rawContributions, today]);
}
