import { ArrowLeftIcon, CheckCheckIcon, CheckIcon, SunIcon, WifiOffIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { CompleteListDialog } from "@/components/grocery/CompleteListDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GROCERY_UNIT_LABELS } from "@/domain/entities/grocery";
import { shopProgress } from "@/domain/rules/groceryInsights";
import { forecastList, formatQuantity } from "@/domain/rules/groceryRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { useGroceryData } from "@/hooks/useGroceryData";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOptimisticListItems } from "@/hooks/useOptimisticListItems";
import { useWakeLock } from "@/hooks/useWakeLock";
import { formatCurrencyBRL } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";

/**
 * Modo mercado: itens grandes para marcar no corredor, soma em tempo real do
 * previsto do carrinho, tela mantida ligada e marcacoes que funcionam sem
 * sinal (sincronizam quando a conexao volta).
 */
export default function GroceryShopPage() {
  const { listId = "" } = useParams<{ listId: string }>();
  const { profile } = useSession();
  const userId = profile.userId;
  const { products, lists, isLoading, error } = useGroceryData(userId);
  const [isCompleting, setIsCompleting] = useState(false);
  const list = lists.find((item) => item.id === listId) ?? null;
  const { items, update } = useOptimisticListItems(userId, list);
  const editable = canMutateCosts(profile.role) && list?.status === "aberta";
  const online = useOnlineStatus();
  const wakeLock = useWakeLock(editable);
  const forecast = useMemo(() => forecastList(items, products), [items, products]);
  const progress = useMemo(() => shopProgress(items, products), [items, products]);

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link to={list ? ROUTES.groceryList(list.id) : ROUTES.grocery}>
        <ArrowLeftIcon aria-hidden="true" />
        {list ? "Voltar para a lista" : "Voltar para Mercado"}
      </Link>
    </Button>
  );

  if (error) {
    return (
      <section className="space-y-6">
        {backLink}
        <p className="text-destructive" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground" aria-live="polite">
        Carregando lista...
      </p>
    );
  }

  if (!list) {
    return (
      <section className="space-y-6">
        {backLink}
        <p className="text-muted-foreground">Lista não encontrada. Ela pode ter sido excluída.</p>
      </section>
    );
  }

  const percent = progress.total ? Math.round((progress.checkedCount / progress.total) * 100) : 0;

  return (
    <section className="mx-auto max-w-2xl space-y-6" data-testid="grocery-shop-screen">
      {backLink}

      <header className="space-y-2">
        <p className="eyebrow text-muted-foreground">Modo mercado</p>
        <h1 className="font-heading text-3xl">{list.name}</h1>
        <div className="flex flex-wrap gap-2 text-xs" aria-live="polite">
          {!online && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-1 font-medium text-warning-foreground">
              <WifiOffIcon aria-hidden="true" className="size-3.5" />
              {editable
                ? "Sem conexão: as marcações ficam salvas no aparelho e sincronizam depois"
                : "Sem conexão: mostrando a última versão salva no aparelho"}
            </span>
          )}
          {wakeLock === "active" && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-muted-foreground">
              <SunIcon aria-hidden="true" className="size-3.5" />
              Tela mantida ligada
            </span>
          )}
        </div>
      </header>

      {list.status !== "aberta" && (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground" role="status">
          Esta compra já foi concluída: a lista está somente para consulta.
        </p>
      )}

      <div
        className="sticky top-2 z-10 space-y-2 rounded-2xl border bg-card p-4 shadow-sm"
        role="status"
        aria-label="Resumo do carrinho"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted-foreground">No carrinho</p>
          <p className="font-heading text-2xl tabular-nums">{formatCurrencyBRL(progress.cartForecast)}</p>
        </div>
        <Progress value={percent} aria-label={`${progress.checkedCount} de ${progress.total} itens no carrinho`} />
        <p className="text-xs text-muted-foreground">
          {`${progress.checkedCount} de ${progress.total} itens · previsto da lista ${formatCurrencyBRL(forecast.total)}`}
          {progress.cartMissing > 0 &&
            ` · ${progress.cartMissing} ${progress.cartMissing === 1 ? "item" : "itens"} sem histórico fora da soma`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item na lista.</p>
      ) : (
        <ul className="space-y-2" aria-label="Itens da lista">
          {forecast.items.map((item) => {
            const unit = item.product?.unit ?? "un";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  disabled={!editable}
                  onClick={() =>
                    update((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, checked: !entry.checked } : entry,
                      ),
                    )
                  }
                  className={cn(
                    "flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                    item.checked ? "bg-muted" : "bg-card hover:bg-accent",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                      item.checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {item.checked && <CheckIcon className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-lg font-medium",
                        item.checked && "text-muted-foreground line-through",
                      )}
                    >
                      {item.product?.name ?? item.name}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {`${formatQuantity(item.quantity)} ${GROCERY_UNIT_LABELS[unit]}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {item.total !== null ? formatCurrencyBRL(item.total) : (
                      <span className="text-xs text-muted-foreground">sem histórico</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <Button size="lg" className="w-full" onClick={() => setIsCompleting(true)} disabled={items.length === 0}>
          <CheckCheckIcon aria-hidden="true" />
          Concluir compra
        </Button>
      )}

      {isCompleting && (
        <CompleteListDialog
          userId={userId}
          list={{ ...list, items: [...items] }}
          products={products}
          forecast={forecast.total}
          onClose={() => setIsCompleting(false)}
        />
      )}
    </section>
  );
}
