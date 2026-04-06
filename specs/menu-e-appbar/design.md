# Design - menu-e-appbar

## Visao de solucao

A feature introduz um shell de layout autenticado composto por appbar global, menu lateral esquerdo e area de conteudo.
A appbar sera responsavel por acionar toggle do menu e concentrar a acao de logout.
A area central exibira inicialmente uma tela de boas-vindas, preparada para evoluir para dashboard mensal.

Padrao visual definido:
- icones via Material Design Icons Community (`@mdi/react` + `@mdi/js`)
- tooltip via `react-tooltip` no menu retraido

## Modelo de dominio

- AppShellState
  - `isSidebarCollapsed`: boolean
  - `isMobile`: boolean

- AuthSession
  - `isAuthenticated`: boolean
  - `user`: User

- WelcomeViewModel
  - `title`: string
  - `subtitle`: string
  - `targetPeriod`: string (ex.: "mes corrente")

## Regras de negocio

- RB-01: O layout shell (appbar + menu) so deve ser exibido para usuario autenticado.
- RB-02: O estado inicial do menu e expandido no desktop e retraido no mobile.
- RB-03: O botao de menu da appbar e a unica acao global de toggle do menu.
- RB-04: O logout deve permanecer visivel no canto direito da appbar em qualquer resolucao.
- RB-05: A tela central de boas-vindas deve ficar desacoplada da futura implementacao do dashboard.
- RB-06: O botao de menu deve usar icone de hamburger-menu.
- RB-07: O botao de logout deve usar icone sign-out.
- RB-08: No menu retraido, apenas icones devem ser exibidos com tooltip de apoio.
- RB-09: O menu deve aplicar filtro de visibilidade baseado na role do usuario autenticado (integração com controle-de-acesso).
- RB-10: Item "Perfil de Usuários" deve ser visível somente para users com role "admin".
- RB-11: Atualizações de role devem disparar re-renderização do menu.

## Componentes e hooks

- AuthLayout
  - Estrutura base para telas autenticadas.
  - Compoe AppBar + Sidebar + MainContent.

- GlobalAppBar
  - Botao de menu (toggle) com icone hamburger-menu.
  - Titulo do sistema.
  - Botao de logout no canto direito com icone sign-out.

- SidebarMenu
  - Renderiza opcoes de navegacao com icones alinhados a esquerda.
  - Suporta estados collapsed/expanded.
  - Exibe tooltip com `react-tooltip` quando collapsed.
  - Filtra itens de menu baseado na role do usuario (aplica permissoes do controle-de-acesso).
  - Inclui novo item "Perfil de Usuários" visível apenas para role admin.

- WelcomeCenter
  - Exibe mensagem de boas-vindas e placeholder do dashboard mensal.

- useSidebarState
  - Gerencia estado retratil/expansivel.
  - Pode persistir preferencia em Firestore ou localStorage.

## Persistencia e integracoes

Persistencia minima sugerida (opcional na primeira entrega):
- `users/{uid}/settings/profile`
  - `ui.sidebarCollapsed`: boolean
  - `updatedAt`: Timestamp

Integracoes existentes:
- Firebase Auth para sessao e logout.
- Firestore para perfil/preferencias de layout.

## Fluxo principal

1. Usuario autenticado acessa app.
2. Sistema renderiza AuthLayout com appbar no topo e menu lateral esquerdo.
3. Usuario usa o botao de menu na appbar para alternar retracao/expansao.
4. Conteudo principal exibe WelcomeCenter centralizado.
5. Usuario clica em logout na appbar.
6. Sistema encerra sessao e retorna para login.
