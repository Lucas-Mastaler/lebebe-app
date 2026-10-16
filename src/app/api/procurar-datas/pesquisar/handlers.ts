import { NextRequest, NextResponse } from 'next/server'
import { chamarAppsScriptProcurarDatas } from '@/lib/procurar-datas/apps-script'
import { respostaErroProcurarDatas, validarAcessoProcurarDatas } from '@/lib/procurar-datas/api'
import type { PesquisarDatasRequest, PesquisarDatasResponseSucesso, PesquisarDatasStatus } from '@/lib/procurar-datas/contratos'

export const runtime = 'nodejs'
export const maxDuration = 60

const ERRO_TEMPO_NECESSARIO_INVALIDO = 'Tempo necessario ausente ou invalido.'
const TEMPO_NECESSARIO_RE = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/

export function isTempoNecessarioValido(tempoNecessario: unknown): tempoNecessario is string {
  if (typeof tempoNecessario !== 'string') return false

  const match = tempoNecessario.trim().match(TEMPO_NECESSARIO_RE)
  if (!match) return false

  const horas = Number(match[1])
  const minutos = Number(match[2])
  return horas * 60 + minutos > 0
}

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  let clientToken = ''
  console.log('[PROCURAR_DATAS][pesquisar] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as PesquisarDatasRequest
    clientToken = body.clientToken || ''

    if (!isTempoNecessarioValido(body.tempoNecessario)) {
      console.warn(`[PROCURAR_DATAS][pesquisar] tempoNecessario invalido clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`)
      return NextResponse.json({ ok: false, error: ERRO_TEMPO_NECESSARIO_INVALIDO }, { status: 400 })
    }

    const resultado = await chamarAppsScriptProcurarDatas<{ ok?: boolean; clientToken?: string; status?: string; error?: string }>('ApiIniciarPesquisaDatasApp', [body], {
      rota: 'pesquisar',
      clientToken,
      timeoutMs: 30_000,
    })

    if (!resultado?.ok) {
      throw new Error(resultado?.error || 'Nao foi possivel iniciar a pesquisa.')
    }

    console.log(`[PROCURAR_DATAS][pesquisar] sucesso clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`)
    const resposta: PesquisarDatasResponseSucesso = {
      ok: true,
      clientToken: resultado.clientToken || clientToken,
      status: (resultado.status || 'started') as PesquisarDatasStatus,
    }
    return NextResponse.json(resposta)
  } catch (error) {
    console.error(`[PROCURAR_DATAS][pesquisar] erro clientToken=${clientToken || '-'} duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
