import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { XmlImportError, XML_MAX_BYTES, XML_MAX_FILES } from '@/lib/recebimento/xml-upload'
import { importarXmlRecebimento } from '@/lib/recebimento/importar-xml'
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
      await importarXmlRecebimento(supabase, bytes, result, index)
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
