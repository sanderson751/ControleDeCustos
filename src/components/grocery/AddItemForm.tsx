import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  GROCERY_UNIT_LABELS,
  GROCERY_UNITS,
  type GroceryProduct,
  type GroceryUnit,
  MAX_PRODUCT_NAME_LENGTH,
} from "@/domain/entities/grocery";
import { normalizeSearchText } from "@/domain/rules/costRules";
import {
  parseQuantityInput,
  searchProducts,
  validateProductName,
  validateQuantity,
} from "@/domain/rules/groceryRules";
import { formatCurrencyBRL } from "@/lib/currency";
import { notify } from "@/lib/notify";

type Props = {
  products: readonly GroceryProduct[];
  disabled?: boolean;
  /** Inclui o produto (existente ou recem-criado) com a quantidade na lista. */
  onAdd: (input: {
    product: GroceryProduct | null;
    newProduct: { name: string; unit: GroceryUnit } | null;
    quantity: number;
  }) => Promise<boolean>;
};

/** Escolha do produto no catalogo pessoal (ou criacao de um novo) + quantidade. */
export function AddItemForm({ products, disabled, onAdd }: Props) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<GroceryProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<GroceryUnit>("un");
  const [isSaving, setIsSaving] = useState(false);

  const exact =
    selected ??
    products.find((product) => product.normalizedName === normalizeSearchText(term)) ??
    null;
  const suggestions = exact ? [] : searchProducts(products, term);
  const isNew = term.trim() !== "" && !exact;

  function choose(product: GroceryProduct) {
    setSelected(product);
    setTerm(product.name);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const effectiveUnit = exact?.unit ?? unit;
    const quantityCheck = validateQuantity(
      parseQuantityInput(quantity, effectiveUnit) ?? Number.NaN,
      effectiveUnit,
    );

    if (!term.trim()) {
      notify("warning", "Informe o produto.");
      return;
    }

    if (!quantityCheck.ok) {
      notify("warning", quantityCheck.message);
      return;
    }

    let newProduct: { name: string; unit: GroceryUnit } | null = null;

    if (!exact) {
      const nameCheck = validateProductName(term, products);
      if (!nameCheck.ok) {
        notify("warning", nameCheck.message);
        return;
      }
      newProduct = { name: nameCheck.value, unit };
    }

    setIsSaving(true);
    const added = await onAdd({ product: exact, newProduct, quantity: quantityCheck.value });
    setIsSaving(false);

    if (added) {
      setTerm("");
      setSelected(null);
      setQuantity("1");
      setUnit("un");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Adicionar item"
      className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="grocery-product">Produto</Label>
        <Input
          id="grocery-product"
          value={term}
          maxLength={MAX_PRODUCT_NAME_LENGTH}
          placeholder="Ex.: Arroz 5kg, Café, Leite"
          autoComplete="off"
          onChange={(event) => {
            setTerm(event.target.value);
            setSelected(null);
          }}
          disabled={disabled || isSaving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grocery-quantity">Quantidade</Label>
        <Input
          id="grocery-quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={disabled || isSaving}
        />
      </div>
      <LoadingButton
        type="submit"
        isLoading={isSaving}
        loadingText="Adicionando..."
        icon={<PlusIcon aria-hidden="true" />}
        disabled={disabled}
      >
        Adicionar
      </LoadingButton>

      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2 sm:col-span-3" aria-label="Produtos do seu catálogo">
          {suggestions.map((product) => (
            <li key={product.id}>
              <Button type="button" size="sm" variant="outline" onClick={() => choose(product)}>
                {product.name}
                <span className="text-muted-foreground">
                  {product.lastUnitPrice !== null
                    ? ` · ${formatCurrencyBRL(product.lastUnitPrice)}`
                    : " · sem histórico"}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {isNew && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
          <span>{`Produto novo no seu catálogo, unidade:`}</span>
          <NativeSelect
            aria-label="Unidade do produto novo"
            size="sm"
            className="w-36"
            value={unit}
            onChange={(event) => setUnit(event.target.value as GroceryUnit)}
            disabled={disabled || isSaving}
          >
            {GROCERY_UNITS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {GROCERY_UNIT_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
    </form>
  );
}
