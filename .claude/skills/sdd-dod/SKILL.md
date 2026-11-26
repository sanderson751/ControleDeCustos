---
name: sdd-dod
description: Executa o Definition of Done transversal do projeto (specs/_template/dod-checklist.md) — typecheck, lint, testes unitários, testes de regras do Firestore no emulador, revisão de tema light/dark, snackbar e persistência — e reporta o resultado real. Use antes de abrir PR ou quando o usuário perguntar se uma feature está pronta.
---

# Definition of Done

## 1. Gates automáticos (execute e reporte a saída real)

```bash
npm run verify          # typecheck + lint + test
```

- Se o diff tocar `firestore.rules`, `src/services/**`, `src/domain/**` ou `firestore.indexes.json`:
  ```bash
  npm run test:rules    # requer Java (emulador do Firestore)
  ```
- Opcional para revisão de cobertura: `npm run test:coverage`.

Se algo falhar: corrija (ou reporte, se for fora do escopo) e rode de novo. Nunca declare o DoD
concluído com gate vermelho ou não executado.

## 2. Revisão do diff (`git diff main...HEAD`)

- [ ] Sem cores fixas/hex em componentes temáticos; tokens semânticos usados (contraste AA).
- [ ] Toda operação com resultado usa `notify()` (sucesso/erro/warning).
- [ ] Toda escrita no Firestore tem tratamento de erro e regra correspondente em `firestore.rules`.
- [ ] `src/domain/rules/permissions.ts` coerente com `firestore.rules`.
- [ ] Sem supressão de `react-hooks/*` sem justificativa.
- [ ] Novas regras de negócio/serviços/telas possuem testes; bugs corrigidos têm teste de regressão.
- [ ] `specs/<feature>/` (requirements, design, tasks, firestore-structure) atualizado e coerente.

## 3. Validação visual

Se houve mudança de UI, peça ao usuário (ou faça, se houver navegador disponível) a checagem em
`npm run dev` nos temas light e dark, incluindo estados hover/focus/disabled/erro.

## 4. Relatório

Liste cada item do `specs/_template/dod-checklist.md` como ✅/❌/N.A. com evidência (comando,
arquivo ou teste). Termine com: **pronto para PR** ou **pendências**.
