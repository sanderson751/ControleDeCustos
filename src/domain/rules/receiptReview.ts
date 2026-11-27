import type {
  GroceryListItem,
  GroceryProduct,
  GroceryUnit,
  ReceiptCompletion,
  ReceiptExtra,
} from "@/domain/entities/grocery";
import { normalizeSearchText } from "@/domain/rules/costRules";
import {
  aliasKey,
  CONFIDENT_MATCH,
  type MatchCandidate,
  matchScore,
  MATCH_THRESHOLD,
  type ParsedReceipt,
  type ReceiptLine,
} from "@/domain/rules/receiptParser";

/**
 * Destino de cada linha da comanda na revisao:
 * - `list:<itemId>`: preco pago do item da lista (e apelido do produto);
 * - `product:<productId>`: produto do catalogo fora da lista (historico);
 * - `new`: cria o produto no catalogo ja com o preco;
 * - `ignore`: nao registra.
 */
export type ReviewDecision = "ignore" | "new" | `list:${string}` | `product:${string}`;

export type ReviewLine = ReceiptLine & {
  /** Identificador estavel da linha na revisao. */
  key: string;
  /** Linhas com o mesmo nome lido (mesmo produto repetido na comanda) andam juntas. */
  group: string;
  decision: ReviewDecision;
  /** Nota da associacao automatica (null = escolhida pelo usuario ou sem associacao). */
  score: number | null;
  /** Decisao feita pelo usuario na revisao (sempre ensina o apelido). */
  userChosen: boolean;
  /** Produto do catalogo sugerido (fora da lista), para oferecer na escolha. */
  suggestedProductId: string | null;
};

/** Unidade da comanda => unidade do catalogo. */
export function groceryUnitFromReceipt(unit: string): GroceryUnit {
  const value = unit.toUpperCase();
  if (value === "KG") return "kg";
  if (value === "G" || value === "GR") return "g";
  if (value === "L" || value === "LT") return "l";
  if (value === "ML") return "ml";
  if (value === "PC" || value === "PCT" || value === "PT") return "pct";
  return "un";
}

const isMeasure = (unit: GroceryUnit) => unit !== "un" && unit !== "pct";

/** "DETERGENTE YPE 500ML" => "Detergente Ype 500ml". */
export function suggestProductName(rawName: string): string {
  return rawName
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());
}

/** A associacao vira apelido do produto: escolhida pelo usuario ou automatica com nota alta. */
export function learnsAlias(line: Pick<ReviewLine, "userChosen" | "score">): boolean {
  return line.userChosen || (line.score ?? 0) >= CONFIDENT_MATCH;
}

type Candidate = MatchCandidate & { kind: "list" | "product" };

/**
 * Decisao inicial por associacao global: todas as notas (lista e catalogo)
 * sao ordenadas e cada candidato fica com o nome lido de maior nota (o item
 * da lista ganha no empate). Linhas repetidas (mesmo nome) vao juntas para o
 * mesmo destino. Sem nota suficiente => ignorar (o usuario decide).
 */
export function buildReviewLines(
  receipt: Pick<ParsedReceipt, "items">,
  listItems: readonly GroceryListItem[],
  products: readonly GroceryProduct[],
): ReviewLine[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const listProductIds = new Set(listItems.map((item) => item.productId));
  const candidates: Candidate[] = [
    ...listItems.map((item) => {
      const product = byId.get(item.productId);
      return {
        kind: "list" as const,
        id: item.id,
        normalizedName: product?.normalizedName ?? normalizeSearchText(item.name),
        aliases: product?.aliases ?? [],
      };
    }),
    ...products
      .filter((product) => !listProductIds.has(product.id))
      .map((product) => ({
        kind: "product" as const,
        id: product.id,
        normalizedName: product.normalizedName,
        aliases: product.aliases,
      })),
  ];

  // Grupos na ordem em que aparecem na comanda.
  const groups: Array<{ group: string; rawName: string }> = [];
  for (const line of receipt.items) {
    const group = aliasKey(line.rawName) || line.rawName;
    if (!groups.some((item) => item.group === group)) groups.push({ group, rawName: line.rawName });
  }

  const pairs = groups.flatMap((group, order) =>
    candidates
      .map((candidate) => ({ order, group: group.group, candidate, score: matchScore(group.rawName, candidate) }))
      .filter((pair) => pair.score >= MATCH_THRESHOLD),
  );
  pairs.sort(
    (left, right) =>
      right.score - left.score ||
      Number(left.candidate.kind !== "list") - Number(right.candidate.kind !== "list") ||
      left.order - right.order,
  );

  const assigned = new Map<string, { decision: ReviewDecision; score: number }>();
  const taken = new Set<string>();
  for (const pair of pairs) {
    const takenKey = `${pair.candidate.kind}:${pair.candidate.id}`;
    if (assigned.has(pair.group) || taken.has(takenKey)) continue;
    assigned.set(pair.group, { decision: takenKey as ReviewDecision, score: pair.score });
    taken.add(takenKey);
  }

  const suggested = new Map<string, string>();
  for (const pair of pairs) {
    if (pair.candidate.kind === "product" && !suggested.has(pair.group)) {
      suggested.set(pair.group, pair.candidate.id);
    }
  }

  return receipt.items.map((line, index) => {
    const group = aliasKey(line.rawName) || line.rawName;
    const match = assigned.get(group);
    return {
      ...line,
      key: `r${index}`,
      group,
      decision: match?.decision ?? "ignore",
      score: match?.score ?? null,
      userChosen: false,
      suggestedProductId: suggested.get(group) ?? null,
    };
  });
}

/** Escolha do usuario numa linha: vale para as linhas repetidas (mesmo nome lido). */
export function applyDecision(
  lines: readonly ReviewLine[],
  key: string,
  decision: ReviewDecision,
): ReviewLine[] {
  const group = lines.find((line) => line.key === key)?.group;
  return lines.map((line) =>
    line.key === key || (group !== undefined && line.group === group)
      ? { ...line, decision, score: null, userChosen: true }
      : line,
  );
}

/**
 * Preco unitario pago por item da lista: soma das linhas associadas. Com a
 * mesma unidade (ou ambas contaveis), divide pela quantidade da comanda;
 * senao (banana em KG na comanda, "6 un" na lista) divide pela quantidade da
 * lista, para o total do item bater com o pago.
 */
export function listPricesFromReview(
  lines: readonly ReviewLine[],
  listItems: readonly GroceryListItem[],
  products: readonly GroceryProduct[],
): Record<string, number> {
  const byId = new Map(products.map((product) => [product.id, product]));
  const prices: Record<string, number> = {};

  for (const item of listItems) {
    const matched = lines.filter((line) => line.decision === `list:${item.id}`);
    if (!matched.length) continue;

    const paidCents = matched.reduce((sum, line) => sum + Math.round(line.lineTotal * 100), 0);
    const receiptQuantity = matched.reduce((sum, line) => sum + line.quantity, 0);
    const receiptUnit = groceryUnitFromReceipt(matched[0].unit);
    const listUnit = byId.get(item.productId)?.unit ?? "un";
    // Mesma unidade, ou ambas contaveis (un x pct): preco pela quantidade da comanda.
    const comparable = receiptUnit === listUnit || (!isMeasure(receiptUnit) && !isMeasure(listUnit));
    const quantity = comparable ? receiptQuantity : item.quantity;

    if (quantity > 0 && paidCents > 0) {
      prices[item.id] = Math.round(paidCents / quantity) / 100;
    }
  }

  return prices;
}

/** Converte a revisao nos dados de conclusao (nomes lidos, apelidos e itens fora da lista). */
export function receiptCompletionFromReview(
  lines: readonly ReviewLine[],
  key: string | null,
  confidence: number | null,
): ReceiptCompletion {
  const rawNames: Record<string, string> = {};
  const aliases: Record<string, string> = {};
  const extras: ReceiptExtra[] = [];

  for (const line of lines) {
    if (line.decision.startsWith("list:")) {
      const itemId = line.decision.slice(5);
      rawNames[itemId] ??= line.rawName;
      if (learnsAlias(line)) aliases[itemId] ??= line.rawName;
    } else if (line.decision.startsWith("product:")) {
      extras.push({
        rawName: line.rawName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        learnAlias: learnsAlias(line),
        target: { kind: "product", productId: line.decision.slice(8) },
      });
    } else if (line.decision === "new") {
      extras.push({
        rawName: line.rawName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        learnAlias: true,
        target: {
          kind: "new",
          name: suggestProductName(line.rawName),
          unit: groceryUnitFromReceipt(line.unit),
        },
      });
    }
  }

  return { key, confidence, rawNames, aliases, extras };
}

/**
 * Campo preenchido pela leitura: so e trocado se o usuario nao mexeu nele
 * (valor atual = o que a leitura colocou, ou ainda o valor de antes).
 */
export function reconcileFilled(
  current: string,
  filled: string | undefined,
  base: string,
  next: string | undefined,
): string {
  const untouched = filled !== undefined ? current === filled : current === base;
  return untouched ? (next ?? base) : current;
}
