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
      { chave: 'virada_cartao', label: 'Virada de cartao' },
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
export const FICHA_PAYLOAD_MAX_BYTES = 16384

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
  nomeNaoInformado?: boolean
  sexo?: SexoCrianca
}

export type FichaDadosRascunho = {
  cliente?: FichaClienteRascunho
  consultoraNome?: string
  criancas: FichaCriancaRascunho[]
  departamentos: DepartamentoInteresse[]
  produtosInteresse: string[]
  resultadoAtendimento?: ResultadoAtendimento
  motivosResultado: MotivoResultado[]
  motivoOutro?: string
  viradaCartaoDia?: number
  viradaCartaoMes?: number
  observacoes?: string
  etapaAtual: FichaEtapa
  notaTecnica?: string
}

export type ValidacaoFichaRascunho =
  | { ok: true; dados: FichaDadosRascunho }
  | { ok: false; field: string; message: string }

export type ValidacaoFichaConclusao =
  | { ok: true; numeroLancamento: number | null }
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
  'consultoraNome',
  'criancas',
  'departamentos',
  'produtosInteresse',
  'resultadoAtendimento',
  'motivosResultado',
  'motivoOutro',
  'viradaCartaoDia',
  'viradaCartaoMes',
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

export function formatarViradaCartaoInput(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 4)
  if (digitos.length <= 2) return digitos
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
}

export function dataViradaCartaoValida(dia: number, mes: number) {
  if (!Number.isInteger(dia) || !Number.isInteger(mes)) return false
  if (mes < 1 || mes > 12) return false
  const diasPorMes = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return dia >= 1 && dia <= diasPorMes[mes - 1]
}

export function converterViradaCartaoInput(valor: string) {
  const formatado = formatarViradaCartaoInput(valor)
  if (!/^\d{2}\/\d{2}$/.test(formatado)) return null
  const [dia, mes] = formatado.split('/').map(Number)
  if (!dataViradaCartaoValida(dia, mes)) return null
  return { dia, mes }
}

export function formatarViradaCartao(dia: number | null | undefined, mes: number | null | undefined) {
  if (!dia || !mes || !dataViradaCartaoValida(dia, mes)) return ''
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

export function valorOrdenavelViradaCartao(dia: number, mes: number) {
  if (!dataViradaCartaoValida(dia, mes)) return null
  return mes * 100 + dia
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

export const FICHA_CONSULTORA_NOME_MAX_CHARS = 30

const REGEX_CONSULTORA_NOME = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]+( [A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]+)*$/

export function normalizarNomeConsultora(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  return valor.trim().replace(/\s+/g, ' ').slice(0, FICHA_CONSULTORA_NOME_MAX_CHARS)
}

export function validarNomeConsultora(valor: string): boolean {
  if (!valor || valor.trim().length < 2) return false
  if (valor.length > FICHA_CONSULTORA_NOME_MAX_CHARS) return false
  return REGEX_CONSULTORA_NOME.test(valor)
}

export function criarCriancaRascunho(id: string): FichaCriancaRascunho {
  return { id, situacao: 'gestacao' }
}

export function validarFichaDadosRascunho(valor: unknown): ValidacaoFichaRascunho {
  if (valor === undefined || valor === null) return { ok: true, dados: payloadBase() }
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, field: 'dadosRascunho', message: 'Dados do rascunho invalidos' }
  }

  const payload = valor as Record<string, unknown>
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > FICHA_PAYLOAD_MAX_BYTES) {
    return { ok: false, field: 'dadosRascunho', message: 'Dados do rascunho excedem o limite permitido' }
  }

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
    for (const item of payload.criancas) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const nomeNaoInformado = row.nomeNaoInformado === true
      const nome = normalizarNomeCrianca(row.nome)
      if (nomeNaoInformado && nome) {
        return { ok: false, field: 'criancas', message: 'Nome da crianca nao pode ser preenchido junto com Nao sabe ainda' }
      }
      if (row.nomeNaoInformado !== undefined && typeof row.nomeNaoInformado !== 'boolean') {
        return { ok: false, field: 'criancas', message: 'Marcacao de nome da crianca invalida' }
      }
    }
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
      if (row.nomeNaoInformado === true) crianca.nomeNaoInformado = true
      if (typeof row.sexo === 'string' && sexosValidos.has(row.sexo)) crianca.sexo = row.sexo as SexoCrianca
      if (situacao === 'gestacao' || situacao === 'presente_outra_pessoa') {
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

  const temViradaCartao = dados.motivosResultado.includes('virada_cartao')
  if (temViradaCartao) {
    const dia = Number(payload.viradaCartaoDia)
    const mes = Number(payload.viradaCartaoMes)
    if (dataViradaCartaoValida(dia, mes)) {
      dados.viradaCartaoDia = dia
      dados.viradaCartaoMes = mes
    }
  }

  const observacoes = normalizarTextoMultilinha(payload.observacoes, FICHA_OBSERVACOES_MAX_CHARS)
  if (observacoes) dados.observacoes = observacoes

  const consultoraNome = normalizarNomeConsultora(payload.consultoraNome)
  if (consultoraNome) dados.consultoraNome = consultoraNome

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

export function normalizarNumeroLancamento(valor: unknown) {
  if (typeof valor === 'number' && Number.isInteger(valor)) return valor
  if (typeof valor !== 'string') return null
  const somenteDigitos = valor.replace(/\D/g, '')
  if (!somenteDigitos) return null
  const numero = Number(somenteDigitos)
  return Number.isInteger(numero) ? numero : null
}

export function validarFichaParaConclusao(params: {
  ficha: FichaDadosRascunho
  clienteId: string | null
  numeroLancamento?: unknown
}): ValidacaoFichaConclusao {
  if (!params.clienteId) {
    return { ok: false, field: 'clienteId', message: 'Selecione ou cadastre uma cliente antes de concluir.' }
  }
  if (!params.ficha.consultoraNome || !validarNomeConsultora(params.ficha.consultoraNome)) {
    return { ok: false, field: 'consultoraNome', message: 'Informe o nome da consultora (apenas letras e espacos, 2 a 30 caracteres).' }
  }

  for (const crianca of params.ficha.criancas) {
    if (crianca.situacao === 'ja_nasceu') {
      if (crianca.idadeUnidade === 'meses' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 11)) {
        return { ok: false, field: 'criancas', message: 'Informe idade valida em meses.' }
      }
      if (crianca.idadeUnidade === 'anos' && (!crianca.idadeValor || crianca.idadeValor < 1 || crianca.idadeValor > 6)) {
        return { ok: false, field: 'criancas', message: 'Informe idade valida em anos.' }
      }
      if (!crianca.idadeUnidade) return { ok: false, field: 'criancas', message: 'Informe a idade da crianca.' }
    }
    if (crianca.situacao === 'gestacao' && crianca.dataPrevistaNascimento && !normalizarDataLocal(crianca.dataPrevistaNascimento)) {
      return { ok: false, field: 'criancas', message: 'Revise a data prevista de nascimento.' }
    }
    if (crianca.situacao === 'presente_outra_pessoa' && crianca.dataPrevistaNascimento && !normalizarDataLocal(crianca.dataPrevistaNascimento)) {
      return { ok: false, field: 'criancas', message: 'Revise a data prevista de nascimento.' }
    }
  }

  if (params.ficha.departamentos.length === 0) {
    return { ok: false, field: 'departamentos', message: 'Selecione ao menos um departamento.' }
  }
  if (!params.ficha.resultadoAtendimento) {
    return { ok: false, field: 'resultadoAtendimento', message: 'Selecione o resultado do atendimento.' }
  }
  if (params.ficha.motivosResultado.length === 0) {
    return { ok: false, field: 'motivosResultado', message: 'Selecione ao menos um motivo.' }
  }
  if (params.ficha.motivosResultado.includes('outro') && !params.ficha.motivoOutro?.trim()) {
    return { ok: false, field: 'motivoOutro', message: 'Informe o complemento de Outro.' }
  }
  if (params.ficha.motivosResultado.includes('virada_cartao')) {
    if (!dataViradaCartaoValida(params.ficha.viradaCartaoDia ?? 0, params.ficha.viradaCartaoMes ?? 0)) {
      return { ok: false, field: 'viradaCartao', message: 'Informe o dia e o mes da virada do cartao.' }
    }
  }

  const numeroLancamento = normalizarNumeroLancamento(params.numeroLancamento)
  if (params.ficha.resultadoAtendimento === 'sim') {
    if (!numeroLancamento || numeroLancamento < 1 || numeroLancamento > 999999) {
      return { ok: false, field: 'numeroLancamento', message: 'Informe o numero do lancamento.' }
    }
    return { ok: true, numeroLancamento }
  }

  return { ok: true, numeroLancamento: null }
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
