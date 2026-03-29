# Checklist DoD Transversal (Obrigatorio)

Use este checklist em toda nova spec da pasta `specs/`.

## Qualidade funcional

- [ ] Criterios de aceite atendidos.
- [ ] Fluxos de sucesso, erro e warning cobertos.
- [ ] Sem regressao nos fluxos existentes.

## Qualidade tecnica

- [ ] Sem erros de tipagem.
- [ ] Testes automatizados passando.
- [ ] Novos bugs corrigidos possuem teste de regressao.
- [ ] Fluxos de escrita da feature persistem no Firebase Firestore (create/update/delete conforme escopo).
- [ ] `specs/<feature>/firestore-structure.md` criado/atualizado e coerente com a implementacao.
- [ ] Falhas de persistencia possuem tratamento e feedback para usuario.

## Tema e legibilidade

- [ ] Interface validada em `light` e `dark`.
- [ ] Contraste minimo AA (texto normal >= 4.5:1, texto grande >= 3:1).
- [ ] Sem cores fixas para texto critico em contexto tematico.
- [ ] Tokens semanticos de tema aplicados (incluindo mapeamento de variaveis de framework, quando houver).

## Snackbar padrao de feedback

- [ ] Toda operacao com resultado de erro, sucesso ou warning exibe snackbar.
- [ ] Posicionamento do snackbar: canto superior direito.
- [ ] Tempo de exibicao automatica: 3 segundos.
- [ ] Opcao de fechar manual com icone `X`.
- [ ] Cores por status: vermelho (erro), verde (sucesso), amarelo (warning).

## Acessibilidade e UX

- [ ] Controles interativos com `aria-label` quando necessario.
- [ ] Estados visuais validados: default, hover, focus, active, disabled.
- [ ] Feedbacks de erro/sucesso/warning sao perceptiveis e compreensiveis.
