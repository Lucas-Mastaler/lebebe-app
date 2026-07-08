import { describe, it, expect } from 'vitest';
import {
  normalizarConfirmacao,
  respostaConfirmarEntregaUnica,
  respostaEscolherGrupo,
  respostaGrupoSelecionado,
  respostaPedidoConfirmadoConfirmarEntrega,
  respostaPedidoNaoLocalizado,
  respostaPedidoConfirmadoAlterarAcaoJaEscolhida,
  respostaPedidoConfirmadoAlterarEscolherAcao,
  respostaPedidoNegado,
} from './respostas';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';

function grupoBase(parcial: Partial<GrupoAgendamento> = {}): GrupoAgendamento {
  return {
    indice: 1,
    nome_cliente: 'RAQUEL DA SILVA',
    cpf_mascarado: '109.***.***-14',
    data_entrega: '17/07/2026',
    endereco_completo: 'Rua das Flores, 123, Curitiba, PR',
    endereco_curto: 'Rua das Flores, 123...',
    pedidos_venda: ['65469'],
    produtos: ['Carrinho'],
    tempo_para_entrega: '15 dias',
    tempo_servico: '30 min',
    equipe_agenda: 'Equipe A',
    pendente_pagamento: 'Não',
    status_estoque: 'Completo',
    produtos_pendentes: '',
    eventos: [],
    itens_originais: [],
    ...parcial,
  };
}

describe('respostas', () => {
  it('gera resposta de confirmacao para entrega unica', () => {
    const resposta = respostaConfirmarEntregaUnica(grupoBase());
    expect(resposta.tipo).toBe('confirmar_entrega_unica');
    expect(resposta.texto).toContain('RAQUEL DA SILVA');
    expect(resposta.texto).toContain('65469');
    expect(resposta.texto).toContain('17/07/2026');
    expect(resposta.texto).toContain('É esta entrega mesmo?');
  });

  it('gera resposta de escolha de multiplos grupos', () => {
    const grupos = [
      grupoBase({ indice: 1, pedidos_venda: ['65469'], data_entrega: '17/07/2026' }),
      grupoBase({ indice: 2, pedidos_venda: ['70000'], data_entrega: '18/07/2026', endereco_curto: 'Av. Brasil, 500...' }),
    ];
    const resposta = respostaEscolherGrupo('RAQUEL DA SILVA', grupos);
    expect(resposta.tipo).toBe('escolher_grupo');
    expect(resposta.texto).toContain('Opção 1');
    expect(resposta.texto).toContain('Opção 2');
    expect(resposta.texto).toContain('Digite o número da entrega');
  });

  it('gera resposta apos selecao de grupo', () => {
    const resposta = respostaGrupoSelecionado(grupoBase());
    expect(resposta.tipo).toBe('grupo_selecionado');
    expect(resposta.texto).toContain('selecionei esta entrega');
  });

  it('gera resposta de pedido nao localizado', () => {
    const resposta = respostaPedidoNaoLocalizado();
    expect(resposta.tipo).toBe('pedido_nao_localizado');
    expect(resposta.texto).toContain('Não encontrei pedido');
  });

  it('gera resposta de confirmacao de entrega', () => {
    const resposta = respostaPedidoConfirmadoConfirmarEntrega('17/07/2026');
    expect(resposta.tipo).toBe('pedido_confirmado_confirmar');
    expect(resposta.texto).toContain('17/07/2026');
  });

  it('normaliza confirmacoes positivas', () => {
    expect(normalizarConfirmacao('sim')).toBe('confirmar');
    expect(normalizarConfirmacao('Sim, está correto')).toBe('confirmar');
    expect(normalizarConfirmacao('é esse')).toBe('confirmar');
    expect(normalizarConfirmacao('pode ser')).toBe('confirmar');
    expect(normalizarConfirmacao('isso mesmo')).toBe('confirmar');
  });

  it('normaliza negacoes', () => {
    expect(normalizarConfirmacao('não')).toBe('negar');
    expect(normalizarConfirmacao('não está correto')).toBe('negar');
    expect(normalizarConfirmacao('errado')).toBe('negar');
    expect(normalizarConfirmacao('outro')).toBe('negar');
  });

  it('retorna null para mensagens neutras', () => {
    expect(normalizarConfirmacao('oi')).toBeNull();
    expect(normalizarConfirmacao('123')).toBeNull();
    expect(normalizarConfirmacao('qualquer coisa')).toBeNull();
  });

  it('gera resposta para pedido confirmado com acao ja escolhida', () => {
    const resposta = respostaPedidoConfirmadoAlterarAcaoJaEscolhida();
    expect(resposta.tipo).toBe('pedido_confirmado_alterar_acao_ja_escolhida');
    expect(resposta.texto).toContain('entendi');
  });

  it('gera resposta para pedido confirmado escolher acao', () => {
    const resposta = respostaPedidoConfirmadoAlterarEscolherAcao();
    expect(resposta.tipo).toBe('pedido_confirmado_alterar_escolher_acao');
    expect(resposta.texto).toContain('1 - Adiantar');
    expect(resposta.texto).toContain('2 - Postergar');
  });

  it('gera resposta para pedido negado', () => {
    const resposta = respostaPedidoNegado();
    expect(resposta.tipo).toBe('pedido_negado');
    expect(resposta.texto).toContain('CPF/CNPJ correto');
  });
});
