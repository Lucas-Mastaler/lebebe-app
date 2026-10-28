import type { FichaCriancaRascunho } from '@/lib/atendimento-presencial/ficha-schema'

export const PRODUTOS = {
  berco: 'Berço', comoda: 'Cômoda', roupeiro: 'Roupeiro', poltrona: 'Poltrona', kit: 'Kit berço',
  coleito: 'Berço Desmontável/Co-leito', banheira: 'Banheira', baba: 'Babá eletrônica',
  alimentacao: 'Cadeira de alimentação', carro: 'Cadeira de carro', montessori: 'Cama montessori',
} as const
export type Produto = keyof typeof PRODUTOS
export type Resposta = 'sim' | 'nao'
export type Registro = { resposta: Resposta; atendimento: string }
export type Respostas = Record<string, Partial<Record<Produto, Registro>>>
export type Evento = { crianca: string; produto: Produto; anterior?: Resposta; resposta: Resposta; atendimento: string; instante: string }

export function identidade(crianca: FichaCriancaRascunho) { return crianca.criancaPermanenteId ?? crianca.id }
export function fase(crianca: FichaCriancaRascunho, hoje: string) {
  if (crianca.situacao === 'gestacao' || (crianca.situacao === 'presente_outra_pessoa' && crianca.presenteJaNasceu === false)) return -1
  if (crianca.situacao !== 'ja_nasceu' && !(crianca.situacao === 'presente_outra_pessoa' && crianca.presenteJaNasceu === true)) return null
  if (crianca.dataReferenciaNascimento) {
    const [ano, mes] = crianca.dataReferenciaNascimento.split('-').map(Number)
    const [a, m] = hoje.split('-').map(Number)
    const meses = (a - ano) * 12 + m - mes
    return meses >= 0 ? meses : null
  }
  // Sem referência atual, a idade histórica precisa ser confirmada pela consultora.
  return null
}
export function produtosDaFase(meses: number | null): Produto[] {
  if (meses === null || meses < -1 || meses > 12) return []
  if (meses === -1) return ['berco', 'comoda', 'roupeiro', 'poltrona', 'kit', 'coleito', 'banheira', 'baba']
  if (meses <= 3) return ['coleito', 'banheira']
  if (meses <= 7) return ['alimentacao', 'coleito']
  return ['carro', 'montessori']
}
export function rotuloFase(meses: number | null) {
  return meses === null ? 'Fase a confirmar' : meses === -1 ? 'Gestação (ainda não nasceu)' : `${meses} ${meses === 1 ? 'mês' : 'meses'}`
}
export function estaConfirmado(registro: Registro | undefined, atendimento: string) {
  return !!registro && (registro.resposta === 'sim' || registro.atendimento === atendimento)
}
export function resumo(produtos: Produto[], respostas: Respostas[string] = {}, atendimento: string) {
  return { total: produtos.length, respondidos: produtos.filter(p => estaConfirmado(respostas[p], atendimento)).length,
    sim: produtos.filter(p => respostas[p]?.resposta === 'sim').length, nao: produtos.filter(p => respostas[p]?.resposta === 'nao').length }
}
export function confirmar(respostas: Respostas, crianca: string, produto: Produto, resposta: Resposta, atendimento: string) {
  return { ...respostas, [crianca]: { ...respostas[crianca], [produto]: { resposta, atendimento } } }
}
export function primeiraPendente(criancas: FichaCriancaRascunho[], respostas: Respostas, atendimento: string, fases: Record<string, number>, hoje: string) {
  return criancas.find(c => {
    const meses = fases[identidade(c)] ?? fase(c, hoje)
    return meses === null || produtosDaFase(meses).some(p => !estaConfirmado(respostas[identidade(c)]?.[p], atendimento))
  })
}
