/**
 * Leitura da foto da comanda no proprio navegador (nada e enviado a servidor):
 * 1. pre-processa a imagem (tamanho, tons de cinza e contraste);
 * 2. tenta ler o QR Code da NFC-e (BarcodeDetector, quando o navegador tem);
 * 3. roda o OCR (Tesseract.js, portugues) carregado sob demanda de /ocr/<versao>/
 *    (caminho versionado: o Hosting guarda em cache por 1 ano).
 */

/** Arquivos do OCR copiados por scripts/copy-ocr-assets.mjs (versao definida no vite.config.ts). */
const OCR_BASE = `/ocr/${__OCR_VERSION__}`;
/** Leitura travada (aparelho lento, sem memoria): desiste e libera o worker. */
const DEFAULT_TIMEOUT_MS = 120_000;

export type ReadPhase = "preparing" | "recognizing";

export type ReadOptions = {
  /** Progresso 0-1 (preparo ate 30%, reconhecimento no restante) e a fase atual. */
  onProgress?: (progress: number, phase: ReadPhase) => void;
  /** Cancela a leitura (botao "Cancelar leitura"). */
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** Leitura cancelada pelo usuario. */
export class ReceiptReadCancelled extends Error {
  constructor() {
    super("Leitura cancelada.");
    this.name = "ReceiptReadCancelled";
  }
}

/** Leitura passou do tempo limite. */
export class ReceiptReadTimeout extends Error {
  constructor() {
    super("A leitura demorou demais.");
    this.name = "ReceiptReadTimeout";
  }
}

export type ReceiptReading = {
  text: string;
  /** Confianca media do OCR (0-100). */
  confidence: number;
  /** Chave de acesso da NFC-e lida do QR Code (44 digitos), se houver. */
  qrAccessKey: string | null;
};

/** Largura alvo: texto de cupom fica legivel sem pesar o OCR no celular. */
const TARGET_WIDTH = 1600;
const MIN_WIDTH = 1000;

/**
 * Decodifica ja reduzida (foto de 12 MP nao ocupa ~48 MB na memoria);
 * navegadores sem as opcoes de redimensionar decodificam inteira.
 */
async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { resizeWidth: TARGET_WIDTH, resizeQuality: "high" });
  } catch {
    return createImageBitmap(file);
  }
}

/** Fases de carga do Tesseract (antes do reconhecimento), em ordem. */
const LOADING_PHASES = [
  "loading tesseract core",
  "initializing tesseract",
  "loading language traineddata",
  "initializing api",
];
const PREPARE_SHARE = 0.3;

/** Desenha a foto em escala de cinza com contraste esticado (percentis 2%/98%). */
function preprocess(bitmap: ImageBitmap): HTMLCanvasElement {
  const scale =
    bitmap.width > TARGET_WIDTH
      ? TARGET_WIDTH / bitmap.width
      : bitmap.width < MIN_WIDTH
        ? MIN_WIDTH / bitmap.width
        : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Seu navegador não permite processar a imagem.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const histogram = new Array<number>(256).fill(0);
  const gray = new Uint8ClampedArray(data.length / 4);

  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const value = Math.round(0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]);
    gray[index] = value;
    histogram[value] += 1;
  }

  const percentile = (ratio: number) => {
    let count = 0;
    const target = gray.length * ratio;
    for (let value = 0; value < 256; value += 1) {
      count += histogram[value];
      if (count >= target) return value;
    }
    return 255;
  };
  const low = percentile(0.02);
  const high = Math.max(low + 1, percentile(0.98));

  for (let index = 0; index < gray.length; index += 1) {
    const stretched = ((gray[index] - low) * 255) / (high - low);
    const offset = index * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = stretched;
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<Array<{ rawValue: string }>>;
};

/** QR da NFC-e: URL com "p=<chave de 44 digitos>|..." (ou "chNFe=<chave>"). */
export function accessKeyFromQr(rawValue: string): string | null {
  const match = /(?:[?&]p=|chNFe=)(\d{44})/.exec(rawValue) ?? /\b(\d{44})\b/.exec(rawValue);
  return match ? match[1] : null;
}

async function readQrAccessKey(bitmap: ImageBitmap): Promise<string | null> {
  const Detector = (globalThis as { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;

  if (!Detector) return null;

  try {
    const codes = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
    for (const code of codes) {
      const key = accessKeyFromQr(code.rawValue);
      if (key) return key;
    }
  } catch {
    // Sem QR legivel: segue so com o OCR.
  }
  return null;
}

/** Mapeia as mensagens do Tesseract para um progresso unico (0-1). */
export function overallProgress(status: string, progress: number): { progress: number; phase: ReadPhase } | null {
  if (status === "recognizing text") {
    return { progress: PREPARE_SHARE + (1 - PREPARE_SHARE) * progress, phase: "recognizing" };
  }
  const index = LOADING_PHASES.indexOf(status);
  if (index === -1) return null;
  const step = PREPARE_SHARE / LOADING_PHASES.length;
  return { progress: step * index + step * Math.min(1, Math.max(0, progress)), phase: "preparing" };
}

/**
 * Le a foto da comanda. Cancelavel (`signal`) e com tempo limite; em
 * qualquer saida o worker do OCR e encerrado e a imagem liberada.
 */
export async function readReceipt(file: Blob, options: ReadOptions = {}): Promise<ReceiptReading> {
  const { onProgress, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  let worker: { terminate: () => Promise<unknown> } | null = null;
  let finished = false;
  let stop: ((error: Error) => void) | null = null;
  const stopped = new Promise<never>((_, reject) => {
    stop = reject;
  });
  stopped.catch(() => undefined);
  if (signal?.aborted) throw new ReceiptReadCancelled();
  const onAbort = () => stop?.(new ReceiptReadCancelled());
  const timer = setTimeout(() => stop?.(new ReceiptReadTimeout()), timeoutMs);
  signal?.addEventListener("abort", onAbort, { once: true });
  // Depois de cancelada/expirada, a carga em andamento nao reporta mais progresso.
  const report = (progress: number, phase: ReadPhase) => {
    if (!finished) onProgress?.(progress, phase);
  };
  const ensureAlive = () => {
    if (finished) throw new ReceiptReadCancelled();
  };

  const run = async (): Promise<ReceiptReading> => {
    report(0, "preparing");
    const bitmap = await loadBitmap(file);

    try {
      ensureAlive();
      const canvas = preprocess(bitmap);
      const qrAccessKey = await readQrAccessKey(bitmap);
      ensureAlive();
      const { createWorker, PSM } = await import("tesseract.js");
      ensureAlive();
      const created = await createWorker("por", 1, {
        workerPath: `${OCR_BASE}/worker.min.js`,
        corePath: OCR_BASE,
        langPath: OCR_BASE,
        // Dados do idioma no IndexedDB por versao (troca junto com os arquivos).
        cachePath: OCR_BASE,
        logger: (message: { status: string; progress: number }) => {
          const mapped = overallProgress(message.status, message.progress);
          if (mapped) report(mapped.progress, mapped.phase);
        },
      });
      // Cancelada/expirada enquanto o OCR carregava: encerra o worker recem-criado.
      if (finished) {
        await created.terminate();
        throw new ReceiptReadCancelled();
      }
      worker = created;

      // Cupom: uma coluna de texto com tamanhos variados.
      await created.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" });
      const { data } = await created.recognize(canvas);
      return { text: data.text, confidence: data.confidence, qrAccessKey };
    } finally {
      bitmap.close();
    }
  };

  try {
    return await Promise.race([run(), stopped]);
  } finally {
    finished = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    const current = worker as { terminate: () => Promise<unknown> } | null;
    await current?.terminate().catch(() => undefined);
  }
}
