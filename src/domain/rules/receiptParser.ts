import { MAX_PRODUCT_NAME_LENGTH, MAX_STORE_LENGTH } from "@/domain/entities/grocery";
import { normalizeSearchText } from "@/domain/rules/costRules";
import { parseStatementDate } from "@/domain/rules/statementImport";

/** Item lido na comanda (cupom NFC-e / CF-e SAT). */
export type ReceiptLine = {
  rawName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type ParsedReceipt = {
  store: string;
  /** CNPJ do emissor (14 digitos), quando legivel: identifica a loja na chave anti-duplicidade. */
  cnpj: string | null;
  /** Data da compra (meio-dia local). */
  date: Date | null;
  total: number | null;
  items: ReceiptLine[];
  itemsSum: number;
  /** Total ausente, sem itens ou divergente da soma dos itens (>= 5%): pedir conferencia. */
  totalNeedsReview: boolean;
  /** Chave de acesso da NFC-e/SAT (44 digitos, DV conferido), quando legivel. */
  accessKey: string | null;
};

const toCents = (value: number) => Math.round(value * 100);

/** Confusoes do OCR DENTRO de numeros (O->0, l/I/|->1, S->5, B->8). */
function fixDigits(token: string): string {
  return token.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
}

/**
 * Valor monetario: comeca por digito real (evita "RS 135,00" => 5135), milhar
 * opcional com ponto e 2 ou 3 casas decimais (preco unitario de pesaveis).
 */
const DIGIT = "[0-9OoIlSB|]";
const MONEY = String.raw`\d${DIGIT}{0,2}(?:\.${DIGIT}{3})*[,.]${DIGIT}{2,3}(?!${DIGIT})`;
const MONEY_RE = new RegExp(MONEY, "g");

/** "1.234,56" / "16,990" (com possiveis erros de OCR) => numero. */
export function parseMoney(raw: string): number | null {
  const fixed = fixDigits(raw.replace(/\s/g, ""));
  const match = /^(\d{1,3}(?:\.?\d{3})*)[,.](\d{2,3})$/.exec(fixed);
  if (!match) return null;
  const value = Number(`${match[1].replace(/\./g, "")}.${match[2]}`);
  return Number.isFinite(value) ? value : null;
}

/** Remove os simbolos de moeda (e suas leituras erradas) antes de procurar valores. */
function stripCurrency(line: string): string {
  return line.replace(/\bR\s?[$S5]\s?/gi, " ").replace(/\s+/g, " ");
}

function moneyValues(line: string): number[] {
  return (stripCurrency(line).match(MONEY_RE) ?? [])
    .map(parseMoney)
    .filter((value): value is number => value !== null);
}

function parseQuantity(raw: string): number | null {
  const value = Number(fixDigits(raw).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const UNITS = "UN|UND|UNID|KG|G|GR|L|LT|ML|PC|PCT|CX|FD|DZ|BD|SC|PT|GF";
const QTY = String.raw`[0-9lIO]+(?:[.,][0-9lIO]{1,3})?`;

/**
 * Cauda do item: "2 UN X 25,90 51,80", "1,234 KG x 39,900 49,24",
 * "2 UN 4,79 9,58" (sem X), "2,000 UN * 25,90 = 51,80",
 * CF-e SAT "1 UN X 4,79 (0,86) 4,79" e codigo de tributacao no fim.
 */
const ITEM_TAIL = new RegExp(
  String.raw`(?:^|\s)(${QTY})\s*(?:(${UNITS})\.?\s*[xX×*]?|[xX×*])\s*(${MONEY})\s*(?:\(\s*${MONEY}\s*\))?\s*=?\s*(${MONEY})\s*(?:[A-Z]{1,2}\d{0,2})?\s*$`,
  "i",
);

/** Inicio do item: numero sequencial e/ou codigo (3 a 14 digitos). */
const ITEM_PREFIX = /^\s*(\d{1,3})?\s*(?:\d{3,14}\s+)?/;
const STARTS_AS_ITEM = /^\s*\d{1,3}\s+\S/;

const NOT_ITEMS =
  /^(qtd|quantidade|valor|val0r|total|subtotal|acrescimo|forma|troco|cpf|consumidor|tributos|cnpj|ie\b|chave|protocolo|nfc|documento|codigo|cod\b|descri|via\b|emissao|extrato|cupom|sat\b|vl\.? aprox|cartao|dinheiro|pix\b)/i;

const ITEM_DISCOUNT = /^(desc|descto|desconto)\b/i;
const CANCELLED = /cancel/i;

type ParsedItem = ReceiptLine & { seq: number | null };

function cleanName(raw: string): string {
  return raw
    .replace(ITEM_PREFIX, "")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

function parseItems(lines: readonly string[]): ReceiptLine[] {
  const items: ParsedItem[] = [];
  let pendingName = "";
  let pendingSeq: number | null = null;
  let lastItem: ParsedItem | null = null;

  for (const line of lines) {
    const normalized = normalizeSearchText(line);

    // Desconto do item anterior ("Desc. item -2,00", "Desconto sobre item 1,29").
    if (ITEM_DISCOUNT.test(normalized) && lastItem) {
      const [discount] = moneyValues(line).slice(-1);
      if (discount && discount < lastItem.lineTotal) {
        lastItem.lineTotal = Math.round((lastItem.lineTotal - discount) * 100) / 100;
        lastItem.unitPrice = Math.round((lastItem.lineTotal / lastItem.quantity) * 1000) / 1000;
      }
      lastItem = null;
      continue;
    }

    // Item cancelado: "ITEM 002 CANCELADO" remove o item; linha cancelada com valores e ignorada.
    if (CANCELLED.test(normalized)) {
      const seq = /item\s*(\d{1,3})/i.exec(line)?.[1];
      if (seq) {
        const index = items.findIndex((item) => item.seq === Number(seq));
        if (index !== -1) items.splice(index, 1);
      }
      pendingName = "";
      lastItem = null;
      continue;
    }

    if (NOT_ITEMS.test(normalized)) {
      pendingName = "";
      lastItem = null;
      continue;
    }

    const tail = ITEM_TAIL.exec(stripCurrency(line));

    if (!tail) {
      // Descricao longa numa linha e valores na seguinte: so se a linha parece inicio de item.
      pendingName = STARTS_AS_ITEM.test(line) && /\p{L}{3,}/u.test(line) ? cleanName(line) : "";
      pendingSeq = pendingName ? Number(ITEM_PREFIX.exec(line)?.[1] ?? NaN) || null : null;
      lastItem = null;
      continue;
    }

    const quantity = parseQuantity(tail[1]);
    const unitPrice = parseMoney(tail[3]);
    const lineTotal = parseMoney(tail[4]);
    const head = stripCurrency(line).slice(0, tail.index);
    const ownName = cleanName(head);
    const useOwn = /\p{L}{2,}/u.test(ownName);
    const rawName = useOwn ? ownName : pendingName;
    const seqText = useOwn ? ITEM_PREFIX.exec(head)?.[1] : null;
    const seq = seqText ? Number(seqText) : useOwn ? null : pendingSeq;
    pendingName = "";

    if (!quantity || unitPrice === null || lineTotal === null || !rawName) {
      lastItem = null;
      continue;
    }

    lastItem = {
      rawName: rawName.slice(0, 120),
      quantity,
      unit: (tail[2] ?? "UN").toUpperCase(),
      unitPrice,
      lineTotal,
      seq,
    };
    items.push(lastItem);
  }

  return items.map(({ seq: _seq, ...item }) => item);
}

/** Rotulos tolerantes a OCR (VAL0R, VAL0R A PAGAR...). */
const LABEL = {
  toPay: /va[l1i]?[o0]r\s*a\s*pagar|total\s*a\s*pagar/,
  total: /va[l1i]?[o0]r\s*t[o0]tal|^t[o0]tal\b|t[o0]tal\s*r?\$?\s*\d/,
  discount: /^desc[o0]nt[o0]s?\b|^descontos?\s*r?\$?/,
  paid: /va[l1i]?[o0]r\s*pag[o0]/,
  change: /^tr[o0]c[o0]\b/,
};

function lastMoney(line: string): number | null {
  const values = moneyValues(line);
  return values.length ? values[values.length - 1] : null;
}

/**
 * Total pago: "a pagar" > (total - desconto) > total > "valor pago" (so sem
 * troco, pois com troco o valor pago e maior que a compra).
 */
function parseTotal(lines: readonly string[]): number | null {
  let toPay: number | null = null;
  let total: number | null = null;
  let discount: number | null = null;
  let paid: number | null = null;
  let hasChange = false;

  for (const line of lines) {
    const normalized = normalizeSearchText(line);
    if (/itens/.test(normalized)) continue;
    const value = lastMoney(line);

    if (LABEL.change.test(normalized)) hasChange = true;
    if (value === null) continue;

    if (toPay === null && LABEL.toPay.test(normalized)) toPay = value;
    else if (total === null && LABEL.total.test(normalized)) total = value;
    else if (discount === null && LABEL.discount.test(normalized)) discount = value;
    else if (paid === null && LABEL.paid.test(normalized)) paid = value;
  }

  if (toPay !== null && toPay > 0) return toPay;
  if (total !== null && total > 0) {
    return discount !== null && discount > 0 && discount < total
      ? Math.round((total - discount) * 100) / 100
      : total;
  }
  if (paid !== null && paid > 0 && !hasChange) return paid;
  return null;
}

function parseDate(lines: readonly string[], now: Date): Date | null {
  const preferred = lines.filter((line) => /emiss|data|dt\.?\s*\d/i.test(line));
  const others = lines.filter((line) => !/tel|fone|cel|whats/i.test(line));

  for (const line of [...preferred, ...others]) {
    for (const match of line.matchAll(/\b(\d{2}[/.-]\d{2}[/.-]\d{2,4})\b/g)) {
      const date = parseStatementDate(match[1], now);
      if (date) return date;
    }
  }

  return null;
}

/** Digito verificador (modulo 11) da chave de acesso de 44 digitos. */
export function isValidAccessKey(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false;
  const model = key.slice(20, 22);
  if (model !== "65" && model !== "59" && model !== "55") return false;

  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(key[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const digit = rest < 2 ? 0 : 11 - rest;
  return digit === Number(key[43]);
}

/** Chave de acesso: 44 digitos (em grupos ou juntos), validada pelo DV. */
function parseAccessKey(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    for (const match of line.matchAll(/\d[\d\s.]{42,}\d/g)) {
      const digits = match[0].replace(/\D/g, "");
      for (let start = 0; start + 44 <= digits.length; start += 1) {
        const candidate = digits.slice(start, start + 44);
        if (isValidAccessKey(candidate)) return candidate;
      }
    }
  }
  return null;
}

function parseCnpj(text: string): string | null {
  const match = /CNPJ[^\d]{0,6}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i.exec(text);
  return match ? match[1].replace(/\D/g, "") : null;
}

/** Nome da loja: primeira linha com letras que nao e saudacao, CNPJ, endereco ou documento. */
function parseStore(lines: readonly string[]): string {
  const store = lines
    .slice(0, 6)
    .find(
      (line) =>
        /\p{L}{3,}/u.test(line) &&
        !/\*|bem[\s-]?vindo|obrigad|cnpj|cpf|rua|av\.|avenida|documento|auxiliar|nota fiscal|ie:|inscri|extrato|cupom/i.test(
          line,
        ),
    );
  return (store ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_STORE_LENGTH);
}

/**
 * Interpreta o texto do OCR de um cupom NFC-e/SAT: itens (com desconto e
 * cancelamento), total pago, data, loja, CNPJ e chave de acesso.
 * Nada e gravado sem revisao do usuario.
 */
export function parseReceiptText(text: string, now: Date = new Date()): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const items = parseItems(lines);
  const itemsSum = items.reduce((sum, item) => sum + toCents(item.lineTotal), 0) / 100;
  const total = parseTotal(lines);

  return {
    store: parseStore(lines),
    cnpj: parseCnpj(text),
    date: parseDate(lines, now),
    total,
    items,
    itemsSum,
    totalNeedsReview:
      total === null ||
      items.length === 0 ||
      Math.abs(itemsSum - total) / total >= 0.05,
    accessKey: parseAccessKey(text),
  };
}

// ---------------------------------------------------------------------------
// Associacao a produtos
// ---------------------------------------------------------------------------

export type MatchCandidate = {
  id: string;
  normalizedName: string;
  aliases: readonly string[];
};

/** Chave de apelido: sem acento/caixa/espacos (tolera "12UN" x "12 UN"), ate 80 caracteres. */
export function aliasKey(name: string): string {
  return normalizeSearchText(name).replace(/\s+/g, "").slice(0, MAX_PRODUCT_NAME_LENGTH);
}

/** Palavras relevantes: sem numeros/medidas ("5KG", "1L", "500G") e conectivos. */
function tokens(name: string): string[] {
  return normalizeSearchText(name)
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length >= 2 &&
        // Numeros, medidas ("5kg") e unidades soltas ("KG", "UN").
        !/^\d*([.,]\d+)?(kg|g|gr|l|lt|ml|un|und|pct|cx)?$/.test(token) &&
        !["de", "da", "do", "em", "com", "e", "c", "tp", "tipo"].includes(token),
    );
}

/**
 * Similaridade (0..1) entre o nome lido (com marca: "ARROZ TIPO 1 TIO JOAO 5KG")
 * e o do catalogo (generico: "Arroz 5kg"). So e alta quando TODAS as palavras
 * do catalogo aparecem e a primeira bate ("LEITE CONDENSADO" nao vira
 * "Leite integral"; "BISCOITO DE ARROZ" nao vira "Arroz").
 */
export function nameSimilarity(receiptName: string, catalogName: string): number {
  const a = tokens(receiptName);
  const b = tokens(catalogName);
  if (!a.length || !b.length) return 0;

  const matches = (x: string, y: string) =>
    x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)));
  const hitsA = a.filter((x) => b.some((y) => matches(x, y))).length;
  const hitsB = b.filter((y) => a.some((x) => matches(x, y))).length;
  const dice = (hitsA + hitsB) / (a.length + b.length);

  return matches(a[0], b[0]) && hitsB === b.length ? 0.6 + 0.4 * dice : dice * 0.7;
}

export const MATCH_THRESHOLD = 0.6;
/** A partir desta nota a associacao automatica e aprendida como apelido. */
export const CONFIDENT_MATCH = 0.9;

/** Nota de um nome lido para um candidato: 1 se ja e apelido; senao a similaridade. */
export function matchScore(rawName: string, candidate: MatchCandidate): number {
  return candidate.aliases.includes(aliasKey(rawName)) ? 1 : nameSimilarity(rawName, candidate.normalizedName);
}

/** Produto mais provavel para o nome lido (null quando nada passa do limite). */
export function matchReceiptLine(
  rawName: string,
  candidates: readonly MatchCandidate[],
): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = matchScore(rawName, candidate);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { id: candidate.id, score };
    }
  }
  return best;
}

/**
 * Chave anti-duplicidade: chave de acesso valida; senao hash de emissor
 * (CNPJ ou loja) + dia + total. Sem data nao ha chave (evita bloquear
 * compras diferentes da mesma loja com o mesmo valor).
 */
export function receiptKeyOf(receipt: {
  accessKey: string | null;
  cnpj?: string | null;
  store: string;
  date: Date | null;
  total: number;
}): string | null {
  if (receipt.accessKey && isValidAccessKey(receipt.accessKey)) return receipt.accessKey;
  if (!receipt.date || !(receipt.total > 0)) return null;
  const day = `${receipt.date.getFullYear()}${String(receipt.date.getMonth() + 1).padStart(2, "0")}${String(receipt.date.getDate()).padStart(2, "0")}`;
  const issuer =
    receipt.cnpj ?? (normalizeSearchText(receipt.store).replace(/[^a-z0-9]/g, "").slice(0, 20) || "loja");
  return `h-${issuer}-${day}-${toCents(receipt.total)}`.slice(0, 64);
}
