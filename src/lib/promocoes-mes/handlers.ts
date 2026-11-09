import { NextResponse } from 'next/server'
import { requireModuleAccess } from '@/lib/auth/module-access'
import { createServiceClient } from '@/lib/supabase/service'
import { ErroFormularioPromocao, lerFormularioPromocao } from './formulario'
import {
  ErroPromocao,
  atualizarPromocao,
  criarPromocao,
  excluirPromocao,
  listarPromocoesAdmin,
  listarVigentes,
  obterPromocaoComUrls,
  reconciliarStorage,
} from './repositorio'
import { hojeOperacional } from './vigencia'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const naoEncontrada = () => NextResponse.json({ ok: false, code: 'NAO_ENCONTRADA', message: 'Promoção não encontrada.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

const SEM_CACHE = { 'Cache-Control': 'no-store' }

function erro(e: unknown) {
  if (e instanceof ErroFormularioPromocao) {
    return NextResponse.json({ ok: false, code: e.codigo, message: e.mensagem }, { status: e.status, headers: SEM_CACHE })
  }
  if (e instanceof ErroPromocao) {
    return NextResponse.json({ ok: false, code: e.codigo, message: e.mensagem }, { status: e.status, headers: SEM_CACHE })
  }
  console.error('[PROMOCOES MES] erro inesperado', e)
  return NextResponse.json({ ok: false, code: 'ERRO_INTERNO', message: 'Erro ao processar requisição.' }, { status: 500, headers: SEM_CACHE })
}

function ok(corpo: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, hoje: hojeOperacional(), ...corpo }, { status, headers: SEM_CACHE })
}

// Administração: módulo `promocoes_mes` (perfil gestao via migration; superadmin sempre).
const exigirAdmin = () => requireModuleAccess('promocoes_mes')
// Leitura das vigentes: quem acessa a Prancheta Virtual.
const exigirLeitura = () => requireModuleAccess('atendimento_presencial_ficha')

export async function listarAdmin() {
  const acesso = await exigirAdmin()
  if (!acesso.ok) return acesso.response
  try {
    const hoje = hojeOperacional()
    return ok({ promocoes: await listarPromocoesAdmin(createServiceClient(), hoje) })
  } catch (e) { return erro(e) }
}

export async function criar(request: Request) {
  const acesso = await exigirAdmin()
  if (!acesso.ok) return acesso.response
  try {
    const form = await lerFormularioPromocao(request)
    return ok({ promocao: await criarPromocao(createServiceClient(), form, acesso.email, hojeOperacional()) }, 201)
  } catch (e) { return erro(e) }
}

export async function obter(id: string) {
  const acesso = await exigirAdmin()
  if (!acesso.ok) return acesso.response
  if (!UUID.test(id)) return naoEncontrada()
  try {
    return ok({ promocao: await obterPromocaoComUrls(createServiceClient(), id, hojeOperacional()) })
  } catch (e) { return erro(e) }
}

export async function atualizar(request: Request, id: string) {
  const acesso = await exigirAdmin()
  if (!acesso.ok) return acesso.response
  if (!UUID.test(id)) return naoEncontrada()
  try {
    const form = await lerFormularioPromocao(request)
    return ok({ promocao: await atualizarPromocao(createServiceClient(), id, form, hojeOperacional()) })
  } catch (e) { return erro(e) }
}

export async function excluir(id: string) {
  const acesso = await exigirAdmin()
  if (!acesso.ok) return acesso.response
  if (!UUID.test(id)) return naoEncontrada()
  try {
    return ok(await excluirPromocao(createServiceClient(), id))
  } catch (e) { return erro(e) }
}

export async function vigentes() {
  const acesso = await exigirLeitura()
  if (!acesso.ok) return acesso.response
  try {
    return ok({ promocoes: await listarVigentes(createServiceClient(), hojeOperacional()) })
  } catch (e) { return erro(e) }
}

export async function reconciliar(aplicar: boolean) {
  const acesso = await exigirAdmin()
  if (!acesso.ok) return acesso.response
  try {
    return ok({ relatorio: await reconciliarStorage(createServiceClient(), aplicar) })
  } catch (e) { return erro(e) }
}
