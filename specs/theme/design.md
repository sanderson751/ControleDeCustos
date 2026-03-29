# Design - theme

## Visao de solucao

A solucao introduz um tema global orientado por estado (`light` | `dark`) aplicado no shell autenticado.
A estrategia usa tokens CSS globais para evitar ajustes pontuais em cada componente.
A alternancia ocorre por botao icon-only na appbar com tooltip descritiva e persistencia da preferencia no Firestore.

## Modelo de dominio

- ThemeMode
  - `light` | `dark`

- ThemeState
  - `mode`: ThemeMode
  - `isLoadingPreference`: boolean

- ThemePreference
  - `userId`: string
  - `ui.theme`: ThemeMode
  - `updatedAt`: Timestamp

## Regras de negocio

- RB-01: `light` e o modo inicial/fallback.
- RB-02: O texto da tooltip deve descrever a acao de troca e nao apenas o estado atual.
- RB-03: O botao de tema deve seguir padrao de icone Material Design Community.
- RB-04: O botao de tema deve ficar imediatamente a esquerda do botao de logout na appbar.
- RB-05: O botao de tema deve estar acessível a todos os usuarios autenticados, independente de role (preferencia de UI pessoal).

## Componentes e hooks

- GlobalAppBar
  - incluir botao de tema com icone + tooltip.
  - manter botao de logout no canto direito.

- AppThemeProvider (ou estado no App shell)
  - aplicar classe/atributo global para tema (`data-theme`).
  - disponibilizar `toggleTheme()`.

- useThemePreference(userId)
  - carregar preferencia do Firestore.
  - persistir alteracoes de tema.

- GlobalSnackbar
  - renderizar mensagens de sucesso/erro/warning no canto superior direito.
  - auto-dismiss em 3 segundos.
  - botao de fechar com icone `X`.

## Persistencia e integracoes

Persistencia no Firestore:
- `users/{uid}/settings/profile`
  - `ui.theme`: `light` | `dark`
  - `updatedAt`: Timestamp

Integracoes:
- Firestore para ler/gravar preferencia de tema.
- `react-tooltip` para tooltip no botao de tema.
- Material Design Icons Community (`@mdi/react` + `@mdi/js`) para icones.

## Estrategia de estilos

- Definir tokens em nivel global com CSS variables, por exemplo:
  - `--bg-default`, `--bg-surface`, `--text-primary`, `--text-muted`, `--border-default`, `--accent`.
- Incluir tokens semanticos para estados criticos:
  - `--btn-primary-text`, `--btn-secondary-text`, `--alert-danger-text`, `--alert-warning-text`, `--badge-*-text`.
- Aplicar tema por atributo no elemento raiz:
  - `[data-theme="light"]`
  - `[data-theme="dark"]`
- Garantir que appbar, sidebar, cards e textos usem tokens em vez de cores hardcoded.
- Mapear variaveis Bootstrap (`--bs-*`) para os tokens do tema ativo no shell.
- Garantir contraste AA em ambos os temas para textos e elementos interativos.
- Definir tokens de snackbar por status (erro/sucesso/warning) mantendo legibilidade em ambos os temas.

## Fluxo principal

1. Usuario autenticado entra no app.
2. Sistema carrega `ui.theme` do Firestore.
3. Se nao houver preferencia valida, aplica `light`.
4. Appbar renderiza botao de tema a esquerda do logout.
5. Usuario clica no botao de tema.
6. Sistema alterna modo, atualiza tooltip/icone e persiste no Firestore.
