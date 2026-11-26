import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTileTone = "iris" | "periwinkle" | "orchid" | "pale-iris" | "neutral";

const TONE_CLASSES: Record<StatTileTone, string> = {
  iris: "bg-iris text-tile-foreground",
  periwinkle: "bg-periwinkle text-tile-foreground",
  orchid: "bg-orchid text-tile-foreground",
  "pale-iris": "bg-pale-iris text-tile-foreground",
  neutral: "border bg-card text-card-foreground",
};

type StatTileProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTileTone;
  icon?: ReactNode;
  className?: string;
};

/**
 * Tile de indicador. Tons cromaticos seguem os "category tiles" do Origin
 * Financial (raio 30px, sem sombra) com texto escuro para contraste AA.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
}: StatTileProps) {
  const isChromatic = tone !== "neutral";

  return (
    <article
      className={cn(
        "flex min-h-40 flex-col justify-between gap-6 p-6 md:p-8",
        isChromatic ? "rounded-tile" : "rounded-2xl",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p
          className={cn(
            "eyebrow",
            isChromatic ? "text-tile-foreground/80" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {icon && <span aria-hidden="true">{icon}</span>}
      </div>
      <div className="space-y-1">
        <p className="font-display-light text-3xl leading-none tabular-nums md:text-heading-lg">
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "text-sm",
              isChromatic ? "text-tile-foreground/80" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}
