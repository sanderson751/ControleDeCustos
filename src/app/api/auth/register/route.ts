import { NextResponse } from 'next/server'
import { isEmailRegistered, upsertUserProfile } from '@/services/server/userProfileService'

function mapIdentityError(code: string) {
  switch (code) {
    case 'EMAIL_EXISTS':
      return 'Este email ja esta em uso. Tente entrar ou use outro email.'
    case 'INVALID_EMAIL':
      return 'Informe um email valido.'
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
    case 'WEAK_PASSWORD':
      return 'A senha deve ter pelo menos 6 caracteres.'
    default:
      return 'Nao foi possivel criar a conta. Tente novamente.'
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { message: 'Configuracao do Firebase ausente.', code: 'FIREBASE_API_KEY_MISSING' },
      { status: 500 },
    )
  }

  const body = (await request.json()) as { name?: string; email?: string; password?: string }
  const name = body.name?.trim() ?? ''
  const email = body.email?.trim() ?? ''
  const password = body.password ?? ''

  if (!email || !password) {
    return NextResponse.json(
      { message: 'Email e senha sao obrigatorios.', code: 'INVALID_INPUT' },
      { status: 400 },
    )
  }

  const emailInUse = await isEmailRegistered(email)

  if (emailInUse) {
    return NextResponse.json(
      {
        message: mapIdentityError('EMAIL_EXISTS'),
        code: 'EMAIL_EXISTS',
      },
      { status: 400 },
    )
  }

  const signUpResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  )

  const signUpPayload = (await signUpResponse.json()) as {
    localId?: string
    idToken?: string
    email?: string
    error?: { message?: string }
  }

  if (!signUpResponse.ok || !signUpPayload.localId || !signUpPayload.idToken || !signUpPayload.email) {
    return NextResponse.json(
      {
        message: mapIdentityError(signUpPayload.error?.message ?? ''),
        code: signUpPayload.error?.message ?? 'REGISTER_FAILED',
      },
      { status: 400 },
    )
  }

  if (name) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: signUpPayload.idToken,
        displayName: name,
        returnSecureToken: true,
      }),
    })
  }

  await upsertUserProfile({
    uid: signUpPayload.localId,
    email: signUpPayload.email,
    displayName: name || signUpPayload.email,
    provider: 'password',
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}