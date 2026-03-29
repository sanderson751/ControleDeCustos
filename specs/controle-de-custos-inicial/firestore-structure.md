# Firestore Structure - Controle de Custos

Este documento define a estrutura de dados no Firestore para suportar a feature inicial de custos com:
- menu de acesso ao modulo de custos;
- listagem detalhada por conta;
- separacao entre custos fixos e variaveis;
- edicao em formulario separado;
- relatorios em tempo real para o mes corrente.

## Nota sobre Controle de Acesso

As estruturas definidas neste documento seguem as permissoes de role da feature controle-de-acesso:
- Admin: leitura e escrita (create, read, update, delete)
- Standard: leitura e escrita (create, read, update, delete)
- Guest: leitura apenas (read-only)

## Colecao raiz

- `users` (collection)
  - `{userId}` (document)
    - `displayName`: string
    - `email`: string
    - `currency`: string (ex.: "BRL")
    - `role`: string (enum: "admin" | "standard" | "guest")
    - `createdAt`: Timestamp
    - `updatedAt`: Timestamp

## Subcolecoes por usuario

### 1) Lancamentos de custos

Caminho:
- `users/{userId}/costEntries/{entryId}`

Campos:
- `userId`: string
- `accountName`: string
- `amount`: number
- `costType`: string (enum: "fixo" | "variavel")
- `installmentsTotal`: number (>= 1)
- `notes`: string (opcional)
- `competenceYear`: number
- `competenceMonth`: number (1-12)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

Exemplo de documento:

```json
{
  "userId": "u_123",
  "accountName": "Energia Eletrica",
  "amount": 220.0,
  "costType": "fixo",
  "installmentsTotal": 1,
  "notes": "Conta residencia",
  "competenceYear": 2026,
  "competenceMonth": 4,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Consultas principais esperadas

- Listar custos do mes corrente:
  - filtro: `competenceYear == X` e `competenceMonth == Y`
  - ordenacao: `createdAt desc`

- Filtrar por frente de custo:
  - filtro adicional: `costType == "fixo"` ou `costType == "variavel"`

- Consolidar relatorio em tempo real do mes:
  - filtro: `competenceYear == X` e `competenceMonth == Y`
  - agregacoes por `costType` e total geral

## Operacoes de persistencia obrigatorias

- Escrita create: criar documento em `costEntries` com `createdAt` e `updatedAt`.
- Escrita update: atualizar documento preservando `createdAt` e atualizando `updatedAt`.
- Escrita delete: remover documento-alvo mantendo consistencia da UI com o estado persistido.
- Tratamento de falha: em erro de permissao/rede, nao confirmar alteracao local como definitiva e exibir feedback ao usuario.

## Indices compostos sugeridos

### costEntries

1. Campos:
- `competenceYear` (ASC)
- `competenceMonth` (ASC)
- `createdAt` (DESC)

2. Campos:
- `competenceYear` (ASC)
- `competenceMonth` (ASC)
- `costType` (ASC)
- `createdAt` (DESC)

## Regras de seguranca (referencia)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /costEntries/{entryId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create, update, delete: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Convencoes de implementacao

- Sempre preencher `competenceYear` e `competenceMonth` para reduzir custo de consulta.
- Usar `serverTimestamp()` em `createdAt` e `updatedAt`.
- Em update, preservar `createdAt` e atualizar apenas `updatedAt`.
- Padronizar `costType` com enum local para evitar variacoes de escrita.
- `installmentsTotal` deve ter valor minimo `1`; quando ausente no cadastro rapido, preencher com `1`.
- Firestore e a fonte final da verdade para custos e relatorios; estado local e cache servem apenas para interface.
