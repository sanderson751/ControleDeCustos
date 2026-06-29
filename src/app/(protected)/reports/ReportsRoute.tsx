'use client'

import { useCallback, useState } from 'react'
import ReportsPage from '@/views/ReportsPage'
import Snackbar, { type SnackbarStatus } from '@/components/Snackbar'
import type { UserRole } from '@/types/rolePermission'

type ReportsRouteProps = {
  role: UserRole
}

export default function ReportsRoute({ role }: ReportsRouteProps) {
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    status: SnackbarStatus
    message: string
  }>({
    open: false,
    status: 'success',
    message: '',
  })

  const showStatus = useCallback((status: SnackbarStatus, message: string) => {
    setSnackbar({
      open: true,
      status,
      message,
    })
  }, [])

  return (
    <>
      <ReportsPage role={role} onStatusChange={showStatus} />
      <Snackbar
        open={snackbar.open}
        status={snackbar.status}
        message={snackbar.message}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      />
    </>
  )
}
