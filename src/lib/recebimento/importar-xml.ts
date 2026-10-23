import type { createClient } from '@/lib/supabase/server'
import { lerXmlRecebimento, XmlImportError, type IdentidadeXml } from './xml-upload'
import { salvarXmlDrive, sha256Xml } from '@/lib/google/drive-xml'
import type { ResultadoXml } from './xml-upload-contract'

// Único caminho de persistência e Drive para upload e consulta fiscal.
export async function importarXmlRecebimento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bytes: Uint8Array,
  result: ResultadoXml,
  index = 0,
  identidade?: IdentidadeXml,
): Promise<void> {
  const nota = await lerXmlRecebimento(bytes, identidade)
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
}
