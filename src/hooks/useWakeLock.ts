import { useEffect, useState } from "react";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

export type WakeLockStatus = "unsupported" | "active" | "inactive";

/**
 * Mantem a tela ligada enquanto `enabled` (Screen Wake Lock API). O navegador
 * solta o bloqueio quando a aba some; ao voltar, pede de novo. Sem suporte ou
 * negado (economia de bateria), apenas informa o estado.
 */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || !wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    let requesting = false;

    const acquire = async () => {
      if (requesting || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      requesting = true;
      try {
        const next = await wakeLock.request("screen");
        if (disposed) {
          await next.release();
          return;
        }
        sentinel = next;
        setActive(true);
        next.addEventListener("release", () => setActive(false));
      } catch {
        setActive(false);
      } finally {
        requesting = false;
      }
    };

    const onVisibility = () => void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      setActive(false);
    };
  }, [enabled, wakeLock]);

  if (!wakeLock) return "unsupported";
  return active && enabled ? "active" : "inactive";
}
