import { requestJson } from './httpClient'

export type ThemeMode = 'light' | 'dark'

type UiPreferences = {
  sidebarCollapsed: boolean
  theme: ThemeMode
}

export async function getSidebarCollapsedPreference(userId: string): Promise<boolean | null> {
  void userId

  const preferences = await requestJson<UiPreferences>('/api/preferences/ui')
  return preferences.sidebarCollapsed
}

export async function setSidebarCollapsedPreference(
  userId: string,
  isCollapsed: boolean,
): Promise<void> {
  void userId

  await requestJson('/api/preferences/ui', {
    method: 'PATCH',
    body: JSON.stringify({ sidebarCollapsed: isCollapsed }),
  })
}

export async function getThemePreference(userId: string): Promise<ThemeMode | null> {
  void userId

  const preferences = await requestJson<UiPreferences>('/api/preferences/ui')
  return preferences.theme
}

export async function setThemePreference(userId: string, theme: ThemeMode): Promise<void> {
  void userId

  await requestJson('/api/preferences/ui', {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  })
}
