import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { CostFormFields } from "@/components/costs/CostFormFields";
import {
  EMPTY_COST_FORM,
  toCostFormValues,
  type CostFormState,
} from "@/components/costs/costFormState";
import { LoadingButton } from "@/components/shared/LoadingButton";
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
import type { Competence } from "@/domain/entities/cost";
import {
  defaultDateForCompetence,
  formatCompetenceLong,
} from "@/domain/rules/competence";
import { validateCostForm } from "@/domain/rules/costRules";
import { fromInputDateAtNoon, toInputDate } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { createCostEntry } from "@/services/costService";

type CostQuickAddFormProps = {
  userId: string;
  /** Competencia visualizada: fora do mes atual a data manual vem pre-ativada. */
  competence: Competence;
  isCurrentCompetence: boolean;
  disabled?: boolean;
  onCreated: () => Promise<void>;
};

/**
 * Cadastro rapido de custo. Remonte com `key` ao trocar de competencia para
 * reiniciar a data sugerida.
 */
export function CostQuickAddForm({
  userId,
  competence,
  isCurrentCompetence,
  disabled = false,
  onCreated,
}: CostQuickAddFormProps) {
  const initialDate = () =>
    toInputDate(defaultDateForCompetence(competence));

  const [form, setForm] = useState<CostFormState>(EMPTY_COST_FORM);
  const [useManualDate, setUseManualDate] = useState(!isCurrentCompetence);
  const [manualDate, setManualDate] = useState(initialDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = disabled || isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateCostForm(toCostFormValues(form));

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      await createCostEntry(userId, {
        ...validation.values,
        createdAtManual:
          useManualDate && manualDate
            ? fromInputDateAtNoon(manualDate)
            : undefined,
      });

      setForm(EMPTY_COST_FORM);
      setUseManualDate(!isCurrentCompetence);
      setManualDate(initialDate());
      notify("success", "Custo cadastrado com sucesso.");
      await onCreated();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adição rápida</CardTitle>
        <CardDescription>
          {isCurrentCompetence
            ? "Custos fixos parcelados geram um lançamento por mês de competência."
            : `Você está em ${formatCompetenceLong(competence)}: a data de criação foi sugerida dentro desse mês.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          aria-label="Adição rápida de custo"
          noValidate
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <CostFormFields
              idPrefix="cost"
              value={form}
              onChange={setForm}
              disabled={isBusy}
            />
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cost-manual-date"
                checked={useManualDate}
                onCheckedChange={(checked) => setUseManualDate(checked === true)}
                disabled={isBusy}
              />
              <Label htmlFor="cost-manual-date">Ajustar data de criação</Label>
            </div>

            {useManualDate && (
              <div className="space-y-2">
                <Label htmlFor="cost-created-at-date">Data de criação</Label>
                <Input
                  id="cost-created-at-date"
                  type="date"
                  value={manualDate}
                  onChange={(event) => setManualDate(event.target.value)}
                  disabled={isBusy}
                />
              </div>
            )}

            <LoadingButton
              type="submit"
              className="md:ml-auto"
              isLoading={isSubmitting}
              loadingText="Salvando..."
              icon={<PlusIcon aria-hidden="true" />}
              disabled={isBusy}
            >
              Adicionar custo
            </LoadingButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
