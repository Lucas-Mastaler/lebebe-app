import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';

export type TipoRespostaSugerida =
  | 'pedido_nao_localizado'
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
  | 'data_desejada_recebida';

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
    texto: `Perfeito. Sua entrega está agendada para ${dataEntrega}. A entrega e montagem acontecem no mesmo dia, em horário comercial. Nossa equipe entra em contato próximo da data.`,
    tipo: 'pedido_confirmado_confirmar',
  };
}

export function respostaPedidoConfirmadoAlterarEscolherAcao(): RespostaSugerida {
  return {
    texto: 'Você deseja adiantar ou postergar essa entrega?\n\n1 - Adiantar\n2 - Postergar',
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
    texto: `Perfeito! Entendi que deseja ${acaoTexto} a entrega.\n\nAntes de verificar as possibilidades, preciso confirmar uma informação.\n\nO endereço da entrega continua sendo:\n\n${enderecoCompleto}\n\nEstá correto?`,
    tipo: 'confirmar_endereco_alteracao',
  };
}

export function respostaAguardandoDataDesejada(): RespostaSugerida {
  return {
    texto: 'Perfeito!\n\nA partir de qual data gostaria de receber?',
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

export function respostaDataDesejadaRecebida(dataBr: string): RespostaSugerida {
  return {
    texto: `Perfeito! Vou verificar as possibilidades a partir de ${dataBr}.`,
    tipo: 'data_desejada_recebida',
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
