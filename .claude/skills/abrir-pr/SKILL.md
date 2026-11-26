---
name: abrir-pr
description: Fluxo Git obrigatório do projeto — garante branch fora da main, roda o gate de qualidade, cria commits em pt-BR, faz push e abre Pull Request para main com gh. A main é protegida e só aceita merge via PR. Use quando o usuário pedir para commitar, subir, publicar alterações ou abrir PR.
---

# Abrir Pull Request

A branch `main` é protegida no GitHub: **todo merge exige PR**. Não existe CI — o gate é local.

## Passos

1. **Branch**: `git branch --show-current`. Se estiver na `main`, crie uma branch descritiva
   (`feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`) antes de qualquer commit.
2. **Gate**: rode `npm run verify`. Se o diff tocar regras/dados, rode também `npm run test:rules`.
   Pare e reporte se algo falhar.
3. **Revisão**: `git status` e `git diff`. Não inclua `.env*`, `.firebaserc`,
   `.claude/settings.local.json`, `dist/` ou `coverage/`.
4. **Commits**: mensagens em pt-BR, imperativo, padrão `tipo(escopo): descrição`
   (ex.: `feat(relatorios): adiciona filtro por categoria`). Agrupe por assunto.
5. **Push**: `git push -u origin <branch>`.
6. **PR**: `gh pr create --base main` com título curto e corpo contendo:
   - Resumo do que muda e por quê (link para `specs/<feature>/`).
   - Como testar (comandos + passos manuais, incluindo light/dark).
   - Impacto em `firestore.rules`/índices e se exige `npm run firestore:deploy`.
   - Checklist do DoD (`/sdd-dod`) com o resultado real dos gates.
7. Informe o link do PR ao usuário. **Não faça merge** sem pedido explícito do usuário.
