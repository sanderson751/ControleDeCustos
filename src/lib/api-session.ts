import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function getApiSessionUser() {
  const session = await auth()

  if (!session?.user?.uid || !session.user.role) {
    return null
  }

  return session.user
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: 'Sessao nao autenticada.' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ message: 'Voce nao possui permissao para esta operacao.' }, { status: 403 })
}