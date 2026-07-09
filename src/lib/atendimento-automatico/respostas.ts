import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';

export type TipoRespostaSugerida =
  | 'pedido_nao_localizado'
  | 'pedido_negado_solicitar_novo_documento'
  | 'novo_documento_nao_localizado'
  | 'fallback_novo_documento_ou_esclarecimento'
  | 'transferido_humano_sem_documento_relocalizacao'
  | 'confirmar_entrega_unica'
  | 'escolher_grupo'
  | 'grupo_selecionado'
  | 'escolha_invalida'
  | 'pedido_confirmado_confirmar'
  | 'pedido_confirmado_alterar_escolher_acao'
  | 'pedido_confirmado_alterar_acao_ja_escolhida'
  | 'pedido_negado'
  | 'acao_alteracao_recebida'
  | 'confirmar_endereco_alteracao'
  | 'aguardando_data_desejada'
  | 'transferido_humano_endereco'
  | 'bloqueio_produto_pendente_antecipacao'
  | 'bloqueio_pagamento_pendente_antecipacao'
  | 'bloqueio_prazo_menor_7_antecipacao'
  | 'bloqueio_prazo_critico_d2_postergacao'
  | 'data_nao_interpretada'
  | 'data_invalida_adiantar'
  | 'data_invalida_postergar'
  | 'data_invalida_antes_d2'
  | 'data_invalida_fora_janela_d90'
  | 'data_desejada_recebida'
  | 'fallback_confirmacao_pedido'
  | 'fallback_escolha_acao'
  | 'fallback_confirmacao_endereco'
  | 'transferido_humano_muitas_tentativas'
  | 'consultando_datas'
  | 'datas_encontradas'
  | 'sem_datas_disponiveis'
  | 'erro_consulta_datas'
  | 'transferido_humano_dados_insuficientes'
  | 'transferido_humano_sem_datas'
  | 'transferido_humano_erro_consulta'
  | 'transferido_humano_coordenadas_nao_resolvidas'
  | 'data_opcao_invalida'
  | 'data_opcao_selecionada'
  | 'confirmar_reagendamento_final'
  | 'confirmacao_reagendamento_ambigua'
  | 'reagendamento_cancelado'
  | 'reagendamento_dry_run'
  | 'reagendamento_confirmado'
  | 'transferido_humano_erro_reagendamento';

export type RespostaSugerida = {
  texto: string;
  tipo: TipoRespostaSugerida;
};

function formatarPedidos(pedidos: string[]): string {
  const lista = pedidos.filter(Boolean);
  if (lista.length === 0) return '-';
  return lista.join(', ');
}

function formatarEnderecoCurto(endereco: string): string {
  return endereco || '-';
}

export function respostaPedidoNaoLocalizado(): RespostaSugerida {
  return {
    texto: 'Não encontrei pedido com esse CPF/CNPJ. Pode conferir se o documento do titular da compra está correto e me enviar novamente?',
    tipo: 'pedido_nao_localizado',
  };
}

export function respostaPedidoNegadoSolicitarNovoDocumento(): RespostaSugerida {
  return {
    texto: 'Entendi. Pode conferir o CPF/CNPJ do titular da compra e me enviar novamente?\n\nSe preferir, envie uma breve explicação que eu encaminho para nossa equipe verificar.',
    tipo: 'pedido_negado_solicitar_novo_documento',
  };
}

export function respostaNovoDocumentoNaoLocalizado(): RespostaSugerida {
  return {
    texto: 'Não consegui localizar uma entrega com esse CPF/CNPJ. Vou encaminhar seu atendimento para nossa equipe verificar manualmente.',
    tipo: 'novo_documento_nao_localizado',
  };
}

export function respostaFallbackNovoDocumentoOuEsclarecimento(): RespostaSugerida {
  return {
    texto: 'Não consegui localizar um CPF/CNPJ na sua mensagem.\n\nPode me enviar o CPF/CNPJ do titular da compra? Se não tiver essa informação, vou encaminhar para nossa equipe verificar manualmente.',
    tipo: 'fallback_novo_documento_ou_esclarecimento',
  };
}

export function respostaTransferidoHumanoSemDocumentoRelocalizacao(): RespostaSugerida {
  return {
    texto: 'Vou encaminhar seu atendimento para nossa equipe verificar manualmente.',
    tipo: 'transferido_humano_sem_documento_relocalizacao',
  };
}

export function respostaConfirmarEntregaUnica(grupo: GrupoAgendamento): RespostaSugerida {
  return {
    texto: `Encontrei esta entrega:\n\nCliente: ${grupo.nome_cliente}\nPedido(s): ${formatarPedidos(grupo.pedidos_venda)}\nEntrega agendada para: ${grupo.data_entrega}\nEndereço: ${formatarEnderecoCurto(grupo.endereco_curto)}\n\nÉ esta entrega mesmo?`,
    tipo: 'confirmar_entrega_unica',
  };
}

export function respostaEscolherGrupo(nomeCliente: string, grupos: GrupoAgendamento[]): RespostaSugerida {
  let texto = `Encontrei mais de uma entrega para ${nomeCliente}.\n\n`;

  for (const grupo of grupos) {
    texto += `Opção ${grupo.indice}:\n`;
    texto += `Pedido(s): ${formatarPedidos(grupo.pedidos_venda)}\n`;
    texto += `Entrega: ${grupo.data_entrega}\n`;
    texto += `Endereço: ${formatarEnderecoCurto(grupo.endereco_curto)}\n\n`;
  }

  texto += 'Digite o número da entrega que deseja tratar.';

  return {
    texto,
    tipo: 'escolher_grupo',
  };
}

export function respostaGrupoSelecionado(grupo: GrupoAgendamento): RespostaSugerida {
  return {
    texto: `Certo, selecionei esta entrega:\n\nPedido(s): ${formatarPedidos(grupo.pedidos_venda)}\nEntrega agendada para: ${grupo.data_entrega}\nEndereço: ${formatarEnderecoCurto(grupo.endereco_curto)}\n\nÉ esta entrega mesmo?`,
    tipo: 'grupo_selecionado',
  };
}

export function respostaEscolhaInvalida(): RespostaSugerida {
  return {
    texto: 'Não encontrei essa opção. Por favor, digite o número de uma das entregas listadas.',
    tipo: 'escolha_invalida',
  };
}

export function respostaPedidoConfirmadoConfirmarEntrega(dataEntrega: string): RespostaSugerida {
  return {
    texto: `Perfeito. Sua entrega está agendada para ${dataEntrega}.\n\nA entrega e montagem acontecem no mesmo dia, em horário comercial. Nossa equipe entra em contato próximo da data.\n\nTe ajudo em algo mais?`,
    tipo: 'pedido_confirmado_confirmar',
  };
}

export function respostaPedidoConfirmadoAlterarEscolherAcao(): RespostaSugerida {
  return {
    texto: 'Agora me diga o que você gostaria de fazer:\n\nResponda com:\n1 - Adiantar a entrega\n2 - Postergar a entrega',
    tipo: 'pedido_confirmado_alterar_escolher_acao',
  };
}

export function respostaPedidoConfirmadoAlterarAcaoJaEscolhida(): RespostaSugerida {
  return {
    texto: 'Perfeito. Já entendi a entrega e a solicitação. A próxima etapa será avaliar as datas disponíveis.',
    tipo: 'pedido_confirmado_alterar_acao_ja_escolhida',
  };
}

export function respostaPedidoNegado(): RespostaSugerida {
  return {
    texto: 'Entendi. Pode me passar mais detalhes ou informar o CPF/CNPJ correto para que eu consiga localizar a entrega certa?',
    tipo: 'pedido_negado',
  };
}

export function respostaAcaoAlteracaoRecebida(acao: 'adiantar' | 'postergar'): RespostaSugerida {
  const acaoTexto = acao === 'adiantar' ? 'adiantar' : 'postergar';
  return {
    texto: `Perfeito. Entendi que deseja ${acaoTexto} a entrega. A próxima etapa será avaliar as datas disponíveis.`,
    tipo: 'acao_alteracao_recebida',
  };
}

export function respostaConfirmarEnderecoAlteracao(acao: 'adiantar' | 'postergar', enderecoCompleto: string): RespostaSugerida {
  const acaoTexto = acao === 'adiantar' ? 'adiantar' : 'postergar';
  return {
    texto: `Perfeito! Entendi que deseja ${acaoTexto} a entrega.\n\nAntes de verificar as possibilidades, preciso confirmar uma informação.\n\nO endereço da entrega continua sendo:\n\n*${enderecoCompleto}*\n\nEstá correto?`,
    tipo: 'confirmar_endereco_alteracao',
  };
}

export function respostaAguardandoDataDesejada(): RespostaSugerida {
  return {
    texto: 'Perfeito!\n\nA partir de qual data gostaria de receber?\n\nPode responder com uma data, por exemplo: 20/07 ou 20/07/2026.',
    tipo: 'aguardando_data_desejada',
  };
}

export function respostaTransferidoHumanoEndereco(): RespostaSugerida {
  return {
    texto: 'Entendi. Como houve alteração de endereço, vou encaminhar seu atendimento para nossa equipe verificar certinho.',
    tipo: 'transferido_humano_endereco',
  };
}

export function respostaBloqueioProdutoPendenteAntecipacao(): RespostaSugerida {
  return {
    texto: 'Verifiquei aqui que ainda existe produto aguardando chegada da fábrica.\n\nPor isso não conseguimos antecipar a entrega neste momento.\n\nVou encaminhar seu atendimento para nossa equipe verificar para você.',
    tipo: 'bloqueio_produto_pendente_antecipacao',
  };
}

export function respostaBloqueioPagamentoPendenteAntecipacao(): RespostaSugerida {
  return {
    texto: 'Identifiquei que existe uma pendência de pagamento neste pedido.\n\nAssim que essa pendência for resolvida podemos verificar a possibilidade de antecipação da entrega.',
    tipo: 'bloqueio_pagamento_pendente_antecipacao',
  };
}

export function respostaBloqueioPrazoMenor7Antecipacao(): RespostaSugerida {
  return {
    texto: 'Como sua entrega já está próxima da data prevista, não conseguimos antecipar automaticamente neste momento.\n\nSe precisar, posso encaminhar para nossa equipe verificar para você.',
    tipo: 'bloqueio_prazo_menor_7_antecipacao',
  };
}

export function respostaBloqueioPrazoCriticoD2Postergacao(): RespostaSugerida {
  return {
    texto: 'Sua entrega já está confirmada para os próximos dias e não conseguimos alterar automaticamente neste momento.\n\nVou encaminhar seu atendimento para nossa equipe verificar para você.',
    tipo: 'bloqueio_prazo_critico_d2_postergacao',
  };
}

export function respostaDataNaoInterpretada(): RespostaSugerida {
  return {
    texto: 'Não consegui entender a data. Pode me enviar no formato dia/mês? Exemplo: 25/07.',
    tipo: 'data_nao_interpretada',
  };
}

export function respostaDataInvalidaAdiantar(): RespostaSugerida {
  return {
    texto: 'Para adiantar, preciso de uma data anterior à entrega atual. Pode me enviar outra data?',
    tipo: 'data_invalida_adiantar',
  };
}

export function respostaDataInvalidaPostergar(): RespostaSugerida {
  return {
    texto: 'Para postergar, preciso de uma data igual ou posterior à entrega atual. Pode me enviar outra data?',
    tipo: 'data_invalida_postergar',
  };
}

export function respostaDataInvalidaAntesD2(): RespostaSugerida {
  return {
    texto: 'Para conseguir verificar automaticamente, preciso de uma data com pelo menos 2 dias de antecedência. Pode me enviar outra data?',
    tipo: 'data_invalida_antes_d2',
  };
}

export function respostaDataInvalidaForaJanelaD90(): RespostaSugerida {
  return {
    texto: 'Essa data está muito distante da nossa janela de consulta automática. Vou encaminhar seu atendimento para nossa equipe verificar para você.',
    tipo: 'data_invalida_fora_janela_d90',
  };
}

export function respostaFallbackConfirmacaoPedido(): RespostaSugerida {
  return {
    texto: 'Não consegui entender se esta é a entrega correta.\n\nPode responder com "sim" se estiver correto ou "não" se não for esta entrega?',
    tipo: 'fallback_confirmacao_pedido',
  };
}

export function respostaFallbackEscolhaAcao(): RespostaSugerida {
  return {
    texto: 'Não consegui entender se você deseja adiantar ou postergar.\n\nResponda com:\n1 - Adiantar\n2 - Postergar',
    tipo: 'fallback_escolha_acao',
  };
}

export function respostaFallbackConfirmacaoEndereco(): RespostaSugerida {
  return {
    texto: 'Não consegui entender se o endereço está correto.\n\nPode responder com "sim" se o endereço estiver correto ou "não" se precisar alterar?',
    tipo: 'fallback_confirmacao_endereco',
  };
}

export function respostaTransferidoHumanoMuitasTentativas(contexto: 'pedido' | 'acao'): RespostaSugerida {
  const texto = contexto === 'pedido'
    ? 'Ainda não consegui entender sua resposta. Vou encaminhar seu atendimento para nossa equipe continuar por aqui.'
    : 'Ainda não consegui entender se você deseja adiantar ou postergar. Vou encaminhar seu atendimento para nossa equipe continuar por aqui.';
  return {
    texto,
    tipo: 'transferido_humano_muitas_tentativas',
  };
}

export function respostaDataDesejadaRecebida(dataBr: string): RespostaSugerida {
  return {
    texto: `Perfeito! Vou verificar as possibilidades a partir de ${dataBr}.`,
    tipo: 'data_desejada_recebida',
  };
}

export function respostaDatasEncontradas(opcoes: string): RespostaSugerida {
  return {
    texto: opcoes,
    tipo: 'datas_encontradas',
  };
}

export function respostaSemDatasDisponiveis(): RespostaSugerida {
  return {
    texto: 'Não encontrei uma opção automática dentro desse período. Vou encaminhar seu atendimento para nossa equipe verificar manualmente.',
    tipo: 'sem_datas_disponiveis',
  };
}

export function respostaErroConsultaDatas(): RespostaSugerida {
  return {
    texto: 'Encontrei um problema ao buscar as datas disponíveis. Vou encaminhar seu atendimento para nossa equipe verificar.',
    tipo: 'erro_consulta_datas',
  };
}

export function respostaTransferidoHumanoSemDados(motivo: string): RespostaSugerida {
  void motivo;
  return {
    texto: 'Vou encaminhar seu atendimento para nossa equipe continuar por aqui.',
    tipo: 'transferido_humano_dados_insuficientes',
  };
}

export function respostaTransferidoHumanoSemDatas(): RespostaSugerida {
  return {
    texto: 'Não encontrei uma opção automática dentro desse período. Vou encaminhar seu atendimento para nossa equipe verificar manualmente.',
    tipo: 'transferido_humano_sem_datas',
  };
}

export function respostaTransferidoHumanoErroDatas(): RespostaSugerida {
  return {
    texto: 'Encontrei um problema ao buscar as datas disponíveis. Vou encaminhar seu atendimento para nossa equipe verificar.',
    tipo: 'transferido_humano_erro_consulta',
  };
}

export function respostaTransferidoHumanoCoordenadas(): RespostaSugerida {
  return {
    texto: 'Não consegui localizar o endereço de entrega automaticamente. Vou encaminhar seu atendimento para nossa equipe verificar manualmente.',
    tipo: 'transferido_humano_coordenadas_nao_resolvidas',
  };
}

export function respostaDataOpcaoInvalida(max: number): RespostaSugerida {
  const opcoes = Array.from({ length: max }, (_, i) => String(i + 1)).join(', ');
  return {
    texto: `Não consegui entender a opção escolhida. Responda com o número da opção desejada, por exemplo: ${opcoes}.`,
    tipo: 'data_opcao_invalida',
  };
}

export function respostaDataOpcaoSelecionada(dataBR: string): RespostaSugerida {
  return {
    texto: `Perfeito! Selecionei a opção ${dataBR}. Vou encaminhar para nossa equipe confirmar a alteração na agenda.`,
    tipo: 'data_opcao_selecionada',
  };
}

export function respostaConfirmarReagendamentoFinal(dataOriginalBR: string, dataNovaBR: string): RespostaSugerida {
  return {
    texto: `Perfeito! Encontrei a opção ${dataNovaBR}.

Hoje sua entrega está agendada para ${dataOriginalBR}.

Confirma que deseja alterar para ${dataNovaBR}?`,
    tipo: 'confirmar_reagendamento_final',
  };
}

export function respostaConfirmacaoReagendamentoAmbigua(dataNovaBR: string): RespostaSugerida {
  return {
    texto: `Não consegui entender se posso alterar para ${dataNovaBR}. Pode responder com "sim" para confirmar ou "não" para cancelar?`,
    tipo: 'confirmacao_reagendamento_ambigua',
  };
}

export function respostaReagendamentoCancelado(): RespostaSugerida {
  return {
    texto: 'Tudo bem, não vou alterar a data da entrega. Se quiser escolher outra opção, me envie o número ou a data desejada.',
    tipo: 'reagendamento_cancelado',
  };
}

export function respostaReagendamentoDryRun(dataNovaBR: string): RespostaSugerida {
  return {
    texto: `Recebi sua confirmação para ${dataNovaBR}.

O reagendamento automático está em modo de teste, então não alterei a agenda.

Vou encaminhar para nossa equipe validar a alteração.`,
    tipo: 'reagendamento_dry_run',
  };
}

export function respostaReagendamentoConfirmado(dataNovaBR: string): RespostaSugerida {
  return {
    texto: `Perfeito, sua entrega foi reagendada para ${dataNovaBR}. Nossa equipe continua acompanhando por aqui.`,
    tipo: 'reagendamento_confirmado',
  };
}

export function respostaTransferidoHumanoErroReagendamento(): RespostaSugerida {
  return {
    texto: 'Recebi sua confirmação, mas não consegui concluir a alteração automática com segurança. Vou encaminhar seu atendimento para nossa equipe verificar.',
    tipo: 'transferido_humano_erro_reagendamento',
  };
}

export function normalizarConfirmacao(texto: string): 'confirmar' | 'negar' | null {
  const normalizado = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const confirmativas = [
    'sim',
    'isso',
    'correto',
    'esta correto',
    'sim esta correto',
    'e esse',
    'e essa',
    'e isso',
    'pode ser',
    'pode',
    'certo',
    'exato',
    'issomesmo',
    'sim mesmo',
  ];

  const negativas = [
    'nao',
    'nao e',
    'nao esta',
    'errado',
    'outro',
    'outra',
    'trocar',
    'mudar',
  ];

  if (normalizado === 'nao' || normalizado.startsWith('nao ') || normalizado.includes(' nao ')) {
    return 'negar';
  }

  for (const frase of confirmativas) {
    if (normalizado === frase || normalizado.startsWith(frase + ' ') || normalizado.includes(' ' + frase)) {
      return 'confirmar';
    }
  }

  for (const frase of negativas) {
    if (normalizado === frase || normalizado.startsWith(frase + ' ') || normalizado.startsWith(frase)) {
      return 'negar';
    }
  }

  return null;
}
