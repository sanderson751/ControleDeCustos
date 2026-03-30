# Spec - Login com Firestore

## Objetivo

Permitir autenticacao no sistema de controle de custos por:
- email e senha
- conta Google

Apos autenticacao bem-sucedida, o usuario deve ser redirecionado para a tela principal carregada por `App.tsx`.

## Escopo

- Implementar tela de login com duas opcoes de autenticacao.
- Integrar autenticacao com Firebase Authentication.
- Persistir/atualizar dados basicos do usuario no Firestore.
- Redirecionar para a aplicacao principal apos login com sucesso.

## Fora de escopo

- Recuperacao de senha.
- Cadastro com validacao avancada de perfil.
- Controle de permissao por papel (RBAC).

## Requisitos funcionais

- RF-01: O usuario deve conseguir autenticar com email e senha validos.
- RF-02: O usuario deve conseguir autenticar com conta Google.
- RF-03: Em login bem-sucedido, o sistema deve redirecionar para a tela principal (arquivo `App.tsx`).
- RF-04: Ao autenticar, deve existir um documento do usuario em `users/{uid}` no Firestore.
- RF-05: Se o documento nao existir, criar; se existir, atualizar `updatedAt`.
- RF-06: Em falha de login, exibir mensagem amigavel sem expor detalhes sensiveis.

## Requisitos nao funcionais

- RNF-01: Tempo de resposta do login <= 2s em condicao normal de rede.
- RNF-02: Fluxo deve funcionar em mobile e desktop.
- RNF-03: Campos de formulario devem possuir labels e estados de erro acessiveis.

## Regras de negocio

- RB-01: Somente usuarios autenticados podem acessar a tela principal.
- RB-02: O redirecionamento para `App.tsx` ocorre apenas apos confirmacao de autenticacao.
- RB-03: Documento em Firestore deve manter `createdAt` original e sempre atualizar `updatedAt`.

## Estrutura Firestore

Colecao:
- `users/{uid}`

Campos sugeridos:
- `uid`: string
- `displayName`: string
- `email`: string
- `photoURL`: string
- `provider`: string (`password` ou `google.com`)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp
- `lastLoginAt`: Timestamp

Exemplo de documento:

```json
{
  "uid": "abc123",
  "displayName": "Maria Silva",
  "email": "maria@email.com",
  "photoURL": "https://...",
  "provider": "google.com",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP",
  "lastLoginAt": "SERVER_TIMESTAMP"
}
```

## Fluxo principal

1. Usuario abre tela de login.
2. Usuario escolhe "Entrar com email e senha" ou "Entrar com Google".
3. Sistema autentica via Firebase Auth.
4. Sistema faz upsert do documento `users/{uid}` no Firestore.
5. Sistema redireciona para rota principal, carregando `App.tsx`.

## Criterios de aceite (Gherkin)

### Cenario 1 - Login com email e senha
Given que o usuario esta na tela de login
And possui email e senha validos
When clicar em "Entrar"
Then deve ser autenticado com sucesso
And deve ser redirecionado para a tela principal (`App.tsx`)
And o documento `users/{uid}` deve ser criado/atualizado no Firestore

### Cenario 2 - Login com Google
Given que o usuario esta na tela de login
When clicar em "Entrar com Google"
And concluir autenticacao no provedor
Then deve ser autenticado com sucesso
And deve ser redirecionado para a tela principal (`App.tsx`)
And o documento `users/{uid}` deve ser criado/atualizado no Firestore

### Cenario 3 - Erro de autenticacao
Given que o usuario informa credenciais invalidas
When tentar autenticar
Then o sistema deve exibir mensagem de erro amigavel
And nao deve redirecionar para `App.tsx`

## Tarefas tecnicas (resumo)

- Criar `LoginPage` com formulario de email/senha e botao Google.
- Integrar `signInWithEmailAndPassword` e `signInWithPopup` (GoogleAuthProvider).
- Criar servico de upsert em `users/{uid}` no Firestore.
- Proteger rota principal e redirecionar usuario autenticado para `App.tsx`.
- Criar testes de login com sucesso e falha.
