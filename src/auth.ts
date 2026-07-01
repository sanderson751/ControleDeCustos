import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { cookies } from 'next/headers'
import {
  findUserByEmail,
  getUserRole,
  upsertUserProfile,
} from '@/services/server/userProfileService'

type FirebasePasswordAuthResponse = {
  localId: string
  email: string
  displayName?: string
}

type FirebasePasswordAuthError =
  | 'INVALID_LOGIN_CREDENTIALS'
  | 'INVALID_PASSWORD'
  | 'EMAIL_NOT_FOUND'
  | 'USER_DISABLED'
  | 'UNKNOWN'

async function signInWithFirebasePassword(email: string, password: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY_MISSING')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
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

  const payload = (await response.json()) as
    | FirebasePasswordAuthResponse
    | { error?: { message?: string } }

  if (!response.ok || !('localId' in payload)) {
    const message =
      'error' in payload && payload.error?.message
        ? String(payload.error.message)
        : 'UNKNOWN'

    return {
      user: null,
      error: message as FirebasePasswordAuthError,
    }
  }

  return {
    user: payload,
    error: null,
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      name: 'Email e senha',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''

        if (!email || !password) {
          return null
        }

        const authResult = await signInWithFirebasePassword(email, password)

        if (!authResult.user) {
          if (authResult.error === 'EMAIL_NOT_FOUND') {
            throw new Error('USER_NOT_FOUND')
          }

          if (
            authResult.error === 'INVALID_PASSWORD' ||
            authResult.error === 'INVALID_LOGIN_CREDENTIALS'
          ) {
            const existingUser = await findUserByEmail(email)

            if (existingUser) {
              throw new Error('INVALID_CREDENTIALS')
            }

            throw new Error('USER_NOT_FOUND')
          }

          throw new Error('AUTH_FAILED')
        }

        return {
          id: authResult.user.localId,
          email: authResult.user.email,
          name: authResult.user.displayName ?? authResult.user.email,
        }
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.id || !user.email) {
        return false
      }

      if (account?.provider === 'google') {
        const authIntent = (await cookies()).get('auth_intent')?.value
        const isRegisterIntent = authIntent === 'register'
        const emailOwner = await findUserByEmail(user.email)

        if (emailOwner) {
          if (isRegisterIntent && emailOwner.uid !== user.id) {
            return '/login?error=EMAIL_EXISTS'
          }

          // Em modo "Ja tenho conta", reaproveita o uid ja existente para evitar duplicidade.
          user.id = emailOwner.uid
        }
      }

      await upsertUserProfile({
        uid: user.id,
        email: user.email,
        displayName: user.name ?? '',
        photoURL: user.image ?? '',
        provider: account?.provider ?? 'credentials',
      })

      return true
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id
      }

      if (typeof token.uid === 'string') {
        token.role = await getUserRole(token.uid)
      }

      return token
    },
    async session({ session, token }) {
      if (
        session.user &&
        typeof token.uid === 'string' &&
        (token.role === 'admin' || token.role === 'standard' || token.role === 'guest')
      ) {
        session.user.uid = token.uid
        session.user.role = token.role
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})