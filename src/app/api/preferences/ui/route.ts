import { NextResponse } from 'next/server'
import { getApiSessionUser, unauthorizedResponse } from '@/lib/api-session'
import {
  getUiPreferences,
  updateUiPreferences,
} from '@/services/server/uiPreferenceService'

export async function GET() {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  const preferences = await getUiPreferences(sessionUser.uid)
  return NextResponse.json(preferences)
}

export async function PATCH(request: Request) {
  const sessionUser = await getApiSessionUser()

  if (!sessionUser) {
    return unauthorizedResponse()
  }

  const body = (await request.json()) as { sidebarCollapsed?: boolean; theme?: 'light' | 'dark' }
  const preferences = await updateUiPreferences(sessionUser.uid, body)
  return NextResponse.json(preferences)
}