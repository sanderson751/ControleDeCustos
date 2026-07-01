'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { type CostType, getCostEntryById, updateCostEntry } from '../services/costService'
import {
  maskCurrencyInput,
  parseMaskedCurrencyToNumber,
  toMaskedCurrencyFromNumber,
} from '../lib/currency'
import { type UserRole } from '../types/rolePermission'

type CostEditPageProps = {
  userId: string
  role: UserRole
  costId: string | null
  onBack: () => void
  onStatusChange: (status: 'success' | 'error' | 'warning', message: string) => void
}

export function CostEditPage({
  userId,
  role,
  costId,
  onBack,
  onStatusChange,
}: CostEditPageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [amount, setAmount] = useState('')
  const [costType, setCostType] = useState<CostType>('variavel')
  const [installmentsTotal, setInstallmentsTotal] = useState('1')
  const canMutate = role !== 'guest'

  useEffect(() => {
    if (!costId) {
      setIsLoading(false)
      onStatusChange('warning', 'Nenhum custo selecionado para edicao.')
      return
    }

    const entryId = costId

    let isMounted = true

    async function loadCost() {
      try {
        setIsLoading(true)
        const entry = await getCostEntryById(userId, entryId)

        if (!isMounted) {
          return
        }

        if (!entry) {
          onStatusChange('warning', 'Custo nao encontrado para edicao.')
          onBack()
          return
        }

        setAccountName(entry.accountName)
        setAmount(toMaskedCurrencyFromNumber(entry.amount))
        setCostType(entry.costType)
        setInstallmentsTotal(String(entry.installmentsTotal))
      } catch {
        if (isMounted) {
          onStatusChange('error', 'Falha ao carregar custo para edicao.')
          onBack()
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadCost()

    return () => {
      isMounted = false
    }
  }, [costId, onBack, onStatusChange, userId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canMutate || !costId) {
      return
    }

    const parsedAmount = parseMaskedCurrencyToNumber(amount)
    const parsedInstallments = Number(installmentsTotal)
    const effectiveInstallmentsTotal = costType === 'fixo' ? parsedInstallments : 1

    if (!accountName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      onStatusChange('warning', 'Informe uma conta e um valor valido para salvar.')
      return
    }

    if (costType === 'fixo' && (!Number.isInteger(parsedInstallments) || parsedInstallments < 1)) {
      onStatusChange('warning', 'Total de parcelas deve ser inteiro e maior ou igual a 1.')
      return
    }

    setIsSaving(true)

    try {
      await updateCostEntry(userId, costId, {
        accountName,
        amount: parsedAmount,
        costType,
        installmentsTotal: effectiveInstallmentsTotal,
      })

      onStatusChange('success', 'Custo atualizado com sucesso.')
      onBack()
    } catch {
      onStatusChange('error', 'Falha ao atualizar custo. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!canMutate) {
    return (
      <section className="container-fluid py-4">
        <div className="alert alert-warning mb-0">Voce nao possui permissao para editar custos.</div>
      </section>
    )
  }

  if (isLoading) {
    return (
      <section className="container-fluid py-4">
        <p className="mb-0">Carregando formulario de edicao...</p>
      </section>
    )
  }

  return (
    <section className="container-fluid py-4" data-testid="cost-edit-page-screen">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="h5 mb-0">Editar custo</h2>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBack}>
              Voltar para listagem
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="edit-cost-account-name">
                  Conta
                </label>
                <input
                  id="edit-cost-account-name"
                  className="form-control"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  required
                />
              </div>

              <div className="col-12 col-md-3">
                <label className="form-label" htmlFor="edit-cost-amount">
                  Valor
                </label>
                <input
                  id="edit-cost-amount"
                  type="text"
                  className="form-control"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={amount}
                  onChange={(event) => setAmount(maskCurrencyInput(event.target.value))}
                  required
                />
              </div>

              {costType === 'fixo' && (
                <div className="col-12 col-md-3">
                  <label className="form-label" htmlFor="edit-cost-installments-total">
                    Parcelas
                  </label>
                  <input
                    id="edit-cost-installments-total"
                    type="number"
                    className="form-control"
                    min="1"
                    step="1"
                    value={installmentsTotal}
                    onChange={(event) => setInstallmentsTotal(event.target.value)}
                    required
                  />
                </div>
              )}

              <div className="col-12 col-md-4">
                <label className="form-label" htmlFor="edit-cost-type">
                  Frente
                </label>
                <select
                  id="edit-cost-type"
                  className="form-select"
                  value={costType}
                  onChange={(event) => setCostType(event.target.value as CostType)}
                >
                  <option value="fixo">Fixo</option>
                  <option value="variavel">Variavel</option>
                </select>
              </div>
            </div>

            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onBack}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

export default CostEditPage