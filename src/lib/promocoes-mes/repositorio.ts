import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArquivoAnexoValidado } from '@/lib/pedidos-personalizados/server/anexos-arquivo'
import {
  BUCKET_PROMOCOES_MES,
  EXPIRACAO_URL_PROMOCAO_SEGUNDOS,
  MAX_ARQUIVOS_PROMOCAO,
  type FormularioPromocao,
} from './formulario'
import { classificarVigencia, type SituacaoPromocao } from './vigencia'

export class ErroPromocao extends Error {
  constructor(readonly codigo: string, readonly status: 404 | 422 | 500, readonly mensagem: string) {
    super(codigo)
  }
}

type MotivoPendencia = 'FALHA_APOS_UPLOAD' | 'REMOCAO_ARQUIVO' | 'REMOCAO_PROMOCAO'

type ArquivoRow = {
  id: string
  promocao_id: string
  caminho_objeto: string
  nome_original: string
  mime_type: string
  tamanho_bytes: number
  ordem: number
}
type PromocaoRow = { id: string; titulo: string; inicio: string; fim: string; created_at: string; updated_at: string }

export type ArquivoPromocao = {
  id: string
  nome: string
  mimeType: string
  tamanhoBytes: number
  ordem: number
  url?: string
}
export type Promocao = {
  id: string
  titulo: string
  inicio: string
  fim: string
  situacao: SituacaoPromocao
  arquivos: ArquivoPromocao[]
}

const COLUNAS_ARQUIVO = 'id, promocao_id, caminho_objeto, nome_original, mime_type, tamanho_bytes, ordem'

function textoErro(erro: unknown) {
  if (erro && typeof erro === 'object' && 'message' in erro) return String((erro as { message: unknown }).message).slice(0, 500)
  return String(erro).slice(0, 500)
}

/** Remove objetos; o que não puder ser removido fica registrado em promocoes_mes_storage_pendencias. */
export async function removerObjetos(client: SupabaseClient, caminhos: string[], motivo: MotivoPendencia) {
  if (caminhos.length === 0) return { falhas: [] as string[] }
  let erro: unknown = null
  try {
    const { error } = await client.storage.from(BUCKET_PROMOCOES_MES).remove(caminhos)
    erro = error
  } catch (e) {
    erro = e
  }
  if (!erro) return { falhas: [] as string[] }
  console.error('[PROMOCOES MES] falha ao remover objetos', { motivo, quantidade: caminhos.length, erro: textoErro(erro) })
  try {
    await client.from('promocoes_mes_storage_pendencias').upsert(
      caminhos.map((caminho_objeto) => ({ caminho_objeto, motivo, ultimo_erro: textoErro(erro) })),
      { onConflict: 'caminho_objeto' },
    )
  } catch (e) {
    console.error('[PROMOCOES MES] falha ao registrar pendência de storage', { erro: textoErro(e) })
  }
  return { falhas: caminhos }
}

async function enviarObjetos(client: SupabaseClient, promocaoId: string, arquivos: ArquivoAnexoValidado[]) {
  const enviados: Array<{ arquivo: ArquivoAnexoValidado; caminho: string; id: string }> = []
  for (const arquivo of arquivos) {
    const id = crypto.randomUUID()
    const caminho = `${promocaoId}/${id}.${arquivo.extensao}`
    const { error } = await client.storage
      .from(BUCKET_PROMOCOES_MES)
      .upload(caminho, arquivo.bytes, { contentType: arquivo.mimeType, upsert: false })
    if (error) {
      await removerObjetos(client, [...enviados.map((e) => e.caminho), caminho], 'FALHA_APOS_UPLOAD')
      throw new ErroPromocao('UPLOAD_FALHOU', 500, `Não foi possível enviar "${arquivo.nomeOriginal}". Nada foi salvo.`)
    }
    enviados.push({ arquivo, caminho, id })
  }
  return enviados
}

function linhasArquivos(promocaoId: string, enviados: Awaited<ReturnType<typeof enviarObjetos>>, ordemInicial: number) {
  return enviados.map((e, i) => ({
    id: e.id,
    promocao_id: promocaoId,
    caminho_objeto: e.caminho,
    nome_original: e.arquivo.nomeOriginal,
    mime_type: e.arquivo.mimeType,
    tamanho_bytes: e.arquivo.tamanhoBytes,
    ordem: ordemInicial + i,
  }))
}

function mapear(p: PromocaoRow, arquivos: ArquivoRow[], hoje: string, urls?: Map<string, string>): Promocao {
  return {
    id: p.id,
    titulo: p.titulo,
    inicio: p.inicio,
    fim: p.fim,
    situacao: classificarVigencia(p.inicio, p.fim, hoje),
    arquivos: arquivos
      .filter((a) => a.promocao_id === p.id)
      .sort((a, b) => a.ordem - b.ordem || a.nome_original.localeCompare(b.nome_original))
      .map((a) => ({
        id: a.id,
        nome: a.nome_original,
        mimeType: a.mime_type,
        tamanhoBytes: a.tamanho_bytes,
        ordem: a.ordem,
        ...(urls?.get(a.caminho_objeto) ? { url: urls.get(a.caminho_objeto) } : {}),
      })),
  }
}

async function assinar(client: SupabaseClient, arquivos: ArquivoRow[]) {
  const urls = new Map<string, string>()
  if (arquivos.length === 0) return urls
  const { data, error } = await client.storage
    .from(BUCKET_PROMOCOES_MES)
    .createSignedUrls(arquivos.map((a) => a.caminho_objeto), EXPIRACAO_URL_PROMOCAO_SEGUNDOS)
  if (error) throw new ErroPromocao('URL_ASSINADA_FALHOU', 500, 'Não foi possível gerar os links dos arquivos.')
  for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  return urls
}

async function buscarArquivos(client: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return [] as ArquivoRow[]
  const { data, error } = await client.from('promocoes_mes_arquivos').select(COLUNAS_ARQUIVO).in('promocao_id', ids)
  if (error) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar os arquivos.')
  return (data ?? []) as ArquivoRow[]
}

export async function listarPromocoesAdmin(client: SupabaseClient, hoje: string) {
  const { data, error } = await client.from('promocoes_mes').select('id, titulo, inicio, fim, created_at, updated_at')
    .order('inicio', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar as promoções.')
  const rows = (data ?? []) as PromocaoRow[]
  const arquivos = await buscarArquivos(client, rows.map((r) => r.id))
  return rows.map((r) => mapear(r, arquivos, hoje))
}

export async function obterPromocaoComUrls(client: SupabaseClient, id: string, hoje: string) {
  const { data, error } = await client.from('promocoes_mes').select('id, titulo, inicio, fim, created_at, updated_at').eq('id', id).maybeSingle()
  if (error) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar a promoção.')
  if (!data) throw new ErroPromocao('NAO_ENCONTRADA', 404, 'Promoção não encontrada.')
  const arquivos = await buscarArquivos(client, [id])
  return mapear(data as PromocaoRow, arquivos, hoje, await assinar(client, arquivos))
}

/** Consultoras: somente promoções com inicio <= hoje <= fim (data operacional BRT calculada no servidor). */
export async function listarVigentes(client: SupabaseClient, hoje: string) {
  const { data, error } = await client.from('promocoes_mes').select('id, titulo, inicio, fim, created_at, updated_at')
    .lte('inicio', hoje).gte('fim', hoje).order('inicio', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar as promoções.')
  const rows = (data ?? []) as PromocaoRow[]
  const arquivos = await buscarArquivos(client, rows.map((r) => r.id))
  const urls = await assinar(client, arquivos)
  return rows.map((r) => mapear(r, arquivos, hoje, urls))
}

export async function criarPromocao(client: SupabaseClient, form: FormularioPromocao, email: string, hoje: string) {
  if (form.arquivos.length === 0) throw new ErroPromocao('SEM_ARQUIVOS', 422, 'Anexe ao menos um arquivo.')
  const id = crypto.randomUUID()
  const enviados = await enviarObjetos(client, id, form.arquivos)
  const caminhos = enviados.map((e) => e.caminho)
  const { error: erroPromo } = await client.from('promocoes_mes')
    .insert({ id, titulo: form.titulo, inicio: form.inicio, fim: form.fim, criado_por: email })
  if (erroPromo) {
    await removerObjetos(client, caminhos, 'FALHA_APOS_UPLOAD')
    throw new ErroPromocao('GRAVACAO_FALHOU', 500, 'Não foi possível salvar a promoção. Nada foi salvo.')
  }
  const { error: erroArq } = await client.from('promocoes_mes_arquivos').insert(linhasArquivos(id, enviados, 0))
  if (erroArq) {
    await client.from('promocoes_mes').delete().eq('id', id)
    await removerObjetos(client, caminhos, 'FALHA_APOS_UPLOAD')
    throw new ErroPromocao('GRAVACAO_FALHOU', 500, 'Não foi possível salvar os arquivos. Nada foi salvo.')
  }
  return obterPromocaoComUrls(client, id, hoje)
}

export async function atualizarPromocao(client: SupabaseClient, id: string, form: FormularioPromocao, hoje: string) {
  const { data: existente, error: erroBusca } = await client.from('promocoes_mes').select('id').eq('id', id).maybeSingle()
  if (erroBusca) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar a promoção.')
  if (!existente) throw new ErroPromocao('NAO_ENCONTRADA', 404, 'Promoção não encontrada.')

  const atuais = await buscarArquivos(client, [id])
  const idsAtuais = new Set(atuais.map((a) => a.id))
  if (form.remover.some((r) => !idsAtuais.has(r))) throw new ErroPromocao('ARQUIVO_INEXISTENTE', 422, 'Arquivo a remover não pertence à promoção.')
  const aRemover = atuais.filter((a) => form.remover.includes(a.id))
  const restantes = atuais.length - aRemover.length
  const total = restantes + form.arquivos.length
  if (total < 1) throw new ErroPromocao('SEM_ARQUIVOS', 422, 'A promoção precisa ter ao menos um arquivo.')
  if (total > MAX_ARQUIVOS_PROMOCAO) throw new ErroPromocao('ARQUIVOS_DEMAIS', 422, `A promoção aceita até ${MAX_ARQUIVOS_PROMOCAO} arquivos.`)

  const enviados = await enviarObjetos(client, id, form.arquivos)
  const caminhosNovos = enviados.map((e) => e.caminho)
  const proximaOrdem = atuais.reduce((max, a) => Math.max(max, a.ordem), -1) + 1
  if (enviados.length > 0) {
    const { error } = await client.from('promocoes_mes_arquivos').insert(linhasArquivos(id, enviados, proximaOrdem))
    if (error) {
      await removerObjetos(client, caminhosNovos, 'FALHA_APOS_UPLOAD')
      throw new ErroPromocao('GRAVACAO_FALHOU', 500, 'Não foi possível salvar os arquivos. Nada foi alterado.')
    }
  }
  const { error: erroUpdate } = await client.from('promocoes_mes')
    .update({ titulo: form.titulo, inicio: form.inicio, fim: form.fim }).eq('id', id)
  if (erroUpdate) {
    if (enviados.length > 0) await client.from('promocoes_mes_arquivos').delete().in('id', enviados.map((e) => e.id))
    await removerObjetos(client, caminhosNovos, 'FALHA_APOS_UPLOAD')
    throw new ErroPromocao('GRAVACAO_FALHOU', 500, 'Não foi possível salvar a promoção. Nada foi alterado.')
  }
  if (aRemover.length > 0) {
    const { error } = await client.from('promocoes_mes_arquivos').delete().in('id', aRemover.map((a) => a.id))
    if (error) throw new ErroPromocao('GRAVACAO_FALHOU', 500, 'Dados salvos, mas não foi possível remover alguns arquivos. Tente novamente.')
    await removerObjetos(client, aRemover.map((a) => a.caminho_objeto), 'REMOCAO_ARQUIVO')
  }
  return obterPromocaoComUrls(client, id, hoje)
}

export async function excluirPromocao(client: SupabaseClient, id: string) {
  const { data: existente, error: erroBusca } = await client.from('promocoes_mes').select('id').eq('id', id).maybeSingle()
  if (erroBusca) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar a promoção.')
  if (!existente) throw new ErroPromocao('NAO_ENCONTRADA', 404, 'Promoção não encontrada.')
  const arquivos = await buscarArquivos(client, [id])
  const { error } = await client.from('promocoes_mes').delete().eq('id', id)
  if (error) throw new ErroPromocao('GRAVACAO_FALHOU', 500, 'Não foi possível excluir a promoção.')
  const { falhas } = await removerObjetos(client, arquivos.map((a) => a.caminho_objeto), 'REMOCAO_PROMOCAO')
  return { objetosPendentes: falhas.length }
}

export type RelatorioReconciliacao = {
  aplicado: boolean
  objetosOrfaos: string[]
  arquivosSemObjeto: string[]
  pendenciasRegistradas: number
  removidos: number
  falhas: number
}

const FOLGA_UPLOAD_EM_ANDAMENTO_MS = 15 * 60 * 1000

async function listarObjetosDoBucket(client: SupabaseClient) {
  const objetos: Array<{ caminho: string; criadoEm: string | null }> = []
  const { data: pastas, error } = await client.storage.from(BUCKET_PROMOCOES_MES).list('', { limit: 1000 })
  if (error) throw new ErroPromocao('STORAGE_FALHOU', 500, 'Não foi possível listar o Storage.')
  for (const pasta of pastas ?? []) {
    if (pasta.id) { objetos.push({ caminho: pasta.name, criadoEm: pasta.created_at ?? null }); continue }
    const { data: itens, error: erroPasta } = await client.storage.from(BUCKET_PROMOCOES_MES).list(pasta.name, { limit: 1000 })
    if (erroPasta) throw new ErroPromocao('STORAGE_FALHOU', 500, 'Não foi possível listar o Storage.')
    for (const item of itens ?? []) objetos.push({ caminho: `${pasta.name}/${item.name}`, criadoEm: item.created_at ?? null })
  }
  return objetos
}

/**
 * Compara Storage × banco. Objetos sem linha (e fora da janela de upload em andamento) e pendências
 * registradas são removidos quando `aplicar` = true; linhas sem objeto só são reportadas.
 */
export async function reconciliarStorage(client: SupabaseClient, aplicar: boolean, agora = new Date()): Promise<RelatorioReconciliacao> {
  const [objetos, { data: linhas, error: erroLinhas }, { data: pendencias, error: erroPend }] = await Promise.all([
    listarObjetosDoBucket(client),
    client.from('promocoes_mes_arquivos').select('caminho_objeto'),
    client.from('promocoes_mes_storage_pendencias').select('caminho_objeto'),
  ])
  if (erroLinhas || erroPend) throw new ErroPromocao('CONSULTA_FALHOU', 500, 'Não foi possível consultar o banco.')
  const noBanco = new Set((linhas ?? []).map((l: { caminho_objeto: string }) => l.caminho_objeto))
  const noStorage = new Set(objetos.map((o) => o.caminho))
  const limite = agora.getTime() - FOLGA_UPLOAD_EM_ANDAMENTO_MS
  const orfaos = objetos
    .filter((o) => !noBanco.has(o.caminho) && (!o.criadoEm || new Date(o.criadoEm).getTime() < limite))
    .map((o) => o.caminho)
  const semObjeto = [...noBanco].filter((c) => !noStorage.has(c))
  const caminhosPendentes = (pendencias ?? []).map((p: { caminho_objeto: string }) => p.caminho_objeto)
  const relatorio: RelatorioReconciliacao = {
    aplicado: aplicar,
    objetosOrfaos: orfaos,
    arquivosSemObjeto: semObjeto,
    pendenciasRegistradas: caminhosPendentes.length,
    removidos: 0,
    falhas: 0,
  }
  if (!aplicar) return relatorio

  const alvo = [...new Set([...orfaos, ...caminhosPendentes.filter((c) => !noBanco.has(c))])]
  if (alvo.length > 0) {
    const { error } = await client.storage.from(BUCKET_PROMOCOES_MES).remove(alvo)
    if (error) {
      relatorio.falhas = alvo.length
      await client.from('promocoes_mes_storage_pendencias').upsert(
        alvo.map((caminho_objeto) => ({ caminho_objeto, motivo: 'REMOCAO_ARQUIVO', ultimo_erro: textoErro(error) })),
        { onConflict: 'caminho_objeto' },
      )
    } else {
      relatorio.removidos = alvo.length
    }
  }
  if (relatorio.falhas === 0 && caminhosPendentes.length > 0) {
    // Pendência cujo objeto já não existe (ou foi removido agora) está resolvida.
    await client.from('promocoes_mes_storage_pendencias').delete().in('caminho_objeto', caminhosPendentes.filter((c) => !noBanco.has(c)))
  }
  return relatorio
}
