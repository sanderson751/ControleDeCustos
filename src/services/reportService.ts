import {
  getDocs,
  orderBy,
  query,
  type QueryConstraint,
  Timestamp,
  where,
} from "firebase/firestore";
import type { CostEntry, CostFilter } from "@/domain/entities/cost";
import { parseDateRange } from "@/lib/dates";
import { toCostEntry } from "@/services/converters";
import { costEntriesCollectionRef } from "@/services/firestorePaths";

export type ReportsFilter = {
  /** AAAA-MM-DD */
  startDate: string;
  /** AAAA-MM-DD */
  endDate: string;
  costType: CostFilter;
};

export class InvalidDateRangeError extends Error {
  constructor() {
    super("Intervalo de datas inválido.");
    this.name = "InvalidDateRangeError";
  }
}

/**
 * Lista os lancamentos por data de criacao (inclusive) e frente opcional.
 * Indice composto necessario: costType ASC + createdAt DESC (firestore.indexes.json).
 */
export async function listCostsForReport(
  userId: string,
  filter: ReportsFilter,
): Promise<CostEntry[]> {
  const range = parseDateRange(filter.startDate, filter.endDate);

  if (!range) {
    throw new InvalidDateRangeError();
  }

  const constraints: QueryConstraint[] = [
    where("createdAt", ">=", Timestamp.fromDate(range.startDate)),
    where("createdAt", "<=", Timestamp.fromDate(range.endDate)),
  ];

  if (filter.costType !== "todos") {
    constraints.push(where("costType", "==", filter.costType));
  }

  constraints.push(orderBy("createdAt", "desc"));

  const snapshot = await getDocs(
    query(costEntriesCollectionRef(userId), ...constraints),
  );

  return snapshot.docs.map((docSnapshot) =>
    toCostEntry(docSnapshot.id, docSnapshot.data()),
  );
}
