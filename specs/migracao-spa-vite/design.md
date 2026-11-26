# Design - Migração para SPA (Vite + React) com shadcn/ui

## Visão de solução

```
Navegador
 └─ SPA (Vite build estático no Firebase Hosting)
     ├─ ThemeProvider ─ classe `dark` no <html> + cache localStorage
     ├─ AuthProvider ─ onAuthStateChanged + onSnapshot(users/{uid})  → status/profile/role
     ├─ Router (React Router 8)
     │   ├─ PublicOnlyRoute → /login
     │   └─ ProtectedRoute → AppShell (Sidebar + AppHeader)
     │        ├─ /home  /costs  /costs/:costId/edit  /reports
     │        └─ RequireRole(admin) → /userProfiles
     ├─ services/* ── Firebase JS SDK ──► Firebase Auth / Cloud Firestore
     └─ Toaster (Sonner) ← notify()
                                   ▲
                    firestore.rules (única barreira de segurança)
```

## Decisões e trade-offs

| Decisão | Alternativa | Motivo |
| --- | --- | --- |
| Vite + React Router (SPA) | Next.js SSR/static export | Hosting estático no plano Spark; app é 100% autenticado, SSR não agrega SEO |
| Firestore client + regras | API própria (Cloud Functions) | Sem custo de backend; regras testáveis no emulador. Trade-off: toda validação precisa estar nas regras |
| Firebase Auth no client | NextAuth | Elimina servidor; sessão persistida pelo SDK |
| Novo usuário sempre `standard` | "primeiro usuário vira admin" | Regras não conseguem contar documentos de forma segura; promoção manual do primeiro admin evita escalonamento de privilégio |
| Mensagem única de credencial inválida | Distinguir "usuário não existe" | Proteção contra enumeração de emails do Firebase Auth; melhor prática de segurança |
| shadcn/ui + Tailwind v4 | Bootstrap 5 | Componentes acessíveis (Radix), tokens via CSS variables, aderente ao estilo Origin |
| Vitest | Jest + next/jest | Integração nativa com Vite |

## Camadas

- `domain/entities`: `CostEntry`, `NewCostInput`, `UpdateCostInput`, `CostTotals`, `UserProfile`, `UserRole`, `UiPreferences`.
- `domain/rules`:
  - `costRules.ts`: `calculateTotals`, `filterByCostType`, `sortByCreatedAtDesc`, `normalizeInstallments`, `addMonths` (fim de mês seguro), `buildInstallmentPlan`, `validateCostForm`, `paginate`.
  - `permissions.ts`: matriz de permissões (espelho de `firestore.rules`), rótulos e normalização de papel.
- `services`: `authService`, `userService` (transação de perfil, assinatura em tempo real, gestão admin), `costService` (batch de parcelas), `reportService`, `uiPreferenceService`, `converters`, `firestorePaths`.
- `providers`: `AuthProvider` (status `loading | authenticated | unauthenticated | error`), `ThemeProvider`.
- `hooks`: `useMonthCosts`, `useUiPreferencesSync` (tema + menu com rollback em falha).
- `routes`: `router.tsx`, `lazyPages.tsx`, `guards.tsx`, `navigation.ts`.

## Tema (Origin Financial)

- Paleta dark original: Obsidian `#0f1011` (canvas), Abyss `#090a0b` (sidebar), Graphite `#2e2e2e` (popover/muted), Steel `#3f4041` (hover), Ash `#9f9fa0` (texto secundário), Cloud `#f5f5f7` (texto), branco como ação primária.
- Cards de dados em `#1b1c1d` (passo intermediário derivado para tabelas extensas).
- Tiles cromáticos (raio 30px, sem sombra): Iris `#847dff`, Periwinkle `#90b8f0`, Orchid `#dd90d8`, Pale Iris `#d1c9ff` — sempre com texto preto (contraste ≥ 6:1).
- Tipografia: Fraunces 300 (substituto do Lyon Display), Inter (Suisse Int'l), Roboto Mono uppercase para rótulos (`.eyebrow`).
- Raios: 8px (botões/inputs), 16px (cards), 30px (tiles), pill para chips/segmentos.
- Light: variante derivada "Paper" (`#f5f5f7` canvas, cards brancos, primário `#0f1011`).
- Status do snackbar (iguais nos dois temas): sucesso `#4ade80`, warning `#facc15`, erro `#f87171`, com texto escuro.

## Tratamento de erro

- Erros de Auth → `friendlyAuthErrorMessage`; erros do Firestore → `friendlyFirestoreErrorMessage` com fallback contextual.
- Toda escrita: `try/catch` → `notify("error", …)`; sucesso → `notify("success", …)`; validação → `notify("warning", …)`.
- Preferências de UI: atualização otimista com rollback do tema em falha.
- Perfil indisponível (regras não publicadas/offline): tela de erro com ação "Voltar ao login".

## Publicação

- `firebase.json`: `public: dist`, rewrite `** → /index.html`, cache imutável para `/assets/**`, `no-cache` para `index.html`.
- Variáveis `VITE_FIREBASE_*` em `.env.local` (públicas por design).
- Pré-requisitos no Console: provedores Email/senha e Google habilitados; domínio do Hosting autorizado (automático para `*.web.app`/`*.firebaseapp.com`).
