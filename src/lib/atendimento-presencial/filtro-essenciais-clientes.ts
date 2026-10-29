import { dataAtendimentoLocal } from './idade-aproximada'
import { PRODUTOS_ESSENCIAIS, type RespostaEssencial } from './essenciais'

export const FASES_FILTRO_ESSENCIAIS = [
  { chave: 'gestacao', label: 'Gestação' },
  { chave: '0-3', label: '0–3 meses' },
  { chave: '4-8', label: '4–8 meses' },
  { chave: '9-12', label: '9–12 meses' },
  { chave: 'acima-12', label: 'Acima de 12 meses' },
  { chave: 'nao_informada', label: 'Fase não informada' },
] as const

export type FaseFiltroEssencial = (typeof FASES_FILTRO_ESSENCIAIS)[number]['chave']
export type SituacaoFiltroEssencial = RespostaEssencial | 'nao_informado'

export type FiltroEssencialCliente = {
  produtos: Array<keyof typeof PRODUTOS_ESSENCIAIS>
  situacao: SituacaoFiltroEssencial | ''
  fase: FaseFiltroEssencial | ''
}

export type PerfilCriancaEssencial = {
  id: string
  dados: unknown
  data_referencia_nascimento: string | null
}

export type VinculoClienteCriancaEssencial = {
  cliente_id: string
  crianca_id: string
}

export type EstadoAtualEssencialFiltro = {
  crianca_id: string
  produto: keyof typeof PRODUTOS_ESSENCIAIS
  resposta: RespostaEssencial
  registrado_em: string
}

export type CorrespondenciaEssencialCliente = {
  produto: keyof typeof PRODUTOS_ESSENCIAIS
  produtoNome: string
  criancaId: string
  criancaNome: string
  fase: FaseFiltroEssencial
  faseLabel: string
  resposta: SituacaoFiltroEssencial
  registradoEm: string | null
}

export function analisarFiltroEssencialCliente(valor: {
  produtos: string[]
  situacao: string | null
  fase: string | null
}):
  | { ok: true; filtro: FiltroEssencialCliente | null }
  | { ok: false; mensagem: string } {
  const produtos = Array.from(new Set(valor.produtos)).filter(Boolean)
  const situacao = valor.situacao ?? ''
  const fase = valor.fase ?? ''

  if (produtos.some((produto) => !Object.hasOwn(PRODUTOS_ESSENCIAIS, produto))) {
    return { ok: false, mensagem: 'Selecione um produto essencial válido.' }
  }
  if (situacao && situacao !== 'sim' && situacao !== 'nao' && situacao !== 'nao_informado') {
    return { ok: false, mensagem: 'Selecione uma situação válida.' }
  }
  if (fase && !FASES_FILTRO_ESSENCIAIS.some((item) => item.chave === fase)) {
    return { ok: false, mensagem: 'Selecione uma fase válida.' }
  }
  if (!produtos.length && (situacao || fase)) {
    return { ok: false, mensagem: 'Selecione um produto essencial antes de filtrar por situação ou fase.' }
  }
  if (!produtos.length) return { ok: true, filtro: null }

  return {
    ok: true,
    filtro: {
      produtos: produtos as FiltroEssencialCliente['produtos'],
      situacao: situacao as FiltroEssencialCliente['situacao'],
      fase: fase as FiltroEssencialCliente['fase'],
    },
  }
}

export function faseAtualCriancaEssencial(perfil: PerfilCriancaEssencial, hoje = dataAtendimentoLocal()): FaseFiltroEssencial {
  const dados = perfil.dados && typeof perfil.dados === 'object' && !Array.isArray(perfil.dados)
    ? perfil.dados as Record<string, unknown>
    : {}

  if (dados.situacao === 'gestacao') return 'gestacao'
  if (dados.situacao !== 'ja_nasceu') return 'nao_informada'

  const nascimento = perfil.data_referencia_nascimento
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}$/.test(nascimento) || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) {
    return 'nao_informada'
  }

  const [anoHoje, mesHoje] = hoje.split('-').map(Number)
  const [anoNascimento, mesNascimento] = nascimento.split('-').map(Number)
  const meses = (anoHoje - anoNascimento) * 12 + mesHoje - mesNascimento
  if (!Number.isInteger(meses) || meses < 0) return 'nao_informada'
  if (meses <= 3) return '0-3'
  if (meses <= 8) return '4-8'
  if (meses <= 12) return '9-12'
  return 'acima-12'
}

export function filtrarCorrespondenciasEssenciaisCliente(
  filtro: FiltroEssencialCliente,
  vinculos: VinculoClienteCriancaEssencial[],
  perfis: PerfilCriancaEssencial[],
  estados: EstadoAtualEssencialFiltro[],
  hoje = dataAtendimentoLocal()
) {
  const perfilPorId = new Map(perfis.map((perfil) => [perfil.id, perfil]))
  const estadoPorProdutoCrianca = new Map(estados.map((estado) => [`${estado.crianca_id}:${estado.produto}`, estado]))
  const faseLabels = new Map(FASES_FILTRO_ESSENCIAIS.map((fase) => [fase.chave, fase.label]))
  const porCliente = new Map<string, CorrespondenciaEssencialCliente[]>()
  const vistos = new Set<string>()

  for (const vinculo of vinculos) {
    const chave = vinculo.cliente_id + ':' + vinculo.crianca_id
    if (vistos.has(chave)) continue
    vistos.add(chave)

    const perfil = perfilPorId.get(vinculo.crianca_id)
    if (!perfil) continue
    const fase = faseAtualCriancaEssencial(perfil, hoje)
    if (filtro.fase && filtro.fase !== fase) continue

    const correspondenciasProduto = filtro.produtos.map((produto) => {
      const estado = estadoPorProdutoCrianca.get(`${vinculo.crianca_id}:${produto}`)
      return { produto, estado, resposta: (estado?.resposta ?? 'nao_informado') as SituacaoFiltroEssencial }
    })
    if (filtro.situacao && correspondenciasProduto.some((item) => item.resposta !== filtro.situacao)) continue

    const dados = perfil.dados && typeof perfil.dados === 'object' && !Array.isArray(perfil.dados)
      ? perfil.dados as Record<string, unknown>
      : {}
    const nome = typeof dados.nome === 'string' && dados.nome.trim()
      ? dados.nome.trim()
      : 'Nome não informado'
    const correspondencias = correspondenciasProduto.map(({ produto, estado, resposta }) => ({
      produto,
      produtoNome: PRODUTOS_ESSENCIAIS[produto],
      criancaId: perfil.id,
      criancaNome: nome,
      fase,
      faseLabel: faseLabels.get(fase) ?? 'Fase não informada',
      resposta,
      registradoEm: estado?.registrado_em ?? null,
    }))
    porCliente.set(vinculo.cliente_id, [...(porCliente.get(vinculo.cliente_id) ?? []), ...correspondencias])
  }

  return porCliente
}
