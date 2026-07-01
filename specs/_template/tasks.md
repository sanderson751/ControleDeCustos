# Tasks - <nome-da-feature>

> Referencia obrigatoria: usar e manter alinhado com `specs/_template/dod-checklist.md`.

## Fase 1 - Dominio

- [ ] Criar tipos de dominio.
- [ ] Criar regras puras.
- [ ] Criar testes unitarios.
- [ ] Definir `firestore-structure.md` da feature com colecoes, indices e regras.

## Fase 2 - Aplicacao

- [ ] Criar hooks de estado.
- [ ] Criar componentes de UI.
- [ ] Integrar persistencia no Firestore para todas as operacoes de escrita da feature.
- [ ] Garantir que a fonte final dos dados seja o Firestore (sem salvar apenas em memoria local).
- [ ] Implementar snackbar padrao para erro/sucesso/warning (top-right, 3s, fechar com `X`).

## Fase 3 - Qualidade

- [ ] Executar `npm run lint:fix` para autofix seguro.
- [ ] Executar `npm run lint` e corrigir erros remanescentes.
- [ ] Validar efeitos e callbacks para conformidade com `react-hooks/exhaustive-deps`.
- [ ] Testes de componente.
- [ ] Testes de regressao.
- [ ] Validacao de persistencia (create/update/delete) no Firestore para os fluxos da feature.
- [ ] Validacao responsiva.
- [ ] Validacao visual em tema `light` e `dark`.
- [ ] Validacao de contraste (AA) para textos e elementos interativos.
- [ ] Validacao de comportamento do snackbar (3s, fechar, cor por status).

## Definicao de pronto

- [ ] Checklist DoD transversal aplicado conforme `specs/_template/dod-checklist.md`.
