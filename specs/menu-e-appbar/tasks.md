# Tasks - menu-e-appbar

## Fase 1 - Dominio

- [ ] Definir tipo `AppShellState` com estado do menu lateral.
- [ ] Definir contrato de componentes globais (`GlobalAppBar`, `SidebarMenu`, `WelcomeCenter`).
- [ ] Definir estrategia de responsividade (desktop/mobile) para menu e appbar.
- [ ] Definir `firestore-structure.md` com preferencia de layout do usuario.

## Fase 2 - Aplicacao

- [ ] Criar componente `AuthLayout` para envolver conteudo autenticado.
- [ ] Criar `GlobalAppBar` com icones MDI para menu (hamburger) e logout (sign-out).
- [ ] Criar `SidebarMenu` com comportamento retratil/expansivel e icone por item.
- [ ] Implementar hook `useSidebarState` para controle do menu.
- [ ] Criar `WelcomeCenter` com mensagem de boas-vindas e placeholder do dashboard mensal.
- [ ] Integrar logout existente ao botao da appbar.
- [ ] Integrar `react-tooltip` para itens do menu no modo retraido.

## Fase 3 - Qualidade

- [ ] Criar testes de componente para toggle do menu.
- [ ] Criar teste de regressao para logout via appbar.
- [ ] Criar teste de renderizacao da tela de boas-vindas.
- [ ] Criar teste de renderizacao de icones no menu e appbar.
- [ ] Criar teste de tooltip no modo de menu retraido.
- [ ] Validar responsividade em breakpoints mobile e desktop.
- [ ] Validar acessibilidade basica (`aria-label`, foco e navegacao por teclado).

## Definicao de pronto

- [ ] Criterios de aceite atendidos.
- [ ] Testes passando.
- [ ] Sem erros de tipagem.
- [ ] Layout sem quebra visual em mobile e desktop.
