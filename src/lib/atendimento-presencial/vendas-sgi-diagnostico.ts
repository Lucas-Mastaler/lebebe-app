import type { HistoricoVendaSgiDTO } from './historico-cliente'

export const MENSAGENS_DIAGNOSTICO_SGI = {
  associado: 'Venda identificada pela Prancheta.',
  ja_identificada: 'Venda já identificada no SGI.',
  aguardando_sgi: 'Aguardando a venda ser importada do SGI.',
  importacao_pendente: 'Aguardando a conclusão válida da importação SGI.',
  dados_insuficientes: 'Faltam dados para identificar a venda com segurança.',
  filial_incompativel: 'A filial não corresponde à venda SGI.',
  documento_ambiguo: 'Não foi possível identificar um único documento SGI.',
  documento_invalido: 'O documento SGI está incompleto.',
  documento_inconsistente: 'Os identificadores do documento SGI são inconsistentes.',
  data_fora_janela: 'A data da venda está fora da janela de dois dias do atendimento.',
  identidade_ambigua: 'Há informações conflitantes para esta venda. A associação automática foi bloqueada.',
  identidade_contraditoria: 'Os dados de identificação são divergentes. A associação automática foi bloqueada.',
} as const

export type DiagnosticoSgi = keyof typeof MENSAGENS_DIAGNOSTICO_SGI
export type ResolucaoVendasSgi = {
  vendas: HistoricoVendaSgiDTO[]
  diagnosticos: Partial<Record<DiagnosticoSgi, number>>
}
