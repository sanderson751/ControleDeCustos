import {
  buildCsvContent,
  buildReportFileName,
  downloadBlob,
} from "@/lib/reportExport";
import { makeCostEntry } from "@/test/factories";

describe("buildCsvContent", () => {
  it("gera CSV com BOM, cabecalho e valores no padrao pt-BR", () => {
    const csv = buildCsvContent([
      makeCostEntry({
        accountName: 'Mercado "Central"',
        amount: 1234.5,
        costType: "fixo",
        category: "alimentacao",
        installmentsTotal: 3,
        competenceMonth: 4,
        competenceYear: 2026,
        createdAt: new Date(2026, 3, 2, 12),
      }),
    ]);

    expect(csv.startsWith("﻿")).toBe(true);
    const [header, row] = csv.slice(1).split("\n");
    expect(header).toBe(
      '"Conta";"Categoria";"Frente";"Valor";"Data de criação";"Competência";"Parcelas"',
    );
    expect(row).toBe(
      '"Mercado ""Central""";"Alimentação";"Fixo";"1234,50";"02/04/2026";"04/2026";"3"',
    );
  });
});

describe("buildReportFileName", () => {
  it("inclui periodo e extensao", () => {
    expect(buildReportFileName("2026-11-01", "2026-11-30", "pdf")).toBe(
      "relatorio-custos-2026-11-01-a-2026-11-30.pdf",
    );
  });
});

describe("downloadBlob", () => {
  it("cria link temporario, dispara o download e libera a URL", () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadBlob("a;b", "arquivo.csv", "text/csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
