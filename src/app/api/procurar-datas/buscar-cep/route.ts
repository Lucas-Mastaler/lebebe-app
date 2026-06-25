import { NextRequest, NextResponse } from 'next/server'
import { validarAcessoProcurarDatas, respostaErroProcurarDatas } from '@/lib/procurar-datas/api'
import { buscarCep, extrairDigitosCep } from '@/lib/procurar-datas/cep-helpers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const inicio = Date.now()
  console.log('[PROCURAR_DATAS][buscar-cep] inicio')

  try {
    const acesso = await validarAcessoProcurarDatas()
    if (acesso.response) return acesso.response

    const body = (await request.json()) as { cep?: unknown }
    const cepInput = typeof body?.cep === 'string' ? body.cep : ''

    const cep8 = extrairDigitosCep(cepInput)
    if (!cep8) {
      console.log(
        `[PROCURAR_DATAS][buscar-cep] cep_invalido cepInput="${cepInput}" duracaoMs=${Date.now() - inicio}`
      )
      return NextResponse.json({ ok: false, error: 'CEP invalido. Informe 8 digitos numericos.' }, { status: 400 })
    }

    console.log(`[PROCURAR_DATAS][buscar-cep] buscando cep=${cep8}`)

    const resultado = await buscarCep(cepInput)

    if (!resultado.ok) {
      console.log(
        `[PROCURAR_DATAS][buscar-cep] nao_encontrado cep=${cep8} duracaoMs=${Date.now() - inicio}`
      )
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 404 })
    }

    console.log(
      `[PROCURAR_DATAS][buscar-cep] sucesso cep=${cep8} provider=${resultado.resultado.provider}` +
        ` cidade="${resultado.resultado.cidade}" uf=${resultado.resultado.uf}` +
        ` duracaoMs=${Date.now() - inicio}`
    )

    return NextResponse.json({ ok: true, resultado: resultado.resultado })
  } catch (error) {
    console.error(`[PROCURAR_DATAS][buscar-cep] erro duracaoMs=${Date.now() - inicio}`, error)
    return respostaErroProcurarDatas(error)
  }
}
