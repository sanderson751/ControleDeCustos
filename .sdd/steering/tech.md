# Technical Steering

## Stack oficial

- Runtime/build: Node.js >= 20.19 + Vite 8 (SPA estática, sem servidor).
- Frontend: React 19 + TypeScript + React Router 8.
- UI: Tailwind CSS v4 + shadcn/ui (Radix UI) + lucide-react. Estilo visual "Origin Financial".
- Autenticação: Firebase Authentication (email/senha e Google) via SDK client.
- Persistência: Firebase Cloud Firestore via SDK client, protegida por `firestore.rules`.
- Hospedagem: Firebase Hosting (plano Spark, sem Cloud Functions).
- Testes: Vitest + React Testing Library (jsdom); regras do Firestore com `@firebase/rules-unit-testing` no emulador.
- Qualidade estática: ESLint 10 (flat config em `eslint.config.js`) + typescript-eslint.

## Diretrizes arquiteturais

- Componentes funcionais com hooks.
- Separar UI (`pages`/`components`), estado (`hooks`/`providers`), regras puras (`domain/rules`) e acesso a dados (`services`).
- Somente `src/services` importa `firebase/*`; componentes nunca acessam o Firebase diretamente.
- Preferir tipagem explícita para entidades de domínio (`src/domain/entities`).
- Sem backend: toda autorização é aplicada por `firestore.rules`. A matriz de permissões da UI (`src/domain/rules/permissions.ts`) deve estar espelhada nas regras.

## Qualidade e testes

- Todo componente crítico deve ter testes de renderização e interação.
- Regras de negócio devem ser testadas em funções puras sempre que possível.
- Todo serviço do Firestore deve ter teste unitário com o SDK mockado (`src/test/firestoreMock.ts`).
- Toda regra de segurança nova/alterada deve ter cenário em `tests/rules/firestore.rules.test.ts` (`npm run test:rules`).
- Bugs corrigidos devem ganhar teste de regressão.
- `npm run verify` (typecheck + lint + test) deve passar antes de qualquer PR.

## Convenções técnicas

- Estados locais com `useState` e composição com custom hooks quando necessário.
- Side effects isolados com `useEffect` e limpeza adequada (flags `isActive`/unsubscribe).
- Dependências de hooks devem respeitar `react-hooks/exhaustive-deps`.
- Formatação de moeda em BRL centralizada em `src/lib/currency.ts`.
- Acesso a dados centralizado em `src/services` com caminhos em `src/services/firestorePaths.ts`.
- Timestamps de criação e atualização com `serverTimestamp()`.
- Toda feature que cria, altera ou remove dados de negócio deve persistir no Firebase Firestore (não é permitido fluxo final apenas em estado local).
- Toda persistência deve ter tratamento de erro e feedback visível para o usuário.
- Toda feature nova deve incluir/atualizar `firestore-structure.md` com coleções, campos, regras de acesso e índices.
- Variáveis de ambiente do client usam o prefixo `VITE_` (são públicas por design).

## Lint e padrão de hooks (obrigatório)

- Configuração oficial no arquivo `eslint.config.js`.
- Scripts oficiais: `npm run lint` e `npm run lint:fix`.
- Regras de hooks obrigatórias: `react-hooks/rules-of-hooks` e `react-hooks/exhaustive-deps`.
- Ajustes de hooks devem priorizar `useCallback`/`useMemo` quando necessário para estabilizar dependências, evitando suprimir regra sem justificativa técnica.

## Compatibilidade de tema (obrigatório)

- Toda UI deve ser compatível com tema `light` e `dark` sem perda de legibilidade (dark é o tema padrão).
- É proibido usar cor fixa para texto crítico (ex.: `text-white`, `#000`) quando o fundo muda por tema.
- Componentes devem usar tokens semânticos do Tailwind/shadcn (ex.: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `bg-destructive`), definidos em `src/index.css`.
- Superfícies cromáticas (tiles de categoria `bg-iris`, `bg-periwinkle`, `bg-orchid`) usam sempre `text-tile-foreground`.
- Contraste mínimo: texto normal >= 4.5:1 e texto grande >= 3:1.
- Toda feature visual deve incluir validação em ambos os temas (render, hover, foco, disabled, alerta e erro).

## Feedback de operação (obrigatório)

- Toda operação/ação com resultado de erro, sucesso ou warning deve chamar `notify(status, mensagem)` (`src/lib/notify.ts`).
- O snackbar (Sonner) aparece no canto superior direito, por 3 segundos, com botão de fechar `X`.
- Cores obrigatórias por status: erro (vermelho), sucesso (verde), warning (amarelo) — tokens `--danger`, `--success`, `--warning`.

## Exemplo técnico

Para o cálculo de gasto por categoria no mês, usar função pura em `src/domain/rules`:

`sumByCategory(entries, month, year)`

com teste cobrindo:

- lançamento fora do mês não entra no cálculo;
- categoria sem lançamento retorna zero;
- múltiplos lançamentos na mesma categoria são somados corretamente.
