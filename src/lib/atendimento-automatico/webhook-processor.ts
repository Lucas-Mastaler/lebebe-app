import { createServiceClient } from '@/lib/supabase/service';
import { normalizarTextoDigisac } from '@/lib/digisac/triagem';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { buscarAgendamentosPorDocumento } from '@/lib/google/sheets-service-account';
import type { GrupoAgendamento } from '@/lib/google/sheets-service-account';
import {
  normalizarConfirmacao,
  respostaAguardandoDataDesejada,
  respostaBloqueioPagamentoPendenteAntecipacao,
  respostaBloqueioPrazoCriticoD2Postergacao,
  respostaBloqueioPrazoMenor7Antecipacao,
  respostaBloqueioProdutoPendenteAntecipacao,
  respostaConfirmarEnderecoAlteracao,
  respostaConfirmarEntregaUnica,
  respostaEscolhaInvalida,
  respostaEscolherGrupo,
  respostaGrupoSelecionado,
  respostaPedidoConfirmadoAlterarAcaoJaEscolhida,
  respostaPedidoConfirmadoAlterarEscolherAcao,
  respostaPedidoConfirmadoConfirmarEntrega,
  respostaPedidoNaoLocalizado,
  respostaPedidoNegado,
  respostaTransferidoHumanoEndereco,
  type RespostaSugerida,
} from './respostas';
import { chaveRespostaAutomatica, processarEnvioAutomatico } from './auto-reply';

type OrigemMensagem = 'cliente' | 'bot' | 'humano' | 'sistema';

type ResultadoWebhook =
  | { ok: true; ignored: true; reason: string }
  | { ok: true; saved: true; origem: OrigemMensagem }
  | { ok: false; error: string };

function detectarOrigem(msg: Record<string, unknown>): OrigemMensagem {
  const isFromMe = msg.isFromMe === true;
  const isFromBot = msg.isFromBot === true;
  const isComment = msg.isComment === true;

  if (isFromMe && isFromBot) return 'bot';
  if (isFromMe && !isFromBot && !isComment) return 'humano';
  if (isComment) return 'sistema';
  if (!isFromMe && !isFromBot) return 'cliente';
  return 'sistema';
}

function detectarSolicitacao(textoNormalizado: string): string | null {
  const ambíguas = [
    'sim',
    'nao',
    'ok',
    'esta correto',
    'sim esta correto',
    'isso',
    'pode ser',
    'obrigada',
    'obrigado',
    'bom dia',
    'boa tarde',
    'boa noite',
    'teste',
  ];

  if (ambíguas.includes(textoNormalizado)) return null;

  if (textoNormalizado === '1') return 'confirmar_entrega';
  if (textoNormalizado === '2') return 'alterar_entrega';

  const frasesConfirmar = [
    'confirmar data de entrega',
    'confirmar data entrega',
    'confirmar entrega',
    'data da entrega',
    'quando vai entregar',
    'quando sera a entrega',
    'qual a data da entrega',
    'consultar data de entrega',
  ];

  const frasesAlterar = [
    'alterar data de entrega',
    'alterar data entrega',
    'alterar entrega',
    'mudar data da entrega',
    'mudar a data da entrega',
    'trocar data da entrega',
    'trocar a data da entrega',
    'remarcar entrega',
    'antecipar entrega',
    'adiantar entrega',
    'postergar entrega',
    'mudar minha entrega',
  ];

  for (const frase of frasesConfirmar) {
    if (textoNormalizado.includes(frase)) return 'confirmar_entrega';
  }

  for (const frase of frasesAlterar) {
    if (textoNormalizado.includes(frase)) return 'alterar_entrega';
  }

  return null;
}

function extrairTelefone(msg: Record<string, unknown>): string | null {
  const contact = msg.contact as Record<string, unknown> | undefined;
  if (!contact) return null;
  const contactData = contact.data as Record<string, unknown> | undefined;
  const number = (contactData?.number as string | undefined) ?? (contact.number as string | undefined);
  return number ?? null;
}

function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '');
}

async function buscarTelefonePorContactId(contactId: string): Promise<string | null> {
  try {
    const res = await fetchDigisac(`/contacts/${contactId}`) as Record<string, unknown>;
    const data = res?.data as Record<string, unknown> | undefined;
    const number = (data?.number as string | undefined) ?? null;
    return number;
  } catch {
    console.log('[posvenda-webhook] erro ao buscar telefone por contactId');
    return null;
  }
}

function telefoneAutorizado(telefone: string | null): boolean {
  const allowedEnv = process.env.ATENDIMENTO_POSVENDA_ALLOWED_PHONES;
  if (!allowedEnv) {
    console.log('[posvenda-webhook] allowlist vazia, fluxo automatico desativado por seguranca');
    return false;
  }
  const allowed = allowedEnv.split(',').map((t) => normalizarTelefone(t.trim())).filter(Boolean);
  if (allowed.length === 0) return false;
  if (!telefone) return false;
  const telNormalizado = normalizarTelefone(telefone);
  return allowed.includes(telNormalizado);
}

function detectarDocumento(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 11 || digitos.length === 14) {
    return digitos;
  }
  return null;
}

function normalizarNumeroEntrega(raw: string): number | null {
  const s = raw.replace(/[^\d,.-]/g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

type ResultadoBloqueioAcao =
  | { bloqueado: false }
  | { bloqueado: true; motivo: string; resposta: RespostaSugerida };

function validarBloqueioAcao(acao: 'adiantar' | 'postergar', grupo: GrupoAgendamento | null): ResultadoBloqueioAcao {
  const tempoRaw = grupo?.tempo_para_entrega ?? '';
  const tempoNum = normalizarNumeroEntrega(tempoRaw);
  const tempoEntrega = tempoNum !== null ? tempoNum : 999;

  const produtosPendentes = (grupo?.produtos_pendentes ?? '').trim();
  const pendentePagamento = (grupo?.pendente_pagamento ?? '').trim().toLowerCase();
  const temProdutoPendente = produtosPendentes !== '' && produtosPendentes !== '-' && produtosPendentes !== '0';
  const temPendenciaPagamento =
    pendentePagamento !== '' &&
    pendentePagamento !== 'nao' &&
    pendentePagamento !== 'não' &&
    pendentePagamento !== '-' &&
    pendentePagamento !== 'no';

  if (acao === 'adiantar') {
    if (temProdutoPendente) {
      return { bloqueado: true, motivo: 'produto_pendente_antecipacao', resposta: respostaBloqueioProdutoPendenteAntecipacao() };
    }
    if (temPendenciaPagamento) {
      return { bloqueado: true, motivo: 'pendencia_pagamento_antecipacao', resposta: respostaBloqueioPagamentoPendenteAntecipacao() };
    }
    if (tempoEntrega <= 7) {
      return { bloqueado: true, motivo: 'prazo_menor_ou_igual_7_antecipacao', resposta: respostaBloqueioPrazoMenor7Antecipacao() };
    }
  }

  if (acao === 'postergar') {
    if (tempoEntrega <= 2) {
      return { bloqueado: true, motivo: 'prazo_critico_d2_postergacao', resposta: respostaBloqueioPrazoCriticoD2Postergacao() };
    }
  }

  return { bloqueado: false };
}

function obterGrupoSelecionado(metadata: Record<string, unknown> | null): GrupoAgendamento | null {
  if (!metadata) return null;
  const grupos = metadata.grupos_agendamento as GrupoAgendamento[] | undefined;
  const indiceSelecionado = metadata.grupo_agendamento_selecionado as number | undefined;
  if (!grupos || grupos.length === 0 || indiceSelecionado === undefined || indiceSelecionado === null) {
    return null;
  }
  return grupos.find((g) => g.indice === indiceSelecionado) ?? null;
}

async function construirMetadataComResposta(
  params: {
    sessaoId: string;
    metadataAtual: Record<string, unknown> | null;
    resposta: RespostaSugerida;
    estado: string;
    contactId: string | null;
    ticketId: string | null;
    digisacMessageId: string | undefined;
    telefoneAutorizado: boolean;
  }
): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {
    ...(params.metadataAtual ?? {}),
    resposta_sugerida: params.resposta.texto,
    resposta_sugerida_tipo: params.resposta.tipo,
    resposta_sugerida_em: new Date().toISOString(),
  };

  const envio = await processarEnvioAutomatico({
    sessaoId: params.sessaoId,
    estado: params.estado,
    resposta: params.resposta,
    digisacMessageId: params.digisacMessageId,
    contactId: params.contactId,
    ticketId: params.ticketId,
    metadataAtual: params.metadataAtual,
    telefoneAutorizado: params.telefoneAutorizado,
  });

  if (envio.enviado) {
    metadata.resposta_automatica_enviada = true;
    metadata.resposta_automatica_enviada_em = new Date().toISOString();
    if (envio.digisac_message_id) {
      metadata.resposta_automatica_digisac_message_id = envio.digisac_message_id;
      // Acumular lista de ids para reconhecer eco de multiplas mensagens automaticas
      const idsExistentes = (params.metadataAtual?.respostas_automaticas_enviadas_ids as string[] | undefined) ?? [];
      const novosIds = [...idsExistentes];
      if (!novosIds.includes(envio.digisac_message_id)) {
        novosIds.push(envio.digisac_message_id);
      }
      metadata.respostas_automaticas_enviadas_ids = novosIds;
    }
    metadata.ultima_resposta_automatica_chave = chaveRespostaAutomatica(
      params.sessaoId,
      params.estado,
      params.resposta.tipo,
      params.digisacMessageId
    );
  } else {
    metadata.resposta_automatica_enviada = false;
    if (envio.erro) {
      metadata.resposta_automatica_erro = envio.erro.substring(0, 200);
    }
  }

  return metadata;
}

export async function processarWebhookPosVenda(rawPayload: unknown): Promise<ResultadoWebhook> {
  try {
    const payload = rawPayload as Record<string, unknown>;
    const evento = payload.event as string | undefined;
    const msg = payload.data as Record<string, unknown> | undefined;

    if (evento !== 'message.created') {
      return { ok: true, ignored: true, reason: 'evento_invalido' };
    }
    if (!msg) {
      return { ok: true, ignored: true, reason: 'payload_sem_data' };
    }

    const messageId = msg.id as string | undefined;
    const contactId = (msg.contactId as string | undefined) ?? (msg.fromId as string | undefined) ?? null;
    const serviceId = msg.serviceId as string | undefined;

    console.log(`[posvenda-webhook] evento recebido messageId=${messageId} contactId=${contactId} serviceId=${serviceId}`);

    if (!messageId) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: sem messageId');
      return { ok: true, ignored: true, reason: 'sem_message_id' };
    }

    if (msg.isComment === true) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: comentario interno');
      return { ok: true, ignored: true, reason: 'comentario_interno' };
    }

    if (msg.type !== 'chat') {
      console.log('[posvenda-webhook] ignorado por filtro técnico: tipo nao chat');
      return { ok: true, ignored: true, reason: 'tipo_nao_chat' };
    }

    const text = msg.text as string | undefined;
    if (!text?.trim()) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: texto vazio');
      return { ok: true, ignored: true, reason: 'texto_vazio' };
    }

    const ticketObj = msg.ticket as Record<string, unknown> | undefined;
    if (ticketObj?.isOpen === false) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: ticket fechado');
      return { ok: true, ignored: true, reason: 'ticket_fechado' };
    }

    const expectedServiceId = process.env.DIGISAC_SERVICE_ID_POS_VENDA;
    if (expectedServiceId && serviceId && serviceId !== expectedServiceId) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: serviceId diferente');
      return { ok: true, ignored: true, reason: 'service_id_diferente' };
    }

    const ticketId = (msg.ticketId as string | undefined) ?? null;
    if (!ticketId) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: sem ticketId');
      return { ok: true, ignored: true, reason: 'sem_ticket_id' };
    }

    if (!contactId) {
      console.log('[posvenda-webhook] ignorado por filtro técnico: sem contactId');
      return { ok: true, ignored: true, reason: 'sem_contact_id' };
    }

    const supabase = createServiceClient();

    // Idempotencia por digisac_message_id
    const { data: msgExistente } = await supabase
      .from('atendimento_automatico_mensagens')
      .select('id')
      .eq('digisac_message_id', messageId)
      .maybeSingle();

    if (msgExistente) {
      console.log(`[posvenda-webhook] duplicado por digisac_message_id messageId=${messageId}`);
      return { ok: true, ignored: true, reason: 'duplicado' };
    }

    const origem = detectarOrigem(msg);
    const departmentId =
      (ticketObj?.departmentId as string | undefined) ??
      (msg.ticketDepartmentId as string | undefined) ??
      null;

    // Buscar ou criar sessao
    const { data: sessaoExistente } = await supabase
      .from('atendimento_automatico_sessoes')
      .select('*')
      .eq('digisac_ticket_id', ticketId)
      .maybeSingle();

    let sessaoId: string;

    // Antes de tratar como humano: verificar se esta mensagem foi enviada automaticamente pela Mere
    if (origem === 'humano' && sessaoExistente) {
      const metaAutoReply = sessaoExistente.metadata as Record<string, unknown> | null;
      const idUltimoEnvio = metaAutoReply?.resposta_automatica_digisac_message_id as string | undefined;
      const idsEnviados = metaAutoReply?.respostas_automaticas_enviadas_ids as string[] | undefined;

      const ehAutoReplyConhecida =
        (idUltimoEnvio && idUltimoEnvio === messageId) ||
        (Array.isArray(idsEnviados) && idsEnviados.includes(messageId ?? ''));

      if (ehAutoReplyConhecida) {
        await supabase.from('atendimento_automatico_mensagens').insert({
          sessao_id: sessaoExistente.id,
          digisac_message_id: messageId,
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          origem: 'bot',
          texto: text,
          tipo_mensagem: msg.type as string | undefined,
          timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
          status: 'processada',
          metadata: { serviceId, departmentId, auto_reply_eco: true },
        });
        console.log(`[posvenda-webhook] auto-reply propria detectada e ignorada messageId=${messageId} sessaoId=${sessaoExistente.id}`);
        return { ok: true, ignored: true, reason: 'auto_reply_propria' };
      }
    }

    if (origem === 'humano') {
      if (!sessaoExistente) {
        console.log('[posvenda-webhook] humano sem sessao existente, ignorando');
        return { ok: true, ignored: true, reason: 'humano_sem_sessao' };
      }

      if (!telefoneAutorizado(sessaoExistente.telefone)) {
        console.log('[posvenda-webhook] humano com sessao nao autorizada, ignorando');
        return { ok: true, ignored: true, reason: 'humano_sessao_nao_autorizada' };
      }

      sessaoId = sessaoExistente.id;
      const pausaAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('atendimento_automatico_sessoes')
        .update({
          status: 'pausado_humano',
          estado: 'pausado_humano',
          pausa_ate: pausaAte,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessaoId);

      await supabase.from('atendimento_automatico_eventos').insert({
        sessao_id: sessaoId,
        tipo: 'pausa_humano',
        descricao: 'Humano interno detectado, sessao pausada por 24h',
      });

      await supabase.from('atendimento_automatico_mensagens').insert({
        sessao_id: sessaoId,
        digisac_message_id: messageId,
        digisac_ticket_id: ticketId,
        digisac_contact_id: contactId ?? null,
        origem: 'humano',
        texto: text,
        tipo_mensagem: msg.type as string | undefined,
        timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
        status: 'processada',
        metadata: { serviceId, departmentId },
      });

      console.log(`[posvenda-webhook] humano detectado, sessao pausada sessaoId=${sessaoId}`);
      return { ok: true, saved: true, origem: 'humano' };
    }

    if (origem === 'bot') {
      if (!sessaoExistente) {
        console.log('[posvenda-webhook] bot sem sessao existente, ignorando');
        return { ok: true, ignored: true, reason: 'bot_sem_sessao' };
      }

      if (!telefoneAutorizado(sessaoExistente.telefone)) {
        console.log('[posvenda-webhook] bot com sessao nao autorizada, ignorando');
        return { ok: true, ignored: true, reason: 'bot_sessao_nao_autorizada' };
      }

      sessaoId = sessaoExistente.id;

      await supabase.from('atendimento_automatico_mensagens').insert({
        sessao_id: sessaoId,
        digisac_message_id: messageId,
        digisac_ticket_id: ticketId,
        digisac_contact_id: contactId ?? null,
        origem: 'bot',
        texto: text,
        tipo_mensagem: msg.type as string | undefined,
        timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
        status: 'processada',
        metadata: { serviceId, departmentId },
      });

      await supabase
        .from('atendimento_automatico_sessoes')
        .update({
          ultima_mensagem_bot: text.substring(0, 200),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessaoId);

      console.log(`[posvenda-webhook] mensagem bot salva sessaoId=${sessaoId}`);
      return { ok: true, saved: true, origem: 'bot' };
    }

    // origem === 'cliente'

    if (sessaoExistente) {
      sessaoId = sessaoExistente.id;

      // Resolver telefone se sessao nao tiver
      let telefoneSessao = sessaoExistente.telefone;
      if (!telefoneSessao && contactId) {
        telefoneSessao = await buscarTelefonePorContactId(contactId);
        if (telefoneSessao) {
          await supabase
            .from('atendimento_automatico_sessoes')
            .update({ telefone: telefoneSessao, updated_at: new Date().toISOString() })
            .eq('id', sessaoId);
        }
      }

      // Allowlist
      if (!telefoneAutorizado(telefoneSessao)) {
        console.log('[posvenda-webhook] cliente nao autorizado na allowlist, ignorando');
        return { ok: true, ignored: true, reason: 'telefone_nao_autorizado' };
      }

      // Verificar bloqueios ativos
      if (contactId) {
        const { data: bloqueioAtivo } = await supabase
          .from('atendimento_automatico_bloqueios')
          .select('id, tipo, bloqueado_ate')
          .eq('digisac_contact_id', contactId)
          .eq('ativo', true)
          .or('bloqueado_ate.is.null,bloqueado_ate.gt.now()')
          .maybeSingle();

        if (bloqueioAtivo) {
          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              status: bloqueioAtivo.tipo === 'permanente' ? 'bloqueado_permanente' : 'bloqueado_24h',
              estado: bloqueioAtivo.tipo === 'permanente' ? 'bloqueado_permanente' : 'bloqueado_24h',
              bloqueio_permanente: bloqueioAtivo.tipo === 'permanente',
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, bloqueado: bloqueioAtivo.tipo },
          });

          console.log(`[posvenda-webhook] cliente bloqueado (${bloqueioAtivo.tipo}), mensagem salva`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Maquina de estados
      const textoNormalizado = normalizarTextoDigisac(text);

      // Estado: aguardando_documento
      if (sessaoExistente.estado === 'aguardando_documento') {
        const documento = detectarDocumento(text);

        if (documento) {
          const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
          const buscaAgendaEm = new Date().toISOString();

          const resultadoBusca = await buscarAgendamentosPorDocumento(documento);

          let novoEstado: string;
          let metadataBusca: Record<string, unknown>;

          if (resultadoBusca.ok) {
            const grupos = resultadoBusca.grupos;
            const telefoneSessao = sessaoExistente.telefone;
            const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);

            if (resultadoBusca.total > 0 && grupos.length > 0) {
              if (grupos.length === 1) {
                const grupo = grupos[0];
                novoEstado = 'aguardando_confirmacao_pedido';
                metadataBusca = await construirMetadataComResposta({
                  sessaoId,
                  metadataAtual: {
                    ...(metadataAtual ?? {}),
                    agendamentos_encontrados: resultadoBusca.agendamentos,
                    total_agendamentos_encontrados: resultadoBusca.total,
                    grupos_agendamento: grupos,
                    total_grupos_agendamento: grupos.length,
                    grupo_agendamento_selecionado: 1,
                    busca_agenda_status: 'encontrado',
                    busca_agenda_em: buscaAgendaEm,
                  },
                  resposta: respostaConfirmarEntregaUnica(grupo),
                  estado: novoEstado,
                  contactId,
                  ticketId,
                  digisacMessageId: messageId,
                  telefoneAutorizado: telefoneAutorizadoFlag,
                });
                console.log(`[posvenda-webhook] pedido localizado sessaoId=${sessaoId} total=${resultadoBusca.total} grupos=${grupos.length}`);
              } else {
                const nomeCliente = grupos[0]?.nome_cliente ?? '';
                novoEstado = 'aguardando_escolha_grupo';
                metadataBusca = await construirMetadataComResposta({
                  sessaoId,
                  metadataAtual: {
                    ...(metadataAtual ?? {}),
                    agendamentos_encontrados: resultadoBusca.agendamentos,
                    total_agendamentos_encontrados: resultadoBusca.total,
                    grupos_agendamento: grupos,
                    total_grupos_agendamento: grupos.length,
                    grupo_agendamento_selecionado: null,
                    busca_agenda_status: 'encontrado',
                    busca_agenda_em: buscaAgendaEm,
                  },
                  resposta: respostaEscolherGrupo(nomeCliente, grupos),
                  estado: novoEstado,
                  contactId,
                  ticketId,
                  digisacMessageId: messageId,
                  telefoneAutorizado: telefoneAutorizadoFlag,
                });
                console.log(`[posvenda-webhook] multiplos grupos sessaoId=${sessaoId} total=${resultadoBusca.total} grupos=${grupos.length}`);
              }
            } else {
              novoEstado = 'pedido_nao_localizado';
              metadataBusca = await construirMetadataComResposta({
                sessaoId,
                metadataAtual: {
                  ...(metadataAtual ?? {}),
                  agendamentos_encontrados: [],
                  total_agendamentos_encontrados: 0,
                  grupos_agendamento: [],
                  total_grupos_agendamento: 0,
                  grupo_agendamento_selecionado: null,
                  busca_agenda_status: 'nao_encontrado',
                  busca_agenda_em: buscaAgendaEm,
                },
                resposta: respostaPedidoNaoLocalizado(),
                estado: novoEstado,
                contactId,
                ticketId,
                digisacMessageId: messageId,
                telefoneAutorizado: telefoneAutorizadoFlag,
              });
              console.log(`[posvenda-webhook] pedido nao localizado sessaoId=${sessaoId}`);
            }
          } else {
            novoEstado = 'erro_busca_agenda';
            metadataBusca = {
              ...(metadataAtual ?? {}),
              agendamentos_encontrados: [],
              total_agendamentos_encontrados: 0,
              busca_agenda_status: 'erro',
              busca_agenda_erro: resultadoBusca.erro.substring(0, 200),
              busca_agenda_em: buscaAgendaEm,
            };
            console.log(`[posvenda-webhook] erro busca agenda sessaoId=${sessaoId} erro=${resultadoBusca.erro.substring(0, 100)}`);
          }

          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              documento_informado: documento,
              estado: novoEstado,
              metadata: metadataBusca,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, documento_detectado: true },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'documento_recebido',
            descricao: 'Documento (CPF/CNPJ) recebido do cliente',
            metadata: {
              tamanho_documento: documento.length,
              busca_agenda_status: metadataBusca.busca_agenda_status,
              total_agendamentos_encontrados: metadataBusca.total_agendamentos_encontrados,
              total_grupos_agendamento: metadataBusca.total_grupos_agendamento,
            },
          });

          console.log(`[posvenda-webhook] documento recebido sessaoId=${sessaoId} digitos=${documento.length} estado=${novoEstado}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Nao e documento: salvar mensagem, manter estado
        await supabase
          .from('atendimento_automatico_sessoes')
          .update({
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessaoId);

        await supabase.from('atendimento_automatico_mensagens').insert({
          sessao_id: sessaoId,
          digisac_message_id: messageId,
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          origem: 'cliente',
          texto: text,
          tipo_mensagem: msg.type as string | undefined,
          timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
          status: 'processada',
          metadata: { serviceId, departmentId },
        });

        console.log(`[posvenda-webhook] mensagem salva (aguardando documento) sessaoId=${sessaoId}`);
        return { ok: true, saved: true, origem: 'cliente' };
      }

      // Estado: aguardando_escolha_grupo
      if (sessaoExistente.estado === 'aguardando_escolha_grupo') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const totalGrupos = metadataAtual?.total_grupos_agendamento as number | undefined;
        const grupos = metadataAtual?.grupos_agendamento as GrupoAgendamento[] | undefined;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);

        const numero = parseInt(textoNormalizado, 10);
        if (!isNaN(numero) && numero >= 1 && numero <= (totalGrupos ?? 0) && grupos) {
          const grupoSelecionado = grupos.find((g) => g.indice === numero);
          if (grupoSelecionado) {
            const novoEstado = 'aguardando_confirmacao_pedido';
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), grupo_agendamento_selecionado: numero },
              resposta: respostaGrupoSelecionado(grupoSelecionado),
              estado: novoEstado,
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });

            await supabase
              .from('atendimento_automatico_sessoes')
              .update({
                estado: novoEstado,
                metadata: novoMetadata,
                ultima_mensagem_cliente: text.substring(0, 200),
                ultima_mensagem_em: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessaoId);

            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId,
              digisac_message_id: messageId,
              digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null,
              origem: 'cliente',
              texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada',
              metadata: { serviceId, departmentId, grupo_selecionado: numero },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'grupo_agendamento_selecionado',
              descricao: `Grupo de agendamento selecionado: ${numero}`,
              metadata: { grupo_indice: numero, total_grupos: totalGrupos },
            });

            console.log(`[posvenda-webhook] grupo selecionado sessaoId=${sessaoId} grupo=${numero}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }
        }

        const novoMetadata = await construirMetadataComResposta({
          sessaoId,
          metadataAtual,
          resposta: respostaEscolhaInvalida(),
          estado: sessaoExistente.estado,
          contactId,
          ticketId,
          digisacMessageId: messageId,
          telefoneAutorizado: telefoneAutorizadoFlag,
        });

        await supabase
          .from('atendimento_automatico_sessoes')
          .update({
            metadata: novoMetadata,
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessaoId);

        await supabase.from('atendimento_automatico_mensagens').insert({
          sessao_id: sessaoId,
          digisac_message_id: messageId,
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          origem: 'cliente',
          texto: text,
          tipo_mensagem: msg.type as string | undefined,
          timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
          status: 'processada',
          metadata: { serviceId, departmentId, escolha_invalida: true },
        });

        console.log(`[posvenda-webhook] escolha invalida sessaoId=${sessaoId}`);
        return { ok: true, saved: true, origem: 'cliente' };
      }

      // Estado: aguardando_confirmacao_pedido
      if (sessaoExistente.estado === 'aguardando_confirmacao_pedido') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const confirmacao = normalizarConfirmacao(text);
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const totalGrupos = metadataAtual?.total_grupos_agendamento as number | undefined;
        const grupoSelecionado = metadataAtual?.grupo_agendamento_selecionado as number | undefined;

        // Se ha apenas 1 grupo e solicitacao de alterar_entrega, 1/2 sao acoes de alteracao
        if (
          sessaoExistente.tipo_solicitacao === 'alterar_entrega' &&
          totalGrupos === 1 &&
          grupoSelecionado === 1 &&
          (textoNormalizado === '1' || textoNormalizado === '2')
        ) {
          const acao = textoNormalizado === '1' ? 'adiantar' : 'postergar';
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), acao_alteracao: acao, pedido_confirmado: true },
            resposta: respostaPedidoConfirmadoAlterarAcaoJaEscolhida(),
            estado: 'pedido_confirmado_acao_recebida',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              estado: 'pedido_confirmado_acao_recebida',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, acao_alteracao: acao, pedido_confirmado: true },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'pedido_confirmado_acao_recebida',
            descricao: `Cliente confirmou pedido e escolheu ação: ${acao}`,
            metadata: { acao, total_grupos: totalGrupos, grupo_selecionado: grupoSelecionado },
          });

          console.log(`[posvenda-webhook] pedido confirmado com acao sessaoId=${sessaoId} acao=${acao}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        if (confirmacao === 'confirmar') {
          const grupo = obterGrupoSelecionado(metadataAtual);
          let novoEstado: string;
          let resposta: RespostaSugerida;

          if (sessaoExistente.tipo_solicitacao === 'confirmar_entrega') {
            novoEstado = 'pedido_confirmado';
            resposta = respostaPedidoConfirmadoConfirmarEntrega(grupo?.data_entrega ?? '');
          } else {
            const acaoExistente = metadataAtual?.acao_alteracao as string | undefined;
            if (acaoExistente) {
              novoEstado = 'pedido_confirmado_acao_recebida';
              resposta = respostaPedidoConfirmadoAlterarAcaoJaEscolhida();
            } else {
              novoEstado = 'aguardando_escolha_acao';
              resposta = respostaPedidoConfirmadoAlterarEscolherAcao();
            }
          }

          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), pedido_confirmado: true },
            resposta,
            estado: novoEstado,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              estado: novoEstado,
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, pedido_confirmado: true },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'pedido_confirmado',
            descricao: 'Cliente confirmou o pedido/entrega',
            metadata: { tipo_solicitacao: sessaoExistente.tipo_solicitacao, estado_destino: novoEstado },
          });

          console.log(`[posvenda-webhook] pedido confirmado sessaoId=${sessaoId} estado=${novoEstado}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        if (confirmacao === 'negar') {
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), pedido_confirmado: false },
            resposta: respostaPedidoNegado(),
            estado: sessaoExistente.estado,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, pedido_confirmado: false },
          });

          console.log(`[posvenda-webhook] pedido negado sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Estado: aguardando_escolha_acao
      if (sessaoExistente.estado === 'aguardando_escolha_acao') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);

        if (textoNormalizado === '1' || textoNormalizado === '2') {
          const acao = textoNormalizado === '1' ? 'adiantar' : 'postergar';
          const grupo = obterGrupoSelecionado(metadataAtual);
          const bloqueio = validarBloqueioAcao(acao, grupo);

          if (bloqueio.bloqueado) {
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                acao_alteracao: acao,
                precisa_humano_por_regra: true,
                motivo_bloqueio_acao: bloqueio.motivo,
              },
              resposta: bloqueio.resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });

            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);

            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId,
              digisac_message_id: messageId,
              digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null,
              origem: 'cliente',
              texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada',
              metadata: { serviceId, departmentId, acao_alteracao: acao, bloqueio: bloqueio.motivo },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'bloqueio_acao',
              descricao: `Acao ${acao} bloqueada: ${bloqueio.motivo}`,
              metadata: { acao, motivo: bloqueio.motivo },
            });

            console.log(`[posvenda-webhook] acao ${acao} bloqueada motivo=${bloqueio.motivo} sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          const enderecoCompleto = grupo?.endereco_completo ?? grupo?.endereco_curto ?? '';
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), acao_alteracao: acao, endereco_confirmado: false },
            resposta: respostaConfirmarEnderecoAlteracao(acao, enderecoCompleto),
            estado: 'aguardando_confirmacao_endereco',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'aguardando_confirmacao_endereco',
            metadata: novoMetadata,
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, acao_alteracao: acao },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'acao_alteracao',
            descricao: `Cliente escolheu ${acao} entrega`,
            metadata: { acao },
          });

          console.log(`[posvenda-webhook] acao alteracao ${acao} sessaoId=${sessaoId} => aguardando_confirmacao_endereco`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Estado: aguardando_confirmacao_endereco
      if (sessaoExistente.estado === 'aguardando_confirmacao_endereco') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const confirmacao = normalizarConfirmacao(text);
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const acaoAlteracao = (metadataAtual?.acao_alteracao as 'adiantar' | 'postergar' | undefined) ?? 'postergar';

        // Cliente confirma endereco
        if (confirmacao === 'confirmar') {
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), endereco_confirmado: true },
            resposta: respostaAguardandoDataDesejada(),
            estado: 'aguardando_data_desejada',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'aguardando_data_desejada',
            metadata: novoMetadata,
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, endereco_confirmado: true },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'endereco_confirmado',
            descricao: 'Cliente confirmou endereco de entrega',
            metadata: { acao_alteracao: acaoAlteracao },
          });

          console.log(`[posvenda-webhook] endereco confirmado sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Cliente indica que endereco mudou
        if (confirmacao === 'negar') {
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              endereco_confirmado: false,
              precisa_humano_por_regra: true,
              motivo_bloqueio_endereco: 'alteracao_endereco',
            },
            resposta: respostaTransferidoHumanoEndereco(),
            estado: 'transferido_humano',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'transferido_humano',
            metadata: novoMetadata,
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, motivo: 'alteracao_endereco' },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'transferido_humano',
            descricao: 'Endereco alterado, encaminhado para humano',
            metadata: { motivo: 'alteracao_endereco' },
          });

          console.log(`[posvenda-webhook] endereco alterado, transferido humano sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Mensagem ambigua: salvar, manter estado
        await supabase.from('atendimento_automatico_sessoes').update({
          ultima_mensagem_cliente: text.substring(0, 200),
          ultima_mensagem_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', sessaoId);

        await supabase.from('atendimento_automatico_mensagens').insert({
          sessao_id: sessaoId,
          digisac_message_id: messageId,
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          origem: 'cliente',
          texto: text,
          tipo_mensagem: msg.type as string | undefined,
          timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
          status: 'processada',
          metadata: { serviceId, departmentId },
        });

        console.log(`[posvenda-webhook] mensagem ambigua em aguardando_confirmacao_endereco sessaoId=${sessaoId}`);
        return { ok: true, saved: true, origem: 'cliente' };
      }

      // Estado: aguardando_data_desejada
      if (sessaoExistente.estado === 'aguardando_data_desejada') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;

        // Salvar mensagem com data informada; nao chamar /procurar-datas nesta tarefa
        const novoMetadata: Record<string, unknown> = {
          ...(metadataAtual ?? {}),
          data_desejada_texto: text.substring(0, 100),
          data_desejada_em: new Date().toISOString(),
        };

        await supabase.from('atendimento_automatico_sessoes').update({
          metadata: novoMetadata,
          ultima_mensagem_cliente: text.substring(0, 200),
          ultima_mensagem_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', sessaoId);

        await supabase.from('atendimento_automatico_mensagens').insert({
          sessao_id: sessaoId,
          digisac_message_id: messageId,
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          origem: 'cliente',
          texto: text,
          tipo_mensagem: msg.type as string | undefined,
          timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
          status: 'processada',
          metadata: { serviceId, departmentId, data_desejada: text.substring(0, 100) },
        });

        await supabase.from('atendimento_automatico_eventos').insert({
          sessao_id: sessaoId,
          tipo: 'data_desejada_recebida',
          descricao: 'Cliente informou data desejada para alteracao',
          metadata: { data_desejada_texto: text.substring(0, 100) },
        });

        console.log(`[posvenda-webhook] data desejada recebida sessaoId=${sessaoId}`);
        return { ok: true, saved: true, origem: 'cliente' };
      }

      // Estado: documento_recebido/pedido_localizado/pedido_nao_localizado + alterar_entrega
      const estadosPermitemAcaoAlteracao = ['documento_recebido', 'pedido_localizado', 'pedido_nao_localizado'];
      if (estadosPermitemAcaoAlteracao.includes(sessaoExistente.estado) && sessaoExistente.tipo_solicitacao === 'alterar_entrega') {
        if (textoNormalizado === '1' || textoNormalizado === '2') {
          const acao = textoNormalizado === '1' ? 'adiantar' : 'postergar';
          const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
          const telefoneSessao = sessaoExistente.telefone;
          const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
          const grupo = obterGrupoSelecionado(metadataAtual);
          const bloqueio = validarBloqueioAcao(acao, grupo);

          if (bloqueio.bloqueado) {
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                acao_alteracao: acao,
                precisa_humano_por_regra: true,
                motivo_bloqueio_acao: bloqueio.motivo,
              },
              resposta: bloqueio.resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });

            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);

            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId,
              digisac_message_id: messageId,
              digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null,
              origem: 'cliente',
              texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada',
              metadata: { serviceId, departmentId, acao_alteracao: acao, bloqueio: bloqueio.motivo },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'bloqueio_acao',
              descricao: `Acao ${acao} bloqueada: ${bloqueio.motivo}`,
              metadata: { acao, motivo: bloqueio.motivo },
            });

            console.log(`[posvenda-webhook] acao ${acao} bloqueada motivo=${bloqueio.motivo} sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          const enderecoCompleto = grupo?.endereco_completo ?? grupo?.endereco_curto ?? '';
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), acao_alteracao: acao, endereco_confirmado: false },
            resposta: respostaConfirmarEnderecoAlteracao(acao, enderecoCompleto),
            estado: 'aguardando_confirmacao_endereco',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'aguardando_confirmacao_endereco',
            metadata: novoMetadata,
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, acao_alteracao: acao },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'acao_alteracao',
            descricao: `Cliente escolheu ${acao} entrega`,
            metadata: { acao },
          });

          console.log(`[posvenda-webhook] acao alteracao ${acao} sessaoId=${sessaoId} => aguardando_confirmacao_endereco`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        if (textoNormalizado === '3') {
          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessaoId);

          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId,
            digisac_message_id: messageId,
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            origem: 'cliente',
            texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada',
            metadata: { serviceId, departmentId, voltar_menu: true },
          });

          console.log(`[posvenda-webhook] voltar ao menu solicitado sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Outra mensagem: salvar, manter estado
        await supabase
          .from('atendimento_automatico_sessoes')
          .update({
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessaoId);

        await supabase.from('atendimento_automatico_mensagens').insert({
          sessao_id: sessaoId,
          digisac_message_id: messageId,
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          origem: 'cliente',
          texto: text,
          tipo_mensagem: msg.type as string | undefined,
          timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
          status: 'processada',
          metadata: { serviceId, departmentId },
        });

        console.log(`[posvenda-webhook] mensagem salva (documento_recebido) sessaoId=${sessaoId}`);
        return { ok: true, saved: true, origem: 'cliente' };
      }

      // Outros estados: salvar mensagem, atualizar
      const updateData: Record<string, unknown> = {
        ultima_mensagem_cliente: text.substring(0, 200),
        ultima_mensagem_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Se estava pausado_humano e pausa ja expirou, reativar
      if (sessaoExistente.status === 'pausado_humano') {
        const pausaAte = sessaoExistente.pausa_ate;
        if (!pausaAte || new Date(pausaAte) < new Date()) {
          updateData.status = 'ativa';
          updateData.estado = 'aguardando_documento';
          updateData.pausa_ate = null;
        }
      }

      await supabase
        .from('atendimento_automatico_sessoes')
        .update(updateData)
        .eq('id', sessaoId);

      await supabase.from('atendimento_automatico_mensagens').insert({
        sessao_id: sessaoId,
        digisac_message_id: messageId,
        digisac_ticket_id: ticketId,
        digisac_contact_id: contactId ?? null,
        origem: 'cliente',
        texto: text,
        tipo_mensagem: msg.type as string | undefined,
        timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
        status: 'processada',
        metadata: { serviceId, departmentId },
      });

      console.log(`[posvenda-webhook] mensagem cliente salva sessaoId=${sessaoId}`);
      return { ok: true, saved: true, origem: 'cliente' };
    }

    // Sem sessao existente: verificar gatilho antes de qualquer chamada API
    const textoNormalizado = normalizarTextoDigisac(text);
    const solicitacao = detectarSolicitacao(textoNormalizado);

    if (!solicitacao) {
      console.log(`[posvenda-webhook] sem sessao e sem gatilho valido, ignorando texto="${text.substring(0, 50)}"`);
      return { ok: true, ignored: true, reason: 'sem_gatilho_inicial' };
    }

    // Gatilho valido: resolver telefone via API
    let telefone = extrairTelefone(msg);
    if (!telefone && contactId) {
      telefone = await buscarTelefonePorContactId(contactId);
      if (telefone) {
        console.log(`[posvenda-webhook] telefone obtido via API contactId=${contactId}`);
      } else {
        console.log(`[posvenda-webhook] telefone nao encontrado via API contactId=${contactId}`);
      }
    }

    // Allowlist
    if (!telefoneAutorizado(telefone)) {
      console.log('[posvenda-webhook] telefone nao autorizado na allowlist, ignorando');
      return { ok: true, ignored: true, reason: 'telefone_nao_autorizado' };
    }

    // Verificar bloqueios ativos
    if (contactId) {
      const { data: bloqueioAtivo } = await supabase
        .from('atendimento_automatico_bloqueios')
        .select('id, tipo, bloqueado_ate')
        .eq('digisac_contact_id', contactId)
        .eq('ativo', true)
        .or('bloqueado_ate.is.null,bloqueado_ate.gt.now()')
        .maybeSingle();

      if (bloqueioAtivo) {
        console.log(`[posvenda-webhook] cliente bloqueado (${bloqueioAtivo.tipo}), nao criando sessao`);
        return { ok: true, ignored: true, reason: 'cliente_bloqueado' };
      }
    }

    const { data: novaSessao, error: errSessao } = await supabase
      .from('atendimento_automatico_sessoes')
      .insert({
        digisac_ticket_id: ticketId,
        digisac_contact_id: contactId ?? null,
        digisac_service_id: serviceId ?? null,
        digisac_department_id: departmentId,
        telefone,
        status: 'ativa',
        estado: 'aguardando_documento',
        tipo_solicitacao: solicitacao,
        ultima_mensagem_cliente: text.substring(0, 200),
        ultima_mensagem_em: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (errSessao || !novaSessao) {
      console.error('[posvenda-webhook] erro ao criar sessao', errSessao);
      return { ok: false, error: 'erro_criar_sessao' };
    }

    sessaoId = novaSessao.id;

    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: sessaoId,
      tipo: 'inicio',
      descricao: 'Sessao criada via webhook pos-venda',
      metadata: { solicitacao },
    });

    await supabase.from('atendimento_automatico_mensagens').insert({
      sessao_id: sessaoId,
      digisac_message_id: messageId,
      digisac_ticket_id: ticketId,
      digisac_contact_id: contactId ?? null,
      origem: 'cliente',
      texto: text,
      tipo_mensagem: msg.type as string | undefined,
      timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
      status: 'processada',
      metadata: { serviceId, departmentId, solicitacao },
    });

    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: sessaoId,
      tipo: 'solicitacao_detectada',
      descricao: `Solicitacao detectada: ${solicitacao}`,
      metadata: { texto_normalizado: textoNormalizado },
    });

    console.log(`[posvenda-webhook] sessao criada sessaoId=${sessaoId} solicitacao=${solicitacao} telefone=${telefone ?? 'nao_encontrado'}`);
    return { ok: true, saved: true, origem: 'cliente' };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error(`[posvenda-webhook] erro: ${errMessage}`);
    return { ok: false, error: 'erro_interno' };
  }
}
