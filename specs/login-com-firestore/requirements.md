# Requirements - Login com Firestore

## Contexto

Como usuario do sistema de controle de custos, quero autenticar com email/senha ou conta Google para acessar minha area com seguranca.

## Requisitos funcionais

- RF-01: permitir login com email e senha via Firebase Authentication.
- RF-02: permitir login com conta Google via Firebase Authentication.
- RF-03: apos autenticacao bem-sucedida, redirecionar para a tela principal carregada por `App.tsx`.
- RF-04: garantir existencia do documento `users/{uid}` no Firestore apos login.
- RF-05: no primeiro login, criar documento do usuario com dados basicos.
- RF-06: em logins seguintes, atualizar `updatedAt` e `lastLoginAt` mantendo `createdAt`.
- RF-07: em falha de autenticacao, exibir mensagem amigavel sem detalhes sensiveis.

## Requisitos nao funcionais

- RNF-01: tempo de resposta do login de ate 2 segundos em rede normal.
- RNF-02: fluxo responsivo para mobile e desktop.
- RNF-03: formulario acessivel com labels, feedback de erro e foco visivel.

## Regras de negocio

- RB-01: somente usuarios autenticados acessam a area principal.
- RB-02: redirecionamento para `App.tsx` apenas apos autenticacao confirmada.
- RB-03: perfil de usuario autenticado deve estar sincronizado em `users/{uid}`.

## Criterios de aceite (Gherkin)

### Cenario 1 - Login com email e senha
Given que o usuario esta na tela de login
And possui email e senha validos
When clicar em "Entrar"
Then deve autenticar com sucesso
And deve ser redirecionado para a tela principal (`App.tsx`)
And deve existir documento `users/{uid}` no Firestore

### Cenario 2 - Login com Google
Given que o usuario esta na tela de login
When clicar em "Entrar com Google"
And concluir autenticacao no provedor
Then deve autenticar com sucesso
And deve ser redirecionado para a tela principal (`App.tsx`)
And deve existir documento `users/{uid}` no Firestore

### Cenario 3 - Erro de autenticacao
Given que o usuario informa credenciais invalidas
When tentar autenticar
Then deve exibir mensagem de erro amigavel
And nao deve redirecionar para `App.tsx`

## Fora de escopo

- recuperacao de senha.
- cadastro com campos avancados de perfil.
- controle de permissoes por papel (RBAC).
