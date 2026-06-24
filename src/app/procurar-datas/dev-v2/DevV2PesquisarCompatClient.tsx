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
