'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Search, Save, AlertTriangle, X, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isMaticEmail } from '@/lib/auth/matic-emails'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SkuRow {
  codigo_produto: string
  descricao: string
  corredor_sugerido: string | null
  nivel_sugerido: string | null
  prateleira_sugerida: string | null
  ativo: boolean
  ref_meia: string | null
  ref_inteira: string | null
  volumes_por_item: number
  updated_at: string
}

interface EditState {
  descricao: string
  corredor_sugerido: string
  nivel_sugerido: string
  prateleira_sugerida: string
  ativo: boolean
  ref_meia: string
  ref_inteira: string
  volumes_por_item: string
}

function rowToEditState(row: SkuRow): EditState {
  return {
    descricao: row.descricao,
    corredor_sugerido: row.corredor_sugerido ?? '',
    nivel_sugerido: row.nivel_sugerido ?? '',
    prateleira_sugerida: row.prateleira_sugerida ?? '',
    ativo: row.ativo,
    ref_meia: row.ref_meia ?? '',
    ref_inteira: row.ref_inteira ?? '',
    volumes_por_item: String(row.volumes_por_item),
  }
}

function hasChanges(original: SkuRow, edit: EditState): boolean {
  return (
    edit.descricao !== original.descricao ||
    (edit.corredor_sugerido || null) !== original.corredor_sugerido ||
    (edit.nivel_sugerido || null) !== original.nivel_sugerido ||
    (edit.prateleira_sugerida || null) !== original.prateleira_sugerida ||
    edit.ativo !== original.ativo ||
    (edit.ref_meia || null) !== original.ref_meia ||
    (edit.ref_inteira || null) !== original.ref_inteira ||
    parseInt(edit.volumes_por_item) !== original.volumes_por_item
  )
}

function hasSensitiveChanges(original: SkuRow, edit: EditState): boolean {
  return (
    (edit.ref_meia || null) !== original.ref_meia ||
    (edit.ref_inteira || null) !== original.ref_inteira ||
    parseInt(edit.volumes_por_item) !== original.volumes_por_item
  )
}

function getSensitiveChanges(original: SkuRow, edit: EditState): Array<{ campo: string; antes: string; depois: string }> {
  const changes: Array<{ campo: string; antes: string; depois: string }> = []
  if ((edit.ref_meia || null) !== original.ref_meia) {
    changes.push({ campo: 'ref_meia', antes: original.ref_meia ?? '(vazio)', depois: edit.ref_meia || '(vazio)' })
  }
  if ((edit.ref_inteira || null) !== original.ref_inteira) {
    changes.push({ campo: 'ref_inteira', antes: original.ref_inteira ?? '(vazio)', depois: edit.ref_inteira || '(vazio)' })
  }
  if (parseInt(edit.volumes_por_item) !== original.volumes_por_item) {
    changes.push({ campo: 'volumes_por_item', antes: String(original.volumes_por_item), depois: edit.volumes_por_item })
  }
  return changes
}

// =========================================================
// Modal de confirmação para campos sensíveis
// =========================================================
function ModalConfirmacaoSensivel({
  codigo,
  changes,
  onConfirm,
  onCancel,
}: {
  codigo: string
  changes: Array<{ campo: string; antes: string; depois: string }>
  onConfirm: () => void
  onCancel: () => void
}) {
  const hasRefs = changes.some(c => c.campo === 'ref_meia' || c.campo === 'ref_inteira')
  const hasVolumes = changes.some(c => c.campo === 'volumes_por_item')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Confirmar alteração em campos sensíveis</h3>
              <p className="text-xs text-slate-500 mt-0.5">Produto: <span className="font-mono font-semibold">{codigo}</span></p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-2">
            {changes.map((c, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold text-slate-700">{c.campo}</span>
                <span className="text-slate-400 mx-2">→</span>
                <span className="font-mono text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through mr-1">{c.antes}</span>
                <span className="font-mono text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{c.depois}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-5">
            {hasRefs && (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span><strong>Atenção (ref_meia / ref_inteira):</strong> Alterar esses campos pode quebrar o matching com NFs futuras e causar duplicidade de SKU no finalizar de recebimentos.</span>
              </div>
            )}
            {hasVolumes && (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span><strong>Atenção (volumes_por_item):</strong> Alterar esse campo muda o número de volumes esperados em próximos recebimentos deste produto.</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirmar e Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================
// Linha de produto editável
// =========================================================
function SkuEditRow({
  row,
  onSaved,
}: {
  row: SkuRow
  onSaved: (updated: SkuRow) => void
}) {
  const [edit, setEdit] = useState<EditState>(() => rowToEditState(row))
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const pendingPayload = useRef<Record<string, unknown> | null>(null)

  const changed = hasChanges(row, edit)

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {}
    if (edit.descricao !== row.descricao) payload.descricao = edit.descricao
    if ((edit.corredor_sugerido || null) !== row.corredor_sugerido) payload.corredor_sugerido = edit.corredor_sugerido || null
    if ((edit.nivel_sugerido || null) !== row.nivel_sugerido) payload.nivel_sugerido = edit.nivel_sugerido || null
    if ((edit.prateleira_sugerida || null) !== row.prateleira_sugerida) payload.prateleira_sugerida = edit.prateleira_sugerida || null
    if (edit.ativo !== row.ativo) payload.ativo = edit.ativo
    if ((edit.ref_meia || null) !== row.ref_meia) payload.ref_meia = edit.ref_meia || null
    if ((edit.ref_inteira || null) !== row.ref_inteira) payload.ref_inteira = edit.ref_inteira || null
    const newVolumes = parseInt(edit.volumes_por_item)
    if (newVolumes !== row.volumes_por_item) payload.volumes_por_item = newVolumes
    return payload
  }

  function validateLocally(): string | null {
    if (!edit.descricao.trim()) return 'Descrição não pode ser vazia'
    const vol = parseInt(edit.volumes_por_item)
    if (!Number.isInteger(vol) || vol < 1) return 'Volumes por item deve ser >= 1'
    return null
  }

  async function executeSave(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(`/api/matic/sku/${encodeURIComponent(row.codigo_produto)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(`Erro ao salvar ${row.codigo_produto}: ${json.error || 'desconhecido'}`)
      } else {
        toast.success(`${row.codigo_produto} salvo com sucesso`)
        onSaved(json.data as SkuRow)
      }
    } catch {
      toast.error(`Erro de conexão ao salvar ${row.codigo_produto}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    const validationError = validateLocally()
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (!changed) return

    const payload = buildPayload()

    if (hasSensitiveChanges(row, edit)) {
      pendingPayload.current = payload
      setShowConfirm(true)
      return
    }

    await executeSave(payload)
  }

  async function handleConfirm() {
    setShowConfirm(false)
    if (pendingPayload.current) {
      await executeSave(pendingPayload.current)
      pendingPayload.current = null
    }
  }

  function handleCancel() {
    setShowConfirm(false)
    pendingPayload.current = null
  }

  const sensitiveChanges = getSensitiveChanges(row, edit)

  return (
    <>
      <div className={`bg-white border rounded-xl p-4 transition-all ${changed ? 'border-[#00A5E6]/50 shadow-sm' : 'border-slate-200'}`}>
        {/* Header da linha */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {row.codigo_produto}
            </span>
            {!edit.ativo && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Inativo
              </span>
            )}
            {changed && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Editado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={edit.ativo}
                onChange={e => setEdit(prev => ({ ...prev, ativo: e.target.checked }))}
                className="w-3.5 h-3.5 rounded"
              />
              Ativo
            </label>
            {changed && (
              <button
                onClick={() => setEdit(rowToEditState(row))}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Descartar alterações"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <Button
              onClick={handleSave}
              disabled={!changed || saving}
              className="gap-1.5 text-xs h-7 px-2.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Grid de campos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Descrição */}
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-500 block mb-1">Descrição</label>
            <input
              type="text"
              value={edit.descricao}
              onChange={e => setEdit(prev => ({ ...prev, descricao: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            />
          </div>

          {/* Corredor */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Corredor</label>
            <input
              type="text"
              value={edit.corredor_sugerido}
              onChange={e => setEdit(prev => ({ ...prev, corredor_sugerido: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            />
          </div>

          {/* Nível */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Nível</label>
            <input
              type="text"
              value={edit.nivel_sugerido}
              onChange={e => setEdit(prev => ({ ...prev, nivel_sugerido: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            />
          </div>

          {/* Prateleira */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Prateleira</label>
            <input
              type="text"
              value={edit.prateleira_sugerida}
              onChange={e => setEdit(prev => ({ ...prev, prateleira_sugerida: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            />
          </div>

          {/* ref_meia — SENSÍVEL */}
          <div>
            <label className="text-xs font-medium text-amber-600 block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Ref meia <span className="text-[10px] text-amber-500 font-normal">(sensível)</span>
            </label>
            <input
              type="text"
              value={edit.ref_meia}
              onChange={e => setEdit(prev => ({ ...prev, ref_meia: e.target.value }))}
              className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 bg-amber-50/30"
            />
          </div>

          {/* ref_inteira — SENSÍVEL */}
          <div>
            <label className="text-xs font-medium text-amber-600 block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Ref inteira <span className="text-[10px] text-amber-500 font-normal">(sensível)</span>
            </label>
            <input
              type="text"
              value={edit.ref_inteira}
              onChange={e => setEdit(prev => ({ ...prev, ref_inteira: e.target.value }))}
              className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 bg-amber-50/30"
            />
          </div>

          {/* volumes_por_item — SENSÍVEL */}
          <div>
            <label className="text-xs font-medium text-amber-600 block mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Vol/item <span className="text-[10px] text-amber-500 font-normal">(sensível)</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={edit.volumes_por_item}
              onChange={e => setEdit(prev => ({ ...prev, volumes_por_item: e.target.value }))}
              className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 bg-amber-50/30"
            />
          </div>
        </div>
      </div>

      {showConfirm && (
        <ModalConfirmacaoSensivel
          codigo={row.codigo_produto}
          changes={sensitiveChanges}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  )
}

// =========================================================
// Página principal
// =========================================================
export default function ProdutosPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SkuRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const limit = 50

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email && isMaticEmail(user.email)) {
        setAuthorized(true)
      } else {
        router.push('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  const loadSkus = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ q, page: String(p), limit: String(limit) })
      const res = await fetch(`/api/matic/sku?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setRows(json.data || [])
        setTotalPages(json.pagination?.totalPages || 1)
        setTotal(json.pagination?.total || 0)
        setPage(p)
      } else {
        toast.error('Erro ao carregar produtos')
      }
    } catch {
      toast.error('Erro de conexão ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadSkus(query, 1)
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, authorized, loadSkus])

  function handleRowSaved(updated: SkuRow) {
    setRows(prev => prev.map(r => r.codigo_produto === updated.codigo_produto ? updated : r))
  }

  if (!authorized) return null

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/recebimento')}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            title="Voltar para Recebimento"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Package className="w-7 h-7 text-[#00A5E6]" />
          <h1 className="text-2xl font-bold text-slate-800">Produtos / SKU</h1>
        </div>
      </div>

      {/* Aviso de campos sensíveis */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          Campos destacados em <strong>âmbar</strong> são sensíveis: alterar <strong>ref_meia</strong> ou <strong>ref_inteira</strong> pode quebrar o matching com NFs futuras; alterar <strong>vol/item</strong> muda os volumes esperados em próximos recebimentos.
          Uma confirmação será exibida antes de salvar esses campos.
        </span>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome, código, ref meia ou ref inteira..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A5E6]/30 focus:border-[#00A5E6]"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {total > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {total} produto{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-8 bg-slate-100 rounded col-span-2" />
                <div className="h-8 bg-slate-100 rounded" />
                <div className="h-8 bg-slate-100 rounded" />
                <div className="h-8 bg-slate-100 rounded" />
                <div className="h-8 bg-amber-50 rounded" />
                <div className="h-8 bg-amber-50 rounded" />
                <div className="h-8 bg-amber-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium">Nenhum produto encontrado</p>
          <p className="text-sm mt-1">Tente buscar por outro termo</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map(row => (
              <SkuEditRow key={row.codigo_produto} row={row} onSaved={handleRowSaved} />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => loadSkus(query, page - 1)}
                  disabled={page === 1}
                  variant="outline"
                  className="px-4"
                >
                  Anterior
                </Button>
                <Button
                  onClick={() => loadSkus(query, page + 1)}
                  disabled={page >= totalPages}
                  variant="outline"
                  className="px-4"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
