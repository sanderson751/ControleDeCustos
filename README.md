# Controle de Custos - Portfolio SDD + IA

Projeto de portfolio focado em engenharia de software orientada por especificacao (SDD), com implementacao assistida por IA de ponta a ponta.

Objetivo: demonstrar como transformar requisitos em software com previsibilidade, rastreabilidade e qualidade tecnica, sem codificacao manual direta pelo desenvolvedor.

## Resumo executivo

- Dominio: gestao de custos pessoais/operacionais com relatorios e controle de acesso.
- Metodo: SDD (Spec-Driven Development) como fluxo principal.
- Implementacao: gerada por IA sob direcao, revisao e validacao humana.
- Stack: Next.js + React + TypeScript + Firebase Firestore.
- Qualidade: lint, testes automatizados e gates de persistencia.

## O que foi usado

- Frontend: Next.js 15 (App Router), React 18, TypeScript.
- UI: Bootstrap 5, Material Design Icons, React Tooltip.
- Autenticacao: NextAuth.
- Persistencia: Firebase Firestore (client + admin).
- Exportacao de relatorios: jsPDF + jspdf-autotable, CSV.
- Testes: Jest + React Testing Library.
- Qualidade estatica: ESLint 9 (flat config) com foco em regras de React Hooks.

## O que foi implementado nesta versao

- Autenticacao e sessao de usuario.
- Controle de acesso por papeis (Admin, Standard, Guest).
- Fluxo de custos com cadastro, listagem, edicao e remocao.
- Regras de negocio para custos fixos e variaveis.
- Relatorios com filtros por periodo e tipo de custo.
- Exportacao de relatorios em CSV e PDF.
- App shell com menu lateral, app bar e preferencias de interface.
- Feedback visual padronizado para sucesso, erro e warning.
- Persistencia em Firestore como fonte final de verdade.

## Praticas de engenharia destacadas

- SDD como contrato de desenvolvimento:
  - requisitos em specs/<feature>/requirements.md
  - desenho tecnico em specs/<feature>/design.md
  - plano de execucao em specs/<feature>/tasks.md
  - estrutura de dados em specs/<feature>/firestore-structure.md
- Steering tecnico centralizado em .sdd/steering.
- Agentes por papel em .sdd/agents para padronizar qualidade de decisao.
- Gate obrigatorio de persistencia (nao concluir feature de dados sem Firestore).
- Gate obrigatorio de qualidade:
  - npm run lint sem erros
  - conformidade com react-hooks/rules-of-hooks e react-hooks/exhaustive-deps
  - testes automatizados para fluxos criticos e regressao

## Como rodar localmente

Pre-requisitos:

- Node.js 20+
- npm 10+
- Projeto Firebase configurado

Instalacao e execucao:

1. npm install
2. npm run dev
3. acessar http://localhost:3000

Build e producao:

1. npm run build
2. npm run start

Qualidade:

1. npm run lint
2. npm run lint:fix
3. npm run test
4. npm run test:coverage

Firestore:

1. npm run firestore:deploy

## Estrutura principal do repositorio

- src/app: rotas, layouts e paginas (incluindo areas protegidas e APIs).
- src/components: componentes de interface e shell autenticado.
- src/services: servicos de dominio e integracao.
- src/hooks: hooks customizados de estado e permissoes.
- src/views: telas de negocio e testes de interface.
- specs: especificacoes funcionais por feature.
- .sdd: guias de steering e contextos de agentes.

## Proposta de valor para recrutadores e tech leads

Este projeto demonstra capacidade de:

- estruturar produto com clareza de requisitos e criterios de aceite.
- manter rastreabilidade entre especificacao, implementacao e qualidade.
- operar um fluxo moderno de desenvolvimento com IA de forma disciplinada.
- aplicar gates tecnicos para reduzir regressao e ambiguidade.
- entregar software funcional com foco em arquitetura, processo e consistencia.

## Transparencia sobre uso de IA

- O codigo deste projeto foi produzido integralmente com suporte de IA.
- O papel do desenvolvedor foi liderar produto e engenharia:
  - definir contexto e requisitos
  - conduzir especificacoes
  - revisar arquitetura e qualidade
  - validar comportamento, testes e criterios de pronto

Em outras palavras: menos digitacao manual, mais engenharia de decisao.

## Licenca

Consulte LICENSE para detalhes.
