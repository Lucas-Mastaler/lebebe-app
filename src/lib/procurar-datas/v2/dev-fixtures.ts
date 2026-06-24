/**
 * Fixtures de payload para a dev tool de validação v2 de /procurar-datas.
 *
 * Reutiliza os cenários K13, K14 e K15 das validações manuais do motor v2.
 * Cada fixture é um PesquisarDatasRequest completo, pronto para ser enviado ao
 * POST /api/procurar-datas/v2/pesquisar-compat-async.
 *
 * Não altera regra de negócio, rotas, frontend principal, Apps Script, banco
 * ou motor. Apenas centraliza payloads conhecidos para uso interno na dev tool.
 */

import type { PesquisarDatasRequest } from '../contratos'

export const K13_FIXTURE: PesquisarDatasRequest = {
  cep: '81830-020',
  enderecoCompleto: 'Rua Cornelius Pries, 669, Xaxim, Curitiba - PR',
  logradouro: 'Rua Cornelius Pries',
  numero: '669',
  bairro: 'Xaxim',
  cidade: 'Curitiba',
  uf: 'PR',
  dataInicial: '2026-08-14',
  tempoNecessario: '00:40',
  isRural: false,
  isCondominio: true,
  isEncomenda: false,
  tipoBerco: 'Berco padrao',
  comoda: 'Comoda padrao',
  roupeiro: '',
  poltrona: '',
  painel: '',
  destLat: -25.5091859,
  destLng: -49.2671477,
  destDisplay: 'Rua Cornelius Pries, 669, Xaxim, Curitiba - PR',
}

export const K14_FIXTURE: PesquisarDatasRequest = {
  cep: '81925-370',
  enderecoCompleto: 'Rua Attilio Silva Fonseca, 149-1 - Sitio Cercado, Curitiba - PR',
  logradouro: 'Rua Attilio Silva Fonseca',
  numero: '149-1',
  bairro: 'Sitio Cercado',
  cidade: 'Curitiba',
  uf: 'PR',
  dataInicial: '2026-06-25',
  tempoNecessario: '00:40',
  isRural: false,
  isCondominio: true,
  isEncomenda: false,
  tipoBerco: 'Berco padrao',
  comoda: 'Comoda padrao',
  roupeiro: '',
  poltrona: '',
  painel: '',
  destLat: -25.545418,
  destLng: -49.261836,
  destDisplay: 'Rua Attilio Silva Fonseca, 149-1 - Sitio Cercado, Curitiba - PR, 81925-370',
}

export const K15_FIXTURE: PesquisarDatasRequest = {
  cep: '83800-000',
  enderecoCompleto: 'R. Jose Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR',
  logradouro: 'R. Jose Schueda Sobrinho',
  numero: '63-47',
  bairro: 'Conj. Barcelona',
  cidade: 'Mandirituba',
  uf: 'PR',
  dataInicial: '2026-07-10',
  tempoNecessario: '00:40',
  isRural: false,
  isCondominio: true,
  isEncomenda: false,
  tipoBerco: 'Berco padrao',
  comoda: 'Comoda padrao',
  roupeiro: '',
  poltrona: '',
  painel: '',
  destLat: -25.769705,
  destLng: -49.325586,
  destDisplay: 'R. Jose Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR, 83800-000',
}

export type CenarioDevV2 = {
  id: 'K13' | 'K14' | 'K15'
  nome: string
  descricao: string
  payload: PesquisarDatasRequest
}

export const CENARIOS_DEV_V2: CenarioDevV2[] = [
  {
    id: 'K13',
    nome: 'K13 — Cornelius (Curitiba)',
    descricao: '3 datas normais, sem extras. Esperado: 3 candidates, fretes preenchidos.',
    payload: K13_FIXTURE,
  },
  {
    id: 'K14',
    nome: 'K14 — Sítio Cercado (Curitiba)',
    descricao: '1 especial + 3 normais. Esperado: 4 candidates, 1 extra.',
    payload: K14_FIXTURE,
  },
  {
    id: 'K15',
    nome: 'K15 — Mandirituba',
    descricao: '1 premium + 3 normais. Esperado: 4 candidates, 1 extra.',
    payload: K15_FIXTURE,
  },
]
