# Design - Importar extrato (CSV)

## Visão geral

Fluxo 100% no navegador: arquivo → texto → tabela → linhas de importação → pré-visualização →
gravação em lote. Nenhuma coleção nova; cada linha selecionada vira um `costEntry`.

```
File ─► decodeStatementFile (lib) ─► parseCsv ─► detectColumns ─► buildImportRows
                                                                     │
       listCostsByCompetenceRange (existentes) ─► findDuplicates ◄───┤
                                                  suggestCategory ◄──┘
                                                         │
                         ImportPage (pré-visualização) ─► importCostEntries (lotes)
```

## Domínio (`src/domain/rules/statementImport.ts`, puro)

| Função | Responsabilidade |
| ------ | ---------------- |
| `parseStatement(text)` | Separador pela moda de ocorrências nas 20 primeiras linhas; aspas só no início do campo (RFC 4180 tolerante); CRLF, BOM, linhas vazias; guarda a linha física de cada registro. |
| `parseStatementDate(raw)` | `DD/MM/AAAA`, `DD/MM/AA` (20AA), `DD-MM-AAAA`, `AAAA-MM-DD` → `Date` ao meio-dia local; inválida → `null`. |
| `parseStatementAmount(raw)` | Remove `R$`/espaços; decide decimal pelo último separador; parênteses e `-` final = negativo; inválido → `null`. |
| `detectColumns(table)` | Procura o cabeçalho nas 10 primeiras linhas (antes da 1ª data): data, descrição e valor único (+ coluna D/C) ou débito/crédito separados; exclui saldo, US$, cotação, documento; prefere "R$". Sem cabeçalho, infere por conteúdo exigindo valor com casas decimais. |
| `detectDecimalSeparator` / `parseNature` | Decimal predominante da coluna; natureza D/C, Débito/Crédito, Entrada/Saída. |
| `isInformativeDescription` | Saldo/total → status `informativa`. |
| `detectExpenseSign(rows)` | Maioria negativa → `"negativo"`, senão `"positivo"`. |
| `buildImportRows(table, mapping, sign)` | Gera `ImportRow` com `status`: `ok`, `credito` (sinal oposto/zero) ou `invalida` (data/valor/descrição ausente), limitando a 500. |
| `suggestCategory(description, history, catalog)` | Histórico (mesma descrição normalizada, categoria ativa) → palavras-chave (somente categorias padrão) → `outros`. |
| `findDuplicateLines(rows, existing)` | Chave `AAAA-MM-DD|centavos|descrição normalizada` comparada a `createdAt`/`amount`/`accountName` dos existentes. |
| `toImportInput(row, options)` | Converte para `NewCostInput` (conta até 200, descrição "Importado de <arquivo>" até 500, `createdAtManual` = data). |

Tipos em `src/domain/entities/statementImport.ts`: `StatementTable`, `ColumnMapping`,
`ExpenseSign`, `ImportRow`, `MAX_IMPORT_ROWS = 500`, `MAX_IMPORT_FILE_BYTES = 1 MB`.

## Infra

- `src/lib/statementFile.ts`: `decodeStatementFile(buffer)` — `TextDecoder("utf-8", { fatal: true })`, fallback `windows-1252`; remove BOM.
- `src/services/batchChunks.ts`: `commitInChunks(operations)` genérico (extraído do `budgetService`): no máximo 10 categorias personalizadas distintas e 400 operações por batch.
- `src/services/importService.ts`: `importCostEntries(userId, inputs)` grava em lotes; em falha lança `ImportPartialError` com `imported` (quantidade já gravada).

## Tela (`src/pages/ImportPage.tsx`, rota `/import`)

1. **Arquivo**: input de arquivo + nome/linhas lidas. Valida tamanho, vazio, colunas.
2. **Configuração**: selects de coluna (Data, Descrição, Valor), "Despesas no arquivo" (negativos/positivos) e "Frente".
3. **Pré-visualização**: tabela com checkbox, data, descrição, valor, categoria (`NativeSelect` com categorias ativas), situação (badge: "Possível duplicado", "Crédito ignorado", "Linha inválida"). Resumo e botão "Importar N lançamentos".

Estados: carregando existentes (duplicados/histórico) com proteção a corrida; seleção e
categoria por linha guardadas por número da linha; ao trocar mapeamento/sinal, as linhas são
recalculadas e a seleção volta ao padrão.

Navegação: item "Importar" (`FileUpIcon`) com `visibleTo: ["admin", "standard"]`; a página também
verifica `canMutateCosts` (acesso direto pela URL).

## Decisões

- **Sem coleção de "importações"**: desfazer é feito pela busca em Custos ("Importado de ...").
- **Frente única**: extratos não distinguem fixo/variável; o usuário ajusta depois se precisar.
- **Lotes não atômicos entre si**: necessário pelo limite de acessos das regras; a falha parcial é
  informada e as linhas não gravadas continuam disponíveis.
- **OFX fora de escopo** nesta versão (CSV é o formato comum aos bancos brasileiros).
- **Falha parcial**: `planChunks` preserva a ordem, então as primeiras `imported` linhas da seleção são marcadas como importadas localmente (não dependem do recarregamento dos existentes).
- **Desempenho**: linhas da pré-visualização memoizadas; palavras-chave compiladas uma vez por categoria.
