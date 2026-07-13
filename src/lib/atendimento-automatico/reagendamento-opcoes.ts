import type { DatasDisponiveisMere } from './consulta-datas-mere';

export type ResultadoSelecaoOpcaoData =
  | { ok: true; indice: number; opcao: DatasDisponiveisMere }
  | { ok: false; motivo: 'nao_encontrada' | 'ambigua' };

const MESES: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function partesData(dataISO: string): { ano: string; mes: string; dia: string } | null {
  const match = dataISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { ano: match[1], mes: match[2], dia: match[3] };
}

function selecionarUnica(datas: DatasDisponiveisMere[], predicado: (d: DatasDisponiveisMere) => boolean): ResultadoSelecaoOpcaoData {
  const matches = datas
    .map((opcao, idx) => ({ opcao, indice: idx + 1 }))
    .filter(({ opcao }) => predicado(opcao));

  if (matches.length === 1) return { ok: true, indice: matches[0].indice, opcao: matches[0].opcao };
  if (matches.length > 1) return { ok: false, motivo: 'ambigua' };
  return { ok: false, motivo: 'nao_encontrada' };
}

export function interpretarManterDataAtual(texto: string, numeroOpcaoManter: number): boolean {
  const n = normalizar(texto);
  if (!n) return false;

  if (n === String(numeroOpcaoManter)) return true;

  const frasesManter = [
    'nenhuma',
    'vou deixar como esta',
    'deixar como esta',
    'manter',
    'manter a data',
    'manter mesma data',
    'mesma data',
    'nao quero alterar',
    'deixa como esta',
    'deixa a mesma',
    'continuar como esta',
  ];

  for (const frase of frasesManter) {
    if (n === frase || n.includes(frase)) return true;
  }

  return false;
}

export function selecionarOpcaoDataPorTexto(texto: string, datas: DatasDisponiveisMere[]): ResultadoSelecaoOpcaoData {
  const n = normalizar(texto);
  if (!n || datas.length === 0) return { ok: false, motivo: 'nao_encontrada' };

  const indiceNumerico = n.match(/^\d{1,2}$/)?.[0];
  if (indiceNumerico && !indiceNumerico.startsWith('0')) {
    const numero = Number(indiceNumerico);
    if (numero >= 1 && numero <= datas.length) {
      return { ok: true, indice: numero, opcao: datas[numero - 1] };
    }
  }

  const dataExtenso = n.match(/\b(?:dia\s*)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{2,4}))?\b/);
  if (dataExtenso) {
    const dia = dataExtenso[1].padStart(2, '0');
    const mes = MESES[dataExtenso[2]];
    const anoRaw = dataExtenso[3];
    const ano = anoRaw ? (anoRaw.length === 2 ? `20${anoRaw}` : anoRaw) : undefined;
    if (!mes) return { ok: false, motivo: 'nao_encontrada' };

    return selecionarUnica(datas, (opcao) => {
      const partes = partesData(opcao.dataISO);
      if (!partes || partes.dia !== dia || partes.mes !== mes) return false;
      if (ano && partes.ano !== ano) return false;
      return true;
    });
  }

  const dataNumerica = n.match(/\b(?:dia\s*)?(\d{1,2})(?:[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?)?\b/);
  if (dataNumerica) {
    const dia = dataNumerica[1].padStart(2, '0');
    const mes = dataNumerica[2]?.padStart(2, '0');
    const anoRaw = dataNumerica[3];
    const ano = anoRaw ? (anoRaw.length === 2 ? `20${anoRaw}` : anoRaw) : undefined;

    return selecionarUnica(datas, (opcao) => {
      const partes = partesData(opcao.dataISO);
      if (!partes || partes.dia !== dia) return false;
      if (mes && partes.mes !== mes) return false;
      if (ano && partes.ano !== ano) return false;
      return true;
    });
  }

  return { ok: false, motivo: 'nao_encontrada' };
}
