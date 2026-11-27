import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroceryProduct } from "@/domain/entities/grocery";
import { describeRestock, type RestockSuggestion } from "@/domain/rules/groceryInsights";
import { formatCurrencyBRL } from "@/lib/currency";

/** "Talvez esteja acabando": produtos com padrao de compra perto da proxima reposicao. */
export function RestockCard({
  suggestions,
  onAdd,
}: {
  suggestions: readonly RestockSuggestion[];
  onAdd: (product: GroceryProduct) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <Card role="region" aria-labelledby="restock-title">
      <CardHeader>
        <CardTitle id="restock-title" className="text-xl">
          Talvez esteja acabando
        </CardTitle>
        <CardDescription>Pelo seu ritmo de compra, estes produtos estão perto da reposição.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {suggestions.map((suggestion) => (
            <li key={suggestion.product.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{suggestion.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {describeRestock(suggestion)}
                  {suggestion.product.lastUnitPrice !== null &&
                    ` · último ${formatCurrencyBRL(suggestion.product.lastUnitPrice)}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Adicionar ${suggestion.product.name} à lista`}
                onClick={() => onAdd(suggestion.product)}
              >
                <PlusIcon aria-hidden="true" />
                Adicionar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
