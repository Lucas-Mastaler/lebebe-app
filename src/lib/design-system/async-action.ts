/**
 * SAV=A com ajuste aprovado: ao iniciar salvamento/envio, o botão entra em
 * loading e fica bloqueado para novos acionamentos até a operação
 * terminar (sucesso libera após o feedback; erro libera de novo para nova
 * tentativa). Reducer puro — sem React — para poder testar a regra de
 * bloqueio sem precisar renderizar nada.
 */
export type AsyncActionStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncActionState {
  status: AsyncActionStatus
}

export type AsyncActionEvent =
  | { type: 'START' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR' }
  | { type: 'RESET' }

export const initialAsyncActionState: AsyncActionState = { status: 'idle' }

/**
 * `START` só tem efeito quando o estado não é `loading` — é exatamente
 * isso que impede o duplo clique/reenvio: um segundo `START` disparado
 * enquanto a primeira chamada ainda está em voo é ignorado.
 */
export function asyncActionReducer(state: AsyncActionState, event: AsyncActionEvent): AsyncActionState {
  switch (event.type) {
    case 'START':
      return state.status === 'loading' ? state : { status: 'loading' }
    case 'SUCCESS':
      return state.status === 'loading' ? { status: 'success' } : state
    case 'ERROR':
      return state.status === 'loading' ? { status: 'error' } : state
    case 'RESET':
      return initialAsyncActionState
    default:
      return state
  }
}

export function isBlocked(state: AsyncActionState): boolean {
  return state.status === 'loading'
}
