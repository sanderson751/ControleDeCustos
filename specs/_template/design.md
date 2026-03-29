# Design - <nome-da-feature>

## Visao de solucao

Resumo da abordagem tecnica.

## Modelo de dominio

- EntidadeA { ... }
- EntidadeB { ... }

## Regras de negocio

- Regra 1
- Regra 2

## Componentes e hooks

- ComponentA
- useHookB

## Padrao visual de icones

- Biblioteca de icones: Material Design Icons Community (`@mdi/react` + `@mdi/js`).
- Controles de navegacao (appbar/menu) devem priorizar botao com icone e `aria-label`.
- Quando menu lateral estiver retraido, exibir somente icones e tooltip com `react-tooltip`.
- Itens de menu devem ter icone alinhado a esquerda do titulo no modo expandido.

## Compatibilidade de tema e contraste (obrigatorio)

- Definir tokens semanticos de cor para texto, fundo, borda, botoes e alertas.
- Mapear variaveis de framework (ex.: Bootstrap `--bs-*`) para tokens do tema ativo.
- Evitar cores hardcoded para textos e estados criticos em componentes tematicos.
- Garantir legibilidade nos estados: default, hover, focus, active, disabled, warning e error.

## Feedback de operacao (snackbar obrigatorio)

- Definir componente padrao de snackbar para sucesso, erro e warning.
- Posicionamento fixo no canto superior direito da tela.
- Tempo de exibicao padrao: 3 segundos.
- Acao de fechar manualmente com icone `X`.
- Variantes de cor por status: vermelho (erro), verde (sucesso), amarelo (warning).

## Persistencia e integracoes

Descreva estrategia com Firestore (colecoes, consultas, indexes e regras de seguranca).

## Fluxo principal

1. ...
2. ...
3. ...
