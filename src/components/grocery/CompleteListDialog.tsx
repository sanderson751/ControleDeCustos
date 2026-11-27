import { CameraIcon } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { ReceiptReview } from "@/components/grocery/ReceiptReview";
import { Progress } from "@/components/ui/progress";
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
  MAX_LIST_ITEMS,
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
import { parseReceiptText, receiptKeyOf } from "@/domain/rules/receiptParser";
import {
  applyDecision,
  buildReviewLines,
  listPricesFromReview,
  receiptCompletionFromReview,
  reconcileFilled,
  type ReviewDecision,
  type ReviewLine,
} from "@/domain/rules/receiptReview";
import {
  type ReadPhase,
  readReceipt,
  ReceiptReadCancelled,
  ReceiptReadTimeout,
} from "@/lib/receiptReader";
import { completeList, findPurchaseByReceiptKey } from "@/services/groceryService";

/** Abaixo disso a leitura costuma ter erros: reforca o pedido de conferencia. */
const LOW_CONFIDENCE = 60;

type Fields = { store: string; date: string; total: string; prices: Record<string, string> };

type Duplicate = { purchasedAt: Date; total: number };

type ReceiptState = {
  accessKey: string | null;
  cnpj: string | null;
  /** Ultima chave conferida contra as compras ja lancadas. */
  checkedKey: string | null;
  confidence: number;
  needsReview: boolean;
  lines: ReviewLine[];
  duplicate: Duplicate | null;
  /** Valores antes da leitura (restaurados ao descartar). */
  base: Fields;
  /** O que a leitura preencheu (campo editado pelo usuario deixa de ser da leitura). */
  filled: Partial<Omit<Fields, "prices">> & { prices: Record<string, string> };
};

const formatPrices = (prices: Record<string, number>) =>
  Object.fromEntries(Object.entries(prices).map(([itemId, price]) => [itemId, formatCurrencyBRL(price)]));

const inputDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;

/** Desfaz o que a leitura preencheu, mantendo o que o usuario editou depois. */
function revertReading(current: Fields, receipt: ReceiptState): Fields {
  const { base, filled } = receipt;
  const prices = { ...current.prices };
  for (const itemId of Object.keys(filled.prices)) {
    prices[itemId] = reconcileFilled(
      current.prices[itemId] ?? "",
      filled.prices[itemId],
      base.prices[itemId] ?? "",
      undefined,
    );
  }
  return {
    store: reconcileFilled(current.store, filled.store, base.store, undefined),
    date: reconcileFilled(current.date, filled.date, base.date, undefined),
    total: reconcileFilled(current.total, filled.total, base.total, undefined),
    prices,
  };
}

/**
 * Data que entra na chave: a lida na comanda ou a alterada pelo usuario. A data
 * padrao (hoje) sem leitura nao identifica a compra: sem chave.
 */
function keyDate(receipt: Pick<ReceiptState, "base" | "filled">, value: string): Date | null {
  return receipt.filled.date !== undefined || value !== receipt.base.date ? inputDate(value) : null;
}

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
  const [reading, setReading] = useState<{ progress: number; phase: ReadPhase } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readAbort = useRef<AbortController | null>(null);
  const isReading = reading !== null;
  const busy = isSaving || isReading;

  // Fechar o dialogo no meio da leitura encerra o OCR.
  useEffect(() => () => readAbort.current?.abort(), []);

  function applyFields(fields: Fields) {
    setStore(fields.store);
    setDate(fields.date);
    setTotal(fields.total);
    setPrices(fields.prices);
  }

  /**
   * Le a foto, preenche loja/data/total/precos e monta a revisao dos itens.
   * Uma nova leitura substitui a anterior por inteiro (so quando da certo).
   */
  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const controller = new AbortController();
    readAbort.current = controller;
    const current: Fields = { store, date, total, prices };
    const base = receipt ? revertReading(current, receipt) : current;
    setReading({ progress: 0, phase: "preparing" });

    try {
      const result = await readReceipt(file, {
        signal: controller.signal,
        // Progresso de leitura ja cancelada nao reabre o indicador.
        onProgress: (progress, phase) => {
          if (!controller.signal.aborted && readAbort.current === controller) setReading({ progress, phase });
        },
      });
      const parsed = parseReceiptText(result.text);

      if (parsed.total === null && parsed.items.length === 0) {
        notify(
          "warning",
          "Não foi possível ler a comanda. Tente outra foto, com boa luz e o papel esticado, ou preencha manualmente.",
        );
        return;
      }

      const lines = buildReviewLines(parsed, list.items, products);
      const filled: ReceiptState["filled"] = {
        store: parsed.store || undefined,
        date: parsed.date ? toInputDate(parsed.date) : undefined,
        total: parsed.total !== null ? formatCurrencyBRL(parsed.total) : undefined,
        prices: formatPrices(listPricesFromReview(lines, list.items, products)),
      };
      const next: Fields = {
        store: filled.store ?? base.store,
        date: filled.date ?? base.date,
        total: filled.total ?? base.total,
        prices: { ...base.prices, ...filled.prices },
      };
      const accessKey = result.qrAccessKey ?? parsed.accessKey;
      const key = receiptKeyOf({
        accessKey,
        cnpj: parsed.cnpj,
        store: next.store.trim() || DEFAULT_STORE,
        date: keyDate({ base, filled }, next.date),
        total: parseMaskedCurrencyToNumber(next.total),
      });
      const duplicate = key ? await findPurchaseByReceiptKey(userId, key).catch(() => null) : null;

      applyFields(next);
      setReceipt({
        accessKey,
        cnpj: parsed.cnpj,
        checkedKey: key,
        confidence: result.confidence,
        needsReview: parsed.totalNeedsReview || result.confidence < LOW_CONFIDENCE,
        lines,
        duplicate,
        base,
        filled,
      });
      notify(
        duplicate ? "warning" : "success",
        duplicate
          ? "Esta comanda já foi lançada antes. Confira para não registrar a compra duas vezes."
          : `Comanda lida: ${parsed.items.length} ${parsed.items.length === 1 ? "item" : "itens"}. Confira antes de concluir.`,
      );
    } catch (error) {
      if (error instanceof ReceiptReadCancelled) {
        notify("warning", "Leitura da comanda cancelada.");
      } else if (error instanceof ReceiptReadTimeout) {
        notify("error", "A leitura demorou demais. Tente uma foto mais nítida ou preencha os valores manualmente.");
      } else {
        notify("error", "Não foi possível ler a foto da comanda. Preencha os valores manualmente.");
      }
    } finally {
      if (readAbort.current === controller) readAbort.current = null;
      setReading(null);
    }
  }

  /** Troca o destino de uma linha: recalcula os precos da lista que vieram da leitura. */
  function handleDecision(key: string, decision: ReviewDecision) {
    if (!receipt) return;
    const lines = applyDecision(receipt.lines, key, decision);
    const nextPrices = formatPrices(listPricesFromReview(lines, list.items, products));
    const updated = { ...prices };
    const filledPrices: Record<string, string> = {};

    for (const itemId of new Set([...Object.keys(receipt.filled.prices), ...Object.keys(nextPrices)])) {
      const value = reconcileFilled(
        prices[itemId] ?? "",
        receipt.filled.prices[itemId],
        receipt.base.prices[itemId] ?? "",
        nextPrices[itemId],
      );
      updated[itemId] = value;
      if (nextPrices[itemId] !== undefined && value === nextPrices[itemId]) filledPrices[itemId] = value;
    }

    setPrices(updated);
    setReceipt({ ...receipt, lines, filled: { ...receipt.filled, prices: filledPrices } });
  }

  function handleDiscard() {
    if (!receipt) return;
    applyFields(revertReading({ store, date, total, prices }, receipt));
    setReceipt(null);
  }

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

  function warnDuplicate(duplicate: Duplicate) {
    notify(
      "warning",
      `Esta comanda já foi lançada em ${duplicate.purchasedAt.toLocaleDateString("pt-BR")} (${formatCurrencyBRL(duplicate.total)}). Descarte a leitura para concluir manualmente.`,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateCompletion({
      store,
      purchasedAt: inputDate(date),
      total: parseMaskedCurrencyToNumber(total),
      unitPrices: Object.fromEntries(
        Object.entries(prices).map(([itemId, value]) => [itemId, parseMaskedCurrencyToNumber(value)]),
      ),
    });

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    // Chave com os valores finais (loja/data/total podem ter sido corrigidos na revisao).
    const key = receipt
      ? receiptKeyOf({
          accessKey: receipt.accessKey,
          cnpj: receipt.cnpj,
          store: validation.value.store,
          date: keyDate(receipt, date),
          total: validation.value.total,
        })
      : null;

    if (receipt?.duplicate && key === receipt.checkedKey) {
      warnDuplicate(receipt.duplicate);
      return;
    }

    setIsSaving(true);

    try {
      if (receipt && key !== receipt.checkedKey) {
        const duplicate = key ? await findPurchaseByReceiptKey(userId, key).catch(() => null) : null;
        setReceipt({ ...receipt, checkedKey: key, duplicate });
        if (duplicate) {
          warnDuplicate(duplicate);
          setIsSaving(false);
          return;
        }
      }

      const plan = buildCompletion(list, products, {
        ...validation.value,
        receipt: receipt ? receiptCompletionFromReview(receipt.lines, key, receipt.confidence) : undefined,
      });
      const written = completeList(userId, list, plan);

      // Sem sinal: o lote fica na fila do aparelho e sincroniza depois (o
      // commit so termina quando o servidor confirmar).
      if (!navigator.onLine) {
        written.catch((error: unknown) =>
          notify("error", friendlyFirestoreErrorMessage(error, "A compra salva sem conexão não pôde ser sincronizada.")),
        );
        notify(
          "warning",
          `Sem conexão: a compra de ${formatCurrencyBRL(plan.cost.amount)} foi salva no aparelho e o lançamento sincroniza quando a conexão voltar.`,
        );
        onClose();
        return;
      }

      await written;
      const updatedCount = plan.productUpdates.length + plan.newProducts.length;
      notify(
        plan.droppedExtras ? "warning" : "success",
        `Compra concluída: ${formatCurrencyBRL(plan.cost.amount)} lançados em Alimentação.${
          updatedCount
            ? ` Preço de ${updatedCount === 1 ? "1 produto atualizado" : `${updatedCount} produtos atualizados`} para a próxima lista.`
            : ""
        }${
          plan.droppedExtras
            ? ` ${plan.droppedExtras} ${plan.droppedExtras === 1 ? "item da comanda ficou" : "itens da comanda ficaram"} fora do histórico (limite de ${MAX_LIST_ITEMS} itens por compra).`
            : ""
        }`,
      );
      onClose();
    } catch (error) {
      // Outra aba/dispositivo lancou a mesma comanda: a chave unica barra o lote.
      const duplicate = key ? await findPurchaseByReceiptKey(userId, key).catch(() => null) : null;
      if (receipt && duplicate) {
        setReceipt({ ...receipt, checkedKey: key, duplicate });
        warnDuplicate(duplicate);
      } else {
        notify("error", friendlyFirestoreErrorMessage(error, "Falha ao concluir a compra."));
      }
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Concluir compra</DialogTitle>
          <DialogDescription>
            O total pago vira um lançamento em Alimentação. Os preços pagos por item (opcionais) viram a
            previsão da próxima lista. Fotografe a comanda para preencher tudo automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form id="complete-list-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <input
              ref={fileInput}
              id="receipt-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-label="Foto da comanda"
              onChange={(event) => void handlePhoto(event)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                <CameraIcon aria-hidden="true" />
                {receipt ? "Fotografar de novo" : "Fotografar comanda"}
              </Button>
              {isReading && (
                <Button type="button" variant="ghost" size="sm" onClick={() => readAbort.current?.abort()}>
                  Cancelar leitura
                </Button>
              )}
              {receipt && !isReading && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDiscard} disabled={busy}>
                  Descartar leitura
                </Button>
              )}
              <span className="text-xs text-muted-foreground">A foto é lida no seu aparelho e não é enviada.</span>
            </div>
            <div className="space-y-1" aria-live="polite">
              {reading && (
                <>
                  <p className="text-sm">
                    {`${reading.phase === "preparing" ? "Preparando a leitura" : "Lendo a comanda"}... ${Math.round(reading.progress * 100)}%`}
                  </p>
                  <Progress
                    value={Math.round(reading.progress * 100)}
                    aria-label="Progresso da leitura da comanda"
                  />
                </>
              )}
            </div>
            {receipt?.duplicate && (
              <p className="text-sm text-destructive" role="alert">
                {`Esta comanda já foi lançada em ${receipt.duplicate.purchasedAt.toLocaleDateString("pt-BR")} (${formatCurrencyBRL(receipt.duplicate.total)}).`}
              </p>
            )}
            {receipt && !receipt.duplicate && receipt.needsReview && (
              <p className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground" role="status">
                Confira o total e os preços: a leitura pode ter erros (foto pouco nítida ou total diferente da
                soma dos itens).
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="complete-store">Loja</Label>
              <Input
                id="complete-store"
                value={store}
                maxLength={MAX_STORE_LENGTH}
                placeholder={DEFAULT_STORE}
                onChange={(event) => setStore(event.target.value)}
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
              />
            </div>
          </div>

          {mismatch && (
            <p className="text-sm text-muted-foreground" role="status">
              {`A soma dos itens (${formatCurrencyBRL(itemsSum)}) difere do total pago. Confira descontos, itens fora da lista ou digitação.`}
            </p>
          )}

          {receipt && receipt.lines.length > 0 && (
            <ReceiptReview
              lines={receipt.lines}
              listItems={list.items}
              products={products}
              disabled={busy}
              onChange={handleDecision}
            />
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
                        disabled={busy}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="complete-list-form"
            isLoading={isSaving}
            loadingText="Concluindo..."
            disabled={isReading}
          >
            Concluir e lançar
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
