import type { FichaCriancaRascunho } from './ficha-schema'
import { descreverIdadeAproximada } from './idade-aproximada'

export type CriancaReutilizavel = {
  id: string
  clienteId: string
  origem: 'permanente' | 'historica'
  parentesco: string | null
  dados: FichaCriancaRascunho
  registradoEm: string
  atendimentoId?: string
}

// Idade legada é um retrato: não converter em idade atual ou nascimento estimado.
export function descreverInformacaoNascimento(item: CriancaReutilizavel) {
  const dados = item.dados
  if (dados.dataReferenciaNascimento) return `${descreverIdadeAproximada(dados.dataReferenciaNascimento)} · referência estimada: ${dados.dataReferenciaNascimento.split('-').reverse().join('/')}`
  if (dados.dataPrevistaNascimento) return `Previsão informada: ${dados.dataPrevistaNascimento.split('-').reverse().join('/')}`
  if (dados.idadeValor && dados.idadeUnidade) return `Idade informada: ${dados.idadeValor} ${dados.idadeUnidade} (registro de ${item.registradoEm.slice(0, 10).split('-').reverse().join('/')})`
  return 'Nascimento não informado'
}

export function opcoesCriancasDisponiveis(itens: CriancaReutilizavel[], selecionadas: FichaCriancaRascunho[], clienteId: string) {
  const ids = new Set(selecionadas.map((item) => item.criancaPermanenteId).filter(Boolean))
  return itens.filter((item) => item.clienteId === clienteId && !ids.has(item.id))
}

export function selecionarCriancaCadastrada(item: CriancaReutilizavel, clienteId: string): FichaCriancaRascunho {
  if (item.clienteId !== clienteId || item.origem !== 'permanente') throw new Error('Vínculo da criança inválido')
  const dados = { ...item.dados }
  if (dados.situacao === 'presente_outra_pessoa' && dados.presenteJaNasceu !== undefined) {
    dados.situacao = dados.presenteJaNasceu ? 'ja_nasceu' : 'gestacao'
    delete dados.presenteJaNasceu
  }
  return { ...dados, id: `permanente-${item.id}`, criancaPermanenteId: item.id, vinculoClienteId: clienteId, parentesco: item.parentesco ?? undefined }
}
