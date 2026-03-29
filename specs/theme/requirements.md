# Requirements - theme

## Contexto

A aplicacao precisa de um tema visual global para melhorar usabilidade e personalizacao da experiencia.
A necessidade atual e suportar dois temas (light e dark), com padrao inicial light,
e disponibilizar alternancia rapida diretamente na appbar.

## Requisitos funcionais

- RF-01: O sistema deve aplicar um tema global em toda a aplicacao autenticada.
- RF-02: O sistema deve suportar dois temas: `light` e `dark`.
- RF-03: O tema padrao deve ser `light` quando nao houver preferencia salva.
- RF-04: A appbar deve exibir um botao de troca de tema imediatamente a esquerda do botao de logout.
- RF-05: O botao de tema deve usar icone e tooltip descritiva, seguindo o padrao visual da aplicacao.
- RF-06: Ao clicar no botao, o sistema deve alternar entre `light` e `dark`.
- RF-07: O tema selecionado deve ser aplicado sem recarregar a pagina.
- RF-08: A preferencia de tema deve ser persistida por usuario autenticado.
- RF-09: Em novo acesso, o sistema deve restaurar o tema persistido do usuario.

## Requisitos nao funcionais

- RNF-01: A troca de tema deve ocorrer em ate 100ms em ambiente local.
- RNF-02: O contraste de texto e elementos interativos deve permanecer legivel em ambos os temas.
- RNF-03: O botao de tema deve manter acessibilidade basica com `aria-label` e tooltip.
- RNF-04: O tema deve impactar tokens globais (fundo, texto, bordas, superficie e destaque), evitando estilos isolados por componente.
- RNF-05: Contraste minimo AA: texto normal >= 4.5:1 e texto grande >= 3:1.
- RNF-06: E proibido usar cor fixa para texto critico em componentes cujo fundo muda por tema.
- RNF-07: Operacoes com erro/sucesso/warning devem exibir snackbar no canto superior direito.
- RNF-08: Snackbar com auto-dismiss de 3 segundos e acao de fechar manual com icone `X`.
- RNF-09: Cores de snackbar por status: erro (vermelho), sucesso (verde), warning (amarelo).
- RNF-10: A preferencia de tema deve usar o Firestore como fonte final da verdade (estado local apenas para experiencia de interface).
- RNF-11: Falhas de leitura/escrita de tema no Firestore devem ter fallback seguro e feedback ao usuario.

## Regras de negocio

- RB-01: O tema `light` e o fallback oficial quando o valor persistido estiver ausente ou invalido.
- RB-02: O botao de tema deve mostrar tooltip coerente com a proxima acao (ex.: "Ativar tema dark" quando tema atual e light).
- RB-03: O botao de tema deve ficar posicionado entre o titulo/acoes centrais e o botao de logout, no topo da appbar.

## Criterios de aceite (Gherkin)

### Cenario 1 - Tema padrao
Given que o usuario autenticado acessa o sistema sem preferencia salva
When a aplicacao e carregada
Then o tema global aplicado deve ser `light`

### Cenario 2 - Troca de tema pela appbar
Given que o usuario autenticado esta na tela principal
When clicar no botao de tema na appbar
Then o sistema deve alternar o tema global entre `light` e `dark`
And deve atualizar o icone e tooltip conforme o novo estado

### Cenario 3 - Persistencia por usuario
Given que o usuario autenticado alterou o tema para `dark`
When sair e entrar novamente no sistema
Then o tema `dark` deve ser restaurado automaticamente

### Cenario 4 - Posicionamento do botao
Given que a appbar esta visivel
When os botoes globais forem renderizados
Then o botao de tema deve estar imediatamente a esquerda do botao de logout
