'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '@mdi/react'
import { mdiChevronDown, mdiFileDelimited, mdiFilePdfBox, mdiFilterVariant } from '@mdi/js'
import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import type { UserRole } from '../types/rolePermission'
import type { CostType } from '../services/costService'
import { formatCurrencyBRL } from '../lib/currency'
import { listCostsForReport } from '../services/reportService'

type ReportsPageProps = {
  role: UserRole
  onStatusChange: (status: 'success' | 'error' | 'warning', message: string) => void
}

type ReportFilterType = 'todos' | CostType

type ReportEntry = Awaited<ReturnType<typeof listCostsForReport>>[number]

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultDateRange() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    startDate: toInputDate(firstDay),
    endDate: toInputDate(now),
  }
}

function formatDate(value: Date) {
  return value.toLocaleDateString('pt-BR')
}

function getCostTypeLabel(costType: CostType) {
  return costType === 'fixo' ? 'Fixo' : 'Variavel'
}

function getCsvContent(entries: ReportEntry[]) {
  const header = ['Conta', 'Frente', 'Valor', 'Data de criacao', 'Competencia', 'Parcelas']

  const rows = entries.map((entry) => [
    entry.accountName,
    getCostTypeLabel(entry.costType),
    entry.amount.toFixed(2).replace('.', ','),
    formatDate(entry.createdAt),
    `${String(entry.competenceMonth).padStart(2, '0')}/${entry.competenceYear}`,
    String(entry.installmentsTotal),
  ])

  return [header, ...rows]
    .map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(';'))
    .join('\n')
}

function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

export default function ReportsPage({ role, onStatusChange }: ReportsPageProps) {
  const defaultRange = useMemo(getDefaultDateRange, [])
  const [startDate, setStartDate] = useState(defaultRange.startDate)
  const [endDate, setEndDate] = useState(defaultRange.endDate)
  const [costType, setCostType] = useState<ReportFilterType>('todos')
  const [entries, setEntries] = useState<ReportEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [activeExportType, setActiveExportType] = useState<'csv' | 'pdf' | null>(null)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)

  const canView = role === 'admin' || role === 'standard' || role === 'guest'

  const totals = useMemo(() => {
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

  const loadReport = useCallback(async () => {
    if (!startDate || !endDate) {
      onStatusChange('warning', 'Informe o periodo inicial e final para filtrar o relatorio.')
      return
    }

    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      onStatusChange('warning', 'A data inicial nao pode ser maior que a data final.')
      return
    }

    try {
      setIsLoading(true)

      const reportEntries = await listCostsForReport({
        startDate,
        endDate,
        costType,
      })

      setEntries(reportEntries)
    } catch {
      onStatusChange('error', 'Nao foi possivel carregar o relatorio com os filtros selecionados.')
    } finally {
      setIsLoading(false)
    }
  }, [costType, endDate, onStatusChange, startDate])

  useEffect(() => {
    if (!canView) {
      return
    }

    void loadReport()
  }, [canView, loadReport])

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadReport()
  }

  async function handleExportCsv() {
    if (entries.length === 0) {
      onStatusChange('warning', 'Nao ha lancamentos para exportar no formato CSV.')
      return
    }

    setIsExporting(true)
    setActiveExportType('csv')

    try {
      const csvContent = getCsvContent(entries)
      downloadBlob(csvContent, `relatorio-custos-${startDate}-a-${endDate}.csv`, 'text/csv;charset=utf-8')
      onStatusChange('success', 'Relatorio exportado em CSV com sucesso.')
    } catch {
      onStatusChange('error', 'Falha ao exportar CSV. Tente novamente.')
    } finally {
      setIsExporting(false)
      setActiveExportType(null)
      setIsExportMenuOpen(false)
    }
  }

  async function handleExportPdf() {
    if (entries.length === 0) {
      onStatusChange('warning', 'Nao ha lancamentos para exportar no formato PDF.')
      return
    }

    setIsExporting(true)
    setActiveExportType('pdf')

    try {
      const document = new jsPDF({ orientation: 'landscape' })

      document.setFontSize(12)
      document.text(`Relatorio de Custos (${startDate} a ${endDate})`, 14, 14)

      autoTable(document, {
        startY: 22,
        head: [['Conta', 'Frente', 'Valor', 'Data de criacao', 'Competencia', 'Parcelas']],
        body: entries.map((entry) => [
          entry.accountName,
          getCostTypeLabel(entry.costType),
          formatCurrencyBRL(entry.amount),
          formatDate(entry.createdAt),
          `${String(entry.competenceMonth).padStart(2, '0')}/${entry.competenceYear}`,
          String(entry.installmentsTotal),
        ]),
      })

      document.save(`relatorio-custos-${startDate}-a-${endDate}.pdf`)
      onStatusChange('success', 'Relatorio exportado em PDF com sucesso.')
    } catch {
      onStatusChange('error', 'Falha ao exportar PDF. Tente novamente.')
    } finally {
      setIsExporting(false)
      setActiveExportType(null)
      setIsExportMenuOpen(false)
    }
  }

  if (!canView) {
    return (
      <section className="container-fluid py-4">
        <div className="alert alert-warning mb-0">Voce nao possui permissao para visualizar relatorios.</div>
      </section>
    )
  }

  return (
    <section className="reports-page container-fluid py-4" data-testid="reports-page-screen">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h2 className="h4 mb-0">Relatorios de lancamentos</h2>
        <div className="overflow-menu-wrapper">
          <button
            type="button"
            className="btn btn-outline-primary btn-loading-stable btn-loading-width-md d-inline-flex align-items-center gap-2"
            aria-expanded={isExportMenuOpen}
            onClick={() => setIsExportMenuOpen((current) => !current)}
            disabled={isExporting || isLoading}
            aria-busy={isExporting ? 'true' : undefined}
          >
            <span className="btn-icon-slot" aria-hidden="true">
              {isExporting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              ) : (
                <span className="btn-icon-placeholder" />
              )}
            </span>
            {isExporting ? 'Exportando...' : 'Exportar'}
            <Icon path={mdiChevronDown} size={0.7} aria-hidden="true" />
          </button>

          {isExportMenuOpen && (
            <div className="overflow-menu card shadow-sm" role="menu" aria-label="Opcoes de exportacao">
              <button
                type="button"
                className="btn btn-sm btn-loading-stable text-start"
                role="menuitem"
                onClick={handleExportCsv}
                disabled={isExporting || isLoading}
                aria-busy={activeExportType === 'csv' ? 'true' : undefined}
              >
                <span className="btn-icon-label">
                  <span className="btn-icon-slot" aria-hidden="true">
                    {activeExportType === 'csv' ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    ) : (
                      <Icon path={mdiFileDelimited} size={0.8} aria-hidden="true" />
                    )}
                  </span>
                  <span>{activeExportType === 'csv' ? 'Exportando CSV...' : 'Exportar CSV'}</span>
                </span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-loading-stable text-start"
                role="menuitem"
                onClick={handleExportPdf}
                disabled={isExporting || isLoading}
                aria-busy={activeExportType === 'pdf' ? 'true' : undefined}
              >
                <span className="btn-icon-label">
                  <span className="btn-icon-slot" aria-hidden="true">
                    {activeExportType === 'pdf' ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    ) : (
                      <Icon path={mdiFilePdfBox} size={0.8} aria-hidden="true" />
                    )}
                  </span>
                  <span>{activeExportType === 'pdf' ? 'Exportando PDF...' : 'Exportar PDF'}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <form className="card border-0 shadow-sm mb-4" onSubmit={handleFilterSubmit}>
        <div className="card-body">
          <h3 className="h6 mb-3 d-flex align-items-center gap-2">
            <Icon path={mdiFilterVariant} size={0.8} aria-hidden="true" />
            Filtros
          </h3>

          <div className="row g-3">
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="report-start-date">
                Data inicial
              </label>
              <input
                id="report-start-date"
                type="date"
                className="form-control"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="report-end-date">
                Data final
              </label>
              <input
                id="report-end-date"
                type="date"
                className="form-control"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="report-cost-type">
                Frente
              </label>
              <select
                id="report-cost-type"
                className="form-select"
                value={costType}
                onChange={(event) => setCostType(event.target.value as ReportFilterType)}
              >
                <option value="todos">Todos</option>
                <option value="fixo">Fixo</option>
                <option value="variavel">Variavel</option>
              </select>
            </div>

            <div className="col-12 col-md-3 d-flex align-items-end">
              <button
                type="submit"
                className="btn btn-primary btn-loading-stable w-100 d-inline-flex align-items-center justify-content-center gap-2"
                disabled={isLoading || isExporting}
                aria-busy={isLoading ? 'true' : undefined}
              >
                <span className="btn-icon-slot" aria-hidden="true">
                  {isLoading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  ) : (
                    <span className="btn-icon-placeholder" />
                  )}
                </span>
                {isLoading ? 'Filtrando...' : 'Aplicar filtros'}
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <article className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Total fixo</p>
              <h3 className="h5 mb-0">{formatCurrencyBRL(totals.fixedTotal)}</h3>
            </div>
          </article>
        </div>
        <div className="col-12 col-md-4">
          <article className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Total variavel</p>
              <h3 className="h5 mb-0">{formatCurrencyBRL(totals.variableTotal)}</h3>
            </div>
          </article>
        </div>
        <div className="col-12 col-md-4">
          <article className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Total geral</p>
              <h3 className="h5 mb-0">{formatCurrencyBRL(totals.total)}</h3>
            </div>
          </article>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h3 className="h6 mb-3">Lancamentos (Grid)</h3>

          {isLoading ? (
            <div className="py-3">Carregando relatorio...</div>
          ) : entries.length === 0 ? (
            <div className="text-muted py-3">Nenhum lancamento encontrado para os filtros selecionados.</div>
          ) : (
            <div className="reports-grid-wrapper">
              <div className="reports-grid reports-grid-header" role="row">
                <strong>Conta</strong>
                <strong>Frente</strong>
                <strong>Valor</strong>
                <strong>Data</strong>
                <strong>Competencia</strong>
                <strong>Parcelas</strong>
              </div>

              {entries.map((entry) => (
                <div className="reports-grid" role="row" key={entry.id}>
                  <span>{entry.accountName}</span>
                  <span>
                    <span className={`badge ${entry.costType === 'fixo' ? 'text-bg-primary' : 'text-bg-secondary'}`}>
                      {getCostTypeLabel(entry.costType)}
                    </span>
                  </span>
                  <span>{formatCurrencyBRL(entry.amount)}</span>
                  <span>{formatDate(entry.createdAt)}</span>
                  <span>{String(entry.competenceMonth).padStart(2, '0')}/{entry.competenceYear}</span>
                  <span>{entry.installmentsTotal}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
