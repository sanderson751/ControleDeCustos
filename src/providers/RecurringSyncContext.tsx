import { createContext, useContext } from "react";

/**
 * Versao da geracao de lancamentos recorrentes: muda quando novos lancamentos
 * sao criados, para as telas do mes recarregarem. 0 fora do AppShell.
 */
export const RecurringSyncContext = createContext(0);

export function useRecurringSyncVersion(): number {
  return useContext(RecurringSyncContext);
}
