import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executarApiDecorisi, type DependenciasDecorisi } from './decorisi-handlers'
import type { ContextoPedidosPersonalizados } from './contexto'
import type { RepositorioDecorisi } from './decorisi-repositorio'
vi.mock('./contexto', () => ({ carregarContextoPedidosPersonalizados: vi.fn() }))

const usuario = '10000000-0000-4000-8000-000000000001', pedido = '20000000-0000-4000-8000-000000000001'
const unidade = '30000000-0000-4000-8000-000000000001'
const repo = {
  disponivel: vi.fn(), precos: vi.fn(), referencias: vi.fn(), pedido: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), cotar: vi.fn(), fechar: vi.fn(),
}
let contexto: ContextoPedidosPersonalizados
let deps: DependenciasDecorisi
function request(corpo?: unknown, url = 'https://app.test/api/pedidos-personalizados/decorisi/pedidos') {
  return new Request(url, corpo === undefined ? undefined : { method: 'POST', body: JSON.stringify(corpo) })
}
const itens = [{ tipo: 'PAPEL', classificacao: 'CATALOGO', referencia: 'DB813', medidas: [{ larguraCm: 350, alturaCm: 270 }] }]
beforeEach(() => {
  vi.resetAllMocks()
  contexto = { supabase: {} as never, allowedUser: { id: usuario, email: 'tecnico@example.test', role: 'user', ativo: true }, moduloAutorizado: 'pedidos_personalizados_gestao', unidades: [{ id: unidade, chave: 'bigorrilho', nome: 'Bigorrilho', nomeExibicao: 'BIGORRILHO' }] }
  deps = { habilitado: () => true, carregarContexto: vi.fn(async () => ({ ok: true as const, contexto })), criarRepositorio: () => repo as unknown as RepositorioDecorisi }
  repo.disponivel.mockResolvedValue({ data: { id: 'fornecedor' }, error: null })
  repo.pedido.mockResolvedValue({ data: { id: pedido, created_by: usuario, version: 1, status: 'RASCUNHO' }, error: null })
})
describe('Decorisi backend: autorização e validação', () => {
  it('consulta disponibilidade para o ator autenticado, sem aceitar identidade do payload', async () => {
    await executarApiDecorisi(request(undefined, 'https://app.test/api/pedidos-personalizados/decorisi/opcoes'), 'opcoes', undefined, deps)
    expect(repo.disponivel).toHaveBeenCalledWith(usuario)
  })
  it('opções carregam referências, PF e preços dinâmicos somente no escopo autorizado', async () => {
    repo.referencias.mockResolvedValue({data:[{referencia:'DB813',repeticao_m:'0.00'}],error:null})
    repo.precos.mockResolvedValue({data:[{produto_id_sgi:36565,preco:'123.45'}],error:null})
    const r=await executarApiDecorisi(request(),'opcoes',undefined,deps)
    const dados=await r.json();expect(r.status).toBe(200);expect(dados.pf).toHaveLength(81);expect(dados.db).toHaveLength(1);expect(dados.precos[0].preco).toBe('123.45');expect(dados.unidades[0].id).toBe(unidade)
  })
  it('gate desligado não autentica, consulta ou grava', async () => {
    deps.habilitado = () => false
    expect((await executarApiDecorisi(request(), 'referencias', undefined, deps)).status).toBe(404)
    expect(deps.carregarContexto).not.toHaveBeenCalled()
    expect(repo.disponivel).not.toHaveBeenCalled()
  })
  it.each([401, 403])('preserva bloqueio de autenticação, módulo ou janela %i', async (status) => {
    deps.carregarContexto = vi.fn(async () => ({ ok: false as const, response: new Response(null, { status }) }))
    expect((await executarApiDecorisi(request(), 'cotar', pedido, deps)).status).toBe(status)
    expect(repo.pedido).not.toHaveBeenCalled()
  })
  it('não libera fornecedor desativado mesmo com flag habilitado', async () => {
    repo.disponivel.mockResolvedValue({ data: null, error: null })
    expect((await executarApiDecorisi(request(), 'criar', undefined, deps)).status).toBe(404)
    expect(repo.criar).not.toHaveBeenCalled()
  })
  it('aplica escopo de unidade na consulta e oculta pedido de outro criador', async () => {
    contexto.moduloAutorizado = 'pedidos_personalizados_novo'
    repo.pedido.mockResolvedValue({ data: { created_by: 'outro' }, error: null })
    expect((await executarApiDecorisi(request(), 'cotar', pedido, deps)).status).toBe(404)
    expect(repo.pedido).toHaveBeenCalledWith(pedido, [unidade])
    expect(repo.cotar).not.toHaveBeenCalled()
  })
  it('nega criação em unidade não autorizada', async () => {
    expect((await executarApiDecorisi(request({ unidade: 'portao' }), 'criar', undefined, deps)).status).toBe(403)
    expect(repo.criar).not.toHaveBeenCalled()
  })
  it('normaliza medidas e telefone, não aceita preço/quantidade do cliente como autoridade', async () => {
    repo.criar.mockResolvedValue({ data: { pedidoId: pedido, version: 1 }, error: null })
    const corpo = { unidade: 'bigorrilho', idempotencyKey: pedido, consultora: ' Teste ', cliente: ' Cliente ', telefone: '(41) 99999-9999', itens: itens.map((i) => ({ ...i, preco: 0.01, quantidade: 1, produtoIdSgi: 39744, produto_id: 'outro', snapshot_comercial: { preco: '0.01' } })) }
    expect((await executarApiDecorisi(request(corpo), 'criar', undefined, deps)).status).toBe(201)
    expect(repo.criar.mock.calls[0][0]).toMatchObject({ p_usuario_id: usuario, p_telefone_normalizado: '41999999999', p_consultora: 'Teste' })
    expect(repo.criar.mock.calls[0][0].p_itens[0]).not.toHaveProperty('preco')
    expect(repo.criar.mock.calls[0][0].p_itens[0]).not.toHaveProperty('quantidade')
    expect(repo.criar.mock.calls[0][0].p_itens[0]).not.toHaveProperty('produtoIdSgi')
    expect(repo.criar.mock.calls[0][0].p_itens[0]).not.toHaveProperty('produto_id')
    expect(repo.criar.mock.calls[0][0].p_itens[0]).not.toHaveProperty('snapshot_comercial')
  })
  it('cotação alterada devolve 409 e a nova cotação para confirmação', async () => {
    const nova = { totalCentavos: '2000' }
    repo.fechar.mockResolvedValue({ data: { ok: false, erro: 'COTACAO_ALTERADA', cotacao: nova }, error: null })
    const response = await executarApiDecorisi(request({ expectedVersion: 1, numeroLancamento: '123', cotacaoConfirmada: { totalCentavos: '1000' } }), 'fechar', pedido, deps)
    expect(response.status).toBe(409)
    expect((await response.json()).cotacao).toEqual(nova)
  })
  it('versão conflitante preserva HTTP 409', async () => {
    repo.atualizar.mockResolvedValue({ error: { code: 'P0003', message: 'CONFLITO_VERSAO' }, data: null })
    expect((await executarApiDecorisi(request({ expectedVersion: 1, itens }), 'atualizar', pedido, deps)).status).toBe(409)
  })
  it('repasse de cotação usa somente pedido e usuário autorizados', async () => {
    repo.cotar.mockResolvedValue({ data: { completa: true, totalCentavos: '2000' }, error: null })
    const response=await executarApiDecorisi(request(), 'cotar', pedido, deps)
    expect(response.status).toBe(200)
    expect(repo.cotar).toHaveBeenCalledWith(pedido,usuario)
  })
  it('pesquisa PF parcial e rejeita curingas SQL na consulta DB', async () => {
    repo.referencias.mockResolvedValue({ data: [], error: null })
    const response=await executarApiDecorisi(request(undefined,'https://app.test/api?q=280'),'referencias',undefined,deps)
    expect((await response.json()).pf).toEqual(['PF280'])
    const invalid=await executarApiDecorisi(request(undefined,'https://app.test/api?q=%25'),'referencias',undefined,deps)
    expect(invalid.status).toBe(422)
    expect(repo.referencias).toHaveBeenCalledTimes(1)
  })
})
