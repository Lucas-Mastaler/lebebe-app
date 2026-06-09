import { NextResponse } from 'next/server'
import { validateComercialUser } from '@/lib/auth/sgi-auth'
import { isTimeoutError } from './apps-script'

export async function validarAcessoProcurarDatas() {
  const auth = await validateComercialUser()

  if (!auth.authorized) {
    return {
      auth,
      response: NextResponse.json({ ok: false, error: 'Nao autorizado' }, { status: 401 }),
    }
  }

  return { auth, response: null }
}

export function respostaErroProcurarDatas(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')

  if (isTimeoutError(error)) {
    return NextResponse.json(
      { ok: false, error: 'A busca demorou mais que o esperado. Tente novamente em instantes.' },
      { status: 504 }
    )
  }

  return NextResponse.json(
    { ok: false, error: message || 'Erro interno ao processar solicitacao.' },
    { status: 500 }
  )
}
