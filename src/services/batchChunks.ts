import { type WriteBatch, writeBatch } from "firebase/firestore";
import type { CostCategory } from "@/domain/entities/cost";
import { isDefaultCategory } from "@/domain/rules/categoryRules";
import { db } from "@/lib/firebase";

export type ChunkedWrite = {
  /** Categoria gravada (personalizadas custam um exists() nas regras). */
  category?: CostCategory;
  write: (batch: WriteBatch) => void;
};

/**
 * Cada categoria personalizada distinta custa um acesso a documento nas
 * regras, e uma requisicao admite poucos acessos. Padrao nao consomem acesso.
 */
export const MAX_CUSTOM_CATEGORIES_PER_BATCH = 10;
/** Margem abaixo do limite de 500 operacoes por batch do Firestore. */
export const MAX_OPERATIONS_PER_BATCH = 400;

/** Agrupa operacoes em lotes respeitando os dois limites, mantendo a ordem. */
export function planChunks<T extends { category?: CostCategory }>(
  operations: readonly T[],
): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let customs = new Set<CostCategory>();

  for (const operation of operations) {
    const category = operation.category;
    const isCustom = category !== undefined && !isDefaultCategory(category);
    const isNewCustom = isCustom && !customs.has(category);

    if (
      current.length >= MAX_OPERATIONS_PER_BATCH ||
      (isNewCustom && customs.size >= MAX_CUSTOM_CATEGORIES_PER_BATCH)
    ) {
      chunks.push(current);
      current = [];
      customs = new Set();
    }

    if (isCustom) {
      customs.add(category);
    }
    current.push(operation);
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Grava em lotes sequenciais (atomico quando cabe em um lote). Informa o total
 * de operacoes ja confirmadas apos cada lote, para reportar falha parcial.
 */
export async function commitInChunks(
  operations: readonly ChunkedWrite[],
  onCommitted?: (committedOperations: number) => void,
): Promise<void> {
  let committed = 0;

  for (const chunk of planChunks(operations)) {
    const batch = writeBatch(db);
    chunk.forEach((operation) => operation.write(batch));
    await batch.commit();
    committed += chunk.length;
    onCommitted?.(committed);
  }
}
