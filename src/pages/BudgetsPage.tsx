import { CopyIcon, SaveIcon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BudgetStatusBadge } from "@/components/budgets/BudgetStatusBadge";
import {
  BUDGET_STATUS_TONE,
  describeDraftOrigin,
} from "@/components/budgets/budgetPresentation";
import { CompetencePicker } from "@/components/shared/CompetencePicker";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BUDGET_MODE_LABELS,
  type BudgetLimit,
  type BudgetMode,
  type EffectiveBudget,
  type MonthBudgetState,
} from "@/domain/entities/budget";
import {
  type Competence,
  type CostCategory,
  type CostEntry,
} from "@/domain/entities/cost";
import {
  buildBudgetDocId,
  summarizeBudgets,
  validateBudgetInput,
} from "@/domain/rules/budgetRules";
import {
  formatCompetenceLong,
  shiftCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";
import { compareCategoryOrder } from "@/domain/rules/costRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import {
  defaultBudgetMode,
  futureRecurringFor,
  type DesiredBudget,
  hasMonthBudgetChanges,
  planMonthBudgetChanges,
  resolveRecurringFor,
} from "@/domain/rules/recurringBudgetRules";
import { useCompetenceParam } from "@/hooks/useCompetenceParam";
import { useMonthBudgets } from "@/hooks/useMonthBudgets";
import { useMonthCosts } from "@/hooks/useMonthCosts";
import {
  formatCurrencyBRL,
  maskCurrencyInput,
  parseMaskedCurrencyToNumber,
  toMaskedCurrencyFromNumber,
} from "@/lib/currency";
import { formatCompetence } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import {
  applyMonthBudgetChanges,
  loadMonthBudgetState,
} from "@/services/budgetService";

type CategoryRecord<T> = Record<CostCategory, T>;

function byCategory<T>(
  ids: readonly CostCategory[],
  build: (category: CostCategory) => T,
): CategoryRecord<T> {
  return Object.fromEntries(ids.map((category) => [category, build(category)]));
}

function valuesFrom(
  effective: readonly EffectiveBudget[],
  ids: readonly CostCategory[],
): CategoryRecord<string> {
  const limits = new Map(effective.map((item) => [item.category, item.limit]));
  return byCategory(ids, (category) =>
    toMaskedCurrencyFromNumber(limits.get(category) ?? 0),
  );
}

/** Limites validos do rascunho (pre-visualizacao do consumo antes de salvar). */
function draftToLimits(
  values: CategoryRecord<string>,
  { year, month }: Competence,
): BudgetLimit[] {
  return Object.keys(values).flatMap((category) => {
    const limit = parseMaskedCurrencyToNumber(values[category]);
    return Number.isFinite(limit) && limit > 0
      ? [{ id: buildBudgetDocId(year, month, category), category, year, month, limit }]
      : [];
  });
}

type BudgetEditorProps = {
  userId: string;
  competence: Competence;
  entries: readonly CostEntry[];
  state: MonthBudgetState;
  /** Linhas da tabela: categorias ativas + arquivadas com gasto/orcamento no mes. */
  categoryIds: readonly CostCategory[];
  labelOf: (id: CostCategory) => string;
  canEdit: boolean;
  onSaved: () => Promise<unknown>;
};

function BudgetEditor({
  userId,
  competence,
  entries,
  state,
  categoryIds,
  labelOf,
  canEdit,
  onSaved,
}: BudgetEditorProps) {
  // Rascunho guarda apenas o que o usuario alterou; as demais linhas usam o
  // valor salvo. Assim categorias novas (outra aba/catalogo carregado depois)
  // entram na tabela sem descartar o que ja foi digitado.
  const [draftValues, setValues] = useState<Partial<CategoryRecord<string>>>({});
  const [draftModes, setModes] = useState<Partial<CategoryRecord<BudgetMode>>>({});
  const values = useMemo(() => {
    const saved = valuesFrom(state.effective, categoryIds);
    return byCategory(
      categoryIds,
      (category) => draftValues[category] ?? saved[category],
    );
  }, [categoryIds, draftValues, state.effective]);
  const modes = useMemo(
    () =>
      byCategory(
        categoryIds,
        (category) => draftModes[category] ?? defaultBudgetMode(category, state),
      ),
    [categoryIds, draftModes, state],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const isBusy = isSaving || isCopying;

  const recurringContext = useMemo(
    () =>
      byCategory(categoryIds, (category) => ({
        active: resolveRecurringFor(state.recurring, category, competence),
        future: futureRecurringFor(state.recurring, category, competence),
      })),
    [categoryIds, competence, state.recurring],
  );

  const summaries = useMemo(() => {
    const summaryMap = new Map(
      summarizeBudgets(
        entries,
        draftToLimits(values, competence),
        categoryIds,
      ).map((item) => [item.category, item]),
    );
    return categoryIds.map((category) => summaryMap.get(category)!);
  }, [categoryIds, competence, entries, values]);

  const totalBudget = summaries.reduce((sum, item) => sum + (item.limit ?? 0), 0);
  const spentInBudgeted = summaries.reduce(
    (sum, item) => sum + (item.limit ? item.spent : 0),
    0,
  );

  async function handleCopyPrevious() {
    const previous = shiftCompetence(competence, -1);
    setIsCopying(true);

    try {
      const previousState = await loadMonthBudgetState(userId, previous);

      if (previousState.effective.length === 0) {
        notify(
          "warning",
          `Não há orçamentos definidos em ${formatCompetenceLong(previous)}.`,
        );
        return;
      }

      // Categorias em "Este mes em diante" ja sao governadas pela recorrencia:
      // a copia nao as altera (evita encerrar/mudar a recorrencia sem querer).
      const copied = valuesFrom(previousState.effective, categoryIds);
      const keptRecurring = categoryIds.filter(
        (category) => modes[category] === "recorrente",
      );
      setValues(
        byCategory(categoryIds, (category) =>
          modes[category] === "recorrente" ? values[category] : copied[category],
        ),
      );
      notify(
        "success",
        `Valores copiados de ${formatCompetenceLong(previous)}. Revise e salve.${
          keptRecurring.length
            ? ` Categorias recorrentes mantidas: ${keptRecurring
                .map((category) => labelOf(category))
                .join(", ")}.`
            : ""
        }`,
      );
    } catch (copyError) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(
          copyError,
          "Não foi possível copiar os orçamentos do mês anterior.",
        ),
      );
    } finally {
      setIsCopying(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const desired: Partial<CategoryRecord<DesiredBudget>> = {};

    for (const category of categoryIds) {
      const validation = validateBudgetInput(
        parseMaskedCurrencyToNumber(values[category]),
      );

      if (!validation.ok) {
        notify(
          "warning",
          `${labelOf(category)}: ${validation.message}`,
        );
        return;
      }

      desired[category] = { value: validation.value, mode: modes[category] };
    }

    const plan = planMonthBudgetChanges(state, competence, desired);

    if (plan.ignored.length) {
      notify(
        "warning",
        `${plan.ignored
          .map((category) => labelOf(category))
          .join(", ")}: o orçamento recorrente não pode ser removido só neste mês. Use "Este mês em diante" para encerrá-lo.`,
      );
    }

    if (!hasMonthBudgetChanges(plan)) {
      if (!plan.ignored.length) {
        notify("warning", "Nenhuma alteração para salvar.");
      }
      return;
    }

    setIsSaving(true);

    try {
      await applyMonthBudgetChanges(userId, competence, plan);
      notify("success", "Orçamentos salvos com sucesso.");
      await onSaved();
    } catch (saveError) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(
          saveError,
          "Falha ao salvar orçamentos. Tente novamente.",
        ),
      );
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Orçamentos por categoria" noValidate>
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Limites por categoria</CardTitle>
            <CardDescription>
              Orçado {formatCurrencyBRL(totalBudget)} · gasto nas categorias
              orçadas {formatCurrencyBRL(spentInBudgeted)}. Use "Este mês em
              diante" para repetir o limite nos próximos meses.
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <LoadingButton
                type="button"
                variant="outline"
                onClick={() => void handleCopyPrevious()}
                isLoading={isCopying}
                loadingText="Copiando..."
                icon={<CopyIcon aria-hidden="true" />}
                disabled={isBusy}
              >
                Copiar do mês anterior
              </LoadingButton>
              <LoadingButton
                type="submit"
                isLoading={isSaving}
                loadingText="Salvando..."
                icon={<SaveIcon aria-hidden="true" />}
                disabled={isBusy}
              >
                Salvar orçamentos
              </LoadingButton>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Gasto no mês</TableHead>
                <TableHead className="w-44">Orçamento</TableHead>
                <TableHead className="min-w-52">Aplicação</TableHead>
                <TableHead className="w-48">Consumo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => {
                const category = summary.category;
                const label = labelOf(category);
                const inputId = `budget-${category}`;
                const draftValue = parseMaskedCurrencyToNumber(values[category]);
                const origin = describeDraftOrigin({
                  mode: modes[category],
                  value: Number.isFinite(draftValue) && draftValue > 0 ? draftValue : null,
                  ...recurringContext[category],
                  competence,
                });

                return (
                  <TableRow key={category}>
                    <TableCell className="font-medium">
                      {canEdit ? <label htmlFor={inputId}>{label}</label> : label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(summary.spent)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {canEdit ? (
                          <Input
                            id={inputId}
                            inputMode="numeric"
                            placeholder="Sem limite"
                            className="tabular-nums"
                            value={values[category]}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                [category]: maskCurrencyInput(event.target.value),
                              }))
                            }
                            disabled={isBusy}
                          />
                        ) : (
                          <span className="tabular-nums">
                            {summary.limit ? formatCurrencyBRL(summary.limit) : "—"}
                          </span>
                        )}
                        {origin && (
                          <p className="text-xs text-muted-foreground">{origin}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <NativeSelect
                          aria-label={`Aplicação do orçamento de ${label}`}
                          className="min-w-52"
                          value={modes[category]}
                          onChange={(event) =>
                            setModes((current) => ({
                              ...current,
                              [category]: event.target.value as BudgetMode,
                            }))
                          }
                          disabled={isBusy}
                        >
                          <NativeSelectOption value="mensal">
                            {BUDGET_MODE_LABELS.mensal}
                          </NativeSelectOption>
                          <NativeSelectOption value="recorrente">
                            {BUDGET_MODE_LABELS.recorrente}
                          </NativeSelectOption>
                        </NativeSelect>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {summary.limit ? BUDGET_MODE_LABELS[modes[category]] : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {summary.limit ? (
                        <div className="space-y-1">
                          <Progress
                            value={summary.percent ?? 0}
                            aria-label={`${label}: ${summary.percent}% do orçamento`}
                            indicatorClassName={BUDGET_STATUS_TONE[summary.status].bar}
                          />
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {summary.percent}% ·{" "}
                            {(summary.remaining ?? 0) >= 0
                              ? `restam ${formatCurrencyBRL(summary.remaining ?? 0)}`
                              : `excedeu ${formatCurrencyBRL(Math.abs(summary.remaining ?? 0))}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BudgetStatusBadge status={summary.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </form>
  );
}

export default function BudgetsPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const canEdit = canMutateCosts(profile.role);
  const { competence, isCurrent, setCompetence } = useCompetenceParam();
  const costs = useMonthCosts(userId, competence);
  const budgets = useMonthBudgets(userId, competence);
  const isLoading = costs.isLoading || budgets.isLoading;
  const loadError = costs.error ?? budgets.error;
  const { catalog } = useCategories();
  // Linhas: categorias ativas + arquivadas que tenham gasto ou orcamento no mes.
  const categoryIds = useMemo(() => {
    const inUse = new Set<CostCategory>([
      ...costs.entries.map((entry) => entry.category),
      ...budgets.state.effective.map((item) => item.category),
    ]);
    const known = new Set(catalog.ids);
    // Ids em uso fora do catalogo (carregando/falha/removidos) tambem aparecem,
    // para o total do mes bater com o Inicio.
    const unknown = [...inUse]
      .filter((id) => !known.has(id))
      .sort(compareCategoryOrder);
    return [
      ...catalog.ids.filter(
        (id) => catalog.activeIds.includes(id) || inUse.has(id),
      ),
      ...unknown,
    ];
  }, [budgets.state.effective, catalog, costs.entries]);

  useEffect(() => {
    if (loadError) {
      notify("error", loadError);
    }
  }, [loadError]);

  // Remonta o editor quando a competencia ou os orcamentos salvos mudam.
  const editorKey = [
    toCompetenceParam(competence),
    ...budgets.state.monthLimits.map((item) => `${item.id}:${item.limit}`),
    ...budgets.state.recurring.map((item) => `${item.id}:${item.limit}`),
  ].join("|");

  return (
    <section className="space-y-10" data-testid="budgets-page-screen">
      <PageHeader
        eyebrow={`Competência ${formatCompetence(competence.month, competence.year)}`}
        title="Orçamentos"
        description="Defina quanto pode gastar em cada categoria — só neste mês ou deste mês em diante. Alertamos ao atingir 80% e ao estourar 100%."
        actions={
          <CompetencePicker
            competence={competence}
            isCurrent={isCurrent}
            onChange={setCompetence}
          />
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground" aria-live="polite">
          Carregando orçamentos...
        </p>
      ) : (
        <BudgetEditor
          key={editorKey}
          userId={userId}
          competence={competence}
          entries={costs.entries}
          state={budgets.state}
          categoryIds={categoryIds}
          labelOf={catalog.labelOf}
          canEdit={canEdit}
          onSaved={budgets.reload}
        />
      )}
    </section>
  );
}
