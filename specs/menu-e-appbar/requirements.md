# Requirements - menu-e-appbar

## Contexto

O sistema precisa de uma estrutura de navegacao global consistente para suportar crescimento de funcionalidades.
A necessidade atual e introduzir:
- menu lateral esquerdo retratil/expansivel
- appbar global fixa no topo
- acao de logout na appbar
- tela central de boas-vindas como placeholder do dashboard do mes corrente

## Requisitos funcionais

- RF-01: O sistema deve exibir um menu lateral esquerdo visivel para usuario autenticado.
- RF-02: O menu lateral deve suportar os estados expandido e retraido.
- RF-03: O usuario deve poder alternar o estado do menu pelo botao de menu presente na appbar.
- RF-04: O sistema deve exibir uma appbar global no topo da aplicacao.
- RF-05: A appbar deve exibir o botao de logout no canto superior direito.
- RF-06: Ao clicar em logout, a sessao do usuario deve ser encerrada e o sistema deve voltar para a tela de login.
- RF-07: O conteudo principal deve exibir uma tela de boas-vindas centralizada.
- RF-08: A tela de boas-vindas deve indicar que futuramente exibira o dashboard dos custos do mes corrente.
- RF-09: O layout (menu + appbar + conteudo) deve funcionar em desktop e mobile.
- RF-10: O botao de expandir/retrair menu na appbar deve usar icone de hamburger-menu.
- RF-11: O botao de logout da appbar deve usar icone sign-out.
- RF-12: Cada item do menu lateral deve exibir um icone alinhado a esquerda do titulo no modo expandido.
- RF-13: No modo retraido, o menu deve exibir apenas os icones e mostrar tooltip descritiva via `react-tooltip`.
- RF-14: O sistema deve filtrar itens de menu baseado na role (papel) do usuário autenticado, ocultando itens inacessíveis.
- RF-15: O menu deve ser re-renderizado quando a role do usuário muda (após edição de perfil).

## Requisitos nao funcionais

- RNF-01: O toggle do menu deve responder em ate 100ms em ambiente local.
- RNF-02: A navegacao deve manter acessibilidade basica (aria-label nos botoes de menu e logout).
- RNF-03: O layout nao deve causar overflow horizontal em resolucoes mobile comuns (>= 320px).
- RNF-04: O estado visual do menu deve ser previsivel e consistente apos recarregamento, quando persistencia estiver habilitada.
- RNF-05: O conjunto de icones deve seguir Material Design Icons Community para consistencia visual.
- RNF-06: O carregamento da role do usuário deve ser assíncrono sem bloquear renderização do menu.

## Criterios de aceite (Gherkin)

### Cenario 1 - Expandir e retrair menu
Given que o usuario autenticado esta na tela principal
When clicar no botao de menu da appbar
Then o menu lateral deve alternar entre retraido e expandido
And o conteudo principal deve se ajustar sem quebrar o layout

### Cenario 2 - Logout pela appbar
Given que o usuario autenticado esta na tela principal
When clicar no botao de logout no canto direito da appbar
Then o sistema deve encerrar a sessao
And deve redirecionar para a tela de login

### Cenario 3 - Boas-vindas no centro
Given que o usuario autenticado acessou a tela principal
When o layout carregar
Then deve exibir uma mensagem de boas-vindas centralizada
And deve exibir texto indicando o futuro dashboard de custos do mes corrente

### Cenario 4 - Responsividade
Given que o usuario acessa a aplicacao em dispositivo mobile
When interagir com menu e appbar
Then os controles devem permanecer visiveis e utilizaveis
And nao deve haver quebra de layout horizontal

### Cenario 5 - Menu retraido com tooltip
Given que o menu lateral esta retraido
When o usuario posicionar o cursor sobre um item do menu
Then o sistema deve exibir tooltip com o descritivo do item usando `react-tooltip`
And deve exibir somente o icone do item na area do menu

### Cenario 6 - Filtragem de menu por role
Given que um usuario com role Standard esta na tela principal
When o menu lateral ser renderizado
Then o item "Perfil de Usuários" não deve ser visível no menu
And todos os outros itens de menu padrão devem estar acessíveis

### Cenario 7 - Admin visualiza menu completo
Given que um usuario com role Admin esta na tela principal
When o menu lateral ser renderizado
Then todos os itens de menu incluindo "Perfil de Usuários" devem estar visíveis
And Admin consegue clicar em "Perfil de Usuários" para gerenciar usuários
