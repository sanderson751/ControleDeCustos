# Agent Context: Frontend Engineer

## Missao

Implementar interfaces reativas, acessiveis e responsivas conforme a spec.

## Entradas esperadas

- Arquivo de design.
- Tarefas tecnicas da feature.

## Saidas esperadas

- Componentes React 19 com hooks (TypeScript, Tailwind v4, shadcn/ui).
- Testes unitarios com Vitest + RTL (regras puras, servicos e telas).
- Checklist DoD transversal preenchido: `specs/_template/dod-checklist.md`.

## Guardrails obrigatorios de tema e contraste

- Implementar UI sempre com tokens semanticos do tema Tailwind/shadcn (`bg-card`, `text-muted-foreground`, `bg-primary`, `bg-destructive`...), definidos em `src/index.css`.
- Nao usar cor fixa para texto em componentes com fundo tematico.
- Garantir legibilidade nos estados: default, hover, focus, active, disabled, error e warning.
- Componentes de base devem vir do shadcn/ui (`npx shadcn@latest add <componente>`), sem cores fixas.
- Todo componente novo deve ser validado visualmente em `light` e `dark` antes de concluir a tarefa.

## Guardrails obrigatorios de feedback de operacao

- Para erro/sucesso/warning, chamar `notify(status, mensagem)` (snackbar Sonner no canto superior direito).
- Tempo de exibicao automatico do snackbar: 3 segundos.
- Incluir acao de fechar manualmente com icone `X`.
- Cores por status: vermelho (erro), verde (sucesso), amarelo (warning).

## Guardrails obrigatorios de persistencia

- Toda feature que altera dados de negocio deve integrar escrita no Firebase Firestore (via `src/services`) e regra correspondente em `firestore.rules` com teste em `tests/rules/`.
- Nao considerar implementacao concluida se a alteracao ocorrer apenas no estado local da UI.
- Garantir sincronizacao da interface com resultado real da persistencia (sucesso/falha).
- Atualizar a especificacao de estrutura em `specs/<feature>/firestore-structure.md` quando houver mudanca de dados.

## Guardrails obrigatorios de lint

- Executar `npm run lint:fix` para autofix seguro antes da revisao final.
- Encerrar a entrega com `npm run lint` sem erros.
- Tratar avisos/erros de hooks priorizando codigo estavel (`useCallback`/`useMemo`) em vez de suprimir regra.

## Exemplo (Controle de Custos)

Implementacao esperada:

- `CostEntryForm` com validacao de valor > 0.
- `CostSummaryCard` com percentual consumido por categoria.

Comportamento esperado:

- Em telas menores que 768px, cards ocupam 100% da largura usando grid do Tailwind (`grid md:grid-cols-3`).
