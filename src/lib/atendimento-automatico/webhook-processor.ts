import { createServiceClient } from '@/lib/supabase/service';
import { normalizarTextoDigisac } from '@/lib/digisac/triagem';

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
  const opcoesConfirmar = ['1', 'confirmar data de entrega', 'confirmar data entrega', 'confirmar entrega'];
  const opcoesAlterar = ['2', 'alterar data de entrega', 'alterar data entrega', 'alterar entrega'];

  if (opcoesConfirmar.includes(textoNormalizado)) return 'confirmar_entrega';
  if (opcoesAlterar.includes(textoNormalizado)) return 'alterar_entrega';

  return null;
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
    const contactId = msg.contactId as string | undefined;
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

    if (origem === 'humano') {
      // Humano interno detectado: pausar sessao por 24h
      if (sessaoExistente) {
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

        console.log(`[posvenda-webhook] humano detectado, sessao pausada sessaoId=${sessaoId}`);
      } else {
        // Criar sessao ja pausada
        const { data: novaSessao, error: errSessao } = await supabase
          .from('atendimento_automatico_sessoes')
          .insert({
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            digisac_service_id: serviceId ?? null,
            digisac_department_id: departmentId,
            status: 'pausado_humano',
            estado: 'pausado_humano',
            pausa_ate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single();

        if (errSessao || !novaSessao) {
          console.error('[posvenda-webhook] erro ao criar sessao pausada', errSessao);
          return { ok: false, error: 'erro_criar_sessao' };
        }

        sessaoId = novaSessao.id;

        await supabase.from('atendimento_automatico_eventos').insert({
          sessao_id: sessaoId,
          tipo: 'pausa_humano',
          descricao: 'Humano interno detectado antes da criacao da sessao, sessao criada pausada por 24h',
        });

        console.log(`[posvenda-webhook] humano detectado, sessao criada pausada sessaoId=${sessaoId}`);
      }

      // Salvar mensagem do humano
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

      return { ok: true, saved: true, origem: 'humano' };
    }

    if (origem === 'bot') {
      // Salvar mensagem do bot para historico, nao iniciar fluxo
      if (!sessaoExistente) {
        const { data: novaSessao, error: errSessao } = await supabase
          .from('atendimento_automatico_sessoes')
          .insert({
            digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null,
            digisac_service_id: serviceId ?? null,
            digisac_department_id: departmentId,
            status: 'ativa',
            estado: 'inicio',
          })
          .select('id')
          .single();

        if (errSessao || !novaSessao) {
          console.error('[posvenda-webhook] erro ao criar sessao para bot', errSessao);
          return { ok: false, error: 'erro_criar_sessao' };
        }

        sessaoId = novaSessao.id;
      } else {
        sessaoId = sessaoExistente.id;
      }

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

      // Atualizar ultima mensagem do bot na sessao
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
        // Cliente bloqueado: salvar mensagem mas nao iniciar fluxo
        if (sessaoExistente) {
          sessaoId = sessaoExistente.id;
        } else {
          const { data: novaSessao } = await supabase
            .from('atendimento_automatico_sessoes')
            .insert({
              digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null,
              digisac_service_id: serviceId ?? null,
              digisac_department_id: departmentId,
              status: bloqueioAtivo.tipo === 'permanente' ? 'bloqueado_permanente' : 'bloqueado_24h',
              estado: bloqueioAtivo.tipo === 'permanente' ? 'bloqueado_permanente' : 'bloqueado_24h',
              bloqueio_permanente: bloqueioAtivo.tipo === 'permanente',
            })
            .select('id')
            .single();

          sessaoId = novaSessao?.id ?? '';
        }

        if (sessaoId) {
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
        }

        console.log(`[posvenda-webhook] cliente bloqueado (${bloqueioAtivo.tipo}), mensagem salva sem fluxo`);
        return { ok: true, saved: true, origem: 'cliente' };
      }
    }

    // Criar ou atualizar sessao
    const textoNormalizado = normalizarTextoDigisac(text);
    const solicitacao = detectarSolicitacao(textoNormalizado);

    if (sessaoExistente) {
      sessaoId = sessaoExistente.id;

      const updateData: Record<string, unknown> = {
        ultima_mensagem_cliente: text.substring(0, 200),
        ultima_mensagem_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (solicitacao && !sessaoExistente.tipo_solicitacao) {
        updateData.tipo_solicitacao = solicitacao;
      }

      // Se estava pausado_humano e pausa ja expirou, reativar
      if (sessaoExistente.status === 'pausado_humano') {
        const pausaAte = sessaoExistente.pausa_ate;
        if (!pausaAte || new Date(pausaAte) < new Date()) {
          updateData.status = 'ativa';
          updateData.estado = 'inicio';
          updateData.pausa_ate = null;
        }
      }

      await supabase
        .from('atendimento_automatico_sessoes')
        .update(updateData)
        .eq('id', sessaoId);
    } else {
      const { data: novaSessao, error: errSessao } = await supabase
        .from('atendimento_automatico_sessoes')
        .insert({
          digisac_ticket_id: ticketId,
          digisac_contact_id: contactId ?? null,
          digisac_service_id: serviceId ?? null,
          digisac_department_id: departmentId,
          status: 'ativa',
          estado: 'inicio',
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
    }

    // Salvar mensagem do cliente
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

    // Registrar evento se solicitacao detectada
    if (solicitacao) {
      await supabase.from('atendimento_automatico_eventos').insert({
        sessao_id: sessaoId,
        tipo: 'solicitacao_detectada',
        descricao: `Solicitacao detectada: ${solicitacao}`,
        metadata: { texto_normalizado: textoNormalizado },
      });
    }

    console.log(`[posvenda-webhook] mensagem cliente salva sessaoId=${sessaoId} solicitacao=${solicitacao ?? 'nenhuma'}`);
    return { ok: true, saved: true, origem: 'cliente' };
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error(`[posvenda-webhook] erro: ${errMessage}`);
    return { ok: false, error: 'erro_interno' };
  }
}
