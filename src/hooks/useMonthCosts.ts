import type { Competence, CostEntry } from "@/domain/entities/cost";
import { useCompetenceResource } from "@/hooks/useCompetenceResource";
import { useRecurringSyncVersion } from "@/providers/RecurringSyncContext";
import { listMonthCosts } from "@/services/costService";

const NO_ENTRIES: CostEntry[] = [];

const fetchMonthCosts = (userId: string, { year, month }: Competence) =>
  listMonthCosts(userId, year, month);

/**
 * Custos de uma competencia; `reload` para atualizar apos escritas. Recarrega
 * quando a geracao de recorrentes cria lancamentos com a tela aberta.
 */
export function useMonthCosts(userId: string, competence: Competence) {
  const recurringVersion = useRecurringSyncVersion();
  const { data, ...rest } = useCompetenceResource<CostEntry[]>(
    userId,
    competence,
    fetchMonthCosts,
    "Não foi possível carregar os custos do mês.",
    NO_ENTRIES,
    `recorrentes-${recurringVersion}`,
  );

  return { entries: data, ...rest };
}
