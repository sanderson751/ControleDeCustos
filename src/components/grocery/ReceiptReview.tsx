import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { GroceryListItem, GroceryProduct } from "@/domain/entities/grocery";
import { formatQuantity } from "@/domain/rules/groceryRules";
import { learnsAlias, type ReviewDecision, type ReviewLine } from "@/domain/rules/receiptReview";
import { formatCurrencyBRL } from "@/lib/currency";

type Props = {
  lines: readonly ReviewLine[];
  listItems: readonly GroceryListItem[];
  products: readonly GroceryProduct[];
  disabled?: boolean;
  onChange: (key: string, decision: ReviewDecision) => void;
};

/** Itens lidos na comanda e o destino de cada um (lista, catalogo, novo ou ignorar). */
export function ReceiptReview({ lines, listItems, products, disabled, onChange }: Props) {
  const byId = new Map(products.map((product) => [product.id, product]));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Itens lidos na comanda</legend>
      <p className="text-xs text-muted-foreground">
        Os preços vão para a próxima lista. Itens fora da lista podem entrar no seu catálogo.
      </p>
      <ul className="divide-y rounded-lg border" aria-label="Itens lidos na comanda">
        {lines.map((line) => {
          const productOption =
            line.decision.startsWith("product:") ? line.decision.slice(8) : line.suggestedProductId;
          return (
            <li key={line.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{line.rawName}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {`${formatQuantity(line.quantity)} ${line.unit.toLowerCase()} × ${formatCurrencyBRL(line.unitPrice)} = ${formatCurrencyBRL(line.lineTotal)}`}
                  {!learnsAlias(line) && line.score !== null && " · sugestão automática, confira"}
                </p>
              </div>
              <NativeSelect
                aria-label={`Destino de ${line.rawName}`}
                size="sm"
                className="w-56"
                value={line.decision}
                onChange={(event) => onChange(line.key, event.target.value as ReviewDecision)}
                disabled={disabled}
              >
                <NativeSelectOption value="ignore">Ignorar</NativeSelectOption>
                {listItems.map((item) => (
                  <NativeSelectOption key={item.id} value={`list:${item.id}`}>
                    {`Lista: ${item.name}`}
                  </NativeSelectOption>
                ))}
                {productOption && byId.get(productOption) && (
                  <NativeSelectOption value={`product:${productOption}`}>
                    {`Catálogo: ${byId.get(productOption)!.name}`}
                  </NativeSelectOption>
                )}
                <NativeSelectOption value="new">Novo produto no catálogo</NativeSelectOption>
              </NativeSelect>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
