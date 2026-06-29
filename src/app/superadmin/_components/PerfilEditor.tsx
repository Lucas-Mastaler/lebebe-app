'use client'

import { useEffect, useState } from 'react'
import type { TipoJanelaPerfil } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PerfilResumido = {
  id: string
  chave: string
  nome: string
  descricao: string | null
  ativo: boolean
}

type PermissaoModulo = {
  moduloId: string
  chave: string
  nome: string
  rotaBase: string | null
  categoria: string | null
  ordem: number | null
  permitido: boolean
}

type JanelaEditorLocal = {
  tipo: TipoJanelaPerfil
  ativo: boolean
  horaInicio: string
  horaFim: string
}

const TIPO_LABEL: Record<TipoJanelaPerfil, string> = {
  seg_sex: 'Segunda a Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

const TIPOS_JANELA: TipoJanelaPerfil[] = ['seg_sex', 'sabado', 'domingo']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PerfilEditor() {
  // --- selecao de perfil ---
  const [perfis, setPerfis] = useState<PerfilResumido[]>([])
  const [perfilId, setPerfilId] = useState<string>('')
  const [perfilAtual, setPerfilAtual] = useState<PerfilResumido | null>(null)

  // --- permissoes ---
  const [permissoes, setPermissoes] = useState<PermissaoModulo[]>([])
  const [permissoesEdit, setPermissoesEdit] = useState<PermissaoModulo[]>([])
  const [loadingPerm, setLoadingPerm] = useState(false)
  const [salvandoPerm, setSalvandoPerm] = useState(false)
  const [msgPerm, setMsgPerm] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // --- janelas ---
  const [janelasEdit, setJanelasEdit] = useState<JanelaEditorLocal[]>([])
  const [loadingJanelas, setLoadingJanelas] = useState(false)
  const [salvandoJanelas, setSalvandoJanelas] = useState(false)
  const [msgJanelas, setMsgJanelas] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [errosJanelas, setErrosJanelas] = useState<Partial<Record<TipoJanelaPerfil, string>>>({})

  // --- carrega lista de perfis ativos ---
  useEffect(() => {
    fetch('/api/superadmin/perfis')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPerfis(d.perfis)
      })
      .catch(() => {})
  }, [])

  // --- ao trocar perfil, carrega permissoes e janelas ---
  useEffect(() => {
    if (!perfilId) {
      setPerfilAtual(null)
      setPermissoes([])
      setPermissoesEdit([])
      setJanelasEdit([])
      setMsgPerm(null)
      setMsgJanelas(null)
      return
    }
    const p = perfis.find((x) => x.id === perfilId) ?? null
    setPerfilAtual(p)
    loadPermissoes(perfilId)
    loadJanelas(perfilId)
  }, [perfilId, perfis])

  async function loadPermissoes(id: string) {
    setLoadingPerm(true)
    setMsgPerm(null)
    try {
      const res = await fetch(`/api/superadmin/perfis/${id}/permissoes`)
      const data = await res.json()
      if (data.ok) {
        setPermissoes(data.permissoes)
        setPermissoesEdit(data.permissoes.map((p: PermissaoModulo) => ({ ...p })))
      } else {
        setMsgPerm({ tipo: 'erro', texto: data.message || 'Erro ao carregar permissões' })
      }
    } catch {
      setMsgPerm({ tipo: 'erro', texto: 'Erro ao carregar permissões' })
    } finally {
      setLoadingPerm(false)
    }
  }

  async function loadJanelas(id: string) {
    setLoadingJanelas(true)
    setMsgJanelas(null)
    setErrosJanelas({})
    try {
      const res = await fetch(`/api/superadmin/perfis/${id}/janelas`)
      const data = await res.json()
      if (data.ok) {
        const editaveis: JanelaEditorLocal[] = TIPOS_JANELA.map((tipo) => {
          const janela = (data.janelas as { tipo: TipoJanelaPerfil; ativo: boolean; horaInicio: string | null; horaFim: string | null }[]).find(
            (j) => j.tipo === tipo
          )
          return {
            tipo,
            ativo: janela?.ativo ?? false,
            horaInicio: janela?.horaInicio ?? '',
            horaFim: janela?.horaFim ?? '',
          }
        })
        setJanelasEdit(editaveis)
      } else {
        setMsgJanelas({ tipo: 'erro', texto: data.message || 'Erro ao carregar janelas' })
      }
    } catch {
      setMsgJanelas({ tipo: 'erro', texto: 'Erro ao carregar janelas' })
    } finally {
      setLoadingJanelas(false)
    }
  }

  function togglePermissao(moduloId: string) {
    setPermissoesEdit((prev) =>
      prev.map((p) => (p.moduloId === moduloId ? { ...p, permitido: !p.permitido } : p))
    )
    setMsgPerm(null)
  }

  async function salvarPermissoes() {
    if (!perfilId || salvandoPerm) return
    setSalvandoPerm(true)
    setMsgPerm(null)
    try {
      const res = await fetch(`/api/superadmin/perfis/${perfilId}/permissoes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissoes: permissoesEdit.map((p) => ({
            moduloId: p.moduloId,
            permitido: p.permitido,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgPerm({ tipo: 'ok', texto: 'Permissões salvas com sucesso.' })
        await loadPermissoes(perfilId)
      } else {
        setMsgPerm({ tipo: 'erro', texto: data.message || 'Erro ao salvar permissões' })
      }
    } catch {
      setMsgPerm({ tipo: 'erro', texto: 'Erro ao salvar permissões' })
    } finally {
      setSalvandoPerm(false)
    }
  }

  function updateJanela(tipo: TipoJanelaPerfil, campo: keyof Omit<JanelaEditorLocal, 'tipo'>, valor: string | boolean) {
    setJanelasEdit((prev) =>
      prev.map((j) => (j.tipo === tipo ? { ...j, [campo]: valor } : j))
    )
    setErrosJanelas((prev) => {
      const next = { ...prev }
      delete next[tipo]
      return next
    })
    setMsgJanelas(null)
  }

  function validarJanelas(): boolean {
    const erros: Partial<Record<TipoJanelaPerfil, string>> = {}
    for (const j of janelasEdit) {
      if (j.ativo) {
        if (!j.horaInicio) {
          erros[j.tipo] = 'Hora de início é obrigatória quando ativo.'
        } else if (!j.horaFim) {
          erros[j.tipo] = 'Hora de fim é obrigatória quando ativo.'
        } else if (j.horaFim <= j.horaInicio) {
          erros[j.tipo] = 'Hora de fim deve ser maior que hora de início.'
        }
      }
    }
    setErrosJanelas(erros)
    return Object.keys(erros).length === 0
  }

  async function salvarJanelas() {
    if (!perfilId || salvandoJanelas) return
    if (!validarJanelas()) return
    setSalvandoJanelas(true)
    setMsgJanelas(null)
    try {
      const res = await fetch(`/api/superadmin/perfis/${perfilId}/janelas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          janelas: janelasEdit.map((j) => ({
            tipo: j.tipo,
            ativo: j.ativo,
            horaInicio: j.ativo ? j.horaInicio || null : null,
            horaFim: j.ativo ? j.horaFim || null : null,
            timezone: 'America/Sao_Paulo',
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgJanelas({ tipo: 'ok', texto: 'Janelas salvas com sucesso.' })
        await loadJanelas(perfilId)
      } else {
        setMsgJanelas({ tipo: 'erro', texto: data.message || 'Erro ao salvar janelas' })
      }
    } catch {
      setMsgJanelas({ tipo: 'erro', texto: 'Erro ao salvar janelas' })
    } finally {
      setSalvandoJanelas(false)
    }
  }

  const permissoesAlteradas =
    permissoesEdit.some((edit, i) => edit.permitido !== permissoes[i]?.permitido)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Seletor de perfil */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Perfis de Acesso</h2>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Selecionar perfil:
          </label>
          <select
            value={perfilId}
            onChange={(e) => setPerfilId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-w-[200px]"
          >
            <option value="">— escolha um perfil —</option>
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          {perfilAtual?.descricao && (
            <span className="text-sm text-gray-500">{perfilAtual.descricao}</span>
          )}
        </div>
      </div>

      {perfilId && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ---------------------------------------------------------------- */}
          {/* Bloco de permissoes */}
          {/* ---------------------------------------------------------------- */}
          <div className="bg-white rounded-lg shadow p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Permissões de {perfilAtual?.nome}</h3>
              {permissoesAlteradas && (
                <span className="text-xs text-amber-600 font-medium">Alterações não salvas</span>
              )}
            </div>

            {loadingPerm ? (
              <div className="text-sm text-gray-500 py-4 text-center">Carregando...</div>
            ) : (
              <div className="space-y-2">
                {permissoesEdit.map((mod) => (
                  <label
                    key={mod.moduloId}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{mod.nome}</span>
                      {(mod.rotaBase || mod.categoria) && (
                        <span className="text-xs text-gray-400">
                          {mod.categoria ? `${mod.categoria}` : ''}{mod.categoria && mod.rotaBase ? ' · ' : ''}{mod.rotaBase ?? ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className={`text-xs font-medium ${mod.permitido ? 'text-green-600' : 'text-gray-400'}`}>
                        {mod.permitido ? 'Liberado' : 'Bloqueado'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={mod.permitido}
                        onClick={() => togglePermissao(mod.moduloId)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                          mod.permitido ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            mod.permitido ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {msgPerm && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                msgPerm.tipo === 'ok'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {msgPerm.texto}
              </div>
            )}

            <button
              onClick={salvarPermissoes}
              disabled={salvandoPerm || loadingPerm || permissoesEdit.length === 0}
              className="mt-auto self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvandoPerm && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              )}
              {salvandoPerm ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Bloco de janelas */}
          {/* ---------------------------------------------------------------- */}
          <div className="bg-white rounded-lg shadow p-6 flex flex-col gap-4">
            <h3 className="text-lg font-semibold">Horários de {perfilAtual?.nome}</h3>

            {loadingJanelas ? (
              <div className="text-sm text-gray-500 py-4 text-center">Carregando...</div>
            ) : (
              <div className="space-y-4">
                {janelasEdit.map((janela) => (
                  <div
                    key={janela.tipo}
                    className={`rounded-lg border p-4 space-y-3 transition ${
                      janela.ativo ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">
                        {TIPO_LABEL[janela.tipo]}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-gray-500">
                          {janela.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={janela.ativo}
                          onClick={() => updateJanela(janela.tipo, 'ativo', !janela.ativo)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                            janela.ativo ? 'bg-indigo-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                              janela.ativo ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>

                    {janela.ativo && (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600">Início</label>
                          <input
                            type="time"
                            value={janela.horaInicio}
                            onChange={(e) => updateJanela(janela.tipo, 'horaInicio', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <span className="text-gray-400 mt-5">—</span>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600">Fim</label>
                          <input
                            type="time"
                            value={janela.horaFim}
                            onChange={(e) => updateJanela(janela.tipo, 'horaFim', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {!janela.ativo && (
                      <p className="text-xs text-gray-400">Sem acesso neste período</p>
                    )}

                    {errosJanelas[janela.tipo] && (
                      <p className="text-xs text-red-600">{errosJanelas[janela.tipo]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {msgJanelas && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                msgJanelas.tipo === 'ok'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {msgJanelas.texto}
              </div>
            )}

            <button
              onClick={salvarJanelas}
              disabled={salvandoJanelas || loadingJanelas || janelasEdit.length === 0}
              className="mt-auto self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {salvandoJanelas && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              )}
              {salvandoJanelas ? 'Salvando...' : 'Salvar horários'}
            </button>
          </div>

        </div>
      )}

      {!perfilId && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
          Selecione um perfil acima para visualizar e editar permissões e horários.
        </div>
      )}
    </div>
  )
}
