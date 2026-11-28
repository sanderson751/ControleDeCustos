# Pendências antes do deploy (responsável pelo projeto)

Passos que dependem de acesso ao Console do Firebase / credenciais de produção e não
podem ser executados pelo assistente. Faça na ordem abaixo e marque ao concluir.

## 1. Habilitar o login com Google no Firebase Authentication

- [ ] Console do Firebase → **Authentication** → **Sign-in method** → **Google** → Ativar.
- [ ] Informar o email de suporte do projeto e salvar.
- [ ] Conferir que **Email/senha** também está ativo.
- [ ] Em **Settings → Authorized domains**, confirmar `localhost` e os domínios do Hosting
      (`<projeto>.web.app` e `<projeto>.firebaseapp.com` já vêm autorizados).

> Antes o login Google era feito pelo NextAuth com um OAuth client próprio
> (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`). Agora é o provedor nativo do Firebase.

## 2. Publicar regras e índices do Firestore

```bash
npx firebase login          # se ainda não estiver logado
npm run test:rules          # opcional: valida as regras no emulador (requer Java)
npm run firestore:deploy
```

- [ ] Regras e índices publicados sem erro.
- [ ] Lista compartilhada: o índice de grupo de coleções `groceryLists.memberIds` pode levar alguns
      minutos para ficar pronto (Console → Firestore → Índices → Isenções). Até lá, "Compartilhadas
      comigo" mostra erro de carregamento.
- [ ] Contas de e-mail e senha recebem o link de confirmação do e-mail pelo próprio Firebase (modelo
      em Authentication → Templates; o remetente padrão funciona no plano Spark).

> As regras novas são a única barreira de segurança do app (não há mais backend).
> Publique-as **antes** do deploy do site. Isso vale a cada nova versão das regras — por
> exemplo, as categorias personalizadas: sem as regras novas, a leitura de `categories` é
> negada e lançamentos com categoria personalizada são recusados.

## 3. Migrar usuários Google criados na versão Next.js

Usuários que entravam com Google pelo NextAuth têm `users/{uid}` com o `sub` do Google
como uid, sem usuário correspondente no Firebase Auth. Sem a migração, ao entrar com
Google na versão nova eles receberiam um uid novo e não veriam os próprios custos.

```bash
npm run migrate:legacy-google-users              # simulação: só lista, não altera nada
npm run migrate:legacy-google-users -- --apply   # executa a importação
```

- [ ] Simulação executada (usa `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e
      `FIREBASE_PRIVATE_KEY` do `.env`).
- [ ] Se listou usuários: `--apply` executado e conflitos (se houver) resolvidos manualmente.
- [ ] Depois disso, as credenciais de servidor do `.env` (`AUTH_*`, `FIREBASE_CLIENT_EMAIL`,
      `FIREBASE_PRIVATE_KEY`) podem ser removidas — o app não usa mais.

## 4. Conferir o primeiro administrador

- [ ] Em **Firestore → users**, confirmar que sua conta tem `role: "admin"`.
      Usuários novos sempre nascem `standard`; admins são promovidos por outro admin
      (tela *Perfis de usuários*) ou por aqui.

## 5. Mergear o PR e publicar o site

- [ ] Mergear o PR da migração na `main` (merge somente via PR).
- [ ] Na `main` atualizada:

```bash
npm install
npm run deploy      # verify + build + firebase deploy --only hosting
```

- [ ] Abrir a URL retornada e validar: login (email/senha e Google), custos, relatórios,
      perfis (admin) e alternância light/dark.

## Rollback

- Site: `npx firebase hosting:rollback`.
- Regras: `git checkout <commit-anterior> -- firestore.rules && npm run firestore:deploy`.
