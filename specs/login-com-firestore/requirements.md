# Requirements - Login com Firestore

## Contexto

Como usuario do sistema de controle de custos, quero autenticar com email/senha ou conta Google para acessar minha area com seguranca.

## Requisitos funcionais

- RF-01: permitir login com email e senha via Firebase Authentication (SDK client).
- RF-02: permitir login com conta Google via Firebase Authentication (popup).
- RF-03: apos autenticacao bem-sucedida, redirecionar para a rota protegida `/home` (ou para a rota protegida de origem).
- RF-04: garantir existencia do documento `users/{uid}` no Firestore apos login/cadastro (transacao no client, validada por `firestore.rules`).
- RF-05: no primeiro login, criar documento do usuario com dados basicos e role `standard` (nunca auto-promocao).
- RF-06: em logins seguintes, atualizar `updatedAt` e `lastLoginAt` mantendo `createdAt`.
- RF-07: em falha de autenticacao, exibir mensagem amigavel sem detalhes sensiveis.
- RF-08: a sessao autenticada e mantida pelo Firebase Auth (persistencia local do navegador) e exposta pelo `AuthProvider` para rotas e telas.
- RF-09: no login com email/senha, quando as credenciais forem invalidas (email inexistente ou senha incorreta), exibir a mensagem unica "Email ou senha incorretos." (atualizado em 2026-11: o Firebase Auth com protecao contra enumeracao de emails nao distingue os casos, e a mensagem unica evita expor quais emails existem).
- RF-10: (substituido pelo RF-09 em 2026-11).
- RF-11: nao permitir contas duplicadas por email entre provedores diferentes (configuracao "uma conta por endereco de email" do Firebase Auth).
- RF-12: o email deve ser unico no sistema, independentemente do provedor utilizado.

## Requisitos nao funcionais

- RNF-01: tempo de resposta do login de ate 2 segundos em rede normal.
- RNF-02: fluxo responsivo para mobile e desktop.
- RNF-03: formulario acessivel com labels, feedback de erro e foco visivel.
- RNF-04: telas de autenticacao devem manter legibilidade em temas `light` e `dark` com contraste minimo AA.
- RNF-05: Feedback de erro/sucesso/warning deve usar snackbar no canto superior direito.
- RNF-06: Snackbar deve permanecer por 3 segundos e permitir fechar com icone `X`.
- RNF-07: Cores por status: erro (vermelho), sucesso (verde), warning (amarelo).
- RNF-08: O perfil autenticado em `users/{uid}` deve ser persistido no Firestore como fonte final da verdade em cada login/cadastro.
- RNF-09: Falhas de persistencia no Firestore (criacao/atualizacao de perfil) devem ser tratadas com feedback e sem inconsistencias de sessao.

## Regras de negocio

- RB-01: somente usuarios autenticados acessam a area principal.
- RB-02: redirecionamento para `/home` apenas apos autenticacao confirmada e sessao valida.
- RB-03: perfil de usuario autenticado deve estar sincronizado em `users/{uid}`.
- RB-04: um email pode estar vinculado a apenas um usuario no sistema.
- RB-05: tentativa de cadastro/login social com email ja vinculado a outro usuario deve ser bloqueada com mensagem amigavel.

## Criterios de aceite (Gherkin)

### Cenario 1 - Login com email e senha

Given que o usuario esta na tela de login
And possui email e senha validos
When clicar em "Entrar"
Then deve autenticar com sucesso
And deve ser redirecionado para a rota protegida `/home`
And deve existir documento `users/{uid}` no Firestore

### Cenario 2 - Login com Google

Given que o usuario esta na tela de login
When clicar em "Entrar com Google"
And concluir autenticacao no provedor
Then deve autenticar com sucesso
And deve ser redirecionado para a rota protegida `/home`
And deve existir documento `users/{uid}` no Firestore

### Cenario 3 - Erro de autenticacao

Given que o usuario informa credenciais invalidas
When tentar autenticar
Then deve exibir mensagem de erro amigavel
And nao deve redirecionar para `/home`

### Cenario 4 - Credenciais invalidas (email inexistente ou senha incorreta)

Given que o email informado nao existe na base ou a senha esta incorreta
When o usuario tentar autenticar
Then o sistema deve exibir "Email ou senha incorretos."
And nao deve redirecionar para `/home`

### Cenario 5 - (incorporado ao Cenario 4 em 2026-11)

### Cenario 6 - Unicidade de email entre provedores

Given que ja existe uma conta com determinado email
When houver tentativa de criar outra conta com o mesmo email por outro provedor
Then o sistema deve bloquear a operacao
And deve exibir mensagem amigavel informando que o email ja esta em uso

## Fora de escopo

- recuperacao de senha.
- cadastro com campos avancados de perfil.
- controle de permissoes por papel (RBAC).
