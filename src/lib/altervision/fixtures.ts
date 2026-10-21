// Respostas sintéticas com os formatos documentados; não são dados da conta real.
export const HOURLY_FIXTURE = [
  { store_identifier: 'synthetic-m', day: '2026-10-19', hour: 10, count: 0 },
  { store_identifier: 'synthetic-m', day: '2026-10-19', hour: 11, count: 4 },
  { store_identifier: 'synthetic-p', day: '2026-10-19', hour: 10, count: 2 },
]
export const DAILY_FIXTURE = { '2026-10-19': { 'synthetic-dm': 4, 'synthetic-dp': 2 } }
export const ADJUSTED_FIXTURE = { '2026-10-19': { 'synthetic-am': 5, 'synthetic-ap': 3 } }
export const RESOLUTION_FIXTURE = { timezone: 'America/Sao_Paulo', hourly: { 'synthetic-m': 1510, 'synthetic-p': 1546 }, daily: { 'synthetic-dm': 1510, 'synthetic-dp': 1546 }, adjusted: { 'synthetic-am': 1510, 'synthetic-ap': 1546 } } as const
