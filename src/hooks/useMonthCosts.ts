import { useCallback, useEffect, useState } from "react";
import type { CostEntry } from "@/domain/entities/cost";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { listMonthCosts } from "@/services/costService";

export function getCurrentCompetence(now: Date = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

type UseMonthCostsResult = {
  entries: CostEntry[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/** Carrega os custos de uma competencia e expoe `reload` para apos escritas. */
export function useMonthCosts(
  userId: string,
  year: number,
  month: number,
): UseMonthCostsResult {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);

    try {
      setEntries(await listMonthCosts(userId, year, month));
      setError(null);
    } catch (loadError) {
      setError(
        friendlyFirestoreErrorMessage(
          loadError,
          "Não foi possível carregar os custos do mês corrente.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [month, userId, year]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, isLoading, error, reload };
}
