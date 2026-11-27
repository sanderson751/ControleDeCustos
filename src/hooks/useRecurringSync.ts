import { useEffect, useState } from "react";
import {
  getCurrentCompetence,
  toCompetenceParam,
} from "@/domain/rules/competence";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { syncRecurringCosts } from "@/services/recurringCostService";

/** Tempo maximo que as telas esperam a geracao antes de abrir. */
export const SYNC_BLOCK_TIMEOUT_MS = 4000;
/** Frequencia da checagem de virada de mes com o app aberto. */
export const COMPETENCE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const FAILURE_MESSAGE =
  "Não foi possível gerar alguns lançamentos recorrentes agora. Tentaremos novamente na próxima abertura.";

function currentParam() {
  return toCompetenceParam(getCurrentCompetence());
}

/**
 * Gera os lancamentos recorrentes pendentes (somente quem pode gravar custos):
 * ao abrir o app e de novo na virada do mes com o app aberto. A transacao de
 * cada recorrencia torna execucoes repetidas/concorrentes inofensivas.
 *
 * - `isBlocking`: segura as telas so na primeira geracao, por no maximo
 *   SYNC_BLOCK_TIMEOUT_MS (rede lenta/offline nunca trava o app);
 * - `version`: incrementa quando lancamentos sao criados, para as telas do mes
 *   recarregarem se ja estiverem abertas.
 */
export function useRecurringSync(userId: string, enabled: boolean) {
  const [competence, setCompetence] = useState(currentParam);
  const [isBlocking, setIsBlocking] = useState(enabled);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = setInterval(() => setCompetence(currentParam()), COMPETENCE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsBlocking(false);
      return;
    }

    let isActive = true;
    const release = setTimeout(() => setIsBlocking(false), SYNC_BLOCK_TIMEOUT_MS);

    syncRecurringCosts(userId)
      .then(({ created, failed }) => {
        if (!isActive) {
          return;
        }
        if (created > 0) {
          notify(
            "success",
            created === 1
              ? "1 lançamento recorrente gerado."
              : `${created} lançamentos recorrentes gerados.`,
          );
          setVersion((current) => current + 1);
        }
        if (failed > 0) {
          notify("warning", FAILURE_MESSAGE);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          notify("warning", friendlyFirestoreErrorMessage(error, FAILURE_MESSAGE));
        }
      })
      .finally(() => {
        clearTimeout(release);
        if (isActive) {
          setIsBlocking(false);
        }
      });

    return () => {
      isActive = false;
      clearTimeout(release);
    };
  }, [competence, enabled, userId]);

  return { isBlocking, version };
}
