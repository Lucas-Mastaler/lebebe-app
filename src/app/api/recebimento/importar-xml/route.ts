import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { lerXmlRecebimento, XmlImportError, XML_MAX_BYTES, XML_MAX_FILES } from '@/lib/recebimento/xml-upload'
import { salvarXmlDrive, sha256Xml } from '@/lib/google/drive-xml'
import type { ResultadoXml } from '@/lib/recebimento/xml-upload-contract'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const access = await requireModuleAccess('recebimento')
  if (!access.ok) return access.response
  const auth = await validateMaticUser()
  if (!auth.authorized) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  if (Number(request.headers.get('content-length')) > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Envie até 4 MB por requisição.' }, { status: 413 })
  }
  let form: FormData
  try { form = await request.formData() }
  catch { return NextResponse.json({ error: 'Não foi possível ler os arquivos enviados.' }, { status: 400 }) }
  const files = form.getAll('xml')
  if (!files.length || files.length > XML_MAX_FILES || files.some(file => typeof file === 'string')) {
    return NextResponse.json({ error: 'Selecione de 1 a 10 arquivos XML.' }, { status: 400 })
  }
  if ((files as File[]).reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Envie até 4 MB por requisição.' }, { status: 413 })
  }
  const supabase = await createClient()
  const results = []
  for (const [index, file] of (files as File[]).entries()) {
    const result: ResultadoXml = { file: file.name, status: 'erro', banco: 'erro', drive: 'nao_enviado' }
    try {
      if (!/\.xml$/i.test(file.name)) throw new XmlImportError('arquivo_invalido', 'Selecione um arquivo com extensão .xml.')
      if (!file.size || file.size > XML_MAX_BYTES) throw new XmlImportError('arquivo_invalido', 'Cada XML deve ter até 2 MB e não pode estar vazio.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const nota = await lerXmlRecebimento(bytes)
      const hash = sha256Xml(bytes)
      result.numero_nf = nota.numero_nf
      const { data, error } = await supabase.rpc('importar_xml_recebimento', { p_nota: nota, p_sha256: hash })
      if (error) {
        const conflito = error.message?.includes('XML_CONFLITO') || error.code === '23505'
        console.error('[RECEBIMENTO XML]', { etapa: 'banco', indice: index, codigo: error.code, conflito })
        throw new XmlImportError(conflito ? 'conflito' : 'banco', conflito
          ? 'A nota já existe com dados diferentes. Nenhuma informação foi substituída.'
          : 'Não foi possível cadastrar a nota e seus itens. Nenhuma alteração desta importação foi confirmada.')
      }
      if (!data?.nfe_id) throw new XmlImportError('banco', 'Não foi possível confirmar o cadastro da nota. Tente novamente com o mesmo XML.')
      result.nfe_id = data.nfe_id
      result.banco = data.banco
      result.status = 'parcial'
      result.drive = 'pendente'
      const drive = await salvarXmlDrive({ bytes, numeroNf: nota.numero_nf, fileId: data.drive_file_id,
        reservarId: async (id) => {
          const { error: reserveError } = await supabase.from('nfe').update({ xml_drive_file_id: id }).eq('id', data.nfe_id).eq('xml_sha256', hash).is('xml_drive_file_id', null)
          if (reserveError) throw new XmlImportError('drive_reserva', 'A nota foi cadastrada, mas não foi possível preparar o envio ao Drive. Tente novamente.')
          const { data: reserved, error: readError } = await supabase.from('nfe').select('xml_drive_file_id').eq('id', data.nfe_id).eq('xml_sha256', hash).single()
          if (readError || !reserved?.xml_drive_file_id) throw new XmlImportError('drive_reserva', 'A nota foi cadastrada, mas o envio ao Drive não pôde ser confirmado. Tente novamente.')
          return reserved.xml_drive_file_id
        },
      })
      const { error: updateError } = await supabase.from('nfe').update({ xml_drive_status: 'salvo' }).eq('id', data.nfe_id).eq('xml_sha256', hash).eq('xml_drive_file_id', drive.fileId)
      if (updateError) throw new XmlImportError('drive_confirmacao', 'O XML está no Drive, mas a confirmação no aplicativo ficou pendente. Envie o mesmo XML novamente.')
      result.drive = drive.status
      result.status = 'ok'
    } catch (error) {
      result.error = error instanceof XmlImportError ? error.message : result.banco !== 'erro'
        ? 'A nota foi cadastrada; o envio ao Drive ficou pendente. Envie o mesmo XML para tentar novamente.'
        : 'Não foi possível concluir a importação. Envie o mesmo XML para tentar novamente.'
      console.error('[RECEBIMENTO XML]', { etapa: result.banco === 'erro' ? 'validacao_ou_banco' : 'drive', indice: index, codigo: error instanceof XmlImportError ? error.code : 'inesperado' })
    }
    results.push(result)
  }
  return NextResponse.json({ results })
}
