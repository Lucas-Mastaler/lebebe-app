export type CategoryId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'

export type Layer = 'visual' | 'behavior'

export interface CategoryDef {
  id: CategoryId
  title: string
  subtitle: string
  layer: Layer
}

export type DecisionKind = 'open' | 'fixed'

export interface DecisionDef {
  code: string
  categoryId: CategoryId
  title: string
  /** 'open' = decisão A/B/C aguardando escolha. 'fixed' = regra já aprovada pelo usuário, sem alternativas. */
  kind: DecisionKind
  /** Só para kind: 'fixed' — o valor já aprovado (ex.: 'MANUAL'). */
  fixedValue?: string
  /** Agrupamento temático dentro da categoria (usado na categoria J, que é grande). */
  subgroup?: string
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'A', title: 'Identidade visual / Foundations', subtitle: 'Radius, sombra, tipografia, densidade', layer: 'visual' },
  { id: 'B', title: 'Ações', subtitle: 'Sistema de botões', layer: 'visual' },
  { id: 'C', title: 'Formulários', subtitle: 'Campos, seleção, texto, erro', layer: 'visual' },
  { id: 'D', title: 'Navegação', subtitle: 'Page header, tabs', layer: 'visual' },
  { id: 'E', title: 'Containers', subtitle: 'Cards e seções', layer: 'visual' },
  { id: 'F', title: 'Dados', subtitle: 'KPIs, tabela/listagem, filtros', layer: 'visual' },
  { id: 'G', title: 'Feedback', subtitle: 'Alerts, empty state, loading', layer: 'visual' },
  { id: 'H', title: 'Status', subtitle: 'Badges e indicadores', layer: 'visual' },
  { id: 'I', title: 'Patterns', subtitle: 'Composições completas de página', layer: 'visual' },
  {
    id: 'J',
    title: 'Comportamento e Interação',
    subtitle: 'Como o sistema reage — não como ele aparece',
    layer: 'behavior',
  },
]

export const DECISIONS: DecisionDef[] = [
  // A — Foundations
  { code: 'RAD', categoryId: 'A', title: 'Radius', kind: 'open' },
  { code: 'SHD', categoryId: 'A', title: 'Sombra / elevação', kind: 'open' },
  { code: 'TYP', categoryId: 'A', title: 'Tipografia', kind: 'open' },
  { code: 'SPC', categoryId: 'A', title: 'Densidade / espaçamento', kind: 'open' },
  { code: 'CLR', categoryId: 'A', title: 'Paleta auxiliar de seções', kind: 'fixed', fixedValue: 'B' },
  // B — Ações
  { code: 'BTN', categoryId: 'B', title: 'Sistema de botões', kind: 'open' },
  // C — Formulários
  { code: 'INP', categoryId: 'C', title: 'Sistema de campos', kind: 'open' },
  // D — Navegação
  { code: 'HDR', categoryId: 'D', title: 'Page header', kind: 'open' },
  { code: 'TAB', categoryId: 'D', title: 'Tabs / navegação de seção', kind: 'open' },
  // E — Containers
  { code: 'CRD', categoryId: 'E', title: 'Cards / containers', kind: 'open' },
  { code: 'SEC', categoryId: 'E', title: 'Separação de seções por cor', kind: 'fixed', fixedValue: 'C' },
  // F — Dados
  { code: 'KPI', categoryId: 'F', title: 'Cards de KPI', kind: 'open' },
  { code: 'TBL', categoryId: 'F', title: 'Tabela / listagem (com mobile)', kind: 'open' },
  { code: 'FLT', categoryId: 'F', title: 'Filtros', kind: 'open' },
  // G — Feedback
  { code: 'FBK', categoryId: 'G', title: 'Alerts / feedback', kind: 'open' },
  { code: 'EST', categoryId: 'G', title: 'Empty state / loading', kind: 'open' },
  // H — Status
  { code: 'STA', categoryId: 'H', title: 'Badges / status', kind: 'open' },
  // I — Patterns
  { code: 'PLS', categoryId: 'I', title: 'Pattern: listagem completa', kind: 'open' },
  { code: 'PFM', categoryId: 'I', title: 'Pattern: formulário completo', kind: 'open' },
  { code: 'PKS', categoryId: 'I', title: 'Pattern: seção de KPIs', kind: 'open' },

  // J — Comportamento e Interação
  // J.1 Filtros e consultas
  {
    code: 'FLT-EXEC',
    categoryId: 'J',
    title: 'Execução de filtros',
    kind: 'fixed',
    fixedValue: 'MANUAL',
    subgroup: 'Filtros e consultas',
  },
  { code: 'FLT-CLR', categoryId: 'J', title: 'Limpar filtros', kind: 'open', subgroup: 'Filtros e consultas' },
  // J.2 Formulários e validação
  { code: 'VAL', categoryId: 'J', title: 'Quando validar campos', kind: 'open', subgroup: 'Formulários e validação' },
  { code: 'ERR', categoryId: 'J', title: 'Apresentação de erros', kind: 'open', subgroup: 'Formulários e validação' },
  { code: 'REQ', categoryId: 'J', title: 'Campos obrigatórios e opcionais', kind: 'open', subgroup: 'Formulários e validação' },
  { code: 'MSK', categoryId: 'J', title: 'Máscaras e formatos de entrada', kind: 'open', subgroup: 'Formulários e validação' },
  // J.3 Ações e confirmações
  { code: 'SAV', categoryId: 'J', title: 'Salvar / enviar', kind: 'open', subgroup: 'Ações e confirmações' },
  { code: 'UNS', categoryId: 'J', title: 'Alterações não salvas', kind: 'open', subgroup: 'Ações e confirmações' },
  { code: 'DST', categoryId: 'J', title: 'Ações destrutivas', kind: 'open', subgroup: 'Ações e confirmações' },
  // J.4 Feedback e carregamento
  { code: 'FDB', categoryId: 'J', title: 'Feedback após ações', kind: 'open', subgroup: 'Feedback e carregamento' },
  { code: 'LDG', categoryId: 'J', title: 'Loading', kind: 'open', subgroup: 'Feedback e carregamento' },
  // J.5 Teclado e foco
  { code: 'KBD', categoryId: 'J', title: 'Enter em formulários', kind: 'open', subgroup: 'Teclado e foco' },
  // J.6 Campos de busca
  { code: 'CMB', categoryId: 'J', title: 'Combobox / autocomplete', kind: 'open', subgroup: 'Campos de busca' },
  // J.7 Datas
  { code: 'DAT', categoryId: 'J', title: 'Datas e períodos', kind: 'open', subgroup: 'Datas' },
  // J.8 Tabelas e listagens
  { code: 'ROW', categoryId: 'J', title: 'Ações de linha', kind: 'open', subgroup: 'Tabelas e listagens' },
  // J.9 Modais e painéis
  { code: 'MOD', categoryId: 'J', title: 'Modal vs. drawer', kind: 'open', subgroup: 'Modais e painéis' },
  // J.10 Permissões
  { code: 'PER', categoryId: 'J', title: 'Ações sem permissão', kind: 'open', subgroup: 'Permissões' },
  // J.11 Mobile
  { code: 'MOB', categoryId: 'J', title: 'Ação principal no mobile', kind: 'open', subgroup: 'Mobile' },
]

export function decisionsByCategory(categoryId: CategoryId): DecisionDef[] {
  return DECISIONS.filter((d) => d.categoryId === categoryId)
}

export function categoriesByLayer(layer: Layer): CategoryDef[] {
  return CATEGORIES.filter((c) => c.layer === layer)
}

export const OPEN_DECISIONS = DECISIONS.filter((d) => d.kind === 'open')
export const FIXED_DECISIONS = DECISIONS.filter((d) => d.kind === 'fixed')

export interface SubgroupDef {
  id: string
  title: string
}

/** Ordem e títulos dos subgrupos temáticos dentro da categoria J. */
export const CATEGORY_J_SUBGROUPS: SubgroupDef[] = [
  { id: 'Filtros e consultas', title: 'Filtros e consultas' },
  { id: 'Formulários e validação', title: 'Formulários e validação' },
  { id: 'Ações e confirmações', title: 'Ações e confirmações' },
  { id: 'Feedback e carregamento', title: 'Feedback e carregamento' },
  { id: 'Teclado e foco', title: 'Teclado e foco' },
  { id: 'Campos de busca', title: 'Campos de busca' },
  { id: 'Datas', title: 'Datas' },
  { id: 'Tabelas e listagens', title: 'Tabelas e listagens' },
  { id: 'Modais e painéis', title: 'Modais e painéis' },
  { id: 'Permissões', title: 'Permissões' },
  { id: 'Mobile', title: 'Mobile' },
]

export function decisionsBySubgroup(subgroupId: string): DecisionDef[] {
  return DECISIONS.filter((d) => d.subgroup === subgroupId)
}
