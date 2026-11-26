# Requirements - Categorias personalizadas

## Contexto

As 7 categorias padrão (Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Outros) não
cobrem a realidade de todos ("Pets", "Assinaturas", "Filhos"...). O usuário quer criar suas
próprias categorias e usá-las em lançamentos, orçamentos, relatórios e na evolução.

## Requisitos funcionais

- RF-01: nova tela **Categorias** (`/categories`) lista as categorias padrão (somente leitura, marcadas como "Padrão") e as personalizadas.
- RF-02: criar categoria personalizada informando o nome (1 a 40 caracteres).
- RF-03: o nome é único por usuário, sem diferenciar maiúsculas/minúsculas e acentos, inclusive em relação às categorias padrão.
- RF-04: renomear uma categoria personalizada; o novo nome aparece em todos os lançamentos e orçamentos que a usam.
- RF-05: **arquivar** e **reativar** uma categoria personalizada. Arquivadas não aparecem na seleção de novos lançamentos, mas continuam exibidas nos lançamentos, orçamentos, relatórios e filtros existentes. Não há exclusão (preserva o histórico).
- RF-06: limite de 20 categorias personalizadas por usuário (ativas + arquivadas).
- RF-07: categorias personalizadas ativas aparecem no cadastro/edição de custos, nos filtros (Custos, Relatórios, Evolução), na tela de Orçamentos (inclusive recorrente) e no consolidado/alertas do Início.
- RF-08: na edição de um lançamento com categoria arquivada, a categoria continua selecionada e identificada como "(arquivada)".
- RF-09: na tela de Orçamentos, categorias arquivadas só aparecem no mês em que tiverem gasto ou orçamento.
- RF-10: `guest` visualiza as categorias, sem criar, renomear ou arquivar.
- RF-11: alterações de categorias refletem em tempo real nas demais telas abertas.

## Requisitos não funcionais

- RNF-01: catálogo de categorias e validação de nome em funções puras testadas (`categoryRules.ts`).
- RNF-02: `firestore.rules`: categorias com dono, papel `admin|standard` para escrita, nome texto 1–40, `archived` booleano, sem exclusão; custos e orçamentos aceitam somente categorias padrão ou personalizadas existentes do próprio usuário.
- RNF-03: compatibilidade `light`/`dark` com contraste AA; sem cores fixas.
- RNF-04: snackbar padrão em sucesso, validação e falha.
- RNF-05: `npm run verify` e `npm run test:rules` sem erros.

## Regras de negócio

- RB-01: os ids das categorias padrão permanecem os mesmos; personalizadas usam id gerado pelo Firestore.
- RB-02: unicidade de nome e o limite de 20 são garantidos no app (as regras não conseguem contar documentos nem comparar nomes).
- RB-03: categoria desconhecida (ex.: dado inconsistente) é exibida como "Categoria removida".

## Critérios de aceite (Gherkin)

### Cenário 1 - Criar e usar uma categoria

Given um usuário standard na tela Categorias
When criar a categoria "Pets"
Then "Pets" aparece na lista como ativa
And fica disponível no cadastro de custos, nos filtros e em Orçamentos

### Cenário 2 - Nome duplicado

Given as categorias "Moradia" (padrão) e "Pets"
When tentar criar "pets" ou "moradía"
Then nada é gravado e um snackbar amarelo informa que o nome já existe

### Cenário 3 - Renomear

Given lançamentos na categoria "Pets"
When renomear para "Animais"
Then os lançamentos passam a exibir "Animais"

### Cenário 4 - Arquivar

Given a categoria "Pets" com lançamentos
When arquivá-la
Then ela não aparece no cadastro de novos custos
And os lançamentos existentes continuam exibindo "Pets"
And a edição desses lançamentos mostra "Pets (arquivada)" selecionada

### Cenário 5 - Limite

Given 20 categorias personalizadas
When tentar criar outra
Then nada é gravado e um snackbar amarelo informa o limite

### Cenário 6 - Segurança

Given um lançamento enviado diretamente ao Firestore com categoria inexistente ou de outro usuário
Then as regras negam a gravação

### Cenário 7 - Guest

Given um usuário guest
When abrir Categorias
Then vê a lista sem controles de criação, renomeação ou arquivamento
And as regras negam escrita em `categories`

## Fora de escopo

- Ocultar/renomear categorias padrão.
- Excluir categorias ou mesclar categorias.
- Cores/ícones por categoria.
