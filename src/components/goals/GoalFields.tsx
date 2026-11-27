import type { GoalFormState } from "@/components/goals/goalFormState";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { MAX_GOAL_NAME_LENGTH } from "@/domain/entities/savingsGoal";
import { maskCurrencyInput } from "@/lib/currency";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
/** Anos oferecidos para o prazo (a partir do atual). */
const DEADLINE_YEARS = 11;

type Props = {
  idPrefix: string;
  value: GoalFormState;
  onChange: (next: GoalFormState) => void;
  disabled?: boolean;
  now?: Date;
  /** Edicao: ano do prazo salvo continua na lista mesmo vencido. */
  originalYear?: number;
};

/** Campos da meta (criacao e edicao). */
export function GoalFields({
  idPrefix,
  value,
  onChange,
  disabled,
  now = new Date(),
  originalYear,
}: Props) {
  const update = (patch: Partial<GoalFormState>) => onChange({ ...value, ...patch });
  const currentYear = now.getFullYear();
  const years = [
    ...new Set([
      ...Array.from({ length: DEADLINE_YEARS }, (_, index) => currentYear + index),
      Number(value.deadlineYear),
      ...(originalYear ? [originalYear] : []),
    ]),
  ]
    .filter((year) => Number.isInteger(year) && year > 0)
    .sort();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Nome da meta</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          maxLength={MAX_GOAL_NAME_LENGTH}
          placeholder="Ex.: Reserva de emergência, Viagem"
          onChange={(event) => update({ name: event.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-target`}>Valor-alvo</Label>
        <Input
          id={`${idPrefix}-target`}
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={value.target}
          onChange={(event) => update({ target: maskCurrencyInput(event.target.value) })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-has-deadline`}
            checked={value.hasDeadline}
            onCheckedChange={(checked) => update({ hasDeadline: checked === true })}
            disabled={disabled}
          />
          <Label htmlFor={`${idPrefix}-has-deadline`}>Definir prazo</Label>
        </div>
        {value.hasDeadline && (
          <div className="grid max-w-sm grid-cols-[3fr_2fr] gap-2">
            <NativeSelect
              aria-label="Mês do prazo"
              value={value.deadlineMonth}
              onChange={(event) => update({ deadlineMonth: event.target.value })}
              disabled={disabled}
            >
              {MONTH_LABELS.map((label, index) => (
                <NativeSelectOption key={label} value={String(index + 1)}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Ano do prazo"
              value={value.deadlineYear}
              onChange={(event) => update({ deadlineYear: event.target.value })}
              disabled={disabled}
            >
              {years.map((year) => (
                <NativeSelectOption key={year} value={String(year)}>
                  {year}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>
    </div>
  );
}
