import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ContributionDialog } from "@/components/goals/ContributionDialog";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalFields } from "@/components/goals/GoalFields";
import {
  emptyGoalForm,
  type GoalFormState,
  goalFormFrom,
  toGoalValues,
} from "@/components/goals/goalFormState";
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
import type {
  ContributionKind,
  GoalContribution,
  GoalSummary,
  SavingsGoal,
} from "@/domain/entities/savingsGoal";
import { canMutateCosts } from "@/domain/rules/permissions";
import {
  validateContributionDeletion,
  validateGoalForm,
} from "@/domain/rules/savingsGoalRules";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatDateBR } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import {
  createGoal,
  deleteContribution,
  deleteGoal,
  updateGoal,
} from "@/services/savingsGoalService";

function EditGoalDialog({
  userId,
  goal,
  goals,
  onClose,
}: {
  userId: string;
  goal: SavingsGoal;
  goals: readonly SavingsGoal[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<GoalFormState>(() => goalFormFrom(goal));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateGoalForm(toGoalValues(form), goals, new Date(), {
      editingId: goal.id,
      originalDeadline: goal.deadline,
    });

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsSaving(true);

    try {
      await updateGoal(userId, goal.id, validation.values);
      notify("success", `Meta "${validation.values.name}" atualizada.`);
      onClose();
    } catch (error) {
      notify("error", friendlyFirestoreErrorMessage(error, "Falha ao atualizar a meta."));
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar meta</DialogTitle>
          <DialogDescription>As movimentações já registradas não mudam.</DialogDescription>
        </DialogHeader>
        <form id="edit-goal-form" onSubmit={handleSubmit} noValidate>
          <GoalFields
            idPrefix="edit-goal"
            value={form}
            onChange={setForm}
            disabled={isSaving}
            originalYear={goal.deadline?.year}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="edit-goal-form"
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

function HistoryDialog({
  summary,
  contributions,
  canEdit,
  onDelete,
  onClose,
}: {
  summary: GoalSummary;
  contributions: readonly GoalContribution[];
  canEdit: boolean;
  onDelete: (contribution: GoalContribution) => void;
  onClose: () => void;
}) {
  const items = contributions.filter((item) => item.goalId === summary.goal.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{`Histórico de "${summary.goal.name}"`}</DialogTitle>
          <DialogDescription>
            {`Guardado: ${formatCurrencyBRL(summary.saved)} de ${formatCurrencyBRL(summary.goal.targetAmount)}.`}
          </DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="py-4 text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto" aria-label="Movimentações">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">
                    {item.amount >= 0 ? "Depósito" : "Retirada"}{" "}
                    {formatCurrencyBRL(Math.abs(item.amount))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateBR(item.date)}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Excluir movimentação de ${formatDateBR(item.date)} (${formatCurrencyBRL(Math.abs(item.amount))})`}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ContributionTarget = { goalId: string; kind: ContributionKind };

export default function GoalsPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const canEdit = canMutateCosts(profile.role);
  const { goals, contributions, summaries, isLoading, error } = useSavingsGoals(userId);

  const [form, setForm] = useState<GoalFormState>(() => emptyGoalForm());
  const [isCreating, setIsCreating] = useState(false);
  const [contributionTarget, setContributionTarget] = useState<ContributionTarget | null>(null);
  const [historyGoalId, setHistoryGoalId] = useState<string | null>(null);
  // Dialogos guardam so o id: os dados vem sempre da assinatura em tempo real.
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [pendingGoalDeleteId, setPendingGoalDeleteId] = useState<string | null>(null);
  const [pendingContributionDelete, setPendingContributionDelete] =
    useState<GoalContribution | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialogos usam o resumo atual (tempo real), nao uma copia antiga.
  const summaryOf = (goalId: string | null | undefined) =>
    summaries.find((item) => item.goal.id === goalId) ?? null;
  const contributionSummary = summaryOf(contributionTarget?.goalId);
  const historySummary = summaryOf(historyGoalId);
  const editingGoal = goals.find((goal) => goal.id === editingGoalId) ?? null;
  const pendingGoalDelete = goals.find((goal) => goal.id === pendingGoalDeleteId) ?? null;

  // Meta excluida em outra aba/dispositivo: fecha o que estiver aberto e avisa.
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const exists = (id: string | null | undefined) =>
      !id || goals.some((goal) => goal.id === id);
    const openIds = [contributionTarget?.goalId, historyGoalId, editingGoalId, pendingGoalDeleteId];

    if (openIds.every(exists)) {
      return;
    }

    setContributionTarget((current) => (exists(current?.goalId) ? current : null));
    setHistoryGoalId((current) => (exists(current) ? current : null));
    setEditingGoalId((current) => (exists(current) ? current : null));
    setPendingGoalDeleteId((current) => (exists(current) ? current : null));
    notify("warning", "A meta foi excluída em outro dispositivo.");
  }, [contributionTarget, editingGoalId, goals, historyGoalId, isLoading, pendingGoalDeleteId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateGoalForm(toGoalValues(form), goals);

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsCreating(true);

    try {
      await createGoal(userId, validation.values);
      setForm(emptyGoalForm());
      notify("success", `Meta "${validation.values.name}" criada.`);
    } catch (createError) {
      notify("error", friendlyFirestoreErrorMessage(createError, "Falha ao criar a meta."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleConfirmGoalDelete() {
    const target = pendingGoalDelete;
    setPendingGoalDeleteId(null);
    if (!target) return;

    setIsDeleting(true);

    try {
      await deleteGoal(userId, target.id, contributions);
      notify("success", `Meta "${target.name}" excluída.`);
    } catch (deleteError) {
      notify("error", friendlyFirestoreErrorMessage(deleteError, "Falha ao excluir a meta."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleConfirmContributionDelete() {
    const target = pendingContributionDelete;
    setPendingContributionDelete(null);
    if (!target) return;

    const check = validateContributionDeletion(target, contributions);
    if (!check.ok) {
      notify("warning", check.message);
      return;
    }

    try {
      await deleteContribution(userId, target.id);
      notify("success", "Movimentação excluída.");
    } catch (deleteError) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(deleteError, "Falha ao excluir a movimentação."),
      );
    }
  }

  const contributionsCount = pendingGoalDelete
    ? contributions.filter((item) => item.goalId === pendingGoalDelete.id).length
    : 0;

  return (
    <section className="space-y-10" data-testid="goals-page-screen">
      <PageHeader
        eyebrow="Planejamento"
        title="Metas de economia"
        description="Defina objetivos, registre quanto guardou e veja quanto separar por mês para chegar lá no prazo."
      />

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nova meta</CardTitle>
            <CardDescription>
              Com prazo, mostramos quanto guardar por mês para atingir o valor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} aria-label="Nova meta" className="space-y-4" noValidate>
              <GoalFields idPrefix="new-goal" value={form} onChange={setForm} disabled={isCreating} />
              <LoadingButton
                type="submit"
                isLoading={isCreating}
                loadingText="Criando..."
                icon={<PlusIcon aria-hidden="true" />}
              >
                Criar meta
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
      )}

      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : isLoading ? (
        <p className="text-muted-foreground" aria-live="polite">
          Carregando metas...
        </p>
      ) : summaries.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma meta criada ainda.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {summaries.map((summary) => (
            <GoalCard
              key={summary.goal.id}
              summary={summary}
              canEdit={canEdit}
              disabled={isDeleting}
              onDeposit={() => setContributionTarget({ goalId: summary.goal.id, kind: "deposito" })}
              onWithdraw={() => setContributionTarget({ goalId: summary.goal.id, kind: "retirada" })}
              onHistory={() => setHistoryGoalId(summary.goal.id)}
              onEdit={() => setEditingGoalId(summary.goal.id)}
              onDelete={() => setPendingGoalDeleteId(summary.goal.id)}
            />
          ))}
        </div>
      )}

      {contributionTarget && contributionSummary && (
        <ContributionDialog
          userId={userId}
          summary={contributionSummary}
          initialKind={contributionTarget.kind}
          onClose={() => setContributionTarget(null)}
        />
      )}

      {historySummary && (
        <HistoryDialog
          summary={historySummary}
          contributions={contributions}
          canEdit={canEdit}
          onDelete={setPendingContributionDelete}
          onClose={() => setHistoryGoalId(null)}
        />
      )}

      {editingGoal && (
        <EditGoalDialog
          userId={userId}
          goal={editingGoal}
          goals={goals}
          onClose={() => setEditingGoalId(null)}
        />
      )}

      <AlertDialog
        open={pendingGoalDelete !== null}
        onOpenChange={(open) => !open && setPendingGoalDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingGoalDelete
                ? `"${pendingGoalDelete.name}" e ${contributionsCount === 1 ? "1 movimentação" : `${contributionsCount} movimentações`} serão removidas permanentemente.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmGoalDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingContributionDelete !== null}
        onOpenChange={(open) => !open && setPendingContributionDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingContributionDelete
                ? pendingContributionDelete.amount >= 0
                  ? `Depósito de ${formatCurrencyBRL(pendingContributionDelete.amount)} em ${formatDateBR(pendingContributionDelete.date)} será removido.`
                  : `Retirada de ${formatCurrencyBRL(Math.abs(pendingContributionDelete.amount))} em ${formatDateBR(pendingContributionDelete.date)} será removida.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmContributionDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
