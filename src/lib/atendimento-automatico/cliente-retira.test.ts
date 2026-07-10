import { describe, it, expect } from 'vitest';
import { ehClienteRetiraEquipeAgenda } from './interpretar-intencao';

describe('ehClienteRetiraEquipeAgenda', () => {
  it('retorna true para "0-  CLIENTE RETIRA DEPOSITO"', () => {
    expect(ehClienteRetiraEquipeAgenda('0-  CLIENTE RETIRA DEPOSITO')).toBe(true);
  });

  it('retorna true para "7.3- CLIENTE RETIRA LOJA/SAI DO C.D"', () => {
    expect(ehClienteRetiraEquipeAgenda('7.3- CLIENTE RETIRA LOJA/SAI DO C.D')).toBe(true);
  });

  it('retorna true para "CLIENTE RETIRA"', () => {
    expect(ehClienteRetiraEquipeAgenda('CLIENTE RETIRA')).toBe(true);
  });

  it('retorna true para "cliente retira deposito" (minusculo com acento)', () => {
    expect(ehClienteRetiraEquipeAgenda('cliente retira depósito')).toBe(true);
  });

  it('retorna true para "Cliente Retira Loja"', () => {
    expect(ehClienteRetiraEquipeAgenda('Cliente Retira Loja')).toBe(true);
  });

  it('retorna false para "4- EQUIPE 01"', () => {
    expect(ehClienteRetiraEquipeAgenda('4- EQUIPE 01')).toBe(false);
  });

  it('retorna false para "4.2 PENDENTE DE PAGAMENTO EQP 1"', () => {
    expect(ehClienteRetiraEquipeAgenda('4.2 PENDENTE DE PAGAMENTO EQP 1')).toBe(false);
  });

  it('retorna false para string vazia', () => {
    expect(ehClienteRetiraEquipeAgenda('')).toBe(false);
  });

  it('retorna false para null', () => {
    expect(ehClienteRetiraEquipeAgenda(null)).toBe(false);
  });

  it('retorna false para undefined', () => {
    expect(ehClienteRetiraEquipeAgenda(undefined)).toBe(false);
  });
});
