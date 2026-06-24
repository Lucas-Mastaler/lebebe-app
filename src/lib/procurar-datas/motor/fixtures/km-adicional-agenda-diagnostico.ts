type CoordenadaFixture = {
  lat: number
  lng: number
  descricao?: string
}

export type CenarioKmAdicionalAgendaDiagnostico = {
  nome: string
  descricao: string
  dataInicial: string
  equipeAgendaDiagnostica: string
  origemAgendaDiagnostica: CoordenadaFixture | null
  destino: {
    lat: number | null
    lng: number | null
  }
  linhasAgendaDiagnostica: unknown[][]
  cacheCoordenadasAgendaDiagnostico: Record<string, { lat: number; lng: number }>
}

const DATA_FIXTURE = '2026-06-15'
const EQUIPE_FIXTURE = 'EQUIPE 1'
const EQUIPE_DIFERENTE = 'EQUIPE 2'

const ORIGEM_FIXTURE: CoordenadaFixture = {
  lat: -25.45,
  lng: -49.29,
  descricao: 'Origem fixture',
}

const DESTINO_FIXTURE = {
  lat: -25.42,
  lng: -49.27,
}

const ENDERECO_A = 'Rua Fixture A, 100 - Curitiba - PR, 80000-000'
const ENDERECO_B = 'Rua Fixture B, 200 - Curitiba - PR, 80000-000'
const ENDERECO_C = 'Rua Fixture C, 300 - Curitiba - PR, 80000-000'
const ENDERECO_SEM_CACHE = 'Rua Fixture Sem Cache, 1 - Curitiba - PR, 80000-000'

const CHAVE_ENDERECO_A = 'rua fixture a, 100 - curitiba - pr, 80000-000'
const CHAVE_ENDERECO_B = 'rua fixture b, 200 - curitiba - pr, 80000-000'
const CHAVE_ENDERECO_C = 'rua fixture c, 300 - curitiba - pr, 80000-000'

function linhaAgenda(
  titulo: string,
  endereco: string,
  equipe = EQUIPE_FIXTURE,
  data = DATA_FIXTURE
): unknown[] {
  return [data, '', titulo, '', '', endereco, equipe]
}

export const cenarioAgendaUmPonto: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioAgendaUmPonto',
  descricao: 'Uma linha valida da agenda, com coordenada em cache.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: ORIGEM_FIXTURE,
  destino: DESTINO_FIXTURE,
  linhasAgendaDiagnostica: [
    linhaAgenda('ENTREGA FIXTURE A', ENDERECO_A),
  ],
  cacheCoordenadasAgendaDiagnostico: {
    [CHAVE_ENDERECO_A]: { lat: -25.43, lng: -49.28 },
  },
}

export const cenarioAgendaMultipontos: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioAgendaMultipontos',
  descricao: 'Tres pontos validos da mesma data/equipe, com coordenadas em cache.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: ORIGEM_FIXTURE,
  destino: DESTINO_FIXTURE,
  linhasAgendaDiagnostica: [
    linhaAgenda('ENTREGA FIXTURE A', ENDERECO_A),
    linhaAgenda('ENTREGA FIXTURE B', ENDERECO_B),
    linhaAgenda('ENTREGA FIXTURE C', ENDERECO_C),
  ],
  cacheCoordenadasAgendaDiagnostico: {
    [CHAVE_ENDERECO_A]: { lat: -25.445, lng: -49.285 },
    [CHAVE_ENDERECO_B]: { lat: -25.435, lng: -49.275 },
    [CHAVE_ENDERECO_C]: { lat: -25.425, lng: -49.265 },
  },
}

export const cenarioAgendaSemCache: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioAgendaSemCache',
  descricao: 'Linha valida da agenda sem coordenada correspondente no cache.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: ORIGEM_FIXTURE,
  destino: DESTINO_FIXTURE,
  linhasAgendaDiagnostica: [
    linhaAgenda('ENTREGA FIXTURE SEM CACHE', ENDERECO_SEM_CACHE),
  ],
  cacheCoordenadasAgendaDiagnostico: {},
}

export const cenarioAgendaVazia: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioAgendaVazia',
  descricao: 'Agenda sem linhas, mantendo origem e destino validos.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: ORIGEM_FIXTURE,
  destino: DESTINO_FIXTURE,
  linhasAgendaDiagnostica: [],
  cacheCoordenadasAgendaDiagnostico: {},
}

export const cenarioEquipeDiferente: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioEquipeDiferente',
  descricao: 'Linha da mesma data, mas de equipe diferente da solicitada.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: ORIGEM_FIXTURE,
  destino: DESTINO_FIXTURE,
  linhasAgendaDiagnostica: [
    linhaAgenda('ENTREGA FIXTURE OUTRA EQUIPE', ENDERECO_A, EQUIPE_DIFERENTE),
  ],
  cacheCoordenadasAgendaDiagnostico: {
    [CHAVE_ENDERECO_A]: { lat: -25.43, lng: -49.28 },
  },
}

export const cenarioOrigemInvalida: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioOrigemInvalida',
  descricao: 'Origem ausente, com destino valido.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: null,
  destino: DESTINO_FIXTURE,
  linhasAgendaDiagnostica: [],
  cacheCoordenadasAgendaDiagnostico: {},
}

export const cenarioDestinoInvalido: CenarioKmAdicionalAgendaDiagnostico = {
  nome: 'cenarioDestinoInvalido',
  descricao: 'Destino ausente/invalido, com origem valida.',
  dataInicial: DATA_FIXTURE,
  equipeAgendaDiagnostica: EQUIPE_FIXTURE,
  origemAgendaDiagnostica: ORIGEM_FIXTURE,
  destino: {
    lat: null,
    lng: null,
  },
  linhasAgendaDiagnostica: [],
  cacheCoordenadasAgendaDiagnostico: {},
}

export const cenariosKmAdicionalAgendaDiagnostico = [
  cenarioAgendaUmPonto,
  cenarioAgendaMultipontos,
  cenarioAgendaSemCache,
  cenarioAgendaVazia,
  cenarioEquipeDiferente,
  cenarioOrigemInvalida,
  cenarioDestinoInvalido,
] as const

export function montarBodyDiagnosticoKmAdicionalAgenda(
  cenario: CenarioKmAdicionalAgendaDiagnostico
): Record<string, unknown> {
  return {
    cep: '80000-000',
    dataInicial: cenario.dataInicial,
    tempoNecessario: '00:40',
    destLat: cenario.destino.lat,
    destLng: cenario.destino.lng,
    usarKmAdicionalAgendaDiagnostico: true,
    equipeAgendaDiagnostica: cenario.equipeAgendaDiagnostica,
    origemAgendaDiagnostica: cenario.origemAgendaDiagnostica,
    linhasAgendaDiagnostica: cenario.linhasAgendaDiagnostica,
    cacheCoordenadasAgendaDiagnostico: cenario.cacheCoordenadasAgendaDiagnostico,
  }
}
