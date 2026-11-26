/** Date => "AAAA-MM-DD" no fuso local (formato do input type="date"). */
export function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "AAAA-MM-DD" => Date ao meio-dia local (evita troca de dia por fuso). */
export function fromInputDateAtNoon(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatDateBR(value: Date): string {
  return value.toLocaleDateString("pt-BR");
}

export function formatCompetence(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function getCurrentMonthRange(now: Date = new Date()) {
  return {
    startDate: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toInputDate(now),
  };
}

export type DateRange = { startDate: Date; endDate: Date };

/** Converte o intervalo do filtro para o inicio e fim do dia. Null quando invalido. */
export function parseDateRange(
  startDateRaw: string,
  endDateRaw: string,
): DateRange | null {
  if (!startDateRaw || !endDateRaw) {
    return null;
  }

  const startDate = new Date(`${startDateRaw}T00:00:00.000`);
  const endDate = new Date(`${endDateRaw}T23:59:59.999`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  if (startDate.getTime() > endDate.getTime()) {
    return null;
  }

  return { startDate, endDate };
}
