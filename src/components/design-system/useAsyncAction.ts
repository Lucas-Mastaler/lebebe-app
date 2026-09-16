'use client'

import * as React from 'react'
import { asyncActionReducer, initialAsyncActionState, isBlocked } from '@/lib/design-system/async-action'

/**
 * SAV=A com ajuste: enquanto a ação está em voo, `run` ignora novas
 * chamadas (`loading` fica `true`, `Button` deve receber `loading={loading}`
 * — isso é o que bloqueia o botão de verdade, não é decoração). Sucesso e
 * erro liberam de novo automaticamente.
 */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  const [state, dispatch] = React.useReducer(asyncActionReducer, initialAsyncActionState)

  const run = React.useCallback(
    async (...args: Args) => {
      if (isBlocked(state)) return
      dispatch({ type: 'START' })
      try {
        await action(...args)
        dispatch({ type: 'SUCCESS' })
      } catch (err) {
        dispatch({ type: 'ERROR' })
        throw err
      }
    },
    [action, state]
  )

  return {
    status: state.status,
    loading: state.status === 'loading',
    success: state.status === 'success',
    error: state.status === 'error',
    run,
    reset: () => dispatch({ type: 'RESET' }),
  }
}
