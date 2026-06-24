'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const DIAG_URL = '/api/procurar-datas/v2/diagnostico'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FaixasEfetivasV2 = {
  limiteBaseM?: number
  limiteEspecialM?: number
  limitePremiumM?: number
  foraLimiteAcimaDeM?: number
  interpretacao?: {
    normal?: string
    especial?: string
    premium?: string
    foraDeLimite?: string
  }
  valoresBrutosBanco?: Record<string, number>
  notaInterpretacao?: string
  convergenciaComLegado?: {
    bate?: boolean
    nota?: string
  }
}

type CandidatoResumo = {
  dataISO?: string
  tipo?: string
  frete?: string
  equipe?: string
  dataDM?: string
  diaSemana?: string
} | null

type ComparacaoData = {
  legado?: { tipo?: string; frete?: string; nota?: string }
  v2?: { presente?: boolean; tipo?: string; frete?: string; equipe?: string }
  bate?: boolean
  divergente?: boolean
  nota?: string
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
  disponibilidade?: {
    disponivelMin?: number | null
    suficienteCalculado?: boolean | null
    motivoIndisponibilidade?: string | null
    tempoNecessarioMin?: number | null
  }
  agenda?: {
    pontos?: { pontosValidos?: number; totalPontos?: number } | null
    pontosRotaBase?: Array<{ label?: string; lat?: number; lng?: number }> | null
    pontosRotaBaseDetalhados?: PontoRotaBaseDetalhado[] | null
    pontosAgendaCompletos?: PontoAgendaCompleto[] | null
    pontosAgendaDescartados?: Array<{ indiceLinhaOriginal?: number; motivo?: string; descricao?: string }> | null
    avisos?: string[]
    erros?: string[]
  }
  osrmDelta?: {
    kmAdicionalNaRotaM?: number | null
    kmAdicionalNaRotaKm?: number | null
    origemKmAdicionalNaRotaM?: string | null
    melhorInsercao?: {
      antes?: string | null
      depois?: string | null
      deltaM?: number | null
    } | null
    origemOperacional?: { fonte?: string | null; lat?: number | null; lng?: number | null } | null
  }
  filtroEarlyHaversineLegado?: {
    aplicadoNaV2?: boolean
    descartadoNaV2?: boolean
    motivo?: string | null
    distanciaRetaKm?: number | null
    ancoraDistanciaKm?: number | null
    ancoraEndereco?: string | null
    ancoraTitulo?: string | null
    nota?: string | null
  }
  recorte?: {
    entrouAntesRecorte?: boolean
    entrouNoFinal?: boolean
    motivosExclusao?: string[]
    final?: { tipo?: string | null; kmAdicionalNaRotaM?: number | null } | null
  }
  classificacaoAntesRecorte?: {
    tipo?: string | null
    elegivel?: boolean | null
    kmAdicionalNaRotaM?: number | null
    limites?: Record<string, number | null>
    motivos?: Record<string, unknown>
  } | null
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
    }
    candidatosFinais?: Array<{ dataISO?: string; tipo?: string; kmAdicionalNaRotaM?: number | null; rank?: number | null }>
  }
  comparacaoLegado?: {
    referencia31jul?: {
      legadoDescarta?: boolean
      motivoLegado?: string
      resultadoV2?: string
      deltaV2M?: number | null
      deltaV2Km?: number | null
      filtroEarlyAplicadoNaV2?: boolean
    }
  }
  pendencias?: string[]
}

type DiagnosticoHenrique = {
  executado?: boolean
  ok?: boolean
  producaoAfetada?: boolean
  erro?: string
  validacaoPayload?: {
    payloadValido?: boolean
    dataInicialNormalizada?: string | null
    tempoNecessarioNormalizado?: number | null
    destLat?: number
    destLng?: number
    errosPayload?: string[]
  }
  faixasEfetivasV2?: FaixasEfetivasV2 | null
  configUsada?: {
    kmAdicionalMaxNaRotaM?: number
    kmAdicionalMaxNaRotaEspecialM?: number
    kmAdicionalMaxNaRotaPremiumM?: number
    origem?: string
    nota?: string
    erro?: string
  }
  datasEncontradas?: string[]
  candidatos?: Record<string, CandidatoResumo>
  diagnosticoMotorInterno?: DiagnosticoMotorInterno | null
  todosCandidatos?: CandidatoResumo[]
  logsLegado?: Record<string, { tipo?: string; frete?: string; obs?: string }>
  logsLegado31jul?: { slot?: string; tipo?: string; frete?: string; nota?: string }
  comparacao31jul?: ComparacaoData
  saidaV2?: { ok?: boolean; erros?: string[]; avisos?: string[] }
}

// ─── Helper: badge de tipo ─────────────────────────────────────────────────────

function BadgeTipo({ tipo }: { tipo?: string }) {
  if (!tipo) return <span className="text-slate-400 italic text-xs">—</span>
  const t = tipo.toLowerCase()
  const cls =
    t === 'premium' ? 'bg-purple-100 text-purple-800 border-purple-200' :
    t === 'especial' ? 'bg-blue-100 text-blue-800 border-blue-200' :
    t === 'normal' ? 'bg-green-100 text-green-800 border-green-200' :
    t === 'hora-marcada' ? 'bg-orange-100 text-orange-800 border-orange-200' :
    t === 'indisponivel' || t === 'fora-limite' ? 'bg-red-100 text-red-800 border-red-200' :
    'bg-slate-100 text-slate-700 border-slate-200'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-xs font-medium ${cls}`}>
      {tipo}
    </span>
  )
}

// ─── Seção: Validação das faixas de limite ────────────────────────────────────

function SecaoFaixasLimite({ faixas, config }: { faixas?: FaixasEfetivasV2 | null; config?: DiagnosticoHenrique['configUsada'] }) {
  if (!faixas && !config) return null

  const base = faixas?.limiteBaseM
  const especial = faixas?.limiteEspecialM
  const premium = faixas?.limitePremiumM

  const convergencia = faixas?.convergenciaComLegado

  return (
    <div className="rounded-lg border border-indigo-200 overflow-hidden">
      <div className="p-3 bg-indigo-50 border-b border-indigo-200 space-y-1">
        <h4 className="font-semibold text-slate-800 text-sm">Validação das faixas de limite</h4>
        <p className="text-xs text-slate-600">
          Confirma se v2 e legado usam as mesmas faixas absolutas de classificação.
        </p>
      </div>

      <div className="p-3 space-y-4">
        {/* Valores brutos do banco */}
        {(config || faixas?.valoresBrutosBanco) && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Valores brutos do banco (procurar_datas_config)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded bg-slate-50 border border-slate-200 p-2 text-xs">
                <p className="text-slate-500">KM ADICIONAL MAX NA ROTA</p>
                <p className="font-mono font-bold text-slate-800">
                  {config?.kmAdicionalMaxNaRotaM ?? faixas?.valoresBrutosBanco?.['KM ADICIONAL MAX NA ROTA (base)'] ?? '—'}m
                </p>
                <p className="text-slate-400 mt-0.5">= limite BASE (absoluto)</p>
              </div>
              <div className="rounded bg-amber-50 border border-amber-200 p-2 text-xs">
                <p className="text-slate-500">KM ADICIONAL MAX NA ROTA ESPECIAL</p>
                <p className="font-mono font-bold text-amber-800">
                  {config?.kmAdicionalMaxNaRotaEspecialM ?? faixas?.valoresBrutosBanco?.['KM ADICIONAL MAX NA ROTA ESPECIAL (guarda adicional)'] ?? '—'}m
                </p>
                <p className="text-amber-600 mt-0.5">= ADICIONAL ao base (não absoluto!)</p>
              </div>
              <div className="rounded bg-purple-50 border border-purple-200 p-2 text-xs">
                <p className="text-slate-500">KM ADICIONAL MAX NA ROTA PREMIUM</p>
                <p className="font-mono font-bold text-purple-800">
                  {config?.kmAdicionalMaxNaRotaPremiumM ?? faixas?.valoresBrutosBanco?.['KM ADICIONAL MAX NA ROTA PREMIUM (guarda adicional)'] ?? '—'}m
                </p>
                <p className="text-purple-600 mt-0.5">= ADICIONAL ao base (não absoluto!)</p>
              </div>
            </div>
            {faixas?.notaInterpretacao && (
              <div className="rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
                ⚠ {faixas.notaInterpretacao}
              </div>
            )}
          </div>
        )}

        {/* Faixas efetivas calculadas */}
        {faixas?.interpretacao && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Faixas efetivas calculadas pela v2
            </p>
            <p className="text-xs text-slate-500 font-mono">
              limiteEspecialM = base({base ?? '?'}) + guarda({config?.kmAdicionalMaxNaRotaEspecialM ?? '?'}) = {especial ?? '?'}m
            </p>
            <p className="text-xs text-slate-500 font-mono">
              limitePremiumM = base({base ?? '?'}) + guarda({config?.kmAdicionalMaxNaRotaPremiumM ?? '?'}) = {premium ?? '?'}m
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {[
                { label: 'Normal/Base', range: faixas.interpretacao.normal, cls: 'bg-green-50 border-green-200 text-green-800' },
                { label: 'Especial', range: faixas.interpretacao.especial, cls: 'bg-blue-50 border-blue-200 text-blue-800' },
                { label: 'Premium', range: faixas.interpretacao.premium, cls: 'bg-purple-50 border-purple-200 text-purple-800' },
                { label: 'Fora-limite', range: faixas.interpretacao.foraDeLimite, cls: 'bg-red-50 border-red-200 text-red-800' },
              ].map((f) => (
                <div key={f.label} className={`rounded border p-2 text-xs ${f.cls}`}>
                  <p className="font-semibold">{f.label}</p>
                  <p className="font-mono">{f.range ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Convergência com legado */}
        {convergencia && (
          <div className={`rounded border px-2 py-1.5 text-xs ${convergencia.bate ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <strong>{convergencia.bate ? '✓ Faixas convergem com legado' : '✗ Faixas DIVERGEM do legado'}</strong>
            {convergencia.nota && <p className="mt-0.5">{convergencia.nota}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Seção: candidato 31/07 detalhado ─────────────────────────────────────────

function SecaoDetalhe31Jul({
  candidato,
  comparacao,
  faixas,
}: {
  candidato: CandidatoResumo
  comparacao?: ComparacaoData
  faixas?: FaixasEfetivasV2 | null
}) {
  const tipo = candidato?.tipo?.toLowerCase() ?? null
  const divergente = comparacao?.divergente === true

  const deltaHipotese =
    tipo === 'especial'
      ? `Delta v2 entre ${faixas?.limiteBaseM ?? 5000 + 1}m e ${faixas?.limiteEspecialM ?? 10000}m (faixa especial)`
      : tipo === 'premium'
        ? `Delta v2 entre ${(faixas?.limiteEspecialM ?? 10000) + 1}m e ${faixas?.limitePremiumM ?? 15000}m (faixa premium)`
        : tipo === 'normal'
          ? `Delta v2 até ${faixas?.limiteBaseM ?? 5000}m (faixa normal)`
          : null

  return (
    <div className={`rounded-lg border overflow-hidden ${divergente ? 'border-red-300' : 'border-green-300'}`}>
      <div className={`p-3 border-b space-y-1 ${divergente ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
        <h4 className="font-semibold text-slate-800 text-sm">
          Diagnóstico 31/07 — Rua Henrique Correia
        </h4>
        {divergente && (
          <div className="rounded bg-red-100 border border-red-300 px-2 py-1 text-xs text-red-800 font-medium">
            ✗ DIVERGÊNCIA detectada
          </div>
        )}
        {!divergente && candidato && (
          <div className="rounded bg-green-100 border border-green-300 px-2 py-1 text-xs text-green-800 font-medium">
            ✓ v2 e legado convergem para 31/07
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-slate-200">
        <div className="p-3 bg-slate-50 space-y-1">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Legado</p>
          <p className="text-xs text-slate-700"><strong>Tipo:</strong> <BadgeTipo tipo={comparacao?.legado?.tipo} /></p>
          <p className="text-xs text-slate-700"><strong>Frete:</strong> {comparacao?.legado?.frete ?? '—'}</p>
          <p className="text-xs text-slate-600"><strong>Delta legado:</strong> não disponível no log (pendente)</p>
          <p className="text-xs text-slate-600"><strong>Faixa esperada:</strong> Premium (10001–15000m)</p>
        </div>
        <div className="p-3 bg-white space-y-1">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">v2</p>
          {candidato ? (
            <>
              <p className="text-xs text-slate-700"><strong>Tipo:</strong> <BadgeTipo tipo={candidato.tipo} /></p>
              <p className="text-xs text-slate-700"><strong>Frete:</strong> {candidato.frete ?? '—'}</p>
              <p className="text-xs text-slate-700"><strong>Equipe:</strong> {candidato.equipe ?? '—'}</p>
              {deltaHipotese && (
                <p className="text-xs text-blue-700 italic">{deltaHipotese}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-red-700 font-medium">31/07 não retornado pela v2</p>
          )}
        </div>
      </div>

      {comparacao?.nota && (
        <div className={`px-3 py-2 text-xs border-t ${divergente ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
          {comparacao.nota}
        </div>
      )}

      {tipo === 'especial' && divergente && (
        <div className="px-3 py-2 text-xs border-t border-amber-200 bg-amber-50 text-amber-800 space-y-1">
          <p className="font-semibold">Hipóteses para divergência Especial (v2) vs Premium (legado):</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Delta v2 ficou entre 5001m e 10000m (faixa especial), mas legado calculou entre 10001m e 15000m (faixa premium).</li>
            <li>Diferença pode ser na composição da rota base: mais pontos na v2 → ancora mais próxima → delta menor.</li>
            <li>Diferença pode ser na origem usada (depósito vs casa da equipe em sexta).</li>
            <li>Para confirmar: rodar o diagnóstico com <code>diagnosticoDeltaMajorFranciscoHardy31Jul=true</code> trocando o payload para Henrique Correia (já feito neste bloco).</li>
            <li>Ver campo <code>faixasEfetivasV2</code> acima — faixas da v2 e do legado são idênticas. A diferença é no delta calculado, não nos limites.</li>
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DevV2DiagHenriqueCorreia() {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<DiagnosticoHenrique | null>(null)

  async function rodar() {
    setLoading(true)
    setErro(null)
    setResultado(null)
    try {
      const resp = await fetch(DIAG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep: '82240-290',
          destLat: -25.40795,
          destLng: -49.20650,
          dataInicial: '2026-06-26',
          tempoNecessario: '02:00',
          diagnosticoDeltaHenriqueCorreia31Jul: true,
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      if (!json.diagnosticoHenriqueCorreia31Jul) {
        setErro('diagnosticoHenriqueCorreia31Jul ausente na resposta. Verifique a rota de diagnóstico.')
        return
      }
      setResultado(json.diagnosticoHenriqueCorreia31Jul as DiagnosticoHenrique)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const candidato31jul = resultado?.candidatos?.['31/07'] ?? null

  return (
    <div className="rounded-xl border border-indigo-200 bg-white shadow-sm p-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="font-bold text-slate-800">
            Diagnóstico Rua Henrique Correia — 31/07
          </h3>
          <p className="text-xs text-slate-500">
            Cenário: Rua Henrique Correia, 1320, Bairro Alto, Curitiba-PR | 02:00 | Roupeiro 4 pts
          </p>
          <p className="text-xs text-slate-500">
            v2: 31/07 = <strong>Especial R$ 220</strong> | Legado: 31/07 = <strong>Premium R$ 320</strong> — Investigar divergência
          </p>
        </div>
        <Button
          size="sm"
          onClick={rodar}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? 'Rodando...' : 'Rodar diagnóstico'}
        </Button>
      </div>

      {erro && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Erro:</strong> {erro}
        </div>
      )}

      {resultado && (
        <div className="space-y-4">
          {/* Status geral */}
          <div className={`rounded-md border p-2 text-xs font-medium flex items-center gap-2 ${resultado.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {resultado.ok ? '✓ Motor v2 executou com sucesso' : '✗ Motor v2 retornou erro'}
            {resultado.erro && <span className="font-normal">— {resultado.erro}</span>}
          </div>

          {/* Seção faixas de limite — principal insight desta seção */}
          <SecaoFaixasLimite faixas={resultado.faixasEfetivasV2} config={resultado.configUsada} />

          {/* Diagnóstico 31/07 */}
          {resultado.ok && (
            <SecaoDetalhe31Jul
              candidato={candidato31jul}
              comparacao={resultado.comparacao31jul}
              faixas={resultado.faixasEfetivasV2}
            />
          )}

          {/* Rota base v2 detalhada — 31/07 */}
          {resultado.ok && resultado.diagnosticoMotorInterno?.analisePorData && (() => {
            const analise = resultado.diagnosticoMotorInterno.analisePorData['2026-07-31']
            const pontosDetalhados = analise?.agenda?.pontosRotaBaseDetalhados
            const pontosCompletos = analise?.agenda?.pontosAgendaCompletos
            const pontosDescartados = analise?.agenda?.pontosAgendaDescartados
            const v2AgendaPontos = (pontosDetalhados ?? []).filter((p) => p.tipo === 'agenda').length
            const v2TotalPontos = pontosDetalhados?.length ?? 0
            const deltaKm = analise?.osrmDelta?.kmAdicionalNaRotaKm
            const deltaM = analise?.osrmDelta?.kmAdicionalNaRotaM
            const tipoClassif = analise?.classificacaoAntesRecorte?.tipo ?? analise?.recorte?.final?.tipo
            const melhorInsercao = analise?.osrmDelta?.melhorInsercao
            const ancoraTitulo = analise?.filtroEarlyHaversineLegado?.ancoraTitulo
            const ancoraDistKm = analise?.filtroEarlyHaversineLegado?.ancoraDistanciaKm
            const origemOperacional = analise?.osrmDelta?.origemOperacional

            const divergenciaComposicao = v2AgendaPontos !== 1
            const v2RotaLabel = pontosDetalhados
              ? pontosDetalhados.map((p) => p.tituloEvento ?? p.id ?? p.label ?? '?').join(' → ')
              : '—'

            const deltaFaixa =
              deltaM == null ? '—' :
              deltaM <= 5000 ? 'Normal (0–5000m)' :
              deltaM <= 10000 ? 'Especial (5001–10000m)' :
              deltaM <= 15000 ? 'Premium (10001–15000m)' :
              'Fora-limite (>15000m)'

            return (
              <div className="rounded-lg border border-orange-300 overflow-hidden">
                <div className="p-3 border-b border-orange-200 bg-orange-50 space-y-2">
                  <h4 className="font-semibold text-slate-800 text-sm">
                    Rota base v2 — 31/07 (Rua Henrique Correia)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded bg-white border border-orange-200 p-2">
                      <p className="text-slate-500">Total pontos rota v2</p>
                      <p className="font-bold text-slate-800">{v2TotalPontos} ({v2AgendaPontos} agenda + 1 origem)</p>
                    </div>
                    <div className="rounded bg-white border border-orange-200 p-2">
                      <p className="text-slate-500">Delta v2</p>
                      <p className="font-bold text-slate-800">{deltaKm != null ? `${deltaKm}km` : '—'} {deltaM != null ? `(${deltaM}m)` : ''}</p>
                    </div>
                    <div className="rounded bg-white border border-orange-200 p-2">
                      <p className="text-slate-500">Faixa aplicada</p>
                      <p className="font-bold text-slate-800">{deltaFaixa}</p>
                    </div>
                    <div className="rounded bg-white border border-orange-200 p-2">
                      <p className="text-slate-500">Tipo v2</p>
                      <p className="font-bold"><BadgeTipo tipo={tipoClassif ?? undefined} /></p>
                    </div>
                  </div>
                  {divergenciaComposicao && (
                    <div className="rounded bg-red-100 border border-red-300 px-2 py-1.5 text-xs text-red-800 font-medium">
                      ⚠ Divergência provável: legado considerou 1 ponto de agenda em 31/07, enquanto a v2 considerou {v2AgendaPontos} ponto(s).
                      Isso reduziu o delta v2 e mudou a classificação de Premium para Especial.
                    </div>
                  )}
                  {!divergenciaComposicao && v2AgendaPontos === 1 && (
                    <div className="rounded bg-green-100 border border-green-300 px-2 py-1.5 text-xs text-green-800">
                      ✓ Composição da rota base v2 igual ao legado (1 ponto de agenda). Investigar diferença de delta por outro motivo (origem, OSRM route vs table).
                    </div>
                  )}
                </div>

                {/* Comparação legado vs v2 */}
                <div className="grid grid-cols-2 gap-0 divide-x divide-slate-200">
                  <div className="p-3 bg-slate-50 space-y-1">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Legado</p>
                    <p className="text-xs text-slate-700"><strong>Rota:</strong> DEPÓSITO → Rua Prof.ª Maria da Glória Saldanha Loyola (Uberaba)</p>
                    <p className="text-xs text-slate-700"><strong>Pontos agenda:</strong> 1</p>
                    <p className="text-xs text-slate-700"><strong>Âncora:</strong> (03:00) UBERABA 28617 (UBERABA)</p>
                    <p className="text-xs text-slate-700"><strong>Delta:</strong> 10.36km</p>
                    <p className="text-xs text-slate-700"><strong>Faixa:</strong> Premium (10001–15000m)</p>
                    <BadgeTipo tipo="premium" />
                  </div>
                  <div className="p-3 bg-white space-y-1">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">v2</p>
                    <p className="text-xs text-slate-700"><strong>Rota:</strong> {v2RotaLabel}</p>
                    <p className="text-xs text-slate-700"><strong>Pontos agenda:</strong> {v2AgendaPontos}</p>
                    <p className="text-xs text-slate-700">
                      <strong>Âncora (filtro early):</strong>{' '}
                      {ancoraTitulo ?? '—'}{ancoraDistKm != null ? ` — ${ancoraDistKm}km` : ''}
                    </p>
                    <p className="text-xs text-slate-700">
                      <strong>Delta:</strong> {deltaKm != null ? `${deltaKm}km` : '—'}
                    </p>
                    <p className="text-xs text-slate-700">
                      <strong>Faixa:</strong> {deltaFaixa}
                    </p>
                    {tipoClassif && <BadgeTipo tipo={tipoClassif} />}
                    {origemOperacional?.fonte && (
                      <p className="text-xs text-slate-500 mt-1">
                        <strong>Origem:</strong> {origemOperacional.fonte} ({origemOperacional.lat?.toFixed(5)}, {origemOperacional.lng?.toFixed(5)})
                      </p>
                    )}
                  </div>
                </div>

                {/* Melhor inserção */}
                {melhorInsercao && (
                  <div className="border-t border-slate-200 p-3 space-y-1 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Melhor inserção v2</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <p><strong>Antes:</strong> {melhorInsercao.antes ?? '—'}</p>
                      <p><strong>Depois:</strong> {melhorInsercao.depois ?? '—'}</p>
                      <p><strong>DeltaM:</strong> {melhorInsercao.deltaM ?? '—'}m</p>
                    </div>
                  </div>
                )}

                {/* Tabela de pontos da rota base */}
                {pontosDetalhados && pontosDetalhados.length > 0 && (
                  <div className="border-t border-slate-200">
                    <div className="p-2 bg-slate-50 border-b border-slate-200">
                      <p className="text-xs font-semibold text-slate-700">Pontos da rota base v2 — 31/07 (detalhado)</p>
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
                              <td className="px-2 py-1.5 font-mono font-semibold text-slate-700">{i + 1}</td>
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

                {/* Pontos de agenda completos */}
                {pontosCompletos && pontosCompletos.length > 0 && (
                  <details className="border-t border-slate-200">
                    <summary className="px-3 py-2 text-xs text-slate-500 cursor-pointer hover:text-slate-700 bg-slate-50 select-none">
                      Ver todos os {pontosCompletos.length} ponto(s) de agenda parseados para 31/07 (incluindo os que não entraram na rota base)
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

                {/* Aviso se dados não disponíveis */}
                {!pontosDetalhados && (
                  <div className="p-3 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">
                    <strong>Atenção:</strong> pontosRotaBaseDetalhados não disponíveis para 31/07. O motor pode não ter gerado candidato para esta data/equipe (verificar disponibilidade e filtro early).
                  </div>
                )}
              </div>
            )
          })()}

          {/* Aviso quando diagnosticoMotorInterno ausente */}
          {resultado.ok && !resultado.diagnosticoMotorInterno && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <strong>Atenção:</strong> diagnosticoMotorInterno não retornado. Dados de rota base detalhada não disponíveis nesta execução.
            </div>
          )}

          {/* Tabela de todos os candidatos v2 */}
          {resultado.todosCandidatos && resultado.todosCandidatos.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <h4 className="font-semibold text-slate-800 text-sm">
                  Candidatos finais v2 ({resultado.todosCandidatos.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Data</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Dia</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Tipo v2</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Frete v2</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Tipo legado</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Frete legado</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.todosCandidatos.map((c, i) => {
                      if (!c) return null
                      const dm = c.dataDM ?? c.dataISO ?? '—'
                      const legadoEntry = resultado.logsLegado?.[dm.slice(0, 5)] ?? resultado.logsLegado?.[c.dataISO?.slice(5, 10).replace('-', '/') ?? '']
                      const is31jul = c.dataISO === '2026-07-31'
                      const diverge = is31jul && c.tipo !== 'premium'
                      return (
                        <tr key={i} className={is31jul ? (diverge ? 'bg-red-50' : 'bg-green-50') : ''}>
                          <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">
                            {c.dataDM ?? c.dataISO ?? '—'}
                            {is31jul && <span className="ml-1 text-xs font-bold text-red-600">← 31/07</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{c.diaSemana ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap"><BadgeTipo tipo={c.tipo} /></td>
                          <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">{c.frete ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {legadoEntry ? <BadgeTipo tipo={legadoEntry.tipo} /> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">
                            {legadoEntry?.frete ?? <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {legadoEntry ? (
                              c.tipo?.toLowerCase() === legadoEntry.tipo?.toLowerCase()
                                ? <span className="text-green-600 text-xs font-medium">✓ bate</span>
                                : <span className="text-red-600 text-xs font-medium">✗ diverge</span>
                            ) : <span className="text-slate-300 text-xs">sem ref.</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela legado para referência */}
          {resultado.logsLegado && (
            <details className="rounded-lg border border-slate-200">
              <summary className="px-3 py-2 text-xs text-slate-500 cursor-pointer select-none hover:text-slate-700 bg-slate-50">
                Ver resultado legado completo (referência)
              </summary>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Data</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Frete</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Obs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(resultado.logsLegado).map(([data, entry]) => (
                      <tr key={data}>
                        <td className="px-3 py-1.5 font-mono text-slate-700">{data}</td>
                        <td className="px-3 py-1.5"><BadgeTipo tipo={entry.tipo} /></td>
                        <td className="px-3 py-1.5 font-mono text-slate-600">{entry.frete ?? '—'}</td>
                        <td className="px-3 py-1.5 text-slate-400 italic">{entry.obs ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Erros/avisos do motor */}
          {resultado.saidaV2?.erros && resultado.saidaV2.erros.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
              <p className="font-medium">Erros motor v2:</p>
              {resultado.saidaV2.erros.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          {resultado.saidaV2?.avisos && resultado.saidaV2.avisos.length > 0 && (
            <details className="rounded-md border border-amber-200 bg-amber-50">
              <summary className="px-3 py-2 text-xs text-amber-700 cursor-pointer select-none">
                {resultado.saidaV2.avisos.length} aviso(s) do motor
              </summary>
              <div className="p-3 space-y-0.5">
                {resultado.saidaV2.avisos.map((a, i) => <p key={i} className="text-xs text-amber-800">{a}</p>)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
