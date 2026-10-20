import { normalizarNomeCliente } from './clientes'
import { extrairDigitosTelefone } from './telefone'

export const FILTROS_ADICIONAIS = {
  atendimentoDe: '',
  atendimentoAte: '',
  tipoAtendimento: '',
  telefoneCliente: '',
  numeroLancamento: '',
  contato: '',
  departamentos: [] as string[],
  motivos: [] as string[],
  parentescos: [] as string[],
  motivoVisita: '',
  vinculoCliente: '',
  expiracao: '',
}
export type FiltrosAdicionais = typeof FILTROS_ADICIONAIS

export function lerFiltrosListagem(
  params: URLSearchParams,
  rascunhos = false,
): FiltrosAdicionais {
  const filtros = { ...FILTROS_ADICIONAIS }
  for (const key of Object.keys(filtros) as Array<keyof FiltrosAdicionais>) {
    if (key === 'departamentos' || key === 'motivos' || key === 'parentescos')
      filtros[key] = params
        .getAll(key)
        .flatMap((v) => v.split(','))
        .filter(Boolean)
    else filtros[key] = (params.get(key) ?? '').trim()
  }
  for (const key of ['atendimentoDe', 'atendimentoAte'] as const) {
    const valor = filtros[key]
    if (
      valor &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
        Number.isNaN(Date.parse(valor)) ||
        new Date(valor).toISOString().slice(0, 10) !== valor)
    )
      throw new Error('Período inválido.')
  }
  if (
    filtros.atendimentoDe &&
    filtros.atendimentoAte &&
    filtros.atendimentoDe > filtros.atendimentoAte
  )
    throw new Error('A data inicial deve ser anterior ou igual à final.')
  if (
    filtros.numeroLancamento &&
    (!/^\d{1,6}$/.test(filtros.numeroLancamento) ||
      Number(filtros.numeroLancamento) < 1)
  )
    throw new Error('Lançamento inválido.')
  const enums: Array<[string, string[]]> = [
    [
      'tipoAtendimento',
      rascunhos
        ? ['cliente', 'nao_cliente', 'nao_informado']
        : ['cliente', 'nao_cliente'],
    ],
    ['contato', ['com', 'sem']],
    ['vinculoCliente', ['com', 'sem']],
    ['expiracao', ['24h']],
  ]
  for (const [key, valores] of enums) {
    const valor = filtros[key as 'contato']
    if (valor && !valores.includes(valor)) throw new Error('Filtro inválido.')
  }
  if (
    filtros.telefoneCliente &&
    !extrairDigitosTelefone(filtros.telefoneCliente)
  )
    throw new Error('Informe dígitos para buscar telefone.')
  return filtros
}

export function dentroDoPeriodo(valor: string, de: string, ate: string) {
  if (!de && !ate) return true
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return false
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data)
  const parte = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  const dia = `${parte('year')}-${parte('month')}-${parte('day')}`
  return (!de || dia >= de) && (!ate || dia <= ate)
}

export function telefonePresente(valor: string | null | undefined) {
  return Boolean(valor?.trim())
}

export function filtrarDadosListagem(
  item: {
    data: string
    tipo: string | null
    clienteId: string | null
    telefone: string | null
    numeroLancamento?: number | null
    motivoVisita?: string | null
    expiraEm?: string
  },
  filtros: FiltrosAdicionais,
  now = Date.now(),
) {
  if (
    !dentroDoPeriodo(item.data, filtros.atendimentoDe, filtros.atendimentoAte)
  )
    return false
  if (
    filtros.tipoAtendimento &&
    (item.tipo ?? 'nao_informado') !== filtros.tipoAtendimento
  )
    return false
  if (
    filtros.numeroLancamento &&
    item.numeroLancamento !== Number(filtros.numeroLancamento)
  )
    return false
  if (filtros.motivoVisita && item.motivoVisita !== filtros.motivoVisita)
    return false
  if (
    filtros.vinculoCliente &&
    Boolean(item.clienteId) !== (filtros.vinculoCliente === 'com')
  )
    return false
  if (
    filtros.contato &&
    (item.tipo === 'nao_cliente' ||
      telefonePresente(item.telefone) !== (filtros.contato === 'com'))
  )
    return false
  const nacional = (valor: string | null) => {
    const d = extrairDigitosTelefone(valor)
    return d.startsWith('55') && d.length > 11 ? d.slice(2) : d
  }
  if (
    filtros.telefoneCliente &&
    (item.tipo === 'nao_cliente' ||
      !nacional(item.telefone).includes(nacional(filtros.telefoneCliente)))
  )
    return false
  if (
    filtros.expiracao &&
    (!item.expiraEm ||
      Date.parse(item.expiraEm) <= now ||
      Date.parse(item.expiraEm) > now + 86400000)
  )
    return false
  return true
}

export function correspondeNome(
  valor: string | null | undefined,
  busca: string,
) {
  const nome = normalizarNomeCliente(valor)
  return busca
    .trim()
    .split(/\s+/)
    .every((termo) => nome.includes(normalizarNomeCliente(termo)))
}

export async function lerPaginas<T>(
  carregar: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const itens: T[] = []
  for (let de = 0; ; de += 500) {
    const { data, error } = await carregar(de, de + 499)
    if (error) throw error
    itens.push(...(data ?? []))
    if (!data || data.length < 500) return itens
  }
}
