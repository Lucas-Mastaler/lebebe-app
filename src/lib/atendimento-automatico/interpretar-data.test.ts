import { describe, it, expect } from 'vitest';
import { interpretarDataDesejada, validarDataDesejadaParaAcao } from './interpretar-data';

// Hoje fixo: quarta-feira 08/07/2026
const HOJE = new Date(2026, 6, 8); // mês é 0-indexed

describe('interpretarDataDesejada', () => {
  it('segunda que vem => 13/07/2026', () => {
    const r = interpretarDataDesejada('segunda que vem', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.iso).toBe('2026-07-13');
      expect(r.br).toBe('13/07/2026');
    }
  });

  it('segunda => 13/07/2026', () => {
    const r = interpretarDataDesejada('segunda', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-13');
  });

  it('terca que vem => 14/07/2026', () => {
    const r = interpretarDataDesejada('terca que vem', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-14');
  });

  it('terca => 14/07/2026', () => {
    const r = interpretarDataDesejada('terca', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-14');
  });

  it('quinta => 09/07/2026', () => {
    const r = interpretarDataDesejada('quinta', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-09');
  });

  it('quarta => proximo quarta 15/07/2026 (hoje é quarta)', () => {
    const r = interpretarDataDesejada('quarta', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-15');
  });

  it('13/07 => 2026-07-13', () => {
    const r = interpretarDataDesejada('13/07', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-13');
  });

  it('13/07/2026 => 2026-07-13', () => {
    const r = interpretarDataDesejada('13/07/2026', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-13');
  });

  it('amanha => 09/07/2026', () => {
    const r = interpretarDataDesejada('amanha', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-09');
  });

  it('amanhã aceito com acento => 09/07/2026', () => {
    const r = interpretarDataDesejada('amanhã', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-09');
  });

  it('depois de amanha => 10/07/2026', () => {
    const r = interpretarDataDesejada('depois de amanha', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-10');
  });

  it('dia 13 => 13/07/2026', () => {
    const r = interpretarDataDesejada('dia 13', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-13');
  });

  it('dia 13/07 => 13/07/2026', () => {
    const r = interpretarDataDesejada('dia 13/07', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-13');
  });

  it('13-07-2026 => 2026-07-13', () => {
    const r = interpretarDataDesejada('13-07-2026', HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-07-13');
  });

  it('texto invalido => nao interpretado', () => {
    const r = interpretarDataDesejada('qualquer dia', HOJE);
    expect(r.ok).toBe(false);
  });

  it('texto vazio => nao interpretado', () => {
    const r = interpretarDataDesejada('', HOJE);
    expect(r.ok).toBe(false);
  });

  it('data fora do padrao => nao interpretado', () => {
    const r = interpretarDataDesejada('nao sei quando', HOJE);
    expect(r.ok).toBe(false);
  });
});

describe('validarDataDesejadaParaAcao', () => {
  it('adiantar valido: 13/07 antes da entrega 17/07', () => {
    const r = validarDataDesejadaParaAcao({
      isoDesejada: '2026-07-13',
      isoEntregaAtual: '2026-07-17',
      acao: 'adiantar',
      hoje: HOJE,
    });
    expect(r.valida).toBe(true);
  });

  it('adiantar invalido: 18/07 posterior a entrega 17/07', () => {
    const r = validarDataDesejadaParaAcao({
      isoDesejada: '2026-07-18',
      isoEntregaAtual: '2026-07-17',
      acao: 'adiantar',
      hoje: HOJE,
    });
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe('data_desejada_nao_anterior_entrega_atual');
  });

  it('postergar valido: 20/07 posterior a entrega 17/07', () => {
    const r = validarDataDesejadaParaAcao({
      isoDesejada: '2026-07-20',
      isoEntregaAtual: '2026-07-17',
      acao: 'postergar',
      hoje: HOJE,
    });
    expect(r.valida).toBe(true);
  });

  it('postergar invalido: 13/07 anterior a entrega 17/07', () => {
    const r = validarDataDesejadaParaAcao({
      isoDesejada: '2026-07-13',
      isoEntregaAtual: '2026-07-17',
      acao: 'postergar',
      hoje: HOJE,
    });
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe('data_desejada_anterior_entrega_atual');
  });

  it('data antes de D+2 invalida', () => {
    const r = validarDataDesejadaParaAcao({
      isoDesejada: '2026-07-09',
      isoEntregaAtual: '2026-07-17',
      acao: 'adiantar',
      hoje: HOJE,
    });
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe('data_desejada_antes_d2');
  });

  it('data acima de D+90 invalida', () => {
    const r = validarDataDesejadaParaAcao({
      isoDesejada: '2027-01-01',
      isoEntregaAtual: '2026-07-17',
      acao: 'postergar',
      hoje: HOJE,
    });
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motivo).toBe('data_desejada_fora_janela_d90');
  });
});
