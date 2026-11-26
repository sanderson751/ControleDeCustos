import {
  MAX_CUSTOM_CATEGORIES,
  UNKNOWN_CATEGORY_LABEL,
} from "@/domain/entities/category";
import { DEFAULT_CATEGORIES } from "@/domain/entities/cost";
import {
  buildCategoryCatalog,
  canCreateCategory,
  DEFAULT_CATALOG,
  isDefaultCategory,
  selectableCategories,
  validateCategoryName,
} from "@/domain/rules/categoryRules";

const customs = [
  { id: "zId", name: "Viagens", archived: false },
  { id: "aId", name: "Assinaturas", archived: true },
  { id: "pId", name: "Pets", archived: false },
];

describe("categoryRules", () => {
  it("identifica categorias padrao", () => {
    expect(isDefaultCategory("moradia")).toBe(true);
    expect(isDefaultCategory("zId")).toBe(false);
  });

  it("catalogo: padrao na ordem fixa e personalizadas em ordem alfabetica", () => {
    const catalog = buildCategoryCatalog(customs);

    expect(catalog.ids).toEqual([...DEFAULT_CATEGORIES, "aId", "pId", "zId"]);
    expect(catalog.activeIds).not.toContain("aId");
    expect(catalog.activeIds).toContain("pId");
    expect(catalog.options.find((option) => option.id === "aId")).toMatchObject({
      label: "Assinaturas",
      isDefault: false,
      archived: true,
    });
    expect(catalog.labelOf("alimentacao")).toBe("Alimentação");
    expect(catalog.labelOf("pId")).toBe("Pets");
    expect(catalog.labelOf("removida")).toBe(UNKNOWN_CATEGORY_LABEL);
  });

  it("ignora documento personalizado com id de categoria padrao", () => {
    const catalog = buildCategoryCatalog([
      { id: "moradia", name: "Casa", archived: false },
    ]);
    expect(catalog.ids).toEqual([...DEFAULT_CATEGORIES]);
    expect(catalog.labelOf("moradia")).toBe("Moradia");
  });

  it("catalogo padrao contem somente as categorias padrao", () => {
    expect(DEFAULT_CATALOG.ids).toEqual([...DEFAULT_CATEGORIES]);
  });

  it("opcoes do formulario: ativas mais a atual quando arquivada", () => {
    const catalog = buildCategoryCatalog(customs);
    const ids = (current?: string) =>
      selectableCategories(catalog, current).map((option) => option.id);

    expect(ids()).not.toContain("aId");
    expect(ids("aId")).toContain("aId");
    expect(ids("pId")).toHaveLength(DEFAULT_CATEGORIES.length + 2);
  });

  it("valida nome: obrigatorio, tamanho e normalizacao de espacos", () => {
    expect(validateCategoryName("   ", DEFAULT_CATALOG)).toEqual({
      ok: false,
      message: "Informe o nome da categoria.",
    });
    expect(validateCategoryName("a".repeat(41), DEFAULT_CATALOG)).toEqual({
      ok: false,
      message: "O nome pode ter no máximo 40 caracteres.",
    });
    expect(validateCategoryName("  Meus   pets ", DEFAULT_CATALOG)).toEqual({
      ok: true,
      name: "Meus pets",
    });
    expect(validateCategoryName("a".repeat(40), DEFAULT_CATALOG).ok).toBe(true);
  });

  it("recusa nome duplicado ignorando acento e caixa (inclusive padrao e arquivadas)", () => {
    const catalog = buildCategoryCatalog(customs);

    expect(validateCategoryName("ALIMENTACAO", catalog)).toEqual({
      ok: false,
      message: 'Já existe uma categoria chamada "Alimentação".',
    });
    expect(validateCategoryName("assinaturas", catalog).ok).toBe(false);
  });

  it("renomear permite manter o proprio nome (excludeId)", () => {
    const catalog = buildCategoryCatalog(customs);

    expect(validateCategoryName("pets", catalog, { excludeId: "pId" })).toEqual({
      ok: true,
      name: "pets",
    });
    expect(
      validateCategoryName("Viagens", catalog, { excludeId: "pId" }).ok,
    ).toBe(false);
  });

  it("limita a quantidade de categorias personalizadas", () => {
    const many = Array.from({ length: MAX_CUSTOM_CATEGORIES }, (_, index) => ({
      id: `c${index}`,
      name: `Categoria ${index}`,
      archived: false,
    }));

    expect(canCreateCategory(many.slice(1))).toBe(true);
    expect(canCreateCategory(many)).toBe(false);
  });
});
