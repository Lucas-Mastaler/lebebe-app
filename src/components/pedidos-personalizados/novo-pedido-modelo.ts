import {
  FORNECEDOR_MORIAH,
  LIMITE_CORES_POR_TAPETE,
  LIMITE_TAPETES_POR_PEDIDO,
  TIPO_TAPETE_PADRAO,
  UNIDADES_PEDIDO_PERSONALIZADO,
  calcularAreaCobradaCentesimosM2,
  classificarProdutoMoriah,
  converterMedidaMetrosParaCentimetros,
  formatarAreaMetrosQuadrados,
  gerarMensagemPedidoPersonalizado,
  validarPedidoPersonalizadoMoriah,
} from '@/lib/pedidos-personalizados'
import { normalizarDigitosTelefoneNacionalVisual } from '@/lib/atendimento-presencial/telefone'
import type {
  CodigoProdutoMoriah,
  FormatoTapeteMoriah,
  PedidoPersonalizadoMoriahEntrada,
  ProblemaPedidoPersonalizado,
  StatusPedidoPersonalizado,
  TipoTapeteMoriah,
  UnidadePedidoPersonalizado,
} from '@/lib/pedidos-personalizados'

export type UnidadeOpcao = {
  chave: UnidadePedidoPersonalizado
  nome: string
}

export type ProdutoOpcao = {
  id: string
  codigo: CodigoProdutoMoriah
  descricao: string
}

export type CorOpcao = {
  id: string
  numero: string
  codigo: string
  nome: string
  ordem: number
}

export type OpcoesNovoPedido = {
  fornecedor: { id: string; chave: string; nome: string }
  unidades: UnidadeOpcao[]
  produtos: ProdutoOpcao[]
  cores: CorOpcao[]
  formatos: FormatoTapeteMoriah[]
  status?: StatusPedidoPersonalizado[]
  limites: {
    tapetesPorPedido: number
    coresPorTapete: number
    medidaMinimaCm: number
    medidaMaximaCm: number
  }
}

export type TapeteFormulario = {
  chaveLocal: string
  tapeteId: string | null
  anexos: AnexoFormulario[]
  anexosLocais: AnexoLocalFormulario[]
  formato: FormatoTapeteMoriah
  tipo: TipoTapeteMoriah
  /** Resposta da 1ª pergunta guiada ("Este produto existe no catálogo?"). Só decide `tipo`; não é persistida. */
  existeNoCatalogo: boolean | null
  /** Resposta da 2ª pergunta guiada, só relevante quando `existeNoCatalogo` é true; não é persistida. */
  identicoReferencia: boolean | null
  dimensao1Metros: string
  dimensao2Metros: string
  corIds: string[]
  nomeColecaoCatalogo: string
  referenciaCatalogo: string
  observacoes: string
}

export type AnexoLocalFormulario = {
  slot: 1 | 2
  arquivo: File
  previewUrl: string | null
  estado: 'selecionado' | 'enviando' | 'falhou'
  erro: string | null
}

export type AnexoFormulario = {
  anexoId: string
  slot: 1 | 2
  nomeOriginal: string
  mime: string
  tamanho: number
  createdAt: string | null
}

export type TapeteCriado = {
  id: string
  ordem: number
}

export type EstadoNovoPedido = {
  unidade: '' | UnidadePedidoPersonalizado
  consultora: string
  cliente: string
  telefone: string
  numeroLancamento: string
  tapetes: TapeteFormulario[]
}

export type ResumoTapete = {
  valido: boolean
  area: string | null
  codigoProduto: CodigoProdutoMoriah | null
  produto: ProdutoOpcao | null
  avisoMedida: boolean
}

export type RespostaCriacao = {
  pedidoId: string
  version: number
  status: string
  quantidadeTapetes: number
  reutilizado: boolean
  tapetes: TapeteCriado[]
}

export type ErroHttpNovoPedido = {
  status: number
  codigo: string
  mensagem: string
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function criarTapeteVazio(chaveLocal: string): TapeteFormulario {
  return {
    chaveLocal,
    tapeteId: null,
    anexos: [],
    anexosLocais: [],
    formato: 'RETANGULAR',
    tipo: TIPO_TAPETE_PADRAO,
    existeNoCatalogo: null,
    identicoReferencia: null,
    dimensao1Metros: '',
    dimensao2Metros: '',
    corIds: [],
    nomeColecaoCatalogo: '',
    referenciaCatalogo: '',
    observacoes: '',
  }
}

const TAMANHO_MAXIMO_ANEXO = 10_485_760
const MIME_POR_EXTENSAO = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['pdf', 'application/pdf'],
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validarArquivoAnexo(arquivo: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (arquivo.size <= 0) return 'O arquivo não pode estar vazio.'
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return 'O arquivo deve ter no máximo 10 MB.'
  const extensao = arquivo.name.split('.').pop()?.toLocaleLowerCase('pt-BR') ?? ''
  const mimeEsperado = MIME_POR_EXTENSAO.get(extensao)
  if (!mimeEsperado || arquivo.type !== mimeEsperado) {
    return 'Envie uma imagem JPEG, PNG, WEBP ou um arquivo PDF.'
  }
  return null
}

export function associarTapetesCriados(
  tapetesLocais: readonly TapeteFormulario[],
  tapetesCriados: readonly TapeteCriado[]
): TapeteFormulario[] | null {
  if (tapetesLocais.length !== tapetesCriados.length) return null
  const porOrdem = new Map<number, TapeteCriado>()
  for (const tapete of tapetesCriados) {
    if (!UUID_PATTERN.test(tapete.id) || !Number.isInteger(tapete.ordem) || porOrdem.has(tapete.ordem)) return null
    porOrdem.set(tapete.ordem, tapete)
  }
  const associados: TapeteFormulario[] = []
  for (const [indice, tapete] of tapetesLocais.entries()) {
    const persistido = porOrdem.get(indice + 1)
    if (!persistido) return null
    associados.push({ ...tapete, tapeteId: persistido.id, anexos: [] })
  }
  return associados
}

export function criarEstadoInicial(chaveLocal: string): EstadoNovoPedido {
  return {
    unidade: '',
    consultora: '',
    cliente: '',
    telefone: '',
    numeroLancamento: '',
    tapetes: [criarTapeteVazio(chaveLocal)],
  }
}

export function adicionarTapete(
  estado: EstadoNovoPedido,
  chaveLocal: string
): EstadoNovoPedido {
  if (estado.tapetes.length >= LIMITE_TAPETES_POR_PEDIDO) return estado
  return { ...estado, tapetes: [...estado.tapetes, criarTapeteVazio(chaveLocal)] }
}

export function removerTapete(estado: EstadoNovoPedido, chaveLocal: string): EstadoNovoPedido {
  if (estado.tapetes.length <= 1) return estado
  return { ...estado, tapetes: estado.tapetes.filter((item) => item.chaveLocal !== chaveLocal) }
}

export function moverItem<T>(itens: readonly T[], indice: number, direcao: -1 | 1): T[] {
  const destino = indice + direcao
  if (indice < 0 || indice >= itens.length || destino < 0 || destino >= itens.length) return [...itens]
  const novos = [...itens]
  ;[novos[indice], novos[destino]] = [novos[destino], novos[indice]]
  return novos
}

export function alterarFormatoTapete(
  tapete: TapeteFormulario,
  formato: FormatoTapeteMoriah
): TapeteFormulario {
  return {
    ...tapete,
    formato,
    dimensao2Metros: formato === 'REDONDO' ? '' : tapete.dimensao2Metros,
  }
}

export function alterarTipoTapete(tapete: TapeteFormulario, tipo: TipoTapeteMoriah): TapeteFormulario {
  return {
    ...tapete,
    tipo,
    corIds: tipo === 'CATALOGO' ? [] : tapete.corIds,
  }
}

/** 1ª pergunta guiada. "Não" já determina Personalizado e esconde a 2ª pergunta. */
export function responderExisteNoCatalogo(tapete: TapeteFormulario, existe: boolean): TapeteFormulario {
  if (!existe) {
    return { ...alterarTipoTapete(tapete, 'PERSONALIZADO'), existeNoCatalogo: false, identicoReferencia: null }
  }
  return { ...tapete, existeNoCatalogo: true, identicoReferencia: null }
}

/** 2ª pergunta guiada, só exibida quando `existeNoCatalogo` é true. */
export function responderIdenticoReferencia(tapete: TapeteFormulario, identico: boolean): TapeteFormulario {
  return { ...alterarTipoTapete(tapete, identico ? 'CATALOGO' : 'PERSONALIZADO'), identicoReferencia: identico }
}

/** Só fica completa (e o `tipo` só é confiável) quando as respostas guiadas definem a classificação. */
export function classificacaoTapeteCompleta(tapete: TapeteFormulario): boolean {
  if (tapete.existeNoCatalogo === null) return false
  if (tapete.existeNoCatalogo === false) return true
  return tapete.identicoReferencia !== null
}

function validarClassificacaoTapetes(estado: EstadoNovoPedido): ProblemaPedidoPersonalizado[] {
  const problemas: ProblemaPedidoPersonalizado[] = []
  estado.tapetes.forEach((tapete, indice) => {
    const base = `tapetes.${indice}`
    if (tapete.existeNoCatalogo === null) {
      problemas.push({ codigo: 'CLASSIFICACAO_CATALOGO_OBRIGATORIA', campo: `${base}.existeNoCatalogo`, mensagem: 'Informe se este produto existe no catálogo.' })
      return
    }
    if (tapete.existeNoCatalogo === true && tapete.identicoReferencia === null) {
      problemas.push({ codigo: 'CLASSIFICACAO_IGUAL_REFERENCIA_OBRIGATORIA', campo: `${base}.identicoReferencia`, mensagem: 'Informe se o produto será exatamente igual à referência do catálogo.' })
    }
  })
  return problemas
}

export function alternarCor(tapete: TapeteFormulario, corId: string): TapeteFormulario {
  if (tapete.corIds.includes(corId)) {
    return { ...tapete, corIds: tapete.corIds.filter((id) => id !== corId) }
  }
  if (tapete.corIds.length >= LIMITE_CORES_POR_TAPETE) return tapete
  return { ...tapete, corIds: [...tapete.corIds, corId] }
}

export function filtrarCores(cores: readonly CorOpcao[], busca: string): CorOpcao[] {
  const termo = busca.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  if (!termo) return [...cores]
  return cores.filter((cor) =>
    `${cor.numero} ${cor.codigo} ${cor.nome}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .includes(termo)
  )
}

export function montarEntradaDominio(
  estado: EstadoNovoPedido,
  opcoes: Pick<OpcoesNovoPedido, 'cores'>
): PedidoPersonalizadoMoriahEntrada {
  const coresPorId = new Map(opcoes.cores.map((cor) => [cor.id, cor]))
  return {
    fornecedor: FORNECEDOR_MORIAH,
    unidade: estado.unidade,
    consultora: estado.consultora,
    cliente: estado.cliente,
    telefone: estado.telefone,
    numeroLancamento: estado.numeroLancamento,
    status: 'CADASTRADO',
    tapetes: estado.tapetes.map((tapete, indice) => ({
      ordem: indice + 1,
      formato: tapete.formato,
      tipo: tapete.tipo,
      dimensao1Metros: tapete.dimensao1Metros,
      dimensao2Metros: tapete.formato === 'REDONDO' ? null : tapete.dimensao2Metros,
      nomeColecaoCatalogo: tapete.nomeColecaoCatalogo,
      referenciaCatalogo: tapete.referenciaCatalogo,
      observacoes: tapete.observacoes,
      cores: tapete.tipo === 'CATALOGO' ? [] : tapete.corIds.map((id, corIndice) => {
        const cor = coresPorId.get(id)
        return {
          id,
          ordem: corIndice + 1,
          numero: cor?.numero,
          codigo: cor?.codigo,
          nome: cor?.nome,
        }
      }),
    })),
  }
}

export function avaliarFormulario(
  estado: EstadoNovoPedido,
  opcoes: Pick<OpcoesNovoPedido, 'cores' | 'produtos'>
) {
  const validacaoDominio = validarPedidoPersonalizadoMoriah(montarEntradaDominio(estado, opcoes))
  const errosClassificacao = validarClassificacaoTapetes(estado)
  const validacao = errosClassificacao.length === 0
    ? validacaoDominio
    : { ...validacaoDominio, valido: false, erros: [...errosClassificacao, ...validacaoDominio.erros] }
  const mensagem = validacao.dados
    ? gerarMensagemPedidoPersonalizado(validacao.dados, opcoes.produtos)
    : null
  return {
    validacao,
    mensagem: mensagem?.valido ? mensagem.dados : null,
  }
}

export function resumirTapete(
  tapete: TapeteFormulario,
  produtos: readonly ProdutoOpcao[]
): ResumoTapete {
  const dimensao1 = converterMedidaMetrosParaCentimetros(tapete.dimensao1Metros)
  const dimensao2 = tapete.formato === 'REDONDO'
    ? { valido: true, dados: null as number | null }
    : converterMedidaMetrosParaCentimetros(tapete.dimensao2Metros)
  if (!dimensao1.valido || dimensao1.dados === null || !dimensao2.valido) {
    return { valido: false, area: null, codigoProduto: null, produto: null, avisoMedida: false }
  }
  const area = calcularAreaCobradaCentesimosM2(tapete.formato, dimensao1.dados, dimensao2.dados)
  if (!area.valido || !area.dados) {
    return { valido: false, area: null, codigoProduto: null, produto: null, avisoMedida: false }
  }
  const codigoProduto = classificarProdutoMoriah(tapete.formato, dimensao1.dados, dimensao2.dados).codigo
  return {
    valido: true,
    area: formatarAreaMetrosQuadrados(area.dados.areaCobradaCentesimosM2),
    codigoProduto,
    produto: produtos.find((item) => item.codigo === codigoProduto) ?? null,
    avisoMedida: dimensao1.dados % 5 !== 0 || (dimensao2.dados !== null && dimensao2.dados % 5 !== 0),
  }
}

// Checagem só de UI (não altera a regra canônica de telefone em `@/lib/pedidos-personalizados`,
// que é compartilhada com o servidor e outros formulários): sinaliza números plausivelmente
// forjados, como 99999-9999, sem mudar o contrato de validação existente.
export function telefoneComVariedadeMinima(telefone: string): boolean {
  const digitos = normalizarDigitosTelefoneNacionalVisual(telefone)
  if (digitos.length < 10) return true
  const numero = digitos.slice(2)
  return new Set(numero).size >= 3
}

export function problemasPorCampo(
  problemas: readonly ProblemaPedidoPersonalizado[],
  campo: string
): string[] {
  return problemas.filter((item) => item.campo === campo).map((item) => item.mensagem)
}

export function montarPayloadCriacao(
  estado: EstadoNovoPedido,
  idempotencyKey: string,
  opcoes: Pick<OpcoesNovoPedido, 'cores'>
) {
  const entrada = montarEntradaDominio(estado, opcoes)
  return {
    idempotencyKey,
    unidade: entrada.unidade,
    consultora: entrada.consultora,
    cliente: entrada.cliente,
    telefone: estado.telefone,
    numeroLancamento: entrada.numeroLancamento,
    tapetes: entrada.tapetes.map((tapete) => ({
      ordem: tapete.ordem,
      formato: tapete.formato,
      tipo: tapete.tipo,
      dimensao1Metros: tapete.dimensao1Metros,
      dimensao2Metros: tapete.dimensao2Metros,
      nomeColecaoCatalogo: tapete.nomeColecaoCatalogo,
      referenciaCatalogo: tapete.referenciaCatalogo,
      observacoes: tapete.observacoes,
      cores: tapete.cores?.map(({ id, ordem }) => ({ id, ordem })) ?? [],
    })),
  }
}

async function lerErro(response: Response): Promise<ErroHttpNovoPedido> {
  let codigo = 'ERRO_INESPERADO'
  let mensagemApi: string | null = null
  try {
    const body = await response.json() as { erro?: unknown; mensagem?: unknown }
    if (typeof body.erro === 'string' && /^[A-Z0-9_]+$/.test(body.erro)) codigo = body.erro
    if (typeof body.mensagem === 'string' && body.mensagem.length <= 300) mensagemApi = body.mensagem
  } catch {
    // A interface nunca exibe o corpo técnico integral.
  }
  const mensagens: Record<number, string> = {
    401: 'Sua sessão expirou. Entre novamente para continuar.',
    403: 'Você não possui permissão para acessar os anexos deste pedido.',
    404: 'O pedido, tapete ou anexo não foi encontrado.',
    409: 'Este pedido foi alterado por outra pessoa. Recarregue os dados antes de continuar.',
    413: 'O arquivo deve ter no máximo 10 MB.',
    415: 'Envie uma imagem JPEG, PNG, WEBP ou um arquivo PDF.',
    422: 'Revise os dados informados antes de continuar.',
    500: 'Não foi possível concluir a operação agora.',
    503: 'O serviço está temporariamente indisponível. Tente novamente.',
  }
  const podeUsarMensagemApi = response.status === 422 || codigo === 'CRIACAO_PARCIAL_NAO_CONFIRMADA'
  return {
    status: response.status,
    codigo,
    mensagem: podeUsarMensagemApi && mensagemApi ? mensagemApi : mensagens[response.status] ?? mensagens[500],
  }
}

function opcoesValidas(valor: unknown): valor is OpcoesNovoPedido {
  if (!valor || typeof valor !== 'object') return false
  const body = valor as Partial<OpcoesNovoPedido> & { ok?: unknown }
  return body.ok === true
    && body.fornecedor?.chave === FORNECEDOR_MORIAH
    && Array.isArray(body.unidades)
    && body.unidades.every((unidade) =>
      !!unidade
      && typeof unidade === 'object'
      && UNIDADES_PEDIDO_PERSONALIZADO.includes((unidade as UnidadeOpcao).chave)
    )
    && Array.isArray(body.produtos)
    && body.produtos.length === 3
    && Array.isArray(body.cores)
    && body.cores.length === 31
    && Array.isArray(body.formatos)
    && !!body.limites
}

export async function carregarOpcoesNovoPedido(fetcher: FetchLike = fetch): Promise<OpcoesNovoPedido> {
  const response = await fetcher('/api/pedidos-personalizados/opcoes', { cache: 'no-store' })
  if (!response.ok) throw await lerErro(response)
  const body = await response.json()
  if (!opcoesValidas(body)) {
    throw { status: 500, codigo: 'CATALOGO_INCOMPATIVEL', mensagem: 'O catálogo está temporariamente indisponível.' } satisfies ErroHttpNovoPedido
  }
  return body
}

export async function enviarNovoPedido(
  payload: ReturnType<typeof montarPayloadCriacao>,
  fetcher: FetchLike = fetch
): Promise<RespostaCriacao> {
  const response = await fetcher('/api/pedidos-personalizados/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await lerErro(response)
  const body = await response.json() as Partial<RespostaCriacao> & { ok?: unknown }
  if (
    body.ok !== true
    || typeof body.pedidoId !== 'string'
    || typeof body.version !== 'number'
    || typeof body.status !== 'string'
    || typeof body.quantidadeTapetes !== 'number'
    || typeof body.reutilizado !== 'boolean'
    || !Array.isArray(body.tapetes)
    || body.tapetes.length !== body.quantidadeTapetes
    || body.tapetes.some((tapete) =>
      !tapete
      || typeof tapete !== 'object'
      || !UUID_PATTERN.test((tapete as TapeteCriado).id)
      || !Number.isInteger((tapete as TapeteCriado).ordem)
    )
  ) {
    throw { status: 500, codigo: 'RESPOSTA_INVALIDA', mensagem: 'A resposta do servidor não pôde ser confirmada.' } satisfies ErroHttpNovoPedido
  }
  return body as RespostaCriacao
}

type RespostaMutacaoAnexo = {
  anexoId: string
  slot: 1 | 2
  nomeOriginal: string
  mime: string
  tamanho: number
  createdAt?: string
  version: number
  teveAlteracaoLayout?: boolean
  quantidadeAlteracoesLayout?: number | null
}

function validarRespostaMutacaoAnexo(valor: unknown): RespostaMutacaoAnexo {
  const body = valor as Partial<RespostaMutacaoAnexo> & { ok?: unknown }
  if (
    body.ok !== true
    || typeof body.anexoId !== 'string'
    || !UUID_PATTERN.test(body.anexoId)
    || (body.slot !== 1 && body.slot !== 2)
    || typeof body.nomeOriginal !== 'string'
    || typeof body.mime !== 'string'
    || typeof body.tamanho !== 'number'
    || !Number.isInteger(body.version)
  ) {
    throw { status: 500, codigo: 'RESPOSTA_INVALIDA', mensagem: 'A resposta do servidor não pôde ser confirmada.' } satisfies ErroHttpNovoPedido
  }
  return body as RespostaMutacaoAnexo
}

function montarFormDataAnexo(arquivo: File, expectedVersion: number, slot?: 1 | 2) {
  const formData = new FormData()
  formData.set('arquivo', arquivo)
  formData.set('expectedVersion', String(expectedVersion))
  if (slot) formData.set('slot', String(slot))
  return formData
}

export async function enviarAnexo(params: {
  pedidoId: string
  tapeteId: string
  slot: 1 | 2
  arquivo: File
  expectedVersion: number
}, fetcher: FetchLike = fetch): Promise<RespostaMutacaoAnexo> {
  const response = await fetcher(
    `/api/pedidos-personalizados/pedidos/${params.pedidoId}/tapetes/${params.tapeteId}/anexos`,
    { method: 'POST', body: montarFormDataAnexo(params.arquivo, params.expectedVersion, params.slot) }
  )
  if (!response.ok) throw await lerErro(response)
  return validarRespostaMutacaoAnexo(await response.json())
}

export async function enviarAnexoGestao(params: {
  pedidoId: string
  tapeteId: string
  slot: 1 | 2
  arquivo: File
  expectedVersion: number
}, fetcher: FetchLike = fetch): Promise<RespostaMutacaoAnexo> {
  const response = await fetcher(
    `/api/pedidos-personalizados/gestao/pedidos/${params.pedidoId}/tapetes/${params.tapeteId}/anexos`,
    { method: 'POST', body: montarFormDataAnexo(params.arquivo, params.expectedVersion, params.slot) }
  )
  if (!response.ok) throw await lerErro(response)
  return validarRespostaMutacaoAnexo(await response.json())
}

export async function substituirAnexo(params: {
  anexoId: string
  arquivo: File
  expectedVersion: number
}, fetcher: FetchLike = fetch): Promise<RespostaMutacaoAnexo> {
  const response = await fetcher(`/api/pedidos-personalizados/anexos/${params.anexoId}`, {
    method: 'PUT',
    body: montarFormDataAnexo(params.arquivo, params.expectedVersion),
  })
  if (!response.ok) throw await lerErro(response)
  return validarRespostaMutacaoAnexo(await response.json())
}

export async function substituirAnexoGestao(params: {
  anexoId: string
  arquivo: File
  expectedVersion: number
}, fetcher: FetchLike = fetch): Promise<RespostaMutacaoAnexo> {
  const response = await fetcher(`/api/pedidos-personalizados/gestao/anexos/${params.anexoId}`, {
    method: 'PUT',
    body: montarFormDataAnexo(params.arquivo, params.expectedVersion),
  })
  if (!response.ok) throw await lerErro(response)
  return validarRespostaMutacaoAnexo(await response.json())
}

export async function removerAnexoApi(params: {
  anexoId: string
  expectedVersion: number
}, fetcher: FetchLike = fetch): Promise<{ anexoId: string; version: number }> {
  const response = await fetcher(`/api/pedidos-personalizados/anexos/${params.anexoId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: params.expectedVersion }),
  })
  if (!response.ok) throw await lerErro(response)
  const body = await response.json() as { ok?: unknown; anexoId?: unknown; version?: unknown }
  if (body.ok !== true || body.anexoId !== params.anexoId || !Number.isInteger(body.version)) {
    throw { status: 500, codigo: 'RESPOSTA_INVALIDA', mensagem: 'A resposta do servidor não pôde ser confirmada.' } satisfies ErroHttpNovoPedido
  }
  return { anexoId: params.anexoId, version: body.version as number }
}

export async function removerAnexoGestaoApi(params: {
  anexoId: string
  expectedVersion: number
}, fetcher: FetchLike = fetch): Promise<{ anexoId: string; version: number; teveAlteracaoLayout?: boolean; quantidadeAlteracoesLayout?: number | null }> {
  const response = await fetcher(`/api/pedidos-personalizados/gestao/anexos/${params.anexoId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: params.expectedVersion }),
  })
  if (!response.ok) throw await lerErro(response)
  const body = await response.json() as { ok?: unknown; anexoId?: unknown; version?: unknown; teveAlteracaoLayout?: unknown; quantidadeAlteracoesLayout?: unknown }
  if (body.ok !== true || body.anexoId !== params.anexoId || !Number.isInteger(body.version)) {
    throw { status: 500, codigo: 'RESPOSTA_INVALIDA', mensagem: 'A resposta do servidor não pôde ser confirmada.' } satisfies ErroHttpNovoPedido
  }
  return {
    anexoId: params.anexoId,
    version: body.version as number,
    teveAlteracaoLayout: typeof body.teveAlteracaoLayout === 'boolean' ? body.teveAlteracaoLayout : undefined,
    quantidadeAlteracoesLayout: typeof body.quantidadeAlteracoesLayout === 'number' || body.quantidadeAlteracoesLayout === null
      ? body.quantidadeAlteracoesLayout
      : undefined,
  }
}

export async function solicitarUrlAnexo(
  anexoId: string,
  fetcher: FetchLike = fetch
): Promise<{ url: string; expiraEm: string }> {
  const response = await fetcher(`/api/pedidos-personalizados/anexos/${anexoId}`, { cache: 'no-store' })
  if (!response.ok) throw await lerErro(response)
  const body = await response.json() as { ok?: unknown; url?: unknown; expiraEm?: unknown }
  if (body.ok !== true || typeof body.url !== 'string' || typeof body.expiraEm !== 'string') {
    throw { status: 500, codigo: 'RESPOSTA_INVALIDA', mensagem: 'A resposta do servidor não pôde ser confirmada.' } satisfies ErroHttpNovoPedido
  }
  return { url: body.url, expiraEm: body.expiraEm }
}

export function ehErroHttpNovoPedido(valor: unknown): valor is ErroHttpNovoPedido {
  if (!valor || typeof valor !== 'object') return false
  const erro = valor as Partial<ErroHttpNovoPedido>
  return typeof erro.status === 'number' && typeof erro.codigo === 'string' && typeof erro.mensagem === 'string'
}

export function deveAvisarDadosNaoSalvos(alterado: boolean, salvo: boolean, uploadPendente: boolean) {
  return (alterado && !salvo) || uploadPendente
}

export function gerarIdempotencyKey(gerador: () => string = () => crypto.randomUUID()) {
  return gerador()
}
