import {
  calcularPainelDecorisi,
  calcularPapelDecorisi,
  DIMENSAO_MAXIMA_DECORISI_CM,
  subtotalDecorisiCentavos,
} from './calculos'
import { produtoComercialDecorisi } from './catalogo'
import type { ItemDecorisi } from './tipos'

export type AnexoFormularioDecorisi = {
  id: string
  slot: number
  nome_original: string
  mime_type: string
  tamanho_bytes: number
}
export type MedidaFormularioDecorisi = {
  chave: string
  ambiente: string
  largura: string
  altura: string
}
export type ArtigoFormularioDecorisi = Omit<ItemDecorisi, 'id' | 'medidas'> & {
  catalogoPapel?: 'DB' | 'XP'
  produtoRespondido?: boolean
  arteRespondida?: boolean
  id: string
  medidas: MedidaFormularioDecorisi[]
  anexos: AnexoFormularioDecorisi[]
}
export type IdentificacaoFormularioDecorisi = {
  unidade: string
  consultora: string
  cliente: string
  telefone: string
}
export type OpcoesFormularioDecorisi = {
  db: Array<{
    id: string
    referencia: string
    repeticao_m: string | number
    versao: number
  }>
  pf: string[]
  unidades: Array<{ id: string; chave: string; nome: string }>
  precos: Array<{
    produto_id_sgi: number
    codigo: string
    descricao: string | null
    preco: string | number | null
    ativo: boolean | null
    fora_linha: boolean | null
    ultima_validacao_sgi: string | null
  }>
}
export type PedidoFormularioDecorisi = {
  id: string
  version: number
  status: string
  unidade_id: string
  consultora: string
  cliente: string
  telefone_normalizado: string
  itens: Array<{
    id: string
    ordem: number
    tipo: ItemDecorisi['tipo']
    classificacao: ItemDecorisi['classificacao']
    referencia_db_id: string | null
    referencia_pf: string | null
    descricao: string | null
    observacoes: string | null
    medidas: Array<{
      ordem: number
      ambiente: string | null
      largura_cm: number | null
      altura_cm: number | null
    }>
    anexos: AnexoFormularioDecorisi[]
  }>
}
export function novaMedidaDecorisi(): MedidaFormularioDecorisi {
  return { chave: crypto.randomUUID(), ambiente: '', largura: '', altura: '' }
}
export function novoArtigoDecorisi(): ArtigoFormularioDecorisi {
  return {
    id: crypto.randomUUID(),
    produtoRespondido: false,
    arteRespondida: false,
    tipo: 'PAPEL',
    classificacao: 'CATALOGO',
    referencia: null,
    descricao: null,
    observacoes: null,
    medidas: [novaMedidaDecorisi()],
    anexos: [],
  }
}
/** Entrada do formulário em centésimos de metro, limitada a quatro dígitos. */
export function mascararMedidaDecorisi(valor: string): string {
  const digitos = valor
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 4)
  if (!digitos) return ''
  const preenchido = digitos.padStart(3, '0')
  return `${preenchido.slice(0, -2)},${preenchido.slice(-2)}`
}
/** Edita dígitos, preservando a posição lógica do cursor mesmo junto à vírgula. */
export function editarMedidaDecorisi(
  valor: string,
  inicio: number,
  fim: number,
  entrada: string,
  acao: 'inserir' | 'Backspace' | 'Delete' = 'inserir',
): { valor: string; cursor: number } {
  if (acao === 'inserir' && /\D/.test(entrada)) return { valor, cursor: inicio }
  let antes = valor.slice(0, inicio).replace(/\D/g, '')
  let depois = valor.slice(fim).replace(/\D/g, '')
  if (inicio === fim && acao === 'Backspace') antes = antes.slice(0, -1)
  if (inicio === fim && acao === 'Delete') depois = depois.slice(1)
  const novos = acao === 'inserir' ? entrada.replace(/\D/g, '') : ''
  let aceitos = ''
  for (const digito of novos) {
    if ((antes + aceitos + digito + depois).replace(/^0+/, '').length > 4) break
    aceitos += digito
  }
  const resultado = mascararMedidaDecorisi(antes + aceitos + depois)
  const restantes = depois.length
  let cursor = resultado.length
  for (
    let i = resultado.length - 1, vistos = 0;
    i >= 0 && vistos < restantes;
    i--
  ) {
    if (/\d/.test(resultado[i])) {
      vistos++
      cursor = i
    }
  }
  return { valor: resultado, cursor }
}
export function normalizarMedidaDecorisi(valor: string): string {
  if (!valor) return ''
  const [inteiro, decimal = ''] = valor.replace('.', ',').split(',')
  return `${inteiro.replace(/^0+(?=\d)/, '') || '0'},${decimal.padEnd(2, '0')}`
}
export function errosArtigoDecorisi(
  artigo: ArtigoFormularioDecorisi,
  opcoes: OpcoesFormularioDecorisi,
  completo = false,
): Record<string, string> {
  const erros: Record<string, string> = {}
  const referencia = opcoes.db.find((r) => r.referencia === artigo.referencia)
  if (
    completo &&
    (artigo.tipo === 'PAPEL'
      ? !referencia
      : artigo.classificacao === 'CATALOGO' &&
        !opcoes.pf.includes(artigo.referencia ?? ''))
  )
    erros[`${artigo.id}-referencia`] =
      'Selecione a referência original do catálogo.'
  if (
    completo &&
    artigo.classificacao === 'PERSONALIZADO' &&
    !artigo.descricao?.trim()
  )
    erros[`${artigo.id}-descricao`] =
      'Descreva a personalização antes do fechamento.'
  artigo.medidas.forEach((m, indice) => {
    if (m.ambiente.length > 30)
      erros[`${m.chave}-ambiente`] =
        'Identifique a parede com até 30 caracteres.'
    for (const dim of ['largura', 'altura'] as const) {
      try {
        const cm = metrosParaCentimetrosDecorisi(m[dim])
        if (cm === null && completo)
          erros[`${m.chave}-${dim}`] =
            `Informe a ${dim} da parede ${indice + 1}.`
        if (
          dim === 'altura' &&
          cm !== null &&
          artigo.tipo === 'PAPEL' &&
          referencia
        ) {
          const repeticao =
            metrosParaCentimetrosDecorisi(
              String(referencia.repeticao_m),
              true,
            ) ?? 0
          if (cm + repeticao + 5 > 1000)
            erros[`${m.chave}-${dim}`] =
              `A altura da parede ${indice + 1} não cabe no rolo de 10 m com repetição e margem de 5 cm. Máximo: ${((1000 - repeticao - 5) / 100).toFixed(2).replace('.', ',')} m.`
        }
      } catch (erro) {
        erros[`${m.chave}-${dim}`] =
          `Parede ${indice + 1}: ${(erro as Error).message}`
      }
    }
  })
  return erros
}
/** Parse decimal textual: metros -> cm sem arredondamento de ponto flutuante. */
export function metrosParaCentimetrosDecorisi(
  valor: string,
  permitirZero = false,
): number | null {
  if (!valor.trim()) return null
  const normalizado = valor.trim().replace(',', '.')
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalizado))
    throw new Error('Use metros com até duas casas decimais.')
  const [inteiro, fracao = ''] = normalizado.split('.')
  const cm = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
  if (cm < (permitirZero ? 0 : 1) || cm > DIMENSAO_MAXIMA_DECORISI_CM)
    throw new Error(
      'Informe uma medida maior que zero dentro do limite permitido.',
    )
  return cm
}
export function montarItensFormularioDecorisi(
  artigos: ArtigoFormularioDecorisi[],
): ItemDecorisi[] {
  if (artigos.length < 1 || artigos.length > 10)
    throw new Error('Inclua de 1 a 10 produtos.')
  return artigos.map((artigo) => {
    if (
      artigo.tipo === 'PAPEL' &&
      artigo.referencia &&
      artigo.catalogoPapel &&
      !artigo.referencia.startsWith(artigo.catalogoPapel)
    )
      throw new Error('A referência não pertence ao catálogo escolhido.')
    const { medidas } = artigo
    const item = {
      id: artigo.id,
      tipo: artigo.tipo,
      classificacao: artigo.classificacao,
      referencia: artigo.referencia,
      descricao: artigo.descricao,
      observacoes: artigo.observacoes,
    }
    if (medidas.length > 20) throw new Error('Use até 20 medidas por produto.')
    return {
      ...item,
      medidas: medidas.map((m) => ({
        ambiente: m.ambiente || null,
        larguraCm: metrosParaCentimetrosDecorisi(m.largura),
        alturaCm: metrosParaCentimetrosDecorisi(m.altura),
      })),
    }
  })
}
export function procurarArteCatalogo(
  artigos: ArtigoFormularioDecorisi[],
  artigo: ArtigoFormularioDecorisi,
): string | null {
  if (artigo.classificacao !== 'CATALOGO' || !artigo.referencia) return null
  return (
    artigos.find(
      (a) =>
        a.id !== artigo.id &&
        a.classificacao === 'CATALOGO' &&
        a.tipo === artigo.tipo &&
        a.referencia === artigo.referencia,
    )?.id ?? null
  )
}
export function carregarArtigosDecorisi(
  pedido: PedidoFormularioDecorisi,
  opcoes: OpcoesFormularioDecorisi,
): ArtigoFormularioDecorisi[] {
  const metro = (cm: number | null) =>
    cm === null
      ? ''
      : `${Math.floor(cm / 100)},${String(cm % 100).padStart(2, '0')}`
  return [...pedido.itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => ({
      id: i.id,
      tipo: i.tipo,
      classificacao: i.classificacao,
      referencia:
        i.tipo === 'PAPEL'
          ? (opcoes.db.find((r) => r.id === i.referencia_db_id)?.referencia ??
            null)
          : i.referencia_pf,
      descricao: i.descricao,
      observacoes: i.observacoes,
      anexos: [...i.anexos].sort((a, b) => a.slot - b.slot),
      medidas: [...i.medidas]
        .sort((a, b) => a.ordem - b.ordem)
        .map((m) => ({
          chave: crypto.randomUUID(),
          ambiente: m.ambiente ?? '',
          largura: metro(m.largura_cm),
          altura: metro(m.altura_cm),
        })),
    }))
}
export function preverArtigoDecorisi(
  artigo: ArtigoFormularioDecorisi,
  opcoes: OpcoesFormularioDecorisi,
) {
  const produto = produtoComercialDecorisi(artigo.tipo, artigo.classificacao)
  const preco = opcoes.precos.find(
    (p) =>
      Number(p.produto_id_sgi) === produto.produtoIdSgi &&
      p.codigo === produto.codigo,
  )
  try {
    const [item] = montarItensFormularioDecorisi([artigo])
    if (
      !item.medidas.length ||
      item.medidas.some((m) => m.larguraCm === null || m.alturaCm === null)
    )
      return { produto, pendencia: 'Complete as medidas para calcular.' }
    const medidas = item.medidas.map((m) => ({
      larguraCm: m.larguraCm!,
      alturaCm: m.alturaCm!,
    }))
    const referencia = opcoes.db.find((r) => r.referencia === artigo.referencia)
    if (
      (artigo.tipo === 'PAPEL' && !referencia) ||
      (artigo.tipo === 'PAINEL' &&
        artigo.classificacao === 'CATALOGO' &&
        !opcoes.pf.includes(artigo.referencia ?? ''))
    )
      return { produto, pendencia: 'Selecione uma referência para calcular.' }
    const calculo =
      artigo.tipo === 'PAPEL'
        ? calcularPapelDecorisi(
            medidas,
            metrosParaCentimetrosDecorisi(
              String(referencia!.repeticao_m),
              true,
            ) ?? 0,
          )
        : calcularPainelDecorisi(medidas)
    // Repetição zero é válida, ao contrário de uma dimensão zero.
    if (
      !preco ||
      !preco.ativo ||
      preco.fora_linha !== false ||
      preco.preco === null
    )
      return {
        produto,
        quantidade: calculo.quantidade,
        pendencia: 'Preço indisponível. Atualize os preços antes de continuar.',
      }
    const subtotal = subtotalDecorisiCentavos(calculo.quantidade, preco.preco)
    return {
      produto,
      quantidade: calculo.quantidade,
      preco: String(preco.preco),
      subtotal,
    }
  } catch (erro) {
    if (erro instanceof Error && erro.message === 'PRECO_DECORISI_INVALIDO')
      return {
        produto,
        pendencia: 'Preço indisponível. Atualize os preços antes de continuar.',
      }
    return {
      produto,
      pendencia:
        erro instanceof Error && !/^[A-Z_]+$/.test(erro.message)
          ? erro.message
          : 'Revise as medidas: a altura pode exceder o comprimento do rolo.',
    }
  }
}
export function errosFormularioDecorisi(
  artigos: ArtigoFormularioDecorisi[],
  identificacao: IdentificacaoFormularioDecorisi,
) {
  const erros: Record<string, string> = {}
  if (!identificacao.unidade) erros.unidade = 'Selecione a unidade.'
  if (
    identificacao.consultora.trim().length < 2 ||
    identificacao.consultora.trim().length > 20
  )
    erros.consultora = 'Informe a consultora (2 a 20 caracteres).'
  if (!identificacao.cliente.trim() || identificacao.cliente.trim().length > 40)
    erros.cliente = 'Informe o cliente (até 40 caracteres).'
  const telefone = identificacao.telefone.replace(/\D/g, '')
  if (!/^\d{10,11}$/.test(telefone) || telefone.startsWith('00'))
    erros.telefone = 'Informe um telefone válido.'
  artigos.forEach((a) =>
    a.medidas.forEach((m) => {
      for (const campo of ['largura', 'altura'] as const) {
        try {
          metrosParaCentimetrosDecorisi(m[campo])
        } catch (e) {
          erros[`${m.chave}-${campo}`] = (e as Error).message
        }
      }
    }),
  )
  return erros
}
export function formatarCentavosDecorisi(valor: string): string {
  const n = BigInt(valor)
  const inteiro = (n / BigInt(100))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${inteiro},${(n % BigInt(100)).toString().padStart(2, '0')}`
}
export class ErroApiFormularioDecorisi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem)
  }
}
export async function apiFormularioDecorisi<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const dados = await response.json()
  if (!response.ok || dados.ok === false)
    throw new ErroApiFormularioDecorisi(
      response.status,
      dados.erro ?? dados.codigo ?? 'ERRO',
      dados.mensagem ?? 'Não foi possível concluir a operação.',
    )
  return dados as T
}
