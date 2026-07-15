import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  APP_MODULES,
  MODULE_KEYS_WITHOUT_AUTOMATIC_PROFILE_GRANT,
  NAVIGATION_GROUPS,
  PROFILE_PERMISSION_GROUPS,
  PROFILE_PERMISSION_MODULE_KEYS,
  getAppModuleDefinition,
  getProfilePermissionOrder,
  type AppModuleDefinition,
} from './modulos-app'

function duplicatedValues(values: readonly string[]) {
  const seen = new Set<string>()
  const duplicated = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) duplicated.add(value)
    seen.add(value)
  }

  return [...duplicated]
}

function readMigrationsSql() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n')
}

function readProjectFile(...parts: string[]) {
  return readFileSync(path.join(process.cwd(), ...parts), 'utf8')
}

function listRouteFiles(basePath: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(basePath, { withFileTypes: true })) {
    const entryPath = path.join(basePath, entry.name)
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(entryPath))
    } else if (entry.isFile() && entry.name === 'route.ts') {
      files.push(entryPath)
    }
  }

  return files
}

function extractInsertBlocks(sql: string, tableName: string) {
  const blocks: string[] = []
  const pattern = new RegExp(`INSERT\\s+INTO\\s+public\\.${tableName}\\b[\\s\\S]*?;`, 'gi')
  let match: RegExpExecArray | null

  while ((match = pattern.exec(sql)) !== null) {
    blocks.push(match[0])
  }

  return blocks
}

function extractFirstTextValueFromRows(sqlBlock: string) {
  const keys: string[] = []
  const pattern = /\(\s*'([a-z0-9_]+)'\s*,/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(sqlBlock)) !== null) {
    keys.push(match[1])
  }

  return keys
}

describe('modulos-app catalog', () => {
  const navigationItems = NAVIGATION_GROUPS.flatMap((group) => group.items)
  const profileNavigationItems = navigationItems.filter((item) => item.access === 'profile')

  const expectedProfileMenuLabels = [
    'DASHBOARD',
    'AGENDAMENTOS',
    'HORÁRIOS AGENDAMENTOS',
    'CHAMADOS FINALIZADOS',
    'INTELIGÊNCIA COMERCIAL',
    'FINALIZAÇÕES DIGISAC',
    'PROCURAR DATAS',
    'AUDITORIA DATAS',
    'PERFORMANCE DATAS',
    'CONFIG BUSCA',
    'RECEBIMENTO',
    'PÓS-VENDA',
    'ATENDIMENTO AUTOMÁTICO',
    'USUÁRIOS',
  ]

  it('mantem moduleKey unico no catalogo e no menu', () => {
    expect(duplicatedValues(APP_MODULES.map((module) => module.moduleKey))).toEqual([])
    expect(duplicatedValues(navigationItems.map((item) => item.moduleKey))).toEqual([])
  })

  it('mantem rotas de menu sem duplicidade indevida', () => {
    expect(duplicatedValues(navigationItems.map((item) => item.href))).toEqual([])
  })

  it('garante que todo item de menu existe no catalogo central', () => {
    const missing = navigationItems
      .map((item) => item.moduleKey)
      .filter((moduleKey) => getAppModuleDefinition(moduleKey) === null)

    expect(missing).toEqual([])
  })

  it('classifica corretamente itens publicos, superadmin e controlados por perfil', () => {
    for (const appModule of APP_MODULES as readonly AppModuleDefinition[]) {
      if (appModule.access === 'public') {
        expect(appModule.publico).toBe(true)
        expect(appModule.somenteSuperadmin).toBe(false)
      }

      if (appModule.access === 'superadmin') {
        expect(appModule.publico).toBe(false)
        expect(appModule.somenteSuperadmin).toBe(true)
      }

      if (appModule.access === 'profile') {
        expect(appModule.publico).toBe(false)
        expect(appModule.somenteSuperadmin).toBe(false)
      }
    }
  })

  it('mantem os itens liberaveis do menu sincronizados com o filtro real do editor de perfis', () => {
    const profileMenuLabels = profileNavigationItems.map((item) => item.label)

    expect(profileMenuLabels).toEqual(expectedProfileMenuLabels)

    for (const item of profileNavigationItems) {
      const appModule = getAppModuleDefinition(item.moduleKey)

      expect(appModule, item.label).not.toBeNull()
      expect(appModule?.access, item.label).toBe('profile')
      expect(appModule?.ativo, item.label).toBe(true)
      expect(appModule?.publico, item.label).toBe(false)
      expect(appModule?.somenteSuperadmin, item.label).toBe(false)
    }
  })

  it('deriva a ordem da matriz de perfis da mesma ordem visual do menu', () => {
    const profileMenuKeys = profileNavigationItems.map((item) => item.moduleKey)
    const profileMenuLabels = profileNavigationItems.map((item) => item.label)

    expect(PROFILE_PERMISSION_MODULE_KEYS).toEqual(profileMenuKeys)
    expect(profileMenuLabels).toEqual(expectedProfileMenuLabels)
    expect([...profileMenuKeys].sort((a, b) => getProfilePermissionOrder(a) - getProfilePermissionOrder(b))).toEqual(
      profileMenuKeys
    )
    expect(PROFILE_PERMISSION_GROUPS.map((group) => group.label)).toEqual([
      'VENDAS',
      'PROCURAR DATAS',
      'OPERAÇÃO',
      'CONFIGURAÇÕES',
    ])
  })

  it('mantem Auditoria Acessos fora da matriz comum de perfis', () => {
    const auditoriaAcessos = navigationItems.find((item) => item.label === 'AUDITORIA ACESSOS')

    expect(auditoriaAcessos?.moduleKey).toBe('superadmin')
    expect(auditoriaAcessos?.access).toBe('superadmin')
    expect(profileNavigationItems.map((item) => item.label)).not.toContain('AUDITORIA ACESSOS')
  })

  it('mantem o item USUARIOS vinculado ao modulo superadmin_usuarios', () => {
    const usuarios = navigationItems.find((item) => item.label === 'USUÁRIOS')

    expect(usuarios?.moduleKey).toBe('superadmin_usuarios')
    expect(usuarios?.access).toBe('profile')
  })

  it('inclui explicitamente as telas corrigidas como liberaveis por perfil', () => {
    const expectedModules = {
      'HORÁRIOS AGENDAMENTOS': 'horarios_agendamentos',
      'FINALIZAÇÕES DIGISAC': 'digisac_finalizacoes_automaticas',
      'CONFIG BUSCA': 'configuracoes_procurar_datas',
      'ATENDIMENTO AUTOMÁTICO': 'pos_venda_atendimento_automatico',
      'USUÁRIOS': 'superadmin_usuarios',
    }

    for (const [label, moduleKey] of Object.entries(expectedModules)) {
      const item = profileNavigationItems.find((navItem) => navItem.label === label)

      expect(item?.moduleKey).toBe(moduleKey)
      expect(item?.access).toBe('profile')
    }
  })

  it('garante que todos os modulos do catalogo aparecem em migrations de app_modulos', () => {
    const sql = readMigrationsSql()
    const appModulosBlocks = extractInsertBlocks(sql, 'app_modulos')
    const seededKeys = new Set(appModulosBlocks.flatMap(extractFirstTextValueFromRows))
    const missing = APP_MODULES
      .map((module) => module.moduleKey)
      .filter((moduleKey) => !seededKeys.has(moduleKey))

    expect(missing).toEqual([])
  })

  it('garante que todo item liberavel do menu tem seed/migration em app_modulos', () => {
    const sql = readMigrationsSql()
    const appModulosBlocks = extractInsertBlocks(sql, 'app_modulos')
    const seededKeys = new Set(appModulosBlocks.flatMap(extractFirstTextValueFromRows))
    const missing = profileNavigationItems
      .map((item) => item.moduleKey)
      .filter((moduleKey) => !seededKeys.has(moduleKey))

    expect(missing).toEqual([])
  })

  it('nao concede permissoes automaticamente para modulos marcados como liberacao manual', () => {
    const sql = readMigrationsSql()
    const permissionBlocks = extractInsertBlocks(sql, 'app_permissoes_perfil').join('\n')
    const grantedUnexpectedly = MODULE_KEYS_WITHOUT_AUTOMATIC_PROFILE_GRANT
      .filter((moduleKey) => permissionBlocks.includes(`'${moduleKey}'`))

    expect(grantedUnexpectedly).toEqual([])
  })

  it('preserva bloqueio padrao no editor de perfis quando nao ha linha em app_permissoes_perfil', () => {
    const routePath = path.join(
      'src',
      'app',
      'api',
      'superadmin',
      'perfis',
      '[id]',
      'permissoes',
      'route.ts'
    )

    expect(existsSync(path.join(process.cwd(), routePath))).toBe(true)
    expect(readProjectFile(routePath)).toContain('permitido: permissoesMap.get(m.id) ?? false')
  })

  it('ordena a resposta da API de perfis pela ordem do catalogo central', () => {
    const routePath = path.join(
      'src',
      'app',
      'api',
      'superadmin',
      'perfis',
      '[id]',
      'permissoes',
      'route.ts'
    )
    const source = readProjectFile(routePath)

    expect(source).toContain('getProfilePermissionOrder')
    expect(source).toContain('getProfilePermissionGroupLabel')
    expect(source).toContain('.sort((a, b) => {')
  })

  it('protege por moduleKey as paginas das telas corrigidas', () => {
    const expectedPageGuards = {
      'src/app/horarios-agendamentos/page.tsx': "checkModuleAndWindowAccess('horarios_agendamentos')",
      'src/app/digisac/finalizacoes-automaticas/page.tsx': "checkModuleAndWindowAccess('digisac_finalizacoes_automaticas')",
      'src/app/configuracoes/procurar-datas/page.tsx': "checkModuleAndWindowAccess('configuracoes_procurar_datas')",
      'src/app/pos-venda/atendimento-automatico/page.tsx': "checkModuleAndWindowAccess('pos_venda_atendimento_automatico')",
    }

    for (const [filePath, expectedGuard] of Object.entries(expectedPageGuards)) {
      expect(readProjectFile(filePath), filePath).toContain(expectedGuard)
    }
  })

  it('protege por moduleKey as APIs usadas pelas telas corrigidas', () => {
    expect(readProjectFile('src/app/api/digisac/schedule/route.ts')).toContain(
      "requireModuleAccess('horarios_agendamentos')"
    )

    for (const filePath of listRouteFiles(path.join(process.cwd(), 'src/app/api/configuracoes/procurar-datas'))) {
      expect(readFileSync(filePath, 'utf8'), filePath).toContain(
        "requireModuleAccess('configuracoes_procurar_datas')"
      )
    }

    for (const filePath of listRouteFiles(path.join(process.cwd(), 'src/app/api/digisac/finalizacoes-automaticas'))) {
      expect(readFileSync(filePath, 'utf8'), filePath).toContain(
        "requireModuleAccess('digisac_finalizacoes_automaticas')"
      )
    }

    for (const filePath of listRouteFiles(path.join(process.cwd(), 'src/app/api/pos-venda/atendimento-automatico'))) {
      expect(readFileSync(filePath, 'utf8'), filePath).toContain(
        "requireModuleAccess('pos_venda_atendimento_automatico')"
      )
    }
  })
})
