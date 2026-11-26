import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CostFormFields } from "@/components/costs/CostFormFields";
import {
  EMPTY_COST_FORM,
  toCostFormValues,
  type CostFormState,
} from "@/components/costs/costFormState";
import { CostTotalsGrid } from "@/components/costs/CostTotalsGrid";
import { CostTypeBadge } from "@/components/costs/CostTypeBadge";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { CostEntry, CostFilter } from "@/domain/entities/cost";
import {
  calculateTotals,
  filterByCostType,
  paginate,
  validateCostForm,
} from "@/domain/rules/costRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { getCurrentCompetence, useMonthCosts } from "@/hooks/useMonthCosts";
import { formatCurrencyBRL } from "@/lib/currency";
import {
  formatCompetence,
  formatDateBR,
  fromInputDateAtNoon,
  toInputDate,
} from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";
import { createCostEntry, deleteCostEntry } from "@/services/costService";

const COSTS_PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "fixo", label: "Fixos" },
  { value: "variavel", label: "Variáveis" },
] as const;

export default function CostsPage() {
  const { profile } = useSession();
  const navigate = useNavigate();
  const userId = profile.userId;
  const canMutate = canMutateCosts(profile.role);
  const { year, month } = useMemo(() => getCurrentCompetence(), []);
  const { entries, isLoading, error, reload } = useMonthCosts(
    userId,
    year,
    month,
  );

  const [form, setForm] = useState<CostFormState>(EMPTY_COST_FORM);
  const [useManualDate, setUseManualDate] = useState(false);
  const [manualDate, setManualDate] = useState(() => toInputDate(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<CostFilter>("todos");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<CostEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isMutating = isSubmitting || deletingId !== null;

  useEffect(() => {
    if (error) {
      notify("error", error);
    }
  }, [error]);

  const totals = useMemo(() => calculateTotals(entries), [entries]);
  const filteredEntries = useMemo(
    () => filterByCostType(entries, filter),
    [entries, filter],
  );
  const pagination = paginate(filteredEntries, page, COSTS_PAGE_SIZE);

  function handleFilterChange(nextFilter: CostFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canMutate) {
      return;
    }

    const values = toCostFormValues(form);
    const validation = validateCostForm(values);

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      await createCostEntry(userId, {
        ...values,
        createdAtManual:
          useManualDate && manualDate
            ? fromInputDateAtNoon(manualDate)
            : undefined,
      });

      setForm(EMPTY_COST_FORM);
      setUseManualDate(false);
      setManualDate(toInputDate(new Date()));
      notify("success", "Custo cadastrado com sucesso.");
      await reload();
    } catch (submitError) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(
          submitError,
          "Falha ao cadastrar custo. Tente novamente.",
        ),
      );
    } finally {
      setIsSubmitting(false);
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
        eyebrow={`Competência ${formatCompetence(month, year)}`}
        title="Custos do mês"
        description="Cadastre, filtre e acompanhe os lançamentos da competência atual."
      />

      <CostTotalsGrid totals={totals} isLoading={isLoading} />

      {canMutate && (
        <Card>
          <CardHeader>
            <CardTitle>
              Adição rápida
            </CardTitle>
            <CardDescription>
              Custos fixos parcelados geram um lançamento por mês de competência.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              aria-label="Adição rápida de custo"
              noValidate
            >
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                <CostFormFields
                  idPrefix="cost"
                  value={form}
                  onChange={setForm}
                  disabled={isMutating}
                />
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cost-manual-date"
                    checked={useManualDate}
                    onCheckedChange={(checked) =>
                      setUseManualDate(checked === true)
                    }
                    disabled={isMutating}
                  />
                  <Label htmlFor="cost-manual-date">
                    Ajustar data de criação
                  </Label>
                </div>

                {useManualDate && (
                  <div className="space-y-2">
                    <Label htmlFor="cost-created-at-date">Data de criação</Label>
                    <Input
                      id="cost-created-at-date"
                      type="date"
                      value={manualDate}
                      onChange={(event) => setManualDate(event.target.value)}
                      disabled={isMutating}
                    />
                  </div>
                )}

                <LoadingButton
                  type="submit"
                  className="md:ml-auto"
                  isLoading={isSubmitting}
                  loadingText="Salvando..."
                  icon={<PlusIcon aria-hidden="true" />}
                  disabled={isMutating}
                >
                  Adicionar custo
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>
            Listagem detalhada
          </CardTitle>
          <SegmentedControl
            ariaLabel="Filtro de custos"
            value={filter}
            options={FILTER_OPTIONS}
            onChange={handleFilterChange}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-muted-foreground" aria-live="polite">
              Carregando custos...
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              Nenhum custo encontrado para o filtro selecionado.
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
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
                      <TableCell className="font-medium">
                        {entry.accountName}
                      </TableCell>
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
                                  disabled={isMutating}
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
                                  disabled={isMutating}
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
