import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { Competence } from "@/domain/entities/cost";
import {
  getCurrentCompetence,
  isSameCompetence,
  parseCompetenceParam,
  toCompetenceParam,
} from "@/domain/rules/competence";

export const COMPETENCE_PARAM = "mes";

/**
 * Competencia visualizada guardada na URL (`?mes=AAAA-MM`), para manter o mes
 * ao navegar e permitir links diretos. Sem parametro = mes atual.
 */
export function useCompetenceParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawParam = searchParams.get(COMPETENCE_PARAM);

  const competence = useMemo<Competence>(
    () => parseCompetenceParam(rawParam) ?? getCurrentCompetence(),
    [rawParam],
  );
  const isCurrent = isSameCompetence(competence, getCurrentCompetence());

  const setCompetence = useCallback(
    (next: Competence) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);

          if (isSameCompetence(next, getCurrentCompetence())) {
            params.delete(COMPETENCE_PARAM);
          } else {
            params.set(COMPETENCE_PARAM, toCompetenceParam(next));
          }

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { competence, isCurrent, setCompetence };
}
