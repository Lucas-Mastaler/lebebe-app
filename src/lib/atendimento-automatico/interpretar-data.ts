const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  'terca-feira': 2,
  terca_feira: 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6,
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function adicionarDias(base: Date, dias: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
}

function proximoDiaSemana(hoje: Date, diaSemanaAlvo: number, queVem: boolean): Date {
  const diaAtual = hoje.getDay();
  let diff = diaSemanaAlvo - diaAtual;

  if (diff <= 0 || queVem) {
    diff += 7;
  }

  return adicionarDias(hoje, diff);
}

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatarISO(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function formatarBR(d: Date): string {
  return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export type ResultadoInterpretacaoData =
  | { ok: true; iso: string; br: string }
  | { ok: false };

export function interpretarDataDesejada(texto: string, hoje: Date): ResultadoInterpretacaoData {
  const norm = normalizar(texto);

  // amanha
  if (norm === 'amanha' || norm === 'amanhã') {
    const d = adicionarDias(hoje, 1);
    return { ok: true, iso: formatarISO(d), br: formatarBR(d) };
  }

  // depois de amanha
  if (
    norm === 'depois de amanha' ||
    norm === 'depois de amanha mesmo' ||
    norm === 'depois de amanhã'
  ) {
    const d = adicionarDias(hoje, 2);
    return { ok: true, iso: formatarISO(d), br: formatarBR(d) };
  }

  // dia da semana com ou sem "que vem"
  for (const [chave, diaAlvo] of Object.entries(DIAS_SEMANA)) {
    const queVem = norm === `${chave} que vem` || norm === `${chave} que vem mesmo`;
    const exato = norm === chave;
    if (exato || queVem) {
      const d = proximoDiaSemana(hoje, diaAlvo, queVem);
      return { ok: true, iso: formatarISO(d), br: formatarBR(d) };
    }
  }

  // dia 13 / dia 13/07
  const matchDia = norm.match(/^dia\s+(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (matchDia) {
    const dia = parseInt(matchDia[1], 10);
    const mes = matchDia[2] ? parseInt(matchDia[2], 10) - 1 : hoje.getMonth();
    const ano = hoje.getFullYear();
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime()) && d.getDate() === dia) {
      return { ok: true, iso: formatarISO(d), br: formatarBR(d) };
    }
  }

  // 13/07 ou 13/07/2026
  const matchDMY = norm.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
  if (matchDMY) {
    const dia = parseInt(matchDMY[1], 10);
    const mes = parseInt(matchDMY[2], 10) - 1;
    const ano = matchDMY[3] ? parseInt(matchDMY[3], 10) : hoje.getFullYear();
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime()) && d.getDate() === dia && d.getMonth() === mes) {
      return { ok: true, iso: formatarISO(d), br: formatarBR(d) };
    }
  }

  return { ok: false };
}

export type ValidacaoDataDesejada =
  | { valida: true }
  | { valida: false; motivo: string };

export function validarDataDesejadaParaAcao(params: {
  isoDesejada: string;
  isoEntregaAtual: string;
  acao: 'adiantar' | 'postergar';
  hoje: Date;
}): ValidacaoDataDesejada {
  const { isoDesejada, isoEntregaAtual, acao, hoje } = params;

  const desejada = new Date(isoDesejada + 'T00:00:00');
  const entregaAtual = new Date(isoEntregaAtual + 'T00:00:00');

  const d2 = adicionarDias(hoje, 2);
  d2.setHours(0, 0, 0, 0);
  desejada.setHours(0, 0, 0, 0);
  entregaAtual.setHours(0, 0, 0, 0);

  if (isNaN(desejada.getTime()) || isNaN(entregaAtual.getTime())) {
    return { valida: false, motivo: 'data_invalida' };
  }

  const d90 = adicionarDias(hoje, 90);
  d90.setHours(0, 0, 0, 0);

  if (desejada > d90) {
    return { valida: false, motivo: 'data_desejada_fora_janela_d90' };
  }

  if (desejada < d2) {
    return { valida: false, motivo: 'data_desejada_antes_d2' };
  }

  if (acao === 'adiantar') {
    if (desejada >= entregaAtual) {
      return { valida: false, motivo: 'data_desejada_nao_anterior_entrega_atual' };
    }
  }

  if (acao === 'postergar') {
    if (desejada < entregaAtual) {
      return { valida: false, motivo: 'data_desejada_anterior_entrega_atual' };
    }
  }

  return { valida: true };
}
