# CLAUDE.md — Controle de Custos

Guia para o Claude Code trabalhar neste repositório. Leia antes de qualquer tarefa.
Idioma do projeto: **português (Brasil)** — código em inglês, textos de UI/docs/commits em pt-BR.

## Visão geral

SPA de controle de custos pessoais (custos fixos/variáveis, parcelamento, relatórios CSV/PDF e
controle de acesso por papel). Desenvolvida com **Spec-Driven Development (SDD)**: toda mudança
nasce de uma spec em `specs/<feature>/` e segue o steering em `.sdd/steering/`.

## Stack

| Camada       | Tecnologia                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| Build/dev    | Node.js ≥ 20.19 + **Vite 8**                                               |
| UI           | **React 19** + TypeScript 6 + **React Router 8** (modo SPA)                |
| Estilo       | **Tailwind CSS v4** + **shadcn/ui** (Radix) + lucide-react                 |
| Tema         | Estilo *Origin Financial* (dark principal + variante light) — `src/index.css` |
| Feedback     | Sonner (snackbar padrão via `notify()` em `src/lib/notify.ts`)             |
| Backend      | **Sem servidor**: Firebase Auth + Cloud Firestore (SDK client)             |
| Hospedagem   | **Firebase Hosting** (estático, plano Spark) — `firebase.json`             |
| Testes       | Vitest 5 + RTL + jsdom; regras e E2E (Playwright) nos emuladores Firebase  |
| Qualidade    | ESLint 10 (flat config) + typescript-eslint + react-hooks                  |

## Comandos

```bash
npm run dev            # servidor local (http://localhost:5173)
npm run build          # typecheck + build de produção em dist/
npm run preview        # serve o build localmente
npm run typecheck      # tsc -b
npm run lint           # ESLint (zero erros obrigatório) | lint:fix para autofix
npm run test           # testes unitários (Vitest)
npm run test:coverage  # cobertura (v8)
npm run test:rules     # testes das regras do Firestore no emulador (requer Java)
npm run test:e2e       # testes E2E (Playwright + emuladores Auth/Firestore; usa o Chrome instalado)
npm run ocr:assets     # copia os arquivos do OCR (Tesseract) para public/ocr (automático em dev/build/e2e)
npm run verify         # typecheck + lint + test  ← gate obrigatório antes de PR
npm run deploy         # verify + build + firebase deploy --only hosting
npm run firestore:deploy  # publica firestore.rules e firestore.indexes.json
```

Configuração local: copie `.env.example` → `.env.local` (variáveis `VITE_FIREBASE_*`) e
`.firebaserc.example` → `.firebaserc`.

## Arquitetura

```
src/
  main.tsx, App.tsx        # bootstrap: ThemeProvider > AuthProvider > Router + Toaster
  index.css                # tokens do tema (Tailwind v4 @theme + variáveis shadcn)
  domain/
    entities/              # tipos de domínio (CostEntry, UserProfile, UserRole...)
    rules/                 # regras PURAS e testadas (totais, parcelas, validação, permissões)
  services/                # ÚNICO ponto que fala com Firebase (Auth/Firestore)
  providers/               # AuthProvider (sessão + perfil em tempo real), ThemeProvider
  hooks/                   # hooks de dados/estado (useMonthCosts, useUiPreferencesSync)
  routes/                  # router, guards (ProtectedRoute/PublicOnlyRoute/RequireRole), navegação
  pages/                   # telas (uma por rota, lazy-loaded)
  components/
    ui/                    # shadcn/ui gerado pela CLI — evite editar à mão
    layout/                # AppShell, AppSidebar, AppHeader
    shared/                # PageHeader, StatTile, SegmentedControl, LoadingButton...
    costs/, users/         # componentes de domínio
  lib/                     # utilitários (firebase, currency, dates, errors, notify, reportExport)
  test/                    # setup, factories, mocks e helpers de render
tests/rules/               # testes de firestore.rules (emulador)
tests/e2e/                 # testes E2E (Playwright) + support/ (semeadura nos emuladores)
scripts/                   # scripts operacionais (ex.: migração de usuários Google legados)
```

Fluxo de dados: `pages` → `hooks`/`services` → Firebase. Componentes **nunca** importam
`firebase/*` diretamente; regras de negócio ficam em `domain/rules` (funções puras).

### Segurança (crítico)

Não há backend: **`firestore.rules` é a única barreira de segurança**. A matriz de permissões da
UI (`src/domain/rules/permissions.ts`) apenas esconde ações — ela DEVE estar espelhada nas regras.

- `admin`: CRUD nos próprios custos + altera nome/papel de **outros** usuários.
- `standard`: CRUD nos próprios custos.
- `guest`: somente leitura.
- Novo usuário sempre nasce `standard`; o primeiro admin é promovido no Console do Firebase.

Ao alterar `firestore.rules`, `permissions.ts` ou o modelo de dados: atualize
`tests/rules/firestore.rules.test.ts` e rode `npm run test:rules`.

### Modelo de dados (Firestore)

```
users/{uid}                        # perfil + role (admin|standard|guest)
users/{uid}/settings/profile       # ui.theme, ui.sidebarCollapsed, currency, locale
users/{uid}/categories/{categoryId}   # categoria personalizada: userId, name, archived (sem exclusao)
users/{uid}/recurringCosts/{id}     # recorrencia mensal + cursor lastGenerated; gera costEntries/rec-{id}-{AAAA-MM}
users/{uid}/savingsGoals/{id}       # meta: name, targetAmount, deadlineYear/Month (opcional)
users/{uid}/goalContributions/{id}  # movimentacao imutavel: goalId, amount (+deposito/-retirada), date, note
users/{uid}/groceryProducts/{id}    # catalogo de mercado: name, unit, lastUnitPrice/previousUnitPrice, intervalos
users/{uid}/groceryLists/{id}       # lista: items{itemId} (mapa, grava por item), status aberta|concluida (concluida = somente leitura), paidTotal
users/{uid}/groceryPurchases/{id}   # compra imutavel: itens com preco pago, total, costEntryId, receiptKey
users/{uid}/groceryReceiptKeys/{key} # comanda ja lancada (id = chave NFC-e/hash): impede lancar duas vezes
users/{uid}/costEntries/{entryId}  # accountName, amount, costType, category, description, installmentsTotal, recurringId?,
                                   # competenceYear, competenceMonth, createdAt, updatedAt
users/{uid}/budgetLimits/{AAAA-MM-categoria}     # orçamento de um único mês (exceção)
users/{uid}/recurringBudgets/{AAAA-MM-categoria} # vigência recorrente a partir do mês (limit null = encerra)
```

Categorias padrão (valores sem acento): `moradia, alimentacao, transporte, saude, educacao,
lazer, outros`. Categorias personalizadas usam o id do documento em `categories` (validado nas
regras com `exists()`) e nunca são excluídas, só arquivadas. Lançamentos legados sem categoria são lidos como `outros`. A competência
visualizada em Início/Custos/Orçamentos fica na URL (`?mes=AAAA-MM`).

Detalhes por feature em `specs/<feature>/firestore-structure.md`. Índices em `firestore.indexes.json`.

## Regras obrigatórias (DoD transversal)

Checklist completo: `specs/_template/dod-checklist.md`. Resumo:

1. **Persistência**: toda feature que cria/edita/exclui dados persiste no Firestore com tratamento
   de erro e feedback. Nunca encerrar com dados só em estado local.
2. **Snackbar padrão**: todo resultado de erro/sucesso/warning usa `notify(status, msg)` —
   top-right, 3s, botão `X`, vermelho/verde/amarelo (configurado no `<Toaster />`).
3. **Tema**: toda UI funciona em `light` e `dark` com contraste AA. Use **apenas tokens
   semânticos** (`bg-card`, `text-muted-foreground`, `bg-primary`...). Proibido hex/cor fixa em
   componentes cujo fundo muda com o tema. Tiles cromáticos usam `text-tile-foreground`.
4. **Lint/hooks**: `npm run lint` sem erros; respeitar `rules-of-hooks` e `exhaustive-deps`
   (estabilizar com `useCallback`/`useMemo`, não suprimir).
5. **Testes**: toda regra de negócio, serviço e tela crítica tem teste unitário; bug corrigido
   ganha teste de regressão. `npm run verify` verde antes de abrir PR.
6. **Specs coerentes**: `requirements.md`, `design.md`, `tasks.md` e `firestore-structure.md`
   da feature atualizados junto com o código.

## Convenções de código

- Imports absolutos com `@/` (alias para `src/`).
- Componentes `PascalCase.tsx`; hooks `useAlgo.ts`; utilitários `camelCase.ts`;
  testes colocados ao lado: `Arquivo.test.ts(x)`.
- Componentes shadcn: adicione com `npx shadcn@latest add <componente>`; após gerar, troque
  `from "cn"` (bug da CLI) por `from "@/lib/utils"` se aparecer.
- **Testes: use apenas os globals do Vitest** (`describe/it/expect/vi`) — não faça
  `import ... from "vitest"` (no Windows/Git Bash carrega outra instância e quebra a suíte).
  Mocks de módulos no topo com `vi.mock`; variáveis usadas na fábrica via `vi.hoisted`.
  `@/lib/firebase` já é mockado globalmente em `src/test/setup.ts`; para Firestore use
  `createFirestoreMock()` de `src/test/firestoreMock.ts`.
- Textos de UI em pt-BR com acentuação; mensagens de erro amigáveis via `src/lib/errors.ts`.

## Fluxo Git (obrigatório)

- **Nunca** commitar direto na `main`: ela é protegida no GitHub e só recebe merge via **Pull Request**.
- Crie branch a partir da `main` atualizada: `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`.
- Antes de abrir o PR: `npm run verify` verde (+ `npm run test:rules` se mexeu em regras/dados; + `npm run test:e2e` se mexeu em fluxos de tela, serviços ou regras).
- Commits em pt-BR, no imperativo e focados (ex.: `feat(custos): adiciona orçamento por categoria`).
- **Sem atribuição de IA**: nunca incluir `Co-Authored-By` de IA, "Generated with ..." ou qualquer menção a ferramentas de IA em commits, PRs ou textos informativos.
- Não há CI configurado: a validação é local e responsabilidade de quem abre o PR.
- Use a skill `/abrir-pr` para o passo a passo.

## SDD: agentes e skills

O conteúdo de referência dos papéis vive em `.sdd/agents/*.md` (fonte da verdade). Os agentes
do Claude Code em `.claude/agents/` encapsulam esses papéis para delegação:

| Agente (`.claude/agents/`) | Contexto SDD                          | Quando usar                                      |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| `business-analyst`         | `.sdd/agents/business-analyst.md`     | Requisitos, critérios Given/When/Then            |
| `product-owner`            | `.sdd/agents/product-owner.md`        | Priorização, MVP, DoD de itens                   |
| `solution-architect`       | `.sdd/agents/solution-architect.md`   | `design.md`, contratos, `firestore-structure.md` |
| `frontend-engineer`        | `.sdd/agents/frontend-engineer.md`    | Implementação React/shadcn + testes RTL          |
| `qa-engineer`              | `.sdd/agents/qa-engineer.md`          | Matriz de testes, validação de DoD e regras      |
| `data-analyst`             | `.sdd/agents/data-analyst.md`         | KPIs, métricas e relatórios                      |

Skills do projeto (`.claude/skills/`):

| Skill             | Uso                                                                  |
| ----------------- | -------------------------------------------------------------------- |
| `/sdd-feature`    | Inicia uma feature: cria `specs/<feature>/` a partir do template e conduz requisitos → design → tasks → implementação |
| `/sdd-dod`        | Executa o Definition of Done (verify, regras, checklist, tema)       |
| `/abrir-pr`       | Branch → commits → push → PR para `main` (nunca push direto na main) |
| `/firebase-deploy`| Build e deploy no Firebase Hosting / publicação de regras e índices   |

Fluxo SDD resumido: steering (`.sdd/steering/`) → `requirements.md` → `design.md` →
`firestore-structure.md` → `tasks.md` → implementação + testes → DoD → PR.
