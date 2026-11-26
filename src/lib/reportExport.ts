import { COST_TYPE_LABELS, type CostEntry } from "@/domain/entities/cost";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatCompetence, formatDateBR } from "@/lib/dates";

export const REPORT_HEADER = [
  "Conta",
  "Frente",
  "Valor",
  "Data de criação",
  "Competência",
  "Parcelas",
] as const;

function toRow(entry: CostEntry, amount: string): string[] {
  return [
    entry.accountName,
    COST_TYPE_LABELS[entry.costType],
    amount,
    formatDateBR(entry.createdAt),
    formatCompetence(entry.competenceMonth, entry.competenceYear),
    String(entry.installmentsTotal),
  ];
}

/** CSV separado por ";" (padrao Excel pt-BR) com BOM para acentuacao correta. */
export function buildCsvContent(entries: readonly CostEntry[]): string {
  const rows = [
    [...REPORT_HEADER],
    ...entries.map((entry) =>
      toRow(entry, entry.amount.toFixed(2).replace(".", ",")),
    ),
  ];

  return (
    "﻿" +
    rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";"),
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
) {
  downloadBlob(
    buildCsvContent(entries),
    buildReportFileName(startDate, endDate, "csv"),
    "text/csv;charset=utf-8",
  );
}

/** jsPDF e carregado sob demanda para nao pesar o bundle inicial. */
export async function exportPdf(
  entries: readonly CostEntry[],
  startDate: string,
  endDate: string,
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
    body: entries.map((entry) => toRow(entry, formatCurrencyBRL(entry.amount))),
    headStyles: { fillColor: [15, 16, 17] },
  });

  pdf.save(buildReportFileName(startDate, endDate, "pdf"));
}
