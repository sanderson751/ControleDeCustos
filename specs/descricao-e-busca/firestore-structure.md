# Firestore Structure - Descrição do lançamento e busca

## Subcoleção alterada

Caminho: `users/{userId}/costEntries/{entryId}`

Campo novo (opcional):

- `description`: string (0–500 caracteres). Documentos antigos sem o campo são lidos como `""`.

## Consultas principais

- Inalteradas. A busca filtra no client os lançamentos da competência carregada.

## Operações de persistência

- Create: `description` (aparada) em todas as parcelas do batch.
- Update: `description` editável junto com os demais campos; atualiza `updatedAt`.
- Falha: snackbar vermelho, formulário preservado.

## Regras de segurança (diff)

```txt
function isValidCost(data) {
  return ...
    && data.get('description', '') is string
    && data.get('description', '').size() <= 500;
}
```

## Índices

- Nenhum índice novo.
