# Requirements - Migração para SPA (Vite + React) com shadcn/ui

## Contexto

Como responsável pelo produto, quero publicar o Controle de Custos no Firebase Hosting sem
depender do plano Blaze (Cloud Functions para SSR do Next.js), mantendo todas as
funcionalidades atuais, a segurança por papel e a qualidade do SDD, com uma nova identidade
visual baseada no estilo *Origin Financial*.

## Requisitos funcionais

- RF-01: a aplicação deve ser uma SPA React (sem Next.js) construída com Vite e publicável como site estático no Firebase Hosting.
- RF-02: manter todas as funcionalidades existentes: login (email/senha e Google), cadastro, dashboard do mês, CRUD de custos com parcelamento, relatórios com exportação CSV/PDF, gestão de perfis (admin), tema light/dark e menu lateral retrátil com preferência persistida.
- RF-03: autenticação via Firebase Authentication no client; sessão mantida pelo SDK.
- RF-04: acesso a dados via Firestore client SDK; remoção das API routes e do Firebase Admin em runtime.
- RF-05: controle de acesso por papel aplicado na UI e garantido por `firestore.rules`.
- RF-06: todo usuário novo nasce com papel `standard`; promoção a `admin` somente por outro admin (ou Console do Firebase).
- RF-07: admin não pode alterar o próprio papel (evita perda do último acesso administrativo).
- RF-08: rotas protegidas redirecionam visitantes para `/login` preservando a rota de origem.
- RF-09: usuários Google legados (uid = `sub` do Google via NextAuth) devem manter acesso aos próprios dados após a migração (script de importação no Firebase Auth).
- RF-10: nova UI com shadcn/ui + Tailwind CSS v4 aplicando o estilo *Origin Financial* (dark como tema padrão).

## Requisitos não funcionais

- RNF-01: build estático com code splitting por rota e chunks de vendor separados.
- RNF-02: tema `light` e `dark` com contraste AA; apenas tokens semânticos.
- RNF-03: snackbar padrão (top-right, 3s, `X`, vermelho/verde/amarelo) para todo resultado de operação.
- RNF-04: `npm run verify` (typecheck + lint + testes unitários) verde; regras do Firestore cobertas por testes no emulador.
- RNF-05: merge na `main` somente via Pull Request (branch protegida, sem CI).
- RNF-06: documentação de agentes/skills no `CLAUDE.md` e em `.claude/`.

## Regras de negócio

- RB-01: o dono do dado é o único que lê/escreve `users/{uid}/costEntries` e `users/{uid}/settings`.
- RB-02: `guest` é somente leitura nos custos; pode salvar apenas preferências de interface.
- RB-03: custos persistidos devem respeitar: conta não vazia (≤ 200), valor > 0, frente `fixo|variavel`, parcelas inteiras entre 1 e 120, competência válida.

## Critérios de aceite (Gherkin)

### Cenário 1 - Publicação estática

Given o projeto configurado com `.firebaserc` e `.env.local`
When executar `npm run deploy`
Then o site deve ser publicado no Firebase Hosting sem exigir Cloud Functions
And qualquer rota (ex.: `/costs`) deve abrir a SPA (rewrite para `index.html`)

### Cenário 2 - Autorização pelas regras

Given um usuário `standard` autenticado
When tentar alterar o próprio papel para `admin` diretamente no Firestore
Then a escrita deve ser negada pelas regras

### Cenário 3 - Guest somente leitura

Given um usuário `guest`
When tentar criar, editar ou excluir um custo (pela UI ou diretamente no Firestore)
Then a UI não deve exibir as ações
And as regras do Firestore devem negar a escrita

### Cenário 4 - Usuário Google legado

Given um usuário que entrava com Google na versão Next.js
And o script `npm run migrate:legacy-google-users -- --apply` foi executado
When ele entrar com Google na nova versão
Then deve visualizar os mesmos custos de antes

### Cenário 5 - Tema e feedback

Given qualquer tela da aplicação
When alternar entre light e dark
Then todos os textos devem permanecer legíveis (AA)
And toda operação deve exibir o snackbar padrão

## Fora de escopo

- Novas funcionalidades de negócio (orçamento por categoria, alertas) — próximos passos.
- Configuração de CI.
- Recuperação de senha.
