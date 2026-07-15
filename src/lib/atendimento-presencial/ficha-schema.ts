import type { ParentescoCliente } from './clientes'

export const FICHA_ETAPAS = ['ficha', 'resultado', 'revisao'] as const
export type FichaEtapa = (typeof FICHA_ETAPAS)[number]

export const FICHA_TOTAL_ETAPAS = 4

export const SITUACOES_CRIANCA = [
  { chave: 'gestacao', label: 'Gestacao' },
  { chave: 'ja_nasceu', label: 'Ja nasceu' },
  { chave: 'presente_outra_pessoa', label: 'Presente para outra pessoa' },
  { chave: 'nao_informado', label: 'Ainda nao informado' },
] as const

export type SituacaoCrianca = (typeof SITUACOES_CRIANCA)[number]['chave']

export const SEXOS_CRIANCA = [
  { chave: 'menina', label: 'Menina' },
  { chave: 'menino', label: 'Menino' },
  { chave: 'nao_informado', label: 'Ainda nao informado' },
  { chave: 'prefere_nao_informar', label: 'Prefere nao informar' },
] as const

export type SexoCrianca = (typeof SEXOS_CRIANCA)[number]['chave']
export type UnidadeIdadeCrianca = 'meses' | 'anos'

export const DEPARTAMENTOS_INTERESSE = [
  { chave: 'p_pesada', label: 'P. PESADA' },
  { chave: 'moveis', label: 'MOVEIS' },
  { chave: 'p_leve', label: 'P. LEVE' },
  { chave: 'enxoval', label: 'ENXOVAL' },
  { chave: 'decoracao', label: 'DECORACAO' },
  { chave: 'roupinhas', label: 'ROUPINHAS' },
] as const

export type DepartamentoInteresse = (typeof DEPARTAMENTOS_INTERESSE)[number]['chave']

export const RESULTADOS_ATENDIMENTO = [
  { chave: 'sim', label: 'Sim' },
  { chave: 'nao', label: 'Nao' },
  { chave: 'negociacao', label: 'Ainda em negociacao' },
] as const

export type ResultadoAtendimento = (typeof RESULTADOS_ATENDIMENTO)[number]['chave']

export const MOTIVOS_RESULTADO_GRUPOS = [
  {
    chave: 'produto',
    label: 'Produto',
    motivos: [
      { chave: 'qualidade_produto', label: 'Qualidade do produto' },
      { chave: 'design_aparencia', label: 'Design ou aparencia' },
      { chave: 'cor_acabamento', label: 'Cor ou acabamento' },
      { chave: 'tamanho_medidas', label: 'Tamanho ou medidas' },
      { chave: 'produto_disponivel', label: 'Produto disponivel' },
      { chave: 'produto_indisponivel', label: 'Produto indisponivel' },
      { chave: 'variedade_produtos', label: 'Variedade de produtos' },
    ],
  },
  {
    chave: 'condicao_comercial',
    label: 'Condicao comercial',
    motivos: [
      { chave: 'preco', label: 'Preco' },
      { chave: 'desconto', label: 'Desconto' },
      { chave: 'condicao_pagamento', label: 'Condicao de pagamento' },
      { chave: 'brinde', label: 'Brinde' },
      { chave: 'frete', label: 'Frete' },
      { chave: 'montagem', label: 'Montagem' },
    ],
  },
  {
    chave: 'prazo_necessidade',
    label: 'Prazo e necessidade',
    motivos: [
      { chave: 'prazo_entrega', label: 'Prazo de entrega' },
      { chave: 'necessidade_imediata', label: 'Necessidade imediata' },
      { chave: 'aguardar_nascimento', label: 'Vai aguardar mais perto do nascimento' },
      { chave: 'ainda_pesquisando', label: 'Ainda esta pesquisando' },
    ],
  },
  {
    chave: 'decisao',
    label: 'Decisao',
    motivos: [
      { chave: 'comparacao_concorrente', label: 'Comparacao com concorrente' },
      { chave: 'conversar_outra_pessoa', label: 'Precisa conversar com outra pessoa' },
      { chave: 'sem_orcamento', label: 'Sem orcamento no momento' },
      { chave: 'indecisao_produtos', label: 'Indecisao entre produtos' },
      { chave: 'confianca_loja', label: 'Confianca na loja' },
      { chave: 'atendimento', label: 'Atendimento' },
    ],
  },
  {
    chave: 'outro',
    label: 'Outro',
    motivos: [{ chave: 'outro', label: 'Outro' }],
  },
] as const

export type MotivoResultado = (typeof MOTIVOS_RESULTADO_GRUPOS)[number]['motivos'][number]['chave']

export const FICHA_PRODUTO_MAX_CHARS = 80
export const FICHA_PRODUTOS_MAX_ITENS = 20
export const FICHA_OBSERVACOES_MAX_CHARS = 2000
export const FICHA_NOME_CRIANCA_MAX_CHARS = 80
export const FICHA_MOTIVO_OUTRO_MAX_CHARS = 120
export const FICHA_PAYLOAD_MAX_BYTES = 4096

export type FichaClienteRascunho = {
  parentesco?: ParentescoCliente
  parentescoOutro?: string
}

export type FichaCriancaRascunho = {
  id: string
  situacao: SituacaoCrianca
  dataPrevistaNascimento?: string
  idadeUnidade?: UnidadeIdadeCrianca
  idadeValor?: number
  nome?: string
  sexo?: SexoCrianca
}

export type FichaDadosRascunho = {
  cliente?: FichaClienteRascunho
  criancas: FichaCriancaRascunho[]
  departamentos: DepartamentoInteresse[]
  produtosInteresse: string[]
  resultadoAtendimento?: ResultadoAtendimento
  motivosResultado: MotivoResultado[]
  motivoOutro?: string
  observacoes?: string
  etapaAtual: FichaEtapa
  notaTecnica?: string
}

export type ValidacaoFichaRascunho =
  | { ok: true; dados: FichaDadosRascunho }
  | { ok: false; field: string; message: string }

const etapasValidas = new Set<string>(FICHA_ETAPAS)
const etapasLegadasParaFicha = new Set(['cliente', 'criancas', 'interesses', 'observacoes'])
const situacoesValidas = new Set<string>(SITUACOES_CRIANCA.map((item) => item.chave))
const sexosValidos = new Set<string>(SEXOS_CRIANCA.map((item) => item.chave))
const departamentosValidos = new Set<string>(DEPARTAMENTOS_INTERESSE.map((item) => item.chave))
const resultadosValidos = new Set<string>(RESULTADOS_ATENDIMENTO.map((item) => item.chave))
const motivosValidos = new Set<string>(MOTIVOS_RESULTADO_GRUPOS.flatMap((grupo) => grupo.motivos.map((item) => item.chave)))
const chavesPermitidas = new Set([
  'cliente',
  'criancas',
  'departamentos',
  'produtosInteresse',
  'resultadoAtendimento',
  'motivosResultado',
  'motivoOutro',
  'observacoes',
  'etapaAtual',
  'notaTecnica',
])

function normalizarTexto(valor: unknown, max: number) {
  if (typeof valor !== 'string') return ''
  return valor.trim().replace(/\s+/g, ' ').slice(0, max)
}

function normalizarTextoMultilinha(valor: unknown, max: number) {
  if (typeof valor !== 'string') return ''
  return valor.replace(/\r\n/g, '\n').trim().slice(0, max)
}

function normalizarDataLocal(valor: unknown) {
  if (typeof valor !== 'string') return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return ''
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (ano < 2020 || ano > 2100) return ''
  const data = new Date(ano, mes - 1, dia)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return ''
  return valor
}

export function formatarDataPrevistaInput(valor: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarDataISOParaInput(valor)
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

export function formatarDataISOParaInput(valor: string | undefined) {
  const iso = normalizarDataLocal(valor)
  if (!iso) return ''
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function converterDataInputParaISO(valor: string) {
  const formatada = formatarDataPrevistaInput(valor)
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formatada)) return ''
  const [dia, mes, ano] = formatada.split('/').map(Number)
  const iso = `${ano.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`
  return normalizarDataLocal(iso)
}

const nomeCriancaPermitidoRegex = /^[\p{L}\s'-]+$/u

export function limparNomeCriancaDigitacao(valor: string) {
  return Array.from(valor)
    .filter((char) => /[\p{L}\s'-]/u.test(char))
    .join('')
    .slice(0, FICHA_NOME_CRIANCA_MAX_CHARS)
}

export function normalizarNomeCrianca(valor: unknown) {
  if (typeof valor !== 'string') return ''
  return limparNomeCriancaDigitacao(valor).trim().replace(/\s+/g, ' ')
}

export function nomeCriancaValido(valor: unknown) {
  if (typeof valor !== 'string') return true
  const texto = valor.trim()
  if (!texto) return true
  return texto.length <= FICHA_NOME_CRIANCA_MAX_CHARS && nomeCriancaPermitidoRegex.test(texto)
}

function mapearEtapaRascunho(valor: unknown): FichaEtapa {
  if (typeof valor !== 'string') return 'ficha'
  if (etapasValidas.has(valor)) return valor as FichaEtapa
  if (etapasLegadasParaFicha.has(valor)) return 'ficha'
  return 'ficha'
}

function payloadBase(): FichaDadosRascunho {
  return {
    criancas: [],
    departamentos: [],
    produtosInteresse: [],
    motivosResultado: [],
    etapaAtual: 'ficha',
  }
}

export function criarCriancaRascunho(id: string): FichaCriancaRascunho {
  return { id, situacao: 'nao_informado' }
}

export function validarFichaDadosRascunho(valor: unknown): ValidacaoFichaRascunho {
  if (valor === undefined || valor === null) return { ok: true, dados: payloadBase() }
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, field: 'dadosRascunho', message: 'Dados do rascunho invalidos' }
  }

  const payload = valor as Record<string, unknown>
  const chavesInvalidas = Object.keys(payload).filter((chave) => !chavesPermitidas.has(chave))
  if (chavesInvalidas.length > 0) {
    return { ok: false, field: 'dadosRascunho', message: 'Dados do rascunho contem campos nao permitidos' }
  }

  const dados = payloadBase()

  if (typeof payload.cliente === 'object' && payload.cliente !== null && !Array.isArray(payload.cliente)) {
    const cliente = payload.cliente as Record<string, unknown>
    const fichaCliente: FichaClienteRascunho = {}
    if (typeof cliente.parentesco === 'string') fichaCliente.parentesco = cliente.parentesco as ParentescoCliente
    const parentescoOutro = normalizarTexto(cliente.parentescoOutro, 60)
    if (parentescoOutro) fichaCliente.parentescoOutro = parentescoOutro
    if (fichaCliente.parentesco || fichaCliente.parentescoOutro) dados.cliente = fichaCliente
  }

  if (Array.isArray(payload.criancas)) {
    dados.criancas = payload.criancas.slice(0, 8).flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
      const row = item as Record<string, unknown>
      if (typeof row.id !== 'string' || row.id.trim().length < 4 || row.id.length > 80) return []
      const situacao = typeof row.situacao === 'string' && situacoesValidas.has(row.situacao)
        ? row.situacao as SituacaoCrianca
        : 'nao_informado'
      const crianca: FichaCriancaRascunho = { id: row.id, situacao }
      if (!nomeCriancaValido(row.nome)) {
        return []
      }
      const nome = normalizarNomeCrianca(row.nome)
      if (nome) crianca.nome = nome
      if (typeof row.sexo === 'string' && sexosValidos.has(row.sexo)) crianca.sexo = row.sexo as SexoCrianca
      if (situacao === 'gestacao') {
        const dataPrevistaNascimento = normalizarDataLocal(row.dataPrevistaNascimento)
        if (dataPrevistaNascimento) crianca.dataPrevistaNascimento = dataPrevistaNascimento
      }
      if (situacao === 'ja_nasceu') {
        const idadeUnidade = row.idadeUnidade === 'meses' || row.idadeUnidade === 'anos' ? row.idadeUnidade : undefined
        const idadeValor = Number(row.idadeValor)
        if (idadeUnidade === 'meses' && Number.isInteger(idadeValor) && idadeValor >= 1 && idadeValor <= 11) {
          crianca.idadeUnidade = 'meses'
          crianca.idadeValor = idadeValor
        }
        if (idadeUnidade === 'anos' && Number.isInteger(idadeValor) && idadeValor >= 1 && idadeValor <= 6) {
          crianca.idadeUnidade = 'anos'
          crianca.idadeValor = idadeValor
        }
      }
      return [crianca]
    })
  }

  if (Array.isArray(payload.departamentos)) {
    dados.departamentos = Array.from(
      new Set(payload.departamentos.filter((item): item is DepartamentoInteresse => typeof item === 'string' && departamentosValidos.has(item)))
    )
  }

  if (Array.isArray(payload.produtosInteresse)) {
    const vistos = new Set<string>()
    dados.produtosInteresse = payload.produtosInteresse.slice(0, FICHA_PRODUTOS_MAX_ITENS).flatMap((item) => {
      const texto = normalizarTexto(item, FICHA_PRODUTO_MAX_CHARS)
      if (!texto) return []
      const chave = texto.toLocaleLowerCase('pt-BR')
      if (vistos.has(chave)) return []
      vistos.add(chave)
      return [texto]
    })
  }

  if (typeof payload.resultadoAtendimento === 'string' && resultadosValidos.has(payload.resultadoAtendimento)) {
    dados.resultadoAtendimento = payload.resultadoAtendimento as ResultadoAtendimento
  }

  if (Array.isArray(payload.motivosResultado)) {
    dados.motivosResultado = Array.from(
      new Set(payload.motivosResultado.filter((item): item is MotivoResultado => typeof item === 'string' && motivosValidos.has(item)))
    )
  }

  const motivoOutro = normalizarTexto(payload.motivoOutro, FICHA_MOTIVO_OUTRO_MAX_CHARS)
  if (motivoOutro) dados.motivoOutro = motivoOutro

  const observacoes = normalizarTextoMultilinha(payload.observacoes, FICHA_OBSERVACOES_MAX_CHARS)
  if (observacoes) dados.observacoes = observacoes

  dados.etapaAtual = mapearEtapaRascunho(payload.etapaAtual)

  const tamanho = Buffer.byteLength(JSON.stringify(dados), 'utf8')
  if (tamanho > FICHA_PAYLOAD_MAX_BYTES) {
    return { ok: false, field: 'dadosRascunho', message: 'Dados do rascunho excedem o limite permitido' }
  }

  return { ok: true, dados }
}

export function migrarFichaDadosRascunho(valor: unknown): FichaDadosRascunho {
  const validacao = validarFichaDadosRascunho(valor)
  return validacao.ok ? validacao.dados : payloadBase()
}

export function getDepartamentoLabel(chave: DepartamentoInteresse) {
  return DEPARTAMENTOS_INTERESSE.find((item) => item.chave === chave)?.label ?? chave
}

export function getResultadoLabel(chave: ResultadoAtendimento | undefined) {
  if (!chave) return 'Nao informado'
  return RESULTADOS_ATENDIMENTO.find((item) => item.chave === chave)?.label ?? chave
}

export function getMotivoLabel(chave: MotivoResultado) {
  for (const grupo of MOTIVOS_RESULTADO_GRUPOS) {
    const motivo = grupo.motivos.find((item) => item.chave === chave)
    if (motivo) return motivo.label
  }
  return chave
}
