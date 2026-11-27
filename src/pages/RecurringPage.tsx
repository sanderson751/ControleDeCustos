import {
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { RecurringCostFields } from "@/components/recurring/RecurringCostFields";
import {
  emptyRecurringForm,
  type RecurringFormState,
  recurringFormFrom,
  toRecurringValues,
} from "@/components/recurring/recurringFormState";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { COST_TYPE_LABELS } from "@/domain/entities/cost";
import type { RecurringCost } from "@/domain/entities/recurringCost";
import { formatCompetenceShort } from "@/domain/rules/competence";
import { canMutateCosts } from "@/domain/rules/permissions";
import { validateRecurringForm } from "@/domain/rules/recurringCostRules";
import { formatCurrencyBRL } from "@/lib/currency";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import {
  createRecurringCost,
  deleteRecurringCost,
  setRecurringCostActive,
  generateRecurring,
  subscribeToRecurringCosts,
  updateRecurringCost,
} from "@/services/recurringCostService";

function generatedMessage(count: number) {
  if (count === 0) return "";
  return count === 1
    ? " 1 lançamento gerado."
    : ` ${count} lançamentos gerados.`;
}

/** Gera na hora os meses pendentes de uma recorrencia criada/editada/reativada. */
async function generateNow(userId: string, recurringId: string) {
  try {
    return { count: await generateRecurring(userId, recurringId), failed: false };
  } catch {
    return { count: 0, failed: true };
  }
}

const GENERATION_FAILED =
  " Não foi possível gerar os lançamentos agora; eles serão gerados na próxima abertura do app.";

function EditDialog({
  userId,
  recurring,
  onClose,
}: {
  userId: string;
  recurring: RecurringCost;
  onClose: () => void;
}) {
  const categories = useCategories();
  const [form, setForm] = useState<RecurringFormState>(() => recurringFormFrom(recurring));
  // Com meses ja gerados o inicio fica fixo: mudar nao recriaria nem apagaria o historico.
  const startLocked = recurring.lastGenerated !== null;
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateRecurringForm(toRecurringValues(form), new Date(), {
      originalStart: recurring.start,
    });

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    if (categories.isLoading || categories.error) {
      notify("warning", "Aguarde o carregamento das suas categorias.");
      return;
    }

    if (
      validation.values.category !== recurring.category &&
      !categories.catalog.activeIds.includes(validation.values.category)
    ) {
      notify("warning", "Selecione uma categoria ativa.");
      return;
    }

    setIsSaving(true);

    try {
      await updateRecurringCost(userId, recurring.id, validation.values);
      // Inicio levado para o passado/mes atual (sem meses gerados): gera ja.
      const generation = await generateNow(userId, recurring.id);
      notify(
        generation.failed ? "warning" : "success",
        `Recorrência atualizada. A alteração vale para os próximos meses.${
          generation.failed ? GENERATION_FAILED : generatedMessage(generation.count)
        }`,
      );
      onClose();
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao atualizar a recorrência."),
      );
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar recorrência</DialogTitle>
          <DialogDescription>
            Lançamentos já gerados não mudam; a alteração vale para os próximos meses.
          </DialogDescription>
        </DialogHeader>
        <form id="edit-recurring-form" onSubmit={handleSubmit} noValidate>
          <RecurringCostFields
            idPrefix="edit-recurring"
            value={form}
            onChange={setForm}
            disabled={isSaving}
            currentCategory={recurring.category}
            startLocked={startLocked}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="edit-recurring-form"
            isLoading={isSaving}
            loadingText="Salvando..."
          >
            Salvar
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RecurringPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const canEdit = canMutateCosts(profile.role);
  const categories = useCategories();
  const { catalog } = categories;

  const [items, setItems] = useState<RecurringCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringFormState>(() => emptyRecurringForm());
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringCost | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringCost | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);

    return subscribeToRecurringCosts(
      userId,
      (next) => {
        setItems(next);
        setLoadError(null);
        setIsLoading(false);
      },
      (error) => {
        setLoadError(
          friendlyFirestoreErrorMessage(error, "Não foi possível carregar suas recorrências."),
        );
        setIsLoading(false);
      },
    );
  }, [userId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateRecurringForm(toRecurringValues(form));

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    if (categories.isLoading || categories.error) {
      notify("warning", "Aguarde o carregamento das suas categorias.");
      return;
    }

    setIsCreating(true);

    try {
      const created = await createRecurringCost(userId, validation.values);
      const generation = await generateNow(userId, created.id);
      setForm(emptyRecurringForm());
      notify(
        generation.failed ? "warning" : "success",
        `Recorrência "${created.accountName}" criada.${
          generation.failed ? GENERATION_FAILED : generatedMessage(generation.count)
        }`,
      );
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao criar a recorrência."),
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(recurring: RecurringCost) {
    setBusyId(recurring.id);

    try {
      const updated = await setRecurringCostActive(userId, recurring, !recurring.active);

      if (!updated.active) {
        notify("success", `Recorrência "${recurring.accountName}" pausada.`);
        return;
      }

      const generation = await generateNow(userId, updated.id);
      notify(
        generation.failed ? "warning" : "success",
        `Recorrência "${recurring.accountName}" reativada a partir deste mês.${
          generation.failed ? GENERATION_FAILED : generatedMessage(generation.count)
        }`,
      );
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao atualizar a recorrência."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);

    if (!target) {
      return;
    }

    setBusyId(target.id);

    try {
      await deleteRecurringCost(userId, target.id);
      notify(
        "success",
        `Recorrência "${target.accountName}" excluída. Os lançamentos já gerados foram mantidos.`,
      );
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao excluir a recorrência."),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-10" data-testid="recurring-page-screen">
      <PageHeader
        eyebrow="Lançamentos"
        title="Recorrentes"
        description="Cadastre uma vez as contas que se repetem todo mês. O lançamento de cada mês é criado automaticamente quando você abre o app."
      />

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nova recorrência</CardTitle>
            <CardDescription>
              Se o primeiro mês já passou, os meses até o atual são lançados na hora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              aria-label="Nova recorrência"
              className="space-y-4"
              noValidate
            >
              <RecurringCostFields
                idPrefix="new-recurring"
                value={form}
                onChange={setForm}
                disabled={isCreating}
              />
              <LoadingButton
                type="submit"
                isLoading={isCreating}
                loadingText="Criando..."
                icon={<PlusIcon aria-hidden="true" />}
              >
                Adicionar recorrência
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Suas recorrências</CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="py-6 text-destructive" role="alert">
              {loadError}
            </p>
          ) : isLoading ? (
            <p className="py-6 text-muted-foreground" aria-live="polite">
              Carregando recorrências...
            </p>
          ) : items.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              Nenhuma recorrência cadastrada ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Frente</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Último gerado</TableHead>
                  <TableHead>Situação</TableHead>
                  {canEdit && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((recurring) => (
                  <TableRow key={recurring.id}>
                    <TableCell className="max-w-64">
                      <span className="font-medium">{recurring.accountName}</span>
                      {recurring.description && (
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          title={recurring.description}
                        >
                          {recurring.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(recurring.amount)}
                    </TableCell>
                    <TableCell>{catalog.labelOf(recurring.category)}</TableCell>
                    <TableCell>{COST_TYPE_LABELS[recurring.costType]}</TableCell>
                    <TableCell className="tabular-nums">{recurring.dayOfMonth}</TableCell>
                    <TableCell>{formatCompetenceShort(recurring.start)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {recurring.lastGenerated
                        ? formatCompetenceShort(recurring.lastGenerated)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={recurring.active ? "secondary" : "outline"}>
                        {recurring.active ? "Ativa" : "Pausada"}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Editar ${recurring.accountName}`}
                                onClick={() => setEditing(recurring)}
                                disabled={busyId !== null}
                              >
                                <PencilIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <LoadingButton
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`${recurring.active ? "Pausar" : "Reativar"} ${recurring.accountName}`}
                                onClick={() => void handleToggle(recurring)}
                                isLoading={busyId === recurring.id}
                                icon={recurring.active ? <PauseIcon /> : <PlayIcon />}
                                disabled={busyId !== null}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              {recurring.active ? "Pausar" : "Reativar"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Excluir ${recurring.accountName}`}
                                onClick={() => setPendingDelete(recurring)}
                                disabled={busyId !== null}
                              >
                                <Trash2Icon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditDialog userId={userId} recurring={editing} onClose={() => setEditing(null)} />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.accountName}" deixará de gerar lançamentos. Os lançamentos já gerados serão mantidos.`
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
