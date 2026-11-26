const BRL_CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata em BRL e normaliza o espaco nao separavel para espaco comum. */
export function formatCurrencyBRL(value: number): string {
  return BRL_CURRENCY_FORMATTER.format(value).replace(/\s/g, " ");
}

/** Mascara de digitacao: "12345" => "R$ 123,45". */
export function maskCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return formatCurrencyBRL(Number(digits) / 100);
}

/** "R$ 1.234,56" => 1234.56. Retorna NaN quando vazio. */
export function parseMaskedCurrencyToNumber(value: string): number {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return Number.NaN;
  }

  return Number(digits) / 100;
}

export function toMaskedCurrencyFromNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return formatCurrencyBRL(value);
}
