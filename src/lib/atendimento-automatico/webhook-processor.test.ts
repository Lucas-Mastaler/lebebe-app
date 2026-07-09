import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processarWebhookPosVenda } from './webhook-processor';
import { buscarAgendamentosPorDocumento } from '@/lib/google/sheets-service-account';
import { createServiceClient } from '@/lib/supabase/service';
import type { GrupoAgendamento, AgendamentoEncontrado } from '@/lib/google/sheets-service-account';

vi.mock('@/lib/google/sheets-service-account', () => ({
  buscarAgendamentosPorDocumento: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

type SessaoFake = {
  id: string;
  digisac_ticket_id: string;
  digisac_contact_id: string;
  telefone: string;
  estado: string;
  status: string;
  tipo_solicitacao: string;
  documento_informado: string | null;
  metadata: Record<string, unknown> | null;
};

const updates: Array<{ table: string; data: Record<string, unknown> }> = [];
const inserts: Array<{ table: string; data: Record<string, unknown> }> = [];
let sessaoAtual: SessaoFake;

function criarSupabaseFake() {
  return {
    from(table: string) {
      const builder = {
        _mode: 'select',
        select() {
          this._mode = 'select';
          return this;
        },
        eq() {
          if (this._mode === 'update') return Promise.resolve({ data: null, error: null });
          return this;
        },
        or() {
          return this;
        },
        maybeSingle() {
          if (table === 'atendimento_automatico_mensagens') return Promise.resolve({ data: null, error: null });
          if (table === 'atendimento_automatico_sessoes') return Promise.resolve({ data: sessaoAtual, error: null });
          if (table === 'atendimento_automatico_bloqueios') return Promise.resolve({ data: null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        update(data: Record<string, unknown>) {
          this._mode = 'update';
          updates.push({ table, data });
          return this;
        },
        insert(data: Record<string, unknown>) {
          inserts.push({ table, data });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };
}

function payload(text: string, id = `msg-${Math.random()}`) {
  return {
    event: 'message.created',
    data: {
      id,
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      serviceId: 'service-pos',
      type: 'chat',
      text,
      isFromMe: false,
      isFromBot: false,
      ticket: { isOpen: true, departmentId: 'dep-1' },
    },
  };
}

function grupoBase(): GrupoAgendamento {
  return {
    indice: 1,
    nome_cliente: 'Cliente Teste',
    cpf_mascarado: '109.***.***-14',
    data_entrega: '17/07/2026',
    endereco_completo: 'Rua Teste, 123, Curitiba, PR',
    endereco_curto: 'Rua Teste, 123...',
    pedidos_venda: ['12345'],
    produtos: ['Berco'],
    tempo_para_entrega: '15',
    tempo_servico: '00:40',
    equipe_agenda: 'Equipe A',
    pendente_pagamento: 'Nao',
    status_estoque: 'Completo',
    produtos_pendentes: '',
    eventos: [],
    itens_originais: [],
  };
}

function agendamentoBase(): AgendamentoEncontrado {
  return {
    filial_venda: '1',
    nome_cliente: 'Cliente Teste',
    pedido_venda: '12345',
    data_agenda_google: '17/07/2026',
    status_estoque: 'Completo',
    quanto_tempo_entrega: '15',
    produtos_pendentes: '',
    endereco_cliente: 'Rua Teste, 123, Curitiba, PR',
    produtos_lancamento: 'Berco',
    equipe_agenda: 'Equipe A',
    pendente_pagamento: 'Nao',
    cpf_mascarado: '109.***.***-14',
    tempo_servico: '00:40',
    evento_id: 'evt-1',
    calendar_id: 'cal-1',
  };
}

function sessaoBase(parcial: Partial<SessaoFake> = {}): SessaoFake {
  return {
    id: 'sessao-1',
    digisac_ticket_id: 'ticket-1',
    digisac_contact_id: 'contact-1',
    telefone: '5541999999999',
    estado: 'aguardando_confirmacao_pedido',
    status: 'ativa',
    tipo_solicitacao: 'alterar_entrega',
    documento_informado: '11122233344',
    metadata: {
      total_grupos_agendamento: 1,
      grupo_agendamento_selecionado: 1,
      grupos_agendamento: [grupoBase()],
    },
    ...parcial,
  };
}

beforeEach(() => {
  process.env.ATENDIMENTO_POSVENDA_ALLOWED_PHONES = '5541999999999';
  process.env.ATENDIMENTO_POSVENDA_AUTO_REPLY_ENABLED = 'false';
  process.env.DIGISAC_SERVICE_ID_POS_VENDA = 'service-pos';
  updates.length = 0;
  inserts.length = 0;
  vi.mocked(createServiceClient).mockReturnValue(criarSupabaseFake() as never);
  vi.mocked(buscarAgendamentosPorDocumento).mockReset();
  sessaoAtual = sessaoBase();
});

describe('processarWebhookPosVenda - relocalizacao de pedido negado', () => {
  it('muda para aguardando novo documento quando cliente nega a entrega', async () => {
    const resultado = await processarWebhookPosVenda(payload('nao', 'msg-negacao'));

    expect(resultado).toMatchObject({ ok: true, saved: true, origem: 'cliente' });
    const updateSessao = updates.find((u) => u.table === 'atendimento_automatico_sessoes');
    expect(updateSessao?.data.estado).toBe('aguardando_novo_documento_ou_esclarecimento');
    expect(updateSessao?.data.status).toBe('ativa');
    expect(updateSessao?.data.metadata).toMatchObject({
      pedido_confirmado: false,
      motivo_pedido_negado: 'cliente_informou_entrega_incorreta',
      resposta_sugerida_tipo: 'pedido_negado_solicitar_novo_documento',
    });
  });

  it('reconsulta planilha quando cliente envia novo CPF valido localizado', async () => {
    sessaoAtual = sessaoBase({
      estado: 'aguardando_novo_documento_ou_esclarecimento',
      metadata: {
        pedido_confirmado: false,
        motivo_pedido_negado: 'cliente_informou_entrega_incorreta',
      },
    });
    vi.mocked(buscarAgendamentosPorDocumento).mockResolvedValue({
      ok: true,
      agendamentos: [agendamentoBase()],
      total: 1,
      grupos: [grupoBase()],
      total_grupos: 1,
    });

    await processarWebhookPosVenda(payload('10976025914', 'msg-doc-localizado'));

    expect(buscarAgendamentosPorDocumento).toHaveBeenCalledWith('10976025914');
    const updateSessao = updates.find((u) => u.table === 'atendimento_automatico_sessoes');
    expect(updateSessao?.data.documento_informado).toBe('10976025914');
    expect(updateSessao?.data.estado).toBe('aguardando_confirmacao_pedido');
    expect(updateSessao?.data.metadata).toMatchObject({
      busca_agenda_status: 'encontrado',
      total_grupos_agendamento: 1,
      grupo_agendamento_selecionado: 1,
      documento_anterior_mascarado: '111.***.***-44',
      documento_retentativa_mascarado: '109.***.***-14',
      tentativas_documento: 1,
      resposta_sugerida_tipo: 'confirmar_entrega_unica',
    });
  });

  it('transfere para humano quando novo CPF valido nao localiza pedido', async () => {
    sessaoAtual = sessaoBase({ estado: 'aguardando_novo_documento_ou_esclarecimento' });
    vi.mocked(buscarAgendamentosPorDocumento).mockResolvedValue({
      ok: true,
      agendamentos: [],
      total: 0,
      grupos: [],
      total_grupos: 0,
    });

    await processarWebhookPosVenda(payload('10976025914', 'msg-doc-nao-localizado'));

    const updateSessao = updates.find((u) => u.table === 'atendimento_automatico_sessoes');
    expect(updateSessao?.data.estado).toBe('transferido_humano');
    expect(updateSessao?.data.status).toBe('transferido_humano');
    expect(updateSessao?.data.motivo_falha).toBe('novo_documento_nao_localizado');
    expect(updateSessao?.data.metadata).toMatchObject({
      motivo_transferencia_humano: 'novo_documento_nao_localizado',
      resposta_sugerida_tipo: 'novo_documento_nao_localizado',
    });
  });

  it('mantem estado e pede CPF/CNPJ quando texto nao tem documento', async () => {
    sessaoAtual = sessaoBase({ estado: 'aguardando_novo_documento_ou_esclarecimento', metadata: {} });

    await processarWebhookPosVenda(payload('nao tenho certeza', 'msg-sem-doc-1'));

    const updateSessao = updates.find((u) => u.table === 'atendimento_automatico_sessoes');
    expect(updateSessao?.data.estado).toBeUndefined();
    expect(updateSessao?.data.metadata).toMatchObject({
      tentativas_invalidas_estado: 1,
      tentativas_invalidas_ultimo_estado: 'aguardando_novo_documento_ou_esclarecimento',
      resposta_sugerida_tipo: 'fallback_novo_documento_ou_esclarecimento',
    });
  });

  it('transfere para humano na segunda tentativa sem CPF/CNPJ', async () => {
    sessaoAtual = sessaoBase({
      estado: 'aguardando_novo_documento_ou_esclarecimento',
      metadata: {
        tentativas_invalidas_estado: 1,
        tentativas_invalidas_ultimo_estado: 'aguardando_novo_documento_ou_esclarecimento',
      },
    });

    await processarWebhookPosVenda(payload('nao tenho esse dado', 'msg-sem-doc-2'));

    const updateSessao = updates.find((u) => u.table === 'atendimento_automatico_sessoes');
    expect(updateSessao?.data.estado).toBe('transferido_humano');
    expect(updateSessao?.data.status).toBe('transferido_humano');
    expect(updateSessao?.data.motivo_falha).toBe('sem_documento_para_relocalizar_pedido');
    expect(updateSessao?.data.metadata).toMatchObject({
      tentativas_invalidas_estado: 2,
      motivo_transferencia_humano: 'sem_documento_para_relocalizar_pedido',
      resposta_sugerida_tipo: 'transferido_humano_sem_documento_relocalizacao',
    });
  });
});
