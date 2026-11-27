# Firestore - Importar extrato (CSV)

## Coleções

Nenhuma coleção nova. Cada linha importada é um documento comum em
`users/{uid}/costEntries/{autoId}`:

| Campo | Valor na importação |
| ----- | ------------------- |
| `userId` | uid do usuário |
| `accountName` | descrição do extrato (aparada, até 200) |
| `amount` | valor absoluto da despesa |
| `costType` | frente escolhida (padrão `variavel`) |
| `category` | sugerida/escolhida (padrão ou personalizada ativa) |
| `description` | `Importado de <arquivo>` (até 500) |
| `installmentsTotal` | 1 |
| `competenceYear`/`competenceMonth` | mês da data da transação |
| `createdAt` | data da transação (meio-dia local) |
| `updatedAt` | `serverTimestamp()` |

## Consultas

- Duplicados e histórico: `listCostsByCompetenceRange(uid, menorMês, maiorMês)` (consulta `in` por ano já indexada).

## Persistência

- `writeBatch` em lotes de até 400 operações e até 10 categorias personalizadas distintas por lote
  (cada uma custa um `exists()` nas regras). Lotes sequenciais; falha interrompe e reporta o parcial.

## Regras de segurança

Sem alteração: `costEntries` create já exige dono, papel `admin|standard`, `userId` correto e
`isValidCost(userId, data)` (categoria válida do próprio usuário, valores e competência). Teste novo
no emulador: lote com 10 categorias personalizadas distintas é aceito.

## Índices

Nenhum novo.
