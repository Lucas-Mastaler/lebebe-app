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
  | 'acao_alteracao_recebida';

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
