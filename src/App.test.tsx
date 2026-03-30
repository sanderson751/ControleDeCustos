import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />)
    expect(screen.getByText('Controle de Custos')).toBeInTheDocument()
  })

  it('starts counter at zero', () => {
    render(<App />)
    expect(screen.getByTestId('counter-value')).toHaveTextContent('0')
  })

  it('increments counter when button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    const button = screen.getByRole('button', { name: /incrementar/i })
    await user.click(button)

    expect(screen.getByTestId('counter-value')).toHaveTextContent('1')
  })
})
