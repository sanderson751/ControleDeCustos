import { ChartColumnIcon, TableIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EvolutionTable } from "@/components/evolution/EvolutionTable";
import { MonthlyEvolutionChart } from "@/components/evolution/MonthlyEvolutionChart";
import { CompetencePicker } from "@/components/shared/CompetencePicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  type CategoryFilter,
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  type CostFilter,
} from "@/domain/entities/cost";
import {
  formatCompetenceLong,
  formatCompetenceShort,
} from "@/domain/rules/competence";
import {
  buildMonthlyEvolution,
  EVOLUTION_PERIODS,
  type EvolutionPeriod,
  summarizeEvolution,
} from "@/domain/rules/evolutionRules";
import { useCompetenceParam } from "@/hooks/useCompetenceParam";
import { useEvolutionData } from "@/hooks/useEvolutionData";
import { formatCurrencyBRL } from "@/lib/currency";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";

const PERIOD_OPTIONS = EVOLUTION_PERIODS.map((months) => ({
  value: String(months) as `${EvolutionPeriod}`,
  label: `${months} meses`,
}));

const TYPE_OPTIONS = [
  { value: "todos", label: "Todas" },
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
] as const;

const PERCENT = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export default function EvolutionPage() {
  const { profile } = useSession();
  const { competence, isCurrent, setCompetence } = useCompetenceParam();
  const [period, setPeriod] = useState<EvolutionPeriod>(6);
  const [category, setCategory] = useState<CategoryFilter>("todas");
  const [costType, setCostType] = useState<CostFilter>("todos");
  const [view, setView] = useState<"chart" | "table">("chart");
  const { data, isLoading, error } = useEvolutionData(
    profile.userId,
    competence,
    period,
  );

  useEffect(() => {
    if (error) {
      notify("error", error);
    }
  }, [error]);

  const showBudget = costType === "todos";
  const points = useMemo(
    () =>
      buildMonthlyEvolution({
        entries: data.entries,
        monthLimits: data.monthLimits,
        recurring: data.recurring,
        competences: data.competences,
        category,
        costType,
      }),
    [category, costType, data],
  );
  const summary = useMemo(() => summarizeEvolution(points), [points]);
  const hasData = points.length > 0;
  const isFirstLoad = isLoading && !hasData;
  // Sem dados validos (carregando pela 1a vez ou falha): indicadores em "—", nunca zeros.
  const ready = hasData && !error;
  const show = (value: string) => (ready ? value : "—");
  const subject =
    category === "todas" ? "todas as categorias" : COST_CATEGORY_LABELS[category];

  return (
    <section className="space-y-10" data-testid="evolution-page-screen">
      <PageHeader
        eyebrow="Análise"
        title="Evolução mensal"
        description="Acompanhe o gasto mês a mês e compare com o orçamento efetivo de cada mês."
      />

      {/* Filtros: uma unica linha acima de todo o conteudo que eles afetam */}
      <div
        className="flex flex-wrap items-start gap-x-6 gap-y-4"
        role="group"
        aria-label="Filtros da evolução"
      >
        <div className="space-y-2">
          <p className="text-sm leading-none font-medium">Até</p>
          <CompetencePicker
            competence={competence}
            isCurrent={isCurrent}
            onChange={setCompetence}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm leading-none font-medium">Período</p>
          <SegmentedControl
            ariaLabel="Período"
            value={String(period) as `${EvolutionPeriod}`}
            options={PERIOD_OPTIONS}
            onChange={(next) => setPeriod(Number(next) as EvolutionPeriod)}
          />
        </div>
        <div className="w-52 space-y-2">
          <label
            htmlFor="evolution-category"
            className="block text-sm leading-none font-medium"
          >
            Categoria
          </label>
          <NativeSelect
            id="evolution-category"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as CategoryFilter)
            }
          >
            <NativeSelectOption value="todas">Todas</NativeSelectOption>
            {COST_CATEGORIES.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {COST_CATEGORY_LABELS[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <p className="text-sm leading-none font-medium">Frente</p>
          <SegmentedControl
            ariaLabel="Frente"
            value={costType}
            options={TYPE_OPTIONS}
            onChange={setCostType}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Média mensal"
          value={show(formatCurrencyBRL(summary.average))}
          hint={`${period} meses`}
        />
        <StatTile
          label="Maior gasto"
          value={show(summary.peak ? formatCurrencyBRL(summary.peak.spent) : "—")}
          hint={
            summary.peak
              ? formatCompetenceShort(summary.peak.competence)
              : "Sem lançamentos"
          }
        />
        <StatTile
          label="Último mês"
          value={
            !ready || summary.lastChange === null
              ? "—"
              : PERCENT.format(summary.lastChange)
          }
          hint="em relação ao mês anterior"
        />
        <StatTile
          label="Acima do orçamento"
          value={showBudget ? show(String(summary.monthsOverBudget)) : "—"}
          hint={
            showBudget
              ? `de ${summary.monthsWithBudget} ${summary.monthsWithBudget === 1 ? "mês" : "meses"} com orçamento`
              : "indisponível com filtro de frente"
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Gasto x orçamento por mês</CardTitle>
            <CardDescription>
              {`${subject}, até ${formatCompetenceLong(competence)}.`}
              {!showBudget &&
                " Orçamentos são definidos por categoria, não por frente: a linha de orçamento fica oculta com o filtro de frente."}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setView((current) => (current === "chart" ? "table" : "chart"))
            }
            aria-pressed={view === "table"}
          >
            {view === "chart" ? (
              <TableIcon aria-hidden="true" />
            ) : (
              <ChartColumnIcon aria-hidden="true" />
            )}
            {view === "chart" ? "Ver tabela" : "Ver gráfico"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legenda: retangulo = colunas de gasto; traco = linha de orcamento */}
          <ul
            className="flex flex-wrap gap-4 text-sm text-muted-foreground"
            aria-label="Legenda"
          >
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-[3px] bg-chart-spent" aria-hidden="true" />
              Gasto
            </li>
            {showBudget && (
              <li className="flex items-center gap-2">
                <span className="h-0.5 w-4 rounded bg-chart-budget" aria-hidden="true" />
                Orçamento
              </li>
            )}
          </ul>

          {isFirstLoad ? (
            <p className="py-10 text-muted-foreground" aria-live="polite">
              Carregando evolução...
            </p>
          ) : error ? (
            <p className="py-10 text-muted-foreground" role="alert">
              {error} Os valores não estão disponíveis no momento.
            </p>
          ) : view === "chart" ? (
            <MonthlyEvolutionChart
              points={points}
              showBudget={showBudget}
              isRefreshing={isLoading}
            />
          ) : (
            <EvolutionTable points={points} showBudget={showBudget} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
