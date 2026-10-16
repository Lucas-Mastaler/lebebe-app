import { normalizarNomeConsultora, validarNomeConsultora } from './ficha-schema'
import { consultoraDeHomologacao } from './registros'

export const CONSULTORAS_RECENTES_LIMITE = 4
export const CONSULTORAS_RECENTES_PAGINA = 100

/** Recebe registros do mais recente ao mais antigo; mantém a grafia do último uso. */
export function nomesConsultorasRecentes(rows: Array<{ consultora_nome: string | null }>) {
  const nomes: string[] = []
  const vistos = new Set<string>()
  for (const row of rows) {
    const nome = normalizarNomeConsultora(row.consultora_nome)
    const chave = nome.toLocaleLowerCase('pt-BR')
    if (!validarNomeConsultora(nome) || consultoraDeHomologacao(nome) || vistos.has(chave)) continue
    vistos.add(chave)
    nomes.push(nome)
    if (nomes.length === CONSULTORAS_RECENTES_LIMITE) break
  }
  return nomes
}
