import { useCallback } from "react";
import type { Competence } from "@/domain/entities/cost";
import { useCompetenceResource } from "@/hooks/useCompetenceResource";
import {
  type EvolutionData,
  loadEvolutionData,
} from "@/services/evolutionService";

const EMPTY_EVOLUTION: EvolutionData = {
  competences: [],
  entries: [],
  monthLimits: [],
  recurring: [],
};

/** Dados da evolucao terminando em `end`, com protecao contra corridas. */
export function useEvolutionData(
  userId: string,
  end: Competence,
  months: number,
) {
  const fetcher = useCallback(
    (uid: string, competence: Competence) =>
      loadEvolutionData(uid, competence, months),
    [months],
  );

  return useCompetenceResource<EvolutionData>(
    userId,
    end,
    fetcher,
    "Não foi possível carregar a evolução mensal.",
    EMPTY_EVOLUTION,
    String(months),
  );
}
