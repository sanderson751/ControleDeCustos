import { StatTile } from "@/components/shared/StatTile";
import type { CostTotals } from "@/domain/entities/cost";
import { formatCurrencyBRL } from "@/lib/currency";

type CostTotalsGridProps = {
  totals: CostTotals;
  isLoading?: boolean;
  labels?: Partial<Record<keyof CostTotals, string>>;
  hints?: Partial<Record<keyof CostTotals, string>>;
};

const DEFAULT_LABELS: Record<keyof CostTotals, string> = {
  total: "Total no mês",
  fixedTotal: "Custos fixos",
  variableTotal: "Custos variáveis",
};

/** Tres indicadores (total, fixos, variaveis) nos tiles cromaticos do tema. */
export function CostTotalsGrid({
  totals,
  isLoading = false,
  labels,
  hints,
}: CostTotalsGridProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const format = (value: number) =>
    isLoading ? "Carregando..." : formatCurrencyBRL(value);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <StatTile
        tone="iris"
        label={mergedLabels.total}
        value={format(totals.total)}
        hint={hints?.total}
      />
      <StatTile
        tone="periwinkle"
        label={mergedLabels.fixedTotal}
        value={format(totals.fixedTotal)}
        hint={hints?.fixedTotal}
      />
      <StatTile
        tone="orchid"
        label={mergedLabels.variableTotal}
        value={format(totals.variableTotal)}
        hint={hints?.variableTotal}
      />
    </div>
  );
}
