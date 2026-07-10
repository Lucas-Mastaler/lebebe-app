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
  respostaPedidoNegadoSolicitarNovoDocumento,
  respostaNovoDocumentoNaoLocalizado,
  respostaFallbackNovoDocumentoOuEsclarecimento,
  respostaTransferidoHumanoSemDocumentoRelocalizacao,
  respostaConfirmarEnderecoAlteracao,
  respostaAguardandoDataDesejada,
  respostaTransferidoHumanoEndereco,
  respostaBloqueioProdutoPendenteAntecipacao,
  respostaBloqueioPagamentoPendenteAntecipacao,
  respostaBloqueioPrazoMenor7Antecipacao,
  respostaBloqueioPrazoCriticoD2Postergacao,
  respostaConfirmarReagendamentoFinal,
  respostaReagendamentoDryRun,
  respostaReagendamentoConfirmado,
  respostaTransferidoHumanoErroReagendamento,
  respostaSemOpcoesAdiantarOferecerPostergar,
  respostaManterDataAtual,
  respostaSemOpcoesPostergar,
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

  it('gera resposta para pedido negado solicitando novo documento', () => {
    const resposta = respostaPedidoNegadoSolicitarNovoDocumento();
    expect(resposta.tipo).toBe('pedido_negado_solicitar_novo_documento');
    expect(resposta.texto).toContain('CPF/CNPJ');
    expect(resposta.texto).toContain('breve explica');
  });

  it('gera resposta para novo documento nao localizado', () => {
    const resposta = respostaNovoDocumentoNaoLocalizado();
    expect(resposta.tipo).toBe('novo_documento_nao_localizado');
    expect(resposta.texto).toContain('localizar uma entrega');
  });

  it('gera fallback para texto sem documento na relocalizacao', () => {
    const resposta = respostaFallbackNovoDocumentoOuEsclarecimento();
    expect(resposta.tipo).toBe('fallback_novo_documento_ou_esclarecimento');
    expect(resposta.texto).toContain('CPF/CNPJ');
  });

  it('gera transferencia humana sem documento para relocalizacao', () => {
    const resposta = respostaTransferidoHumanoSemDocumentoRelocalizacao();
    expect(resposta.tipo).toBe('transferido_humano_sem_documento_relocalizacao');
    expect(resposta.texto).toContain('equipe');
  });

  it('gera confirmacao de endereco para adiantar', () => {
    const r = respostaConfirmarEnderecoAlteracao('adiantar', 'Rua das Flores, 123, Curitiba, PR');
    expect(r.tipo).toBe('confirmar_endereco_alteracao');
    expect(r.texto).toContain('adiantar');
    expect(r.texto).toContain('Rua das Flores, 123, Curitiba, PR');
    expect(r.texto).toContain('correto?');
  });

  it('gera confirmacao de endereco para postergar', () => {
    const r = respostaConfirmarEnderecoAlteracao('postergar', 'Av. Brasil, 500');
    expect(r.tipo).toBe('confirmar_endereco_alteracao');
    expect(r.texto).toContain('postergar');
    expect(r.texto).toContain('Av. Brasil, 500');
  });

  it('gera resposta aguardando data desejada', () => {
    const r = respostaAguardandoDataDesejada();
    expect(r.tipo).toBe('aguardando_data_desejada');
    expect(r.texto).toContain('A partir de qual data');
  });

  it('gera resposta transferido humano por endereco', () => {
    const r = respostaTransferidoHumanoEndereco();
    expect(r.tipo).toBe('transferido_humano_endereco');
    expect(r.texto).toContain('equipe');
  });

  it('gera resposta bloqueio produto pendente antecipacao', () => {
    const r = respostaBloqueioProdutoPendenteAntecipacao();
    expect(r.tipo).toBe('bloqueio_produto_pendente_antecipacao');
    expect(r.texto).toContain('produto aguardando chegada da fábrica');
  });

  it('gera resposta bloqueio pagamento pendente antecipacao', () => {
    const r = respostaBloqueioPagamentoPendenteAntecipacao();
    expect(r.tipo).toBe('bloqueio_pagamento_pendente_antecipacao');
    expect(r.texto).toContain('pendência de pagamento');
  });

  it('gera resposta bloqueio prazo menor 7 antecipacao', () => {
    const r = respostaBloqueioPrazoMenor7Antecipacao();
    expect(r.tipo).toBe('bloqueio_prazo_menor_7_antecipacao');
    expect(r.texto).toContain('próxima da data prevista');
  });

  it('gera resposta bloqueio prazo critico d2 postergacao', () => {
    const r = respostaBloqueioPrazoCriticoD2Postergacao();
    expect(r.tipo).toBe('bloqueio_prazo_critico_d2_postergacao');
    expect(r.texto).toContain('próximos dias');
  });
});

describe('respostas de reagendamento', () => {
  it('gera confirmacao final de reagendamento', () => {
    const r = respostaConfirmarReagendamentoFinal('17/07/2026', '03/08/2026');
    expect(r.tipo).toBe('confirmar_reagendamento_final');
    expect(r.texto).toContain('17/07/2026');
    expect(r.texto).toContain('03/08/2026');
    expect(r.texto).toContain('Confirma');
  });

  it('gera resposta dry-run sem afirmar alteracao na agenda', () => {
    const r = respostaReagendamentoDryRun('03/08/2026');
    expect(r.tipo).toBe('reagendamento_dry_run');
    expect(r.texto).toContain('modo de teste');
    expect(r.texto).toContain('não alterei a agenda');
  });

  it('gera resposta de reagendamento confirmado', () => {
    const r = respostaReagendamentoConfirmado('03/08/2026');
    expect(r.tipo).toBe('reagendamento_confirmado');
    expect(r.texto).toContain('03/08/2026');
    expect(r.texto).toContain('entrega e montagem');
    expect(r.texto).toContain('horário comercial');
    expect(r.texto).toContain('é só chamar');
  });

  it('gera resposta de erro seguro de reagendamento', () => {
    const r = respostaTransferidoHumanoErroReagendamento();
    expect(r.tipo).toBe('transferido_humano_erro_reagendamento');
    expect(r.texto).toContain('equipe');
  });
});

describe('respostas de filtro de datas por acao', () => {
  it('gera resposta sem opcoes para adiantar oferecendo postergar sem mojibake', () => {
    const r = respostaSemOpcoesAdiantarOferecerPostergar('13/08/2026');
    expect(r.tipo).toBe('sem_opcoes_adiantar_oferecer_postergar');
    expect(r.texto).toContain('não');
    expect(r.texto).toContain('disponível');
    expect(r.texto).toContain('já');
    expect(r.texto).toContain('após');
    expect(r.texto).toContain('Você');
    expect(r.texto).toContain('opções');
    expect(r.texto).toContain('13/08/2026');
    expect(r.texto).not.toContain('Ã');
    expect(r.texto).not.toContain('Â');
  });

  it('gera resposta manter data atual sem mojibake', () => {
    const r = respostaManterDataAtual('13/08/2026');
    expect(r.tipo).toBe('manter_data_atual');
    expect(r.texto).toContain('já');
    expect(r.texto).toContain('13/08/2026');
    expect(r.texto).not.toContain('Ã');
    expect(r.texto).not.toContain('Â');
  });

  it('gera resposta sem opcoes para postergar sem mojibake', () => {
    const r = respostaSemOpcoesPostergar('13/08/2026');
    expect(r.tipo).toBe('sem_opcoes_postergar');
    expect(r.texto).toContain('não');
    expect(r.texto).toContain('disponível');
    expect(r.texto).toContain('após');
    expect(r.texto).toContain('já');
    expect(r.texto).toContain('13/08/2026');
    expect(r.texto).not.toContain('Ã');
    expect(r.texto).not.toContain('Â');
  });
});
