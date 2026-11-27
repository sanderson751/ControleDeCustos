import type { Competence, CostCategory, CostType } from "@/domain/entities/cost";

/** Modelo de conta mensal que gera um lancamento por competencia. */
export type RecurringCost = {
  id: string;
  accountName: string;
  amount: number;
  costType: CostType;
  category: CostCategory;
  description: string;
  /** Dia do mes do lancamento gerado (1-28). */
  dayOfMonth: number;
  /** Primeira competencia gerada. */
  start: Competence;
  active: boolean;
  /** Cursor: ultima competencia ja gerada (null = nenhuma). */
  lastGenerated: Competence | null;
};

/** Dados editaveis pelo usuario (sem id, situacao e cursor). */
export type RecurringCostInput = Pick<
  RecurringCost,
  "accountName" | "amount" | "costType" | "category" | "description" | "dayOfMonth" | "start"
>;

/** Valores do formulario (categoria vazia ate o usuario escolher). */
export type RecurringCostFormValues = Omit<RecurringCostInput, "category"> & {
  category: CostCategory | "";
};

/** Meses recuperados por recorrencia apos longa ausencia. */
export const MAX_CATCH_UP_MONTHS = 24;
export const MAX_RECURRING_DAY = 28;
/** Inicio permitido: ate 12 meses antes ou depois da competencia atual. */
export const START_WINDOW_MONTHS = 12;
export const MAX_RECURRING_AMOUNT = 1_000_000_000;
