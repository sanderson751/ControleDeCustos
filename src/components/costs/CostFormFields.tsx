import type { CostFormState } from "@/components/costs/costFormState";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  type CostCategory,
} from "@/domain/entities/cost";
import { MAX_INSTALLMENTS } from "@/domain/rules/costRules";
import { maskCurrencyInput } from "@/lib/currency";

const COST_TYPE_OPTIONS = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
] as const;

type CostFormFieldsProps = {
  idPrefix: string;
  value: CostFormState;
  onChange: (next: CostFormState) => void;
  disabled?: boolean;
};

/** Campos compartilhados entre cadastro rapido e edicao de custo. */
export function CostFormFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: CostFormFieldsProps) {
  const update = (patch: Partial<CostFormState>) =>
    onChange({ ...value, ...patch });

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-account-name`}>Conta</Label>
        <Input
          id={`${idPrefix}-account-name`}
          value={value.accountName}
          onChange={(event) => update({ accountName: event.target.value })}
          placeholder="Ex.: Aluguel"
          autoComplete="off"
          disabled={disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-amount`}>Valor</Label>
        <Input
          id={`${idPrefix}-amount`}
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={value.amount}
          onChange={(event) =>
            update({ amount: maskCurrencyInput(event.target.value) })
          }
          className="tabular-nums"
          disabled={disabled}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Categoria</Label>
        <NativeSelect
          id={`${idPrefix}-category`}
          value={value.category}
          onChange={(event) =>
            update({ category: event.target.value as CostCategory | "" })
          }
          disabled={disabled}
          required
        >
          <NativeSelectOption value="" disabled>
            Selecione
          </NativeSelectOption>
          {COST_CATEGORIES.map((category) => (
            <NativeSelectOption key={category} value={category}>
              {COST_CATEGORY_LABELS[category]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <p className="text-sm leading-none font-medium">Frente</p>
        <SegmentedControl
          ariaLabel="Frente do custo"
          value={value.costType}
          options={COST_TYPE_OPTIONS}
          onChange={(costType) => update({ costType })}
          disabled={disabled}
        />
      </div>

      {value.costType === "fixo" && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-installments-total`}>Parcelas</Label>
          <Input
            id={`${idPrefix}-installments-total`}
            type="number"
            min={1}
            max={MAX_INSTALLMENTS}
            step={1}
            value={value.installmentsTotal}
            onChange={(event) =>
              update({ installmentsTotal: event.target.value })
            }
            disabled={disabled}
            required
          />
        </div>
      )}
    </>
  );
}
