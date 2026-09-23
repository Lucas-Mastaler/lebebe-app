'use client'

import { useEffect, useState } from 'react'

type PermissoesState = {
  loading: boolean
  error: boolean
  acessoTotal: boolean
  chavesPermitidas: string[]
  /** Chave de `app_perfis_acesso` (ex.: "gestao", "pos_venda", "consultora"). null para superadmin (acessoTotal) ou usuário sem perfil ativo. */
  perfilChave: string | null
}

const INITIAL_STATE: PermissoesState = {
  loading: true,
  error: false,
  acessoTotal: false,
  chavesPermitidas: [],
  perfilChave: null,
}

export function usePermissoes(): PermissoesState {
  const [state, setState] = useState<PermissoesState>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false

    async function fetchPermissoes() {
      try {
        const res = await fetch('/api/me/permissoes')
        if (!res.ok) {
          if (!cancelled) {
            setState({ loading: false, error: true, acessoTotal: false, chavesPermitidas: [], perfilChave: null })
          }
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setState({
            loading: false,
            error: false,
            acessoTotal: data.acessoTotal === true,
            chavesPermitidas: Array.isArray(data.chavesPermitidas) ? data.chavesPermitidas : [],
            perfilChave: typeof data.perfilAtual?.chave === 'string' ? data.perfilAtual.chave : null,
          })
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, error: true, acessoTotal: false, chavesPermitidas: [], perfilChave: null })
        }
      }
    }

    fetchPermissoes()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
