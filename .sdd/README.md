# Spec-Driven Development (SDD)

Este projeto segue SDD para reduzir ambiguidades e garantir que o desenvolvimento seja guiado por especificações testáveis.

## Fluxo SDD adotado

1. Alinhar contexto permanente em `.sdd/steering/`.
2. Escrever a especificação da funcionalidade em `specs/<feature>/requirements.md`.
3. Definir solução em `specs/<feature>/design.md`.
4. Quebrar implementação em `specs/<feature>/tasks.md`.
5. Definir/validar estrutura de dados no Firestore em `specs/<feature>/firestore-structure.md`.
6. Executar ciclos curtos de implementação, lint e testes.

## Gate obrigatorio de persistencia

- Feature que cria/edita/exclui dados so pode ser considerada pronta quando a persistencia no Firebase Firestore estiver implementada e validada.
- Nao e permitido encerrar feature com armazenamento final apenas em memoria local da interface.
- Toda feature de dados deve manter `requirements.md`, `tasks.md` e `firestore-structure.md` coerentes entre si.
- Toda feature deve encerrar com `npm run verify` (typecheck + lint + testes) sem erros e, quando alterar dados/regras, com `npm run test:rules` verde.
- Toda alteracao chega na `main` somente via Pull Request.

## Estrutura de arquivos

- `.sdd/steering/product.md`: visão de produto e regras de negócio estáveis.
- `.sdd/steering/tech.md`: stack, padrões e decisões técnicas.
- `.sdd/steering/structure.md`: organização de pastas e convenções.
- `.sdd/agents/*.md`: contextos de agentes com exemplos de uso.
- `specs/controle-de-custos-inicial/requirements.md`: requisitos da feature.
- `specs/controle-de-custos-inicial/design.md`: desenho técnico da feature.
- `specs/controle-de-custos-inicial/tasks.md`: plano de execução.
- `specs/controle-de-custos-inicial/firestore-structure.md`: estrutura de colecoes, indices e regras.
- `specs/_template/firestore-structure.md`: template de estrutura para novas features.
- `specs/migracao-spa-vite/`: migracao para SPA (Vite + React + Firebase client) e nova UI shadcn/ui.
- `specs/categorias-de-custo/`: categoria obrigatoria nos lancamentos, navegacao por competencia e consolidado por categoria.
- `specs/orcamento-por-categoria/`: orcamento mensal por categoria e alertas de 80%/100%.
- `specs/orcamento-recorrente/`: orcamento recorrente com vigencias e excecoes mensais.
- `specs/evolucao-mensal/`: grafico de evolucao mensal de gasto x orcamento.
- `specs/descricao-e-busca/`: descricao livre no lancamento e busca na listagem.
- `specs/categorias-personalizadas/`: categorias proprias do usuario (criar, renomear, arquivar).
- `CLAUDE.md` e `.claude/`: mapeamento dos agentes e skills do SDD para o Claude Code.
