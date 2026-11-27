# Controle de Custos - Portfolio SDD + IA

Projeto de portfolio focado em engenharia de software orientada por especificação (SDD), com implementação assistida por IA de ponta a ponta.

Objetivo: demonstrar como transformar requisitos em software com previsibilidade, rastreabilidade e qualidade técnica, sem codificação manual direta pelo desenvolvedor.

## Resumo executivo

- Domínio: gestão de custos pessoais/operacionais com relatórios e controle de acesso.
- Método: SDD (Spec-Driven Development) como fluxo principal.
- Implementação: gerada por IA sob direção, revisão e validação humana.
- Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Firebase (Auth, Firestore, Hosting).
- Qualidade: typecheck, lint, testes unitários, testes de regras de segurança no emulador e merge somente via Pull Request.

## Arquitetura

SPA estática publicada no **Firebase Hosting** (plano gratuito Spark), sem servidor próprio:

- **Firebase Authentication** (email/senha e Google) direto no navegador.
- **Cloud Firestore** via SDK client, protegido por [`firestore.rules`](firestore.rules) — a camada de segurança do sistema (papéis `admin`, `standard`, `guest`, dono do dado e validação de tipos/limites), com testes automatizados no emulador.
- Regras de negócio em funções puras (`src/domain/rules`) e acesso a dados isolado em `src/services`.

> A versão anterior usava Next.js com SSR, que exige Cloud Functions (plano Blaze). A migração para SPA está documentada em [`specs/migracao-spa-vite`](specs/migracao-spa-vite/requirements.md).

## O que foi usado

- Build: Vite 8 (code splitting por rota e chunks de vendor).
- UI: React 19, React Router 8, Tailwind CSS v4, shadcn/ui (Radix), lucide-react, Sonner.
- Visual: estilo *Origin Financial* — dark como padrão, tiles cromáticos, tipografia serifada leve (Fraunces), Inter e Roboto Mono — com variante light.
- Dados: Firebase Auth + Cloud Firestore (client).
- Exportação de relatórios: jsPDF + jspdf-autotable (carregados sob demanda) e CSV.
- Testes: Vitest + React Testing Library; `@firebase/rules-unit-testing` para as regras.
- Qualidade estática: ESLint 10 (flat config) + typescript-eslint + regras de React Hooks.

## Funcionalidades

- Login com email/senha e Google; cadastro de conta.
- Controle de acesso por papéis (Admin, Standard, Guest) na UI e nas regras do Firestore.
- Dashboard por competência (navegação entre meses) com totais fixos/variáveis, consolidado por categoria e alertas de orçamento.
- Cadastro rápido com categoria e descrição opcional, listagem com busca (conta ou descrição), filtros (frente e categoria) e paginação, edição e exclusão (com confirmação) de custos.
- Parcelamento de custos fixos (um lançamento por competência).
- Lançamentos recorrentes: contas mensais cadastradas uma vez e lançadas automaticamente a cada mês (pausar, reativar, editar para os próximos meses).
- Importação de extrato ou fatura em CSV ou OFX (processada no navegador) com detecção de colunas, sugestão de categoria e aviso de duplicados.
- Orçamento por categoria só no mês ou recorrente ("este mês em diante", com histórico de vigências), com consumo, status e cópia do mês anterior.
- Alertas ao atingir 80% e ao estourar 100% do orçamento (no Início e ao cadastrar um custo).
- Evolução mensal: gráfico de gasto x orçamento por mês (6 ou 12 meses), filtros por categoria e frente, indicadores do período e visão em tabela.
- Categorias personalizadas (criar, renomear, arquivar/reativar) usadas em lançamentos, filtros, orçamentos e relatórios.
- Metas de economia: objetivos com valor-alvo e prazo, depósitos/retiradas, progresso e quanto guardar por mês (resumo no Início).
- Lista de mercado: valor previsto pelo último preço pago de cada produto, foto da comanda lida no próprio aparelho (OCR) preenchendo total e preços, comparação com o orçamento de Alimentação e conclusão que gera o lançamento de mercado e atualiza o histórico de preços.
- Relatórios por período, frente e categoria, com exportação CSV e PDF.
- Gestão de perfis de usuários (admin).
- Tema light/dark e menu lateral retrátil com preferência salva no Firestore.
- Feedback padronizado (snackbar) para sucesso, erro e warning.

## Práticas de engenharia destacadas

- SDD como contrato de desenvolvimento:
  - requisitos em `specs/<feature>/requirements.md`
  - desenho técnico em `specs/<feature>/design.md`
  - plano de execução em `specs/<feature>/tasks.md`
  - estrutura de dados e regras em `specs/<feature>/firestore-structure.md`
- Steering técnico centralizado em `.sdd/steering`.
- Agentes por papel em `.sdd/agents`, mapeados para agentes e skills de automação em `.claude/` (ver [`CLAUDE.md`](CLAUDE.md)).
- Gate obrigatório de persistência e segurança: toda escrita no Firestore tem regra e teste no emulador.
- Gate obrigatório de qualidade: `npm run verify` (typecheck + lint + testes) antes de todo PR.
- Branch `main` protegida: alterações entram somente via Pull Request.

## Como rodar localmente

Pré-requisitos:

- Node.js 20.19+ e npm 10+
- Projeto Firebase com Authentication (Email/senha e Google) e Firestore habilitados
- Java 11+ (apenas para `npm run test:rules`)

Configuração:

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha as variáveis `VITE_FIREBASE_*` do app Web.
3. Copie `.firebaserc.example` para `.firebaserc` e informe o ID do projeto.
4. `npm run dev` e acesse http://localhost:5173

Checklist de publicação (Console do Firebase, regras, migração e deploy): [`docs/pendencias-deploy.md`](docs/pendencias-deploy.md).

Primeiro administrador: todo usuário novo nasce com papel `standard`. Promova o primeiro admin
alterando `role` para `"admin"` no documento `users/{uid}` pelo Console do Firebase.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run preview` | Build de produção e pré-visualização |
| `npm run verify` | Typecheck + lint + testes unitários (gate de PR) |
| `npm run test` / `npm run test:coverage` | Testes unitários / cobertura |
| `npm run test:rules` | Testes das regras do Firestore no emulador |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright) contra os emuladores de Auth e Firestore |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run firestore:deploy` | Publica regras e índices do Firestore |
| `npm run deploy` | Verify + build + deploy no Firebase Hosting |
| `npm run migrate:legacy-google-users` | Migração única de usuários Google da versão Next.js (simulação; `-- --apply` executa) |

## Estrutura principal do repositório

- `src/domain`: entidades e regras puras de negócio.
- `src/services`: integração com Firebase Auth e Firestore.
- `src/providers`, `src/hooks`: sessão, tema e estado.
- `src/routes`, `src/pages`: roteamento, guards e telas.
- `src/components`: shadcn/ui (`ui/`), layout, componentes compartilhados e de domínio.
- `tests/rules`: testes das regras de segurança.
- `specs`: especificações funcionais por feature.
- `.sdd`: steering e contextos de agentes; `.claude`: agentes e skills de automação do fluxo SDD.

## Proposta de valor para recrutadores e tech leads

Este projeto demonstra capacidade de:

- estruturar produto com clareza de requisitos e critérios de aceite;
- manter rastreabilidade entre especificação, implementação e qualidade;
- operar um fluxo moderno de desenvolvimento com IA de forma disciplinada;
- aplicar gates técnicos e de segurança para reduzir regressão e ambiguidade;
- entregar software funcional com foco em arquitetura, processo e consistência.

## Transparência sobre uso de IA

- O código deste projeto foi produzido integralmente com suporte de IA.
- O papel do desenvolvedor foi liderar produto e engenharia:
  - definir contexto e requisitos
  - conduzir especificações
  - revisar arquitetura e qualidade
  - validar comportamento, testes e critérios de pronto

Em outras palavras: menos digitação manual, mais engenharia de decisão.

## Licença

Consulte LICENSE para detalhes.
