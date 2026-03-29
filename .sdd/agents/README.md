# Contextos de Agentes SDD

Este diretório concentra os contextos por papel para orientar prompts e entregas ao longo do ciclo SDD.

## Contextos disponiveis

- business-analyst.md
- product-owner.md
- solution-architect.md
- frontend-engineer.md
- qa-engineer.md
- data-analyst.md

## Como usar

1. Escolha o contexto pelo tipo de decisao.
2. Replique entradas e saidas esperadas na solicitacao.
3. Valide se a resposta atende ao exemplo de qualidade do proprio contexto.

## Regra transversal obrigatoria

- Toda entrega de UI deve garantir compatibilidade total entre tema `light` e `dark`.
- Textos e componentes devem manter contraste minimo AA em ambos os temas.
- O uso de tokens semanticos de cor e obrigatorio; evitar cores fixas para texto/estado.
- Operacoes com resultado de erro/sucesso/warning devem usar snackbar padrao (top-right, 3s, fechar com `X`).
- Toda feature com dados deve persistir no Firebase Firestore (nao apenas em estado local).
- Toda nova spec deve explicitar a persistencia em `requirements.md`, `tasks.md` e `firestore-structure.md`.
- Toda nova spec deve aplicar o checklist unico: `specs/_template/dod-checklist.md`.

## Exemplo de uso rapido

"Atue como business analyst e gere criterios de aceite Given/When/Then para cadastro e edicao de custos com foco em mobile."
