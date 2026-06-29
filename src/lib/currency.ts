const BRL_CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrencyBRL(value: number) {
  return BRL_CURRENCY_FORMATTER.format(value)
}

export function maskCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  return formatCurrencyBRL(Number(digits) / 100)
}

export function parseMaskedCurrencyToNumber(value: string) {
  const digits = value.replace(/\D/g, '')

  if (!digits) {
    return NaN
  }

  return Number(digits) / 100
}

export function toMaskedCurrencyFromNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  return formatCurrencyBRL(value)
}
