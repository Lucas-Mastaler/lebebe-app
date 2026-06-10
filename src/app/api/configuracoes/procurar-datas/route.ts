import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lerConfiguracoesProcurarDatas, ConfigSecoes, ConfigItem } from '@/lib/procurar-datas/sheets-config'
import { buscarConfigsDb } from '@/lib/procurar-datas/config-db'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────
// GET /api/configuracoes/procurar-datas
//
// Retorna as configurações da planilha + comparação com
// o estado atual do Supabase (Fase 2.5).
//
// Cada item da resposta inclui campo `status_comparacao`:
//   "igual"              — valor idêntico nos dois lados
//   "diferente"          — chave existe nos dois, valores divergem
//   "ausente_no_banco"   — chave existe na planilha, não no banco
//   "ausente_na_planilha"— chave existe no banco, não na planilha
//   "secret"             — chave secreta, comparação não aplicável
//
// Acesso restrito a superadmin. Secrets mascarados.
// ─────────────────────────────────────────────────────────

export type StatusComparacao =
  | 'igual'
  | 'diferente'
  | 'ausente_no_banco'
  | 'ausente_na_planilha'
  | 'secret'

export interface ConfigItemComparado extends ConfigItem {
  status_comparacao: StatusComparacao
  valor_supabase: string | null   // null se ausente ou secret
}

export interface ConfigSecoesComparadas {
  geral: ConfigItemComparado[]
  rota: ConfigItemComparado[]
  candidatos_precos: ConfigItemComparado[]
  equipes: ConfigItemComparado[]
  frete: ConfigItemComparado[]
  provedores: ConfigItemComparado[]
  outros: ConfigItemComparado[]
}

export interface ResumoComparacao {
  iguais: number
  diferentes: number
  ausentes_no_banco: number
  ausentes_na_planilha: number
  banco_vazio: boolean
}

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Não autenticado', message: 'Faça login como superadmin para acessar esta rota.' },
        { status: 401 }
      )
    }

    // 2. Verificar se é superadmin
    const { data: usuarioPermitido, error: dbError } = await supabase
      .from('usuarios_permitidos')
      .select('role')
      .eq('email', user.email.toLowerCase())
      .single()

    if (dbError || !usuarioPermitido || usuarioPermitido.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acesso negado', message: 'Esta rota é restrita apenas para superadmin.' },
        { status: 403 }
      )
    }

    console.log(`[CONFIG PROCURAR-DATAS] Acesso autorizado para: ${user.email}`)

    // 3. Ler planilha e banco em paralelo (Fase 2.5)
    const [planilha, configsDb] = await Promise.all([
      lerConfiguracoesProcurarDatas(),
      buscarConfigsDb(),
    ])

    if (!planilha.ok) {
      console.error('[CONFIG PROCURAR-DATAS] Erro ao ler planilha:', planilha.erro)
      return NextResponse.json(
        { error: 'Erro ao ler configurações', message: planilha.erro },
        { status: 502 }
      )
    }

    const banco_vazio = configsDb.size === 0

    // 4. Enriquecer cada item com status_comparacao
    const resumo: ResumoComparacao = {
      iguais: 0,
      diferentes: 0,
      ausentes_no_banco: 0,
      ausentes_na_planilha: 0,
      banco_vazio,
    }

    function enriquecerSecao(itens: ConfigItem[]): ConfigItemComparado[] {
      return itens.map((item) => {
        if (item.tipo === 'secret') {
          return { ...item, status_comparacao: 'secret' as StatusComparacao, valor_supabase: null }
        }

        const upper = item.chave.toUpperCase()
        const rowDb = configsDb.get(upper)

        if (!rowDb) {
          resumo.ausentes_no_banco++
          return { ...item, status_comparacao: 'ausente_no_banco' as StatusComparacao, valor_supabase: null }
        }

        const valorDb = rowDb.valor ?? ''
        const valorPlanilha = item.valor ?? ''

        if (valorPlanilha === valorDb) {
          resumo.iguais++
          return { ...item, status_comparacao: 'igual' as StatusComparacao, valor_supabase: rowDb.valor }
        } else {
          resumo.diferentes++
          return { ...item, status_comparacao: 'diferente' as StatusComparacao, valor_supabase: rowDb.valor }
        }
      })
    }

    const secoes = planilha.secoes as ConfigSecoes
    const secoesComparadas: ConfigSecoesComparadas = {
      geral:              enriquecerSecao(secoes.geral),
      rota:               enriquecerSecao(secoes.rota),
      candidatos_precos:  enriquecerSecao(secoes.candidatos_precos),
      equipes:            enriquecerSecao(secoes.equipes),
      frete:              enriquecerSecao(secoes.frete),
      provedores:         enriquecerSecao(secoes.provedores),
      outros:             enriquecerSecao(secoes.outros),
    }

    // 5. Chaves presentes no banco mas ausentes na planilha
    const chavesNaPlanilha = new Set(
      Object.values(secoes).flat().map((i) => i.chave.toUpperCase())
    )
    for (const chaveUpper of configsDb.keys()) {
      if (!chavesNaPlanilha.has(chaveUpper)) {
        resumo.ausentes_na_planilha++
      }
    }

    return NextResponse.json(
      {
        ok: true,
        origem: 'planilha',
        lido_em: planilha.lido_em,
        secoes: secoesComparadas,
        comparacao: resumo,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      }
    )
  } catch (error: unknown) {
    console.error('[CONFIG PROCURAR-DATAS] Erro crítico:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: 'Erro interno', message },
      { status: 500 }
    )
  }
}
