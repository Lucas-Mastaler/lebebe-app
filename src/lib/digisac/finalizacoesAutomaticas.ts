import { fetchDigisacRaw, fetchDigisac } from './clienteDigisac';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type StatusFechamento = 'pendente' | 'finalizado' | 'erro' | 'ignorado';
export type TipoChamadoFechamento = 'ativo' | 'receptivo' | 'indefinido';
export type UltimaMensagemPor = 'cliente' | 'nos' | 'desconhecido';

export interface RegistroFechamentoAutomatico {
  id: string;
  digisac_ticket_id: string;
  digisac_contact_id: string;
  protocolo: string | null;
  ticket_history_url: string | null;
  service_id: string;
  service_name: string | null;
  nome_contato: string | null;
  telefone_contato: string | null;
  tipo_chamado: TipoChamadoFechamento | null;
  ultima_mensagem_em: string | null;
  ultima_mensagem_por: UltimaMensagemPor | null;
  preview_ultima_mensagem: string | null;
  horas_sem_interacao: number | null;
  fechamento_motivo_id: string | null;
  fechamento_motivo_nome: string | null;
  endpoint_fechamento: string | null;
  status: StatusFechamento;
  erro: string | null;
  finalizado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiltrosListagemFechamentos {
  status?: StatusFechamento;
  tipoChamado?: TipoChamadoFechamento;
  ultimaMensagemPor?: UltimaMensagemPor;
  serviceId?: string;
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
  page?: number;
  pageSize?: number;
}

export interface ListagemFechamentosResponse {
  items: RegistroFechamentoAutomatico[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIGISAC_WEB_BASE_URL = 'https://lebebe.digisac.me';

/** ID do tópico "FECHAMENTO AUTOMATICO AUTOMACAO" registrado no Digisac. */
export const DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO = '422e6abf-66ad-45fd-a0ee-217648398d3e';
export const DIGISAC_TICKET_TOPIC_NOME_FECHAMENTO_AUTOMATICO = 'FECHAMENTO AUTOMATICO AUTOMACAO';

/** serviceId da conexão Bigorrilho no Digisac. */
export const BIGORRILHO_SERVICE_ID = '0973f84b-8294-4615-9657-ba95b6346246';

// ─── Conexoes habilitadas para automacao ──────────────────────────────────────

export interface ConexaoAutomacao {
  id: string;
  service_id: string;
  service_name: string | null;
  my_number: string | null;
  default_department_id: string | null;
  ativo: boolean;
}

/**
 * Busca todas as conexoes habilitadas (ativo=true) na tabela digisac_conexoes_automacao.
 */
export async function buscarConexoesHabilitadas(
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>
): Promise<ConexaoAutomacao[]> {
  const { data, error } = await supabase
    .from('digisac_conexoes_automacao')
    .select('id, service_id, service_name, my_number, default_department_id, ativo')
    .eq('ativo', true);

  if (error) {
    console.error('[CONEXOES-AUTOMACAO] Erro ao buscar conexoes habilitadas:', error.message);
    return [];
  }

  return (data ?? []) as ConexaoAutomacao[];
}

/**
 * Verifica se um serviceId esta habilitado para automacao.
 */
export async function isConexaoHabilitada(
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>,
  serviceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('digisac_conexoes_automacao')
    .select('id')
    .eq('service_id', serviceId)
    .eq('ativo', true)
    .maybeSingle();

  return !!data;
}

// ─── Fechamento reutilizavel ──────────────────────────────────────────────────

const BY_USER_ID_FECHAMENTO = '2674db7a-0beb-4e1d-8f32-20c71023c1ea';

export interface RegistroParaFechar {
  id: string;
  digisac_ticket_id: string;
  digisac_contact_id: string;
  service_id: string;
  status: string;
  protocolo: string | null;
  nome_contato: string | null;
  ticket_history_url: string | null;
}

export interface ResultadoFechamento {
  ok: boolean;
  id: string;
  digisac_ticket_id: string;
  protocolo: string | null;
  nome_contato: string | null;
  ticket_history_url: string | null;
  erro?: string;
  finalizado_em?: string;
  aviso?: string;
}

export interface ResultadoVerificacao {
  confirmado: boolean;
  fechado: boolean;
  motivo?: string;
}

/**
 * Consulta o Digisac para verificar se o ticket esta fechado.
 * Usa GET /tickets/{ticketId} que retorna o ticket com campo isOpen.
 * Fallback: GET /tickets?where[contactId]=...&where[isOpen]=true para checar se ha ticket aberto.
 */
export async function verificarChamadoFechadoNoDigisac(
  digisacTicketId: string,
  digisacContactId: string
): Promise<ResultadoVerificacao> {
  console.log(
    '[VERIFICAR-STATUS] Consultando Digisac.' +
    ' ticketId=' + digisacTicketId.slice(0, 8) +
    ' contactId=' + digisacContactId.slice(0, 8)
  );

  try {
    const ticket = await fetchDigisac(`/tickets/${digisacTicketId}`);
    if (ticket && typeof ticket.isOpen === 'boolean') {
      const fechado = !ticket.isOpen;
      console.log('[VERIFICAR-STATUS] Ticket consultado. isOpen=' + ticket.isOpen + ' fechado=' + fechado);
      return { confirmado: true, fechado };
    }

    if (ticket && ticket.id) {
      const fechado = ticket.isOpen === false || ticket.isOpen === undefined;
      console.log('[VERIFICAR-STATUS] Ticket consultado (sem isOpen explicito). fechado=' + fechado);
      return { confirmado: true, fechado };
    }

    console.warn('[VERIFICAR-STATUS] Resposta nao reconhecida, tentando fallback por contactId.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[VERIFICAR-STATUS] Falha ao buscar ticket por id, tentando fallback por contactId:', msg);
  }

  try {
    const params = new URLSearchParams();
    params.append('where[contactId]', digisacContactId);
    params.append('where[isOpen]', 'true');
    params.append('page', '1');
    params.append('perPage', '1');

    const res = await fetchDigisac(`/tickets?${params.toString()}`);
    const tickets = Array.isArray(res) ? res : (res.rows || res.data || []);
    const total = (res && (res.count || res.total)) ?? tickets.length;

    const haTicketAberto = total > 0;
    console.log('[VERIFICAR-STATUS] Fallback contactId. ticketsAbertos=' + total + ' fechado=' + !haTicketAberto);

    return { confirmado: true, fechado: !haTicketAberto };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[VERIFICAR-STATUS] Falha ao verificar status via fallback:', msg);
    return { confirmado: false, fechado: false, motivo: 'Nao foi possivel confirmar o status do chamado no Digisac' };
  }
}

/**
 * Funcao server-side reutilizavel que fecha um chamado no Digisac e atualiza
 * o registro na tabela digisac_fechamentos_automaticos.
 *
 * Pre-condicoes: o registro ja foi validado (status, service_id, contact_id, ticket_id).
 * Esta funcao apenas executa o fechamento e atualiza o banco.
 */
export async function fecharRegistroAutomaticoDigisac(
  reg: RegistroParaFechar,
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>
): Promise<ResultadoFechamento> {
  const endpoint = `/contacts/${reg.digisac_contact_id}/ticket/close`;
  const payload = {
    byUserId: BY_USER_ID_FECHAMENTO,
    comments: 'FECHAMENTO AUTOMATICO',
    ticketTopicIds: [DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO],
  };

  console.log(
    '[FECHAR-CHAMADO] Chamando Digisac.' +
    ' ticketId=' + reg.digisac_ticket_id.slice(0, 8) +
    ' contactId=' + reg.digisac_contact_id.slice(0, 8)
  );

  try {
    const digisacRes = await fetchDigisacRaw(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!digisacRes.ok) {
      const bodyTxt = await digisacRes.text().catch(() => '');
      const mensagemSegura = `Erro Digisac ${digisacRes.status}: ${bodyTxt.substring(0, 200)}`;

      console.error('[FECHAR-CHAMADO] Digisac retornou erro:', digisacRes.status);
      console.log('[FECHAR-CHAMADO] Verificando se o chamado foi fechado mesmo assim...');

      const verificacao = await verificarChamadoFechadoNoDigisac(reg.digisac_ticket_id, reg.digisac_contact_id);
      if (verificacao.confirmado && verificacao.fechado) {
        const agoraIso = new Date().toISOString();
        const { error: errUpdate } = await supabase
          .from('digisac_fechamentos_automaticos')
          .update({
            status: 'finalizado',
            finalizado_em: agoraIso,
            erro: null,
            updated_at: agoraIso,
          })
          .eq('id', reg.id);

        if (errUpdate) {
          console.error('[FECHAR-CHAMADO] Confirmado fechado mas erro ao atualizar banco:', errUpdate.message);
        }

        console.log('[FECHAR-CHAMADO] Confirmado fechado apos erro. registroId=' + reg.id);
        return {
          ok: true,
          id: reg.id,
          digisac_ticket_id: reg.digisac_ticket_id,
          protocolo: reg.protocolo,
          nome_contato: reg.nome_contato,
          ticket_history_url: reg.ticket_history_url,
          finalizado_em: agoraIso,
          aviso: `Digisac retornou erro ${digisacRes.status}, mas o chamado foi confirmado como fechado.`,
        };
      }

      await supabase
        .from('digisac_fechamentos_automaticos')
        .update({
          status: 'erro',
          erro: mensagemSegura,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reg.id);

      return {
        ok: false,
        id: reg.id,
        digisac_ticket_id: reg.digisac_ticket_id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        ticket_history_url: reg.ticket_history_url,
        erro: mensagemSegura,
      };
    }

    const agoraIso = new Date().toISOString();

    const { error: errUpdate } = await supabase
      .from('digisac_fechamentos_automaticos')
      .update({
        status: 'finalizado',
        finalizado_em: agoraIso,
        erro: null,
        updated_at: agoraIso,
      })
      .eq('id', reg.id);

    if (errUpdate) {
      console.error('[FECHAR-CHAMADO] Digisac fechou mas erro ao atualizar banco:', errUpdate.message);
      return {
        ok: true,
        id: reg.id,
        digisac_ticket_id: reg.digisac_ticket_id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        ticket_history_url: reg.ticket_history_url,
        finalizado_em: agoraIso,
        erro: 'Chamado fechado no Digisac, mas erro ao atualizar banco',
      };
    }

    console.log('[FECHAR-CHAMADO] Sucesso. registroId=' + reg.id + ' status=finalizado');

    return {
      ok: true,
      id: reg.id,
      digisac_ticket_id: reg.digisac_ticket_id,
      protocolo: reg.protocolo,
      nome_contato: reg.nome_contato,
      ticket_history_url: reg.ticket_history_url,
      finalizado_em: agoraIso,
    };
  } catch (digisacErr) {
    const mensagem = digisacErr instanceof Error ? digisacErr.message : 'Erro desconhecido';

    console.error('[FECHAR-CHAMADO] Erro ao chamar Digisac:', mensagem);
    console.log('[FECHAR-CHAMADO] Verificando se o chamado foi fechado mesmo assim...');

    const verificacao = await verificarChamadoFechadoNoDigisac(reg.digisac_ticket_id, reg.digisac_contact_id);
    if (verificacao.confirmado && verificacao.fechado) {
      const agoraIso = new Date().toISOString();
      const { error: errUpdate } = await supabase
        .from('digisac_fechamentos_automaticos')
        .update({
          status: 'finalizado',
          finalizado_em: agoraIso,
          erro: null,
          updated_at: agoraIso,
        })
        .eq('id', reg.id);

      if (errUpdate) {
        console.error('[FECHAR-CHAMADO] Confirmado fechado mas erro ao atualizar banco:', errUpdate.message);
      }

      console.log('[FECHAR-CHAMADO] Confirmado fechado apos excecao. registroId=' + reg.id);
      return {
        ok: true,
        id: reg.id,
        digisac_ticket_id: reg.digisac_ticket_id,
        protocolo: reg.protocolo,
        nome_contato: reg.nome_contato,
        ticket_history_url: reg.ticket_history_url,
        finalizado_em: agoraIso,
        aviso: 'Chamado confirmado como fechado apos erro de comunicacao.',
      };
    }

    await supabase
      .from('digisac_fechamentos_automaticos')
      .update({
        status: 'erro',
        erro: mensagem.substring(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reg.id);

    return {
      ok: false,
      id: reg.id,
      digisac_ticket_id: reg.digisac_ticket_id,
      protocolo: reg.protocolo,
      nome_contato: reg.nome_contato,
      ticket_history_url: reg.ticket_history_url,
      erro: mensagem.substring(0, 300),
    };
  }
}

// ─── Execucao central com persistencia ───────────────────────────────────────

export type OrigemExecucao = 'cron' | 'manual';
export type StatusExecucao = 'sucesso' | 'erro' | 'parcial' | 'sem_itens' | 'em_andamento';

export interface RegistroExecucao {
  id: string;
  created_at: string;
  origem: OrigemExecucao;
  status: StatusExecucao;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  total_encontrados: number;
  total_elegiveis: number;
  total_finalizados: number;
  total_ignorados: number;
  total_erros: number;
  mensagem: string | null;
  erro: string | null;
  detalhes: unknown;
  request_id: string | null;
}

export interface ResultadoExecucaoCentral {
  ok: boolean;
  execucaoId: string | null;
  origem: OrigemExecucao;
  status: StatusExecucao;
  totalElegiveisDiagnostico: number;
  totalInseridos: number;
  totalJaExistentes: number;
  totalIgnoradosDiag: number;
  totalErrosRegistro: number;
  totalEncontradosParaFechar: number;
  totalFinalizados: number;
  totalIgnorados: number;
  totalErros: number;
  mensagem: string;
  erro?: string;
  duracaoMs: number;
  finalizados: Array<{ protocolo: string | null; ticketIdParcial: string }>;
  ignorados: Array<{ protocolo: string | null; motivo: string }>;
  erros: Array<{ protocolo: string | null; ticketIdParcial: string; erro: string }>;
}

const LIMITE_FECHAMENTO_CENTRAL = 100;

/**
 * Funcao central de execucao das finalizacoes automaticas.
 * Usada pelo cron e pelo botao manual — mesma logica, origem diferente.
 * Registra execucao no banco (digisac_finalizacoes_execucoes) com inicio/fim/status/detalhes.
 * Nao registra secrets, tokens nem payloads sensiveis completos.
 */
export async function executarFinalizacoesAutomaticas(
  supabase: ReturnType<typeof import('@/lib/supabase/service').createServiceClient>,
  origem: OrigemExecucao,
  requestId?: string
): Promise<ResultadoExecucaoCentral> {
  const iniciado_em = new Date().toISOString();
  const tsInicio = Date.now();

  console.log(`[EXEC-FINALIZACOES] ========================================`);
  console.log(`[EXEC-FINALIZACOES] Inicio. origem=${origem} requestId=${requestId ?? 'n/a'}`);

  // Inserir registro de execucao com status em_andamento
  let execucaoId: string | null = null;
  const { data: execInsert, error: execInsertErr } = await supabase
    .from('digisac_finalizacoes_execucoes')
    .insert({
      origem,
      status: 'em_andamento' as StatusExecucao,
      iniciado_em,
      request_id: requestId ?? null,
      total_encontrados: 0,
      total_elegiveis: 0,
      total_finalizados: 0,
      total_ignorados: 0,
      total_erros: 0,
    })
    .select('id')
    .single();

  if (execInsertErr) {
    console.error('[EXEC-FINALIZACOES] Erro ao criar registro de execucao:', execInsertErr.message);
  } else {
    execucaoId = execInsert?.id ?? null;
    console.log(`[EXEC-FINALIZACOES] Registro de execucao criado. id=${execucaoId}`);
  }

  const finalizarExecucao = async (campos: {
    status: StatusExecucao;
    mensagem: string;
    erro?: string;
    total_encontrados: number;
    total_elegiveis: number;
    total_finalizados: number;
    total_ignorados: number;
    total_erros: number;
    detalhes: unknown;
  }) => {
    const finalizado_em = new Date().toISOString();
    const duracao_ms = Date.now() - tsInicio;
    console.log(`[EXEC-FINALIZACOES] Finalizando. status=${campos.status} duracao=${duracao_ms}ms`);
    if (!execucaoId) return;
    const { error: updErr } = await supabase
      .from('digisac_finalizacoes_execucoes')
      .update({
        status: campos.status,
        finalizado_em,
        duracao_ms,
        total_encontrados: campos.total_encontrados,
        total_elegiveis: campos.total_elegiveis,
        total_finalizados: campos.total_finalizados,
        total_ignorados: campos.total_ignorados,
        total_erros: campos.total_erros,
        mensagem: campos.mensagem,
        erro: campos.erro ?? null,
        detalhes: campos.detalhes,
      })
      .eq('id', execucaoId);
    if (updErr) {
      console.error('[EXEC-FINALIZACOES] Erro ao atualizar registro de execucao:', updErr.message);
    }
  };

  try {
    // 1. Buscar conexoes habilitadas
    const conexoesHabilitadas = await buscarConexoesHabilitadas(supabase);
    if (conexoesHabilitadas.length === 0) {
      console.warn('[EXEC-FINALIZACOES] Nenhuma conexao habilitada.');
      await finalizarExecucao({
        status: 'sem_itens',
        mensagem: 'Nenhuma conexao habilitada para automacao',
        total_encontrados: 0,
        total_elegiveis: 0,
        total_finalizados: 0,
        total_ignorados: 0,
        total_erros: 0,
        detalhes: null,
      });
      return {
        ok: true,
        execucaoId,
        origem,
        status: 'sem_itens',
        totalElegiveisDiagnostico: 0,
        totalInseridos: 0,
        totalJaExistentes: 0,
        totalIgnoradosDiag: 0,
        totalErrosRegistro: 0,
        totalEncontradosParaFechar: 0,
        totalFinalizados: 0,
        totalIgnorados: 0,
        totalErros: 0,
        mensagem: 'Nenhuma conexao habilitada para automacao',
        duracaoMs: Date.now() - tsInicio,
        finalizados: [],
        ignorados: [],
        erros: [],
      };
    }

    console.log(`[EXEC-FINALIZACOES] Conexoes habilitadas: ${conexoesHabilitadas.length}`);

    // 2. Registrar pendentes via diagnostico interno (chamada direta a funcao de diagnostico nao existe,
    //    usamos a rota via sub-request se disponivel — mas aqui usamos a tabela diretamente via supabase)
    let totalInseridos = 0;
    let totalJaExistentes = 0;
    let totalIgnoradosDiag = 0;
    let totalErrosRegistro = 0;
    let totalElegiveisGlobal = 0;

    // Nota: o diagnostico e feito via fetch interno na rota do cron.
    // Aqui registramos apenas os pendentes ja existentes no banco (etapa 2 do fluxo).
    // A etapa de diagnostico (busca Digisac + insercao de novos pendentes) fica na rota do cron/executar,
    // que chama esta funcao ja apos ter registrado os pendentes.
    // Portanto totalInseridos/totalJaExistentes/totalIgnoradosDiag/totalErrosRegistro
    // sao passados como parametro opcional — aqui sao 0 pois esta funcao so faz o fechamento.

    // 3. Buscar pendentes para fechamento
    const serviceIdsHabilitados = conexoesHabilitadas.map(c => c.service_id);

    const { data: pendentes, error: errPendentes } = await supabase
      .from('digisac_fechamentos_automaticos')
      .select('id, digisac_ticket_id, digisac_contact_id, service_id, status, protocolo, nome_contato, ticket_history_url')
      .eq('status', 'pendente')
      .in('service_id', serviceIdsHabilitados)
      .order('created_at', { ascending: true })
      .limit(LIMITE_FECHAMENTO_CENTRAL);

    if (errPendentes) {
      console.error('[EXEC-FINALIZACOES] Erro ao buscar pendentes:', errPendentes.message);
      await finalizarExecucao({
        status: 'erro',
        mensagem: 'Erro ao buscar pendentes no banco',
        erro: errPendentes.message.substring(0, 500),
        total_encontrados: 0,
        total_elegiveis: totalElegiveisGlobal,
        total_finalizados: 0,
        total_ignorados: 0,
        total_erros: 0,
        detalhes: null,
      });
      return {
        ok: false,
        execucaoId,
        origem,
        status: 'erro',
        totalElegiveisDiagnostico: totalElegiveisGlobal,
        totalInseridos,
        totalJaExistentes,
        totalIgnoradosDiag,
        totalErrosRegistro,
        totalEncontradosParaFechar: 0,
        totalFinalizados: 0,
        totalIgnorados: 0,
        totalErros: 0,
        mensagem: 'Erro ao buscar pendentes no banco',
        erro: errPendentes.message,
        duracaoMs: Date.now() - tsInicio,
        finalizados: [],
        ignorados: [],
        erros: [],
      };
    }

    const pendentesLista = (pendentes ?? []) as RegistroParaFechar[];
    console.log(`[EXEC-FINALIZACOES] Pendentes encontrados para fechar: ${pendentesLista.length}`);

    if (pendentesLista.length === 0) {
      await finalizarExecucao({
        status: 'sem_itens',
        mensagem: 'Nenhum chamado pendente para finalizar',
        total_encontrados: 0,
        total_elegiveis: totalElegiveisGlobal,
        total_finalizados: 0,
        total_ignorados: 0,
        total_erros: 0,
        detalhes: null,
      });
      return {
        ok: true,
        execucaoId,
        origem,
        status: 'sem_itens',
        totalElegiveisDiagnostico: totalElegiveisGlobal,
        totalInseridos,
        totalJaExistentes,
        totalIgnoradosDiag,
        totalErrosRegistro,
        totalEncontradosParaFechar: 0,
        totalFinalizados: 0,
        totalIgnorados: 0,
        totalErros: 0,
        mensagem: 'Nenhum chamado pendente para finalizar',
        duracaoMs: Date.now() - tsInicio,
        finalizados: [],
        ignorados: [],
        erros: [],
      };
    }

    // 4. Fechar sequencialmente
    const finalizados: Array<{ protocolo: string | null; ticketIdParcial: string }> = [];
    const erros: Array<{ protocolo: string | null; ticketIdParcial: string; erro: string }> = [];
    const ignorados: Array<{ protocolo: string | null; motivo: string }> = [];

    for (const reg of pendentesLista) {
      if (!reg.digisac_contact_id || reg.digisac_contact_id.trim() === '') {
        ignorados.push({ protocolo: reg.protocolo, motivo: 'contactId ausente' });
        continue;
      }
      if (!reg.digisac_ticket_id || reg.digisac_ticket_id.trim() === '') {
        ignorados.push({ protocolo: reg.protocolo, motivo: 'ticketId ausente' });
        continue;
      }

      const resultado = await fecharRegistroAutomaticoDigisac(reg, supabase);

      if (resultado.ok) {
        finalizados.push({
          protocolo: resultado.protocolo,
          ticketIdParcial: resultado.digisac_ticket_id.slice(0, 8),
        });
      } else {
        erros.push({
          protocolo: resultado.protocolo,
          ticketIdParcial: resultado.digisac_ticket_id.slice(0, 8),
          erro: (resultado.erro ?? 'Erro desconhecido').substring(0, 200),
        });
      }
    }

    const totalFinalizados = finalizados.length;
    const totalErros = erros.length;
    const totalIgnorados = ignorados.length;

    let statusFinal: StatusExecucao;
    let mensagemFinal: string;

    if (totalErros > 0 && totalFinalizados === 0) {
      statusFinal = 'erro';
      mensagemFinal = `Todos os ${pendentesLista.length} chamados falharam`;
    } else if (totalErros > 0) {
      statusFinal = 'parcial';
      mensagemFinal = `${totalFinalizados} finalizados, ${totalErros} com erro, ${totalIgnorados} ignorados`;
    } else if (totalFinalizados > 0) {
      statusFinal = 'sucesso';
      mensagemFinal = `${totalFinalizados} chamados finalizados com sucesso`;
    } else {
      statusFinal = 'sem_itens';
      mensagemFinal = `Nenhum chamado finalizado (${totalIgnorados} ignorados)`;
    }

    console.log(
      `[EXEC-FINALIZACOES] Fim. status=${statusFinal} finalizados=${totalFinalizados} erros=${totalErros} ignorados=${totalIgnorados}`
    );

    await finalizarExecucao({
      status: statusFinal,
      mensagem: mensagemFinal,
      total_encontrados: pendentesLista.length,
      total_elegiveis: totalElegiveisGlobal,
      total_finalizados: totalFinalizados,
      total_ignorados: totalIgnorados,
      total_erros: totalErros,
      detalhes: { finalizados, ignorados, erros },
    });

    return {
      ok: statusFinal !== 'erro',
      execucaoId,
      origem,
      status: statusFinal,
      totalElegiveisDiagnostico: totalElegiveisGlobal,
      totalInseridos,
      totalJaExistentes,
      totalIgnoradosDiag,
      totalErrosRegistro,
      totalEncontradosParaFechar: pendentesLista.length,
      totalFinalizados,
      totalIgnorados,
      totalErros,
      mensagem: mensagemFinal,
      duracaoMs: Date.now() - tsInicio,
      finalizados,
      ignorados,
      erros,
    };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error('[EXEC-FINALIZACOES] Erro geral:', mensagem);
    await finalizarExecucao({
      status: 'erro',
      mensagem: 'Erro interno na execucao',
      erro: mensagem.substring(0, 500),
      total_encontrados: 0,
      total_elegiveis: 0,
      total_finalizados: 0,
      total_ignorados: 0,
      total_erros: 0,
      detalhes: null,
    });
    return {
      ok: false,
      execucaoId,
      origem,
      status: 'erro',
      totalElegiveisDiagnostico: 0,
      totalInseridos: 0,
      totalJaExistentes: 0,
      totalIgnoradosDiag: 0,
      totalErrosRegistro: 0,
      totalEncontradosParaFechar: 0,
      totalFinalizados: 0,
      totalIgnorados: 0,
      totalErros: 0,
      mensagem: 'Erro interno na execucao',
      erro: mensagem,
      duracaoMs: Date.now() - tsInicio,
      finalizados: [],
      ignorados: [],
      erros: [],
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function montarUrlHistoricoTicket(ticketId: string): string {
  return `${DIGISAC_WEB_BASE_URL}/ticket-history/${ticketId}`;
}

export function normalizarStatusFechamento(status: string): StatusFechamento {
  if (status === 'finalizado' || status === 'erro' || status === 'ignorado') return status;
  return 'pendente';
}

/**
 * Mapeia um item elegível retornado pelo diagnóstico dry-run para o formato
 * de inserção na tabela `digisac_fechamentos_automaticos`.
 * Não executa nenhuma ação no Digisac — apenas prepara o registro de auditoria.
 *
 * Endpoint de fechamento (APENAS para referência da Fase 3 — NÃO chamar aqui):
 * POST /api/v1/contacts/{contactId}/ticket/close
 *
 * Payload futuro (Fase 3):
 * { byUserId: "<validar antes>", comments: "", ticketTopicIds: ["422e6abf-66ad-45fd-a0ee-217648398d3e"] }
 */
export function montarRegistroFechamentoAutomatico(item: {
  ticketId: string;
  protocolo: string | null;
  ticketHistoryUrl: string;
  contactId: string | null;
  nomeContato: string | null;
  telefoneContato: string | null;
  serviceIdContato: string | null;
  serviceNameContato: string | null;
  tipoChamado: TipoChamadoFechamento;
  ultimaMensagemEm: string | null;
  ultimaMensagemPor: UltimaMensagemPor;
  horasSemInteracao: number;
  previewUltimaMensagem: string | null;
  endpointFechamentoPrevisto: string | null;
}): Omit<RegistroFechamentoAutomatico, 'id' | 'created_at' | 'updated_at'> {
  return {
    digisac_ticket_id: item.ticketId,
    digisac_contact_id: item.contactId ?? '',
    protocolo: item.protocolo,
    ticket_history_url: item.ticketHistoryUrl,
    service_id: item.serviceIdContato ?? BIGORRILHO_SERVICE_ID,
    service_name: item.serviceNameContato,
    nome_contato: item.nomeContato,
    telefone_contato: item.telefoneContato,
    tipo_chamado: item.tipoChamado,
    ultima_mensagem_em: item.ultimaMensagemEm,
    ultima_mensagem_por: item.ultimaMensagemPor,
    preview_ultima_mensagem: item.previewUltimaMensagem,
    horas_sem_interacao: item.horasSemInteracao,
    fechamento_motivo_id: DIGISAC_TICKET_TOPIC_ID_FECHAMENTO_AUTOMATICO,
    fechamento_motivo_nome: DIGISAC_TICKET_TOPIC_NOME_FECHAMENTO_AUTOMATICO,
    endpoint_fechamento: item.endpointFechamentoPrevisto,
    status: 'pendente',
    erro: null,
    finalizado_em: null,
  };
}
