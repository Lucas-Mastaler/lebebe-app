import { NextRequest, NextResponse } from 'next/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'

// POST /api/matic/importar-nfe — proxy seguro para Apps Script
export async function POST(request: NextRequest) {
  // 1) Validar sessão (matic whitelist)
  const auth = await validateMaticUser()
  if (!auth.authorized) {
    return NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: 403 })
  }

  // 2) Ler body
  let body: { inicio?: string; fim?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const { inicio, fim } = body

  if (!inicio || !fim) {
    return NextResponse.json({ ok: false, error: 'inicio e fim são obrigatórios' }, { status: 400 })
  }

  // 3) Validar datas
  const dInicio = new Date(inicio + 'T00:00:00')
  const dFim = new Date(fim + 'T23:59:59')

  if (isNaN(dInicio.getTime()) || isNaN(dFim.getTime())) {
    return NextResponse.json({ ok: false, error: 'Datas inválidas' }, { status: 400 })
  }

  if (dInicio > dFim) {
    return NextResponse.json({ ok: false, error: 'inicio deve ser <= fim' }, { status: 400 })
  }

  const diffDays = (dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays > 90) {
    return NextResponse.json({ ok: false, error: 'Janela máxima de 90 dias' }, { status: 400 })
  }

  // 4) Env vars
  const appscriptUrl = process.env.APPSCRIPT_IMPORT_URL
  const appscriptToken = process.env.APPSCRIPT_IMPORT_TOKEN

  if (!appscriptUrl || !appscriptToken) {
    console.error('[LOG] APPSCRIPT_IMPORT_URL ou APPSCRIPT_IMPORT_TOKEN não configurados')
    return NextResponse.json({ ok: false, error: 'Configuração do Apps Script ausente no servidor' }, { status: 500 })
  }

  // 5) Chamar Apps Script
  console.log(`[LOG] importar-nfe: user=${auth.email} periodo=${inicio} a ${fim}`)
  console.log(`[LOG] Apps Script URL: ${appscriptUrl.substring(0, 60)}...`)

  try {
    // Google Apps Script Web Apps retornam 302 redirect.
    // Primeiro: POST com redirect manual para capturar a URL de redirect
    const res = await fetch(appscriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: appscriptToken, inicio, fim }),
      redirect: 'follow',
    })

    console.log(`[LOG] Apps Script response: status=${res.status} type=${res.headers.get('content-type')} redirected=${res.redirected} url=${res.url?.substring(0, 80)}`)

    const text = await res.text()
    console.log(`[LOG] Apps Script body (first 300 chars): ${text.substring(0, 300)}`)

    // Se a resposta é HTML (página de erro do Google), tentar extrair JSON embutido
    let data: Record<string, unknown>

    // Tentar parsear como JSON direto
    try {
      data = JSON.parse(text)
    } catch {
      // Apps Script às vezes retorna HTML com o JSON embutido — não deveria acontecer
      // mas logamos para debug
      console.error('[LOG] Resposta do Apps Script não é JSON.')
      console.error('[LOG] Content-Type:', res.headers.get('content-type'))
      console.error('[LOG] Status:', res.status)
      console.error('[LOG] Body completo (primeiros 1000 chars):', text.substring(0, 1000))

      return NextResponse.json({
        ok: false,
        error: 'Resposta inválida do Apps Script. Verifique se o Web App está publicado corretamente.',
        debug: {
          status: res.status,
          contentType: res.headers.get('content-type'),
          redirected: res.redirected,
          bodyPreview: text.substring(0, 200),
        }
      }, { status: 502 })
    }

    // 6) Se Apps Script retornou ok:false, repassar erro
    if (data.ok !== true) {
      console.error('[LOG] Apps Script retornou erro:', data.error)
      return NextResponse.json({ ok: false, error: data.error || 'Erro no Apps Script' }, { status: 400 })
    }

    // 7) Log resumido (sem token)
    const nfs = data.nfs as Array<Record<string, unknown>> | undefined
    const erros = data.erros as Array<Record<string, unknown>> | undefined
    const stats = data.stats as Record<string, unknown> | undefined
    console.log(`[LOG] importar-nfe resultado: nfs=${nfs?.length || 0} erros=${erros?.length || 0} stats=${JSON.stringify(stats || {})}`)

    // 8) Repassar JSON completo para o frontend
    return NextResponse.json(data)
  } catch (err) {
    console.error('[LOG] Erro ao chamar Apps Script:', err)
    return NextResponse.json({ ok: false, error: 'Falha ao conectar com Apps Script: ' + String(err) }, { status: 502 })
  }
}
