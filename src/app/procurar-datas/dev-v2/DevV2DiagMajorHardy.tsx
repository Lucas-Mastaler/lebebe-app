'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const DIAG_URL = '/api/procurar-datas/v2/diagnostico'

type CandidatoResumo = {
  dataISO: string | null
  dateISO: string | null
  dateDM: string | null
  weekday: string | null
  equipe: string | null
  tipo: string | null
  frete: string | null
  isExtra: boolean | null
  rank: number | null
}

type ValidacaoPayload = {
  dataInicialRecebida?: string | null
  dataInicialNormalizada?: string | null
  tempoNecessarioRecebido?: string | null
  tempoNecessarioNormalizado?: number | null
  destLat?: number | null
  destLng?: number | null
  payloadValido?: boolean
  errosPayload?: string[]
}

type ComparacaoData = {
  legado: { presente: boolean; motivo?: string; tipo?: string; frete?: string }
  v2: { presente: boolean; tipo?: string | null; frete?: string | null; equipe?: string | null }
  bate: boolean
  divergente: boolean
  pendente?: boolean
  nota: string
}

type ResumoComparacao =
  | {
      status: 'comparado'
      data31jul: ComparacaoData
      data05ago: ComparacaoData
      hipoteseDivergencia31jul: string[]
      pendencias?: string[]
    }
  | {
      status: 'nao_comparado_motor_com_erro' | 'nao_comparado_payload_invalido' | 'nao_comparado_excecao'
      motivo: string
      aviso?: string
    }

type FiltroEarly = {
  aplicadoNaV2?: boolean
  descartadoNaV2?: boolean
  motivo?: string | null
  distanciaRetaKm?: number | null
  limiteHaversineKm?: number | null
  ancoraDistanciaKm?: number | null
  ancoraEndereco?: string | null
  ancoraTitulo?: string | null
  nota?: string | null
}

type OsrmDelta = {
  kmAdicionalNaRotaM?: number | null
  kmAdicionalNaRotaKm?: number | null
  origemKmAdicionalNaRotaM?: string | null
  melhorInsercao?: {
    antes?: string | null
    depois?: string | null
    deltaM?: number | null
    indiceInsercao?: number | null
  } | null
  origemOperacional?: { fonte?: string | null; lat?: number | null; lng?: number | null } | null
}

type RecorteData = {
  entrouAntesRecorte?: boolean
  entrouNoFinal?: boolean
  motivosExclusao?: string[]
  motivoGranularDisponivel?: boolean
  pendenciaTecnica?: string | null
  final?: { tipo?: string | null; kmAdicionalNaRotaM?: number | null; limites?: Record<string, number | null>; motivos?: Record<string, unknown>; slotTemPontos?: boolean | null } | null
}

type DisponibilidadeData = {
  encontrada?: boolean
  dataEncontradaNaJanela?: boolean
  disponivelMin?: number | null
  ativa?: boolean | null
  suficienteParaServico?: boolean | null
  suficienteCalculado?: boolean | null
  motivoIndisponibilidade?: string | null
  tempoNecessarioMin?: number | null
}

type PontoRotaBaseDetalhado = {
  indice?: number
  tipo?: string
  label?: string
  id?: string
  lat?: number
  lng?: number
  endereco?: string
  tituloEvento?: string | null
  cep?: string | null
  fonteCep?: string | null
  fonteEndereco?: string | null
  equipe?: string | null
  dataISO?: string | null
  indiceLinhaOriginal?: number | null
  latAgenda?: number | null
  lngAgenda?: number | null
  origemTipo?: string | null
}

type PontoAgendaCompleto = {
  id?: string
  indiceLinhaOriginal?: number
  dataISO?: string
  equipe?: string
  tituloEvento?: string | null
  endereco?: string
  fonteEndereco?: string
  cep?: string | null
  fonteCep?: string
  lat?: number
  lng?: number
}

type AnalisePorData = {
  dataISO?: string
  equipe?: string
  candidatoGerado?: boolean
  candidatoElegivelGerado?: boolean
  disponibilidade?: DisponibilidadeData
  agenda?: {
    pontos?: { pontosValidos?: number; totalPontos?: number } | null
    pontosRotaBase?: Array<{ label?: string; lat?: number; lng?: number }> | null
    pontosRotaBaseDetalhados?: PontoRotaBaseDetalhado[] | null
    pontosAgendaCompletos?: PontoAgendaCompleto[] | null
    pontosAgendaDescartados?: Array<{ indiceLinhaOriginal?: number; motivo?: string; descricao?: string }> | null
    avisos?: string[]
    erros?: string[]
  }
  osrmDelta?: OsrmDelta
  filtroEarlyHaversineLegado?: FiltroEarly
  recorte?: RecorteData
}

type ComparacaoLegadoInterno = {
  referencia31jul?: {
    legadoDescarta?: boolean
    motivoLegado?: string
    resultadoV2?: string
    deltaV2M?: number | null
    deltaV2Km?: number | null
    filtroEarlyAplicadoNaV2?: boolean
  }
  referencia05ago?: {
    legadoAceita?: boolean
    tipoLegado?: string
    motivoLegado?: string
    resultadoV2?: string
    deltaV2M?: number | null
    deltaV2Km?: number | null
    filtroEarlyAplicadoNaV2?: boolean
  }
}

type DiagnosticoMotorInterno = {
  executado?: boolean
  ok?: boolean
  modo?: string
  datasAlvo?: string[]
  equipeAlvo?: string
  analisePorData?: Record<string, AnalisePorData>
  recorteFinal?: {
    resumo?: {
      totalRecebidos?: number
      totalElegiveis?: number
      totalRecortados?: number
      ultimaNormalDataISO?: string | null
      extrasRemovidosPorDataPosterior?: number
    }
    candidatosFinais?: Array<{ dataISO?: string; equipe?: string; tipo?: string; kmAdicionalNaRotaM?: number | null; rank?: number | null }>
    especiaisAntesRecorte?: Array<{ dataISO?: string; equipe?: string; tipo?: string; kmAdicionalNaRotaM?: number | null }>
    exclusoesDatasAlvo?: Array<{ dataISO?: string; exclusoes?: Array<{ motivo?: string; tipo?: string; equipe?: string }> }>
  }
  comparacaoLegado?: ComparacaoLegadoInterno
  pendencias?: string[]
}

type DiagnosticoHardy = {
  executado: boolean
  ok: boolean
  producaoAfetada: boolean
  erro?: string
  validacaoPayload?: ValidacaoPayload
  diagnosticoMotorInterno?: DiagnosticoMotorInterno | null
  configUsada?: {
    latDeposito?: number
    lngDeposito?: number
    latCasaE1?: number
    lngCasaE1?: number
    latCasaE2?: number
    lngCasaE2?: number
    kmAdicionalMaxNaRotaM?: number
    kmAdicionalMaxNaRotaEspecialM?: number
    kmAdicionalMaxNaRotaPremiumM?: number
    origem?: string
    nota?: string
    erro?: string
  }
  datasEncontradas?: string[]
  candidatos31jul?: CandidatoResumo | null
  candidatos05ago?: CandidatoResumo | null
  logsLegado31jul?: {
    slot: string
    origem: string
    rotaBase: string[]
    limites: { baseM: number; especialM: number; premiumM: number }
    ancoraVencedora: string
    ancoraTitulo: string
    ancoraDistanciaKm: number
    candidatoBruto: { tipo: string; delta: number }
    decisao: string
  }
  logsLegado05ago?: {
    slot: string
    origem: string
    rotaBase: string[]
    limites: { baseM: number; especialM: number; premiumM: number }
    ancoraVencedora: string
    ancoraTitulo: string
    ancoraDistanciaKm: number
    candidatoBruto: { tipo: string; delta: number }
    decisao: string
  }
  resumoComparacao?: ResumoComparacao
  todosCandidatos?: CandidatoResumo[]
  saidaV2?: { ok: boolean; erros: string[]; avisos: string[] }
}

type ApiResponse = {
  ok: boolean
  diagnosticoMajorHardy31Jul?: DiagnosticoHardy
  [key: string]: unknown
}


function BadgeTipo({ tipo }: { tipo?: string | null }) {
  if (!tipo) return <span className="text-slate-400">—</span>
  const map: Record<string, string> = {
    normal: 'bg-blue-100 text-blue-700',
    especial: 'bg-amber-100 text-amber-700',
    premium: 'bg-purple-100 text-purple-700',
    'hora-marcada': 'bg-pink-100 text-pink-700',
    indisponivel: 'bg-red-100 text-red-700',
  }
  const cls = map[tipo.toLowerCase()] ?? 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {tipo}
    </span>
  )
}

function StatusIcon({ bate, pendente }: { bate?: boolean; pendente?: boolean }) {
  if (pendente) return <span className="text-slate-400 font-bold">?</span>
  if (bate) return <span className="text-green-600 font-bold">✓</span>
  return <span className="text-red-600 font-bold">✗</span>
}

function ComparacaoCard({
  titulo,
  data,
  logsLegado,
}: {
  titulo: string
  data: ComparacaoData
  logsLegado?: DiagnosticoHardy['logsLegado31jul'] | DiagnosticoHardy['logsLegado05ago']
}) {
  const [expandLogs, setExpandLogs] = useState(false)
  const isPendente = data.pendente === true && data.bate

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isPendente ? 'border-amber-300 bg-amber-50/40' : data.bate ? 'border-green-300 bg-green-50/40' : 'border-red-300 bg-red-50/40'}`}>
      <div className="flex items-center gap-2">
        <StatusIcon bate={data.bate} pendente={isPendente} />
        <h4 className="font-semibold text-slate-800">{titulo}</h4>
        {isPendente
          ? <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-medium">Pendente confirmação</span>
          : data.bate
            ? <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded font-medium">Bate</span>
            : <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-medium">Divergente</span>
        }
      </div>

      <p className="text-sm text-slate-700">{data.nota}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-slate-200 bg-white p-3 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Legado</p>
          {data.legado.presente ? (
            <>
              <p className="text-sm"><BadgeTipo tipo={data.legado.tipo} /></p>
              <p className="text-sm font-medium">{data.legado.frete ?? '—'}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500 italic">{data.legado.motivo ?? 'Não presente'}</p>
          )}
        </div>
        <div className="rounded border border-slate-200 bg-white p-3 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">v2</p>
          {data.v2.presente ? (
            <>
              <p className="text-sm"><BadgeTipo tipo={data.v2.tipo} /></p>
              <p className="text-sm font-medium">{data.v2.frete ?? '—'}</p>
              <p className="text-sm text-slate-500">{data.v2.equipe ?? '—'}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500 italic">Não retornado</p>
          )}
        </div>
      </div>

      {logsLegado && (
        <div>
          <button
            onClick={() => setExpandLogs((v) => !v)}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            {expandLogs ? 'Ocultar' : 'Ver'} logs legado
          </button>
          {expandLogs && (
            <div className="mt-2 rounded bg-slate-800 text-slate-100 text-xs p-3 font-mono space-y-1 overflow-x-auto">
              <p><span className="text-slate-400">slot:</span> {logsLegado.slot}</p>
              <p><span className="text-slate-400">origem:</span> {logsLegado.origem}</p>
              <p><span className="text-slate-400">rotaBase:</span> [{logsLegado.rotaBase.map((r) => `"${r}"`).join(', ')}]</p>
              <p><span className="text-slate-400">limites:</span> base={logsLegado.limites.baseM}m | especial={logsLegado.limites.especialM}m | premium={logsLegado.limites.premiumM}m</p>
              <p><span className="text-slate-400">âncora:</span> {logsLegado.ancoraVencedora}</p>
              <p><span className="text-slate-400">tituloAncora:</span> {logsLegado.ancoraTitulo}</p>
              <p><span className="text-slate-400">distAncora:</span> {logsLegado.ancoraDistanciaKm}km</p>
              <p><span className="text-slate-400">candidatoBruto:</span> tipo={logsLegado.candidatoBruto.tipo} | delta={logsLegado.candidatoBruto.delta}km</p>
              <p><span className="text-slate-400">decisão:</span> {logsLegado.decisao}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DevV2DiagMajorHardy() {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<DiagnosticoHardy | null>(null)
  const [jsonAberto, setJsonAberto] = useState(false)

  async function rodarDiagnostico() {
    if (loading) return
    setLoading(true)
    setErro(null)
    setResultado(null)
    setJsonAberto(false)

    try {
      const res = await fetch(DIAG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep: '81230-174',
          dataInicial: '2026-06-26',
          tempoNecessario: '02:45',
          diagnosticoDeltaMajorFranciscoHardy31Jul: true,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        setErro(`HTTP ${res.status}: ${text.slice(0, 300)}`)
        return
      }
      const json = (await res.json()) as ApiResponse
      if (!json.diagnosticoMajorHardy31Jul) {
        setErro('Bloco diagnosticoMajorHardy31Jul ausente na resposta.')
        return
      }
      setResultado(json.diagnosticoMajorHardy31Jul)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Diagnóstico Major Hardy — 31/07 x 05/08</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Payload fixo: Rua Major Francisco Hardy, 70 — campo comprido, Curitiba/PR — CEP 81230-174
          </p>
        </div>
        <Button onClick={rodarDiagnostico} disabled={loading} variant="outline">
          {loading ? 'Rodando…' : 'Rodar diagnóstico'}
        </Button>
      </div>

      {loading && (
        <div className="text-sm text-slate-500 animate-pulse">Aguardando resposta do motor v2…</div>
      )}

      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Erro:</strong> {erro}
        </div>
      )}

      {resultado && (
        <div className="space-y-4">
          {/* Status geral */}
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`px-2 py-0.5 rounded font-medium ${resultado.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {resultado.ok ? 'Motor OK' : 'Motor com erro'}
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {resultado.datasEncontradas?.length ?? 0} datas encontradas
            </span>
            {resultado.saidaV2?.erros && resultado.saidaV2.erros.length > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                {resultado.saidaV2.erros.length} erro(s) v2
              </span>
            )}
          </div>

          {resultado.erro && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <strong>Erro no bloco:</strong> {resultado.erro}
            </div>
          )}

          {/* Config usada */}
          {resultado.configUsada && !resultado.configUsada.erro && (
            <div className="rounded-md border border-slate-200 p-3 space-y-1 text-sm">
              <p className="font-medium text-slate-700">Config operacional usada</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-0.5 text-slate-600">
                <p><strong>Depósito:</strong> {resultado.configUsada.latDeposito}, {resultado.configUsada.lngDeposito}</p>
                <p><strong>Casa E1:</strong> {resultado.configUsada.latCasaE1}, {resultado.configUsada.lngCasaE1}</p>
                <p><strong>Casa E2:</strong> {resultado.configUsada.latCasaE2}, {resultado.configUsada.lngCasaE2}</p>
                <p><strong>Base (absoluto):</strong> {resultado.configUsada.kmAdicionalMaxNaRotaM}m</p>
                <p title="Guarda adicional ao base — limite efetivo especial = base + este valor">
                  <strong>Especial (guarda adicional):</strong>{' '}
                  <span className="text-amber-700">{resultado.configUsada.kmAdicionalMaxNaRotaEspecialM}m</span>
                  {typeof resultado.configUsada.kmAdicionalMaxNaRotaM === 'number' && typeof resultado.configUsada.kmAdicionalMaxNaRotaEspecialM === 'number' && (
                    <span className="ml-1 text-xs text-slate-400">→ efetivo: {resultado.configUsada.kmAdicionalMaxNaRotaM + resultado.configUsada.kmAdicionalMaxNaRotaEspecialM}m</span>
                  )}
                </p>
                <p title="Guarda adicional ao base — limite efetivo premium = base + este valor">
                  <strong>Premium (guarda adicional):</strong>{' '}
                  <span className="text-purple-700">{resultado.configUsada.kmAdicionalMaxNaRotaPremiumM}m</span>
                  {typeof resultado.configUsada.kmAdicionalMaxNaRotaM === 'number' && typeof resultado.configUsada.kmAdicionalMaxNaRotaPremiumM === 'number' && (
                    <span className="ml-1 text-xs text-slate-400">→ efetivo: {resultado.configUsada.kmAdicionalMaxNaRotaM + resultado.configUsada.kmAdicionalMaxNaRotaPremiumM}m</span>
                  )}
                </p>
                <p><strong>Fonte:</strong> {resultado.configUsada.origem}</p>
              </div>
              <div className="mt-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-800">
                ⚠ <strong>Especial</strong> e <strong>Premium</strong> no banco são <em>guardas adicionais</em> ao base, não limites absolutos.
                Faixas efetivas: Normal 0–{resultado.configUsada.kmAdicionalMaxNaRotaM ?? '?'}m |
                Especial {(resultado.configUsada.kmAdicionalMaxNaRotaM ?? 0) + 1}–{(resultado.configUsada.kmAdicionalMaxNaRotaM ?? 0) + (resultado.configUsada.kmAdicionalMaxNaRotaEspecialM ?? 0)}m |
                Premium {(resultado.configUsada.kmAdicionalMaxNaRotaM ?? 0) + (resultado.configUsada.kmAdicionalMaxNaRotaEspecialM ?? 0) + 1}–{(resultado.configUsada.kmAdicionalMaxNaRotaM ?? 0) + (resultado.configUsada.kmAdicionalMaxNaRotaPremiumM ?? 0)}m |
                Fora-limite &gt;{(resultado.configUsada.kmAdicionalMaxNaRotaM ?? 0) + (resultado.configUsada.kmAdicionalMaxNaRotaPremiumM ?? 0)}m
              </div>
              {resultado.configUsada.nota && (
                <p className="text-xs text-amber-700 mt-1">{resultado.configUsada.nota}</p>
              )}
            </div>
          )}

          {/* Validacao do payload */}
          {resultado.validacaoPayload && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
              <p className="font-medium text-slate-700">Validação do payload fixo</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-0.5 text-slate-600">
                <p><strong>dataInicial recebida:</strong> {resultado.validacaoPayload.dataInicialRecebida ?? '—'}</p>
                <p><strong>dataInicial normalizada:</strong> {resultado.validacaoPayload.dataInicialNormalizada ?? '—'}</p>
                <p><strong>tempo recebido:</strong> {resultado.validacaoPayload.tempoNecessarioRecebido ?? '—'}</p>
                <p><strong>tempo normalizado (min):</strong> {resultado.validacaoPayload.tempoNecessarioNormalizado ?? '—'}</p>
                <p><strong>destLat:</strong> {resultado.validacaoPayload.destLat ?? '—'}</p>
                <p><strong>destLng:</strong> {resultado.validacaoPayload.destLng ?? '—'}</p>
                <p><strong>payloadValido:</strong>
                  <span className={resultado.validacaoPayload.payloadValido ? ' text-green-700 font-semibold' : ' text-red-700 font-semibold'}>
                    {' '}{resultado.validacaoPayload.payloadValido ? 'sim' : 'não'}
                  </span>
                </p>
              </div>
              {resultado.validacaoPayload.errosPayload && resultado.validacaoPayload.errosPayload.length > 0 && (
                <ul className="list-disc list-inside text-amber-700 text-xs mt-1">
                  {resultado.validacaoPayload.errosPayload.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Comparação 31/07 e 05/08 */}
          {resultado.resumoComparacao && (
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-800">Comparação legado × v2</h4>

              {resultado.resumoComparacao.status !== 'comparado' && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
                  <p><strong>Motor não comparado:</strong> {resultado.resumoComparacao.motivo}</p>
                  {'aviso' in resultado.resumoComparacao && resultado.resumoComparacao.aviso && (
                    <p className="text-amber-700">{resultado.resumoComparacao.aviso}</p>
                  )}
                </div>
              )}

              {resultado.resumoComparacao.status === 'comparado' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ComparacaoCard
                      titulo="31/07 (sexta)"
                      data={resultado.resumoComparacao.data31jul}
                      logsLegado={resultado.logsLegado31jul}
                    />
                    <ComparacaoCard
                      titulo="05/08 (quarta)"
                      data={resultado.resumoComparacao.data05ago}
                      logsLegado={resultado.logsLegado05ago}
                    />
                  </div>

                  {resultado.resumoComparacao.hipoteseDivergencia31jul.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
                      <p className="font-medium text-amber-800">Hipóteses divergência 31/07</p>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                        {resultado.resumoComparacao.hipoteseDivergencia31jul.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resultado.resumoComparacao.pendencias && resultado.resumoComparacao.pendencias.length > 0 && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
                      <p className="font-medium text-slate-700">Pendências do diagnóstico</p>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                        {resultado.resumoComparacao.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Diagnóstico interno do motor — candidatos avaliados/descartados */}
          {resultado.diagnosticoMotorInterno && resultado.diagnosticoMotorInterno.analisePorData && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-0.5">
                <h4 className="font-semibold text-slate-800 text-sm">Candidatos avaliados e descartados</h4>
                <p className="text-xs text-slate-500">Dados internos do motor v2 — disponibilidade, delta OSRM, filtro early, recorte para 31/07 e 05/08</p>
              </div>
              <div className="divide-y divide-slate-100">
                {(['2026-07-31', '2026-08-05'] as const).map((dataISO) => {
                  const analise = resultado.diagnosticoMotorInterno?.analisePorData?.[dataISO]
                  const label = dataISO === '2026-07-31' ? '31/07 (sexta)' : '05/08 (quarta)'
                  const destaque = dataISO === '2026-07-31' ? 'bg-red-50' : 'bg-amber-50'
                  const entrouFinal = analise?.recorte?.entrouNoFinal
                  const motivosExclusao = analise?.recorte?.motivosExclusao ?? []
                  const filtroDescartou = analise?.filtroEarlyHaversineLegado?.descartadoNaV2

                  let statusLabel = '—'
                  let statusCls = 'bg-slate-100 text-slate-600'
                  if (!analise?.candidatoGerado) {
                    statusLabel = 'não gerado'
                    statusCls = 'bg-slate-200 text-slate-600'
                  } else if (filtroDescartou) {
                    statusLabel = 'filtrado early'
                    statusCls = 'bg-orange-100 text-orange-700'
                  } else if (!analise.candidatoElegivelGerado) {
                    statusLabel = 'inelegível'
                    statusCls = 'bg-red-100 text-red-700'
                  } else if (entrouFinal) {
                    statusLabel = 'final'
                    statusCls = 'bg-green-100 text-green-700'
                  } else if (motivosExclusao.length > 0) {
                    statusLabel = motivosExclusao[0]
                    statusCls = 'bg-orange-100 text-orange-700'
                  } else {
                    statusLabel = 'elegível / sem recorte'
                    statusCls = 'bg-blue-100 text-blue-700'
                  }

                  return (
                    <div key={dataISO} className={`p-4 space-y-2 ${destaque}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800">{label}</span>
                        <span className="text-xs text-slate-500">{analise?.equipe ?? 'EQUIPE 1'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusCls}`}>{statusLabel}</span>
                        {analise?.recorte?.final?.tipo && (
                          <BadgeTipo tipo={analise.recorte.final.tipo} />
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-0.5 text-xs text-slate-600">
                        <p><strong>Candidato gerado:</strong> {analise?.candidatoGerado ? 'sim' : 'não'}</p>
                        <p><strong>Elegível:</strong> {analise?.candidatoElegivelGerado ? 'sim' : 'não'}</p>
                        <p><strong>Entrou final:</strong> {analise?.recorte?.entrouNoFinal ? 'sim' : 'não'}</p>
                        <p><strong>Slot com pontos:</strong> {analise?.agenda?.pontos?.pontosValidos != null ? `${analise.agenda.pontos.pontosValidos} pt(s)` : '—'}</p>
                        <p><strong>Delta v2 (m):</strong> {analise?.osrmDelta?.kmAdicionalNaRotaM != null ? `${analise.osrmDelta.kmAdicionalNaRotaM}m` : '—'}</p>
                        <p><strong>Delta v2 (km):</strong> {analise?.osrmDelta?.kmAdicionalNaRotaKm != null ? `${analise.osrmDelta.kmAdicionalNaRotaKm}km` : '—'}</p>
                        <p><strong>Origem delta:</strong> {analise?.osrmDelta?.origemKmAdicionalNaRotaM ?? '—'}</p>
                        <p><strong>Origem oper.:</strong> {analise?.osrmDelta?.origemOperacional?.fonte ?? '—'}</p>
                        <p><strong>Disponível (min):</strong> {analise?.disponibilidade?.disponivelMin ?? '—'}</p>
                        <p><strong>Suficiente:</strong> {analise?.disponibilidade?.suficienteCalculado != null ? (analise.disponibilidade.suficienteCalculado ? 'sim' : 'não') : '—'}</p>
                        <p><strong>Filtro early desc.:</strong> {filtroDescartou ? 'sim' : (analise?.filtroEarlyHaversineLegado?.aplicadoNaV2 ? 'aplicado/passou' : 'não')}</p>
                        <p><strong>Âncora (km):</strong> {analise?.filtroEarlyHaversineLegado?.ancoraDistanciaKm != null ? `${analise.filtroEarlyHaversineLegado.ancoraDistanciaKm}km` : '—'}</p>
                      </div>

                      {analise?.osrmDelta?.melhorInsercao && (
                        <p className="text-xs text-slate-600">
                          <strong>Melhor inserção:</strong> antes={analise.osrmDelta.melhorInsercao.antes ?? '—'} | depois={analise.osrmDelta.melhorInsercao.depois ?? '—'} | deltaM={analise.osrmDelta.melhorInsercao.deltaM ?? '—'}
                        </p>
                      )}

                      {analise?.agenda?.pontosRotaBase && analise.agenda.pontosRotaBase.length > 0 && (
                        <div className="text-xs text-slate-600">
                          <strong>Rota base ({analise.agenda.pontosRotaBase.length} pt):</strong>{' '}
                          {analise.agenda.pontosRotaBase.map((p) => p.label ?? '?').join(' → ')}
                        </div>
                      )}

                      {analise?.filtroEarlyHaversineLegado?.nota && (
                        <p className="text-xs text-slate-500 italic">{analise.filtroEarlyHaversineLegado.nota}</p>
                      )}

                      {motivosExclusao.length > 0 && (
                        <p className="text-xs text-orange-700"><strong>Motivo exclusão recorte:</strong> {motivosExclusao.join(', ')}</p>
                      )}

                      {analise?.recorte?.pendenciaTecnica && (
                        <p className="text-xs text-red-700"><strong>Pendência técnica:</strong> {analise.recorte.pendenciaTecnica}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Comparação interna do motor */}
              {resultado.diagnosticoMotorInterno.comparacaoLegado && (
                <div className="border-t border-slate-200 p-3 bg-white space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Diagnóstico interno do motor — comparação legado</p>
                  {resultado.diagnosticoMotorInterno.comparacaoLegado.referencia31jul && (
                    <p className="text-xs text-slate-600">
                      <strong>31/07:</strong> {resultado.diagnosticoMotorInterno.comparacaoLegado.referencia31jul.resultadoV2 ?? '—'}
                    </p>
                  )}
                  {resultado.diagnosticoMotorInterno.comparacaoLegado.referencia05ago && (
                    <p className="text-xs text-slate-600">
                      <strong>05/08:</strong> {resultado.diagnosticoMotorInterno.comparacaoLegado.referencia05ago.resultadoV2 ?? '—'}
                    </p>
                  )}
                </div>
              )}

              {/* Pendências do motor */}
              {resultado.diagnosticoMotorInterno.pendencias && resultado.diagnosticoMotorInterno.pendencias.length > 0 && (
                <div className="border-t border-slate-200 p-3 bg-amber-50 space-y-1">
                  <p className="text-xs font-semibold text-amber-800">Pendências identificadas pelo motor</p>
                  <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                    {resultado.diagnosticoMotorInterno.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}

              {/* Resumo do recorte */}
              {resultado.diagnosticoMotorInterno.recorteFinal?.resumo && (
                <div className="border-t border-slate-200 p-3 bg-white space-y-1">
                  <p className="text-xs font-semibold text-slate-700">Resumo do recorte final</p>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 text-xs text-slate-600">
                    <p><strong>Total recebidos:</strong> {resultado.diagnosticoMotorInterno.recorteFinal.resumo.totalRecebidos ?? '—'}</p>
                    <p><strong>Elegíveis:</strong> {resultado.diagnosticoMotorInterno.recorteFinal.resumo.totalElegiveis ?? '—'}</p>
                    <p><strong>Recortados (finais):</strong> {resultado.diagnosticoMotorInterno.recorteFinal.resumo.totalRecortados ?? '—'}</p>
                    <p><strong>Última normal:</strong> {resultado.diagnosticoMotorInterno.recorteFinal.resumo.ultimaNormalDataISO ?? '—'}</p>
                    <p><strong>Extras rem. post.:</strong> {resultado.diagnosticoMotorInterno.recorteFinal.resumo.extrasRemovidosPorDataPosterior ?? '—'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aviso quando diagnosticoMotorInterno ausente */}
          {resultado.ok && !resultado.diagnosticoMotorInterno && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <strong>Atenção:</strong> diagnosticoMotorInterno não retornado pelo motor nesta execução. Dados de candidatos avaliados/descartados não disponíveis.
            </div>
          )}

          {/* Rota base detalhada por data */}
          {resultado.diagnosticoMotorInterno?.analisePorData && (
            <div className="space-y-4">
              {(['2026-07-31', '2026-08-05'] as const).map((dataISO) => {
                const analise = resultado.diagnosticoMotorInterno?.analisePorData?.[dataISO]
                const label = dataISO === '2026-07-31' ? '31/07 (sexta)' : '05/08 (quarta)'
                const pontosDetalhados = analise?.agenda?.pontosRotaBaseDetalhados
                const pontosCompletos = analise?.agenda?.pontosAgendaCompletos
                const pontosDescartados = analise?.agenda?.pontosAgendaDescartados
                const is31jul = dataISO === '2026-07-31'
                const borderCls = is31jul ? 'border-red-300' : 'border-amber-300'
                const headerCls = is31jul ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'

                const legadoRota = is31jul
                  ? { rotaBase: 'DEPÓSITO → Rua Prof.ª Maria da Glória Saldanha Loyola (Uberaba)', pontos: 1, deltaKm: 16.16, tipo: 'FORA-LIMITE', ancora: 'agenda UBERABA 28617' }
                  : { rotaBase: 'DEPÓSITO → agenda Bigorrilho', pontos: 2, deltaKm: 9.04, tipo: 'ESPECIAL', ancora: 'agenda TRANSF. BIGORRILHO' }

                const v2Pontos = pontosDetalhados?.length ?? 0
                const v2AgendaPontos = (pontosDetalhados ?? []).filter((p) => p.tipo === 'agenda').length
                const divergenciaComposicao = is31jul && v2AgendaPontos !== 1

                return (
                  <div key={dataISO} className={`rounded-lg border ${borderCls} overflow-hidden`}>
                    <div className={`p-3 border-b ${headerCls} space-y-1`}>
                      <h4 className="font-semibold text-slate-800 text-sm">
                        Rota base v2 — {label}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Total de pontos na rota v2: <strong>{v2Pontos}</strong> ({v2AgendaPontos} ponto(s) de agenda + 1 origem)
                      </p>
                      {divergenciaComposicao && (
                        <div className="rounded bg-red-100 border border-red-300 px-2 py-1 text-xs text-red-800 font-medium">
                          ⚠ Divergência provável: composição/quantidade dos pontos da rota base —
                          legado usou 1 ponto de agenda, v2 usou {v2AgendaPontos} ponto(s).
                          Isso reduz o delta v2 e muda a classificação.
                        </div>
                      )}
                    </div>

                    {/* Comparação lado a lado legado x v2 */}
                    <div className="grid grid-cols-2 gap-0 divide-x divide-slate-200">
                      <div className="p-3 bg-slate-50 space-y-1">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Legado</p>
                        <p className="text-xs text-slate-700"><strong>Rota:</strong> {legadoRota.rotaBase}</p>
                        <p className="text-xs text-slate-700"><strong>Pontos agenda:</strong> {legadoRota.pontos}</p>
                        <p className="text-xs text-slate-700"><strong>Âncora:</strong> {legadoRota.ancora}</p>
                        <p className="text-xs text-slate-700"><strong>Delta:</strong> {legadoRota.deltaKm}km</p>
                        <p className="text-xs"><BadgeTipo tipo={legadoRota.tipo.toLowerCase()} /></p>
                      </div>
                      <div className="p-3 bg-white space-y-1">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">v2</p>
                        <p className="text-xs text-slate-700">
                          <strong>Rota:</strong>{' '}
                          {pontosDetalhados
                            ? pontosDetalhados.map((p) => p.id ?? p.label ?? '?').join(' → ')
                            : '—'}
                        </p>
                        <p className="text-xs text-slate-700"><strong>Pontos agenda:</strong> {v2AgendaPontos}</p>
                        <p className="text-xs text-slate-700">
                          <strong>Âncora (filtro early):</strong> {analise?.filtroEarlyHaversineLegado?.ancoraTitulo ?? '—'} — {analise?.filtroEarlyHaversineLegado?.ancoraDistanciaKm != null ? `${analise.filtroEarlyHaversineLegado.ancoraDistanciaKm}km` : '—'}
                        </p>
                        <p className="text-xs text-slate-700">
                          <strong>Delta:</strong> {analise?.osrmDelta?.kmAdicionalNaRotaKm != null ? `${analise.osrmDelta.kmAdicionalNaRotaKm}km` : '—'}
                        </p>
                        {analise?.recorte?.final?.tipo && <BadgeTipo tipo={analise.recorte.final.tipo} />}
                      </div>
                    </div>

                    {/* Tabela de pontos da rota base detalhados */}
                    {pontosDetalhados && pontosDetalhados.length > 0 && (
                      <div className="border-t border-slate-200">
                        <div className="p-2 bg-slate-50 border-b border-slate-200">
                          <p className="text-xs font-semibold text-slate-700">Pontos da rota base v2 (detalhado)</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Ordem</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">ID</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Título evento</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Endereço</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">CEP</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Equipe</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Data</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Lat / Lng</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Tipo/Origem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {pontosDetalhados.map((p, i) => (
                                <tr key={i} className={p.tipo === 'origem' ? 'bg-slate-50' : 'bg-white'}>
                                  <td className="px-2 py-1.5 font-mono font-semibold text-slate-700">{(p.indice ?? i) + 0}</td>
                                  <td className="px-2 py-1.5 font-mono text-blue-700 whitespace-nowrap">{p.id ?? p.label ?? '—'}</td>
                                  <td className="px-2 py-1.5 text-slate-700 max-w-[200px] truncate" title={p.tituloEvento ?? undefined}>{p.tituloEvento ?? <span className="text-slate-400 italic">—</span>}</td>
                                  <td className="px-2 py-1.5 text-slate-600 max-w-[220px] truncate" title={p.endereco ?? undefined}>{p.endereco ?? <span className="text-slate-400 italic">—</span>}</td>
                                  <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">{p.cep ? `${p.cep.slice(0,5)}-${p.cep.slice(5)}` : <span className="text-slate-300">—</span>}</td>
                                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{p.equipe ?? <span className="text-slate-300">—</span>}</td>
                                  <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">{p.dataISO ?? <span className="text-slate-300">—</span>}</td>
                                  <td className="px-2 py-1.5 font-mono text-slate-400 whitespace-nowrap text-[10px]">{p.lat?.toFixed(5)}, {p.lng?.toFixed(5)}</td>
                                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{p.origemTipo ?? p.fonteEndereco ?? p.tipo ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Pontos de agenda completos (todos, incluindo fora da rota base) */}
                    {pontosCompletos && pontosCompletos.length > 0 && (
                      <details className="border-t border-slate-200">
                        <summary className="px-3 py-2 text-xs text-slate-500 cursor-pointer hover:text-slate-700 bg-slate-50 select-none">
                          Ver todos os {pontosCompletos.length} ponto(s) de agenda parseados para este slot (incluindo os que não entraram na rota base)
                        </summary>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500">ID</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500">Título</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500">Endereço</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500">CEP</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500">Equipe</th>
                                <th className="text-left px-2 py-1.5 font-medium text-slate-500">Lat / Lng</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {pontosCompletos.map((p, i) => {
                                const naRotaBase = (pontosDetalhados ?? []).some((r) => r.id === p.id)
                                return (
                                  <tr key={i} className={naRotaBase ? 'bg-blue-50' : ''}>
                                    <td className="px-2 py-1.5 font-mono text-blue-700 whitespace-nowrap">
                                      {p.id ?? '—'}
                                      {naRotaBase && <span className="ml-1 text-blue-500 text-[10px]">✓ rota</span>}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-700 max-w-[180px] truncate">{p.tituloEvento ?? <span className="text-slate-400 italic">—</span>}</td>
                                    <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate">{p.endereco ?? '—'}</td>
                                    <td className="px-2 py-1.5 font-mono text-slate-500 whitespace-nowrap">{p.cep ? `${p.cep.slice(0,5)}-${p.cep.slice(5)}` : '—'}</td>
                                    <td className="px-2 py-1.5 text-slate-500">{p.equipe ?? '—'}</td>
                                    <td className="px-2 py-1.5 font-mono text-slate-400 text-[10px] whitespace-nowrap">{p.lat?.toFixed(5)}, {p.lng?.toFixed(5)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}

                    {/* Pontos descartados pelo parser */}
                    {pontosDescartados && pontosDescartados.length > 0 && (
                      <details className="border-t border-slate-200">
                        <summary className="px-3 py-2 text-xs text-orange-600 cursor-pointer hover:text-orange-800 bg-orange-50 select-none">
                          {pontosDescartados.length} ponto(s) descartados pelo parser de agenda
                        </summary>
                        <div className="p-2 space-y-1">
                          {pontosDescartados.map((d, i) => (
                            <p key={i} className="text-xs text-slate-600 font-mono">
                              linha {d.indiceLinhaOriginal ?? '?'}: <span className="text-orange-700">{d.motivo ?? '—'}</span>{d.descricao ? ` — ${d.descricao}` : ''}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Tabela todos os candidatos */}
          {resultado.todosCandidatos && resultado.todosCandidatos.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <h4 className="font-semibold text-slate-800 text-sm">Candidatos finais v2 ({resultado.todosCandidatos.length}) — não suficientes sozinhos para explicar divergência</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Data</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Dia</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Tipo</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Equipe</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Frete</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.todosCandidatos.map((c, i) => {
                      const is31jul = c.dataISO === '2026-07-31'
                      const is05ago = c.dataISO === '2026-08-05'
                      return (
                        <tr key={i} className={is31jul ? 'bg-red-50' : is05ago ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-2 font-mono text-xs">
                            {c.dateDM ?? c.dataISO ?? '—'}
                            {is31jul && <span className="ml-1 text-red-600 text-xs">← 31/07</span>}
                            {is05ago && <span className="ml-1 text-amber-600 text-xs">← 05/08</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{c.weekday ?? '—'}</td>
                          <td className="px-3 py-2"><BadgeTipo tipo={c.tipo} /></td>
                          <td className="px-3 py-2 text-slate-600">{c.equipe ?? '—'}</td>
                          <td className="px-3 py-2 font-medium">{c.frete ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{c.rank ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* JSON bruto colapsável */}
          <div>
            <button
              onClick={() => setJsonAberto((v) => !v)}
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              {jsonAberto ? 'Ocultar' : 'Ver'} JSON bruto do diagnóstico
            </button>
            {jsonAberto && (
              <pre className="mt-2 rounded-md bg-slate-900 text-slate-100 text-xs p-4 overflow-auto max-h-96 font-mono">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
