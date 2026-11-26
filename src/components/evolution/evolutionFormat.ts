import type { MonthlyPoint } from "@/domain/rules/evolutionRules";
import {
  formatCompetenceLong,
  formatCompetenceShort,
} from "@/domain/rules/competence";
import { formatCurrencyBRL } from "@/lib/currency";

const COMPACT_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const WHOLE_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const CENTS_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Ticks do eixo, um estilo por eixo: compactos a partir de 10 mil; inteiros
 * abaixo disso; com centavos quando o passo nao e inteiro (ex.: 2,50).
 */
export function formatAxisValue(
  value: number,
  axisMax: number,
  step = 1,
): string {
  const formatter =
    axisMax >= 10_000
      ? COMPACT_BRL
      : Number.isInteger(step)
        ? WHOLE_BRL
        : CENTS_BRL;
  return formatter.format(value).replace(/\s/g, " ");
}

export function formatMonthTick(point: MonthlyPoint): string {
  return formatCompetenceShort(point.competence).split("/")[0];
}

/** Descricao acessivel de um mes (rotulo do alvo de foco e linha de tabela). */
export function describePoint(point: MonthlyPoint): string {
  const parts = [
    `${formatCompetenceLong(point.competence)}: gasto ${formatCurrencyBRL(point.spent)}`,
  ];

  if (point.budget !== null) {
    parts.push(`orçamento ${formatCurrencyBRL(point.budget)}`);
    parts.push(point.isOverBudget ? "acima do orçamento" : "dentro do orçamento");
  }

  return parts.join(", ");
}
