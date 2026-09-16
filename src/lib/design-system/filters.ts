/**
 * FLT-EXEC=MANUAL + FLT-CLR=C: alterar um campo de filtro nunca dispara a
 * consulta — só o clique em "Filtrar" (`APPLY`) promove o rascunho
 * (`draft`) para o estado aplicado (`applied`), que é o único que a
 * listagem deve observar. `CLEAR` (FLT-CLR=C) zera os dois imediatamente
 * e mantém o painel pronto para nova busca (não fecha nada).
 *
 * Reducer puro — a garantia "SET_FIELD nunca muda `applied`" é testável
 * sem precisar renderizar componente nenhum.
 */
export type FilterValues = object

export interface FilterState<T extends FilterValues> {
  draft: T
  applied: T
}

export type FilterEvent<T extends FilterValues> =
  | { type: 'SET_FIELD'; field: keyof T; value: T[keyof T] }
  | { type: 'APPLY' }
  | { type: 'CLEAR'; emptyValues: T }

export function createInitialFilterState<T extends FilterValues>(initial: T): FilterState<T> {
  return { draft: initial, applied: initial }
}

export function filterReducer<T extends FilterValues>(state: FilterState<T>, event: FilterEvent<T>): FilterState<T> {
  switch (event.type) {
    case 'SET_FIELD':
      return { ...state, draft: { ...state.draft, [event.field]: event.value } }
    case 'APPLY':
      return { ...state, applied: state.draft }
    case 'CLEAR':
      return { draft: event.emptyValues, applied: event.emptyValues }
    default:
      return state
  }
}

export function isDirty<T extends FilterValues>(state: FilterState<T>): boolean {
  return JSON.stringify(state.draft) !== JSON.stringify(state.applied)
}
