import { type FormEvent, useEffect, useState } from "react";
import { LoadingButton } from "@/components/shared/LoadingButton";
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
  DEFAULT_STORE,
  type GroceryList,
  type GroceryProduct,
  MAX_STORE_LENGTH,
} from "@/domain/entities/grocery";
import {
  buildCompletion,
  formatQuantity,
  itemsTotalMismatch,
  validateCompletion,
} from "@/domain/rules/groceryRules";
import {
  formatCurrencyBRL,
  maskCurrencyInput,
  parseMaskedCurrencyToNumber,
} from "@/lib/currency";
import { toInputDate } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { completeList } from "@/services/groceryService";

type Props = {
  userId: string;
  list: GroceryList;
  products: readonly GroceryProduct[];
  /** Total previsto (sugestao inicial do total pago). */
  forecast: number;
  onClose: () => void;
};

/**
 * Conclui a compra: total pago (lancamento em Alimentacao) e, opcionalmente,
 * o preco unitario pago de cada item (historico para a proxima lista).
 */
export function CompleteListDialog({ userId, list, products, forecast, onClose }: Props) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const [store, setStore] = useState("");
  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [total, setTotal] = useState(() => (forecast > 0 ? formatCurrencyBRL(forecast) : ""));
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Concluida em outra aba/dispositivo enquanto o dialogo estava aberto.
  useEffect(() => {
    if (list.status !== "aberta" && !isSaving) {
      notify("warning", "Esta lista já foi concluída em outro dispositivo.");
      onClose();
    }
  }, [isSaving, list.status, onClose]);

  const paid = parseMaskedCurrencyToNumber(total);
  const allPriced = list.items.length > 0 && list.items.every((item) => prices[item.id]);
  const itemsSum =
    list.items.reduce(
      (sum, item) =>
        sum + Math.round((parseMaskedCurrencyToNumber(prices[item.id] ?? "") || 0) * 100 * item.quantity),
      0,
    ) / 100;
  const mismatch = allPriced && itemsTotalMismatch(itemsSum, paid);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateCompletion({
      store,
      purchasedAt: /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : null,
      total: parseMaskedCurrencyToNumber(total),
      unitPrices: Object.fromEntries(
        Object.entries(prices).map(([itemId, value]) => [itemId, parseMaskedCurrencyToNumber(value)]),
      ),
    });

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsSaving(true);

    try {
      const plan = buildCompletion(list, products, validation.value);
      await completeList(userId, list, plan);
      notify(
        "success",
        `Compra concluída: ${formatCurrencyBRL(plan.cost.amount)} lançados em Alimentação.${
          plan.productUpdates.length
            ? ` Preço de ${plan.productUpdates.length === 1 ? "1 produto atualizado" : `${plan.productUpdates.length} produtos atualizados`} para a próxima lista.`
            : ""
        }`,
      );
      onClose();
    } catch (error) {
      notify("error", friendlyFirestoreErrorMessage(error, "Falha ao concluir a compra."));
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Concluir compra</DialogTitle>
          <DialogDescription>
            O total pago vira um lançamento em Alimentação. Os preços pagos por item (opcionais) viram a
            previsão da próxima lista.
          </DialogDescription>
        </DialogHeader>
        <form id="complete-list-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="complete-store">Loja</Label>
              <Input
                id="complete-store"
                value={store}
                maxLength={MAX_STORE_LENGTH}
                placeholder={DEFAULT_STORE}
                onChange={(event) => setStore(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-date">Data da compra</Label>
              <Input
                id="complete-date"
                type="date"
                max={toInputDate(new Date())}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-total">Total pago</Label>
              <Input
                id="complete-total"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={total}
                onChange={(event) => setTotal(maskCurrencyInput(event.target.value))}
                disabled={isSaving}
              />
            </div>
          </div>

          {mismatch && (
            <p className="text-sm text-muted-foreground" role="status">
              {`A soma dos itens (${formatCurrencyBRL(itemsSum)}) difere do total pago. Confira descontos, itens fora da lista ou digitação.`}
            </p>
          )}

          {list.items.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Preço unitário pago (opcional)</legend>
              <ul className="divide-y rounded-lg border">
                {list.items.map((item) => {
                  const last = byId.get(item.productId)?.lastUnitPrice ?? null;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {`Qtd. ${formatQuantity(item.quantity)} · ${last !== null ? `último ${formatCurrencyBRL(last)}` : "sem histórico"}`}
                        </p>
                      </div>
                      <Input
                        aria-label={`Preço pago de ${item.name}`}
                        className="w-32 tabular-nums"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        value={prices[item.id] ?? ""}
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [item.id]: maskCurrencyInput(event.target.value),
                          }))
                        }
                        disabled={isSaving}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="complete-list-form"
            isLoading={isSaving}
            loadingText="Concluindo..."
          >
            Concluir e lançar
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
