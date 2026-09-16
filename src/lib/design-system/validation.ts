/**
 * VAL=C (progressiva): o erro só aparece a primeira vez ao sair do campo
 * (blur) depois de interação — nunca antes disso — e, uma vez visível,
 * some em tempo real assim que o campo fica válido de novo.
 */
export interface FieldValidationState {
  touched: boolean
}

export const initialFieldValidationState: FieldValidationState = { touched: false }

export function onBlurTouched(): FieldValidationState {
  return { touched: true }
}

/** `validate` só roda depois do campo já ter sido tocado uma vez — antes disso, nunca mostra erro. */
export function computeFieldError(state: FieldValidationState, value: string, validate: (value: string) => string): string {
  return state.touched ? validate(value) : ''
}

/**
 * REQ=C: obrigatório sempre leva "*", opcional sempre leva "(opcional)" —
 * sem ambiguidade em nenhum campo. Retorna só o sufixo a concatenar no
 * label (o componente `FormField` cuida da marcação visual/acessível).
 */
export function requiredSuffix(required: boolean): { text: string; kind: 'required' | 'optional' } {
  return required ? { text: ' *', kind: 'required' } : { text: ' (opcional)', kind: 'optional' }
}
