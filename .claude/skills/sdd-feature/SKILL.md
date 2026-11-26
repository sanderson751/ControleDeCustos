---
name: sdd-feature
description: Inicia e conduz uma nova feature pelo fluxo SDD do projeto — cria specs/<feature>/ a partir de specs/_template, gera requisitos (business-analyst), design e estrutura Firestore (solution-architect), quebra em tarefas e implementa com testes (frontend-engineer). Use quando o usuário pedir uma funcionalidade nova ou mudança relevante de comportamento.
---

# SDD — nova feature

Argumento esperado: nome/descrição da feature (ex.: `orcamento-por-categoria`).
Se não houver nome, derive um slug kebab-case curto em pt-BR a partir do pedido.

## Passos

1. **Contexto**: leia `CLAUDE.md`, `.sdd/README.md` e `.sdd/steering/*.md`. Verifique se já existe
   `specs/<slug>/` (se existir, continue a partir do estado atual em vez de recriar).

2. **Estrutura**: crie `specs/<slug>/` copiando os arquivos de `specs/_template/`
   (`requirements.md`, `design.md`, `tasks.md`, `firestore-structure.md`). O `dod-checklist.md`
   é referenciado, não copiado.

3. **Requisitos** → delegue ao agente `business-analyst` com o pedido do usuário. Revise se há
   critérios de tema light/dark, snackbar, persistência (sucesso e falha) e permissões por papel.
   Apresente as **perguntas em aberto** ao usuário antes de seguir, se houver.

4. **Design + dados** → delegue ao agente `solution-architect`: `design.md` e
   `firestore-structure.md` (incluindo o diff necessário em `firestore.rules` e índices).

5. **Tarefas**: escreva `tasks.md` com checklist ordenado (domínio → serviços → regras/testes de
   regras → UI → testes de UI → docs), cada item pequeno e verificável.

6. **Confirmação**: mostre ao usuário um resumo (escopo, decisões, impacto em dados/regras) e
   peça o ok para implementar.

7. **Implementação** → delegue ao agente `frontend-engineer` (ou implemente seguindo o mesmo
   guia), marcando as tarefas concluídas em `tasks.md`.

8. **Fechamento**: execute a skill `/sdd-dod`. Depois sugira `/abrir-pr`.

## Regras

- Nunca trabalhe na `main`: crie a branch `feat/<slug>` antes de alterar código.
- Mantenha `requirements.md`, `tasks.md` e `firestore-structure.md` coerentes entre si.
