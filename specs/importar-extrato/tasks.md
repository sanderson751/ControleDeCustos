# Tasks - Importar extrato (CSV)

> Referência obrigatória: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Domínio

- [x] Tipos de importação (`statementImport.ts`) e limites (500 linhas, 1 MB, conta até 200).
- [x] Parser CSV (separador detectado, aspas, CRLF, BOM) e conversão de data/valor no formato dos bancos.
- [x] Detecção de colunas (cabeçalho ou conteúdo), sinal das despesas, linhas com status.
- [x] Sugestão de categoria (histórico > palavras-chave > Outros) e duplicados por multiplicidade.
- [x] Testes unitários.

## Fase 2 - Aplicação

- [x] `decodeStatementFile` (UTF-8 com fallback Windows-1252).
- [x] `batchChunks` compartilhado (limite de categorias personalizadas e de operações por lote); `budgetService` passa a usá-lo.
- [x] `importService` com falha parcial (`ImportPartialError`).
- [x] Tela **Importar extrato** (`/import`): arquivo, configuração de colunas/sinal/frente, pré-visualização com seleção, categoria por linha e situação; item no menu para `admin`/`standard`.

## Fase 3 - Qualidade

- [x] Regras do Firestore sem alteração; teste no emulador do lote de importação (10 personalizadas + guest negado).
- [x] `npm run verify` e `npm run test:rules` sem erros.
- [x] Validação visual light/dark.
- [x] Revisão de QA.

## Definição de pronto

- [x] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
