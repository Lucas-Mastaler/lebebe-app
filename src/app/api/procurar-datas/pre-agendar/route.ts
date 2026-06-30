import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { ProcurarDatasCandidate, ProcurarDatasPreAgendamentoMeta } from '@/lib/procurar-datas/types'
import type { PreAgendarResponseSucesso } from '@/lib/procurar-datas/contratos'
import { registrarAuditoriaPreAgendamento } from '@/lib/procurar-datas/v2/auditoria-pre-agendamento'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][pre-agendar] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as {
      cand?: ProcurarDatasCandidate
      meta?: ProcurarDatasPreAgendamentoMeta
      pesquisaAuditoriaId?: string
      clientToken?: string
      runId?: string
    }

    console.log('[PROCURAR_DATAS][pre-agendar] body recebido', {
      pesquisaAuditoriaId: body.pesquisaAuditoriaId,
      clientToken: body.clientToken,
      runId: body.runId,
    })

    if (!body.cand || !body.meta) {
      return NextResponse.json({ ok: false, error: 'cand e meta sao obrigatorios' }, { status: 400 })
    }

    const usuarioAutenticado = {
      id: acesso.auth.userId || null,
      email: acesso.auth.email || '',
      nome: acesso.auth.email ? acesso.auth.email.split('@')[0] : '',
      origemAutoria: 'sessao_app' as const,
    }

    const metaComAutoria = {
      ...body.meta,
      autoria: usuarioAutenticado,
    }

    console.log('[PROCURAR_DATAS][pre-agendar] usuario_autenticado', {
      id: usuarioAutenticado.id,
      email: usuarioAutenticado.email,
      origemAutoria: usuarioAutenticado.origemAutoria,
    })

    let resultado: PreAgendarResponseSucesso
    let auditoriaErro: string | undefined

    try {
      resultado = await chamarAppsScriptProcurarDatas('ApiPreAgendarDireto', [body.cand, metaComAutoria], {
        rota: 'pre-agendar',
        timeoutMs: 60_000,
      }) as PreAgendarResponseSucesso
    } catch (err) {
      auditoriaErro = err instanceof Error ? err.message : String(err)
      throw err
    }

    // Registrar auditoria operacional do pré-agendamento
    const auditoriaResultado = await registrarAuditoriaPreAgendamento({
      pesquisaAuditoriaId: body.pesquisaAuditoriaId || null,
      userId: acesso.auth.userId || null,
      userEmail: acesso.auth.email || '',
      clientToken: body.clientToken || null,
      runId: body.runId || null,
      dataPreAgendada: body.cand.dateISO,
      tipoResultado: body.cand.tipo || 'normal',
      resultadoEscolhido: body.cand,
      payloadPreAgendamento: {
        cand: body.cand,
        meta: metaComAutoria,
      },
      status: resultado.ok ? 'success' : 'error',
      errorMessage: auditoriaErro,
      titulo: resultado.ok ? resultado.titulo : null,
      eventLink: resultado.ok ? resultado.eventLink : null,
    })

    if (!auditoriaResultado.sucesso) {
      console.error('[PROCURAR_DATAS][pre-agendar] auditoria operacional falhou', {
        erro: auditoriaResultado.erro,
        pesquisaAuditoriaId: body.pesquisaAuditoriaId,
        clientToken: body.clientToken,
        runId: body.runId,
      })
    }

    console.log('[PROCURAR_DATAS][pre-agendar] sucesso', {
      duracaoMs: Date.now() - inicio,
      responsavel: usuarioAutenticado.email,
      origemAutoria: usuarioAutenticado.origemAutoria,
    })
    return NextResponse.json(resultado)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][pre-agendar] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
