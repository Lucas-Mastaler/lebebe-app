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
  respostaDataAjustadaD2,
  respostaAguardandoDataInicialAposConfirmacao,
  calcularDataDisponivelRetirada,
  diaSemanaDataBR,
  grupoEhClienteRetira,
  montarMensagemRetiradaDisponivel,
} from './respostas';
import { formatarOpcoesDatasParaCliente } from './consulta-datas-mere';
import type { DatasDisponiveisMere } from './consulta-datas-mere';
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

  it('gera resposta de confirmacao especifica para cliente retira', () => {
    const resposta = respostaConfirmarEntregaUnica(grupoBase({
      equipe_agenda: '7.3- CLIENTE RETIRA LOJA/SAI DO C.D',
      data_entrega: '29/07/2026',
    }));

    expect(resposta.tipo).toBe('confirmar_retirada_unica');
    expect(resposta.texto).toContain('Encontrei este pedido');
    expect(resposta.texto).toContain('Retirada agendada para: 30/07');
    expect(resposta.texto).toContain('É este pedido mesmo?');
    expect(resposta.texto).not.toContain('Encontrei esta entrega');
    expect(resposta.texto).not.toContain('entrega e montagem');
  });

  it('usa a mesma proxima quinta na confirmacao inicial quando agenda nao cai em quarta', () => {
    const resposta = respostaConfirmarEntregaUnica(grupoBase({
      equipe_agenda: '8.1 CLIENTE RETIRA PORTAO/LOJA',
      data_entrega: '31/07/2026',
    }));

    expect(resposta.tipo).toBe('confirmar_retirada_unica');
    expect(resposta.texto).toContain('Retirada agendada para: 06/08');
    expect(resposta.texto).not.toContain('Retirada agendada para: 31/07/2026');
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
    expect(resposta.texto).toContain('1 - Manter a data atual');
    expect(resposta.texto).toContain('2 - Tentar antecipar');
    expect(resposta.texto).toContain('3 - Escolher uma data posterior');
    expect(resposta.texto).toContain('4 - Outro assunto');
  });

  it('preserva mensagem e regra de CLIENTE RETIRA', () => {
    const grupo = grupoBase({
      equipe_agenda: '7.3- CLIENTE RETIRA LOJA/SAI DO C.D',
      data_entrega: '29/07/2026',
    });
    const confirmacao = respostaConfirmarEntregaUnica(grupo);
    const final = montarMensagemRetiradaDisponivel(calcularDataDisponivelRetirada(grupo.data_entrega));

    expect(confirmacao.texto).toContain('Retirada agendada para: 30/07');
    expect(final.tipo).toBe('pedido_confirmado_retirada');
    expect(final.texto).toContain('filial do Hauer');
    expect(final.texto).toContain('*Te ajudo em algo mais?*');
    expect(final.texto).not.toContain('entrega e montagem');
  });

  it('pergunta a data inicial com texto especifico por intencao', () => {
    expect(respostaAguardandoDataInicialAposConfirmacao('adiantar').texto).toContain('possibilidade de antecipação');
    expect(respostaAguardandoDataInicialAposConfirmacao('postergar').texto).toContain('depois da entrega atual');
  });

  it('calcula retirada na proxima quinta apos quarta-feira da agenda', () => {
    expect(diaSemanaDataBR('29/07/2026')).toBe(3);
    expect(diaSemanaDataBR('30/07/2026')).toBe(4);
    expect(calcularDataDisponivelRetirada('29/07/2026')).toBe('30/07/2026');
  });

  it('calcula retirada na proxima quinta quando agenda cai em outro dia e troca mes', () => {
    expect(diaSemanaDataBR('31/07/2026')).toBe(5);
    expect(diaSemanaDataBR('06/08/2026')).toBe(4);
    expect(calcularDataDisponivelRetirada('31/07/2026')).toBe('06/08/2026');
  });

  it('calcula retirada na proxima quinta posterior quando agenda cai em quinta e troca ano', () => {
    expect(diaSemanaDataBR('31/12/2026')).toBe(4);
    expect(diaSemanaDataBR('07/01/2027')).toBe(4);
    expect(calcularDataDisponivelRetirada('31/12/2026')).toBe('07/01/2027');
  });

  it('gera resposta final de retirada sem afirmar entrega ou montagem', () => {
    const resposta = montarMensagemRetiradaDisponivel('30/07/2026');
    expect(resposta.tipo).toBe('pedido_confirmado_retirada');
    expect(resposta.texto).toContain('poder retirar a partir do dia 30/07');
    expect(resposta.texto).toContain('filial do Hauer');
    expect(resposta.texto).toContain('das 10h às 18h');
    expect(resposta.texto).toContain('*Te ajudo em algo mais?*');
    expect(resposta.texto).not.toContain('entrega e montagem');
    expect(resposta.texto).not.toContain('Nossa equipe entra em contato');
    expect(resposta.texto).not.toContain('equipe irá');
  });

  it('identifica grupo de retirada por equipe do grupo ou dos eventos', () => {
    expect(grupoEhClienteRetira(grupoBase({ equipe_agenda: '4- EQUIPE 01' }))).toBe(false);
    expect(grupoEhClienteRetira(grupoBase({ equipe_agenda: '  cliente retira loja  ' }))).toBe(true);
    expect(grupoEhClienteRetira(grupoBase({
      equipe_agenda: '4- EQUIPE 01',
      eventos: [
        { pedido_venda: '65469', evento_id: 'evt-1', calendar_id: 'cal-1', tempo_servico: '30 min', equipe_agenda: '7.3- CLIENTE RETIRA LOJA/SAI DO C.D', data_agenda_google: '29/07/2026', endereco_cliente: 'Rua das Flores' },
      ],
    }))).toBe(true);
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

  it('gera resposta aguardando data desejada com dataMinima dinamica', () => {
    const r = respostaAguardandoDataDesejada('15/07');
    expect(r.tipo).toBe('aguardando_data_desejada');
    expect(r.texto).toContain('A partir de qual data');
    expect(r.texto).toContain('15/07');
    expect(r.texto).toContain('antecedência');
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

describe('respostaDataAjustadaD2', () => {
  it('inclui dataMinima dinamica formatada dd/MM', () => {
    const r = respostaDataAjustadaD2('12/07');
    expect(r.tipo).toBe('data_ajustada_d2');
    expect(r.texto).toContain('12/07');
    expect(r.texto).toContain('antecedência');
  });

  it('nao pede outra data', () => {
    const r = respostaDataAjustadaD2('12/07');
    expect(r.texto).not.toContain('Pode me enviar outra data?');
  });

  it('nao contem mojibake', () => {
    const r = respostaDataAjustadaD2('12/07');
    expect(r.texto).not.toContain('Ã');
    expect(r.texto).not.toContain('Â');
    expect(r.texto).not.toContain('â€');
  });

  it('exemplo real: hoje 10/07/2026 -> dataMinima 12/07', () => {
    const hoje = new Date(2026, 6, 10);
    const d2 = new Date(hoje);
    d2.setDate(d2.getDate() + 2);
    const dataMinimaBR = `${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}`;
    const r = respostaDataAjustadaD2(dataMinimaBR);
    expect(r.texto).toBe('Para conseguir verificar automaticamente, preciso considerar pelo menos 2 dias de antecedência.\n\nComo a primeira data possível para pesquisa é 12/07, vou verificar as possibilidades a partir dessa data.');
  });
});

describe('formatarOpcoesDatasParaCliente com opcao manter data atual', () => {
  const datas2: DatasDisponiveisMere[] = [
    { dataISO: '2026-08-21', dataBR: '21/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1 },
    { dataISO: '2026-08-25', dataBR: '25/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
  ];

  const datas3: DatasDisponiveisMere[] = [
    { dataISO: '2026-08-20', dataBR: '20/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 1 },
    { dataISO: '2026-08-21', dataBR: '21/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 2 },
    { dataISO: '2026-08-25', dataBR: '25/08/2026', equipe: 'EQUIPE 1', tipo: 'normal', rank: 3 },
  ];

  it('lista com 2 datas inclui opcao 3 - Manter mesma data atual', () => {
    const texto = formatarOpcoesDatasParaCliente(datas2, true);
    expect(texto).toContain('1 - 21/08/2026');
    expect(texto).toContain('2 - 25/08/2026');
    expect(texto).toContain('3 - Manter mesma data atual');
    expect(texto).toContain('(1, 2, 3)');
  });

  it('lista com 3 datas inclui opcao 4 - Manter mesma data atual', () => {
    const texto = formatarOpcoesDatasParaCliente(datas3, true);
    expect(texto).toContain('1 - 20/08/2026');
    expect(texto).toContain('2 - 21/08/2026');
    expect(texto).toContain('3 - 25/08/2026');
    expect(texto).toContain('4 - Manter mesma data atual');
    expect(texto).toContain('(1, 2, 3, 4)');
  });

  it('sem flag incluirManterDataAtual nao adiciona opcao sintetica', () => {
    const texto = formatarOpcoesDatasParaCliente(datas2);
    expect(texto).toContain('1 - 21/08/2026');
    expect(texto).toContain('2 - 25/08/2026');
    expect(texto).not.toContain('Manter mesma data atual');
    expect(texto).toContain('(1, 2)');
  });

  it('nao contem mojibake na opcao manter', () => {
    const texto = formatarOpcoesDatasParaCliente(datas2, true);
    expect(texto).not.toContain('Ã');
    expect(texto).not.toContain('Â');
    expect(texto).not.toContain('â€');
  });
});
