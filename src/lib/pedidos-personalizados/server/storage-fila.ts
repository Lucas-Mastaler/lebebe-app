import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonErro, registrarResultado, type ContextoLogPedidos } from './http'
import { BUCKET_ANEXOS_PEDIDOS } from './anexos-arquivo'
import { RepositorioAnexos, StorageAnexos, type PendenciaStorage } from './anexos-repositorio'

const LOTE = 20
const LEASE_MS = 5 * 60_000

type DependenciasFila = {
  segredo: () => string | undefined
  criarRepositorio: () => RepositorioAnexos
  criarStorage: () => StorageAnexos
  agora: () => Date
}

const padrao: DependenciasFila = {
  segredo: () => process.env.CRON_SECRET,
  criarRepositorio: () => new RepositorioAnexos(createServiceClient()),
  criarStorage: () => new StorageAnexos(createServiceClient()),
  agora: () => new Date(),
}

export function atrasoRetentativaMs(tentativa: number) {
  if (tentativa <= 1) return 5 * 60_000
  if (tentativa === 2) return 15 * 60_000
  if (tentativa === 3) return 60 * 60_000
  if (tentativa <= 9) return 6 * 60 * 60_000
  return 24 * 60 * 60_000
}

function autorizado(request: Request, segredo: string) {
  const valor = request.headers.get('authorization')
  return valor === `Bearer ${segredo}`
}

export async function limparPendenciasStorage(request: Request, deps: DependenciasFila = padrao) {
  const log: ContextoLogPedidos = { rota: '/api/pedidos-personalizados/storage/limpar-pendencias', operacao: 'limpar_storage', inicio: Date.now() }
  const segredo = deps.segredo()
  if (!segredo) return jsonErro('CONFIGURACAO_AUSENTE', 'Serviço indisponível.', 500)
  if (!autorizado(request, segredo)) return jsonErro('CHAMADA_INTERNA_NAO_AUTORIZADA', 'Acesso negado.', 403)

  const repo = deps.criarRepositorio()
  const storage = deps.criarStorage()
  const inicio = deps.agora()
  const carregadas = await repo.carregarPendencias(inicio.toISOString(), LOTE)
  if (carregadas.error) return jsonErro('ERRO_INTERNO', 'Não foi possível processar a fila.', 500)

  let processadas = 0
  let concluidas = 0
  let falhas = 0
  for (const item of carregadas.data) {
    const leaseAte = new Date(deps.agora().getTime() + LEASE_MS).toISOString()
    const claim = await repo.reivindicar(item, leaseAte)
    if (claim.error || !claim.data) continue
    processadas += 1
    if (item.bucketId !== BUCKET_ANEXOS_PEDIDOS) {
      const proxima = new Date(deps.agora().getTime() + atrasoRetentativaMs(item.tentativas + 1)).toISOString()
      await repo.falhar(item, leaseAte, proxima, 'BUCKET_INESPERADO')
      falhas += 1
      continue
    }
    const remocao = await storage.remover(item.caminhoObjeto, item.bucketId)
    if (remocao.ok) {
      const final = await repo.concluir(item, leaseAte, deps.agora().toISOString())
      if (!final.error) concluidas += 1
      else falhas += 1
      continue
    }
    const proxima = new Date(deps.agora().getTime() + atrasoRetentativaMs(item.tentativas + 1)).toISOString()
    const codigo = item.tentativas + 1 >= 10 ? 'ATENCAO_FALHA_STORAGE' : 'FALHA_STORAGE_TEMPORARIA'
    await repo.falhar(item, leaseAte, proxima, codigo)
    falhas += 1
  }

  registrarResultado({ ...log, quantidade: processadas }, 'sucesso', 'FILA_PROCESSADA')
  return NextResponse.json({ ok: true, selecionadas: carregadas.data.length, processadas, concluidas, falhas, limite: LOTE })
}

export type { DependenciasFila, PendenciaStorage }
