import type { RecurringFormState } from "@/components/recurring/recurringFormState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  COST_TYPE_LABELS,
  type CostCategory,
  type CostType,
  MAX_DESCRIPTION_LENGTH,
} from "@/domain/entities/cost";
import {
  MAX_RECURRING_DAY,
  START_WINDOW_MONTHS,
} from "@/domain/entities/recurringCost";
import { MAX_ACCOUNT_NAME_LENGTH } from "@/domain/entities/statementImport";
import { selectableCategories } from "@/domain/rules/categoryRules";
import { maskCurrencyInput } from "@/lib/currency";
import { useCategories } from "@/providers/CategoriesProvider";

type Props = {
  idPrefix: string;
  value: RecurringFormState;
  onChange: (next: RecurringFormState) => void;
  disabled?: boolean;
  /** Edicao: mantem a categoria atual mesmo arquivada. */
  currentCategory?: CostCategory;
  /** Edicao com meses ja gerados: o inicio nao pode mudar. */
  startLocked?: boolean;
  /** Data de referencia da janela de inicio (testes). */
  now?: Date;
};

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

/** Campos compartilhados entre a criacao e a edicao de recorrencias. */
export function RecurringCostFields({
  idPrefix,
  value,
  onChange,
  disabled,
  currentCategory,
  startLocked = false,
  now = new Date(),
}: Props) {
  const { catalog } = useCategories();
  const options = selectableCategories(catalog, currentCategory);
  const selectedCategory = options.some((option) => option.id === value.category)
    ? value.category
    : "";
  const update = (patch: Partial<RecurringFormState>) => onChange({ ...value, ...patch });
  const [startYear = "", startMonth = "01"] = value.start.split("-");
  const currentIndex = now.getFullYear() * 12 + now.getMonth();
  const inWindow = (year: number, month: number) =>
    Math.abs(year * 12 + (month - 1) - currentIndex) <= START_WINDOW_MONTHS;
  // Janela de inicio (+-12 meses): ano anterior, atual e seguinte; preserva o salvo.
  const yearOptions = [
    ...new Set([
      now.getFullYear() - 1,
      now.getFullYear(),
      now.getFullYear() + 1,
      Number(startYear),
    ]),
  ]
    .filter((year) => Number.isInteger(year) && year > 0)
    .sort()
    .map(String);
  const monthOptions = MONTH_LABELS.map((label, index) => ({
    label,
    value: String(index + 1).padStart(2, "0"),
  })).filter(
    (option) =>
      startLocked ||
      option.value === startMonth ||
      inWindow(Number(startYear), Number(option.value)),
  );
  /** Primeiro mes da janela dentro do ano escolhido (ao trocar de ano). */
  const firstMonthInWindow = (year: number) => {
    const month = Array.from({ length: 12 }, (_, index) => index + 1).find((candidate) =>
      inWindow(year, candidate),
    );
    return String(month ?? 1).padStart(2, "0");
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor={`${idPrefix}-account`}>Conta</Label>
        <Input
          id={`${idPrefix}-account`}
          value={value.accountName}
          maxLength={MAX_ACCOUNT_NAME_LENGTH}
          placeholder="Ex.: Aluguel, Internet, Academia"
          onChange={(event) => update({ accountName: event.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-amount`}>Valor</Label>
        <Input
          id={`${idPrefix}-amount`}
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={value.amount}
          onChange={(event) => update({ amount: maskCurrencyInput(event.target.value) })}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Categoria</Label>
        <NativeSelect
          id={`${idPrefix}-category`}
          value={selectedCategory}
          onChange={(event) => update({ category: event.target.value })}
          disabled={disabled}
        >
          <NativeSelectOption value="" disabled>
            Selecione
          </NativeSelectOption>
          {options.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.archived ? `${option.label} (arquivada)` : option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-cost-type`}>Frente</Label>
        <NativeSelect
          id={`${idPrefix}-cost-type`}
          value={value.costType}
          onChange={(event) => update({ costType: event.target.value as CostType })}
          disabled={disabled}
        >
          {(Object.keys(COST_TYPE_LABELS) as CostType[]).map((type) => (
            <NativeSelectOption key={type} value={type}>
              {COST_TYPE_LABELS[type]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-day`}>Dia do mês</Label>
        <Input
          id={`${idPrefix}-day`}
          type="number"
          min={1}
          max={MAX_RECURRING_DAY}
          value={value.dayOfMonth}
          onChange={(event) => update({ dayOfMonth: event.target.value })}
          aria-describedby={`${idPrefix}-day-hint`}
          disabled={disabled}
        />
        <p id={`${idPrefix}-day-hint`} className="text-xs text-muted-foreground">
          {`De 1 a ${MAX_RECURRING_DAY}.`}
        </p>
      </div>
      {/* Mes e ano em selects: input type="month" nao existe no Firefox/Safari desktop. */}
      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">Primeiro mês</legend>
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <NativeSelect
            aria-label="Mês do primeiro lançamento"
            value={startMonth}
            onChange={(event) => update({ start: `${startYear}-${event.target.value}` })}
            disabled={disabled || startLocked}
            aria-describedby={startLocked ? `${idPrefix}-start-hint` : undefined}
          >
            {monthOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Ano do primeiro lançamento"
            value={startYear}
            onChange={(event) => {
              const year = Number(event.target.value);
              const month = inWindow(year, Number(startMonth))
                ? startMonth
                : firstMonthInWindow(year);
              update({ start: `${event.target.value}-${month}` });
            }}
            disabled={disabled || startLocked}
            aria-describedby={startLocked ? `${idPrefix}-start-hint` : undefined}
          >
            {yearOptions.map((year) => (
              <NativeSelectOption key={year} value={year}>
                {year}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {startLocked && (
          <p id={`${idPrefix}-start-hint`} className="text-xs text-muted-foreground">
            O primeiro mês não muda depois que há lançamentos gerados.
          </p>
        )}
      </fieldset>
      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
        <Label htmlFor={`${idPrefix}-description`}>Descrição (opcional)</Label>
        <Input
          id={`${idPrefix}-description`}
          value={value.description}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(event) => update({ description: event.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
