export type CostType = "fixo" | "variavel";

export type CostFilter = "todos" | CostType;

/** Categorias padrao (steering de produto). Valores persistidos sem acento. */
export const DEFAULT_CATEGORIES = [
  "moradia",
  "alimentacao",
  "transporte",
  "saude",
  "educacao",
  "lazer",
  "outros",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

/**
 * Id de categoria: um id padrao (acima) ou o id de uma categoria
 * personalizada do usuario (users/{uid}/categories/{id}).
 */
export type CostCategory = string;

export type CategoryFilter = "todas" | CostCategory;

export const DEFAULT_CATEGORY_LABELS: Record<DefaultCategory, string> = {
  moradia: "Moradia",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  outros: "Outros",
};

/** Categoria usada para lancamentos legados (sem categoria). */
export const FALLBACK_CATEGORY: DefaultCategory = "outros";

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
  /** Observacao livre (vazia quando ausente). */
  description: string;
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
  description?: string;
  installmentsTotal?: number;
  /** Data de criacao informada manualmente. Quando ausente usa-se o horario do servidor. */
  createdAtManual?: Date;
};

export type UpdateCostInput = {
  accountName: string;
  amount: number;
  costType: CostType;
  category: CostCategory;
  description: string;
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

/** Tamanho maximo da descricao livre (espelhado em firestore.rules). */
export const MAX_DESCRIPTION_LENGTH = 500;
