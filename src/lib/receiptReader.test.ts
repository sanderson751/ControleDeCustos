import {
  accessKeyFromQr,
  overallProgress,
  readReceipt,
  ReceiptReadCancelled,
  ReceiptReadTimeout,
} from "@/lib/receiptReader";

describe("receiptReader", () => {
  it("progresso unico: carga do OCR ate 30%, reconhecimento no restante", () => {
    expect(overallProgress("loading tesseract core", 0)).toEqual({ progress: 0, phase: "preparing" });
    expect(overallProgress("initializing api", 1)?.progress).toBeCloseTo(0.3);
    expect(overallProgress("recognizing text", 0.5)?.phase).toBe("recognizing");
    expect(overallProgress("recognizing text", 0.5)?.progress).toBeCloseTo(0.65);
    expect(overallProgress("outra coisa", 1)).toBeNull();
  });

  it("chave de acesso do QR da NFC-e", () => {
    const key = "3".repeat(44);
    expect(accessKeyFromQr(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${key}|2|1|1|abc`)).toBe(key);
    expect(accessKeyFromQr("texto qualquer")).toBeNull();
  });

  it("sinal ja cancelado rejeita sem carregar nada", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readReceipt(new Blob(["x"]), { signal: controller.signal })).rejects.toBeInstanceOf(
      ReceiptReadCancelled,
    );
  });

  it("cancelada durante o preparo: rejeita e nao reporta progresso depois", async () => {
    let decode: (value: unknown) => void = () => undefined;
    vi.stubGlobal("createImageBitmap", vi.fn(() => new Promise((resolve) => (decode = resolve))));
    const controller = new AbortController();
    const onProgress = vi.fn();

    const reading = readReceipt(new Blob(["x"]), { signal: controller.signal, onProgress });
    controller.abort();
    await expect(reading).rejects.toBeInstanceOf(ReceiptReadCancelled);

    onProgress.mockClear();
    const close = vi.fn();
    decode({ width: 10, height: 10, close });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onProgress).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("tempo limite encerra a leitura", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(() => new Promise(() => undefined)));
    await expect(readReceipt(new Blob(["x"]), { timeoutMs: 5 })).rejects.toBeInstanceOf(ReceiptReadTimeout);
    vi.unstubAllGlobals();
  });
});
