'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CENARIOS_DEV_V2, K13_FIXTURE, K14_FIXTURE, K15_FIXTURE } from '@/lib/procurar-datas/v2/dev-fixtures'
import type { PesquisarDatasRequest } from '@/lib/procurar-datas/contratos'
import type { ProgressoPesquisa, CandidatoFinal } from '@/lib/procurar-datas/contratos'
import DevV2DiagMajorHardy from './DevV2DiagMajorHardy'
import DevV2DiagHenriqueCorreia from './DevV2DiagHenriqueCorreia'

const POST_URL = '/api/procurar-datas/v2/pesquisar-compat-async'
const GET_URL = '/api/procurar-datas/v2/progresso-compat'

type PostResponse =
  | { ok: true; clientToken: string; status: string; modo: string }
  | { ok: false; clientToken: string; status: string; modo: string; error: string }

type GetResponse =
  | { ok: true; progress: ProgressoPesquisa }
  | { ok: false; error: string }

type EnderecoSemCoordenadasAuditoria = {
  slotKey: string | null
  dataISO: string | null
  equipe: string | null
  titulo: string | null
  endereco: string | null
  motivo: string
  chaveNormalizada: string | null
  indiceLinhaOriginal: number | null
  descricao: string | null
}

type AuditarRunResponse =
  | {
      ok: true
      pesquisa: {
        id: string
        runId: string | null
        clientToken: string | null
        createdAt: string | null
        usuarioEmail: string | null
        status: string | null
        motor: string | null
        duracaoMs: number | null
      }
      entrada: {
        cep: string | null
        endereco: {
          completo: string | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
        }
        coordenadas: { lat: number | null; lng: number | null }
        dataInicial: string | null
        tempoNecessario: string | null
        itens: Record<string, string | null>
        condominio: boolean | null
        rural: boolean | null
        encomenda: boolean | null
        valorInicialMinimo: number | null
      }
      resultadosSalvos: Array<{
        dataISO: string | null
        equipe: string | null
        tipo: string | null
        frete: string | null
        faltam: string | null
        encomenda: string | null
        rank: number | null
      }>
      diagnosticoReal: {
        disponivel: boolean
        motivoFalhaDiagnosticoReal: string | null
        agendaReal?: { ok?: boolean; leitura?: { linhasLidas?: number; linhasConvertidas?: number }; erro?: string }
        disponibilidadeReal?: { ok?: boolean; leitura?: { linhasLidas?: number; linhasConvertidas?: number }; erro?: string }
        totalLinhasAgendaLidas?: number
        totalDisponibilidadesLidas?: number
        totalCandidatosReais?: number
        fonteAgenda?: string
        fonteDisponibilidade?: string
        insercaoRealCompleta?: boolean
        enderecosSemCoordenadas?: EnderecoSemCoordenadasAuditoria[]
        slots?: Array<{
          slotKey: string | null
          dataISO: string | null
          equipe: string | null
          resultadoSalvo?: unknown
          kmAdicionalNaRotaM: number | null
          kmAdicionalKm: number | null
          slotAvailMin: number | null
          serviceMin: number | null
          equipeAtiva: boolean | null
          motivoIndisponibilidade: string | null
          tipoRecalculado: string | null
          elegivelRecalculado: boolean | null
          limiteBaseM: number | null
          limiteEspecialM: number | null
          limitePremiumM: number | null
          motivosAceiteRecusa: string[]
          origemKmAdicionalNaRotaM: string | null
          slotTemPontos: boolean | null
          insercaoRealCompleta?: boolean
          validacaoInsercaoReal?: string
          motivoInsercaoRealIncompleta?: string | null
          enderecosSemCoordenadas?: EnderecoSemCoordenadasAuditoria[]
          entrouNoRecorteAtual: boolean
          fonteDados: string
        }>
      }
      comparacao: {
        divergencias: Array<{ slotKey: string | null; tipo: string; detalhe: string }>
        avisos: string[]
        limitacoesHistoricas: string[]
        fonteCandidatos: string
        fonteDisponibilidade: string
      }
      textoCopiavel: string
    }
  | { ok: false; error?: string; message?: string }

type Execucao = {
  cenarioId: string
  postHttp: number
  postResponse: PostResponse | null
  getHttp: number | null
  getResponse: GetResponse | null
  inicioMs: number
  fimMs: number | null
  error: string
}

function formatarData(iso?: string) {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  } catch {
    return iso
  }
}

function formatarDuracao(ms?: number) {
  if (ms === undefined || ms === null) return '-'
  return `${ms} ms`
}

function badgeStatus(status?: string) {
  if (!status) return 'bg-slate-100 text-slate-700'
  switch (status) {
    case 'done':
      return 'bg-green-100 text-green-700'
    case 'error':
      return 'bg-red-100 text-red-700'
    case 'running':
      return 'bg-blue-100 text-blue-700'
    case 'queued':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export default function DevV2PesquisarCompatClient() {
  const [execucao, setExecucao] = useState<Execucao | null>(null)
  const [loading, setLoading] = useState(false)
  const [customPayload, setCustomPayload] = useState('')
  const [customError, setCustomError] = useState('')
  const [auditoriaInput, setAuditoriaInput] = useState('')
  const [auditoriaLoading, setAuditoriaLoading] = useState(false)
  const [auditoriaErro, setAuditoriaErro] = useState('')
  const [auditoriaResultado, setAuditoriaResultado] = useState<AuditarRunResponse | null>(null)
  const [auditoriaCopiado, setAuditoriaCopiado] = useState(false)

  async function executar(cenarioId: string, payload: PesquisarDatasRequest) {
    if (loading) return
    setLoading(true)
    setExecucao(null)
    setCustomError('')

    const inicioMs = Date.now()
    let exec: Execucao = {
      cenarioId,
      postHttp: 0,
      postResponse: null,
      getHttp: null,
      getResponse: null,
      inicioMs,
      fimMs: null,
      error: '',
    }

    try {
      const postRes = await fetch(POST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const postJson = (await postRes.json()) as PostResponse
      exec = { ...exec, postHttp: postRes.status, postResponse: postJson }

      const clientToken = postJson.ok ? postJson.clientToken : null
      if (!clientToken) {
        exec = { ...exec, fimMs: Date.now(), error: postJson.ok ? 'clientToken ausente' : (postJson as { error: string }).error }
        setExecucao(exec)
        setLoading(false)
        return
      }

      const getRes = await fetch(`${GET_URL}?clientToken=${encodeURIComponent(clientToken)}`, {
        method: 'GET',
      })
      const getJson = (await getRes.json()) as GetResponse
      exec = { ...exec, getHttp: getRes.status, getResponse: getJson, fimMs: Date.now() }

      setExecucao(exec)
    } catch (err) {
      exec = {
        ...exec,
        fimMs: Date.now(),
        error: err instanceof Error ? err.message : 'Erro inesperado',
      }
      setExecucao(exec)
    } finally {
      setLoading(false)
    }
  }

  function handleCenario(id: 'K13' | 'K14' | 'K15') {
    const payload = id === 'K13' ? K13_FIXTURE : id === 'K14' ? K14_FIXTURE : K15_FIXTURE
    executar(id, payload)
  }

  function handleCustom() {
    setCustomError('')
    if (!customPayload.trim()) {
      setCustomError('Cole um payload JSON válido.')
      return
    }
    try {
      const parsed = JSON.parse(customPayload) as PesquisarDatasRequest
      executar('custom', parsed)
    } catch {
      setCustomError('JSON inválido.')
    }
  }

  async function handleAuditarRun() {
    setAuditoriaErro('')
    setAuditoriaResultado(null)
    setAuditoriaCopiado(false)

    const runIdOuPesquisaId = auditoriaInput.trim()
    if (!runIdOuPesquisaId) {
      setAuditoriaErro('Informe um Run ID ou ID da pesquisa.')
      return
    }

    setAuditoriaLoading(true)
    try {
      const res = await fetch('/api/procurar-datas/v2/auditar-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runIdOuPesquisaId }),
      })
      const json = (await res.json()) as AuditarRunResponse
      setAuditoriaResultado(json)
      if (!res.ok || !json.ok) {
        setAuditoriaErro((json.ok ? '' : json.error || json.message) || `Erro HTTP ${res.status}`)
      }
    } catch (err) {
      setAuditoriaErro(err instanceof Error ? err.message : 'Erro inesperado ao auditar execução.')
    } finally {
      setAuditoriaLoading(false)
    }
  }

  async function copiarDiagnostico() {
    if (!auditoriaResultado?.ok) return
    await navigator.clipboard.writeText(auditoriaResultado.textoCopiavel)
    setAuditoriaCopiado(true)
    window.setTimeout(() => setAuditoriaCopiado(false), 2000)
  }

type CandidatoDevV2 = CandidatoFinal & {
  date?: string
  dateISO?: string
}

  const progresso = execucao?.getResponse?.ok ? execucao.getResponse.progress : null
  const payload = progresso?.payload
  const todosCandidatos: (CandidatoDevV2 & { grupo: 'normal' | 'extra' })[] = [
    ...((progresso?.normais ?? []) as CandidatoDevV2[]).map((c) => ({ ...c, grupo: 'normal' as const })),
    ...((progresso?.extras ?? []) as CandidatoDevV2[]).map((c) => ({ ...c, grupo: 'extra' as const })),
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <h2 className="font-semibold">Ferramenta interna / dev</h2>
        <p className="text-sm mt-1">
          Esta página é <strong>isolada</strong> e não altera a produção, o fluxo principal de /procurar-datas,
          o Apps Script, o motor v2, o orquestrador, o ranking/classificação/recorte, o banco, nem as rotas
          legadas. Ela consome apenas as rotas v2 paralelas já criadas para validação manual.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {CENARIOS_DEV_V2.map((c) => (
          <Button
            key={c.id}
            onClick={() => handleCenario(c.id)}
            disabled={loading}
            variant={c.id === 'K13' ? 'default' : c.id === 'K14' ? 'secondary' : 'outline'}
          >
            {c.nome}
          </Button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <h3 className="font-semibold text-slate-900">Payload customizado</h3>
        <textarea
          value={customPayload}
          onChange={(e) => setCustomPayload(e.target.value)}
          placeholder='Cole aqui um JSON de PesquisarDatasRequest. Ex: { "cep": "81830-020", "dataInicial": "2026-08-14", ... }'
          className="w-full min-h-[120px] px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {customError && <p className="text-sm text-red-600">{customError}</p>}
        <div className="flex gap-2">
          <Button onClick={handleCustom} disabled={loading} variant="outline">
            Rodar payload customizado
          </Button>
          <Button
            onClick={() => setCustomPayload(JSON.stringify(K13_FIXTURE, null, 2))}
            disabled={loading}
            variant="ghost"
          >
            Preencher com K13
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">Auditar pesquisa por Run ID</h3>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={auditoriaInput}
            onChange={(e) => setAuditoriaInput(e.target.value)}
            placeholder="Run ID ou ID da pesquisa"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <Button onClick={handleAuditarRun} disabled={auditoriaLoading} variant="outline">
            {auditoriaLoading ? 'Auditando...' : 'Auditar execução'}
          </Button>
        </div>

        {auditoriaErro && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {auditoriaErro}
          </div>
        )}

        {auditoriaResultado?.ok && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-slate-200 p-3 space-y-1">
                <h4 className="text-sm font-medium text-slate-700">Dados gerais da pesquisa</h4>
                <p className="text-sm"><strong>pesquisaAuditoriaId:</strong> {auditoriaResultado.pesquisa.id}</p>
                <p className="text-sm"><strong>runId:</strong> {auditoriaResultado.pesquisa.runId ?? '-'}</p>
                <p className="text-sm"><strong>clientToken:</strong> {auditoriaResultado.pesquisa.clientToken ?? '-'}</p>
                <p className="text-sm"><strong>usuário:</strong> {auditoriaResultado.pesquisa.usuarioEmail ?? '-'}</p>
                <p className="text-sm"><strong>timestamp:</strong> {formatarData(auditoriaResultado.pesquisa.createdAt ?? undefined)}</p>
                <p className="text-sm"><strong>status:</strong> {auditoriaResultado.pesquisa.status ?? '-'}</p>
                <p className="text-sm"><strong>duração:</strong> {formatarDuracao(auditoriaResultado.pesquisa.duracaoMs ?? undefined)}</p>
                <p className="text-sm"><strong>motor:</strong> {auditoriaResultado.pesquisa.motor ?? '-'}</p>
              </div>

              <div className="rounded-md border border-slate-200 p-3 space-y-1">
                <h4 className="text-sm font-medium text-slate-700">Entrada usada</h4>
                <p className="text-sm"><strong>CEP:</strong> {auditoriaResultado.entrada.cep ?? '-'}</p>
                <p className="text-sm"><strong>endereço:</strong> {auditoriaResultado.entrada.endereco.completo ?? '-'}</p>
                <p className="text-sm"><strong>coordenadas:</strong> {auditoriaResultado.entrada.coordenadas.lat ?? '-'}, {auditoriaResultado.entrada.coordenadas.lng ?? '-'}</p>
                <p className="text-sm"><strong>data inicial:</strong> {auditoriaResultado.entrada.dataInicial ?? '-'}</p>
                <p className="text-sm"><strong>tempo necessário:</strong> {auditoriaResultado.entrada.tempoNecessario ?? '-'}</p>
                <p className="text-sm"><strong>itens:</strong> {Object.values(auditoriaResultado.entrada.itens).filter(Boolean).join(' / ') || '-'}</p>
                <p className="text-sm"><strong>condomínio/rural/encomenda:</strong> {String(auditoriaResultado.entrada.condominio)} / {String(auditoriaResultado.entrada.rural)} / {String(auditoriaResultado.entrada.encomenda)}</p>
                <p className="text-sm"><strong>valor inicial mínimo:</strong> {auditoriaResultado.entrada.valorInicialMinimo ?? '-'}</p>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-200">
                <h4 className="text-sm font-medium text-slate-700">Resultados salvos</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Equipe</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-left px-3 py-2">Frete</th>
                      <th className="text-left px-3 py-2">Faltam</th>
                      <th className="text-left px-3 py-2">Encomenda</th>
                      <th className="text-left px-3 py-2">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditoriaResultado.resultadosSalvos.map((r, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{r.dataISO ?? '-'}</td>
                        <td className="px-3 py-2">{r.equipe ?? '-'}</td>
                        <td className="px-3 py-2">{r.tipo ?? '-'}</td>
                        <td className="px-3 py-2">{r.frete ?? '-'}</td>
                        <td className="px-3 py-2">{r.faltam ?? '-'}</td>
                        <td className="px-3 py-2">{r.encomenda ?? '-'}</td>
                        <td className="px-3 py-2">{r.rank ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-3 space-y-2">
              <h4 className="text-sm font-medium text-slate-700">Diagnóstico real</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p><strong>diagnóstico real disponível:</strong> {String(auditoriaResultado.diagnosticoReal.disponivel)}</p>
                <p><strong>agenda real lida:</strong> {String(auditoriaResultado.diagnosticoReal.agendaReal?.ok ?? false)}</p>
                <p><strong>disponibilidade real lida:</strong> {String(auditoriaResultado.diagnosticoReal.disponibilidadeReal?.ok ?? false)}</p>
                <p><strong>fonte agenda:</strong> {auditoriaResultado.diagnosticoReal.fonteAgenda ?? '-'}</p>
                <p><strong>fonte disponibilidade:</strong> {auditoriaResultado.diagnosticoReal.fonteDisponibilidade ?? auditoriaResultado.comparacao.fonteDisponibilidade}</p>
                <p><strong>linhas agenda:</strong> {auditoriaResultado.diagnosticoReal.totalLinhasAgendaLidas ?? auditoriaResultado.diagnosticoReal.agendaReal?.leitura?.linhasConvertidas ?? '-'}</p>
                <p><strong>linhas disponibilidade:</strong> {auditoriaResultado.diagnosticoReal.totalDisponibilidadesLidas ?? auditoriaResultado.diagnosticoReal.disponibilidadeReal?.leitura?.linhasConvertidas ?? '-'}</p>
                <p><strong>candidatos reais:</strong> {auditoriaResultado.diagnosticoReal.totalCandidatosReais ?? '-'}</p>
                <p><strong>inserção real completa:</strong> {auditoriaResultado.diagnosticoReal.insercaoRealCompleta === undefined ? '-' : String(auditoriaResultado.diagnosticoReal.insercaoRealCompleta)}</p>
              </div>
              {!auditoriaResultado.diagnosticoReal.disponivel && (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                  {auditoriaResultado.diagnosticoReal.motivoFalhaDiagnosticoReal ?? 'Diagnóstico real indisponível.'}
                </div>
              )}
            </div>

            {auditoriaResultado.diagnosticoReal.slots && auditoriaResultado.diagnosticoReal.slots.length > 0 && (
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-200">
                  <h4 className="text-sm font-medium text-slate-700">Slots recalculados</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2">Slot</th>
                        <th className="text-left px-3 py-2">Km rota</th>
                        <th className="text-left px-3 py-2">Tempo disp.</th>
                        <th className="text-left px-3 py-2">Serviço</th>
                        <th className="text-left px-3 py-2">Ativa</th>
                        <th className="text-left px-3 py-2">Tem pontos</th>
                        <th className="text-left px-3 py-2">Inserção real</th>
                        <th className="text-left px-3 py-2">Tipo atual</th>
                        <th className="text-left px-3 py-2">Elegível</th>
                        <th className="text-left px-3 py-2">Limite base</th>
                        <th className="text-left px-3 py-2">Limite especial</th>
                        <th className="text-left px-3 py-2">Limite premium</th>
                        <th className="text-left px-3 py-2">Origem km</th>
                        <th className="text-left px-3 py-2">Motivos</th>
                        <th className="text-left px-3 py-2">Fonte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditoriaResultado.diagnosticoReal.slots.map((slot, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{slot.slotKey ?? '-'}</td>
                          <td className="px-3 py-2">{slot.kmAdicionalKm ?? '-'}</td>
                          <td className="px-3 py-2">{slot.slotAvailMin ?? '-'}</td>
                          <td className="px-3 py-2">{slot.serviceMin ?? '-'}</td>
                          <td className="px-3 py-2">{String(slot.equipeAtiva)}</td>
                          <td className="px-3 py-2">{String(slot.slotTemPontos)}</td>
                          <td className="px-3 py-2 min-w-[180px]">
                            {slot.validacaoInsercaoReal ?? '-'}
                            {slot.enderecosSemCoordenadas && slot.enderecosSemCoordenadas.length > 0
                              ? ` (${slot.enderecosSemCoordenadas.length} sem coordenadas)`
                              : ''}
                          </td>
                          <td className="px-3 py-2">{slot.tipoRecalculado ?? '-'}</td>
                          <td className="px-3 py-2">{String(slot.elegivelRecalculado)}</td>
                          <td className="px-3 py-2">{slot.limiteBaseM ?? '-'}</td>
                          <td className="px-3 py-2">{slot.limiteEspecialM ?? '-'}</td>
                          <td className="px-3 py-2">{slot.limitePremiumM ?? '-'}</td>
                          <td className="px-3 py-2">{slot.origemKmAdicionalNaRotaM ?? '-'}</td>
                          <td className="px-3 py-2 min-w-[220px]">{slot.motivosAceiteRecusa.length > 0 ? slot.motivosAceiteRecusa.join('; ') : '-'}</td>
                          <td className="px-3 py-2">{slot.fonteDados}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-md border border-slate-200 p-3 space-y-2">
              <h4 className="text-sm font-medium text-slate-700">Comparação</h4>
              {auditoriaResultado.diagnosticoReal.enderecosSemCoordenadas && auditoriaResultado.diagnosticoReal.enderecosSemCoordenadas.length > 0 && (
                <div className="rounded-md border border-yellow-200 overflow-hidden">
                  <div className="p-3 border-b border-yellow-200 bg-yellow-50">
                    <h5 className="text-sm font-medium text-yellow-900">Endereços sem coordenadas</h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-yellow-50 border-b border-yellow-200">
                        <tr>
                          <th className="text-left px-3 py-2">Data</th>
                          <th className="text-left px-3 py-2">Equipe</th>
                          <th className="text-left px-3 py-2">Título</th>
                          <th className="text-left px-3 py-2">Endereço</th>
                          <th className="text-left px-3 py-2">Motivo</th>
                          <th className="text-left px-3 py-2">Chave normalizada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-yellow-100">
                        {auditoriaResultado.diagnosticoReal.enderecosSemCoordenadas.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{item.dataISO ?? '-'}</td>
                            <td className="px-3 py-2">{item.equipe ?? '-'}</td>
                            <td className="px-3 py-2">{item.titulo ?? '-'}</td>
                            <td className="px-3 py-2 min-w-[280px]">{item.endereco ?? '-'}</td>
                            <td className="px-3 py-2">{item.motivo}</td>
                            <td className="px-3 py-2 min-w-[260px] font-mono text-xs">{item.chaveNormalizada ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {auditoriaResultado.comparacao.divergencias.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {auditoriaResultado.comparacao.divergencias.map((d, idx) => (
                    <li key={idx}>{d.slotKey ? `${d.slotKey}: ` : ''}{d.detalhe}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-700">Nenhuma divergência detectada nos campos recalculados disponíveis.</p>
              )}
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                Blocos sintéticos não são usados como conclusão nesta auditoria.
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-slate-700">Texto para copiar</h4>
                <Button onClick={copiarDiagnostico} variant="outline" size="sm">
                  {auditoriaCopiado ? 'Copiado' : 'Copiar diagnóstico'}
                </Button>
              </div>
              <pre className="max-h-[360px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                {auditoriaResultado.textoCopiavel}
              </pre>
            </div>
          </div>
        )}
      </div>

      {loading && !execucao && (
        <div className="text-slate-600 text-sm">Aguardando resposta do POST...</div>
      )}

      {execucao && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                Resultado: {execucao.cenarioId}
              </h3>
              <span className="text-sm text-slate-500">
                duração total: {formatarDuracao((execucao.fimMs ?? Date.now()) - execucao.inicioMs)}
              </span>
            </div>

            {execucao.error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {execucao.error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-slate-200 p-3 space-y-1">
                <h4 className="text-sm font-medium text-slate-700">POST</h4>
                <p className="text-sm"><strong>HTTP:</strong> {execucao.postHttp}</p>
                {execucao.postResponse && (
                  <>
                    <p className="text-sm"><strong>ok:</strong> {String(execucao.postResponse.ok)}</p>
                    <p className="text-sm"><strong>status:</strong> {execucao.postResponse.status}</p>
                    <p className="text-sm"><strong>modo:</strong> {execucao.postResponse.modo}</p>
                    <p className="text-sm"><strong>clientToken:</strong> {(execucao.postResponse as { clientToken?: string }).clientToken ?? '-'}</p>
                    {'error' in execucao.postResponse && (
                      <p className="text-sm text-red-600"><strong>erro:</strong> {execucao.postResponse.error}</p>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-md border border-slate-200 p-3 space-y-1">
                <h4 className="text-sm font-medium text-slate-700">GET progresso</h4>
                <p className="text-sm"><strong>HTTP:</strong> {execucao.getHttp ?? '-'}</p>
                {execucao.getResponse?.ok ? (
                  <>
                    <p className="text-sm">
                      <strong>progress.status:</strong>{' '}
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${badgeStatus(execucao.getResponse.progress.status)}`}>
                        {execucao.getResponse.progress.status}
                      </span>
                    </p>
                    <p className="text-sm"><strong>normais:</strong> {execucao.getResponse.progress.normais.length}</p>
                    <p className="text-sm"><strong>extras:</strong> {execucao.getResponse.progress.extras.length}</p>
                    <p className="text-sm"><strong>payload.candidates:</strong> {execucao.getResponse.progress.payload?.candidates.length ?? 0}</p>
                    <p className="text-sm"><strong>durationMs:</strong> {formatarDuracao(execucao.getResponse.progress.durationMs)}</p>
                    <p className="text-sm"><strong>startedAt:</strong> {formatarData(execucao.getResponse.progress.startedAt)}</p>
                    <p className="text-sm"><strong>finishedAt:</strong> {formatarData(execucao.getResponse.progress.finishedAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-red-600">
                    <strong>erro:</strong> {execucao.getResponse && 'error' in execucao.getResponse ? execucao.getResponse.error : '-'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {payload && (
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
              <h3 className="font-semibold text-slate-900">Payload</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p><strong>cep:</strong> {payload.cep}</p>
                <p><strong>tempo:</strong> {payload.tempo}</p>
                <p><strong>label:</strong> {payload.label}</p>
                <p><strong>addressShort:</strong> {payload.addressShort}</p>
                <p><strong>startFromDM:</strong> {payload.startFromDM}</p>
                <p><strong>isRural:</strong> {String(payload.isRural)}</p>
                <p><strong>isCondominio:</strong> {String(payload.isCondominio)}</p>
                <p><strong>searchTime:</strong> {payload.searchTime}</p>
              </div>
            </div>
          )}

          {todosCandidatos.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Candidatos ({todosCandidatos.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-2">Grupo</th>
                      <th className="text-left px-4 py-2">Data</th>
                      <th className="text-left px-4 py-2">Dia</th>
                      <th className="text-left px-4 py-2">Tipo</th>
                      <th className="text-left px-4 py-2">Equipe</th>
                      <th className="text-left px-4 py-2">Rank</th>
                      <th className="text-left px-4 py-2">Frete</th>
                      <th className="text-left px-4 py-2">Aviso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {todosCandidatos.map((c, idx) => (
                      <tr key={idx} className={c.grupo === 'extra' ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${c.grupo === 'extra' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                            {c.grupo}
                          </span>
                        </td>
                        <td className="px-4 py-2">{c.date ?? c.dateISO?.slice(0, 10) ?? '-'}</td>
                        <td className="px-4 py-2">{c.weekday ?? '-'}</td>
                        <td className="px-4 py-2">{c.tipo}</td>
                        <td className="px-4 py-2">{c.team}</td>
                        <td className="px-4 py-2">{c.rank}</td>
                        <td className="px-4 py-2 font-medium">{c.frete || '-'}</td>
                        <td className="px-4 py-2 text-slate-500">{c.avisoHoraMarcada || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {progresso?.payload?.candidates.length === 0 && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              Nenhum candidato retornado no payload.
            </div>
          )}

          {progresso && 'error' in progresso && progresso.error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <strong>Erro controlado:</strong> {progresso.error}
            </div>
          )}
        </div>
      )}

      <DevV2DiagMajorHardy />
      <DevV2DiagHenriqueCorreia />
    </div>
  )
}
