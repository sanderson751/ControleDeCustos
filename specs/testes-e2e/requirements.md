# Requirements - Testes E2E

## Contexto

Os testes unitários (Vitest) e de regras (emulador) não exercitam a tela, os serviços e as regras do
Firestore juntos. Defeitos de integração (limite de acessos por lote, concorrência, layout de arquivos)
só apareciam em revisão manual. Antes do primeiro deploy, os fluxos críticos precisam de cobertura de
ponta a ponta.

## Requisitos

- RF-01: comando `npm run test:e2e` sobe os emuladores (Auth + Firestore) e executa os testes no navegador.
- RF-02: cada teste começa com emuladores vazios e cria os próprios usuários (papel definido no perfil).
- RF-03: fluxos cobertos:
  - autenticação: rota protegida → login; cadastro (conta nasce `standard`); senha errada; logout;
  - categoria personalizada + custo nela (persistido no Firestore) + total no Início;
  - orçamento atingido → alerta no Início;
  - importação de CSV (crédito ignorado, categoria sugerida, gravação);
  - recorrência com início no mês anterior → 2 lançamentos, sem duplicar ao reabrir;
  - meta de economia com depósito → cartão e resumo no Início;
  - exportação de relatório CSV (conteúdo do arquivo);
  - `guest`: vê os próprios dados, sem ações de edição nem importação.
- RNF-01: fora do `npm run verify` (depende de Java/emulador e de navegador), como o `test:rules`.
- RNF-02: sem dependência de credenciais reais: projeto `demo-*`, app ligado aos emuladores por
  `VITE_USE_EMULATORS=true` (nunca presente no build de produção).
- RNF-03: usa o Chrome instalado (`channel: chrome`); em outra máquina, `npx playwright install chromium`
  e `PW_CHANNEL=""`.
