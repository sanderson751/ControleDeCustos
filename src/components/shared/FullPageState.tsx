import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

export function FullPageLoader({ label = "Carregando..." }: { label?: string }) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="full-page-loader"
    >
      <Loader2Icon className="size-6 animate-spin" aria-hidden="true" />
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function FullPageMessage({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-heading">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
        {action}
      </div>
    </div>
  );
}
