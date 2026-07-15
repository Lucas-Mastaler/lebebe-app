'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Lock, RefreshCw, AlertTriangle, Globe, Hash, MapPin, DollarSign,
  ToggleLeft, Link as LinkIcon, FileText, Download, CheckCircle, Database,
  Pencil, X, Save,
} from 'lucide-react'
import type { ConfigItem } from '@/lib/procurar-datas/sheets-config'
import type { SnapshotInfo } from '@/lib/procurar-datas/config-db'
import type { StatusComparacao, ConfigSecoesComparadas, ResumoComparacao } from '@/app/api/configuracoes/procurar-datas/route'
import { CHAVES_EDITAVEIS_FASE3 } from '@/lib/procurar-datas/chaves-editaveis'

// ─────────────────────────────────────────────────────────
// Tipos locais (resposta da API)
// ─────────────────────────────────────────────────────────

interface ConfigItemComparado extends ConfigItem {
  status_comparacao: StatusComparacao
  valor_supabase: string | null
}

interface ConfigResponse {
  ok: true
  origem: 'planilha'
  lido_em: string
  secoes: ConfigSecoesComparadas
  comparacao: ResumoComparacao
}

interface ErrorResponse {
  ok: false
  error: string
  message: string
}

type ApiResponse = ConfigResponse | ErrorResponse

interface SnapshotResponse {
  ok: true
  banco_vazio: boolean
  snapshot: SnapshotInfo | null
}

interface ImportarResponse {
  ok: true
  snapshot_id: string
  criados: number
  alterados: number
  inalterados: number
}

interface PatchResponse {
  ok: true
  chave: string
  chave_upper: string
  valor_anterior: string | null
  valor_novo: string
  valor_tipo: string
}

// ─────────────────────────────────────────────────────────
// Helpers de formatação de valor do banco para exibição
// ─────────────────────────────────────────────────────────

// Para distance_m: banco guarda em metros, exibe em km
function formatarValorDb(valorDb: string | null, tipo: string): string {
  if (valorDb === null || valorDb === '') return '—'
  if (tipo === 'distance_m') {
    const metros = parseFloat(valorDb)
    if (!isNaN(metros)) {
      const km = metros / 1000
      return `${Number.isInteger(km) ? km : km.toFixed(1).replace('.', ',')} km`
    }
  }
  return valorDb
}

// Para distance_m: banco guarda em metros, input do usuário é em km
// Retorna string em km para preencher o input de edição
function valorDbParaInput(valorDb: string | null, tipo: string): string {
  if (!valorDb) return ''
  if (tipo === 'distance_m') {
    const metros = parseFloat(valorDb)
    if (!isNaN(metros)) {
      const km = metros / 1000
      return Number.isInteger(km) ? String(km) : km.toFixed(1)
    }
  }
  return valorDb
}

// ─────────────────────────────────────────────────────────
// Títulos das seções
// ─────────────────────────────────────────────────────────
const TITULOS_SECOES: Record<keyof ConfigSecoesComparadas, string> = {
  geral: 'Geral',
  rota: 'Rotas e Distâncias',
  candidatos_precos: 'Candidatos e Preços',
  equipes: 'Equipes',
  frete: 'Frete',
  provedores: 'Provedores e Credenciais',
  outros: 'Outros',
}

const ORDEM_SECOES: (keyof ConfigSecoesComparadas)[] = [
  'geral',
  'rota',
  'candidatos_precos',
  'equipes',
  'frete',
  'provedores',
  'outros',
]

// ─────────────────────────────────────────────────────────
// Renderização de valor por tipo (exibe valor ativo/banco comparado à planilha)
// ─────────────────────────────────────────────────────────
function ValorItem({ item, valorAtivo }: { item: ConfigItem; valorAtivo?: string }) {
  const tipo = item.tipo
  const valor = valorAtivo ?? item.valor

  if (!valor) {
    return <span className="text-slate-400 italic text-sm">—</span>
  }

  switch (tipo) {
    case 'secret':
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-sm bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
          <Lock className="w-3 h-3 flex-shrink-0" />
          {valor}
        </span>
      )
    case 'url':
      return (
        <a
          href={valor}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#00A5E6] hover:underline font-mono break-all"
        >
          <LinkIcon className="w-3 h-3 flex-shrink-0" />
          {valor}
        </a>
      )
    case 'boolean': {
      const sim = ['sim', 'yes', 'true', '1', 'ativo', 'ativa'].includes(valor.toLowerCase())
      return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          sim ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
        }`}>
          <ToggleLeft className="w-3 h-3" />
          {valor.toUpperCase()}
        </span>
      )
    }
    case 'currency': {
      const num = parseFloat(String(valor).replace('R$', '').replace(',', '.').trim())
      const formatado = isNaN(num)
        ? valor
        : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
          <DollarSign className="w-3 h-3 text-slate-400" />
          {formatado}
        </span>
      )
    }
    case 'distance_km':
      return <span className="text-sm font-mono text-slate-700">{valor} km</span>
    case 'distance_m': {
      const metros = parseFloat(String(valor).replace(',', '.').trim())
      if (!isNaN(metros)) {
        const km = metros / 1000
        const kmStr = Number.isInteger(km) ? String(km) : km.toFixed(1).replace('.', ',')
        return (
          <span className="text-sm font-mono text-slate-700">
            {kmStr} km <span className="text-slate-400 text-xs">({metros.toLocaleString('pt-BR')} m)</span>
          </span>
        )
      }
      return <span className="text-sm font-mono text-slate-700">{valor} m</span>
    }
    case 'number':
      return (
        <span className="inline-flex items-center gap-1 text-sm font-mono text-slate-700">
          <Hash className="w-3 h-3 text-slate-400" />
          {valor}
        </span>
      )
    case 'decimal':
      return <span className="text-sm font-mono text-slate-700">{valor}</span>
    case 'address':
      return (
        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          {valor}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 text-sm text-slate-700">
          <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
          {valor}
        </span>
      )
  }
}

// ─────────────────────────────────────────────────────────
// Badge de comparação
// ─────────────────────────────────────────────────────────
function BadgeComparacao({
  status,
  editavel,
}: {
  status: StatusComparacao
  editavel: boolean
}) {
  if (status === 'igual' || status === 'secret') return null

  const cfg: Record<Exclude<StatusComparacao, 'igual' | 'secret'>, { label: string; classes: string }> = {
    diferente: {
      label: editavel ? 'editado no banco' : 'diferente',
      classes: editavel
        ? 'bg-violet-50 text-violet-700 border-violet-200'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    },
    ausente_no_banco: { label: 'ausente no banco', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
    ausente_na_planilha: { label: 'ausente na planilha', classes: 'bg-slate-100 text-slate-500 border-slate-200' },
  }
  const { label, classes } = cfg[status]
  return (
    <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${classes}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// Input de edição por tipo
// ─────────────────────────────────────────────────────────
function InputEdicao({
  item,
  valor,
  onChange,
}: {
  item: ConfigItemComparado
  valor: string
  onChange: (v: string) => void
}) {
  const { tipo, chave } = item
  const isTempoSabado = chave.toUpperCase() === 'TEMPO MAXIMO DE VIAGEM SÁBADO'

  // Toggle para boolean
  if (tipo === 'boolean') {
    const isSim = valor === 'SIM'
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(isSim ? 'NÃO' : 'SIM')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isSim ? 'bg-green-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isSim ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-slate-700">{valor}</span>
      </div>
    )
  }

  // Input de texto para endereço
  if (tipo === 'address') {
    return (
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Endereço completo"
        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A5E6] focus:border-transparent"
      />
    )
  }

  // HH:MM para TEMPO MAXIMO DE VIAGEM SÁBADO
  if (isTempoSabado) {
    return (
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="HH:MM"
        maxLength={5}
        className="w-24 text-sm font-mono border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A5E6] focus:border-transparent"
      />
    )
  }

  // Input numérico para demais tipos
  const hints: Partial<Record<string, string>> = {
    distance_m: 'km',
    distance_km: 'km',
    currency: 'R$',
    number: '',
    decimal: '',
  }
  const suffix = hints[tipo] ?? ''

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-28 text-sm font-mono border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00A5E6] focus:border-transparent"
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Linha de configuração (com edição inline)
// ─────────────────────────────────────────────────────────
function LinhaConfig({
  item,
  bancovazio,
  onSalvo,
}: {
  item: ConfigItemComparado
  bancovazio: boolean
  onSalvo: (chaveUpper: string, valorNovo: string) => void
}) {
  const chaveUpper = item.chave.toUpperCase()
  const editavel =
    CHAVES_EDITAVEIS_FASE3.has(chaveUpper) &&
    item.status_comparacao !== 'ausente_no_banco' &&
    item.tipo !== 'secret' &&
    !bancovazio

  // Valor ativo: banco quando disponivel, senao planilha
  const valorAtivo = item.valor_supabase ?? item.valor
  const valorAtivoDisplay = valorAtivo ?? item.valor
  const divergente = item.status_comparacao === 'diferente' && item.valor !== item.valor_supabase

  const [editando, setEditando] = useState(false)
  const [inputValor, setInputValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null)

  function iniciarEdicao() {
    // Preencher input com valor atual do banco (em km se for distance_m)
    const valorInicial = valorDbParaInput(valorAtivo, item.tipo)
    // Para boolean: normalizar para SIM/NÃO
    if (item.tipo === 'boolean') {
      const raw = (valorAtivo ?? '').toUpperCase()
      const isSim = ['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'ATIVO', 'ATIVA'].includes(raw)
      setInputValor(isSim ? 'SIM' : 'NÃO')
    } else {
      setInputValor(valorInicial)
    }
    setErroEdicao(null)
    setSucessoMsg(null)
    setEditando(true)
  }

  function cancelar() {
    setEditando(false)
    setErroEdicao(null)
    setSucessoMsg(null)
  }

  async function salvar() {
    setSalvando(true)
    setErroEdicao(null)
    try {
      const res = await fetch(
        `/api/configuracoes/procurar-datas/${encodeURIComponent(chaveUpper)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: inputValor }),
        }
      )
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErroEdicao(json.message ?? json.error ?? 'Erro ao salvar')
      } else {
        const resultado = json as PatchResponse
        setSucessoMsg(`Salvo: "${resultado.valor_anterior ?? '—'}" → "${resultado.valor_novo}"`)
        setEditando(false)
        // Notificar componente pai para atualizar o valor_supabase localmente
        onSalvo(chaveUpper, resultado.valor_novo)
        // Limpar mensagem de sucesso após 4s
        setTimeout(() => setSucessoMsg(null), 4000)
      }
    } catch (e: unknown) {
      setErroEdicao(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setSalvando(false)
    }
  }

  const isEditavel = CHAVES_EDITAVEIS_FASE3.has(chaveUpper)
  const naoEditavelPorBancoVazio = isEditavel && bancovazio
  const naoEditavelPorAusente = isEditavel && item.status_comparacao === 'ausente_no_banco'

  return (
    <div className="flex flex-col gap-1 px-5 py-3">
      <div className="flex items-start gap-4">
        {/* Chave + subtexto */}
        <div className="min-w-0 flex-1 flex flex-col gap-0.5 pt-0.5">
          <span className="text-sm text-slate-500 font-medium break-words">{item.chave}</span>
          {/* Subtexto: valor da planilha como referencia (quando diverge do banco) */}
          {!editando && divergente && item.valor !== null && (
            <span className="text-xs text-slate-400 font-mono">
              Planilha: {formatarValorDb(item.valor, item.tipo)}
            </span>
          )}
          {/* Hint de distance_m durante edição */}
          {editando && item.tipo === 'distance_m' && (
            <span className="text-[11px] text-slate-400">
              Editar em km. Será salvo internamente em metros.
            </span>
          )}
        </div>

        {/* Valor ativo + badge + botão */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {!editando && <ValorItem item={item} valorAtivo={valorAtivoDisplay} />}
          <div className="flex items-center gap-2">
            <BadgeComparacao
              status={item.status_comparacao}
              editavel={isEditavel && item.status_comparacao === 'diferente'}
            />
            {/* Ícone de cadeado para não-editáveis */}
            {item.tipo === 'secret' && (
              <Lock className="w-3.5 h-3.5 text-amber-400" aria-label="Secret" />
            )}
            {!item.tipo.includes('secret') && !isEditavel && item.tipo !== 'secret' && (
              <Lock className="w-3.5 h-3.5 text-slate-300" aria-label="Somente leitura" />
            )}
            {/* Botão editar */}
            {editavel && !editando && (
              <button
                onClick={iniciarEdicao}
                className="p-1 rounded text-slate-400 hover:text-[#00A5E6] hover:bg-slate-100 transition-colors"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Dica quando ausente no banco mas na whitelist */}
            {(naoEditavelPorBancoVazio || naoEditavelPorAusente) && (
              <span className="text-[10px] text-slate-400 italic">importe primeiro</span>
            )}
          </div>
        </div>
      </div>

      {/* Área de edição inline */}
      {editando && (
        <div className="mt-2 flex flex-col gap-2">
          <InputEdicao item={item} valor={inputValor} onChange={setInputValor} />
          <div className="flex items-center gap-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#00A5E6] rounded-lg hover:bg-[#0090cc] disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={cancelar}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            {erroEdicao && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {erroEdicao}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Toast de sucesso */}
      {sucessoMsg && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {sucessoMsg}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Card de seção
// ─────────────────────────────────────────────────────────
function SecaoCard({
  titulo,
  itens,
  bancovazio,
  onSalvo,
}: {
  titulo: string
  itens: ConfigItemComparado[]
  bancovazio: boolean
  onSalvo: (chaveUpper: string, valorNovo: string) => void
}) {
  if (itens.length === 0) return null

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{titulo}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {itens.map((item) => (
          <LinhaConfig
            key={item.chave}
            item={item}
            bancovazio={bancovazio}
            onSalvo={onSalvo}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────
export default function ConfiguracoesProcurarDatasPage() {
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState<ConfigResponse | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Estado do painel de snapshot / importação
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null)
  const [bancoVazio, setBancoVazio] = useState<boolean | null>(null)
  const [importando, setImportando] = useState(false)
  const [importacaoResultado, setImportacaoResultado] = useState<ImportarResponse | null>(null)
  const [importacaoErro, setImportacaoErro] = useState<string | null>(null)

  useEffect(() => {
    carregarConfiguracoes()
    carregarSnapshot()
  }, [])

  async function carregarConfiguracoes() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/configuracoes/procurar-datas')
      const json: ApiResponse = await res.json()

      if (!res.ok || !json.ok) {
        const msg = !json.ok ? json.message : 'Erro desconhecido'
        setErro(msg)
      } else {
        setDados(json)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro de rede'
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  async function carregarSnapshot() {
    try {
      const res = await fetch('/api/configuracoes/procurar-datas/snapshot')
      if (!res.ok) return
      const json: SnapshotResponse = await res.json()
      if (json.ok) {
        setBancoVazio(json.banco_vazio)
        setSnapshot(json.snapshot)
      }
    } catch {
      // silencioso — snapshot é informativo, não bloqueia a tela
    }
  }

  async function executarImportacao() {
    setImportando(true)
    setImportacaoErro(null)
    setImportacaoResultado(null)
    try {
      const res = await fetch('/api/configuracoes/procurar-datas/importar', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setImportacaoErro(json.message ?? json.error ?? 'Erro desconhecido')
      } else {
        setImportacaoResultado(json as ImportarResponse)
        await carregarSnapshot()
        // Recarregar também as configs para atualizar comparação
        await carregarConfiguracoes()
      }
    } catch (e: unknown) {
      setImportacaoErro(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setImportando(false)
    }
  }

  // Atualiza o valor_supabase localmente após edição bem-sucedida,
  // sem precisar recarregar a lista
  const handleSalvo = useCallback((chaveUpper: string, valorNovo: string) => {
    setDados((prev) => {
      if (!prev) return prev
      const novasSecoes = { ...prev.secoes } as ConfigSecoesComparadas
      const novoComparacao = { ...prev.comparacao }

      for (const secao of ORDEM_SECOES) {
        const itens = novasSecoes[secao] as ConfigItemComparado[]
        const idx = itens.findIndex((i) => i.chave.toUpperCase() === chaveUpper)
        if (idx === -1) continue

        const itemAtual = itens[idx]
        const statusAnterior = itemAtual.status_comparacao
        // Novo status: compara valor ativo do banco com valor da planilha de referência
        const valorPlanilha = itemAtual.valor ?? ''
        const novoStatus: StatusComparacao =
          valorPlanilha === valorNovo ? 'igual' : 'diferente'

        const novosItens = [...itens]
        novosItens[idx] = {
          ...itemAtual,
          valor_supabase: valorNovo,
          status_comparacao: novoStatus,
        }
        novasSecoes[secao] = novosItens as typeof novasSecoes[typeof secao]

        // Atualizar contadores do resumo
        if (statusAnterior !== novoStatus) {
          if (statusAnterior === 'igual') novoComparacao.iguais--
          else if (statusAnterior === 'diferente') novoComparacao.diferentes--
          else if (statusAnterior === 'ausente_no_banco') novoComparacao.ausentes_no_banco--

          if (novoStatus === 'igual') novoComparacao.iguais++
          else if (novoStatus === 'diferente') novoComparacao.diferentes++
        }
        break
      }

      return { ...prev, secoes: novasSecoes, comparacao: novoComparacao }
    })
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Configurações — Procurar Datas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Banco de dados (fonte oficial) com planilha como referência.
            Valores editados no banco são usados pelo motor. Importe da planilha quando quiser sincronizar.
          </p>
        </div>
        <button
          onClick={carregarConfiguracoes}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Carregando...' : 'Recarregar'}
        </button>
      </div>

      {/* Meta: origem + timestamp */}
      {dados && (
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2">
          <Globe className="w-3.5 h-3.5" />
          <span>Origem: <strong className="text-slate-600">banco de dados interno</strong> (fonte oficial)</span>
          <span className="text-slate-300">·</span>
          <span>
            Lido em:{' '}
            <strong className="text-slate-600">
              {new Date(dados.lido_em).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </strong>
          </span>
        </div>
      )}

      {/* Resumo de comparação banco vs planilha */}
      {dados && !dados.comparacao.banco_vazio && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
          <span className="text-slate-500 font-medium">Banco vs planilha:</span>
          <span className="inline-flex items-center gap-1.5 text-green-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {dados.comparacao.iguais} iguais
          </span>
          {dados.comparacao.diferentes > 0 && (
            <span className="inline-flex items-center gap-1.5 text-violet-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
              {dados.comparacao.diferentes} editados no banco
            </span>
          )}
          {dados.comparacao.ausentes_no_banco > 0 && (
            <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              {dados.comparacao.ausentes_no_banco} ausentes no banco
            </span>
          )}
          {dados.comparacao.ausentes_na_planilha > 0 && (
            <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              {dados.comparacao.ausentes_na_planilha} ausentes na planilha
            </span>
          )}
          {dados.comparacao.diferentes === 0 &&
           dados.comparacao.ausentes_no_banco === 0 &&
           dados.comparacao.ausentes_na_planilha === 0 && (
            <span className="text-slate-400 text-xs">sincronizado com a planilha</span>
          )}
        </div>
      )}
      {dados && dados.comparacao.banco_vazio && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <Database className="w-4 h-4 flex-shrink-0" />
          Banco ainda sem dados — importe para ativar a comparação e edição.
        </div>
      )}

      {/* Painel Supabase: snapshot + botão de importação */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Banco de dados interno</h2>
        </div>
        <div className="px-5 py-4 space-y-4">

          {/* Último snapshot */}
          {bancoVazio === true && (
            <p className="text-sm text-slate-500">
              Nenhuma importação registrada ainda. Use o botão abaixo para importar as configurações da planilha para o banco.
            </p>
          )}
          {snapshot && (
            <div className="text-sm text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>
                  Último snapshot salvo em{' '}
                  <strong>
                    {new Date(snapshot.created_at).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </strong>
                  {snapshot.criado_por && (
                    <span className="text-slate-400"> · por {snapshot.criado_por}</span>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-400 pl-6">
                {snapshot.chaves_ok} chaves salvas
                {snapshot.chaves_vazias > 0 && `, ${snapshot.chaves_vazias} sem valor`}
                {' '}· status: {snapshot.status}
              </p>
            </div>
          )}

          {/* Feedback da última importação */}
          {importacaoResultado && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span>
                Importação para o banco concluída:{' '}
                <strong>{importacaoResultado.criados}</strong> criadas,{' '}
                <strong>{importacaoResultado.alterados}</strong> alteradas,{' '}
                <strong>{importacaoResultado.inalterados}</strong> inalteradas.
              </span>
            </div>
          )}

          {/* Erro da importação */}
          {importacaoErro && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{importacaoErro}</span>
            </div>
          )}

          {/* Botão de importação */}
          <button
            onClick={executarImportacao}
            disabled={importando || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#00A5E6] rounded-lg hover:bg-[#0090cc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className={`w-4 h-4 ${importando ? 'animate-bounce' : ''}`} />
            {importando ? 'Importando...' : 'Importar configuração da planilha'}
          </button>
          <p className="text-xs text-slate-400">
            Ação manual e controlada. Cada clique gera um snapshot imutável no banco.
            Secrets nunca são salvos.
          </p>
        </div>
      </div>

      {/* Estado de loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-[#00A5E6] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Lendo configurações...</span>
        </div>
      )}

      {/* Estado de erro */}
      {!loading && erro && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Erro ao carregar configurações</p>
            <p className="text-sm text-red-600 mt-1 break-words">{erro}</p>
            <button
              onClick={carregarConfiguracoes}
              className="mt-3 text-xs font-medium text-red-700 hover:text-red-900 underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Seções de configuração */}
      {!loading && dados && (
        <div className="space-y-4">
          {ORDEM_SECOES.map((secao) => {
            const itens = dados.secoes[secao] as ConfigItemComparado[]
            if (secao === 'outros' && itens.length === 0) return null
            return (
              <SecaoCard
                key={secao}
                titulo={TITULOS_SECOES[secao]}
                itens={itens}
                bancovazio={bancoVazio ?? true}
                onSalvo={handleSalvo}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
