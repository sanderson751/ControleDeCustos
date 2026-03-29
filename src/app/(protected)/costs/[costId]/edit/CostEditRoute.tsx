'use client'

import { useRouter } from 'next/navigation'
import CostEditPage from '@/views/CostEditPage'
import type { UserRole } from '@/types/rolePermission'

type CostEditRouteProps = {
  costId: string
  userId: string
  role: UserRole
}

export default function CostEditRoute({ costId, userId, role }: CostEditRouteProps) {
  const router = useRouter()

  return (
    <>
      <nav aria-label="breadcrumb" className="container-fluid pt-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={() => router.push('/costs')}>
              Custos
            </button>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Editar custo
          </li>
        </ol>
      </nav>

      <CostEditPage
        userId={userId}
        role={role}
        costId={costId}
        onBack={() => router.push('/costs')}
        onStatusChange={() => undefined}
      />
    </>
  )
}