export type CostType = "fixo" | "variavel";

export type CostFilter = "todos" | CostType;

export type CostEntry = {
  id: string;
  accountName: string;
  amount: number;
  costType: CostType;
  installmentsTotal: number;
  competenceYear: number;
  competenceMonth: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewCostInput = {
  accountName: string;
  amount: number;
  costType: CostType;
  installmentsTotal?: number;
  /** Data de criacao informada manualmente. Quando ausente usa-se o horario do servidor. */
  createdAtManual?: Date;
};

export type UpdateCostInput = {
  accountName: string;
  amount: number;
  costType: CostType;
  installmentsTotal: number;
};

export type CostTotals = {
  fixedTotal: number;
  variableTotal: number;
  total: number;
};

export const COST_TYPE_LABELS: Record<CostType, string> = {
  fixo: "Fixo",
  variavel: "Variável",
};
