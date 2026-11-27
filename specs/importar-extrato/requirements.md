# Requirements - Importar extrato (CSV)

## Contexto

Lançar custo por custo é o maior atrito do app. Bancos e cartões exportam o extrato ou a fatura
em CSV. O usuário quer enviar esse arquivo, revisar e importar os gastos de uma vez, sem digitar.

## Requisitos funcionais

- RF-01: nova tela **Importar extrato** (`/import`), visível no menu apenas para `admin` e `standard`.
- RF-02: o usuário seleciona um arquivo `.csv`/`.txt` ou **`.ofx`/`.qfx`** de até 1 MB. O processamento é todo no navegador: o arquivo não é enviado a nenhum servidor nem guardado.
- RF-03: leitura tolerante a formatos de banco: separador `;`, `,` ou tab (detectado pela consistência das linhas), campos entre aspas (aspas soltas no meio do texto, como `TV 50"`, são literais), BOM, codificação UTF-8 ou Windows-1252 (acentos de arquivos antigos).
- RF-04: o app detecta as colunas **Data**, **Descrição** e **Valor** pelo cabeçalho (ex.: "Data", "Histórico", "Lançamento", "Title", "Valor", "Montante"), procurando-o nas 10 primeiras linhas (títulos do banco antes dele são pulados), e permite ajustar manualmente a linha do cabeçalho e as colunas. Sem cabeçalho reconhecido, infere pelo conteúdo (número de documento não é confundido com valor) ou avisa que não foi possível.
- RF-04a: formatos de valor suportados: **uma coluna de valor** (com sinal ou com **coluna D/C** de natureza) e **colunas separadas de débito e crédito** (Santander, Bradesco). Colunas de saldo, US$, cotação e documento nunca são usadas como valor; na fatura com R$ e US$ prevalece a coluna em R$.
- RF-05: formatos aceitos — datas `DD/MM/AAAA`, `DD/MM/AA`, `DD-MM-AAAA` e `AAAA-MM-DD`, com hora opcional, entre 2000 e o próximo ano (ex.: `99` não vira 2099); valores `1.234,56`, `-45,90`, `R$ 10,00`, `1234.56`, negativos entre parênteses, `12,00-`, `D 12,00`/`12,00 D` e menos Unicode. O separador decimal é decidido pela coluna inteira (evita ler `1.234` como 1,23 num arquivo com decimal vírgula).
- RF-06: com coluna única sem D/C, o usuário informa o que é despesa: **valores negativos** (extrato de conta) ou **valores positivos** (fatura de cartão). O app sugere pela maioria das linhas. Linhas do outro sinal (créditos/estornos) e valor zero são ignoradas e sinalizadas; quando nenhum crédito é identificado, a tela sugere conferir a configuração.
- RF-06a: linhas de **saldo/total** ("Saldo anterior", "Saldo do dia", "S A L D O", "Total") são sempre ignoradas.
- RF-07: pré-visualização com até 500 linhas: data, descrição, valor, categoria editável e situação. Cada linha válida pode ser marcada/desmarcada; há "marcar todas/desmarcar todas" e o resumo "N selecionados · total R$".
- RF-08: **sugestão de categoria** por linha: (1) a categoria já usada pelo usuário para a mesma descrição nos meses do arquivo; (2) palavras-chave (ex.: "uber" → Transporte, "ifood" → Alimentação, "farmácia" → Saúde); (3) Outros. Somente categorias ativas.
- RF-09: **possíveis duplicados** — linha com mesma data, mesmo valor e mesma descrição de um lançamento já existente fica desmarcada e sinalizada; o usuário pode marcá-la.
- RF-10: frente única para a importação (padrão **Variável**). Cada lançamento importado: conta = descrição do extrato (até 200 caracteres), competência = mês da data, data de criação = data da transação, 1 parcela, descrição = "Importado de <arquivo>".
- RF-11: ao importar, feedback de sucesso com a quantidade e navegação para Custos na competência mais recente importada. Em falha parcial, informar quantos foram gravados; essas linhas ficam marcadas como "Importado" (não selecionáveis) e as demais mantêm seleção e categoria escolhidas para nova tentativa.
- RF-12: `guest` não acessa a importação (mensagem de acesso restrito).
- RF-13: **OFX** (1.x SGML e 2.x XML, extrato de conta e fatura de cartão), reconhecido pelo conteúdo (um `.ofx` com CSV dentro é lido como CSV): as transações (`STMTTRN`) são lidas com data (`DTPOSTED`/`DTUSER`, convertida para o dia local quando há fuso), descrição (`NAME`/`MEMO`) e valor (`TRNAMT`, ponto decimal pela especificação); não há configuração de colunas. O sinal padrão vem do `TRNTYPE` (débitos negativos; emissores que invertem são detectados e avisados) e pode ser trocado. Transações com `FITID` repetido são ignoradas, arquivos com várias contas/cartões geram aviso e arquivos sem transações também. Cada transação tem identificador único mesmo em OFX de uma linha só.

## Requisitos não funcionais

- RNF-01: parser, detecção de colunas, conversão de data/valor, sugestão de categoria e duplicados em funções puras testadas.
- RNF-02: sem mudança no modelo de dados nem nas regras: cada linha vira um `costEntry` comum validado por `isValidCost`. Gravação em lotes compatíveis com o limite de acessos das regras (categorias personalizadas usam `exists()`).
- RNF-03: tema `light`/`dark` com contraste AA, apenas tokens semânticos.
- RNF-04: snackbar padrão em sucesso, validação, aviso e falha.
- RNF-05: `npm run verify` e `npm run test:rules` sem erros.

## Critérios de aceite (Given/When/Then)

### Cenário 1 — extrato de conta
- Given um CSV `Data;Histórico;Valor` com débitos negativos e um crédito positivo
- When o usuário seleciona o arquivo
- Then as colunas são detectadas, "valores negativos" é sugerido, os débitos aparecem selecionados e o crédito aparece como "Crédito ignorado"

### Cenário 2 — fatura de cartão
- Given um CSV com compras positivas e um estorno negativo
- When o usuário escolhe "valores positivos"
- Then as compras ficam selecionáveis e o estorno é ignorado

### Cenário 3 — duplicado
- Given já existe "UBER TRIP" de R$ 23,90 em 05/03/2026
- When o arquivo contém a mesma transação
- Then a linha aparece desmarcada com o aviso "Possível duplicado"

### Cenário 4 — sugestão por histórico
- Given o usuário já lançou "PADARIA SOL" em Alimentação no mês
- When importa um extrato com "Padaria Sol"
- Then a linha sugere Alimentação

### Cenário 5 — importação
- Given 3 linhas selecionadas em março e abril
- When clica em "Importar 3 lançamentos"
- Then os custos são gravados, aparece "3 lançamentos importados com sucesso." e o app abre Custos em abril

### Cenário 6 — arquivo inválido
- Given um arquivo sem coluna de valor reconhecível ou vazio
- When é selecionado
- Then um aviso explica o problema e nada é gravado

### Cenário 7 — guest
- Given um usuário `guest`
- When acessa `/import`
- Then vê a mensagem de acesso restrito e o item não aparece no menu
