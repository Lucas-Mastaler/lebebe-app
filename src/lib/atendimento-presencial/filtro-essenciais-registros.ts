import { PRODUTOS_ESSENCIAIS, type ProdutoEssencial, type RespostaEssencial } from './essenciais'

export type SituacaoFiltroEssenciaisRegistro = RespostaEssencial | 'nao_informado'
export type FiltroEssenciaisRegistro = { produtos: ProdutoEssencial[]; situacao: SituacaoFiltroEssenciaisRegistro | '' }
export type CriancaFiltroEssenciaisRegistro = { atendimento_id: string; nome: string | null; nome_nao_informado?: boolean | null }
export type SnapshotFiltroEssenciaisRegistro = {
  atendimento_id: string
  crianca_id: string
  nome: string
  respostas: Array<{ produto: string; resposta: string; confirmada: boolean }>
}
export type CorrespondenciaEssencialRegistro = {
  criancaId: string
  criancaNome: string
  produto: ProdutoEssencial
  produtoNome: string
  resposta: SituacaoFiltroEssenciaisRegistro
}

export function analisarFiltroEssenciaisRegistro(valor: { produtos: string[]; situacao: string | null }):
  | { ok: true; filtro: FiltroEssenciaisRegistro | null }
  | { ok: false; mensagem: string } {
  const produtos = Array.from(new Set(valor.produtos)).filter(Boolean)
  const situacao = valor.situacao ?? ''
  if (produtos.some((produto) => !Object.hasOwn(PRODUTOS_ESSENCIAIS, produto))) return { ok: false, mensagem: 'Selecione um produto essencial válido.' }
  if (situacao && situacao !== 'sim' && situacao !== 'nao' && situacao !== 'nao_informado') return { ok: false, mensagem: 'Selecione uma resposta essencial válida.' }
  if (!produtos.length && situacao) return { ok: false, mensagem: 'Selecione um produto essencial antes da resposta.' }
  if (!produtos.length) return { ok: true, filtro: null }
  return { ok: true, filtro: { produtos: produtos as ProdutoEssencial[], situacao: situacao as FiltroEssenciaisRegistro['situacao'] } }
}

export function filtrarAtendimentosPorEssenciais(params: {
  atendimentos: Array<{ id: string; versao_essenciais?: number | null }>
  criancas: CriancaFiltroEssenciaisRegistro[]
  snapshots: SnapshotFiltroEssenciaisRegistro[]
  filtro: FiltroEssenciaisRegistro
}) {
  const criancasPorAtendimento = new Map<string, CriancaFiltroEssenciaisRegistro[]>()
  for (const crianca of params.criancas) {
    const grupo = criancasPorAtendimento.get(crianca.atendimento_id) ?? []
    grupo.push(crianca)
    criancasPorAtendimento.set(crianca.atendimento_id, grupo)
  }
  const snapshotsPorAtendimento = new Map<string, SnapshotFiltroEssenciaisRegistro[]>()
  for (const snapshot of params.snapshots) {
    const grupo = snapshotsPorAtendimento.get(snapshot.atendimento_id) ?? []
    grupo.push(snapshot)
    snapshotsPorAtendimento.set(snapshot.atendimento_id, grupo)
  }

  const correspondencias = new Map<string, CorrespondenciaEssencialRegistro[]>()
  for (const atendimento of params.atendimentos) {
    const itens: CorrespondenciaEssencialRegistro[] = []
    const snapshots = snapshotsPorAtendimento.get(atendimento.id) ?? []
    for (const snapshot of snapshots) {
      const correspondencias = params.filtro.produtos.map((produto) => {
        const resposta = snapshot.respostas.find((item) => item.produto === produto)
        if (!resposta) return null // Produto fora da fase; não significa "não informado".
        const situacao: SituacaoFiltroEssenciaisRegistro = resposta.confirmada === true && (resposta.resposta === 'sim' || resposta.resposta === 'nao') ? resposta.resposta : 'nao_informado'
        return { produto, situacao }
      })
      if (correspondencias.some((item) => !item || (params.filtro.situacao && params.filtro.situacao !== item.situacao))) continue
      for (const item of correspondencias) {
        if (!item) continue
        itens.push({ criancaId: snapshot.crianca_id, criancaNome: snapshot.nome?.trim() || 'Nome não informado', produto: item.produto, produtoNome: PRODUTOS_ESSENCIAIS[item.produto], resposta: item.situacao })
      }
    }

    // Atendimentos anteriores à implantação não têm snapshot; isso significa "não coletado nesta visita",
    // nunca um valor atual da criança. Só se consegue afirmar isso se a visita tinha criança associada.
    if (atendimento.versao_essenciais !== 1 && params.filtro.situacao === 'nao_informado' && snapshots.length === 0) {
      for (const crianca of criancasPorAtendimento.get(atendimento.id) ?? []) {
        for (const produto of params.filtro.produtos) itens.push({
          criancaId: `${atendimento.id}:${crianca.nome ?? ''}`,
          criancaNome: crianca.nome?.trim() || (crianca.nome_nao_informado ? 'Nome não informado' : 'Criança sem nome'),
          produto,
          produtoNome: PRODUTOS_ESSENCIAIS[produto],
          resposta: 'nao_informado',
        })
      }
    }
    if (itens.length) correspondencias.set(atendimento.id, itens)
  }
  return correspondencias
}
