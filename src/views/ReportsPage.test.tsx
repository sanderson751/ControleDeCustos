import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportsPage from './ReportsPage'
import { listCostsForReport } from '../services/reportService'

jest.mock('../services/reportService', () => ({
  listCostsForReport: jest.fn(),
}))

jest.mock('jspdf', () => {
  const saveMock = jest.fn()
  const textMock = jest.fn()
  const setFontSizeMock = jest.fn()

  return {
    jsPDF: jest.fn().mockImplementation(() => ({
      save: saveMock,
      text: textMock,
      setFontSize: setFontSizeMock,
    })),
    __mocks: {
      saveMock,
      textMock,
      setFontSizeMock,
    },
  }
})

jest.mock('jspdf-autotable', () => jest.fn())

const mockedListCostsForReport = jest.mocked(listCostsForReport)

const fixedNow = new Date('2026-06-29T12:00:00.000Z')

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(fixedNow)

    mockedListCostsForReport.mockResolvedValue([
      {
        id: 'r-1',
        accountName: 'Internet',
        amount: 180,
        costType: 'fixo',
        installmentsTotal: 4,
        competenceYear: 2026,
        competenceMonth: 6,
        createdAt: new Date('2026-06-10T12:00:00.000Z'),
        updatedAt: new Date('2026-06-10T12:00:00.000Z'),
      },
    ])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('exporta PDF ao selecionar opcao no overflow', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const onStatusChange = jest.fn()
    const { jsPDF, __mocks } = jest.requireMock('jspdf') as {
      jsPDF: jest.Mock
      __mocks: {
        saveMock: jest.Mock
      }
    }

    render(<ReportsPage role="standard" onStatusChange={onStatusChange} />)

    await waitFor(() => {
      expect(mockedListCostsForReport).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Exportar' }))
    await user.click(screen.getByRole('menuitem', { name: 'Exportar PDF' }))

    await waitFor(() => {
      expect(jsPDF).toHaveBeenCalled()
      expect(__mocks.saveMock).toHaveBeenCalled()
      expect(onStatusChange).toHaveBeenCalledWith('success', 'Relatorio exportado em PDF com sucesso.')
    })
  })
})
