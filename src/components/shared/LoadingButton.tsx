import { Loader2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type LoadingButtonProps = ComponentProps<typeof Button> & {
  isLoading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
};

/** Botao com estado de carregamento acessivel (aria-busy + spinner). */
export function LoadingButton({
  isLoading = false,
  loadingText,
  icon,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2Icon className="animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {isLoading && loadingText ? loadingText : children}
    </Button>
  );
}
