import { type FormEvent, useState } from "react";
import {
  type ContributionFormState,
  emptyContributionForm,
  toContributionValues,
} from "@/components/goals/goalFormState";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ContributionKind,
  type GoalSummary,
  MAX_CONTRIBUTION_NOTE_LENGTH,
} from "@/domain/entities/savingsGoal";
import { signedAmount, validateContribution } from "@/domain/rules/savingsGoalRules";
import { formatCurrencyBRL, maskCurrencyInput } from "@/lib/currency";
import { toInputDate } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { addContribution } from "@/services/savingsGoalService";

const KIND_OPTIONS = [
  { value: "deposito", label: "Depósito" },
  { value: "retirada", label: "Retirada" },
] as const;

type Props = {
  userId: string;
  summary: GoalSummary;
  initialKind: ContributionKind;
  onClose: () => void;
};

/** Registra deposito ou retirada em uma meta. */
export function ContributionDialog({ userId, summary, initialKind, onClose }: Props) {
  const [form, setForm] = useState<ContributionFormState>(() =>
    emptyContributionForm(initialKind),
  );
  const [isSaving, setIsSaving] = useState(false);
  const update = (patch: Partial<ContributionFormState>) => setForm((current) => ({ ...current, ...patch }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateContribution(toContributionValues(form), summary.saved);

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsSaving(true);

    try {
      const { values } = validation;
      await addContribution(userId, {
        goalId: summary.goal.id,
        amount: signedAmount(values),
        date: values.date,
        note: values.note,
      });
      notify(
        "success",
        values.kind === "deposito"
          ? `Depósito de ${formatCurrencyBRL(values.amount)} registrado em "${summary.goal.name}".`
          : `Retirada de ${formatCurrencyBRL(values.amount)} registrada em "${summary.goal.name}".`,
      );
      onClose();
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao registrar a movimentação."),
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Movimentar "${summary.goal.name}"`}</DialogTitle>
          <DialogDescription>
            {`Guardado até agora: ${formatCurrencyBRL(summary.saved)}.`}
          </DialogDescription>
        </DialogHeader>
        <form id="contribution-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <SegmentedControl
            ariaLabel="Tipo de movimentação"
            value={form.kind}
            options={KIND_OPTIONS}
            onChange={(kind) => update({ kind })}
            disabled={isSaving}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contribution-amount">Valor</Label>
              <Input
                id="contribution-amount"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={form.amount}
                onChange={(event) => update({ amount: maskCurrencyInput(event.target.value) })}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contribution-date">Data</Label>
              <Input
                id="contribution-date"
                type="date"
                max={toInputDate(new Date())}
                value={form.date}
                onChange={(event) => update({ date: event.target.value })}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contribution-note">Observação (opcional)</Label>
            <Input
              id="contribution-note"
              value={form.note}
              maxLength={MAX_CONTRIBUTION_NOTE_LENGTH}
              onChange={(event) => update({ note: event.target.value })}
              disabled={isSaving}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="contribution-form"
            isLoading={isSaving}
            loadingText="Salvando..."
          >
            Registrar
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
