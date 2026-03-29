import type { Metadata } from 'next'
import { getOptionalSession } from '@/lib/session'
import { SessionProviders } from '@/components/SessionProviders'
import './globals.css'

export const metadata: Metadata = {
  title: 'Controle de Custos',
  description: 'Gestao de custos com Next.js, Auth.js e Firestore',
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await getOptionalSession()

  return (
    <html lang="pt-BR">
      <body>
        <SessionProviders session={session}>{children}</SessionProviders>
      </body>
    </html>
  )
}