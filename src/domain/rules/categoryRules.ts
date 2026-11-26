import {
  type CategoryCatalog,
  type CategoryOption,
  type CustomCategory,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_CUSTOM_CATEGORIES,
  UNKNOWN_CATEGORY_LABEL,
} from "@/domain/entities/category";
import {
  type CostCategory,
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_LABELS,
  type DefaultCategory,
} from "@/domain/entities/cost";
import { normalizeSearchText } from "@/domain/rules/costRules";

export function isDefaultCategory(id: string): id is DefaultCategory {
  return (DEFAULT_CATEGORIES as readonly string[]).includes(id);
}

/**
 * Catalogo do usuario: categorias padrao (ordem fixa) seguidas das
 * personalizadas em ordem alfabetica. Arquivadas permanecem no catalogo para
 * exibir lancamentos antigos, mas ficam fora de `activeIds`.
 */
export function buildCategoryCatalog(
  customs: readonly CustomCategory[],
  unknownLabel: string = UNKNOWN_CATEGORY_LABEL,
): CategoryCatalog {
  const defaults: CategoryOption[] = DEFAULT_CATEGORIES.map((id) => ({
    id,
    label: DEFAULT_CATEGORY_LABELS[id],
    isDefault: true,
    archived: false,
  }));
  const personal: CategoryOption[] = customs
    .filter((item) => !isDefaultCategory(item.id))
    .map((item) => ({
      id: item.id,
      label: item.name,
      isDefault: false,
      archived: item.archived,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const options = [...defaults, ...personal];
  const labels = new Map(options.map((option) => [option.id, option.label]));

  return {
    options,
    ids: options.map((option) => option.id),
    activeIds: options
      .filter((option) => !option.archived)
      .map((option) => option.id),
    labelOf: (id: CostCategory) => labels.get(id) ?? unknownLabel,
  };
}

/** Catalogo apenas com as categorias padrao (fallback sem provider/testes). */
export const DEFAULT_CATALOG: CategoryCatalog = buildCategoryCatalog([]);

/**
 * Opcoes do formulario de custo: categorias ativas e, ao editar um lancamento
 * com categoria arquivada, a propria categoria (marcada como arquivada).
 */
export function selectableCategories(
  catalog: CategoryCatalog,
  currentId?: CostCategory,
): CategoryOption[] {
  return catalog.options.filter(
    (option) => !option.archived || option.id === currentId,
  );
}

export type CategoryNameValidation =
  | { ok: true; name: string }
  | { ok: false; message: string };

/** Nome aparado, 1-40 caracteres e unico (sem acento/caixa) no catalogo. */
export function validateCategoryName(
  rawName: string,
  catalog: CategoryCatalog,
  options: { excludeId?: CostCategory } = {},
): CategoryNameValidation {
  const name = rawName.trim().replace(/\s+/g, " ");

  if (!name) {
    return { ok: false, message: "Informe o nome da categoria." };
  }

  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    return {
      ok: false,
      message: `O nome pode ter no máximo ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
    };
  }

  const key = normalizeSearchText(name);
  const duplicate = catalog.options.find(
    (option) =>
      option.id !== options.excludeId &&
      normalizeSearchText(option.label) === key,
  );

  if (duplicate) {
    return {
      ok: false,
      message: `Já existe uma categoria chamada "${duplicate.label}".`,
    };
  }

  return { ok: true, name };
}

export function canCreateCategory(customs: readonly CustomCategory[]): boolean {
  return customs.length < MAX_CUSTOM_CATEGORIES;
}
