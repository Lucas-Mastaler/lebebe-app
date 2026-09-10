import { timingSafeEqual } from 'node:crypto'

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'AGENT_TEST_BOOTSTRAP_ENABLED',
  'AGENT_TEST_BOOTSTRAP_SECRET',
  'AGENT_TEST_EMAIL',
  'AGENT_TEST_PASSWORD',
] as const

export type AgentBootstrapCredentials = {
  email: string
  password: string
}

/**
 * The bootstrap is intentionally unavailable in every production runtime.
 * The explicit enabled flag also keeps it closed until its secrets exist.
 */
export function isAgentBootstrapEnabled(env = process.env): boolean {
  // Vercel runs Preview deployments with NODE_ENV=production too. Its
  // deployment environment is the authoritative signal in that runtime.
  if (
    env.VERCEL_ENV === 'production' ||
    (!env.VERCEL_ENV && env.NODE_ENV === 'production')
  ) {
    return false
  }

  return env.AGENT_TEST_BOOTSTRAP_ENABLED === 'true'
}

export function getAgentBootstrapCredentials(
  env = process.env
): AgentBootstrapCredentials | null {
  if (REQUIRED_ENVIRONMENT_VARIABLES.some((name) => !env[name])) {
    return null
  }

  return {
    email: env.AGENT_TEST_EMAIL!,
    password: env.AGENT_TEST_PASSWORD!,
  }
}

/**
 * Avoids a timing side channel while never logging either secret.
 */
export function hasValidAgentBootstrapSecret(
  submittedSecret: unknown,
  expectedSecret = process.env.AGENT_TEST_BOOTSTRAP_SECRET
): boolean {
  if (typeof submittedSecret !== 'string' || !expectedSecret) {
    return false
  }

  const submitted = Buffer.from(submittedSecret)
  const expected = Buffer.from(expectedSecret)

  return submitted.length === expected.length && timingSafeEqual(submitted, expected)
}
