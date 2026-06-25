import { buscarConfigsDb } from './config-db'
import type { OpcoesFront, TempoMap } from './contratos'

const TIPO_BERCO = [
  'DIVERSOS',
  '2 DIVERSOS',
  '2 BERÇOS DIVERSOS',
  'NIDO',
  'FORMARE',
  'MAXX',
  'CAMA',
  'CAMA + C. AUXILIAR',
  '2 CAMAS',
  'DIVERSOS E CAMA',
  'NIDO E CAMA',
  'FORMARE E CAMA',
  'MAXX E CAMA',
]

const COMODA = ['SIM', '2 COMODAS']

const ROUPEIRO = [
  '2 PTS',
  '3 PTS',
  '4 PTS (DIVERSOS)',
  '4 PTS (TUTTO)',
  '4 PTS (PROVENCE/FLOW)',
  'DESLIZANTE (DIVERSOS)',
  'DESLIZANTE TUTTO',
]

const POLTRONA = ['SIM', '2 POLTRONAS']

const PAINEL = [
  '1 PAINEL',
  '2 PAINEIS',
  '2 PAINEIS E 1 MODULO',
  '1 PAINEL E 1 MODULO',
  '1 PAINEL E 2 MODULOS',
]

function normalizarChaveConfig(chave: string): string {
  return chave
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function numeroConfig(mapa: Awaited<ReturnType<typeof buscarConfigsDb>>, chave: string, fallback: number): number {
  const alvo = normalizarChaveConfig(chave)
  for (const [chaveDb, row] of mapa.entries()) {
    if (normalizarChaveConfig(chaveDb) !== alvo) continue
    const valor = Number(String(row.valor ?? '').replace(',', '.'))
    return Number.isFinite(valor) ? valor : fallback
  }
  return fallback
}

export async function montarOpcoesProcurarDatasLocais(): Promise<{ opcoes: OpcoesFront; tempoMap: TempoMap }> {
  let baseSemana = 130
  let adicionalCondominio = 0

  try {
    const configs = await buscarConfigsDb()
    baseSemana = numeroConfig(configs, 'VALOR SEMANA ATE 10KM', baseSemana)
    adicionalCondominio = numeroConfig(configs, 'PRECO CONDOMINIO ADICIONAL', adicionalCondominio)
  } catch (error) {
    console.warn('[PROCURAR_DATAS][opcoes] config_db_fallback_constantes', error)
  }

  return {
    opcoes: {
      tipoBerco: TIPO_BERCO,
      comoda: COMODA,
      roupeiro: ROUPEIRO,
      poltrona: POLTRONA,
      painel: PAINEL,
      baseSemana,
      adicionalCondominio,
    },
    tempoMap: {},
  }
}

