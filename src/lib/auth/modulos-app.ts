export type AppModuleAccess = 'profile' | 'superadmin' | 'public'

export type NavigationIconKey =
  | 'activity'
  | 'barChart3'
  | 'bot'
  | 'calendar'
  | 'checkCircle'
  | 'clipboardList'
  | 'clock'
  | 'package'
  | 'search'
  | 'settings'
  | 'shieldCheck'
  | 'shoppingBag'
  | 'trendingUp'
  | 'users'

export type AppModuleDefinition = {
  moduleKey: string
  nome: string
  descricao: string | null
  rotaBase: string
  categoria: string | null
  publico: boolean
  somenteSuperadmin: boolean
  ativo: boolean
  ordem: number
  access: AppModuleAccess
  menuLabel?: string
  menuHref?: string
}

export const APP_MODULES = [
  {
    moduleKey: 'dashboard',
    nome: 'DASHBOARD',
    descricao: 'Painel principal do sistema',
    rotaBase: '/dashboard',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 10,
    access: 'profile',
  },
  {
    moduleKey: 'digisac_finalizacoes_automaticas',
    nome: 'FINALIZACOES AUTOMATICAS DIGISAC',
    descricao: 'Automacao de finalizacoes Digisac',
    rotaBase: '/digisac/finalizacoes-automaticas',
    categoria: 'digisac',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 60,
    access: 'profile',
    menuLabel: 'FINALIZAÇÕES DIGISAC',
  },
  {
    moduleKey: 'atendimento_presencial_ficha',
    nome: 'Ficha de Atendimento',
    descricao: 'Placeholder protegido da ficha de atendimento presencial',
    rotaBase: '/atendimento-presencial/ficha',
    categoria: 'atendimento_presencial',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 61,
    access: 'profile',
  },
  {
    moduleKey: 'atendimento_presencial_registros',
    nome: 'Registros de Atendimentos',
    descricao: 'Placeholder protegido dos registros de atendimentos presenciais',
    rotaBase: '/atendimento-presencial/registros',
    categoria: 'atendimento_presencial',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 62,
    access: 'profile',
  },
  {
    moduleKey: 'atendimento_presencial_clientes',
    nome: 'Clientes',
    descricao: 'Placeholder protegido de clientes do atendimento presencial',
    rotaBase: '/atendimento-presencial/clientes',
    categoria: 'atendimento_presencial',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 63,
    access: 'profile',
  },
  {
    moduleKey: 'agendamentos',
    nome: 'AGENDAMENTOS',
    descricao: 'Consulta e gestao de agendamentos',
    rotaBase: '/agendamentos',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 20,
    access: 'profile',
  },
  {
    moduleKey: 'procurar_datas',
    nome: 'PROCURAR DATAS',
    descricao: 'Motor de busca de datas de entrega disponiveis',
    rotaBase: '/procurar-datas',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 70,
    access: 'profile',
  },
  {
    moduleKey: 'procurar_datas_auditoria',
    nome: 'AUDITORIA PROCURAR DATAS',
    descricao: 'Consulta read-only de pesquisas e pre-agendamentos auditados da tela Procurar Datas',
    rotaBase: '/procurar-datas/auditoria',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 80,
    access: 'profile',
    menuLabel: 'AUDITORIA DATAS',
  },
  {
    moduleKey: 'procurar_datas_performance',
    nome: 'PERFORMANCE DATAS',
    descricao: 'Diagnostico de performance do Procurar Datas',
    rotaBase: '/procurar-datas/performance',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 90,
    access: 'profile',
  },
  {
    moduleKey: 'chamados_finalizados',
    nome: 'CHAMADOS FINALIZADOS',
    descricao: 'Listagem e pesquisa de chamados encerrados',
    rotaBase: '/chamados-finalizados',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 40,
    access: 'profile',
  },
  {
    moduleKey: 'inteligencia_comercial',
    nome: 'INTELIGENCIA COMERCIAL',
    descricao: 'Analise comercial de vendas e clientes',
    rotaBase: '/inteligencia-comercial',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 50,
    access: 'profile',
    menuLabel: 'INTELIGÊNCIA COMERCIAL',
  },
  {
    moduleKey: 'pos_venda',
    nome: 'POS VENDA',
    descricao: 'Modulo de pos-venda',
    rotaBase: '/pos-venda',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 120,
    access: 'profile',
    menuLabel: 'PÓS-VENDA',
  },
  {
    moduleKey: 'pos_venda_atendimento_automatico',
    nome: 'ATENDIMENTO AUTOMATICO POS-VENDA',
    descricao: 'Atendimento automatico de pos-venda',
    rotaBase: '/pos-venda/atendimento-automatico',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 130,
    access: 'profile',
    menuLabel: 'ATENDIMENTO AUTOMÁTICO',
  },
  {
    moduleKey: 'recebimento',
    nome: 'RECEBIMENTO',
    descricao: 'Recebimento de mercadorias (Matic). Controle futuro.',
    rotaBase: '/recebimento',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 110,
    access: 'profile',
  },
  {
    moduleKey: 'superadmin',
    nome: 'SUPERADMIN',
    descricao: 'Gestao de usuarios e auditoria do sistema',
    rotaBase: '/superadmin',
    categoria: 'admin',
    publico: false,
    somenteSuperadmin: true,
    ativo: true,
    ordem: 150,
    access: 'superadmin',
  },
  {
    moduleKey: 'configuracoes',
    nome: 'CONFIGURACOES',
    descricao: 'Configuracoes avancadas do sistema',
    rotaBase: '/configuracoes',
    categoria: 'admin',
    publico: false,
    somenteSuperadmin: true,
    ativo: true,
    ordem: 160,
    access: 'superadmin',
  },
  {
    moduleKey: 'configuracoes_procurar_datas',
    nome: 'CONFIG BUSCA',
    descricao: 'Configuracoes operacionais do Procurar Datas',
    rotaBase: '/configuracoes/procurar-datas',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 100,
    access: 'profile',
  },
  {
    moduleKey: 'superadmin_usuarios',
    nome: 'USUARIOS',
    descricao: 'Gestao limitada de usuarios permitidos e unidades',
    rotaBase: '/superadmin?tab=usuarios',
    categoria: 'admin',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 140,
    access: 'profile',
    menuLabel: 'USUÁRIOS',
  },
  {
    moduleKey: 'horarios_agendamentos',
    nome: 'HORARIOS AGENDAMENTOS',
    descricao: 'Consulta de horarios disponiveis',
    rotaBase: '/horarios-agendamentos',
    categoria: 'interno',
    publico: false,
    somenteSuperadmin: false,
    ativo: true,
    ordem: 30,
    access: 'profile',
    menuLabel: 'HORÁRIOS AGENDAMENTOS',
  },
] as const satisfies readonly AppModuleDefinition[]

export type AppModuleKey = (typeof APP_MODULES)[number]['moduleKey']

export type NavigationItemDefinition = {
  label: string
  href: string
  iconKey: NavigationIconKey
  moduleKey: AppModuleKey
  access: AppModuleAccess
}

export type NavigationGroupDefinition = {
  label: string
  iconKey: NavigationIconKey
  items: readonly NavigationItemDefinition[]
}

const appModulesByKey = new Map<AppModuleKey, (typeof APP_MODULES)[number]>(
  APP_MODULES.map((module) => [module.moduleKey, module])
)

function navigationItem(moduleKey: AppModuleKey, iconKey: NavigationIconKey): NavigationItemDefinition {
  const appModule = appModulesByKey.get(moduleKey) as AppModuleDefinition | undefined
  if (!appModule) {
    throw new Error(`Modulo sem cadastro no catalogo central: ${moduleKey}`)
  }

  return {
    label: appModule.menuLabel ?? appModule.nome,
    href: appModule.menuHref ?? appModule.rotaBase,
    iconKey,
    moduleKey,
    access: appModule.access,
  }
}

export const NAVIGATION_GROUPS = [
  {
    label: 'VENDAS',
    iconKey: 'shoppingBag',
    items: [
      navigationItem('dashboard', 'barChart3'),
      navigationItem('agendamentos', 'calendar'),
      navigationItem('horarios_agendamentos', 'clock'),
      navigationItem('chamados_finalizados', 'checkCircle'),
      navigationItem('inteligencia_comercial', 'trendingUp'),
      navigationItem('digisac_finalizacoes_automaticas', 'bot'),
    ],
  },
  {
    label: 'ATENDIMENTO PRESENCIAL',
    iconKey: 'clipboardList',
    items: [
      navigationItem('atendimento_presencial_ficha', 'clipboardList'),
      navigationItem('atendimento_presencial_registros', 'clipboardList'),
      navigationItem('atendimento_presencial_clientes', 'users'),
    ],
  },
  {
    label: 'PROCURAR DATAS',
    iconKey: 'search',
    items: [
      navigationItem('procurar_datas', 'search'),
      navigationItem('procurar_datas_auditoria', 'shieldCheck'),
      navigationItem('procurar_datas_performance', 'activity'),
      navigationItem('configuracoes_procurar_datas', 'settings'),
    ],
  },
  {
    label: 'OPERAÇÃO',
    iconKey: 'package',
    items: [
      navigationItem('recebimento', 'package'),
      navigationItem('pos_venda', 'shoppingBag'),
      navigationItem('pos_venda_atendimento_automatico', 'bot'),
    ],
  },
  {
    label: 'CONFIGURAÇÕES',
    iconKey: 'settings',
    items: [
      navigationItem('superadmin_usuarios', 'users'),
      {
        ...navigationItem('superadmin', 'clipboardList'),
        label: 'AUDITORIA ACESSOS',
        href: '/superadmin?tab=auditoria',
      },
    ],
  },
] as const satisfies readonly NavigationGroupDefinition[]

export const PROFILE_CONTROLLED_MODULE_KEYS = APP_MODULES
  .filter((module) => module.access === 'profile')
  .map((module) => module.moduleKey)

export const PROFILE_PERMISSION_GROUPS = NAVIGATION_GROUPS
  .map((group) => ({
    label: group.label,
    moduleKeys: group.items
      .filter((item) => item.access === 'profile')
      .map((item) => item.moduleKey),
  }))
  .filter((group) => group.moduleKeys.length > 0)

export const PROFILE_PERMISSION_MODULE_KEYS = PROFILE_PERMISSION_GROUPS.flatMap((group) => group.moduleKeys)

const profilePermissionOrder = new Map<AppModuleKey, number>(
  PROFILE_PERMISSION_MODULE_KEYS.map((moduleKey, index) => [moduleKey, index])
)

const profilePermissionGroupByKey = new Map<AppModuleKey, string>(
  PROFILE_PERMISSION_GROUPS.flatMap((group) =>
    group.moduleKeys.map((moduleKey) => [moduleKey, group.label] as const)
  )
)

export function getProfilePermissionOrder(moduleKey: AppModuleKey) {
  return profilePermissionOrder.get(moduleKey) ?? Number.MAX_SAFE_INTEGER
}

export function getProfilePermissionGroupLabel(moduleKey: AppModuleKey) {
  return profilePermissionGroupByKey.get(moduleKey) ?? null
}

export const MODULE_KEYS_WITHOUT_AUTOMATIC_PROFILE_GRANT = [
  'horarios_agendamentos',
  'digisac_finalizacoes_automaticas',
  'procurar_datas_performance',
  'configuracoes_procurar_datas',
  'pos_venda_atendimento_automatico',
  'superadmin_usuarios',
  'atendimento_presencial_ficha',
  'atendimento_presencial_registros',
  'atendimento_presencial_clientes',
] as const satisfies readonly AppModuleKey[]

export function getAppModuleDefinition(moduleKey: AppModuleKey) {
  return appModulesByKey.get(moduleKey) ?? null
}
