'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listCurrentMonthCosts,
  type CostEntry,
} from '../services/costService'

type WelcomeCenterProps = {
  user: {
    uid: string
    name?: string | null
    email?: string | null
  }
}

function WelcomeCenter({ user }: WelcomeCenterProps) {
  const userName = user.name || user.email || 'Usuario'
  const [entries, setEntries] = useState<CostEntry[]>([])
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const dashboardTotals = useMemo(() => {
    const fixedTotal = entries
      .filter((entry) => entry.costType === 'fixo')
      .reduce((sum, entry) => sum + entry.amount, 0)
    const variableTotal = entries
      .filter((entry) => entry.costType === 'variavel')
      .reduce((sum, entry) => sum + entry.amount, 0)

    return {
      fixedTotal,
      variableTotal,
      total: fixedTotal + variableTotal,
    }
  }, [entries])

  useEffect(() => {
    let isMounted = true

    void listCurrentMonthCosts(user.uid, currentYear, currentMonth)
      .then((loadedEntries) => {
        if (!isMounted) {
          return
        }

        setEntries(loadedEntries)
        setDashboardError(null)
        setIsLoadingDashboard(false)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setDashboardError('Nao foi possivel carregar os indicadores do mes corrente.')
        setIsLoadingDashboard(false)
      })

    return () => {
      isMounted = false
    }
  }, [currentMonth, currentYear, user.uid])

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  return (
    <section className="welcome-center container-fluid py-4" data-testid="main-app-screen">
      <div className="welcome-layout card border-0 shadow-sm">
        <div className="card-body p-4 p-md-5 d-flex flex-column">
          <div className="welcome-hero text-center text-lg-start mb-4">
            <p className="text-uppercase text-muted fw-semibold mb-2">Boas-vindas</p>
            <h2 className="display-6 mb-3">Ola, {userName}</h2>
            <p className="lead mb-2">Dashboard de custos do mes corrente.</p>
            <p className="text-muted mb-0">
              Acompanhe o total do mes e a distribuicao entre custos fixos e variaveis.
            </p>
          </div>

          <div className="row g-3 welcome-dashboard flex-grow-1">
            <div className="col-12 col-md-4 d-flex">
              <article className="welcome-indicator welcome-indicator-total w-100">
                <p className="welcome-indicator-label mb-2">Total de custos</p>
                <h3 className="welcome-indicator-value mb-0">
                  {isLoadingDashboard ? 'Carregando...' : formatCurrency(dashboardTotals.total)}
                </h3>
              </article>
            </div>

            <div className="col-12 col-md-4 d-flex">
              <article className="welcome-indicator welcome-indicator-fixed w-100">
                <p className="welcome-indicator-label mb-2">Custos fixos</p>
                <h3 className="welcome-indicator-value mb-0">
                  {isLoadingDashboard
                    ? 'Carregando...'
                    : formatCurrency(dashboardTotals.fixedTotal)}
                </h3>
              </article>
            </div>

            <div className="col-12 col-md-4 d-flex">
              <article className="welcome-indicator welcome-indicator-variable w-100">
                <p className="welcome-indicator-label mb-2">Custos variaveis</p>
                <h3 className="welcome-indicator-value mb-0">
                  {isLoadingDashboard
                    ? 'Carregando...'
                    : formatCurrency(dashboardTotals.variableTotal)}
                </h3>
              </article>
            </div>
          </div>

          <div className="mt-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <p className="text-muted mb-0">
              Competencia atual: {String(currentMonth).padStart(2, '0')}/{currentYear}
            </p>
            <p className="text-muted mb-0">Lancamentos considerados: {entries.length}</p>
          </div>

          {dashboardError && <div className="alert alert-warning mt-3 mb-0">{dashboardError}</div>}
        </div>
      </div>
    </section>
  )
}

export default WelcomeCenter
