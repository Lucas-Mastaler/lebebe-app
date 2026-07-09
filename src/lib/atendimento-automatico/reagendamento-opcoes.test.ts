import { describe, expect, it } from 'vitest';
import type { DatasDisponiveisMere } from './consulta-datas-mere';
import { selecionarOpcaoDataPorTexto } from './reagendamento-opcoes';

const datas: DatasDisponiveisMere[] = [
  { dataISO: '2026-08-03', dataBR: '03/08/2026', equipe: 'Equipe A', tipo: 'normal', rank: 1 },
  { dataISO: '2026-08-10', dataBR: '10/08/2026', equipe: 'Equipe B', tipo: 'normal', rank: 2 },
  { dataISO: '2026-09-03', dataBR: '03/09/2026', equipe: 'Equipe C', tipo: 'normal', rank: 3 },
];

describe('selecionarOpcaoDataPorTexto', () => {
  it('seleciona por numero da opcao', () => {
    const r = selecionarOpcaoDataPorTexto('2', datas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.opcao.dataISO).toBe('2026-08-10');
  });

  it('seleciona por data completa', () => {
    const r = selecionarOpcaoDataPorTexto('03/08/2026', datas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.indice).toBe(1);
  });

  it('seleciona por dia e mes', () => {
    const r = selecionarOpcaoDataPorTexto('dia 03/09', datas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.opcao.dataISO).toBe('2026-09-03');
  });

  it('seleciona por data por extenso', () => {
    const r = selecionarOpcaoDataPorTexto('3 de agosto', datas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.opcao.dataISO).toBe('2026-08-03');
  });

  it('marca dia isolado como ambiguo quando aparece em mais de uma opcao', () => {
    const r = selecionarOpcaoDataPorTexto('03', datas);
    expect(r).toEqual({ ok: false, motivo: 'ambigua' });
  });
});

