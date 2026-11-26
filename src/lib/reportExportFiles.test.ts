import { exportCsv, exportPdf } from "@/lib/reportExport";
import { makeCostEntry } from "@/test/factories";

const { pdfInstance, autoTable } = vi.hoisted(() => ({
  pdfInstance: {
    setFontSize: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  },
  autoTable: vi.fn(),
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function JsPdfMock() {
    return pdfInstance;
  }),
}));

vi.mock("jspdf-autotable", () => ({ default: autoTable }));

describe("exportacao de relatorios", () => {
  it("exportPdf gera tabela paisagem com cabecalho e salva com o periodo", async () => {
    const entry = makeCostEntry({
      accountName: "Internet",
      amount: 99.9,
      costType: "fixo",
    });

    await exportPdf([entry], "2026-11-01", "2026-11-30");

    expect(pdfInstance.text).toHaveBeenCalledWith(
      "Relatório de Custos (2026-11-01 a 2026-11-30)",
      14,
      14,
    );
    const options = autoTable.mock.calls[0][1];
    expect(options.head[0]).toContain("Competência");
    expect(options.body[0]).toEqual(
      expect.arrayContaining(["Internet", "Fixo", "R$ 99,90"]),
    );
    expect(pdfInstance.save).toHaveBeenCalledWith(
      "relatorio-custos-2026-11-01-a-2026-11-30.pdf",
    );
  });

  it("exportCsv baixa o arquivo .csv do periodo", () => {
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:csv"),
      revokeObjectURL: vi.fn(),
    });
    let downloadName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        downloadName = this.download;
      },
    );

    exportCsv([makeCostEntry()], "2026-11-01", "2026-11-30");

    expect(downloadName).toBe("relatorio-custos-2026-11-01-a-2026-11-30.csv");
  });
});
