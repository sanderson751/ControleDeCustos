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
    await user.type(screen.getByLabelText('Valor'), '500')
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
})
