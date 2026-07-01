# Requirements - <nome-da-feature>

## Contexto

Descreva a necessidade do usuario e o objetivo de negocio.

## Requisitos funcionais

- RF-01: ...
- RF-02: ...

## Requisitos nao funcionais

- RNF-01: ...
- RNF-02: ...
- RNF-03: Toda interface deve ser compativel com tema `light` e `dark` sem perda de legibilidade.
- RNF-04: Contraste minimo: texto normal >= 4.5:1 e texto grande >= 3:1.
- RNF-05: E proibido usar cor fixa para texto critico quando o fundo variar por tema.
- RNF-06: Operacoes com erro/sucesso/warning devem exibir snackbar no canto superior direito.
- RNF-07: Snackbar deve ter auto-dismiss em 3 segundos e opcao de fechar com icone `X`.
- RNF-08: Cores do snackbar por status: erro (vermelho), sucesso (verde), warning (amarelo).
- RNF-09: Toda feature que manipula dados de negocio deve persistir no Firebase Firestore (sem depender de estado local como fonte final).
- RNF-10: Cada operacao de escrita no Firestore deve ter criterio de aceite para sucesso e falha de persistencia.
- RNF-11: Implementacao deve encerrar sem erros de lint (`npm run lint`), incluindo conformidade das regras de `react-hooks`.

## Criterios de aceite (Gherkin)

### Cenario 1 - <nome>

Given ...
When ...
Then ...
