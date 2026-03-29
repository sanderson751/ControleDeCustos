'use client'

import { useRouter } from 'next/navigation'
import CostsPage from '@/views/CostsPage'
import type { UserRole } from '@/types/rolePermission'

type CostsRouteProps = {
  userId: string
  role: UserRole
}

export default function CostsRoute({ userId, role }: CostsRouteProps) {
  const router = useRouter()

  return (
    <CostsPage
      userId={userId}
      role={role}
      onStatusChange={() => undefined}
      onEditCost={(costId) => router.push(`/costs/${costId}/edit`)}
    />
  )
}