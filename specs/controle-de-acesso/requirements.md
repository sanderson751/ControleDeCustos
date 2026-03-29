# Requirements - Controle de Acesso

## Contexto

O sistema precisa de um mecanismo de controle de acesso baseado em roles (papéis de usuário) para gerenciar permissões em diferentes niveis.
A necessidade atual é:

- Implementar 3 níveis de acesso: Admin, Usuário Padrão e Convidado
- Controlar visibilidade e acessibilidade de itens de menu baseado em role
- Permitir que Admin gerencie roles de outros usuários
- Implementar controle granular de permissões (visualização, edição, remoção, adição) para listagens e formulários
- Criar interface dedicada para gestão de usuários e seus perfis de acesso

## Requisitos funcionais

- RF-01: O sistema deve suportar três níveis de acesso: Admin, Usuário Padrão (Standard) e Convidado (Guest).
- RF-02: Admin deve ter acesso total a todas as funcionalidades e permissões do sistema.
- RF-03: Usuário Padrão não deve ter acesso às configurações de controle de perfil de acesso.
- RF-04: Convidado deve possuir apenas permissão de visualização (read-only) em todas as telas do sistema.
- RF-05: O sistema deve exibir um menu "Perfil de Usuários" visível somente para usuários com role Admin.
- RF-06: Ao acessar "Perfil de Usuários", deve exibir uma listagem de todos os usuários do sistema com suas respectivas roles.
- RF-07: A listagem de usuários deve permitir apenas edição de perfis (não adicionar ou remover usuários via lista).
- RF-08: O formulário de edição de usuário deve exibir todas as informações relevantes para controle de acesso.
- RF-09: O formulário de edição de usuário deve permitir que Admin altere o nível de acesso (role) do usuário.
- RF-10: O formulário de edição de usuário deve estar centralizado na tela.
- RF-11: Itens de menu devem respeitar as permissões do usuário autenticado, ocultando itens inacessíveis.
- RF-12: Listagens e formulários devem respeitar as permissões de visualização, edição, remoção e adição baseadas na role.
- RF-13: O usuário existente no banco deve ser alterado para Admin durante a implementação.
- RF-14: O sistema deve persistir a role de cada usuário no Firestore.

## Requisitos não funcionais

- RNF-01: O carregamento da role deve ser assíncrono sem bloquear a renderização inicial.
- RNF-02: Verificações de permissão devem ocorrer em <= 100ms.
- RNF-03: O sistema deve manter acessibilidade básica em todos os níveis de acesso.
- RNF-04: A interface de gestão de usuários deve ser responsiva em desktop e mobile.
- RNF-05: O controle de acesso deve ser aplicado na UI e validado em rotas do Next.js e services server-side no mesmo ciclo de entrega.
- RNF-06: A interface de gestão de usuários deve manter legibilidade em `light` e `dark` com contraste minimo AA.
- RNF-07: Textos de botões, badges e alertas não devem usar cor fixa sem considerar o tema ativo.
- RNF-08: Operacoes de edição de perfil e erros de carregamento devem usar snackbar no topo direito.
- RNF-09: Snackbar deve ter auto-dismiss em 3 segundos e fechamento manual com icone `X`.
- RNF-10: Cores por status: erro (vermelho), sucesso (verde), warning (amarelo).
- RNF-11: Alteracoes de perfil de acesso e dados editaveis do usuario devem persistir no Firestore como fonte final da verdade.
- RNF-12: Operacoes de escrita devem definir comportamento de sucesso e falha de persistencia com feedback ao usuario.

## Regras de negócio

- RB-01: Admin tem permissão irrestrita em todas as funcionalidades e menu.
- RB-02: Usuário Padrão pode acessar tudo exceto configurações de controle de perfis de acesso.
- RB-03: Convidado pode visualizar todas as telas mas não pode editar, adicionar ou remover nada.
- RB-04: Apenas Admin pode acessar e modificar o menu "Perfil de Usuários" e a rota `/userProfiles`.
- RB-05: Apenas Admin pode alterar roles de usuários.
- RB-06: Elementos UI (botões, links) devem ser ocultados quando o usuário não tem permissão, não apenas desabilitados.
- RB-07: Um usuário Convidado não pode ser downgrade para níveis inferiores.

## Critérios de aceite (Gherkin)

### Cenário 1 - Visualização de menu por role

Given que um usuário autenticado com role Standard está na tela principal
When a appbar e menu forem renderizados
Then o item "Perfil de Usuários" não deve estar visível no menu
And todos os itens de menu padrão devem estar acessíveis

### Cenário 2 - Admin acessa gestão de usuários

Given que um usuário autenticado com role Admin está na tela principal
When clicar no item "Perfil de Usuários" no menu
Then uma listagem com todos os usuários e suas roles deve ser exibida
And cada linha de usuário deve ter um botão de edição

### Cenário 3 - Admin edita role de usuário

Given que Admin está na listagem de usuários
When clicar em editar um usuário
Then um formulário centralizado deve abrir mostrando todas as informações do usuário
And um select/radio button para mudar a role (Admin, Standard, Guest) deve estar presente
And ao salvar, a role deve ser atualizada no Firestore e refletida na listagem

### Cenário 4 - Convidado com permissões de visualização

Given que um usuário autenticado com role Guest está acessando qualquer tela do sistema
When visualizar um formulário ou listagem
Then todos os elementos de edição, adição e remoção devem estar ocultos
And apenas conteúdo de visualização deve ser exibido

### Cenário 5 - Usuário existente é Admin

Given que o primeiro usuário foi criado no sistema
When este usuário acessa o sistema
Then sua role deve ser Admin
And ele deve ter acesso a todas as funcionalidades
