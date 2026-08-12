import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  atualizarAdministrativoGestao,
  atualizarComercialGestao,
  detalheParaAdministrativo,
  detalheParaFormulario,
  listarPedidosGestao,
  payloadAtualizacaoAdministrativa,
  payloadAtualizacaoComercial,
  gerarResumoFornecedorDetalhe,
  requisitosPendentesTransicao,
  validarAdministrativo,
} from './gestao-modelo'
import type { OpcoesNovoPedido } from './novo-pedido-modelo'
import type { PedidoDetalhe } from './gestao-modelo'

const PEDIDO = '10000000-0000-4000-8000-000000000001'
const TAPETE = '20000000-0000-4000-8000-000000000001'
const COR = '30000000-0000-4000-8000-000000000001'

const detalhe: PedidoDetalhe = {
  historico: [],
  id: PEDIDO,
  fornecedor: { chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' },
  unidade: { chave: 'portao', nome: 'PORTÃO' },
  consultora: 'ANA', cliente: 'CLIENTE', telefone: '41999999999', numeroLancamento: '000001',
  dataEntrega: null, dataPedidoFornecedor: null, numeroPedidoCompra: null, comprador: null,
  status: 'CADASTRADO', version: 4, createdAt: '2026-08-06T10:00:00Z', updatedAt: '2026-08-06T10:00:00Z',
  tapetes: [{
    id: TAPETE, ordem: 1, formato: 'RETANGULAR', tipo: 'PERSONALIZADO', dimensao1Cm: 200, dimensao2Cm: 300,
    areaCobradaCentesimosM2: 600, produto: { id: 'p', codigo: '21158', descricao: 'Produto' },
    nomeColecaoCatalogo: 'COLECAO', referenciaCatalogo: 'REF-1', observacoes: 'Teste',
    teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 2,
    cores: [{ id: COR, ordem: 1, numero: '01', codigo: 'K-01', nome: 'Grafite' }], anexos: [],
  }],
}

const opcoes = {
  fornecedor: { id: 'f', chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' },
  unidades: [{ chave: 'portao', nome: 'PORTÃO' }],
  produtos: [{ id: 'p', codigo: '21158', descricao: 'Produto' }],
  cores: [{ id: COR, numero: '01', codigo: 'K-01', nome: 'Grafite', ordem: 1 }],
  formatos: ['RETANGULAR'], status: ['CADASTRADO'],
  limites: { tapetesPorPedido: 10, coresPorTapete: 6, medidaMinimaCm: 10, medidaMaximaCm: 1500 },
} as OpcoesNovoPedido

describe('modelo da gestão de pedidos personalizados', () => {
  it('converte detalhe sem perder IDs, ordem, medidas, cores e anexos', () => {
    const formulario = detalheParaFormulario(detalhe)
    expect(formulario).toMatchObject({ unidade: 'portao', consultora: 'ANA', cliente: 'CLIENTE' })
    expect(formulario.tapetes[0]).toMatchObject({ tapeteId: TAPETE, dimensao1Metros: '2,00', dimensao2Metros: '3,00', corIds: [COR] })
  })

  it('reabre o pedido com o Tipo persistido como fonte de verdade, não com base em cores.length', () => {
    const detalheCatalogo: PedidoDetalhe = {
      ...detalhe,
      tapetes: [{ ...detalhe.tapetes[0], tipo: 'CATALOGO', cores: [] }],
    }
    expect(detalheParaFormulario(detalheCatalogo).tapetes[0].tipo).toBe('CATALOGO')
    expect(detalheParaFormulario(detalhe).tapetes[0].tipo).toBe('PERSONALIZADO')
  })

  it('deriva a classificação guiada do Tipo persistido, sem exigir nova resposta ao reabrir um pedido salvo', () => {
    const detalheCatalogo: PedidoDetalhe = {
      ...detalhe,
      tapetes: [{ ...detalhe.tapetes[0], tipo: 'CATALOGO', cores: [] }],
    }
    expect(detalheParaFormulario(detalheCatalogo).tapetes[0]).toMatchObject({ existeNoCatalogo: true, identicoReferencia: true })
  })

  it('deriva "existe no catálogo = Sim, terá alterações" (cenário 3) para um Personalizado legado com coleção/referência já preenchidas', () => {
    // `detalhe` já tem tipo PERSONALIZADO com nomeColecaoCatalogo/referenciaCatalogo preenchidos.
    expect(detalheParaFormulario(detalhe).tapetes[0]).toMatchObject({ existeNoCatalogo: true, identicoReferencia: false })
  })

  it('deriva "não está no catálogo" para um Personalizado legado sem nenhum dado de catálogo', () => {
    const detalheSemCatalogo: PedidoDetalhe = {
      ...detalhe,
      tapetes: [{ ...detalhe.tapetes[0], nomeColecaoCatalogo: null, referenciaCatalogo: null }],
    }
    expect(detalheParaFormulario(detalheSemCatalogo).tapetes[0]).toMatchObject({ existeNoCatalogo: false, identicoReferencia: null })
  })

  it('valida antecipadamente os requisitos de cada transicao', () => {
    const base = { destino: 'AGUARDANDO LAYOUT' as const, numeroPedidoCompra: '', dataPedidoFornecedor: '', comprador: '', dataEntrega: '', dataRecebimento: '', justificativa: '' }
    expect(requisitosPendentesTransicao(detalhe, base)).toHaveLength(3)
    expect(requisitosPendentesTransicao(detalhe, { ...base, numeroPedidoCompra: '00123', dataPedidoFornecedor: '2026-08-07', comprador: 'ANA' })).toEqual([])
    expect(requisitosPendentesTransicao({ ...detalhe, status: 'AGUARDANDO LAYOUT' }, { ...base, destino: 'AGUARDANDO APROVAÇÃO DO CLIENTE' })).toHaveLength(1)
    const comAnexo = { ...detalhe, status: 'AGUARDANDO APROVAÇÃO DO CLIENTE' as const, tapetes: [{ ...detalhe.tapetes[0], anexos: [{ anexoId: 'a', slot: 1 as const, nomeOriginal: 'a.pdf', mime: 'application/pdf', tamanho: 1, createdAt: null }] }] }
    expect(requisitosPendentesTransicao(comAnexo, { ...base, destino: 'EM PRODUÇÃO' })).toHaveLength(1)
    expect(requisitosPendentesTransicao(comAnexo, { ...base, destino: 'EM PRODUÇÃO', dataEntrega: '2026-08-20' })).toEqual([])
    expect(requisitosPendentesTransicao({ ...detalhe, status: 'EM PRODUÇÃO' }, { ...base, destino: 'RECEBIDO' })).toHaveLength(1)
  })

  it('monta atualização comercial com expectedVersion e IDs persistidos', () => {
    const payload = payloadAtualizacaoComercial(detalheParaFormulario(detalhe), 4, opcoes)
    expect(payload).toMatchObject({ expectedVersion: 4, unidade: 'portao', telefone: '41999999999', numeroLancamento: '000001', tapetes: [{ id: TAPETE, ordem: 1 }] })
    expect(JSON.stringify(payload)).not.toMatch(/dataEntrega|comprador|status/)
  })

  it('gera o resumo persistido pelo helper aprovado sem telefone, IDs, anexos ou controle técnico', () => {
    const resumo = gerarResumoFornecedorDetalhe(detalhe) ?? ''
    expect(resumo).toContain('UNIDADE: PORTÃO')
    expect(resumo).toContain('TAPETE 1')
    expect(resumo).toContain('01 - K-01 - Grafite')
    expect(resumo).not.toContain(detalhe.telefone ?? '')
    expect(resumo).not.toContain(PEDIDO)
    expect(resumo).not.toMatch(/ANEXO|VERSÃO|ALTERAÇÃO DE LAYOUT/i)
  })

  it('serializa filtros e paginação na listagem', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, itens: [], pagina: 2, totalPaginas: 2, totalRegistros: 21, limite: 20 }), { status: 200 }))
    await listarPedidosGestao({
      cliente: 'Bebê', consultora: '', numeroLancamento: '000001', status: '', unidade: 'portao', dataInicial: '', dataFinal: '',
      dataPedidoFornecedorInicial: '2026-08-01', dataPedidoFornecedorFinal: '2026-08-15',
      dataEntregaInicial: '2026-08-20', dataEntregaFinal: '2026-08-31',
      situacaoPrazo: 'PRESTES A VENCER', tipoTapete: '',
    }, 2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('page=2')
    expect(String(fetchMock.mock.calls[0][0])).toContain('numeroLancamento=000001')
    expect(String(fetchMock.mock.calls[0][0])).toContain('dataPedidoFornecedorInicial=2026-08-01')
    expect(String(fetchMock.mock.calls[0][0])).toContain('dataEntregaFinal=2026-08-31')
    expect(String(fetchMock.mock.calls[0][0])).toContain('situacaoPrazo=PRESTES+A+VENCER')
    fetchMock.mockRestore()
  })

  it('usa PATCH e expectedVersion para atualização comercial', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, version: 5 }), { status: 200 }))
    const payload = payloadAtualizacaoComercial(detalheParaFormulario(detalhe), 4, opcoes)
    await expect(atualizarComercialGestao(PEDIDO, payload)).resolves.toBe(5)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ expectedVersion: 4 })
    fetchMock.mockRestore()
  })

  it('monta o formulário administrativo somente com os campos confirmados no schema', () => {
    const estado = detalheParaAdministrativo({
      ...detalhe,
      numeroLancamento: '000001',
      dataEntrega: '2026-08-20',
      dataPedidoFornecedor: '2026-08-07',
      numeroPedidoCompra: '00001',
      comprador: 'ANA SILVA',
    })
    expect(estado).toEqual({
      dataEntrega: '2026-08-20',
      dataPedidoFornecedor: '2026-08-07',
      numeroPedidoCompra: '00001',
      comprador: 'ANA SILVA',
    })
    expect(estado).not.toHaveProperty('numeroPedido')
    expect(estado).not.toHaveProperty('dataPedido')
  })

  it('valida limites e datas reais do contrato administrativo atual', () => {
    expect(validarAdministrativo({
      dataEntrega: '2028-02-29', dataPedidoFornecedor: '',
      numeroPedidoCompra: '00001', comprador: 'ANA MARIA',
    })).toEqual({})
    expect(validarAdministrativo({
      dataEntrega: '31/02/2026', dataPedidoFornecedor: '2026-08-07',
      numeroPedidoCompra: '1'.repeat(6), comprador: 'A1',
    })).toEqual({
      numeroPedidoCompra: expect.any(String),
      comprador: expect.any(String),
      dataEntrega: expect.any(String),
    })
  })

  it('rejeita data do pedido ao fornecedor futura na validação administrativa', () => {
    const erros = validarAdministrativo({
      dataEntrega: '2026-08-10', dataPedidoFornecedor: '2099-01-01',
      numeroPedidoCompra: '00001', comprador: 'ANA MARIA',
    })
    expect(erros.dataPedidoFornecedor).toContain('não pode ser futura')
  })

  it('bloqueia intervalos de filtro invertidos antes da requisição', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(listarPedidosGestao({
      cliente: '', consultora: '', numeroLancamento: '', status: '', unidade: '', dataInicial: '', dataFinal: '',
      dataPedidoFornecedorInicial: '2026-08-10', dataPedidoFornecedorFinal: '2026-08-01',
      dataEntregaInicial: '', dataEntregaFinal: '',
      situacaoPrazo: '', tipoTapete: '',
    }, 1)).rejects.toThrow('pedido ao fornecedor')
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('preserva zeros, status e layout atuais no payload administrativo atômico', () => {
    const payload = payloadAtualizacaoAdministrativa(detalhe, {
      dataEntrega: '', dataPedidoFornecedor: '2026-08-07',
      numeroPedidoCompra: '00012', comprador: ' ana  silva ',
    })
    expect(payload).toMatchObject({
      expectedVersion: 4,
      numeroPedidoCompra: '00012',
      comprador: 'ANA SILVA',
      status: 'CADASTRADO',
      layoutTapetes: [{ tapeteId: TAPETE, teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 2 }],
    })
    expect(payload).not.toHaveProperty('numeroPedido')
    expect(payload).not.toHaveProperty('numeroLancamento')
    expect(payload).not.toHaveProperty('dataPedido')
    expect(payload).not.toHaveProperty('createdAt')
  })

  it('usa somente a rota administrativa aprovada, PATCH e expectedVersion', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, version: 5 }), { status: 200 }))
    const payload = payloadAtualizacaoAdministrativa(detalhe, detalheParaAdministrativo(detalhe))
    await expect(atualizarAdministrativoGestao(PEDIDO, payload)).resolves.toBe(5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/pedidos-personalizados/pedidos/${PEDIDO}/administrativo`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ expectedVersion: 4, status: 'CADASTRADO' })
    fetchMock.mockRestore()
  })

  it.each([
    [401, 'Sua sessão expirou. Entre novamente.'],
    [403, 'Você não possui acesso à gestão de pedidos personalizados.'],
    [404, 'Pedido não encontrado ou fora do seu escopo.'],
    [409, 'Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.'],
  ])('traduz HTTP %s da atualização administrativa sem expor resposta técnica', async (status, mensagem) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ mensagem: 'select segredo' }), { status }))
    const payload = payloadAtualizacaoAdministrativa(detalhe, detalheParaAdministrativo(detalhe))
    await expect(atualizarAdministrativoGestao(PEDIDO, payload)).rejects.toThrow(mensagem)
    await expect(atualizarAdministrativoGestao(PEDIDO, payload)).rejects.not.toThrow('select segredo')
    fetchMock.mockRestore()
  })

  it('mantém detalhe/comercial responsivos e administração em modal separado', () => {
    const componente = readFileSync(path.resolve('src/components/pedidos-personalizados/GestaoPedidosPersonalizados.tsx'), 'utf8')
    const anexos = readFileSync(path.resolve('src/components/pedidos-personalizados/AnexosTapete.tsx'), 'utf8')
    expect(componente).toContain('lg:!w-[80vw]')
    expect(componente).toContain('sm:!w-[90vw]')
    expect(componente).toContain('overflow-x-hidden')
    expect(componente).toContain('Editar dados administrativos')
    expect(componente).toContain('Salvar dados administrativos')
    expect(componente).toContain('Pedido de compra')
    expect(componente).toContain('dataPedidoFornecedor')
    expect(componente).toContain('dataEntrega')
    expect(componente).toContain('type="date"')
    expect(componente).toContain('maxLength={5}')
    expect(componente).toContain('bg-gradient-to-r')
    expect(componente).toContain('classeStatus(item.status)')
    expect(componente).toContain('Resumo para o fornecedor')
    expect(componente).toContain('COPIAR RESUMO')
    expect(componente).toContain('CheckCircle2')
    expect(componente).toContain('mt-6 border-t border-slate-200 pt-5')
    expect(componente).not.toContain('Não disponível no schema')
    expect(componente).not.toMatch(/label="Número do pedido"/)
    expect(componente).not.toMatch(/label="Data do pedido"/)
    expect(anexos).toContain('CheckCircle2')
    expect(anexos).toContain('border-emerald-200')
    expect(componente).toContain('id="gestao-lancamento"')
    expect(componente).not.toContain('id="admin-lancamento"')
    expect(componente).toContain('pendenciasTransicao.length > 0')
    expect(componente).toContain('id="transicao-data-recebimento"')
    expect(componente).toContain('setFiltrosAplicados({ ...filtros })')
    expect(componente).toContain('sm:h-[90vh]')
  })

  it('protege a página de gestão sem adicionar item ao menu', () => {
    const page = readFileSync(path.resolve('src/app/pedidos-personalizados/page.tsx'), 'utf8')
    const catalogo = readFileSync(path.resolve('src/lib/auth/modulos-app.ts'), 'utf8')
    const menu = catalogo.slice(catalogo.indexOf('export const NAVIGATION_GROUPS'), catalogo.indexOf('export const PROFILE_CONTROLLED_MODULE_KEYS'))
    expect(page).toContain("checkModuleAndWindowAccess('pedidos_personalizados_gestao')")
    expect(menu).not.toContain("navigationItem('pedidos_personalizados_gestao'")
  })
})
