import { toast } from "sonner";

export type NotifyStatus = "success" | "error" | "warning";

/** Duracao padrao do snackbar (contrato SDD: 3 segundos). */
export const SNACKBAR_DURATION_MS = 3000;

/**
 * Snackbar padrao do app (contrato SDD): canto superior direito, 3s,
 * botao de fechar com X e cor por status (vermelho/verde/amarelo).
 * A posicao, duracao e o X sao configurados no <Toaster /> raiz.
 */
export function notify(status: NotifyStatus, message: string) {
  switch (status) {
    case "success":
      return toast.success(message);
    case "warning":
      return toast.warning(message);
    case "error":
      return toast.error(message);
  }
}
