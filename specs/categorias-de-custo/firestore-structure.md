# Firestore Structure - Categorias de custo

## Subcoleção alterada

Caminho: `users/{userId}/costEntries/{entryId}`

Campo novo:

- `category`: string — `moradia | alimentacao | transporte | saude | educacao | lazer | outros`

Exemplo:

```json
{
  "userId": "u_123",
  "accountName": "Mercado",
  "amount": 412.9,
  "costType": "variavel",
  "category": "alimentacao",
  "installmentsTotal": 1,
  "competenceYear": 2026,
  "competenceMonth": 11,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

## Consultas principais

- Mês de competência: `competenceYear ==` e `competenceMonth ==` (filtros de frente/categoria no client).
- Relatório: `createdAt` entre datas (+ `costType ==` opcional) e `orderBy(createdAt desc)`; categoria filtrada no client.

## Operações de persistência

- Create: `category` obrigatório em todas as parcelas do batch.
- Update: `category` editável junto com conta, valor, frente e parcelas; atualiza `updatedAt`.
- Delete: inalterado (hard delete).
- Falha: erro de permissão/rede → snackbar vermelho, formulário preservado.

## Migração

- Sem migração em lote: documentos sem `category` são lidos como `outros`. Ao editar um
  lançamento legado, a categoria passa a ser gravada.

## Regras de segurança (diff)

```txt
function isValidCost(data) {
  return ...
    && data.category in ['moradia', 'alimentacao', 'transporte', 'saude', 'educacao', 'lazer', 'outros'];
}
```

## Índices

- Nenhum índice novo.
