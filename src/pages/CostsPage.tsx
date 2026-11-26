import { PencilIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { describeBudgetAlert } from "@/components/budgets/budgetPresentation";
import { CostQuickAddForm } from "@/components/costs/CostQuickAddForm";
import { CostTotalsGrid } from "@/components/costs/CostTotalsGrid";
import { CostTypeBadge } from "@/components/costs/CostTypeBadge";
import { CompetencePicker } from "@/components/shared/CompetencePicker";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CategoryFilter,
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  type CostEntry,
  type CostFilter,
} from "@/domain/entities/cost";
import {
  findWorsenedBudgets,
  summarizeBudgets,
} from "@/domain/rules/budgetRules";
import { formatCompetenceLong, toCompetenceParam } from "@/domain/rules/competence";
import { calculateTotals, filterCosts, paginate } from "@/domain/rules/costRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { useCompetenceParam } from "@/hooks/useCompetenceParam";
import { useMonthBudgets } from "@/hooks/useMonthBudgets";
import { useMonthCosts } from "@/hooks/useMonthCosts";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatCompetence, formatDateBR } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";
import { deleteCostEntry } from "@/services/costService";

const COSTS_PAGE_SIZE = 10;

const TYPE_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "fixo", label: "Fixos" },
  { value: "variavel", label: "Variáveis" },
] as const;

export default function CostsPage() {
  const { profile } = useSession();
  const navigate = useNavigate();
  const userId = profile.userId;
  const canMutate = canMutateCosts(profile.role);
  const { competence, isCurrent, setCompetence } = useCompetenceParam();
  const { entries, isLoading, error, reload } = useMonthCosts(
    userId,
    competence,
  );
  const {
    limits,
    isLoading: isLoadingBudgets,
    error: budgetsError,
  } = useMonthBudgets(userId, competence);

  const [typeFilter, setTypeFilter] = useState<CostFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<CostEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      notify("error", error);
    }
  }, [error]);

  useEffect(() => {
    if (budgetsError) {
      notify(
        "warning",
        `${budgetsError} Os alertas de orçamento não serão exibidos.`,
      );
    }
  }, [budgetsError]);

  const totals = useMemo(() => calculateTotals(entries), [entries]);
  const filteredEntries = useMemo(
    () =>
      filterCosts(entries, {
        costType: typeFilter,
        category: categoryFilter,
        search,
      }),
    [categoryFilter, entries, search, typeFilter],
  );
  const pagination = paginate(filteredEntries, page, COSTS_PAGE_SIZE);

  function handleCompetenceChange(next: typeof competence) {
    setCompetence(next);
    setPage(1);
  }

  /** Recarrega e avisa quando o cadastro levou uma categoria a 80%/100% do orcamento. */
  async function handleCreated() {
    const before = summarizeBudgets(entries, limits);
    const reloaded = await reload();

    // Sem orcamentos confiaveis da competencia atual, nao ha alerta a calcular.
    if (!reloaded || isLoadingBudgets || budgetsError) {
      return;
    }

    for (const alert of findWorsenedBudgets(
      before,
      summarizeBudgets(reloaded, limits),
    )) {
      notify("warning", describeBudgetAlert(alert));
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    const entryId = pendingDelete.id;
    setPendingDelete(null);
    setDeletingId(entryId);

    try {
      await deleteCostEntry(userId, entryId);
      notify("success", "Custo removido com sucesso.");
      await reload();
    } catch (deleteError) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(
          deleteError,
          "Falha ao remover custo. Tente novamente.",
        ),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-10" data-testid="costs-page-screen">
      <PageHeader
        eyebrow={`Competência ${formatCompetence(competence.month, competence.year)}`}
        title="Custos do mês"
        description="Cadastre, filtre e acompanhe os lançamentos por competência."
        actions={
          <CompetencePicker
            competence={competence}
            isCurrent={isCurrent}
            onChange={handleCompetenceChange}
          />
        }
      />

      <CostTotalsGrid totals={totals} isLoading={isLoading} />

      {canMutate && (
        <CostQuickAddForm
          key={toCompetenceParam(competence)}
          userId={userId}
          competence={competence}
          isCurrentCompetence={isCurrent}
          disabled={deletingId !== null}
          onCreated={handleCreated}
        />
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Listagem detalhada</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SegmentedControl
              ariaLabel="Filtro de custos"
              value={typeFilter}
              options={TYPE_FILTER_OPTIONS}
              onChange={(next) => {
                setTypeFilter(next);
                setPage(1);
              }}
            />
            <div className="relative sm:w-56">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Buscar por conta ou descrição"
                placeholder="Buscar..."
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:w-52">
              <NativeSelect
                aria-label="Filtrar por categoria"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as CategoryFilter);
                  setPage(1);
                }}
              >
                <NativeSelectOption value="todas">
                  Todas as categorias
                </NativeSelectOption>
                {COST_CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {COST_CATEGORY_LABELS[category]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-muted-foreground" aria-live="polite">
              Carregando custos...
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              Nenhum custo encontrado em {formatCompetenceLong(competence)} para
              os filtros selecionados.
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Frente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data de criação</TableHead>
                    <TableHead className="text-right">Parcelas</TableHead>
                    {canMutate && (
                      <TableHead className="text-right">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-72">
                        <span className="font-medium">{entry.accountName}</span>
                        {entry.description && (
                          <span className="block truncate text-xs text-muted-foreground" title={entry.description}>
                            {entry.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{COST_CATEGORY_LABELS[entry.category]}</TableCell>
                      <TableCell>
                        <CostTypeBadge costType={entry.costType} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyBRL(entry.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateBR(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.installmentsTotal}
                      </TableCell>
                      {canMutate && (
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Editar custo"
                                  onClick={() =>
                                    navigate(ROUTES.costEdit(entry.id))
                                  }
                                  disabled={deletingId !== null}
                                >
                                  <PencilIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar custo</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <LoadingButton
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Excluir custo"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setPendingDelete(entry)}
                                  isLoading={deletingId === entry.id}
                                  icon={<Trash2Icon />}
                                  disabled={deletingId !== null}
                                />
                              </TooltipTrigger>
                              <TooltipContent>Excluir custo</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Página {pagination.currentPage} de {pagination.totalPages} (
                  {filteredEntries.length} itens)
                </p>
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label="Paginação de custos"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage(Math.max(1, pagination.currentPage - 1))
                    }
                    disabled={pagination.currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage(
                        Math.min(
                          pagination.totalPages,
                          pagination.currentPage + 1,
                        ),
                      )
                    }
                    disabled={pagination.currentPage === pagination.totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir custo?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `O lançamento "${pendingDelete.accountName}" de ${formatCurrencyBRL(pendingDelete.amount)} será removido permanentemente.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
