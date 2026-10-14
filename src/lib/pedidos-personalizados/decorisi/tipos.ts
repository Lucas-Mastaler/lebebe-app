export type TipoDecorisi = 'PAPEL' | 'PAINEL'
export type ClassificacaoDecorisi = 'CATALOGO' | 'PERSONALIZADO'
export type MedidaDecorisi = { larguraCm: number; alturaCm: number }
export type MedidaRascunhoDecorisi = { larguraCm: number | null; alturaCm: number | null; ambiente?: string | null }
export type IdentificacaoDecorisiRpc = { unidade_id: string; consultora: string; cliente: string; telefone_normalizado: string }
export type ItemDecorisi = {
  id?: string
  tipo: TipoDecorisi
  classificacao: ClassificacaoDecorisi
  referencia: string | null
  descricao: string | null
  observacoes: string | null
  medidas: MedidaRascunhoDecorisi[]
}
export type ReferenciaDbDecorisi = { referencia: string; repeticaoCm: number; ativo: boolean; versao: number }
export type PrecoDecorisi = {
  produtoIdSgi: number
  codigo: string
  preco: string | number | null
  ativo: boolean | null
  foraLinha: boolean | null
  validadoEm: string | null
}
