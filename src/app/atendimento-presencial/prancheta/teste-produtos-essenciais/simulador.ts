import type { AtendimentoPresencialDTO, ContextoAtendimento } from '@/lib/atendimento-presencial/rascunhos-shared'
import type { ClientePresencialDTO } from '@/lib/atendimento-presencial/clientes'
import type { FichaCriancaRascunho, FichaDadosRascunho } from '@/lib/atendimento-presencial/ficha-schema'
import { dataAtendimentoLocal } from '@/lib/atendimento-presencial/idade-aproximada'

export const ID = { usuario: '00000000-0000-4000-8000-000000000001', unidade: '00000000-0000-4000-8000-000000000002', cliente: '00000000-0000-4000-8000-000000000003' }
export const CONTEXTO: ContextoAtendimento = { usuarioId: ID.usuario, perfil: 'gestao', acessoTotal: false, unidadesPermitidas: [
  { id: ID.unidade, chave: 'demonstracao', nome: 'FILIAL DEMONSTRAÇÃO' },
  { id: '00000000-0000-4000-8000-000000000004', chave: 'segunda', nome: 'SEGUNDA FILIAL FICTÍCIA' },
] }
export function criarStorageMemoria(): Storage {
  const itens = new Map<string, string>()
  return { get length() { return itens.size }, key: i => [...itens.keys()][i] ?? null, getItem: k => itens.get(k) ?? null,
    setItem: (k, v) => { itens.set(k, v) }, removeItem: k => { itens.delete(k) }, clear: () => itens.clear() }
}
export function criarCrianca(meses: number | null, indice = 1): FichaCriancaRascunho {
  const hoje = dataAtendimentoLocal()
  const [ano, mes] = hoje.split('-').map(Number)
  const referencia = meses === null || meses < 0 ? undefined : new Date(Date.UTC(ano, mes - 1 - meses, 1, 12)).toISOString().slice(0, 10)
  return { id: `crianca-demo-${indice}`, criancaPermanenteId: `50000000-0000-4000-8000-${String(indice).padStart(12, '0')}`, vinculoClienteId: ID.cliente,
    nome: indice === 1 ? 'BEBÊ DEMONSTRAÇÃO' : 'SEGUNDA CRIANÇA', parentesco: 'Mãe', sexo: 'nao_informado',
    situacao: meses === null ? 'nao_informado' : meses < 0 ? 'gestacao' : 'ja_nasceu', dataReferenciaNascimento: referencia,
    ...(meses !== null && meses >= 0 ? { idadeUnidade: meses >= 12 ? 'anos' as const : 'meses' as const, idadeValor: meses >= 12 ? Math.floor(meses / 12) : Math.max(1, meses) } : {}) }
}
export function criarSimulador() {
  const agora = new Date().toISOString()
  let cliente: ClientePresencialDTO = { id: ID.cliente, nome: 'CLIENTE DEMONSTRAÇÃO', telefone: null, telefoneFormatado: null,
    parentesco: 'outro', parentescoLabel: 'Não informado', parentescoOutro: 'Não informado', status: 'ativo', version: 1,
    origem: { consultoraNome: null, consultoraUsuarioId: null, unidadeId: null, atendimentoId: null }, criadoEm: agora, atualizadoEm: agora }
  const rascunhos = new Map<string, AtendimentoPresencialDTO>()
  const operacoes: { metodo: string; caminho: string }[] = []
  let atual: AtendimentoPresencialDTO
  let aoNovoAtendimento: (() => void) | undefined
  function preparar(criancas = [criarCrianca(-1)], unidade = ID.unidade) {
    const dados: FichaDadosRascunho = { versaoFluxo: 2, versaoProdutos: 2, tipoAtendimento: 'cliente', consultoraNome: 'CONSULTORA DEMONSTRAÇÃO',
      criancas, departamentos: ['moveis'], produtosInteresse: [], motivosResultado: [], etapaAtual: 'ficha' }
    atual = { id: crypto.randomUUID(), clienteId: cliente.id, consultoraUsuarioId: ID.usuario, unidadeId: unidade, status: 'rascunho', draftClientId: crypto.randomUUID(),
      dadosRascunho: dados, resultadoAtendimento: null, motivoOutro: null, observacoes: null, numeroLancamento: null, concluidoEm: null,
      iniciadoEm: agora, ultimaAtividadeEm: agora, expiraEm: '2099-01-01T00:00:00.000Z', version: 1, criadoPor: ID.usuario, atualizadoPor: ID.usuario,
      createdAt: agora, updatedAt: agora, expirado: false }
    rascunhos.set(atual.id, atual)
    return atual
  }
  preparar()
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const fetchSimulado = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    if (init.signal?.aborted) throw new DOMException('Operação cancelada', 'AbortError')
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://laboratorio.invalid')
    const metodo = init.method ?? 'GET'
    const caminho = url.pathname
    operacoes.push({ metodo, caminho })
    // Lista fechada: nenhuma chamada desconhecida é encaminhada à rede.
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
    if (caminho === '/api/atendimento-presencial/consultoras-recentes') return json({ ok: true, nomes: ['CONSULTORA DEMONSTRAÇÃO'] })
    if (caminho === '/api/atendimento-presencial/clientes') {
      if (metodo === 'POST') cliente = { ...cliente, nome: body.nome, telefone: body.telefone ?? null, version: cliente.version + 1 }
      return json({ ok: true, cliente, clientes: url.searchParams.has('telefoneExato') ? [] : [cliente], ambiguo: false })
    }
    if (caminho === `/api/atendimento-presencial/clientes/${cliente.id}`) {
      if (metodo === 'PATCH') cliente = { ...cliente, ...(body.nome ? { nome: body.nome } : {}), ...(body.telefone !== undefined ? { telefone: body.telefone, telefoneFormatado: body.telefone } : {}), version: cliente.version + 1 }
      return json({ ok: true, cliente })
    }
    if (caminho === `/api/atendimento-presencial/clientes/${cliente.id}/criancas`) {
      const r = rascunhos.get(body.rascunhoId ?? url.searchParams.get('rascunhoId'))
      return json({ ok: true, permanentes: (r?.dadosRascunho.criancas ?? []).map(c => ({ id: c.criancaPermanenteId ?? c.id, clienteId: cliente.id, origem: 'permanente', parentesco: c.parentesco, dados: c, registradoEm: agora })), historicas: [] })
    }
    if (caminho === `/api/atendimento-presencial/clientes/${cliente.id}/historico`) return json({ ok: true, telefoneDisponivel: !!cliente.telefone, atendimentos: [], pedidosPersonalizados: [], vendas: [], fontesConsultadas: ['Dados fictícios do laboratório'] })
    if (caminho === '/api/atendimento-presencial/atendimentos/rascunhos' && metodo === 'POST') {
      const r = preparar([], body.unidadeId); r.dadosRascunho = body.dadosRascunho; r.clienteId = body.clienteId; r.draftClientId = body.draftClientId
      aoNovoAtendimento?.()
      return json({ ok: true, rascunho: r })
    }
    const match = caminho.match(/^\/api\/atendimento-presencial\/atendimentos\/([^/]+)\/(rascunho|concluir)$/)
    const r = match && rascunhos.get(match[1])
    if (!r) return json({ ok: false, message: `Operação não simulada: ${metodo} ${caminho}` }, 400)
    if (metodo === 'GET') return json({ ok: true, rascunho: r })
    if (body.version !== r.version) return json({ ok: false, message: 'Conflito simulado de versão', rascunho: r }, 409)
    if (match[2] === 'rascunho') { r.dadosRascunho = body.dadosRascunho; r.clienteId = body.clienteId; r.version++; return json({ ok: true, rascunho: r }) }
    r.status = 'concluido'; r.concluidoEm = new Date().toISOString(); r.numeroLancamento = body.numeroLancamento ?? null
    return json({ ok: true, atendimento: r })
  }
  return { preparar, fetch: fetchSimulado, storage: criarStorageMemoria(), operacoes, definirAoNovoAtendimento: (callback?: () => void) => { aoNovoAtendimento = callback }, get atual() { return atual } }
}
export type Simulador = ReturnType<typeof criarSimulador>
