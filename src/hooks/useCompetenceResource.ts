import { useCallback, useEffect, useRef, useState } from "react";
import type { Competence } from "@/domain/entities/cost";
import { toCompetenceParam } from "@/domain/rules/competence";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";

export type CompetenceResource<T> = {
  data: T[];
  isLoading: boolean;
  error: string | null;
  /** Recarrega e devolve os dados atualizados (null em falha ou se obsoleto). */
  reload: () => Promise<T[] | null>;
};

/**
 * Carrega uma lista por usuario + competencia, protegido contra corridas:
 * - respostas fora de ordem (troca rapida de mes) sao descartadas;
 * - `reload` de uma competencia antiga (closure obsoleta) nao altera o estado;
 * - os dados sao limpos ao trocar de competencia (nunca exibe o mes anterior).
 */
export function useCompetenceResource<T>(
  userId: string,
  competence: Competence,
  fetcher: (userId: string, competence: Competence) => Promise<T[]>,
  fallbackErrorMessage: string,
): CompetenceResource<T> {
  const { year, month } = competence;
  const key = `${userId}|${toCompetenceParam({ year, month })}`;
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (activeKeyRef.current !== key) {
      return null;
    }

    const requestId = ++requestIdRef.current;
    const isLatest = () =>
      requestId === requestIdRef.current && activeKeyRef.current === key;

    setIsLoading(true);

    try {
      const loaded = await fetcher(userId, { year, month });

      if (!isLatest()) {
        return null;
      }

      setData(loaded);
      setError(null);
      return loaded;
    } catch (loadError) {
      if (isLatest()) {
        setError(friendlyFirestoreErrorMessage(loadError, fallbackErrorMessage));
      }
      return null;
    } finally {
      if (isLatest()) {
        setIsLoading(false);
      }
    }
  }, [fallbackErrorMessage, fetcher, key, month, userId, year]);

  useEffect(() => {
    if (activeKeyRef.current !== key) {
      activeKeyRef.current = key;
      setData([]);
      setError(null);
    }

    void reload();
  }, [key, reload]);

  return { data, isLoading, error, reload };
}
