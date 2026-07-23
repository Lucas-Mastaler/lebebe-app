import { normalizarTexto } from '../endereco-cache'

export const METADADOS_BAIRROS_CURITIBA = {
  origem: 'IPPUC / Prefeitura de Curitiba - Nosso Bairro - 75 bairros de Curitiba',
  quantidadeEsperada: 75,
  verificadoEm: '2026-07-23',
  observacao: 'Aliases controlados nao representam novos bairros.',
} as const

export const METADADOS_MUNICIPIOS_RMC = {
  origem: 'AMEP - Municipios da Regiao Metropolitana de Curitiba',
  quantidadeEsperada: 29,
  verificadoEm: '2026-07-23',
  observacao: 'Aliases controlados nao representam novos municipios.',
} as const

export const BAIRROS_CURITIBA = [
  'Abranches',
  'Água Verde',
  'Ahú',
  'Alto Boqueirão',
  'Alto da Glória',
  'Alto da XV',
  'Atuba',
  'Augusta',
  'Bacacheri',
  'Bairro Alto',
  'Barreirinha',
  'Batel',
  'Bigorrilho',
  'Boa Vista',
  'Bom Retiro',
  'Boqueirão',
  'Butiatuvinha',
  'Cabral',
  'Cachoeira',
  'Cajuru',
  'Campina do Siqueira',
  'Campo Comprido',
  'Campo de Santana',
  'Capão da Imbuia',
  'Capão Raso',
  'Cascatinha',
  'Caximba',
  'Centro',
  'Centro Cívico',
  'Cidade Industrial',
  'Cristo Rei',
  'Fanny',
  'Fazendinha',
  'Ganchinho',
  'Guabirotuba',
  'Guaíra',
  'Hauer',
  'Hugo Lange',
  'Jardim Botânico',
  'Jardim das Américas',
  'Jardim Social',
  'Juvevê',
  'Lamenha Pequena',
  'Lindóia',
  'Mercês',
  'Mossunguê',
  'Novo Mundo',
  'Orleans',
  'Parolin',
  'Pilarzinho',
  'Pinheirinho',
  'Portão',
  'Prado Velho',
  'Rebouças',
  'Riviera',
  'Santa Cândida',
  'Santa Felicidade',
  'Santa Quitéria',
  'Santo Inácio',
  'São Braz',
  'São Francisco',
  'São João',
  'São Lourenço',
  'São Miguel',
  'Seminário',
  'Sítio Cercado',
  'Taboão',
  'Tarumã',
  'Tatuquara',
  'Tingui',
  'Uberaba',
  'Umbará',
  'Vila Izabel',
  'Vista Alegre',
  'Xaxim',
] as const

export const MUNICIPIOS_RMC = [
  'Adrianópolis',
  'Agudos do Sul',
  'Almirante Tamandaré',
  'Araucária',
  'Balsa Nova',
  'Bocaiúva do Sul',
  'Campina Grande do Sul',
  'Campo do Tenente',
  'Campo Largo',
  'Campo Magro',
  'Cerro Azul',
  'Colombo',
  'Contenda',
  'Curitiba',
  'Doutor Ulysses',
  'Fazenda Rio Grande',
  'Itaperuçu',
  'Lapa',
  'Mandirituba',
  'Piên',
  'Pinhais',
  'Piraquara',
  'Quatro Barras',
  'Quitandinha',
  'Rio Branco do Sul',
  'Rio Negro',
  'São José dos Pinhais',
  'Tijucas do Sul',
  'Tunas do Paraná',
] as const

export const ALIASES_BAIRROS_CURITIBA: Record<string, string> = {
  'Alto da Rua XV': 'Alto da XV',
  'Alto da XV': 'Alto da XV',
  CIC: 'Cidade Industrial',
  'Cidade Industrial de Curitiba': 'Cidade Industrial',
  'Vila Isabel': 'Vila Izabel',
  'Campo Comprido Norte': 'Campo Comprido',
  'Campo Comprido Sul': 'Campo Comprido',
  'Campo Comprido (Norte)': 'Campo Comprido',
  'Campo Comprido (Sul)': 'Campo Comprido',
} as const

export const ALIASES_MUNICIPIOS_RMC: Record<string, string> = {
  'Dr. Ulysses': 'Doutor Ulysses',
  'Dr Ulysses': 'Doutor Ulysses',
} as const

const TERMOS_GENERICOS_COMPLETOS = [
  'Casa',
  'Casa 1',
  'Casa 2',
  'Residencial',
  'Condomínio',
  'Condominio',
  'Apartamento',
  'Apto',
  'Bloco',
  'Torre',
  'Edifício',
  'Edificio',
  'Lote',
  'Loteamento',
  'Sobrado',
  'Fundos',
  'Frente',
  'Unidade',
  'Loja',
  'Galpão',
  'Galpao',
  'Barracão',
  'Barracao',
  'Chácara',
  'Chacara',
  'Sítio',
  'Sitio',
] as const

const TERMOS_NAO_MUNICIPIOS = [
  'Região Metropolitana de Curitiba',
  'Região Geográfica Imediata de Curitiba',
  'Região Geográfica Intermediária de Curitiba',
  'Microrregião de Curitiba',
  'Mesorregião Metropolitana de Curitiba',
  'Núcleo Urbano Central',
  'Paraná',
  'Brasil',
  'Região Sul',
  'Região Metropolitana',
  'Distrito',
  'County',
  'Municipality',
] as const

const bairroCanonicalPorNorm = new Map<string, string>()
const municipioCanonicalPorNorm = new Map<string, string>()

for (const bairro of BAIRROS_CURITIBA) bairroCanonicalPorNorm.set(normalizarTexto(bairro), bairro)
for (const municipio of MUNICIPIOS_RMC) municipioCanonicalPorNorm.set(normalizarTexto(municipio), municipio)
for (const [alias, canonical] of Object.entries(ALIASES_BAIRROS_CURITIBA)) {
  bairroCanonicalPorNorm.set(normalizarTexto(alias), canonical)
}
for (const [alias, canonical] of Object.entries(ALIASES_MUNICIPIOS_RMC)) {
  municipioCanonicalPorNorm.set(normalizarTexto(alias), canonical)
}

export function normalizarComponenteGeografico(valor: string | null | undefined): string {
  return normalizarTexto(valor)
}

export function resolverBairroCuritibaCanonico(valor: string | null | undefined): string | null {
  const normalizado = normalizarComponenteGeografico(valor)
  if (!normalizado) return null
  return bairroCanonicalPorNorm.get(normalizado) ?? null
}

export function resolverMunicipioRmcCanonico(valor: string | null | undefined): string | null {
  const normalizado = normalizarComponenteGeografico(valor)
  if (!normalizado) return null
  return municipioCanonicalPorNorm.get(normalizado) ?? null
}

export function ehTermoGenericoEndereco(valor: string | null | undefined): boolean {
  const normalizado = normalizarComponenteGeografico(valor)
  if (!normalizado) return false
  if (resolverBairroCuritibaCanonico(normalizado)) return false
  if (TERMOS_GENERICOS_COMPLETOS.some((termo) => normalizarTexto(termo) === normalizado)) return true

  return (
    /^CASA\s+[A-Z0-9]+$/.test(normalizado) ||
    /^APTO\s+\d+[A-Z]?$/.test(normalizado) ||
    /^APARTAMENTO\s+\d+[A-Z]?$/.test(normalizado) ||
    /^BLOCO\s+[A-Z0-9]+$/.test(normalizado) ||
    /^TORRE\s+[A-Z0-9]+$/.test(normalizado) ||
    /^LOTE\s+\d+[A-Z]?$/.test(normalizado) ||
    /^UNIDADE\s+\d+[A-Z]?$/.test(normalizado)
  )
}

export function ehTermoNaoMunicipal(valor: string | null | undefined): boolean {
  const normalizado = normalizarComponenteGeografico(valor)
  if (!normalizado) return false
  if (resolverMunicipioRmcCanonico(normalizado)) return false
  return TERMOS_NAO_MUNICIPIOS.some((termo) => normalizarTexto(termo) === normalizado)
}

export function extrairSegmentosDisplayName(displayName: string | null | undefined): string[] {
  return String(displayName ?? '')
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)
}

export function validarVocabularioGeografico(): {
  bairrosUnicos: number
  municipiosUnicos: number
  aliasesColididos: string[]
} {
  const bairrosUnicos = new Set(BAIRROS_CURITIBA.map((bairro) => normalizarTexto(bairro))).size
  const municipiosUnicos = new Set(MUNICIPIOS_RMC.map((municipio) => normalizarTexto(municipio))).size
  const vistos = new Map<string, string>()
  const aliasesColididos: string[] = []

  for (const [alias, canonical] of [
    ...Object.entries(ALIASES_BAIRROS_CURITIBA),
    ...Object.entries(ALIASES_MUNICIPIOS_RMC),
  ]) {
    const norm = normalizarTexto(alias)
    const anterior = vistos.get(norm)
    if (anterior && anterior !== canonical) aliasesColididos.push(alias)
    vistos.set(norm, canonical)
  }

  return { bairrosUnicos, municipiosUnicos, aliasesColididos }
}
