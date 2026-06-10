// ─────────────────────────────────────────────────────────────────────────────
// chaves-editaveis.ts
//
// Whitelist de chaves editáveis na Fase 3.
// Este arquivo é importado tanto pelo frontend (page.tsx) quanto pelo backend
// (PATCH route), portanto NÃO deve ter nenhuma dependência Node-only.
// ─────────────────────────────────────────────────────────────────────────────

export const CHAVES_EDITAVEIS_FASE3 = new Set([
  // Rotas e Distâncias
  'KM ADICIONAL MAX NA ROTA',
  'KM MAXIMO NA SEMANA',
  'KM MAXIMO NO SÁBADO',
  'KM MAX ENTRE PONTOS',
  'KM ADICIONAL MAX NA ROTA ESPECIAL',
  'KM ADICIONAL MAX NA ROTA PREMIUM',
  // Candidatos e Preços
  'VALOR ADICIONAL NA ROTA ESPECIAL',
  'VALOR ADICIONAL NA ROTA PREMIUM',
  'HORA MARCADA HORAS A MAIS',
  'HORA MARCADA VALOR ADICIONAL',
  // Equipes
  'EQUIPE 1 ATIVA?',
  'EQUIPE 2 ATIVA?',
  'ENDEREÇO DO DEPÓSITO',
  'ENDEREÇO DA CASA EQP 1',
  'ENDEREÇO DA CASA EQP 2',
  // Frete
  'KILOMETRAGEM MÁXIMA DE VIAGEM',
  'KILOMETRAGEM MÁXIMA DE VALOR FIXO',
  'KILOMETRAGEM MÁXIMA DE LONGA CIDADE',
  'KILOMETRAGEM MÁXIMA DE NÃO VIAGEM',
  'VALOR SEMANA ATÉ 10KM',
  'VALOR SÁBADO ATÉ 10KM',
  'FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM',
  'MULTIPLICADOR DE KM NÃO VIAGEM',
  'VALOR DIA APÓS 25KM: SEMANA',
  'VALOR DIA APÓS 25KM: SÁBADO',
  'PREÇO CONDOMINIO ADICIONAL',
  'TEMPO MAXIMO DE VIAGEM SÁBADO',
  // Geral
  'DIAS DE PESQUISA NA AGENDA',
])
