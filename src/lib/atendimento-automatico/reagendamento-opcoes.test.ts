import { describe, expect, it } from 'vitest';
import type { DatasDisponiveisMere } from './consulta-datas-mere';
import { selecionarOpcaoDataPorTexto, interpretarManterDataAtual } from './reagendamento-opcoes';

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

describe('interpretarManterDataAtual', () => {
  it('reconhece numero da opcao manter (3 quando 2 datas)', () => {
    expect(interpretarManterDataAtual('3', 3)).toBe(true);
  });

  it('reconhece numero da opcao manter (4 quando 3 datas)', () => {
    expect(interpretarManterDataAtual('4', 4)).toBe(true);
  });

  it('nao confunde numero de data real com opcao manter', () => {
    expect(interpretarManterDataAtual('1', 3)).toBe(false);
    expect(interpretarManterDataAtual('2', 3)).toBe(false);
  });

  it('reconhece "nenhuma"', () => {
    expect(interpretarManterDataAtual('nenhuma', 3)).toBe(true);
  });

  it('reconhece "vou deixar como está"', () => {
    expect(interpretarManterDataAtual('vou deixar como está', 3)).toBe(true);
  });

  it('reconhece "Nenhuma vou deixar como está"', () => {
    expect(interpretarManterDataAtual('Nenhuma vou deixar como está', 3)).toBe(true);
  });

  it('reconhece "manter"', () => {
    expect(interpretarManterDataAtual('manter', 3)).toBe(true);
  });

  it('reconhece "manter mesma data"', () => {
    expect(interpretarManterDataAtual('manter mesma data', 3)).toBe(true);
  });

  it('reconhece "deixa como está"', () => {
    expect(interpretarManterDataAtual('deixa como está', 3)).toBe(true);
  });

  it('reconhece "não quero alterar"', () => {
    expect(interpretarManterDataAtual('não quero alterar', 3)).toBe(true);
  });

  it('reconhece "continuar como está"', () => {
    expect(interpretarManterDataAtual('continuar como está', 3)).toBe(true);
  });

  it('reconhece "mesma data"', () => {
    expect(interpretarManterDataAtual('mesma data', 3)).toBe(true);
  });

  it('nao reconhece texto nao relacionado', () => {
    expect(interpretarManterDataAtual('quero adiantar', 3)).toBe(false);
    expect(interpretarManterDataAtual('21/08', 3)).toBe(false);
  });
});

