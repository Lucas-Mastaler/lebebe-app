import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  adicionarTapete,
  alterarFormatoTapete,
  alternarCor,
  associarTapetesCriados,
  avaliarFormulario,
  carregarOpcoesNovoPedido,
  criarEstadoInicial,
  deveAvisarDadosNaoSalvos,
  enviarNovoPedido,
  enviarAnexo,
  enviarAnexoGestao,
  filtrarCores,
  gerarIdempotencyKey,
  montarPayloadCriacao,
  moverItem,
  removerTapete,
  removerAnexoApi,
  removerAnexoGestaoApi,
  resumirTapete,
  solicitarUrlAnexo,
  substituirAnexo,
  substituirAnexoGestao,
  validarArquivoAnexo,
} from './novo-pedido-modelo'
import type { CorOpcao, EstadoNovoPedido, OpcoesNovoPedido, ProdutoOpcao } from './novo-pedido-modelo'

const produtos: ProdutoOpcao[] = [
  { id: '10000000-0000-4000-8000-000000000001', codigo: '21157', descricao: 'Produto 21157' },
  { id: '10000000-0000-4000-8000-000000000002', codigo: '21158', descricao: 'Produto 21158' },
  { id: '10000000-0000-4000-8000-000000000003', codigo: '21159', descricao: 'Produto 21159' },
]

const cores: CorOpcao[] = Array.from({ length: 31 }, (_, indice) => ({
  id: `20000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
  numero: String(indice + 1).padStart(2, '0'),
  codigo: indice === 0 ? 'K-01' : `K-${String(indice + 1).padStart(2, '0')}`,
  nome: indice === 0 ? 'Índigo' : `Cor ${indice + 1}`,
  ordem: indice + 1,
}))

const opcoes: OpcoesNovoPedido = {
  fornecedor: { id: '30000000-0000-4000-8000-000000000001', chave: 'moriah_tapetes', nome: 'MORIAH TAPETES' },
  unidades: [
    { chave: 'bigorrilho', nome: 'BIGORRILHO' },
    { chave: 'portao', nome: 'PORTÃO' },
    { chave: 'marechal', nome: 'MARECHAL' },
    { chave: 'feira', nome: 'FEIRA' },
  ],
  produtos,
  cores,
  formatos: ['REDONDO', 'RETANGULAR', 'ORGANICO'],
  limites: { tapetesPorPedido: 10, coresPorTapete: 6, medidaMinimaCm: 10, medidaMaximaCm: 1500 },
}

function estadoValido(): EstadoNovoPedido {
  const estado = criarEstadoInicial('local-1')
  return {
    ...estado,
    unidade: 'portao',
    consultora: 'Ana Maria',
    cliente: 'Cliente Teste',
    telefone: '(41) 99999-9999',
    numeroLancamento: '000123',
    tapetes: [{
      ...estado.tapetes[0],
      dimensao1Metros: '2,00',
      dimensao2Metros: '3.00',
      corIds: [cores[0].id],
      nomeColecaoCatalogo: ' coleção bebê ',
      referenciaCatalogo: 'ref-01',
      observacoes: 'Linha 1\nLinha 2',
    }],
  }
}

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const PEDIDO_ID = '40000000-0000-4000-8000-000000000010'
const TAPETE_ID = '50000000-0000-4000-8000-000000000010'
const ANEXO_ID = '60000000-0000-4000-8000-000000000010'
const TAPETES_CRIADOS = [{ id: TAPETE_ID, ordem: 1 }]

describe('estado do formulário de novo pedido', () => {
  it('inicia com um tapete e campos vazios', () => {
    const estado = criarEstadoInicial('local-1')
    expect(estado.tapetes).toHaveLength(1)
    expect(estado.unidade).toBe('')
    expect(estado.tapetes[0].anexosLocais).toEqual([])
  })

  it('adiciona até dez tapetes e rejeita o décimo primeiro', () => {
    let estado = criarEstadoInicial('local-1')
    for (let indice = 2; indice <= 11; indice += 1) estado = adicionarTapete(estado, `local-${indice}`)
    expect(estado.tapetes).toHaveLength(10)
    expect(adicionarTapete(estado, 'local-12')).toBe(estado)
  })

  it('remove um tapete, mas nunca remove o último', () => {
    const um = criarEstadoInicial('local-1')
    expect(removerTapete(um, 'local-1')).toBe(um)
    const dois = adicionarTapete(um, 'local-2')
    expect(removerTapete(dois, 'local-1').tapetes.map((item) => item.chaveLocal)).toEqual(['local-2'])
  })

  it('reordena sem usar o índice como identidade', () => {
    expect(moverItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moverItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('preserva a ordem quando o movimento sai dos limites', () => {
    expect(moverItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })

  it('limpa a segunda dimensão ao trocar para redondo', () => {
    const tapete = { ...criarEstadoInicial('x').tapetes[0], dimensao2Metros: '2,00' }
    expect(alterarFormatoTapete(tapete, 'REDONDO').dimensao2Metros).toBe('')
  })
})

describe('cores do formulário', () => {
  it.each([0, 1, 6])('mantém %i cores selecionadas', (quantidade) => {
    let tapete = criarEstadoInicial('x').tapetes[0]
    for (const cor of cores.slice(0, quantidade)) tapete = alternarCor(tapete, cor.id)
    expect(tapete.corIds).toHaveLength(quantidade)
  })

  it('rejeita a sétima cor', () => {
    let tapete = criarEstadoInicial('x').tapetes[0]
    for (const cor of cores.slice(0, 7)) tapete = alternarCor(tapete, cor.id)
    expect(tapete.corIds).toEqual(cores.slice(0, 6).map((cor) => cor.id))
  })

  it('não duplica e remove uma cor já selecionada', () => {
    const tapete = criarEstadoInicial('x').tapetes[0]
    const comCor = alternarCor(tapete, cores[0].id)
    expect(alternarCor(comCor, cores[0].id).corIds).toEqual([])
  })

  it('busca por número, código e nome sem depender de acento', () => {
    expect(filtrarCores(cores, '01')).toContainEqual(cores[0])
    expect(filtrarCores(cores, 'K-01')).toContainEqual(cores[0])
    expect(filtrarCores(cores, 'indigo')).toEqual([cores[0]])
  })
})

describe('medidas, área e produto exibidos', () => {
  it('calcula retangular e classifica o caso geral como 21158', () => {
    const tapete = { ...criarEstadoInicial('x').tapetes[0], dimensao1Metros: '2,00', dimensao2Metros: '3,00' }
    expect(resumirTapete(tapete, produtos)).toMatchObject({ valido: true, area: '6,00 m²', codigoProduto: '21158' })
  })

  it('prioriza 95 cm e 195 cm como 21157', () => {
    const base = criarEstadoInicial('x').tapetes[0]
    expect(resumirTapete({ ...base, dimensao1Metros: '0,95', dimensao2Metros: '2,00' }, produtos).codigoProduto).toBe('21157')
    expect(resumirTapete({ ...base, dimensao1Metros: '1,95', dimensao2Metros: '2,00' }, produtos).codigoProduto).toBe('21157')
  })

  it('classifica duas medidas acima de 2 m como 21159', () => {
    const tapete = { ...criarEstadoInicial('x').tapetes[0], dimensao1Metros: '2,01', dimensao2Metros: '2,05' }
    expect(resumirTapete(tapete, produtos)).toMatchObject({ codigoProduto: '21159', avisoMedida: true })
  })

  it('mantém redondo fora do 21159', () => {
    const tapete = { ...criarEstadoInicial('x').tapetes[0], formato: 'REDONDO' as const, dimensao1Metros: '3,00' }
    expect(resumirTapete(tapete, produtos).codigoProduto).toBe('21158')
  })

  it('rejeita medida inválida', () => {
    expect(resumirTapete(criarEstadoInicial('x').tapetes[0], produtos).valido).toBe(false)
  })
})

describe('validação, mensagem e payload', () => {
  it('usa o domínio para normalizar identificação e opcionais', () => {
    const avaliacao = avaliarFormulario(estadoValido(), opcoes)
    expect(avaliacao.validacao.dados).toMatchObject({ consultora: 'ANA MARIA', cliente: 'CLIENTE TESTE', telefoneNormalizado: '41999999999', numeroLancamento: '000123' })
  })

  it('gera mensagem com PORTÃO, vários campos e sem administrativos ou anexos', () => {
    const mensagem = avaliarFormulario(estadoValido(), opcoes).mensagem ?? ''
    expect(mensagem).toContain('UNIDADE: PORTÃO')
    expect(mensagem).toContain('TAPETE 1')
    expect(mensagem).not.toMatch(/ANEXO|COMPRADOR|STATUS|DATA/)
  })

  it('preserva quebra de linha das observações', () => {
    expect(avaliarFormulario(estadoValido(), opcoes).mensagem).toContain('Linha 1\nLinha 2')
  })

  it('bloqueia unidade, consultora, cliente e medidas ausentes', () => {
    const resultado = avaliarFormulario(criarEstadoInicial('x'), opcoes).validacao
    expect(resultado.valido).toBe(false)
    expect(resultado.erros.map((item) => item.campo)).toEqual(expect.arrayContaining(['unidade', 'consultora', 'cliente', 'telefone', 'tapetes.0.dimensao1Metros']))
  })

  it('monta payload com idempotência e sem campos calculados ou fornecedor', () => {
    const payload = montarPayloadCriacao(estadoValido(), '40000000-0000-4000-8000-000000000001', opcoes)
    expect(payload).toMatchObject({ idempotencyKey: '40000000-0000-4000-8000-000000000001', telefone: '(41) 99999-9999', numeroLancamento: '000123' })
    expect(JSON.stringify(payload)).not.toMatch(/area|produto|fornecedor|descricao/i)
  })
})

describe('cliente HTTP da tela', () => {
  it('carrega três produtos, 31 cores, quatro unidades e nenhuma pos_venda', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ ok: true, ...opcoes }))
    const resultado = await carregarOpcoesNovoPedido(fetcher)
    expect(resultado.produtos).toHaveLength(3)
    expect(resultado.cores).toHaveLength(31)
    expect(resultado.unidades.map((item) => item.chave)).not.toContain('pos_venda')
  })

  it.each([
    [401, 'Sua sessão expirou'],
    [403, 'Você não possui permissão'],
    [500, 'Não foi possível concluir'],
  ])('mapeia erro HTTP %i sem expor corpo técnico', async (status, trecho) => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ stack: 'segredo', erro: 'ERRO_TESTE' }, status))
    await expect(carregarOpcoesNovoPedido(fetcher)).rejects.toMatchObject({ status, mensagem: expect.stringContaining(trecho) })
  })

  it('rejeita catálogo incompleto', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ ok: true, ...opcoes, cores: cores.slice(0, 30) }))
    await expect(carregarOpcoesNovoPedido(fetcher)).rejects.toMatchObject({ codigo: 'CATALOGO_INCOMPATIVEL' })
  })

  it('envia criação uma vez e interpreta sucesso', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ ok: true, pedidoId: PEDIDO_ID, version: 1, status: 'CADASTRADO', quantidadeTapetes: 1, reutilizado: false, tapetes: TAPETES_CRIADOS }, 201))
    const payload = montarPayloadCriacao(estadoValido(), '40000000-0000-4000-8000-000000000001', opcoes)
    await expect(enviarNovoPedido(payload, fetcher)).resolves.toMatchObject({ pedidoId: PEDIDO_ID, version: 1, tapetes: TAPETES_CRIADOS })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('permite retry com a mesma idempotencyKey', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(responseJson({ erro: 'TEMPORARIO' }, 503))
      .mockResolvedValueOnce(responseJson({ ok: true, pedidoId: PEDIDO_ID, version: 1, status: 'CADASTRADO', quantidadeTapetes: 1, reutilizado: true, tapetes: TAPETES_CRIADOS }))
    const payload = montarPayloadCriacao(estadoValido(), '40000000-0000-4000-8000-000000000001', opcoes)
    await expect(enviarNovoPedido(payload, fetcher)).rejects.toMatchObject({ status: 503 })
    await enviarNovoPedido(payload, fetcher)
    const corpos = fetcher.mock.calls.map((chamada) => JSON.parse(chamada[1].body))
    expect(corpos.map((corpo) => corpo.idempotencyKey)).toEqual([payload.idempotencyKey, payload.idempotencyKey])
  })

  it('mapeia conflito de versão com mensagem aprovada', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ erro: 'CONFLITO_VERSAO' }, 409))
    await expect(enviarNovoPedido(montarPayloadCriacao(estadoValido(), '40000000-0000-4000-8000-000000000001', opcoes), fetcher)).rejects.toMatchObject({
      codigo: 'CONFLITO_VERSAO',
      mensagem: 'Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.',
    })
  })

  it('rejeita criação sem IDs seguros ou com quantidade divergente', async () => {
    const payload = montarPayloadCriacao(estadoValido(), '40000000-0000-4000-8000-000000000001', opcoes)
    const fetcher = vi.fn().mockResolvedValue(responseJson({
      ok: true,
      pedidoId: PEDIDO_ID,
      version: 1,
      status: 'CADASTRADO',
      quantidadeTapetes: 1,
      reutilizado: false,
      tapetes: [],
    }, 201))
    await expect(enviarNovoPedido(payload, fetcher)).rejects.toMatchObject({ codigo: 'RESPOSTA_INVALIDA' })
  })
})

describe('associação dos tapetes criados', () => {
  it('associa por ordem explícita e preserva a identidade local após reordenação', () => {
    const inicial = adicionarTapete(criarEstadoInicial('local-a'), 'local-b')
    const reordenados = moverItem(inicial.tapetes, 1, -1)
    const associados = associarTapetesCriados(reordenados, [
      { id: '50000000-0000-4000-8000-000000000001', ordem: 1 },
      { id: '50000000-0000-4000-8000-000000000002', ordem: 2 },
    ])
    expect(associados?.map(({ chaveLocal, tapeteId }) => ({ chaveLocal, tapeteId }))).toEqual([
      { chaveLocal: 'local-b', tapeteId: '50000000-0000-4000-8000-000000000001' },
      { chaveLocal: 'local-a', tapeteId: '50000000-0000-4000-8000-000000000002' },
    ])
  })

  it.each([
    [[], 'quantidade divergente'],
    [[{ id: 'invalido', ordem: 1 }], 'UUID inválido'],
    [[{ id: TAPETE_ID, ordem: 2 }], 'ordem ausente'],
  ])('bloqueia associação insegura: %s', (tapetesCriados) => {
    expect(associarTapetesCriados(estadoValido().tapetes, tapetesCriados)).toBeNull()
  })
})

describe('arquivos e cliente HTTP de anexos', () => {
  it.each([
    [{ name: 'foto.jpg', type: 'image/jpeg', size: 1 }, null],
    [{ name: 'foto.png', type: 'image/png', size: 10_485_760 }, null],
    [{ name: 'foto.webp', type: 'image/webp', size: 1 }, null],
    [{ name: 'documento.pdf', type: 'application/pdf', size: 1 }, null],
    [{ name: 'vazio.pdf', type: 'application/pdf', size: 0 }, 'vazio'],
    [{ name: 'grande.pdf', type: 'application/pdf', size: 10_485_761 }, '10 MB'],
    [{ name: 'falso.pdf', type: 'image/png', size: 1 }, 'JPEG, PNG, WEBP'],
    [{ name: 'arquivo.exe', type: 'application/pdf', size: 1 }, 'JPEG, PNG, WEBP'],
  ])('valida arquivo aparente %j', (arquivo, trecho) => {
    const resultado = validarArquivoAnexo(arquivo)
    if (trecho === null) expect(resultado).toBeNull()
    else expect(resultado).toContain(trecho)
  })

  it('envia upload no slot com FormData, sem Content-Type manual, e aplica a nova versão', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({
      ok: true,
      anexoId: ANEXO_ID,
      slot: 1,
      nomeOriginal: 'foto.png',
      mime: 'image/png',
      tamanho: 10,
      version: 2,
    }, 201))
    const arquivo = new File([new Uint8Array([1])], 'foto.png', { type: 'image/png' })
    await expect(enviarAnexo({ pedidoId: PEDIDO_ID, tapeteId: TAPETE_ID, slot: 1, arquivo, expectedVersion: 1 }, fetcher)).resolves.toMatchObject({ slot: 1, version: 2 })
    const init = fetcher.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('slot')).toBe('1')
    expect((init.body as FormData).get('expectedVersion')).toBe('1')
  })

  it('usa rotas separadas para mutações iniciais e de gestão', async () => {
    const resposta = { ok: true, anexoId: ANEXO_ID, slot: 1, nomeOriginal: 'foto.png', mime: 'image/png', tamanho: 10, version: 2, teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 1 }
    const fetcher = vi.fn().mockResolvedValue(responseJson(resposta, 201))
    const arquivo = new File([new Uint8Array([1])], 'foto.png', { type: 'image/png' })
    await enviarAnexoGestao({ pedidoId: PEDIDO_ID, tapeteId: TAPETE_ID, slot: 1, arquivo, expectedVersion: 1 }, fetcher)
    expect(fetcher.mock.calls[0][0]).toContain('/gestao/pedidos/')

    fetcher.mockResolvedValue(responseJson(resposta))
    await substituirAnexoGestao({ anexoId: ANEXO_ID, arquivo, expectedVersion: 2 }, fetcher)
    expect(fetcher.mock.calls[1][0]).toContain('/gestao/anexos/')

    fetcher.mockResolvedValue(responseJson({ ok: true, anexoId: ANEXO_ID, version: 3, teveAlteracaoLayout: true, quantidadeAlteracoesLayout: 2 }))
    await expect(removerAnexoGestaoApi({ anexoId: ANEXO_ID, expectedVersion: 2 }, fetcher)).resolves.toMatchObject({ version: 3, quantidadeAlteracoesLayout: 2 })
    expect(fetcher.mock.calls[2][0]).toContain('/gestao/anexos/')
  })

  it('substitui sem apagar metadado local no cliente e envia a versão global', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({
      ok: true,
      anexoId: ANEXO_ID,
      slot: 2,
      nomeOriginal: 'novo.pdf',
      mime: 'application/pdf',
      tamanho: 20,
      createdAt: '2026-08-06T12:00:00Z',
      version: 4,
    }))
    const arquivo = new File([new Uint8Array([1])], 'novo.pdf', { type: 'application/pdf' })
    const resposta = await substituirAnexo({ anexoId: ANEXO_ID, arquivo, expectedVersion: 3 }, fetcher)
    expect(resposta).toMatchObject({ slot: 2, version: 4 })
    expect(((fetcher.mock.calls[0][1] as RequestInit).body as FormData).get('expectedVersion')).toBe('3')
  })

  it('remove com expectedVersion no JSON e libera o contrato do slot', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ ok: true, anexoId: ANEXO_ID, version: 5 }))
    await expect(removerAnexoApi({ anexoId: ANEXO_ID, expectedVersion: 4 }, fetcher)).resolves.toEqual({ anexoId: ANEXO_ID, version: 5 })
    expect(JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string)).toEqual({ expectedVersion: 4 })
  })

  it('solicita URL assinada sem persistir caminho privado', async () => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ ok: true, url: 'https://signed.example/anexo', expiraEm: '2026-08-06T12:05:00Z' }))
    const resultado = await solicitarUrlAnexo(ANEXO_ID, fetcher)
    expect(resultado.url).toBe('https://signed.example/anexo')
    expect(fetcher).toHaveBeenCalledWith(`/api/pedidos-personalizados/anexos/${ANEXO_ID}`, { cache: 'no-store' })
    expect(JSON.stringify(resultado)).not.toContain('caminho')
  })

  it.each([409, 413, 415, 422, 503])('mapeia falha de anexo HTTP %i sem corpo técnico', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(responseJson({ erro: status === 409 ? 'CONFLITO_VERSAO' : 'ERRO_TESTE', stack: 'segredo' }, status))
    await expect(solicitarUrlAnexo(ANEXO_ID, fetcher)).rejects.toMatchObject({ status })
  })
})

describe('proteção, dados não salvos e bloqueio seguro de anexos', () => {
  it('gera nova chave somente quando solicitado para uma nova tentativa lógica', () => {
    const gerador = vi.fn().mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2')
    expect(gerarIdempotencyKey(gerador)).toBe('uuid-1')
    expect(gerarIdempotencyKey(gerador)).toBe('uuid-2')
    expect(gerador).toHaveBeenCalledTimes(2)
  })

  it.each([
    [true, false, false, true],
    [true, true, false, false],
    [false, true, false, false],
    [false, true, true, true],
  ])('calcula aviso de saída', (alterado, salvo, upload, esperado) => {
    expect(deveAvisarDadosNaoSalvos(alterado, salvo, upload)).toBe(esperado)
  })

  it('protege a página no servidor e não adiciona o módulo ao menu', () => {
    const page = readFileSync(path.resolve('src/app/pedidos-personalizados/novo/page.tsx'), 'utf8')
    const catalogo = readFileSync(path.resolve('src/lib/auth/modulos-app.ts'), 'utf8')
    const blocoMenu = catalogo.slice(catalogo.indexOf('export const NAVIGATION_GROUPS'), catalogo.indexOf('export const PROFILE_CONTROLLED_MODULE_KEYS'))
    expect(page).toContain("checkModuleAndWindowAccess('pedidos_personalizados_novo')")
    expect(blocoMenu).not.toContain("navigationItem('pedidos_personalizados_novo'")
  })

  it('seleciona anexos antes do salvamento e só envia depois de associar os IDs reais', () => {
    const formulario = readFileSync(path.resolve('src/components/pedidos-personalizados/FormularioNovoPedido.tsx'), 'utf8')
    const anexos = readFileSync(path.resolve('src/components/pedidos-personalizados/AnexosTapete.tsx'), 'utf8')
    const anexosIniciais = readFileSync(path.resolve('src/components/pedidos-personalizados/AnexosIniciaisTapete.tsx'), 'utf8')
    expect(formulario).toContain('tapete.tapeteId ?')
    expect(formulario).toContain('const formularioBloqueado = enviando || !!salvo')
    expect(formulario).toContain('operacaoAnexoRef.current')
    expect(formulario).toContain('await enviarAnexosIniciais(resposta, tapetesAssociados)')
    expect(formulario.indexOf('associarTapetesCriados')).toBeLessThan(formulario.indexOf('await enviarAnexosIniciais'))
    expect(anexosIniciais).toContain('Selecione até dois arquivos antes de salvar')
    expect(anexos).toContain('type="file"')
    expect(anexos).toContain('Slot {slot}')
    expect(anexos).toContain('Até dois arquivos')
  })

  it('aplica limites visuais e mantém a lista selecionada abaixo do catálogo de cores', () => {
    const formulario = readFileSync(path.resolve('src/components/pedidos-personalizados/FormularioNovoPedido.tsx'), 'utf8')
    const card = readFileSync(path.resolve('src/components/pedidos-personalizados/CardTapete.tsx'), 'utf8')
    const seletor = readFileSync(path.resolve('src/components/pedidos-personalizados/SeletorCores.tsx'), 'utf8')
    expect(formulario).toContain('maxLength={6}')
    expect(formulario).toContain('onPaste={colarNumeroLancamento}')
    expect(card).toContain('maxLength={30}')
    expect(card).toContain('maxLength={20}')
    expect(card).toContain('mascararMedidaMetros')
    expect(seletor.indexOf('Catálogo de cores Moriah')).toBeLessThan(seletor.indexOf('Cores selecionadas'))
  })

  it('exibe erros por campo tocado ou depois da tentativa de salvar', () => {
    const formulario = readFileSync(path.resolve('src/components/pedidos-personalizados/FormularioNovoPedido.tsx'), 'utf8')
    expect(formulario).toContain('tentouSalvar || camposTocados.has(item.campo)')
    expect(formulario).toContain("onBlur={() => marcarTocado('consultora')}")
    expect(formulario).toContain("onBlur={() => marcarTocado('cliente')}")
    expect(formulario).toContain("focarPrimeiroErro(errosTodos)")
  })

  it('impede envio simultâneo com uma trava síncrona antes do fetch', () => {
    const formulario = readFileSync(path.resolve('src/components/pedidos-personalizados/FormularioNovoPedido.tsx'), 'utf8')
    expect(formulario).toContain('if (!opcoes || enviandoRef.current || salvo) return')
    expect(formulario.indexOf('enviandoRef.current = true')).toBeLessThan(formulario.indexOf('await enviarNovoPedido'))
  })
})
