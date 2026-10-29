import { PRODUTOS_ESSENCIAIS, type SnapshotEssenciais, type EssenciaisRascunho, type ProdutoEssencial, type RespostaEssencial } from './essenciais'

export type CriancaSnapshotAtendimentoEssenciais = {
  id: string
  local_id?: string | null
  crianca_permanente_id?: string | null
}

export type ConfirmacoesEssenciaisEdicao = Record<string, Partial<Record<ProdutoEssencial, boolean>>>

export type AlteracaoEssencialAtendimento = {
  localId: string
  produto: ProdutoEssencial
  resposta: RespostaEssencial
  confirmada: true
}

export type EstadoEssenciaisEdicao = {
  respostas: EssenciaisRascunho
  confirmacoes: ConfirmacoesEssenciaisEdicao
  coletadas: Record<string, boolean>
  fases: Record<string, number | null>
}

function idLocal(crianca: CriancaSnapshotAtendimentoEssenciais) {
  return crianca.local_id?.trim() || crianca.id
}

export function validarConfirmacoesEssenciaisEdicao(valor: unknown, idsCriancas: string[]): valor is ConfirmacoesEssenciaisEdicao {
  if (valor === undefined) return true
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const idsPermitidos = new Set(idsCriancas)
  return Object.entries(valor).every(([id, respostas]) => idsPermitidos.has(id)
    && Boolean(respostas) && typeof respostas === 'object' && !Array.isArray(respostas)
    && Object.entries(respostas).every(([produto, confirmada]) => Object.hasOwn(PRODUTOS_ESSENCIAIS, produto) && typeof confirmada === 'boolean'))
}

export function mapearSnapshotEssenciaisParaEdicao(
  criancas: CriancaSnapshotAtendimentoEssenciais[],
  snapshots: SnapshotEssenciais[]
): EstadoEssenciaisEdicao {
  const criancaPorIdPermanente = new Map(
    criancas
      .filter((crianca): crianca is CriancaSnapshotAtendimentoEssenciais & { crianca_permanente_id: string } => Boolean(crianca.crianca_permanente_id))
      .map((crianca) => [crianca.crianca_permanente_id, crianca])
  )
  const estado: EstadoEssenciaisEdicao = { respostas: {}, confirmacoes: {}, coletadas: {}, fases: {} }

  for (const snapshot of snapshots) {
    const crianca = criancaPorIdPermanente.get(snapshot.criancaId)
    if (!crianca) continue
    const localId = idLocal(crianca)
    estado.coletadas[localId] = true
    estado.fases[localId] = snapshot.fase
    for (const item of snapshot.respostas) {
      estado.respostas[localId] = { ...estado.respostas[localId], [item.produto]: item.resposta }
      estado.confirmacoes[localId] = { ...estado.confirmacoes[localId], [item.produto]: item.confirmada }
    }
  }

  return estado
}

export function calcularAlteracoesEssenciaisAtendimento(params: {
  criancas: CriancaSnapshotAtendimentoEssenciais[]
  snapshots: Array<Pick<SnapshotEssenciais, 'criancaId' | 'respostas'>>
  respostas: EssenciaisRascunho
  confirmacoes: ConfirmacoesEssenciaisEdicao
}): { ok: true; alteracoes: AlteracaoEssencialAtendimento[] } | { ok: false; mensagem: string } {
  const criancaPorIdLocal = new Map(params.criancas.map((crianca) => [idLocal(crianca), crianca]))
  const snapshotPorCrianca = new Map(params.snapshots.map((snapshot) => [snapshot.criancaId, snapshot]))

  for (const [localId, respostas] of Object.entries(params.respostas)) {
    if (!respostas || Object.keys(respostas).length === 0) continue
    const crianca = criancaPorIdLocal.get(localId)
    const snapshot = crianca?.crianca_permanente_id ? snapshotPorCrianca.get(crianca.crianca_permanente_id) : undefined
    if (!snapshot) return { ok: false, mensagem: 'Este atendimento não coletou produtos essenciais para uma das crianças. As respostas retroativas não podem ser incluídas.' }
    const produtosDoSnapshot = new Map(snapshot.respostas.map((item) => [item.produto, item]))
    if (Object.keys(respostas).some((produto) => !produtosDoSnapshot.has(produto as ProdutoEssencial))) {
      return { ok: false, mensagem: 'Revise as respostas essenciais: há um produto que não foi registrado neste atendimento.' }
    }
  }

  const alteracoes: AlteracaoEssencialAtendimento[] = []
  for (const snapshot of params.snapshots) {
    const crianca = params.criancas.find((item) => item.crianca_permanente_id === snapshot.criancaId)
    if (!crianca) continue
    const localId = idLocal(crianca)
    for (const item of snapshot.respostas) {
      const resposta = params.respostas[localId]?.[item.produto]
      if (resposta === undefined) continue
      const confirmada = params.confirmacoes[localId]?.[item.produto] ?? item.confirmada
      if (resposta !== item.resposta || confirmada !== item.confirmada) {
        alteracoes.push({ localId, produto: item.produto, resposta, confirmada: true })
      }
    }
  }

  return { ok: true, alteracoes }
}
