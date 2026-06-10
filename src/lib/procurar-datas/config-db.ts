// ─────────────────────────────────────────────────────────────────────────────
// config-db.ts
//
// Lógica de banco para a Fase 2 do espelho de configurações "Procurar Datas".
//
// Responsabilidades:
//   - Buscar último snapshot salvo no Supabase
//   - Calcular diff entre planilha e Supabase (sem escrever nada)
//   - Executar importação manual: upsert de config + snapshot + auditoria
//
// IMPORTANTE:
//   - Toda escrita usa createServiceClient() (service_role, bypassa RLS)
//   - Secrets NUNCA são salvos: is_secret=true → valor=null
//   - Não existe cron, sync automático ou job recorrente neste arquivo
//   - O motor de busca NÃO usa estas tabelas (Fase 2 é somente espelho)
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/service'
import {
  lerConfiguracoesProcurarDatas,
  ConfigItem,
  ConfigProcurarDatasResult,
} from '@/lib/procurar-datas/sheets-config'

// ─── Constantes de grupos e ordem ────────────────────────────────────────────
// Espelham exatamente GRUPOS de sheets-config.ts
const ORDEM_GRUPOS: Record<string, number> = {
  geral: 0,
  rota: 1,
  candidatos_precos: 2,
  equipes: 3,
  frete: 4,
  provedores: 5,
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface SnapshotInfo {
  id: string
  criado_por: string | null
  created_at: string
  status: string
  total_chaves: number
  chaves_ok: number
  chaves_vazias: number
  origem: string
}

export interface DiffItem {
  chave: string
  grupo: string
  valor_planilha: string | null
  valor_supabase: string | null
}

export interface DiffResult {
  ok: true
  lido_em_planilha: string
  ultimo_snapshot: string | null
  banco_vazio: boolean
  iguais: number
  alterados: DiffItem[]
  novos: DiffItem[]
}

export interface DiffErro {
  ok: false
  erro: string
}

export type DiffResponse = DiffResult | DiffErro

export interface ImportarResult {
  ok: true
  snapshot_id: string
  criados: number
  alterados: number
  inalterados: number
}

export interface ImportarErro {
  ok: false
  erro: string
}

export type ImportarResponse = ImportarResult | ImportarErro

// ─── buscarConfigsDb ─────────────────────────────────────────────────────────
// Retorna mapa chave_upper → { valor, grupo, valor_tipo, is_secret }
// Usado para comparação planilha vs banco sem escrever nada.

export interface ConfigDbRow {
  valor: string | null
  grupo: string
  valor_tipo: string
  is_secret: boolean
}

export async function buscarConfigsDb(): Promise<Map<string, ConfigDbRow>> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('procurar_datas_config')
    .select('chave_upper, valor, grupo, valor_tipo, is_secret')
    .eq('ativo', true)

  if (error || !data) {
    console.error('[CONFIG-DB] Erro ao buscar configs do banco:', error?.message)
    return new Map()
  }

  const mapa = new Map<string, ConfigDbRow>()
  for (const row of data) {
    mapa.set(row.chave_upper as string, {
      valor: row.is_secret ? null : (row.valor as string | null),
      grupo: row.grupo as string,
      valor_tipo: row.valor_tipo as string,
      is_secret: row.is_secret as boolean,
    })
  }
  return mapa
}

// ─── buscarUltimoSnapshot ─────────────────────────────────────────────────────

export async function buscarUltimoSnapshot(): Promise<SnapshotInfo | null> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('procurar_datas_config_snapshots')
    .select('id, criado_por, created_at, status, total_chaves, chaves_ok, chaves_vazias, origem')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[CONFIG-DB] Erro ao buscar último snapshot:', error.message)
    return null
  }

  return data as SnapshotInfo | null
}

// ─── calcularDiff ─────────────────────────────────────────────────────────────
// Compara planilha (lida agora) vs Supabase (estado atual).
// Não escreve nada.

export async function calcularDiff(emailOperador: string): Promise<DiffResponse> {
  void emailOperador // passado para log mas sem uso em escrita nesta função

  // 1. Ler planilha
  const planilha = await lerConfiguracoesProcurarDatas()
  if (!planilha.ok) {
    return { ok: false, erro: `Erro ao ler planilha: ${planilha.erro}` }
  }

  const lido_em = planilha.lido_em

  // 2. Ler estado atual do Supabase
  const db = createServiceClient()
  const { data: configsDb, error } = await db
    .from('procurar_datas_config')
    .select('chave_upper, valor, is_secret, grupo')

  if (error) {
    return { ok: false, erro: `Erro ao ler banco: ${error.message}` }
  }

  const banco_vazio = !configsDb || configsDb.length === 0

  // Montar mapa do banco: chave_upper → valor
  const mapaDb = new Map<string, string | null>()
  for (const row of configsDb ?? []) {
    mapaDb.set(row.chave_upper as string, row.is_secret ? null : (row.valor as string | null))
  }

  // 3. Extrair todos os itens da planilha (exceto "outros")
  const todosPlanilha: Array<{ chave: string; grupo: string; item: ConfigItem }> = []
  const secoes = planilha.secoes
  for (const grupo of Object.keys(ORDEM_GRUPOS) as Array<keyof typeof ORDEM_GRUPOS>) {
    const secao = secoes[grupo as keyof typeof secoes]
    if (Array.isArray(secao)) {
      for (const item of secao as ConfigItem[]) {
        todosPlanilha.push({ chave: item.chave, grupo, item })
      }
    }
  }

  // 4. Calcular diff
  const alterados: DiffItem[] = []
  const novos: DiffItem[] = []
  let iguais = 0

  for (const { chave, grupo, item } of todosPlanilha) {
    // Secrets: nunca comparar valor real, apenas registrar presença
    if (item.tipo === 'secret') continue

    const upper = chave.toUpperCase()
    if (!mapaDb.has(upper)) {
      // Chave nova (não existe no banco)
      novos.push({
        chave,
        grupo,
        valor_planilha: item.valor || null,
        valor_supabase: null,
      })
    } else {
      const valorDb = mapaDb.get(upper) ?? null
      const valorPlanilha = item.valor || null
      if (valorPlanilha !== valorDb) {
        alterados.push({
          chave,
          grupo,
          valor_planilha: valorPlanilha,
          valor_supabase: valorDb,
        })
      } else {
        iguais++
      }
    }
  }

  // Buscar último snapshot para retornar a data
  const ultimoSnapshot = await buscarUltimoSnapshot()

  return {
    ok: true,
    lido_em_planilha: lido_em,
    ultimo_snapshot: ultimoSnapshot?.created_at ?? null,
    banco_vazio,
    iguais,
    alterados,
    novos,
  }
}

// ─── executarImportacao ───────────────────────────────────────────────────────
// Importação manual: planilha → Supabase.
// Gera snapshot + upsert em procurar_datas_config + auditoria quando valor muda.

export async function executarImportacao(emailOperador: string): Promise<ImportarResponse> {
  const db = createServiceClient()

  // 1. Ler planilha
  const planilha = await lerConfiguracoesProcurarDatas()
  if (!planilha.ok) {
    return { ok: false, erro: `Erro ao ler planilha: ${planilha.erro}` }
  }

  // 2. Montar lista plana de todos os itens (exceto "outros")
  const itensParaImportar = montarItensParaImportar(planilha)

  // 3. Ler valores atuais do banco para calcular diff (antes do upsert)
  const { data: configsAtuais, error: erroLeitura } = await db
    .from('procurar_datas_config')
    .select('id, chave_upper, valor, is_secret')

  if (erroLeitura) {
    return { ok: false, erro: `Erro ao ler configs atuais do banco: ${erroLeitura.message}` }
  }

  const mapaAtual = new Map<string, { id: string; valor: string | null }>(
    (configsAtuais ?? []).map((r) => [
      r.chave_upper as string,
      { id: r.id as string, valor: r.is_secret ? null : (r.valor as string | null) },
    ])
  )

  // 4. Criar snapshot (imutável — não alterar após criação)
  const payload = montarPayloadSnapshot(itensParaImportar)
  const totalChaves = itensParaImportar.length
  const chavesVazias = itensParaImportar.filter((i) => !i.is_secret && !i.valor).length
  const chavesOk = totalChaves - chavesVazias

  const { data: snapshotRow, error: erroSnapshot } = await db
    .from('procurar_datas_config_snapshots')
    .insert({
      origem: 'planilha_importacao_manual',
      status: 'ok',
      payload,
      total_chaves: totalChaves,
      chaves_ok: chavesOk,
      chaves_vazias: chavesVazias,
      criado_por: emailOperador,
    })
    .select('id')
    .single()

  if (erroSnapshot || !snapshotRow) {
    console.error('[CONFIG-DB] Erro ao criar snapshot:', erroSnapshot?.message)
    return { ok: false, erro: `Erro ao criar snapshot: ${erroSnapshot?.message ?? 'sem retorno'}` }
  }

  const snapshotId = snapshotRow.id as string

  // 5. Upsert cada chave + auditoria quando valor muda
  let criados = 0
  let alterados = 0
  let inalterados = 0

  for (const item of itensParaImportar) {
    const upper = item.chave.toUpperCase()
    const existente = mapaAtual.get(upper)

    // Upsert na tabela de config
    const { data: upsertRow, error: erroUpsert } = await db
      .from('procurar_datas_config')
      .upsert(
        {
          chave: item.chave,
          chave_upper: upper,
          grupo: item.grupo,
          ordem: item.ordem,
          valor: item.is_secret ? null : (item.valor || null),
          valor_tipo: item.valor_tipo,
          is_secret: item.is_secret,
          unidade: item.unidade ?? null,
          ativo: true,
        },
        { onConflict: 'chave_upper', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (erroUpsert || !upsertRow) {
      console.error(`[CONFIG-DB] Erro no upsert de "${item.chave}":`, erroUpsert?.message)
      // Continuar mesmo com erro em 1 chave; snapshot já foi criado
      continue
    }

    const configId = upsertRow.id as string
    const valorNovo = item.is_secret ? null : (item.valor || null)

    if (!existente) {
      // Chave nova
      criados++
      await registrarAuditoria(db, {
        config_id: configId,
        chave: item.chave,
        valor_anterior: null,
        valor_novo: valorNovo,
        acao: 'IMPORTADO_DA_PLANILHA',
        origem: 'planilha_importacao_manual',
        alterado_por: emailOperador,
        snapshot_id: snapshotId,
      })
    } else if (existente.valor !== valorNovo && !item.is_secret) {
      // Valor mudou
      alterados++
      await registrarAuditoria(db, {
        config_id: configId,
        chave: item.chave,
        valor_anterior: existente.valor,
        valor_novo: valorNovo,
        acao: 'IMPORTADO_DA_PLANILHA',
        origem: 'planilha_importacao_manual',
        alterado_por: emailOperador,
        snapshot_id: snapshotId,
      })
    } else {
      inalterados++
    }
  }

  console.log(
    `[CONFIG-DB] Importação concluída por ${emailOperador}: ` +
      `${criados} criados, ${alterados} alterados, ${inalterados} inalterados`
  )

  return {
    ok: true,
    snapshot_id: snapshotId,
    criados,
    alterados,
    inalterados,
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

interface ItemImportar {
  chave: string
  grupo: string
  ordem: number
  valor: string
  valor_tipo: string
  is_secret: boolean
  unidade?: string
}

function montarItensParaImportar(planilha: ConfigProcurarDatasResult): ItemImportar[] {
  const resultado: ItemImportar[] = []

  // Mapeamento valor_tipo (ConfigTipo) → unidade informativa
  const UNIDADES: Record<string, string | undefined> = {
    distance_m: 'm',
    distance_km: 'km',
    currency: 'BRL',
  }

  const secoes = planilha.secoes
  for (const grupo of Object.keys(ORDEM_GRUPOS) as Array<keyof typeof ORDEM_GRUPOS>) {
    const secao = secoes[grupo as keyof typeof secoes]
    if (!Array.isArray(secao)) continue

    let ordem = 0
    for (const item of secao as ConfigItem[]) {
      resultado.push({
        chave: item.chave,
        grupo,
        ordem: ORDEM_GRUPOS[grupo] * 100 + ordem,
        valor: item.valor,
        valor_tipo: item.tipo,
        is_secret: item.tipo === 'secret',
        unidade: UNIDADES[item.tipo],
      })
      ordem++
    }
  }

  return resultado
}

function montarPayloadSnapshot(itens: ItemImportar[]): Record<string, string | null> {
  const payload: Record<string, string | null> = {}
  for (const item of itens) {
    // Secrets: registrar presença como null, nunca o valor real
    payload[item.chave] = item.is_secret ? null : (item.valor || null)
  }
  return payload
}

async function registrarAuditoria(
  db: ReturnType<typeof createServiceClient>,
  entrada: {
    config_id: string
    chave: string
    valor_anterior: string | null
    valor_novo: string | null
    acao: string
    origem: string
    alterado_por: string
    snapshot_id: string
  }
): Promise<void> {
  const { error } = await db.from('procurar_datas_config_auditoria').insert(entrada)
  if (error) {
    console.error(`[CONFIG-DB] Erro ao registrar auditoria para "${entrada.chave}":`, error.message)
  }
}

// ─── editarConfigDb ───────────────────────────────────────────────────────────
// Edição manual de uma configuração (Fase 3).
//
// IMPORTANTE:
//   - Só atualiza o campo `valor` — nunca altera chave_upper, valor_tipo, grupo,
//     is_secret ou qualquer outro metadado
//   - O valorNovo já deve ter sido normalizado por validarValorConfig() antes
//     de chegar aqui (o PATCH handler é responsável por isso)
//   - Auditoria registra valor no formato real do banco (não formatado para tela)
//   - Secrets nunca passam por esta função (checado pela API antes)
// ─────────────────────────────────────────────────────────────────────────────

export interface EditarResult {
  ok: true
  chave: string
  chave_upper: string
  valor_anterior: string | null
  valor_novo: string
  valor_tipo: string
}

export interface EditarErro {
  ok: false
  erro: string
  status: 400 | 404 | 409 | 500
}

export type EditarResponse = EditarResult | EditarErro

export async function editarConfigDb(
  chaveUpper: string,
  valorNovo: string,
  emailOperador: string
): Promise<EditarResponse> {
  const db = createServiceClient()

  // 1. Buscar registro atual — confirma existência e captura valor_anterior
  const { data: linha, error: errBusca } = await db
    .from('procurar_datas_config')
    .select('id, chave, chave_upper, valor, valor_tipo, is_secret, ativo')
    .eq('chave_upper', chaveUpper)
    .single()

  if (errBusca || !linha) {
    console.error(`[EDITAR-CONFIG] Chave não encontrada: "${chaveUpper}"`)
    return { ok: false, erro: `Configuração "${chaveUpper}" não encontrada no banco.`, status: 404 }
  }

  if (!linha.ativo) {
    return { ok: false, erro: `Configuração "${chaveUpper}" está inativa.`, status: 409 }
  }

  if (linha.is_secret) {
    // Camada de segurança adicional — não deve chegar aqui (whitelist bloqueia antes)
    return { ok: false, erro: 'Secrets não podem ser editados.', status: 400 }
  }

  const valorAnterior = linha.valor as string | null

  // 2. Atualizar somente o campo valor (trigger atualiza updated_at)
  const { error: errUpdate } = await db
    .from('procurar_datas_config')
    .update({ valor: valorNovo })
    .eq('chave_upper', chaveUpper)

  if (errUpdate) {
    console.error(`[EDITAR-CONFIG] Erro ao atualizar "${chaveUpper}":`, errUpdate.message)
    return { ok: false, erro: `Erro ao salvar configuração: ${errUpdate.message}`, status: 500 }
  }

  // 3. Registrar auditoria (append-only)
  // Valores no formato real do banco — sem R$, km ou formatação de tela
  const { error: errAuditoria } = await db
    .from('procurar_datas_config_auditoria')
    .insert({
      config_id: linha.id as string,
      chave: linha.chave as string,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      acao: 'EDITADO_MANUALMENTE',
      origem: 'tela',
      alterado_por: emailOperador,
      snapshot_id: null,
    })

  if (errAuditoria) {
    // Auditoria falhou mas o update já foi feito — logar e continuar
    // Não fazer rollback: a edição é válida, a falta de auditoria é incidente secundário
    console.error(`[EDITAR-CONFIG] ATENÇÃO: auditoria falhou para "${chaveUpper}":`, errAuditoria.message)
  }

  console.log(
    `[EDITAR-CONFIG] "${chaveUpper}" atualizado por ${emailOperador}: ` +
      `"${valorAnterior ?? '—'}" → "${valorNovo}"`
  )

  return {
    ok: true,
    chave: linha.chave as string,
    chave_upper: chaveUpper,
    valor_anterior: valorAnterior,
    valor_novo: valorNovo,
    valor_tipo: linha.valor_tipo as string,
  }
}
