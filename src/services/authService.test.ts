jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

import { friendlyAuthErrorMessage } from './authService'

describe('friendlyAuthErrorMessage', () => {
  it('mapeia USER_NOT_FOUND para mensagem amigavel', () => {
    expect(friendlyAuthErrorMessage(new Error('USER_NOT_FOUND'))).toBe('Usuario nao existe.')
  })

  it('mapeia INVALID_CREDENTIALS para mensagem amigavel', () => {
    expect(friendlyAuthErrorMessage(new Error('INVALID_CREDENTIALS'))).toBe(
      'As informacoes estao incorretas.',
    )
  })

  it('mapeia EMAIL_EXISTS para mensagem de email em uso', () => {
    expect(friendlyAuthErrorMessage(new Error('EMAIL_EXISTS'))).toBe(
      'Este email ja esta em uso. Tente entrar ou use outro email.',
    )
  })
})
