import { CopyIcon, SaveIcon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BudgetStatusBadge } from "@/components/budgets/BudgetStatusBadge";
import { BUDGET_STATUS_TONE } from "@/components/budgets/budgetPresentation";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BudgetLimit } from "@/domain/entities/budget";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  type Competence,
  type CostCategory,
  type CostEntry,
} from "@/domain/entities/cost";
import {
  buildBudgetDocId,
  hasBudgetChanges,
  planBudgetChanges,
  summarizeBudgets,
  validateBudgetInput,
} from "@/domain/rules/budgetRules";
import {
  formatCompetenceLong,
  shiftCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";
import { canMutateCosts } from "@/domain/rules/permissions";
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
import {
  applyBudgetChanges,
  listMonthBudgets,
} from "@/services/budgetService";

type DraftValues = Record<CostCategory, string>;

function toDraft(limits: readonly BudgetLimit[]): DraftValues {
  const byCategory = new Map(limits.map((item) => [item.category, item.limit]));

  return Object.fromEntries(
    COST_CATEGORIES.map((category) => [
      category,
      toMaskedCurrencyFromNumber(byCategory.get(category) ?? 0),
    ]),
  ) as DraftValues;
}

/** Limites validos do rascunho (para pre-visualizar o consumo antes de salvar). */
function draftToLimits(
  draft: DraftValues,
  { year, month }: Competence,
): BudgetLimit[] {
  return COST_CATEGORIES.flatMap((category) => {
    const value = parseMaskedCurrencyToNumber(draft[category]);
    return Number.isFinite(value) && value > 0
      ? [{ id: buildBudgetDocId(year, month, category), category, year, month, limit: value }]
      : [];
  });
}

type BudgetEditorProps = {
  userId: string;
  competence: Competence;
  entries: readonly CostEntry[];
  savedLimits: readonly BudgetLimit[];
  canEdit: boolean;
  onSaved: () => Promise<unknown>;
};

function BudgetEditor({
  userId,
  competence,
  entries,
  savedLimits,
  canEdit,
  onSaved,
}: BudgetEditorProps) {
  const [draft, setDraft] = useState<DraftValues>(() => toDraft(savedLimits));
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const isBusy = isSaving || isCopying;

  const summaries = useMemo(() => {
    const byCategory = new Map(
      summarizeBudgets(entries, draftToLimits(draft, competence)).map((item) => [
        item.category,
        item,
      ]),
    );
    return COST_CATEGORIES.map((category) => byCategory.get(category)!);
  }, [competence, draft, entries]);

  const totalBudget = summaries.reduce((sum, item) => sum + (item.limit ?? 0), 0);
  const spentInBudgeted = summaries.reduce(
    (sum, item) => sum + (item.limit ? item.spent : 0),
    0,
  );

  async function handleCopyPrevious() {
    const previous = shiftCompetence(competence, -1);
    setIsCopying(true);

    try {
      const previousLimits = await listMonthBudgets(userId, previous);

      if (previousLimits.length === 0) {
        notify(
          "warning",
          `Não há orçamentos definidos em ${formatCompetenceLong(previous)}.`,
        );
        return;
      }

      setDraft(toDraft(previousLimits));
      notify(
        "success",
        `Valores copiados de ${formatCompetenceLong(previous)}. Revise e salve.`,
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
    const desired: Partial<Record<CostCategory, number | null>> = {};

    for (const category of COST_CATEGORIES) {
      const validation = validateBudgetInput(
        parseMaskedCurrencyToNumber(draft[category]),
      );

      if (!validation.ok) {
        notify(
          "warning",
          `${COST_CATEGORY_LABELS[category]}: ${validation.message}`,
        );
        return;
      }

      desired[category] = validation.value;
    }

    const plan = planBudgetChanges(savedLimits, desired);

    if (!hasBudgetChanges(plan)) {
      notify("warning", "Nenhuma alteração para salvar.");
      return;
    }

    setIsSaving(true);

    try {
      await applyBudgetChanges(userId, competence, plan);
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
              orçadas {formatCurrencyBRL(spentInBudgeted)}. Deixe em branco para
              não definir limite.
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
                <TableHead className="w-48">Orçamento</TableHead>
                <TableHead className="w-56">Consumo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => {
                const label = COST_CATEGORY_LABELS[summary.category];
                const inputId = `budget-${summary.category}`;

                return (
                  <TableRow key={summary.category}>
                    <TableCell className="font-medium">
                      {canEdit ? <label htmlFor={inputId}>{label}</label> : label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(summary.spent)}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Input
                          id={inputId}
                          inputMode="numeric"
                          placeholder="Sem limite"
                          className="tabular-nums"
                          value={draft[summary.category]}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [summary.category]: maskCurrencyInput(
                                event.target.value,
                              ),
                            }))
                          }
                          disabled={isBusy}
                        />
                      ) : (
                        <span className="tabular-nums">
                          {summary.limit ? formatCurrencyBRL(summary.limit) : "—"}
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

  useEffect(() => {
    if (loadError) {
      notify("error", loadError);
    }
  }, [loadError]);

  // Remonta o editor quando a competencia ou os limites salvos mudam.
  const editorKey = `${toCompetenceParam(competence)}|${budgets.limits
    .map((item) => `${item.category}:${item.limit}`)
    .join(",")}`;

  return (
    <section className="space-y-10" data-testid="budgets-page-screen">
      <PageHeader
        eyebrow={`Competência ${formatCompetence(competence.month, competence.year)}`}
        title="Orçamentos"
        description="Defina quanto pode gastar em cada categoria. Alertamos ao atingir 80% e ao estourar 100%."
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
          savedLimits={budgets.limits}
          canEdit={canEdit}
          onSaved={budgets.reload}
        />
      )}
    </section>
  );
}
