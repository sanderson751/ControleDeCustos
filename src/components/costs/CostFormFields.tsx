import type { CostFormState } from "@/components/costs/costFormState";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  type CostCategory,
  MAX_DESCRIPTION_LENGTH,
} from "@/domain/entities/cost";
import { selectableCategories } from "@/domain/rules/categoryRules";
import { MAX_INSTALLMENTS } from "@/domain/rules/costRules";
import { maskCurrencyInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useCategories } from "@/providers/CategoriesProvider";

const COST_TYPE_OPTIONS = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
] as const;

type CostFormFieldsProps = {
  idPrefix: string;
  value: CostFormState;
  onChange: (next: CostFormState) => void;
  disabled?: boolean;
  /** Edicao: mantem a categoria atual mesmo arquivada. */
  keepArchivedCategory?: boolean;
};

/** Campos compartilhados entre cadastro rapido e edicao de custo. */
export function CostFormFields({
  idPrefix,
  value,
  onChange,
  disabled,
  keepArchivedCategory = false,
}: CostFormFieldsProps) {
  const { catalog } = useCategories();
  // Ativas + a categoria atual, mesmo arquivada (edicao de lancamento antigo).
  const categoryOptions = selectableCategories(
    catalog,
    keepArchivedCategory ? value.category || undefined : undefined,
  );
  // Categoria fora das opcoes (arquivada no cadastro, desconhecida) exige nova escolha.
  const selectedCategory = categoryOptions.some(
    (option) => option.id === value.category,
  )
    ? value.category
    : "";
  // Conta o texto aparado: e o mesmo valor validado, gravado e medido pelas regras.
  const descriptionLength = value.description.trim().length;
  const isDescriptionTooLong = descriptionLength > MAX_DESCRIPTION_LENGTH;
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
          value={selectedCategory}
          onChange={(event) =>
            update({ category: event.target.value as CostCategory | "" })
          }
          disabled={disabled}
          required
        >
          <NativeSelectOption value="" disabled>
            Selecione
          </NativeSelectOption>
          {categoryOptions.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.archived ? `${option.label} (arquivada)` : option.label}
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

      <div className="space-y-2 md:col-span-full">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${idPrefix}-description`}>Descrição (opcional)</Label>
          <span
            id={`${idPrefix}-description-count`}
            className={cn(
              "text-xs tabular-nums",
              isDescriptionTooLong
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {`${descriptionLength}/${MAX_DESCRIPTION_LENGTH}`}
            {isDescriptionTooLong && " · acima do limite"}
          </span>
        </div>
        <Textarea
          id={`${idPrefix}-description`}
          value={value.description}
          onChange={(event) => update({ description: event.target.value })}
          placeholder="Ex.: presente de aniversário, parcela do notebook..."
          rows={2}
          aria-describedby={`${idPrefix}-description-count`}
          aria-invalid={isDescriptionTooLong || undefined}
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
