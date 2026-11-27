import { PriceTrendBadge } from "@/components/grocery/PriceTrendBadge";
import { StatTile } from "@/components/shared/StatTile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GROCERY_UNIT_LABELS, type GroceryProduct } from "@/domain/entities/grocery";
import { formatCompetenceLong } from "@/domain/rules/competence";
import { formatTrend, marketInflation, priceTrend } from "@/domain/rules/groceryInsights";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatDateBR } from "@/lib/dates";

/**
 * "Seus precos": inflacao do mercado no mes (cesta de produtos recomprados)
 * e o historico resumido de cada produto (anterior x ultimo preco pago).
 */
export function PriceHistorySection({
  products,
  now = new Date(),
}: {
  products: readonly GroceryProduct[];
  now?: Date;
}) {
  const competence = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const inflation = marketInflation(products, competence.year, competence.month);
  const priced = products
    .filter((product) => product.lastUnitPrice !== null)
    .map((product) => ({ product, trend: priceTrend(product) }))
    .sort(
      (left, right) =>
        (right.trend?.percent ?? -Infinity) - (left.trend?.percent ?? -Infinity) ||
        left.product.name.localeCompare(right.product.name, "pt-BR"),
    );

  return (
    <section className="space-y-4" aria-labelledby="prices-title">
      <div className="space-y-1">
        <h2 id="prices-title" className="font-heading text-2xl">
          Seus preços
        </h2>
        <p className="text-sm text-muted-foreground">
          Como o preço que você paga mudou entre a compra anterior e a última de cada produto.
        </p>
      </div>

      {priced.length === 0 ? (
        <p className="text-muted-foreground">
          Conclua uma compra informando os preços para começar o histórico.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatTile
              tone="pale-iris"
              label={`Sua inflação do mercado · ${formatCompetenceLong(competence)}`}
              value={
                inflation
                  ? `${inflation.percent > 0 ? "+" : inflation.percent < 0 ? "−" : ""}${Math.abs(inflation.percent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                  : "—"
              }
              hint={
                inflation
                  ? `${inflation.productCount} ${inflation.productCount === 1 ? "produto recomprado" : "produtos recomprados"}: ${formatCurrencyBRL(inflation.previous)} → ${formatCurrencyBRL(inflation.current)} (uma unidade de cada)`
                  : "Nenhum produto recomprado neste mês ainda."
              }
            />
            <StatTile
              label="Maiores altas"
              value={inflation?.topUp.length ? inflation.topUp[0].product.name : "—"}
              hint={
                inflation?.topUp.length
                  ? inflation.topUp.map((entry) => `${entry.product.name} ${formatTrend(entry.trend)}`).join(" · ")
                  : "Sem altas neste mês."
              }
            />
            <StatTile
              label="Maiores quedas"
              value={inflation?.topDown.length ? inflation.topDown[0].product.name : "—"}
              hint={
                inflation?.topDown.length
                  ? inflation.topDown.map((entry) => `${entry.product.name} ${formatTrend(entry.trend)}`).join(" · ")
                  : "Sem quedas neste mês."
              }
            />
          </div>

          <div className="rounded-xl border bg-card">
            <Table aria-label="Histórico de preços">
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Último</TableHead>
                  <TableHead>Variação</TableHead>
                  <TableHead>Última compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priced.map(({ product, trend }) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                      <span className="ml-1 text-xs text-muted-foreground">{`/ ${GROCERY_UNIT_LABELS[product.unit]}`}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {product.previousUnitPrice !== null ? formatCurrencyBRL(product.previousUnitPrice) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(product.lastUnitPrice!)}
                    </TableCell>
                    <TableCell>
                      {trend ? (
                        <PriceTrendBadge trend={trend} />
                      ) : (
                        <span className="text-xs text-muted-foreground">primeira compra</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.lastPurchasedAt ? formatDateBR(product.lastPurchasedAt) : "—"}
                      {product.lastStore && ` · ${product.lastStore}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
