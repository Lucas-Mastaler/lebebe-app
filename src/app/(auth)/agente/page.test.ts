import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  isAgentBootstrapEnabled: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/auth/agent-bootstrap', () => ({
  isAgentBootstrapEnabled: mocks.isAgentBootstrapEnabled,
}))
vi.mock('./agent-bootstrap-form', () => ({
  AgentBootstrapForm: () => null,
}))

describe('AgentBootstrapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the technical bootstrap form when enabled (Preview)', async () => {
    mocks.isAgentBootstrapEnabled.mockReturnValue(true)
    const { default: AgentBootstrapPage } = await import('./page')

    expect(() => AgentBootstrapPage()).not.toThrow()
    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  it('returns 404 when the bootstrap is disabled (Production)', async () => {
    mocks.isAgentBootstrapEnabled.mockReturnValue(false)
    const { default: AgentBootstrapPage } = await import('./page')

    expect(() => AgentBootstrapPage()).toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })
})
