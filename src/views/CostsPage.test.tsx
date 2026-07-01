import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CostsPage } from './CostsPage'
import {
  type CostEntry,
  createCostEntry,
  deleteCostEntry,
  listCurrentMonthCosts,
} from '../services/costService'

jest.mock('react-tooltip', () => ({
  Tooltip: () => null,
}))

jest.mock('../services/costService', () => ({
  createCostEntry: jest.fn(),
  deleteCostEntry: jest.fn(),
  listCurrentMonthCosts: jest.fn(),
}))

const mockedCreateCostEntry = jest.mocked(createCostEntry)
const mockedDeleteCostEntry = jest.mocked(deleteCostEntry)
const mockedListCurrentMonthCosts = jest.mocked(listCurrentMonthCosts)

let mockEntries: CostEntry[] = []

async function waitForInitialLoad() {
  await waitFor(() => {
    expect(screen.queryByText('Carregando custos...')).not.toBeInTheDocument()
  })
}

describe('CostsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEntries = []

    mockedListCurrentMonthCosts.mockImplementation(async () => mockEntries)
  })

  it('realiza cadastro rapido com campos obrigatorios', async () => {
    const user = userEvent.setup()
    mockedCreateCostEntry.mockResolvedValue(undefined)

    render(
      <CostsPage
        userId="uid-1"
        role="standard"
        onStatusChange={jest.fn()}
        onEditCost={jest.fn()}
      />,
    )

    await waitForInitialLoad()

    await user.type(screen.getByLabelText('Conta'), 'Energia')
    await user.type(screen.getByLabelText('Valor'), '22000')
    await user.click(screen.getByRole('button', { name: 'Adicionar custo' }))

    await waitFor(() => {
      expect(mockedCreateCostEntry).toHaveBeenCalledWith(
        'uid-1',
        expect.objectContaining({
          accountName: 'Energia',
          amount: 220,
          costType: 'variavel',
          installmentsTotal: 1,
        }),
      )
    })
  })

  it('exibe campo de parcelas apenas para frente fixa', async () => {
    const user = userEvent.setup()

    render(
      <CostsPage
        userId="uid-1"
        role="standard"
        onStatusChange={jest.fn()}
        onEditCost={jest.fn()}
      />,
    )

    await waitForInitialLoad()

    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Frente'), 'fixo')
    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Frente'), 'variavel')
    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument()
  })

  it('aplica filtro por custos variaveis', async () => {
    const user = userEvent.setup()

    mockEntries = [
      {
        id: '1',
        accountName: 'Aluguel',
        amount: 1000,
        costType: 'fixo',
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 4,
        createdAt: new Date('2026-04-01T12:00:00'),
        updatedAt: new Date('2026-04-01T12:00:00'),
      },
      {
        id: '2',
        accountName: 'Uber',
        amount: 50,
        costType: 'variavel',
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 4,
        createdAt: new Date('2026-04-02T12:00:00'),
        updatedAt: new Date('2026-04-02T12:00:00'),
      },
    ]

    render(
      <CostsPage
        userId="uid-1"
        role="standard"
        onStatusChange={jest.fn()}
        onEditCost={jest.fn()}
      />,
    )

    await waitForInitialLoad()

    expect(screen.getByText('Aluguel')).toBeInTheDocument()
    expect(screen.getByText('Uber')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Variaveis' }))

    expect(screen.queryByText('Aluguel')).not.toBeInTheDocument()
    expect(screen.getByText('Uber')).toBeInTheDocument()
  })

  it('paginacao navega entre paginas quando ha muitos itens', async () => {
    const user = userEvent.setup()

    mockEntries = Array.from({ length: 13 }, (_, index) => ({
      id: String(index + 1),
      accountName: `Conta ${index + 1}`,
      amount: 10 + index,
      costType: index % 2 === 0 ? 'fixo' : 'variavel',
      installmentsTotal: 1,
      competenceYear: 2026,
      competenceMonth: 4,
      createdAt: new Date('2026-04-01T12:00:00'),
      updatedAt: new Date('2026-04-01T12:00:00'),
    }))

    render(
      <CostsPage userId="uid-1" role="guest" onStatusChange={jest.fn()} onEditCost={jest.fn()} />,
    )

    await waitForInitialLoad()

    expect(screen.getByText('Conta 1')).toBeInTheDocument()
    expect(screen.queryByText('Conta 11')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Proxima' }))

    expect(screen.getByText('Conta 11')).toBeInTheDocument()
    expect(screen.queryByText('Conta 1')).not.toBeInTheDocument()
  })

  it('exige confirmacao para excluir custo', async () => {
    const user = userEvent.setup()

    mockEntries = [
      {
        id: '1',
        accountName: 'Internet',
        amount: 120,
        costType: 'fixo',
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 4,
        createdAt: new Date('2026-04-01T12:00:00'),
        updatedAt: new Date('2026-04-01T12:00:00'),
      },
    ]

    const confirmSpy = jest.spyOn(window, 'confirm')
    confirmSpy.mockReturnValue(false)

    render(
      <CostsPage
        userId="uid-1"
        role="standard"
        onStatusChange={jest.fn()}
        onEditCost={jest.fn()}
      />,
    )

    await waitForInitialLoad()

    await user.click(screen.getByRole('button', { name: 'Excluir custo' }))
    expect(mockedDeleteCostEntry).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Excluir custo' }))

    await waitFor(() => {
      expect(mockedDeleteCostEntry).toHaveBeenCalledWith('uid-1', '1')
    })

    confirmSpy.mockRestore()
  })

  it('oculta acoes e formulario rapido para perfil guest', async () => {
    mockEntries = [
      {
        id: '1',
        accountName: 'Alimentacao',
        amount: 200,
        costType: 'variavel',
        installmentsTotal: 1,
        competenceYear: 2026,
        competenceMonth: 4,
        createdAt: new Date('2026-04-01T12:00:00'),
        updatedAt: new Date('2026-04-01T12:00:00'),
      },
    ]

    render(
      <CostsPage userId="uid-1" role="guest" onStatusChange={jest.fn()} onEditCost={jest.fn()} />,
    )

    await waitForInitialLoad()

    expect(screen.queryByText('Adicao rapida de custo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar custo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir custo' })).not.toBeInTheDocument()
  })
})
