import type { CostCategory } from "@/domain/entities/cost";

/** Categoria criada pelo usuario (users/{uid}/categories/{id}). */
export type CustomCategory = {
  id: string;
  name: string;
  archived: boolean;
};

export type CategoryOption = {
  id: CostCategory;
  label: string;
  isDefault: boolean;
  archived: boolean;
};

/** Categorias disponiveis para o usuario: padrao + personalizadas. */
export type CategoryCatalog = {
  /** Todas as categorias em ordem de exibicao (padrao, depois personalizadas por nome). */
  options: CategoryOption[];
  /** Ids de todas as categorias (inclui arquivadas). */
  ids: CostCategory[];
  /** Ids das categorias ativas (selecionaveis em novos lancamentos). */
  activeIds: CostCategory[];
  labelOf: (id: CostCategory) => string;
};

export const MAX_CUSTOM_CATEGORIES = 20;
export const MAX_CATEGORY_NAME_LENGTH = 40;
export const UNKNOWN_CATEGORY_LABEL = "Categoria removida";
/** Rotulo provisorio enquanto o catalogo nao esta disponivel. */
export const PENDING_CATEGORY_LABEL = "—";
