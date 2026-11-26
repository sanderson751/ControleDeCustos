import { COST_TYPE_LABELS, type CostType } from "@/domain/entities/cost";
import { cn } from "@/lib/utils";

const TONE: Record<CostType, string> = {
  fixo: "bg-periwinkle text-tile-foreground",
  variavel: "bg-orchid text-tile-foreground",
};

export function CostTypeBadge({ costType }: { costType: CostType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wider uppercase",
        TONE[costType],
      )}
    >
      {COST_TYPE_LABELS[costType]}
    </span>
  );
}
