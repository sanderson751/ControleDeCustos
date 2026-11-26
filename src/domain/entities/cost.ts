export type CostType = "fixo" | "variavel";

export type CostFilter = "todos" | CostType;

/** Categorias padrao (steering de produto). Valores persistidos sem acento. */
export const COST_CATEGORIES = [
  "moradia",
  "alimentacao",
  "transporte",
  "saude",
  "educacao",
  "lazer",
  "outros",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export type CategoryFilter = "todas" | CostCategory;

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  moradia: "Moradia",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  outros: "Outros",
};

/** Categoria usada para lancamentos legados (sem categoria). */
export const FALLBACK_CATEGORY: CostCategory = "outros";

export type Competence = {
  year: number;
  /** 1-12 */
  month: number;
};

export type CostEntry = {
  id: string;
  accountName: string;
  amount: number;
  costType: CostType;
  category: CostCategory;
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
  category: CostCategory;
  installmentsTotal?: number;
  /** Data de criacao informada manualmente. Quando ausente usa-se o horario do servidor. */
  createdAtManual?: Date;
};

export type UpdateCostInput = {
  accountName: string;
  amount: number;
  costType: CostType;
  category: CostCategory;
  installmentsTotal: number;
};

export type CategoryTotal = {
  category: CostCategory;
  total: number;
  /** Participacao no total do periodo (0-1). */
  share: number;
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
