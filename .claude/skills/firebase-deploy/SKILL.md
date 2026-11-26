---
name: firebase-deploy
description: Publica o app no Firebase Hosting e/ou as regras e índices do Firestore com as verificações do projeto. Use quando o usuário pedir para publicar, fazer deploy, subir para produção ou publicar regras do Firestore.
---

# Deploy no Firebase

Deploy afeta produção: confirme com o usuário **o que** será publicado (hosting, regras,
índices) antes de executar, e só faça deploy a partir de código já mergeado na `main`
(ou com autorização explícita do usuário para outra branch).

## Pré-requisitos

- `firebase login` feito na máquina (`npx firebase login`).
- `.firebaserc` com o projeto (`.firebaserc.example` como base) e `.env.local` com `VITE_FIREBASE_*`.
- No Console do Firebase: Authentication com provedores **Email/senha** e **Google** habilitados.

## Passos

1. `git status` limpo e branch correta.
2. `npm run verify` (e `npm run test:rules` se regras mudaram) — tudo verde.
3. Regras/índices mudaram? Publique antes do app:
   ```bash
   npm run firestore:deploy
   ```
4. App:
   ```bash
   npm run build
   npx firebase deploy --only hosting
   ```
   (ou `npm run deploy`, que executa verify + build + hosting).
5. Reporte a URL de Hosting retornada pela CLI e peça uma checagem rápida (login, custos,
   relatórios, tema light/dark).

## Rollback

`npx firebase hosting:rollback` restaura a versão anterior do Hosting. Regras do Firestore
voltam publicando a versão anterior de `firestore.rules` (via `git checkout <commit> -- firestore.rules`).
