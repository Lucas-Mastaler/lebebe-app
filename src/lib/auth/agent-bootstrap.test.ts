import { describe, expect, it } from 'vitest'
import {
  getAgentBootstrapCredentials,
  hasValidAgentBootstrapSecret,
  isAgentBootstrapEnabled,
} from './agent-bootstrap'

const enabledEnvironment = {
  NODE_ENV: 'development',
  AGENT_TEST_BOOTSTRAP_ENABLED: 'true',
  AGENT_TEST_BOOTSTRAP_SECRET: 'bootstrap-secret',
  AGENT_TEST_EMAIL: 'agente.teste@lebebe.cloud',
  AGENT_TEST_PASSWORD: 'technical-password',
}

describe('agent bootstrap safeguards', () => {
  it('is disabled in production even when enabled is configured', () => {
    expect(isAgentBootstrapEnabled({ ...enabledEnvironment, NODE_ENV: 'production' })).toBe(false)
    expect(isAgentBootstrapEnabled({ ...enabledEnvironment, VERCEL_ENV: 'production' })).toBe(false)
  })

  it('allows a Vercel Preview deployment despite its production Node environment', () => {
    expect(
      isAgentBootstrapEnabled({
        ...enabledEnvironment,
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      })
    ).toBe(true)
  })

  it('requires explicit enablement outside production', () => {
    expect(isAgentBootstrapEnabled({ NODE_ENV: 'development' })).toBe(false)
    expect(isAgentBootstrapEnabled(enabledEnvironment)).toBe(true)
  })

  it('accepts only the configured bootstrap secret', () => {
    expect(hasValidAgentBootstrapSecret('bootstrap-secret', 'bootstrap-secret')).toBe(true)
    expect(hasValidAgentBootstrapSecret('incorrect', 'bootstrap-secret')).toBe(false)
    expect(hasValidAgentBootstrapSecret(undefined, 'bootstrap-secret')).toBe(false)
  })

  it('fails closed when a technical credential is missing', () => {
    expect(getAgentBootstrapCredentials(enabledEnvironment)).toEqual({
      email: 'agente.teste@lebebe.cloud',
      password: 'technical-password',
    })
    expect(getAgentBootstrapCredentials({ ...enabledEnvironment, AGENT_TEST_PASSWORD: '' })).toBeNull()
  })
})
