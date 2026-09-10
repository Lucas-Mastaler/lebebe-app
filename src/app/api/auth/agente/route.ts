import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import {
  getAgentBootstrapCredentials,
  hasValidAgentBootstrapSecret,
  isAgentBootstrapEnabled,
} from '@/lib/auth/agent-bootstrap'

export const runtime = 'nodejs'

const GENERIC_ERROR = 'Não foi possível iniciar a sessão técnica.'

type CookieToSet = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function unavailableResponse() {
  return NextResponse.json(
    { ok: false, message: GENERIC_ERROR },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  )
}

function invalidCredentialsResponse(status = 401) {
  return NextResponse.json(
    { ok: false, message: GENERIC_ERROR },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: NextRequest) {
  if (!isAgentBootstrapEnabled()) {
    return unavailableResponse()
  }

  const credentials = getAgentBootstrapCredentials()
  if (!credentials) {
    return unavailableResponse()
  }

  const rateLimit = await checkRateLimit(request)
  if (!rateLimit.success) {
    return invalidCredentialsResponse(429)
  }

  let payload: { secret?: unknown }
  try {
    payload = await request.json()
  } catch {
    return invalidCredentialsResponse()
  }

  if (!hasValidAgentBootstrapSecret(payload.secret)) {
    return invalidCredentialsResponse()
  }

  const response = NextResponse.json(
    { ok: true, redirectTo: '/inicio' },
    { headers: { 'Cache-Control': 'no-store' } }
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies: CookieToSet[]) {
          cookies.forEach(({ name, value, options }: CookieToSet) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword(credentials)
  if (error) {
    return invalidCredentialsResponse()
  }

  return response
}
