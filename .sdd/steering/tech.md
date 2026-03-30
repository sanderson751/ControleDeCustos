# Technical Steering

## Stack oficial

- Frontend: React + Vite + TypeScript.
- UI: Bootstrap 5.
- Testes: Jest + React Testing Library.
- Persistencia: Firebase Firestore.

## Diretrizes arquiteturais

- Componentes funcionais com hooks.
- Separar UI, estado e acesso a dados em camadas.
- Preferir tipagem explícita para entidades de domínio.

## Qualidade e testes

- Todo componente crítico deve ter testes de renderização e interação.
- Regras de negócio devem ser testadas em funções puras sempre que possível.
- Bugs corrigidos devem ganhar teste de regressão.

## Convenções técnicas

- Estados locais com `useState` e composição com custom hooks quando necessário.
- Side effects isolados com `useEffect` e limpeza adequada.
- Formatação de moeda em BRL centralizada em utilitário.
- Acesso a dados centralizado em `src/services/firestore`.
- Timestamps de criação e atualização com `serverTimestamp()`.

## Exemplo técnico

Para o cálculo de gasto por categoria no mês, usar função pura:

`sumByCategory(entries, month, year)`

com teste cobrindo:
- lançamento fora do mês não entra no cálculo;
- categoria sem lançamento retorna zero;
- múltiplos lançamentos na mesma categoria são somados corretamente.
