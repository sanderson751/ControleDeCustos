'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '@mdi/react'
import { mdiPencil, mdiTrashCanOutline } from '@mdi/js'
import { Tooltip } from 'react-tooltip'
import {
  type CostEntry,
  type CostType,
  createCostEntry,
  deleteCostEntry,
  listCurrentMonthCosts,
} from '../services/costService'
import {
  formatCurrencyBRL,
  maskCurrencyInput,
  parseMaskedCurrencyToNumber,
} from '../lib/currency'
import { type UserRole } from '../types/rolePermission'

type CostsPageProps = {
  userId: string
  role: UserRole
  onStatusChange: (status: 'success' | 'error' | 'warning', message: string) => void
  onEditCost: (costId: string) => void
}

type CostFilter = 'todos' | CostType

const ACTION_ICON_SIZE = 0.8
const PAGE_SIZE = 10

function getFirestoreErrorMessage(error: unknown, fallbackMessage: string) {
  if (!error || typeof error !== 'object') {
    return fallbackMessage
  }

  const maybeCode = 'code' in error ? String(error.code) : ''

  if (maybeCode === 'permission-denied') {
    return 'Sem permissao para acessar ou salvar custos no Firestore.'
  }

  if (maybeCode === 'unauthenticated') {
    return 'Sua sessao nao esta autenticada para acessar os custos.'
  }

  if (maybeCode === 'failed-precondition') {
    return 'A consulta de custos exige configuracao adicional no Firestore.'
  }

  if ('message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

function formatDate(value: Date) {
  return value.toLocaleDateString('pt-BR')
}

function toInputDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function CostsPage({ userId, role, onStatusChange, onEditCost }: CostsPageProps) {
  const [entries, setEntries] = useState<CostEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<CostFilter>('todos')
  const [accountName, setAccountName] = useState('')
  const [amount, setAmount] = useState('')
  const [costType, setCostType] = useState<CostType>('variavel')
  const [installmentsTotal, setInstallmentsTotal] = useState('1')
  const [useManualDate, setUseManualDate] = useState(false)
  const [manualDate, setManualDate] = useState(toInputDateValue(new Date()))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [isEditingId, setIsEditingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const now = useMemo(() => new Date(), [])
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const canMutate = role !== 'guest'
  const isMutating = isSubmitting || Boolean(isDeletingId) || Boolean(isEditingId)

  const loadCosts = useCallback(async () => {
    try {
      setIsLoading(true)
      const costEntries = await listCurrentMonthCosts(userId, currentYear, currentMonth)
      setEntries(costEntries)
    } catch (error) {
      onStatusChange(
        'error',
        getFirestoreErrorMessage(error, 'Nao foi possivel carregar os custos do mes corrente.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [currentMonth, currentYear, onStatusChange, userId])

  useEffect(() => {
    void loadCosts()
  }, [loadCosts])

  const filteredEntries = useMemo(() => {
    if (filter === 'todos') {
      return entries
    }

    return entries.filter((entry) => entry.costType === filter)
  }, [entries, filter])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredEntries.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, filteredEntries])

  useEffect(() => {
    setCurrentPage(1)
  }, [filter])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const monthlyReport = useMemo(() => {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canMutate) {
      return
    }

    const parsedAmount = parseMaskedCurrencyToNumber(amount)
    const parsedInstallments = Number(installmentsTotal)
    const effectiveInstallmentsTotal =
      costType === 'fixo' ? parsedInstallments : 1

    if (!accountName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      onStatusChange('warning', 'Preencha conta e valor valido para cadastrar o custo.')
      return
    }

    if (costType === 'fixo' && (!Number.isInteger(parsedInstallments) || parsedInstallments < 1)) {
      onStatusChange('warning', 'Total de parcelas deve ser um numero inteiro maior ou igual a 1.')
      return
    }

    setIsSubmitting(true)

    try {
      await createCostEntry(userId, {
        accountName,
        amount: parsedAmount,
        costType,
        installmentsTotal: effectiveInstallmentsTotal,
        createdAtManual: useManualDate && manualDate ? new Date(`${manualDate}T12:00:00`) : undefined,
      })

      setAccountName('')
      setAmount('')
      setCostType('variavel')
      setInstallmentsTotal('1')
      setUseManualDate(false)
      setManualDate(toInputDateValue(new Date()))
      await loadCosts()
      onStatusChange('success', 'Custo cadastrado com sucesso.')
    } catch (error) {
      onStatusChange(
        'error',
        getFirestoreErrorMessage(error, 'Falha ao cadastrar custo. Tente novamente.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(entryId: string) {
    if (!canMutate) {
      return
    }

    const userConfirmed = window.confirm('Confirma a exclusao deste custo?')
    if (!userConfirmed) {
      return
    }

    setIsDeletingId(entryId)

    try {
      await deleteCostEntry(userId, entryId)
      await loadCosts()
      onStatusChange('success', 'Custo removido com sucesso.')
    } catch (error) {
      onStatusChange(
        'error',
        getFirestoreErrorMessage(error, 'Falha ao remover custo. Tente novamente.'),
      )
    } finally {
      setIsDeletingId(null)
    }
  }

  function handleEdit(entryId: string) {
    if (isMutating) {
      return
    }

    setIsEditingId(entryId)
    onEditCost(entryId)
  }

  return (
    <section className="costs-page container-fluid py-4" data-testid="costs-page-screen">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h2 className="h4 mb-0">Custos do mes corrente</h2>
        <span className="text-muted">
          Competencia {String(currentMonth).padStart(2, '0')}/{currentYear}
        </span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <article className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Custos fixos</p>
              <h3 className="h5 mb-0">{formatCurrencyBRL(monthlyReport.fixedTotal)}</h3>
            </div>
          </article>
        </div>
        <div className="col-12 col-md-4">
          <article className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Custos variaveis</p>
              <h3 className="h5 mb-0">{formatCurrencyBRL(monthlyReport.variableTotal)}</h3>
            </div>
          </article>
        </div>
        <div className="col-12 col-md-4">
          <article className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Total no mes</p>
              <h3 className="h5 mb-0">{formatCurrencyBRL(monthlyReport.total)}</h3>
            </div>
          </article>
        </div>
      </div>

      {canMutate && (
        <form className="card border-0 shadow-sm mb-4" onSubmit={handleSubmit}>
          <div className="card-body">
            <h3 className="h6 mb-3">Adicao rapida de custo</h3>
            <div className="row g-3">
              <div className="col-12 col-lg-3">
                <label className="form-label" htmlFor="cost-account-name">
                  Conta
                </label>
                <input
                  id="cost-account-name"
                  className="form-control"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  disabled={isMutating}
                  required
                />
              </div>
              <div className="col-12 col-lg-2">
                <label className="form-label" htmlFor="cost-amount">
                  Valor
                </label>
                <input
                  id="cost-amount"
                  type="text"
                  className="form-control"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={amount}
                  onChange={(event) => setAmount(maskCurrencyInput(event.target.value))}
                  disabled={isMutating}
                  required
                />
              </div>
              <div className="col-12 col-lg-2">
                <label className="form-label" htmlFor="cost-type">
                  Frente
                </label>
                <select
                  id="cost-type"
                  className="form-select"
                  value={costType}
                  onChange={(event) => setCostType(event.target.value as CostType)}
                  disabled={isMutating}
                >
                  <option value="fixo">Fixo</option>
                  <option value="variavel">Variavel</option>
                </select>
              </div>
              {costType === 'fixo' && (
                <div className="col-12 col-lg-2">
                  <label className="form-label" htmlFor="cost-installments-total">
                    Parcelas
                  </label>
                  <input
                    id="cost-installments-total"
                    type="number"
                    min="1"
                    step="1"
                    className="form-control"
                    value={installmentsTotal}
                    onChange={(event) => setInstallmentsTotal(event.target.value)}
                    disabled={isMutating}
                  />
                </div>
              )}
              <div className="col-12 col-lg-3 d-flex align-items-end">
                <div className="form-check">
                  <input
                    id="cost-manual-date"
                    className="form-check-input"
                    type="checkbox"
                    checked={useManualDate}
                    onChange={(event) => setUseManualDate(event.target.checked)}
                    disabled={isMutating}
                  />
                  <label className="form-check-label" htmlFor="cost-manual-date">
                    Ajustar data de criacao
                  </label>
                </div>
              </div>
              {useManualDate && (
                <div className="col-12 col-lg-3">
                  <label className="form-label" htmlFor="cost-created-at-date">
                    Data de criacao
                  </label>
                  <input
                    id="cost-created-at-date"
                    type="date"
                    className="form-control"
                    value={manualDate}
                    onChange={(event) => setManualDate(event.target.value)}
                    disabled={isMutating}
                  />
                </div>
              )}
            </div>

            <div className="mt-3">
              <button
                type="submit"
                className="btn btn-primary btn-loading-stable btn-loading-width-md d-inline-flex align-items-center gap-2"
                disabled={isMutating}
                aria-busy={isSubmitting ? 'true' : undefined}
              >
                <span className="btn-icon-slot" aria-hidden="true">
                  {isSubmitting ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  ) : (
                    <span className="btn-icon-placeholder" />
                  )}
                </span>
                {isSubmitting ? 'Salvando...' : 'Adicionar custo'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <h3 className="h6 mb-0">Listagem detalhada</h3>

            <div className="btn-group" role="group" aria-label="Filtro de custos">
              <button
                type="button"
                className={`btn btn-sm ${filter === 'todos' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('todos')}
              >
                Todos
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filter === 'fixo' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('fixo')}
              >
                Fixos
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filter === 'variavel' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('variavel')}
              >
                Variaveis
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-3">Carregando custos...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-muted py-3">Nenhum custo encontrado para o filtro selecionado.</div>
          ) : (
            <div>
              <div className="table-responsive">
                <table className="table align-middle costs-table">
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>Frente</th>
                      <th>Valor</th>
                      <th>Data de criacao</th>
                      <th>Parcelas</th>
                      {canMutate && <th>Acoes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.accountName}</td>
                        <td>
                          <span className={`badge ${entry.costType === 'fixo' ? 'text-bg-primary' : 'text-bg-secondary'}`}>
                            {entry.costType === 'fixo' ? 'Fixo' : 'Variavel'}
                          </span>
                        </td>
                        <td>{formatCurrencyBRL(entry.amount)}</td>
                        <td>{formatDate(entry.createdAt)}</td>
                        <td>{entry.installmentsTotal}</td>
                        {canMutate && (
                          <td>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary icon-action-btn"
                                aria-label="Editar custo"
                                data-tooltip-id="costs-page-tooltip"
                                data-tooltip-content="Editar custo"
                                onClick={() => handleEdit(entry.id)}
                                disabled={isMutating}
                                aria-busy={isEditingId === entry.id ? 'true' : undefined}
                              >
                                {isEditingId === entry.id ? (
                                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                ) : (
                                  <Icon path={mdiPencil} size={ACTION_ICON_SIZE} aria-hidden="true" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger icon-action-btn"
                                aria-label="Excluir custo"
                                data-tooltip-id="costs-page-tooltip"
                                data-tooltip-content="Excluir custo"
                                onClick={() => handleDelete(entry.id)}
                                disabled={isMutating}
                                aria-busy={isDeletingId === entry.id ? 'true' : undefined}
                              >
                                {isDeletingId === entry.id ? (
                                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                ) : (
                                  <Icon path={mdiTrashCanOutline} size={ACTION_ICON_SIZE} aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap">
                <small className="text-muted">
                  Pagina {currentPage} de {totalPages} ({filteredEntries.length} itens)
                </small>
                <div className="btn-group" role="group" aria-label="Paginacao de custos">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Proxima
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tooltip id="costs-page-tooltip" place="top" className="appbar-tooltip" />
    </section>
  )
}

export default CostsPage