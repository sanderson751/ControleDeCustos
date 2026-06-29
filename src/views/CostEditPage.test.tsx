import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CostEditPage } from './CostEditPage'
import { getCostEntryById, updateCostEntry } from '../services/costService'

jest.mock('../services/costService', () => ({
  getCostEntryById: jest.fn(),
  updateCostEntry: jest.fn(),
}))

const mockedGetCostEntryById = jest.mocked(getCostEntryById)
const mockedUpdateCostEntry = jest.mocked(updateCostEntry)

describe('CostEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('carrega o custo e salva alteracoes no formulario separado', async () => {
    const user = userEvent.setup()
    const onBack = jest.fn()
    const onStatusChange = jest.fn()

    mockedGetCostEntryById.mockResolvedValue({
      id: 'cost-1',
      accountName: 'Escola',
      amount: 450,
      costType: 'fixo',
      installmentsTotal: 10,
      competenceYear: 2026,
      competenceMonth: 4,
      createdAt: new Date('2026-04-01T12:00:00'),
      updatedAt: new Date('2026-04-01T12:00:00'),
    })
    mockedUpdateCostEntry.mockResolvedValue(undefined)

    render(
      <CostEditPage
        userId="uid-1"
        role="standard"
        costId="cost-1"
        onBack={onBack}
        onStatusChange={onStatusChange}
      />,
    )

    expect(await screen.findByDisplayValue('Escola')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Valor'))
    await user.type(screen.getByLabelText('Valor'), '50000')
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }))

    await waitFor(() => {
      expect(mockedUpdateCostEntry).toHaveBeenCalledWith(
        'uid-1',
        'cost-1',
        expect.objectContaining({
          accountName: 'Escola',
          amount: 500,
          costType: 'fixo',
          installmentsTotal: 10,
        }),
      )
    })

    expect(onBack).toHaveBeenCalled()
  })

  it('mostra parcelas apenas quando a frente e fixa', async () => {
    const user = userEvent.setup()

    mockedGetCostEntryById.mockResolvedValue({
      id: 'cost-2',
      accountName: 'Internet',
      amount: 180,
      costType: 'fixo',
      installmentsTotal: 4,
      competenceYear: 2026,
      competenceMonth: 4,
      createdAt: new Date('2026-04-01T12:00:00'),
      updatedAt: new Date('2026-04-01T12:00:00'),
    })

    render(
      <CostEditPage
        userId="uid-1"
        role="standard"
        costId="cost-2"
        onBack={jest.fn()}
        onStatusChange={jest.fn()}
      />,
    )

    expect(await screen.findByDisplayValue('Internet')).toBeInTheDocument()
    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Frente'), 'variavel')
    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Frente'), 'fixo')
    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument()
  })
})
