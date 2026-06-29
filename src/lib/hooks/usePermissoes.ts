'use client'

import { useEffect, useState } from 'react'

type PermissoesState = {
  loading: boolean
  error: boolean
  acessoTotal: boolean
  chavesPermitidas: string[]
}

const INITIAL_STATE: PermissoesState = {
  loading: true,
  error: false,
  acessoTotal: false,
  chavesPermitidas: [],
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
            setState({ loading: false, error: true, acessoTotal: false, chavesPermitidas: [] })
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
          })
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, error: true, acessoTotal: false, chavesPermitidas: [] })
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
