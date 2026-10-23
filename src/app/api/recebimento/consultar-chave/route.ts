import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { normalizarChave, erroChave } from '@/lib/recebimento/nfe-chave'
import { carregarConfigDfe } from '@/lib/recebimento/dfe-config'
import { reservarConsulta } from '@/lib/recebimento/dfe-limites'
import { enviarSoap, interpretarDfe } from '@/lib/recebimento/dfe-soap'
import { DfeError, type ResultadoDfe } from '@/lib/recebimento/dfe-contract'
import { importarXmlRecebimento } from '@/lib/recebimento/importar-xml'
import { XmlImportError } from '@/lib/recebimento/xml-upload'
import type { ResultadoXml } from '@/lib/recebimento/xml-upload-contract'

export const runtime = 'nodejs'
export const maxDuration = 120

function responder(body: ResultadoDfe, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(body.retryAfter ? { 'Retry-After': String(body.retryAfter) } : {}) } })
}

export async function POST(request: NextRequest) {
  const access = await requireModuleAccess('recebimento')
  if (!access.ok) return access.response
  if (!(await validateMaticUser()).authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  let chave: string
  try {
    // Limita o corpo efetivamente lido, inclusive sem Content-Length.
    const reader = request.body?.getReader()
    if (!reader) throw new Error('body')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 1024) { await reader.cancel(); throw new Error('size') }
      chunks.push(value)
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof input?.chave !== 'string') throw new Error('key')
    chave = normalizarChave(input.chave)
    const error = erroChave(chave)
    if (error) return responder({ estado: 'documento_invalido', message: error }, 400)
  } catch { return responder({ estado: 'documento_invalido', message: 'Informe somente a chave de acesso de 44 números.' }, 400) }

  let result: ResultadoXml | undefined
  try {
    const supabase = await createClient()
    const { data: existente, error } = await supabase.from('nfe').select('id,numero_nf,xml_sha256,xml_drive_status').eq('xml_chave_acesso', chave).maybeSingle()
    if (error) throw new DfeError('temporario', 'Não foi possível verificar se esta nota já está cadastrada. Tente mais tarde.')
    if (existente && /^[a-f0-9]{64}$/.test(existente.xml_sha256 ?? '')) {
      result = { file: `${existente.numero_nf}.xml`, status: 'parcial', banco: 'existente', drive: 'pendente', nfe_id: existente.id, numero_nf: existente.numero_nf }
      if (existente.xml_drive_status === 'salvo') {
        result.status = 'ok'; result.drive = 'existente'
        return responder({ estado: 'ja_cadastrada', message: 'Esta nota já está cadastrada e disponível no Novo recebimento. O XML já foi salvo no Drive.', resultado: result })
      }
    }
    // Uma pendência no Drive justifica recuperar o original outra vez. O RPC
    // continua comparando identidade e hash, sem substituir a nota cadastrada.
    const config = carregarConfigDfe()
    const reserva = await reservarConsulta(config.cnpj, config.ambiente, chave)
    let bloqueio = 0, intervalo = 60
    try {
      const documento = await interpretarDfe(await enviarSoap(config, chave), config.ambiente, chave)
      console.info('[RECEBIMENTO DFE]', { etapa: 'consulta', codigo: documento.cStat, tipo: documento.tipo })
      if (documento.tipo !== 'completo') {
        intervalo = documento.tipo === 'indisponivel' ? 3600 : 60
        return responder({ estado: documento.tipo,
          message: documento.tipo === 'manifestacao_necessaria' ? 'É necessário realizar a manifestação fiscal para obter o XML completo. Solicite a avaliação do responsável fiscal. Nenhuma manifestação foi feita pelo aplicativo. Depois, consulte novamente ou solicite o XML ao fornecedor.'
            : documento.tipo === 'resumo' ? 'Foi localizado apenas o resumo da nota, sem os produtos. Para liberar o XML completo, solicite ao responsável fiscal a manifestação adequada, ou peça o XML ao fornecedor. Nenhuma manifestação foi feita pelo aplicativo e nenhum cadastro novo foi criado. Depois, consulte novamente.'
              : 'A nota não foi localizada ou não está disponível para esta empresa. Confira a chave. A distribuição oficial tem prazo de disponibilidade; solicite o XML ao fornecedor se necessário.', retryAfter: intervalo })
      }
      result = { file: `${chave.slice(25, 34).replace(/^0+/, '')}.xml`, status: 'erro', banco: 'erro', drive: 'nao_enviado' }
      await importarXmlRecebimento(supabase, documento.bytes, result, 0, { chaveEsperada: chave, cnpjDestinatario: config.cnpj, ambiente: config.ambiente })
      return responder({ estado: result.banco === 'existente' ? 'ja_cadastrada' : 'importada', message: result.banco === 'existente' ? 'Esta nota já está cadastrada e disponível no Novo recebimento. XML confirmado no Drive.' : 'Nota localizada e importada. Disponível no Novo recebimento. XML salvo no Drive.', resultado: result })
    } catch (error) {
      if (error instanceof DfeError) { bloqueio = error.codigo === '656' ? 3600 : 0; intervalo = error.retryAfter ?? 60 }
      throw error
    } finally { await reserva.finalizar(bloqueio, intervalo) }
  } catch (error) {
    const fiscal = error instanceof DfeError
    console.error('[RECEBIMENTO DFE]', { etapa: result?.banco && result.banco !== 'erro' ? 'drive' : 'consulta_ou_importacao', estado: fiscal ? error.estado : 'falha', codigo: fiscal ? error.codigo : error instanceof XmlImportError ? error.code : 'inesperado' })
    if (result?.banco && result.banco !== 'erro') {
      if (result.status === 'ok') return responder({ estado: result.banco === 'existente' ? 'ja_cadastrada' : 'importada', message: 'Nota cadastrada e XML salvo no Drive. O controle de consultas ficou indisponível; aguarde uma hora antes de novas consultas.', resultado: result, retryAfter: 3600 })
      result.error = error instanceof XmlImportError && error.code === 'drive_confirmacao'
        ? 'O XML já está no Drive, mas a confirmação no aplicativo ficou pendente. Consulte a mesma chave novamente para concluir.'
        : error instanceof XmlImportError || fiscal ? error.message : 'Nota cadastrada; XML pendente no Drive. Tente novamente mais tarde com a mesma chave ou envie o XML.'
      if (error instanceof XmlImportError) result.error_code = error.code
      return responder({ estado: result.banco === 'existente' ? 'ja_cadastrada' : 'importada', message: 'A nota está cadastrada e disponível no Novo recebimento. A gravação no Drive ainda precisa ser concluída.', resultado: result, retryAfter: fiscal ? error.retryAfter : 60 })
    }
    return responder({ estado: fiscal ? error.estado : error instanceof XmlImportError ? 'documento_invalido' : 'temporario', message: fiscal || error instanceof XmlImportError ? error.message : 'Não foi possível concluir a consulta. Tente mais tarde.', retryAfter: fiscal ? error.retryAfter : 60 }, fiscal ? error.httpStatus : error instanceof XmlImportError ? 422 : 503)
  }
}
