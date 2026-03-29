import type { UserRole } from './rolePermission'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      uid: string
      role: UserRole
    }
  }

  interface User {
    role?: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string
    role?: UserRole
  }
}