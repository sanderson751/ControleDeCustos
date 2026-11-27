import { doc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { NewCostInput } from "@/domain/entities/cost";
import { type ChunkedWrite, commitInChunks } from "@/services/batchChunks";
import { costEntriesCollectionRef } from "@/services/firestorePaths";

/** Falha no meio da importacao: `imported` lancamentos ja foram gravados. */
export class ImportPartialError extends Error {
  constructor(
    readonly imported: number,
    readonly cause: unknown,
  ) {
    super(`Importação interrompida após ${imported} lançamento(s).`);
    this.name = "ImportPartialError";
  }
}

/**
 * Grava os lancamentos importados (1 parcela cada, data da transacao) em
 * lotes compativeis com os limites das regras. Retorna a quantidade gravada.
 */
export async function importCostEntries(
  userId: string,
  inputs: readonly NewCostInput[],
): Promise<number> {
  const collectionRef = costEntriesCollectionRef(userId);
  const operations: ChunkedWrite[] = inputs.map((input) => ({
    category: input.category,
    write: (batch) => {
      const createdAt = input.createdAtManual ?? new Date();
      batch.set(doc(collectionRef), {
        userId,
        accountName: input.accountName.trim(),
        amount: Number(input.amount),
        costType: input.costType,
        category: input.category,
        description: (input.description ?? "").trim(),
        installmentsTotal: 1,
        competenceYear: createdAt.getFullYear(),
        competenceMonth: createdAt.getMonth() + 1,
        createdAt: Timestamp.fromDate(createdAt),
        updatedAt: serverTimestamp(),
      });
    },
  }));
  let imported = 0;

  try {
    await commitInChunks(operations, (committed) => {
      imported = committed;
    });
  } catch (error) {
    if (imported > 0) {
      throw new ImportPartialError(imported, error);
    }
    throw error;
  }

  return imported;
}
