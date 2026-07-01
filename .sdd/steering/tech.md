# Technical Steering

## Stack oficial

- Frontend: Next.js (App Router) + React + TypeScript.
- UI: Bootstrap 5.
- Testes: Jest + React Testing Library.
- Persistencia: Firebase Firestore.
- Qualidade estatica: ESLint 9 (flat config em `eslint.config.mjs`).

## Diretrizes arquiteturais

- Componentes funcionais com hooks.
- Separar UI, estado e acesso a dados em camadas.
- Preferir tipagem explícita para entidades de domínio.

## Qualidade e testes

- Todo componente crítico deve ter testes de renderização e interação.
- Regras de negócio devem ser testadas em funções puras sempre que possível.
- Bugs corrigidos devem ganhar teste de regressão.
- O projeto deve manter `npm run lint` sem erros antes de concluir qualquer feature.

## Convenções técnicas

- Estados locais com `useState` e composição com custom hooks quando necessário.
- Side effects isolados com `useEffect` e limpeza adequada.
- Dependencias de hooks devem respeitar `react-hooks/exhaustive-deps`.
- Formatação de moeda em BRL centralizada em utilitário.
- Acesso a dados centralizado em `src/services/firestore`.
- Timestamps de criação e atualização com `serverTimestamp()`.
- Toda feature que cria, altera ou remove dados de negocio deve persistir no Firebase Firestore (nao e permitido fluxo final apenas em estado local).
- Toda persistencia deve ter tratamento de erro e feedback visivel para o usuario.
- Toda feature nova deve incluir/atualizar `firestore-structure.md` com colecoes, campos e regras de acesso.

## Lint e padrao de hooks (obrigatorio)

- Configuracao oficial no arquivo `eslint.config.mjs`.
- Scripts oficiais: `npm run lint` e `npm run lint:fix`.
- Regras de hooks obrigatorias: `react-hooks/rules-of-hooks` e `react-hooks/exhaustive-deps`.
- Ajustes de hooks devem priorizar `useCallback`/`useMemo` quando necessario para estabilizar dependencias, evitando suprimir regra sem justificativa tecnica.

## Compatibilidade de tema (obrigatorio)

- Toda UI deve ser compativel com tema `light` e `dark` sem perda de legibilidade.
- E proibido usar cor fixa para texto critico (ex.: `color: white`, `#000`) quando o fundo muda por tema.
- Componentes devem usar tokens semanticos (ex.: `--text-primary`, `--btn-primary-text`, `--alert-danger-text`) e nunca valores diretos hardcoded.
- Variaveis de framework (Bootstrap `--bs-*`) devem ser mapeadas para os tokens do tema ativo dentro do container da aplicacao.
- Contraste minimo: texto normal >= 4.5:1 e texto grande >= 3:1.
- Toda feature visual deve incluir validacao em ambos os temas (render, hover, foco, disabled, alerta e erro).

## Feedback de operacao (obrigatorio)

- Toda operacao/acao com resultado de erro, sucesso ou warning deve renderizar snackbar padrao.
- O snackbar deve aparecer no canto superior direito da tela.
- Tempo de exibicao automatico: 3 segundos.
- O snackbar deve possuir opcao de fechar manualmente com icone `X`.
- Cores obrigatorias por status: erro (vermelho), sucesso (verde), warning (amarelo).

## Exemplo técnico

Para o cálculo de gasto por categoria no mês, usar função pura:

`sumByCategory(entries, month, year)`

com teste cobrindo:

- lançamento fora do mês não entra no cálculo;
- categoria sem lançamento retorna zero;
- múltiplos lançamentos na mesma categoria são somados corretamente.
