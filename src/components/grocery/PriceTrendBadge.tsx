import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import type { GroceryProduct } from "@/domain/entities/grocery";
import { formatTrend, type PriceTrend, priceTrend } from "@/domain/rules/groceryInsights";
import { formatCurrencyBRL } from "@/lib/currency";
import { cn } from "@/lib/utils";

const TONE: Record<PriceTrend["direction"], string> = {
  up: "bg-danger text-danger-foreground",
  down: "bg-success text-success-foreground",
  stable: "border text-muted-foreground",
};

const ICON = { up: ArrowUpRightIcon, down: ArrowDownRightIcon, stable: ArrowRightIcon };

const LABEL = { up: "subiu", down: "caiu", stable: "estável" };

/** Variacao do ultimo preco sobre o anterior (icone + texto; nunca so cor). */
export function PriceTrendBadge({
  product,
  trend: given,
  className,
}: {
  product?: Pick<GroceryProduct, "lastUnitPrice" | "previousUnitPrice"> | null;
  trend?: PriceTrend | null;
  className?: string;
}) {
  const trend = given ?? (product ? priceTrend(product) : null);
  if (!trend) return null;
  const Icon = ICON[trend.direction];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        TONE[trend.direction],
        className,
      )}
      title={`Antes ${formatCurrencyBRL(trend.previous)}, agora ${formatCurrencyBRL(trend.last)}`}
    >
      <Icon aria-hidden="true" className="size-3" />
      <span className="sr-only">{`Preço ${LABEL[trend.direction]}${trend.direction === "stable" ? "" : ":"} `}</span>
      {trend.direction === "stable" ? null : formatTrend(trend)}
      {trend.direction === "stable" && <span aria-hidden="true">estável</span>}
      <span className="sr-only">{` desde a compra anterior (${formatCurrencyBRL(trend.previous)})`}</span>
    </span>
  );
}
