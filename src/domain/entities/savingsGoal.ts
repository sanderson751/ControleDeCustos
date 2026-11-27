import type { Competence } from "@/domain/entities/cost";

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  /** Mes limite (inclusive) para atingir o alvo; null = sem prazo. */
  deadline: Competence | null;
};

/** Movimentacao: deposito (valor positivo) ou retirada (valor negativo). */
export type GoalContribution = {
  id: string;
  goalId: string;
  amount: number;
  date: Date;
  note: string;
};

export type ContributionKind = "deposito" | "retirada";

export type GoalStatus = "em-andamento" | "concluida" | "atrasada";

export type GoalSummary = {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  /** 0-100, arredondado para baixo. */
  percent: number;
  status: GoalStatus;
  /** Meses ate o prazo, incluindo o atual (null sem prazo ou prazo vencido). */
  monthsLeft: number | null;
  /** Quanto guardar por mes para cumprir o prazo (null sem prazo ou concluida). */
  monthlyNeeded: number | null;
};

export type GoalFormValues = {
  name: string;
  targetAmount: number;
  deadline: Competence | null;
};

export type ContributionFormValues = {
  kind: ContributionKind;
  amount: number;
  date: Date | null;
  note: string;
};

export const MAX_GOAL_NAME_LENGTH = 60;
export const MAX_CONTRIBUTION_NOTE_LENGTH = 200;
export const MAX_GOAL_AMOUNT = 1_000_000_000;
/** Metas exibidas no resumo do Inicio. */
export const HOME_GOAL_HIGHLIGHTS = 3;

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  "em-andamento": "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};
