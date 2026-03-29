import { NextResponse } from 'next/server'
import { auth } from './src/auth'

const PUBLIC_PATHS = new Set(['/login'])

export default auth((request) => {
  const { nextUrl, auth: session } = request
  const pathname = nextUrl.pathname
  const isPublicPath = PUBLIC_PATHS.has(pathname)
  const isAuthenticated = Boolean(session?.user)

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/home', nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}