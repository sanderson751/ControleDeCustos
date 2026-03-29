# Tasks - theme

## Fase 1 - Dominio

- [ ] Definir tipo `ThemeMode` (`light` | `dark`).
- [ ] Definir contrato de estado global de tema.
- [ ] Definir fallback oficial para `light`.
- [ ] Atualizar `firestore-structure.md` da feature com `ui.theme`.

## Fase 2 - Aplicacao

- [ ] Criar estrategia de tema global com tokens CSS (light/dark).
- [ ] Aplicar tema em todo shell autenticado.
- [ ] Criar hook/servico para leitura e persistencia de tema por usuario.
- [ ] Adicionar botao de tema na appbar imediatamente a esquerda do logout.
- [ ] Configurar icone MDI no botao de tema.
- [ ] Configurar tooltip com `react-tooltip` no botao de tema.
- [ ] Atualizar botao para refletir a proxima acao (tooltip e estado).
- [ ] Implementar snackbar padrao (top-right, 3s, fechar com `X`) para operacoes de erro/sucesso/warning.

## Fase 3 - Qualidade

- [ ] Criar teste de tema padrao light sem preferencia salva.
- [ ] Criar teste de alternancia de tema pela appbar.
- [ ] Criar teste de persistencia/restauracao de tema.
- [ ] Criar teste de posicionamento do botao de tema ao lado esquerdo do logout.
- [ ] Validar contraste e legibilidade em light/dark.
- [ ] Validar estados visuais (default, hover, focus, disabled, warning e error) em light/dark.
- [ ] Validar ausencia de cores fixas para texto critico em componentes tematizados.
- [ ] Validar snackbar com auto-dismiss de 3 segundos e fechamento manual por `X`.
- [ ] Validar cores do snackbar por status (vermelho/verde/amarelo).

## Definicao de pronto

- [ ] Criterios de aceite atendidos.
- [ ] Testes passando.
- [ ] Sem erros de tipagem.
- [ ] Tema global aplicado em telas autenticadas.
- [ ] Botao de tema com icone + tooltip funcionando.
- [ ] Persistencia do tema no Firestore validada (leitura, escrita e fallback em falha).
- [ ] Fonte final da preferencia de tema confirmada no Firestore.
