import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { getUserRole, upsertUserProfile } from '@/services/server/userProfileService'

type FirebasePasswordAuthResponse = {
  localId: string
  email: string
  displayName?: string
}

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
    return null
  }

  return payload
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        const user = await signInWithFirebasePassword(email, password)

        if (!user) {
          return null
        }

        return {
          id: user.localId,
          email: user.email,
          name: user.displayName ?? user.email,
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