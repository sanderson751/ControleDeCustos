import { render, screen } from '@testing-library/react'
import WelcomeCenter from './WelcomeCenter'
import { listCurrentMonthCosts } from '../services/costService'

jest.mock('../services/costService', () => ({
  listCurrentMonthCosts: jest.fn(),
}))

const mockedListCurrentMonthCosts = jest.mocked(listCurrentMonthCosts)

function fakeUser(uid: string) {
  return {
    uid,
    name: 'Usuario Dashboard',
    email: 'dashboard@exemplo.com',
  }
}

describe('WelcomeCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exibe indicadores separados para total, custos fixos e custos variaveis', async () => {
    mockedListCurrentMonthCosts.mockResolvedValue([
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
          accountName: 'Mercado',
          amount: 250,
          costType: 'variavel',
          installmentsTotal: 1,
          competenceYear: 2026,
          competenceMonth: 4,
          createdAt: new Date('2026-04-02T12:00:00'),
          updatedAt: new Date('2026-04-02T12:00:00'),
        },
      ])

    render(<WelcomeCenter user={fakeUser('uid-dashboard')} />)

    expect(await screen.findByText('Total de custos')).toBeInTheDocument()
    expect(screen.getByText('Custos fixos')).toBeInTheDocument()
    expect(screen.getByText('Custos variaveis')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.250,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument()
  })
})