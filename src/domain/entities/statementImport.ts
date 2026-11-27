import type { CostCategory } from "@/domain/entities/cost";

/** Linhas da planilha ja separadas em celulas (sem linhas vazias). */
export type StatementTable = string[][];

/** Tabela + numero da linha fisica do arquivo (1-based) de cada linha. */
export type ParsedStatement = {
  table: StatementTable;
  lineNumbers: number[];
};

/**
 * Como o valor aparece no arquivo:
 * - single: uma coluna de valor, com sinal ou com coluna de natureza (D/C) opcional;
 * - split: colunas separadas de debito e credito (Santander, Bradesco...).
 */
export type AmountColumns =
  | { kind: "single"; column: number; nature: number | null }
  | { kind: "split"; debit: number; credit: number };

/** Indices (0-based) das colunas e da linha de cabecalho. */
export type ColumnMapping = {
  /** Indice da linha de cabecalho na tabela; null = sem cabecalho. */
  headerRow: number | null;
  date: number;
  description: number;
  amount: AmountColumns;
};

/** Sinal que representa despesa no arquivo (somente coluna unica de valor). */
export type ExpenseSign = "negativo" | "positivo";

/** Separador decimal predominante nas colunas de valor. */
export type DecimalSeparator = "," | ".";

/**
 * ok: despesa importavel; credito: entrada/estorno/zero; informativa: saldo
 * ou total do extrato; invalida: data/valor/descricao ausente.
 */
export type ImportRowStatus = "ok" | "credito" | "informativa" | "invalida";

export type ImportRow = {
  /** Linha fisica no arquivo (1-based), identificador estavel da linha. */
  line: number;
  date: Date | null;
  description: string;
  /** Valor absoluto (null quando invalido). */
  amount: number | null;
  status: ImportRowStatus;
  /** Motivo quando `invalida`. */
  reason?: string;
};

/** Linha pronta para gravar (status ok) com as escolhas do usuario. */
export type ImportSelection = {
  row: ImportRow & { date: Date; amount: number };
  category: CostCategory;
};

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;
/** Tamanho maximo da conta (espelhado em firestore.rules). */
export const MAX_ACCOUNT_NAME_LENGTH = 200;
/** Linhas iniciais examinadas em busca do cabecalho (titulos antes dele). */
export const HEADER_SEARCH_ROWS = 10;
