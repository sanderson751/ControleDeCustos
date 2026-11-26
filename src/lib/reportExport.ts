import {
  COST_TYPE_LABELS,
  type CostCategory,
  type CostEntry,
} from "@/domain/entities/cost";
import { DEFAULT_CATALOG } from "@/domain/rules/categoryRules";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatCompetence, formatDateBR } from "@/lib/dates";

/** Rotulo de categoria (catalogo do usuario; padrao quando omitido). */
export type CategoryLabeler = (id: CostCategory) => string;

export const REPORT_HEADER = [
  "Conta",
  "Descrição",
  "Categoria",
  "Frente",
  "Valor",
  "Data de criação",
  "Competência",
  "Parcelas",
] as const;

function toRow(
  entry: CostEntry,
  amount: string,
  labelOf: CategoryLabeler,
): string[] {
  return [
    entry.accountName,
    entry.description,
    labelOf(entry.category),
    COST_TYPE_LABELS[entry.costType],
    amount,
    formatDateBR(entry.createdAt),
    formatCompetence(entry.competenceMonth, entry.competenceYear),
    String(entry.installmentsTotal),
  ];
}

/**
 * Evita injecao de formulas no Excel/Sheets: celulas iniciadas por = + - @
 * (ou tab/CR) recebem um apostrofo, que as torna texto literal.
 */
export function neutralizeFormula(cell: string): string {
  return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
}

/** CSV separado por ";" (padrao Excel pt-BR) com BOM para acentuacao correta. */
export function buildCsvContent(
  entries: readonly CostEntry[],
  labelOf: CategoryLabeler = DEFAULT_CATALOG.labelOf,
): string {
  const rows = [
    [...REPORT_HEADER],
    ...entries.map((entry) =>
      toRow(entry, entry.amount.toFixed(2).replace(".", ","), labelOf),
    ),
  ];

  return (
    "﻿" +
    rows
      .map((row) =>
        row
          .map((cell) => `"${neutralizeFormula(cell).replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n")
  );
}

export function buildReportFileName(
  startDate: string,
  endDate: string,
  extension: "csv" | "pdf",
): string {
  return `relatorio-custos-${startDate}-a-${endDate}.${extension}`;
}

export function downloadBlob(
  content: BlobPart,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export function exportCsv(
  entries: readonly CostEntry[],
  startDate: string,
  endDate: string,
  labelOf: CategoryLabeler = DEFAULT_CATALOG.labelOf,
) {
  downloadBlob(
    buildCsvContent(entries, labelOf),
    buildReportFileName(startDate, endDate, "csv"),
    "text/csv;charset=utf-8",
  );
}

/** jsPDF e carregado sob demanda para nao pesar o bundle inicial. */
export async function exportPdf(
  entries: readonly CostEntry[],
  startDate: string,
  endDate: string,
  labelOf: CategoryLabeler = DEFAULT_CATALOG.labelOf,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(12);
  pdf.text(`Relatório de Custos (${startDate} a ${endDate})`, 14, 14);

  autoTable(pdf, {
    startY: 22,
    head: [[...REPORT_HEADER]],
    body: entries.map((entry) =>
      toRow(entry, formatCurrencyBRL(entry.amount), labelOf),
    ),
    headStyles: { fillColor: [15, 16, 17] },
  });

  pdf.save(buildReportFileName(startDate, endDate, "pdf"));
}
