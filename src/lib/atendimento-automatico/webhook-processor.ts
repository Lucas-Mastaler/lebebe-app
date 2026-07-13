import { createServiceClient } from '@/lib/supabase/service';
import { normalizarTextoDigisac } from '@/lib/digisac/triagem';
import { fetchDigisac } from '@/lib/digisac/clienteDigisac';
import { buscarAgendamentosPorDocumento, atualizarDataAgendaGoogleOriginalMere } from '@/lib/google/sheets-service-account';
import type { GrupoAgendamento, EventoReagendamentoPlanilha } from '@/lib/google/sheets-service-account';
import {
  respostaAguardandoDataDesejada,
  respostaBloqueioPagamentoPendenteAntecipacao,
  respostaBloqueioPrazoCriticoD2Postergacao,
  respostaBloqueioPrazoMenor7Antecipacao,
  respostaBloqueioClienteRetiraAlteracao,
  respostaBloqueioProdutoPendenteAntecipacao,
  respostaConfirmarEnderecoAlteracao,
  respostaConfirmarEntregaUnica,
  respostaDataDesejadaRecebida,
  respostaDataInvalidaAdiantar,
  respostaDataInvalidaAntesD2,
  respostaDataInvalidaForaJanelaD90,
  respostaDataInvalidaPostergar,
  respostaDataNaoInterpretada,
  respostaEscolhaInvalida,
  respostaEscolherGrupo,
  respostaGrupoSelecionado,
  respostaPedidoConfirmadoAlterarAcaoJaEscolhida,
  respostaPedidoConfirmadoAlterarEscolherAcao,
  respostaPedidoConfirmadoConfirmarEntrega,
  respostaPedidoNaoLocalizado,
  respostaConfirmacaoReagendamentoAmbigua,
  respostaConfirmarReagendamentoFinal,
  respostaDatasEncontradas,
  respostaDataOpcaoInvalida,
  respostaReagendamentoCancelado,
  respostaReagendamentoConfirmado,
  respostaReagendamentoDryRun,
  respostaFallbackNovoDocumentoOuEsclarecimento,
  respostaFallbackConfirmacaoEndereco,
  respostaFallbackConfirmacaoPedido,
  respostaFallbackEscolhaAcao,
  respostaNovoDocumentoNaoLocalizado,
  respostaTransferidoHumanoErroReagendamento,
  respostaTransferidoHumanoCoordenadas,
  respostaTransferidoHumanoEndereco,
  respostaTransferidoHumanoErroDatas,
  respostaTransferidoHumanoMuitasTentativas,
  respostaPedidoNegadoSolicitarNovoDocumento,
  respostaTransferidoHumanoSemDocumentoRelocalizacao,
  respostaTransferidoHumanoSemDados,
  respostaTransferidoHumanoSemDatas,
  respostaSemOpcoesAdiantarOferecerPostergar,
  respostaManterDataAtual,
  respostaSemOpcoesPostergar,
  type RespostaSugerida,
} from './respostas';
import { interpretarDataDesejada, validarDataDesejadaParaAcao } from './interpretar-data';
import { calcularTentativasInvalidas, ehClienteRetiraEquipeAgenda, interpretarAcaoAlteracao, interpretarConfirmacao } from './interpretar-intencao';
import { chaveRespostaAutomatica, processarEnvioAutomatico } from './auto-reply';
import { tentarIAFallback } from './ia-fallback';
import {
  executarConsultaDatasMere,
  filtrarDatasDisponiveisPorAcaoMere,
  formatarOpcoesDatasParaCliente,
  type DatasDisponiveisMere,
  type ResultadoExecucaoConsulta,
} from './consulta-datas-mere';
import { executarReagendamentoCalendar, dataBRParaISO } from './reagendamento-calendar';
import { selecionarOpcaoDataPorTexto, interpretarManterDataAtual } from './reagendamento-opcoes';

type OrigemMensagem = 'cliente' | 'bot' | 'humano' | 'sistema';

type ResultadoWebhook =
  | { ok: true; ignored: true; reason: string }
  | { ok: true; saved: true; origem: OrigemMensagem }
  | { ok: false; error: string };

type SupabaseClient = ReturnType<typeof createServiceClient>;

type RespostaOfertaPostergar = 'aceitar' | 'recusar' | 'humano' | null;

function interpretarRespostaOfertaPostergar(texto: string): RespostaOfertaPostergar {
  const normalizado = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizado) return null;
  if (/\b(atendente|humano|pessoa|equipe|falar com)\b/.test(normalizado)) return 'humano';
  if (normalizado === 'nao' || normalizado.includes('deixa como esta') || normalizado.includes('manter') || normalizado.includes('mantem')) {
    return 'recusar';
  }
  if (
    normalizado === 'sim' ||
    normalizado.includes('quero') ||
    normalizado.includes('pode ser') ||
    normalizado.includes('verificar') ||
    normalizado.includes('postergar')
  ) {
    return 'aceitar';
  }
  return null;
}

async function aplicarResultadoConsultaDatas(params: {
  execConsulta: ResultadoExecucaoConsulta;
  sessaoId: string;
  metadataBase: Record<string, unknown>;
  contactId: string | null;
  ticketId: string;
  messageId: string;
  telefoneAutorizadoFlag: boolean;
  supabase: SupabaseClient;
  text: string;
}): Promise<{ ok: true; saved: true; origem: 'cliente' }> {
  const {
    execConsulta, sessaoId, metadataBase, contactId, ticketId, messageId,
    telefoneAutorizadoFlag, supabase, text,
  } = params;

  const agora = new Date().toISOString();
  const diagnosticoConsultaMetadata = execConsulta.diagnostico ? {
    consulta_datas_erro_codigo: execConsulta.diagnostico.erroCodigo ?? null,
    consulta_datas_erro_mensagem: execConsulta.diagnostico.erroMensagem ?? null,
    consulta_datas_erro_stack_resumido: execConsulta.diagnostico.erroStackResumido ?? null,
    consulta_datas_payload_resumo: execConsulta.diagnostico.payloadResumo,
    consulta_datas_payload_campos_presentes: execConsulta.diagnostico.payloadCamposPresentes,
    consulta_datas_payload_campos_ausentes: execConsulta.diagnostico.payloadCamposAusentes,
    consulta_datas_retorno_bruto_resumo: execConsulta.diagnostico.retornoBrutoResumo ?? null,
    consulta_datas_helper_usado: execConsulta.diagnostico.helperUsado,
    consulta_datas_rota_ou_motor_usado: execConsulta.diagnostico.rotaOuMotorUsado,
  } : {};
  const geoCacheMetadata = {
    geo_cache_status: execConsulta.geoCacheStatus,
    geo_cache_em: agora,
    geo_cache_motivo: execConsulta.geoCacheMotivo ?? null,
    geo_cache_consultado: true,
    geo_cache_hit: execConsulta.coordenadas?.geoCacheHit ?? execConsulta.geoCacheHit ?? false,
    geocoding_provider_consultado: execConsulta.coordenadas?.geocodingProviderConsultado ?? execConsulta.geocodingProviderConsultado ?? false,
    geocoding_provider: execConsulta.coordenadas?.geocodingProvider ?? execConsulta.geocodingProvider ?? null,
    geo_cache_salvo: execConsulta.coordenadas?.geoCacheSalvo ?? execConsulta.geoCacheSalvo ?? false,
    ...(execConsulta.coordenadas ? {
      geo_cache_id: execConsulta.coordenadas.geoCacheId,
      geo_cache_provider: execConsulta.coordenadas.provider,
      geo_cache_confidence: execConsulta.coordenadas.confidence,
      geo_cache_estrategia: execConsulta.coordenadas.estrategia,
      coordenadas_resolvidas: true,
      coordenadas_origem: execConsulta.coordenadas.origem,
      coordenadas_lat: execConsulta.coordenadas.lat,
      coordenadas_lng: execConsulta.coordenadas.lng,
      latitude: execConsulta.coordenadas.lat,
      longitude: execConsulta.coordenadas.lng,
      cep_resolvido: execConsulta.coordenadas.cepResolvido,
      numero_resolvido: execConsulta.coordenadas.numeroResolvido,
    } : {
      coordenadas_resolvidas: false,
      coordenadas_origem: 'nao_resolvido',
      coordenadas_erro_codigo: execConsulta.geoCacheMotivo ?? null,
    }),
  };

  if (execConsulta.estado === 'erro_coordenadas') {
    const resposta = respostaTransferidoHumanoCoordenadas();
    const novoMetadata = await construirMetadataComResposta({
      sessaoId,
      metadataAtual: {
        ...metadataBase,
        ...geoCacheMetadata,
        consulta_datas_status: 'erro_coordenadas',
        consulta_datas_em: agora,
        consulta_datas_erro: execConsulta.motivo,
        consulta_datas_origem: 'mere',
        precisa_humano_por_regra: true,
        motivo_transferencia_humano: 'coordenadas_nao_resolvidas',
        motivo_falha_geo: execConsulta.motivo,
      },
      resposta,
      estado: 'transferido_humano',
      contactId,
      ticketId,
      digisacMessageId: messageId,
      telefoneAutorizado: telefoneAutorizadoFlag,
    });
    await supabase.from('atendimento_automatico_sessoes').update({
      estado: 'transferido_humano', status: 'transferido_humano',
      metadata: novoMetadata, ultima_mensagem_cliente: text.substring(0, 200),
      ultima_mensagem_em: agora, updated_at: agora,
    }).eq('id', sessaoId);
    console.log(`[posvenda-webhook] coordenadas nao resolvidas motivo=${execConsulta.motivo} sessaoId=${sessaoId}`);
    return { ok: true, saved: true, origem: 'cliente' };
  }

  if (execConsulta.estado === 'erro_dados') {
    const resposta = respostaTransferidoHumanoSemDados(execConsulta.motivo ?? 'dados_insuficientes');
    const novoMetadata = await construirMetadataComResposta({
      sessaoId,
      metadataAtual: {
        ...metadataBase,
        ...geoCacheMetadata,
        ...diagnosticoConsultaMetadata,
        consulta_datas_status: 'erro',
        consulta_datas_em: agora,
        consulta_datas_erro: execConsulta.motivo,
        consulta_datas_erros: execConsulta.erros ?? [],
        consulta_datas_origem: 'mere',
        precisa_humano_por_regra: true,
        motivo_transferencia_humano:
          execConsulta.motivo === 'tempo_servico_indisponivel'
            ? 'tempo_servico_indisponivel'
            : 'dados_insuficientes_consulta_datas',
      },
      resposta,
      estado: 'transferido_humano',
      contactId, ticketId, digisacMessageId: messageId, telefoneAutorizado: telefoneAutorizadoFlag,
    });
    await supabase.from('atendimento_automatico_sessoes').update({
      estado: 'transferido_humano', status: 'transferido_humano',
      metadata: novoMetadata, ultima_mensagem_cliente: text.substring(0, 200),
      ultima_mensagem_em: agora, updated_at: agora,
    }).eq('id', sessaoId);
    console.log(
      `[posvenda-webhook] consulta datas erro sessaoId=${sessaoId} codigo=${execConsulta.diagnostico?.erroCodigo ?? execConsulta.motivo} mensagem=${execConsulta.diagnostico?.erroMensagem ?? execConsulta.motivo} camposAusentes=${execConsulta.diagnostico?.payloadCamposAusentes.join(',') ?? '-'}`
    );
    return { ok: true, saved: true, origem: 'cliente' };
  }

  if (execConsulta.estado === 'erro_consulta') {
    const resposta = respostaTransferidoHumanoErroDatas();
    const novoMetadata = await construirMetadataComResposta({
      sessaoId,
      metadataAtual: {
        ...metadataBase,
        ...geoCacheMetadata,
        ...diagnosticoConsultaMetadata,
        consulta_datas_status: 'erro',
        consulta_datas_em: agora,
        consulta_datas_erro: execConsulta.motivo,
        consulta_datas_erros: execConsulta.erros ?? [],
        consulta_datas_origem: 'mere',
        precisa_humano_por_regra: true,
        motivo_transferencia_humano: 'erro_consulta_datas',
      },
      resposta,
      estado: 'transferido_humano',
      contactId, ticketId, digisacMessageId: messageId, telefoneAutorizado: telefoneAutorizadoFlag,
    });
    await supabase.from('atendimento_automatico_sessoes').update({
      estado: 'transferido_humano', status: 'transferido_humano',
      metadata: novoMetadata, ultima_mensagem_cliente: text.substring(0, 200),
      ultima_mensagem_em: agora, updated_at: agora,
    }).eq('id', sessaoId);
    console.log(
      `[posvenda-webhook] consulta datas erro sessaoId=${sessaoId} codigo=${execConsulta.diagnostico?.erroCodigo ?? execConsulta.motivo} mensagem=${execConsulta.diagnostico?.erroMensagem ?? execConsulta.motivo} camposAusentes=${execConsulta.diagnostico?.payloadCamposAusentes.join(',') ?? '-'}`
    );
    return { ok: true, saved: true, origem: 'cliente' };
  }

  if (execConsulta.estado === 'sem_datas') {
    const resposta = respostaTransferidoHumanoSemDatas();
    const novoMetadata = await construirMetadataComResposta({
      sessaoId,
      metadataAtual: {
        ...metadataBase,
        ...geoCacheMetadata,
        consulta_datas_status: 'sem_datas',
        consulta_datas_em: agora,
        consulta_datas_run_id: execConsulta.runId,
        consulta_datas_origem: 'mere',
        total_datas_disponiveis: 0,
        datas_disponiveis: [],
        precisa_humano_por_regra: true,
        motivo_transferencia_humano: 'sem_datas_disponiveis',
      },
      resposta,
      estado: 'transferido_humano',
      contactId, ticketId, digisacMessageId: messageId, telefoneAutorizado: telefoneAutorizadoFlag,
    });
    await supabase.from('atendimento_automatico_sessoes').update({
      estado: 'transferido_humano', status: 'transferido_humano',
      metadata: novoMetadata, ultima_mensagem_cliente: text.substring(0, 200),
      ultima_mensagem_em: agora, updated_at: agora,
    }).eq('id', sessaoId);
    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: sessaoId, tipo: 'sem_datas_disponiveis',
      descricao: 'Consulta retornou zero datas elegíveis',
      metadata: { run_id: execConsulta.runId, total_candidatos: execConsulta.totalCandidatos },
    });
    console.log(`[posvenda-webhook] sem datas disponiveis sessaoId=${sessaoId}`);
    return { ok: true, saved: true, origem: 'cliente' };
  }

  // datas_encontradas
  const datasMotor = execConsulta.datas ?? [];
  const grupoSelecionado = obterGrupoSelecionado(metadataBase);
  const dataAtualBR = grupoSelecionado?.data_entrega ?? '';
  const dataAtualISO = dataBRParaISO(dataAtualBR);
  const acaoAlteracao = metadataBase.acao_alteracao === 'adiantar' || metadataBase.acao_alteracao === 'postergar'
    ? metadataBase.acao_alteracao
    : null;
  const filtroDatas = filtrarDatasDisponiveisPorAcaoMere({
    datas: datasMotor,
    dataAtualISO,
    acao: acaoAlteracao,
  });
  const datas = filtroDatas.datasExibidas;

  console.log(
    `[posvenda-webhook] opcoes datas filtradas sessaoId=${sessaoId} acao=${acaoAlteracao ?? '-'} dataAtual=${dataAtualISO ?? '-'} totalMotor=${filtroDatas.totalMotor} totalExibidas=${datas.length} removidasMesmaData=${filtroDatas.removidasMesmaData} removidasContrariasAcao=${filtroDatas.removidasContrariasAcao}`
  );

  if (datas.length === 0) {
    const ofereceuPostergar = acaoAlteracao === 'adiantar' && filtroDatas.datasPosteriores.length > 0;
    const resposta = ofereceuPostergar
      ? respostaSemOpcoesAdiantarOferecerPostergar(dataAtualBR || dataAtualISO || 'a data atual')
      : acaoAlteracao === 'postergar'
        ? respostaSemOpcoesPostergar(dataAtualBR || dataAtualISO || 'a data atual')
        : respostaTransferidoHumanoSemDatas();
    const estadoFinal = ofereceuPostergar ? 'datas_encontradas' : 'transferido_humano';
    const novoMetadata = await construirMetadataComResposta({
      sessaoId,
      metadataAtual: {
        ...metadataBase,
        ...geoCacheMetadata,
        consulta_datas_status: ofereceuPostergar ? 'sem_opcoes_para_adiantar' : 'sem_datas',
        consulta_datas_em: agora,
        consulta_datas_run_id: execConsulta.runId,
        consulta_datas_origem: 'mere',
        data_entrega_atual_iso: dataAtualISO,
        acao_alteracao_original: acaoAlteracao,
        opcoes_datas_total_motor: filtroDatas.totalMotor,
        opcoes_datas_motor: datasMotor,
        opcoes_datas_removidas_mesma_data: filtroDatas.removidasMesmaData,
        opcoes_datas_removidas_contrarias_acao: filtroDatas.removidasContrariasAcao,
        opcoes_datas_exibidas_total: 0,
        sem_opcoes_para_acao: true,
        ofereceu_verificar_postergar: ofereceuPostergar,
        opcoes_datas_posteriores: filtroDatas.datasPosteriores,
        datas_disponiveis: [],
        total_datas_disponiveis: 0,
        ...(ofereceuPostergar
          ? { aguardando_resposta_postergar_sem_opcoes: true }
          : { precisa_humano_por_regra: true, motivo_transferencia_humano: acaoAlteracao === 'postergar' ? 'sem_opcoes_postergar' : 'sem_datas_disponiveis' }),
      },
      resposta,
      estado: estadoFinal,
      contactId, ticketId, digisacMessageId: messageId, telefoneAutorizado: telefoneAutorizadoFlag,
    });
    await supabase.from('atendimento_automatico_sessoes').update({
      estado: estadoFinal,
      ...(ofereceuPostergar ? {} : { status: 'transferido_humano' }),
      metadata: novoMetadata, ultima_mensagem_cliente: text.substring(0, 200),
      ultima_mensagem_em: agora, updated_at: agora,
    }).eq('id', sessaoId);
    await supabase.from('atendimento_automatico_eventos').insert({
      sessao_id: sessaoId,
      tipo: ofereceuPostergar ? 'sem_opcoes_adiantar_ofereceu_postergar' : 'sem_datas_disponiveis',
      descricao: ofereceuPostergar
        ? 'Sem opcoes anteriores para adiantar; ofereceu verificar postergacao'
        : 'Consulta sem opcoes compativeis com a acao solicitada',
      metadata: {
        run_id: execConsulta.runId,
        acao: acaoAlteracao,
        data_atual_iso: dataAtualISO,
        total_motor: filtroDatas.totalMotor,
        total_exibidas: 0,
        removidas_mesma_data: filtroDatas.removidasMesmaData,
        removidas_contrarias_acao: filtroDatas.removidasContrariasAcao,
      },
    });
    if (ofereceuPostergar) {
      console.log(`[posvenda-webhook] sem opcoes para adiantar, oferecendo postergar sessaoId=${sessaoId}`);
    }
    return { ok: true, saved: true, origem: 'cliente' };
  }

  const textoOpcoes = formatarOpcoesDatasParaCliente(datas, true);
  const resposta = respostaDatasEncontradas(textoOpcoes);
  const numeroOpcaoManter = datas.length + 1;
  const novoMetadata = await construirMetadataComResposta({
    sessaoId,
    metadataAtual: {
      ...metadataBase,
      ...geoCacheMetadata,
      consulta_datas_status: 'sucesso',
      consulta_datas_em: agora,
      consulta_datas_run_id: execConsulta.runId,
      consulta_datas_origem: 'mere',
      data_entrega_atual_iso: dataAtualISO,
      acao_alteracao_original: acaoAlteracao,
      opcoes_datas_total_motor: filtroDatas.totalMotor,
      opcoes_datas_motor: datasMotor,
      opcoes_datas_removidas_mesma_data: filtroDatas.removidasMesmaData,
      opcoes_datas_removidas_contrarias_acao: filtroDatas.removidasContrariasAcao,
      opcoes_datas_exibidas_total: datas.length,
      sem_opcoes_para_acao: false,
      ofereceu_verificar_postergar: false,
      aguardando_resposta_postergar_sem_opcoes: false,
      total_datas_disponiveis: datas.length,
      datas_disponiveis: datas,
      opcao_manter_data_atual_numero: numeroOpcaoManter,
      opcao_manter_data_atual_habilitada: true,
    },
    resposta,
    estado: 'datas_encontradas',
    contactId, ticketId, digisacMessageId: messageId, telefoneAutorizado: telefoneAutorizadoFlag,
  });
  await supabase.from('atendimento_automatico_sessoes').update({
    estado: 'datas_encontradas',
    metadata: novoMetadata, ultima_mensagem_cliente: text.substring(0, 200),
    ultima_mensagem_em: agora, updated_at: agora,
  }).eq('id', sessaoId);
  await supabase.from('atendimento_automatico_eventos').insert({
    sessao_id: sessaoId, tipo: 'datas_encontradas',
    descricao: `Consulta retornou ${datas.length} opção(ões)`,
    metadata: { run_id: execConsulta.runId, datas: datas.map((d: DatasDisponiveisMere) => d.dataISO) },
  });
  console.log(`[posvenda-webhook] opcoes datas exibidas com manter data atual sessaoId=${sessaoId} totalDatas=${datas.length} opcaoManter=${numeroOpcaoManter}`);
  return { ok: true, saved: true, origem: 'cliente' };
}

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

  // Wildcard * libera todos os telefones
  if (allowedEnv.trim() === '*') {
    console.log('[posvenda-webhook] allowlist wildcard ativa, telefone autorizado');
    return true;
  }

  const allowed = allowedEnv.split(',').map((t) => normalizarTelefone(t.trim())).filter(Boolean);
  if (allowed.length === 0) return false;
  if (!telefone) return false;
  const telNormalizado = normalizarTelefone(telefone);
  return allowed.includes(telNormalizado);
}

function calendarWriteHabilitado(): boolean {
  return process.env.ATENDIMENTO_POSVENDA_CALENDAR_WRITE_ENABLED === 'true';
}

function calendarReagendamentoDestinoId(): string | null {
  return process.env.GOOGLE_CALENDAR_REAGENDAMENTO_REM_CLIENTE_ID ?? null;
}

function detectarDocumento(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 11 || digitos.length === 14) {
    return digitos;
  }
  return null;
}

function mascararDocumentoMetadata(documento: string | null | undefined): string | null {
  if (!documento) return null;
  const digitos = documento.replace(/\D/g, '');
  if (digitos.length === 11) return `${digitos.slice(0, 3)}.***.***-${digitos.slice(-2)}`;
  if (digitos.length === 14) return `${digitos.slice(0, 2)}.***.***/****-${digitos.slice(-2)}`;
  return null;
}

type ModoBuscaDocumento = 'inicial' | 'retentativa_pedido_negado';

async function prepararBuscaAgendaPorDocumento(params: {
  documento: string;
  documentoAnterior: string | null;
  modo: ModoBuscaDocumento;
  sessaoId: string;
  metadataAtual: Record<string, unknown> | null;
  contactId: string | null;
  ticketId: string;
  messageId: string;
  telefoneAutorizado: boolean;
}): Promise<{
  novoEstado: string;
  novoStatus?: string;
  motivoFalha?: string;
  metadataBusca: Record<string, unknown>;
}> {
  const buscaAgendaEm = new Date().toISOString();
  const resultadoBusca = await buscarAgendamentosPorDocumento(params.documento);
  const tentativasDocumentoAtual = params.metadataAtual?.tentativas_documento as number | undefined;
  const metadataRetentativa =
    params.modo === 'retentativa_pedido_negado'
      ? {
          documento_anterior_mascarado: mascararDocumentoMetadata(params.documentoAnterior),
          documento_retentativa_mascarado: mascararDocumentoMetadata(params.documento),
          retentativa_documento_em: buscaAgendaEm,
          tentativas_documento: (tentativasDocumentoAtual ?? 0) + 1,
        }
      : {};

  let novoEstado: string;
  let novoStatus: string | undefined;
  let motivoFalha: string | undefined;
  let metadataBusca: Record<string, unknown>;

  if (resultadoBusca.ok) {
    const grupos = resultadoBusca.grupos;

    if (resultadoBusca.total > 0 && grupos.length > 0) {
      if (grupos.length === 1) {
        const grupo = grupos[0];
        novoEstado = 'aguardando_confirmacao_pedido';
        metadataBusca = await construirMetadataComResposta({
          sessaoId: params.sessaoId,
          metadataAtual: {
            ...(params.metadataAtual ?? {}),
            ...metadataRetentativa,
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
          contactId: params.contactId,
          ticketId: params.ticketId,
          digisacMessageId: params.messageId,
          telefoneAutorizado: params.telefoneAutorizado,
        });
        console.log(`[posvenda-webhook] pedido localizado sessaoId=${params.sessaoId} total=${resultadoBusca.total} grupos=${grupos.length}`);
      } else {
        const nomeCliente = grupos[0]?.nome_cliente ?? '';
        novoEstado = 'aguardando_escolha_grupo';
        metadataBusca = await construirMetadataComResposta({
          sessaoId: params.sessaoId,
          metadataAtual: {
            ...(params.metadataAtual ?? {}),
            ...metadataRetentativa,
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
          contactId: params.contactId,
          ticketId: params.ticketId,
          digisacMessageId: params.messageId,
          telefoneAutorizado: params.telefoneAutorizado,
        });
        console.log(`[posvenda-webhook] multiplos grupos sessaoId=${params.sessaoId} total=${resultadoBusca.total} grupos=${grupos.length}`);
      }
    } else if (params.modo === 'retentativa_pedido_negado') {
      novoEstado = 'transferido_humano';
      novoStatus = 'transferido_humano';
      motivoFalha = 'novo_documento_nao_localizado';
      metadataBusca = await construirMetadataComResposta({
        sessaoId: params.sessaoId,
        metadataAtual: {
          ...(params.metadataAtual ?? {}),
          ...metadataRetentativa,
          agendamentos_encontrados: [],
          total_agendamentos_encontrados: 0,
          grupos_agendamento: [],
          total_grupos_agendamento: 0,
          grupo_agendamento_selecionado: null,
          busca_agenda_status: 'nao_encontrado',
          busca_agenda_em: buscaAgendaEm,
          precisa_humano_por_regra: true,
          motivo_transferencia_humano: 'novo_documento_nao_localizado',
        },
        resposta: respostaNovoDocumentoNaoLocalizado(),
        estado: novoEstado,
        contactId: params.contactId,
        ticketId: params.ticketId,
        digisacMessageId: params.messageId,
        telefoneAutorizado: params.telefoneAutorizado,
      });
      console.log(`[posvenda-webhook] novo documento nao localizado sessaoId=${params.sessaoId}`);
    } else {
      novoEstado = 'pedido_nao_localizado';
      metadataBusca = await construirMetadataComResposta({
        sessaoId: params.sessaoId,
        metadataAtual: {
          ...(params.metadataAtual ?? {}),
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
        contactId: params.contactId,
        ticketId: params.ticketId,
        digisacMessageId: params.messageId,
        telefoneAutorizado: params.telefoneAutorizado,
      });
      console.log(`[posvenda-webhook] pedido nao localizado sessaoId=${params.sessaoId}`);
    }
  } else {
    novoEstado = 'erro_busca_agenda';
    metadataBusca = {
      ...(params.metadataAtual ?? {}),
      ...metadataRetentativa,
      agendamentos_encontrados: [],
      total_agendamentos_encontrados: 0,
      busca_agenda_status: 'erro',
      busca_agenda_erro: resultadoBusca.erro.substring(0, 200),
      busca_agenda_em: buscaAgendaEm,
    };
    console.log(`[posvenda-webhook] erro busca agenda sessaoId=${params.sessaoId} erro=${resultadoBusca.erro.substring(0, 100)}`);
  }

  return { novoEstado, novoStatus, motivoFalha, metadataBusca };
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
  // Bloqueio CLIENTE RETIRA tem prioridade sobre todos os outros bloqueios
  const equipeAgenda = grupo?.equipe_agenda ?? '';
  const eventosComClienteRetira = (grupo?.eventos ?? []).some((ev) => ehClienteRetiraEquipeAgenda(ev.equipe_agenda));
  if (ehClienteRetiraEquipeAgenda(equipeAgenda) || eventosComClienteRetira) {
    return { bloqueado: true, motivo: 'cliente_retira_alteracao', resposta: respostaBloqueioClienteRetiraAlteracao() };
  }

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
          const telefoneSessao = sessaoExistente.telefone;
          const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
          const { novoEstado, metadataBusca } = await prepararBuscaAgendaPorDocumento({
            documento,
            documentoAnterior: sessaoExistente.documento_informado ?? null,
            modo: 'inicial',
            sessaoId,
            metadataAtual,
            contactId,
            ticketId,
            messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

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

      // Estado: aguardando novo documento ou esclarecimento apos negativa da entrega
      if (sessaoExistente.estado === 'aguardando_novo_documento_ou_esclarecimento') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const documento = detectarDocumento(text);

        if (documento) {
          const { novoEstado, novoStatus, motivoFalha, metadataBusca } = await prepararBuscaAgendaPorDocumento({
            documento,
            documentoAnterior: sessaoExistente.documento_informado ?? null,
            modo: 'retentativa_pedido_negado',
            sessaoId,
            metadataAtual,
            contactId,
            ticketId,
            messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            documento_informado: documento,
            estado: novoEstado,
            ...(novoStatus ? { status: novoStatus } : {}),
            ...(motivoFalha ? { motivo_falha: motivoFalha } : {}),
            metadata: metadataBusca,
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
            metadata: { serviceId, departmentId, documento_detectado: true, retentativa_documento: true },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: novoEstado === 'transferido_humano' ? 'novo_documento_nao_localizado' : 'novo_documento_recebido',
            descricao: novoEstado === 'transferido_humano'
              ? 'Novo documento informado pelo cliente nao localizou entrega'
              : 'Novo documento informado pelo cliente apos negar entrega localizada',
            metadata: {
              tamanho_documento: documento.length,
              busca_agenda_status: metadataBusca.busca_agenda_status,
              total_agendamentos_encontrados: metadataBusca.total_agendamentos_encontrados,
              total_grupos_agendamento: metadataBusca.total_grupos_agendamento,
              motivo_falha: motivoFalha ?? null,
            },
          });

          console.log(`[posvenda-webhook] novo documento recebido sessaoId=${sessaoId} digitos=${documento.length} estado=${novoEstado}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Sem documento: tentar IA fallback antes do fallback padrao
        const iaResultNovoDoc = await tentarIAFallback('aguardando_novo_documento_ou_esclarecimento', text, metadataAtual);
        if (iaResultNovoDoc.acao_mapeada === 'transferir_humano') {
          const respostaTransfer = respostaTransferidoHumanoSemDocumentoRelocalizacao();
          const novoMetadataTransfer = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), ...iaResultNovoDoc.metadata_ia, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
            resposta: respostaTransfer,
            estado: 'transferido_humano',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });
          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'transferido_humano', status: 'transferido_humano',
            metadata: novoMetadataTransfer,
            ultima_mensagem_cliente: text.substring(0, 200),
            ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq('id', sessaoId);
          await supabase.from('atendimento_automatico_mensagens').insert({
            sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
            digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
            tipo_mensagem: msg.type as string | undefined,
            timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
            status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
          });
          console.log(`[posvenda-webhook] IA fallback transferiu humano (novo_documento) sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        const tentativas = calcularTentativasInvalidas(metadataAtual, 'aguardando_novo_documento_ou_esclarecimento');
        const transferir = tentativas >= 2;
        const resposta = transferir
          ? respostaTransferidoHumanoSemDocumentoRelocalizacao()
          : respostaFallbackNovoDocumentoOuEsclarecimento();

        const novoMetadata = await construirMetadataComResposta({
          sessaoId,
          metadataAtual: {
            ...(metadataAtual ?? {}),
            ...iaResultNovoDoc.metadata_ia,
            tentativas_invalidas_estado: tentativas,
            tentativas_invalidas_ultimo_estado: 'aguardando_novo_documento_ou_esclarecimento',
            ultima_resposta_invalida_em: new Date().toISOString(),
            ...(transferir ? {
              precisa_humano_por_regra: true,
              motivo_transferencia_humano: 'sem_documento_para_relocalizar_pedido',
            } : {}),
          },
          resposta,
          estado: transferir ? 'transferido_humano' : sessaoExistente.estado,
          contactId,
          ticketId,
          digisacMessageId: messageId,
          telefoneAutorizado: telefoneAutorizadoFlag,
        });

        await supabase.from('atendimento_automatico_sessoes').update({
          ...(transferir ? {
            estado: 'transferido_humano',
            status: 'transferido_humano',
            motivo_falha: 'sem_documento_para_relocalizar_pedido',
          } : {}),
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
          metadata: { serviceId, departmentId, documento_detectado: false, tentativas_invalidas: tentativas, transferir },
        });

        await supabase.from('atendimento_automatico_eventos').insert({
          sessao_id: sessaoId,
          tipo: transferir ? 'sem_documento_para_relocalizar_pedido' : 'novo_documento_fallback',
          descricao: transferir
            ? 'Cliente nao informou CPF/CNPJ apos duas tentativas'
            : 'Mensagem sem CPF/CNPJ no estado de relocalizacao de pedido',
          metadata: { tentativas_invalidas: tentativas },
        });

        console.log(`[posvenda-webhook] aguardando novo documento sem documento tentativas=${tentativas} transferir=${transferir} sessaoId=${sessaoId}`);
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
        let confirmacao = interpretarConfirmacao(text);
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const totalGrupos = metadataAtual?.total_grupos_agendamento as number | undefined;
        const grupoSelecionado = metadataAtual?.grupo_agendamento_selecionado as number | undefined;
        let iaMetadataConfirmacao: Record<string, unknown> = {};

        // IA fallback se deterministico retornou ambigua
        if (confirmacao === 'ambigua') {
          const iaResult = await tentarIAFallback('aguardando_confirmacao_pedido', text, metadataAtual);
          iaMetadataConfirmacao = iaResult.metadata_ia;
          if (iaResult.acao_mapeada === 'confirmar') confirmacao = 'confirmar';
          else if (iaResult.acao_mapeada === 'negar') confirmacao = 'negar';
          else if (iaResult.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('pedido');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataConfirmacao, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }
        }

        // Se ha apenas 1 grupo e solicitacao de alterar_entrega, 1/2 sao acoes de alteracao
        if (
          sessaoExistente.tipo_solicitacao === 'alterar_entrega' &&
          totalGrupos === 1 &&
          grupoSelecionado === 1 &&
          (textoNormalizado === '1' || textoNormalizado === '2')
        ) {
          const acao = textoNormalizado === '1' ? 'adiantar' : 'postergar';

          // Bloqueio CLIENTE RETIRA: se grupo tem CLIENTE RETIRA, transferir humano
          const grupoShortcut = obterGrupoSelecionado(metadataAtual);
          const bloqueioShortcut = validarBloqueioAcao(acao, grupoShortcut);
          if (bloqueioShortcut.bloqueado) {
            const novoMetadataBloqueio = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                acao_alteracao: acao,
                pedido_confirmado: true,
                precisa_humano_por_regra: true,
                motivo_bloqueio_acao: bloqueioShortcut.motivo,
                bloqueio_cliente_retira: bloqueioShortcut.motivo === 'cliente_retira_alteracao',
                ...(bloqueioShortcut.motivo === 'cliente_retira_alteracao' && grupoShortcut ? { equipe_agenda_original: grupoShortcut.equipe_agenda } : {}),
              },
              resposta: bloqueioShortcut.resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });

            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano',
              status: 'transferido_humano',
              metadata: novoMetadataBloqueio,
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
              metadata: { serviceId, departmentId, acao_alteracao: acao, bloqueio: bloqueioShortcut.motivo },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'bloqueio_acao',
              descricao: `Acao ${acao} bloqueada: ${bloqueioShortcut.motivo}`,
              metadata: { acao, motivo: bloqueioShortcut.motivo },
            });

            console.log(`[posvenda-webhook] acao alteracao bloqueada motivo=${bloqueioShortcut.motivo} sessaoId=${sessaoId} acao=${acao}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

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
            metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataConfirmacao, pedido_confirmado: true },
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
          const pedidoNegadoEm = new Date().toISOString();
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataConfirmacao,
              pedido_confirmado: false,
              pedido_negado_em: pedidoNegadoEm,
              motivo_pedido_negado: 'cliente_informou_entrega_incorreta',
            },
            resposta: respostaPedidoNegadoSolicitarNovoDocumento(),
            estado: 'aguardando_novo_documento_ou_esclarecimento',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase
            .from('atendimento_automatico_sessoes')
            .update({
              estado: 'aguardando_novo_documento_ou_esclarecimento',
              status: 'ativa',
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
            metadata: {
              serviceId,
              departmentId,
              pedido_confirmado: false,
              motivo_pedido_negado: 'cliente_informou_entrega_incorreta',
            },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'pedido_negado',
            descricao: 'Cliente informou que a entrega localizada nao e a correta',
            metadata: {
              motivo_pedido_negado: 'cliente_informou_entrega_incorreta',
              estado_destino: 'aguardando_novo_documento_ou_esclarecimento',
            },
          });

          console.log(`[posvenda-webhook] pedido negado sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Resposta ambigua: fallback com contador de tentativas
        {
          const tentativas = calcularTentativasInvalidas(metadataAtual, 'aguardando_confirmacao_pedido');
          const transferir = tentativas > 2;

          const resposta = transferir
            ? respostaTransferidoHumanoMuitasTentativas('pedido')
            : respostaFallbackConfirmacaoPedido();

          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataConfirmacao,
              tentativas_invalidas_estado: tentativas,
              tentativas_invalidas_ultimo_estado: 'aguardando_confirmacao_pedido',
              ultima_resposta_invalida_em: new Date().toISOString(),
              resposta_sugerida_tipo: resposta.tipo,
              ...(transferir ? { precisa_humano_por_regra: true, motivo_transferencia_humano: 'muitas_tentativas_invalidas' } : {}),
            },
            resposta,
            estado: transferir ? 'transferido_humano' : sessaoExistente.estado,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            ...(transferir ? { estado: 'transferido_humano', status: 'transferido_humano' } : {}),
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
            metadata: { serviceId, departmentId, tentativas_invalidas: tentativas, transferir },
          });

          console.log(`[posvenda-webhook] confirmacao ambigua tentativas=${tentativas} transferir=${transferir} sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Estado: aguardando_escolha_acao
      if (sessaoExistente.estado === 'aguardando_escolha_acao') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const acaoInterpretada = interpretarAcaoAlteracao(text);
        let acaoEfetiva = acaoInterpretada;
        let iaMetadataAcao: Record<string, unknown> = {};

        // IA fallback se deterministico retornou ambigua
        if (acaoInterpretada === 'ambigua') {
          const iaResult = await tentarIAFallback('aguardando_escolha_acao', text, metadataAtual);
          iaMetadataAcao = iaResult.metadata_ia;
          if (iaResult.acao_mapeada === 'adiantar') acaoEfetiva = 'adiantar';
          else if (iaResult.acao_mapeada === 'postergar') acaoEfetiva = 'postergar';
          else if (iaResult.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('acao');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataAcao, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano (acao) sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }
        }

        if (acaoEfetiva === 'adiantar' || acaoEfetiva === 'postergar') {
          const acao = acaoEfetiva;
          const grupo = obterGrupoSelecionado(metadataAtual);
          const bloqueio = validarBloqueioAcao(acao, grupo);

          if (bloqueio.bloqueado) {
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                ...iaMetadataAcao,
                acao_alteracao: acao,
                precisa_humano_por_regra: true,
                motivo_bloqueio_acao: bloqueio.motivo,
                bloqueio_cliente_retira: bloqueio.motivo === 'cliente_retira_alteracao',
                ...(bloqueio.motivo === 'cliente_retira_alteracao' && grupo ? { equipe_agenda_original: grupo.equipe_agenda } : {}),
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
              status: 'transferido_humano',
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
            metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataAcao, acao_alteracao: acao, endereco_confirmado: false },
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

        // Resposta ambigua: fallback com contador de tentativas
        {
          const tentativas = calcularTentativasInvalidas(metadataAtual, 'aguardando_escolha_acao');
          const transferir = tentativas > 2;

          const resposta = transferir
            ? respostaTransferidoHumanoMuitasTentativas('acao')
            : respostaFallbackEscolhaAcao();

          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataAcao,
              tentativas_invalidas_estado: tentativas,
              tentativas_invalidas_ultimo_estado: 'aguardando_escolha_acao',
              ultima_resposta_invalida_em: new Date().toISOString(),
              resposta_sugerida_tipo: resposta.tipo,
              ...(transferir ? { precisa_humano_por_regra: true, motivo_transferencia_humano: 'muitas_tentativas_invalidas' } : {}),
            },
            resposta,
            estado: transferir ? 'transferido_humano' : sessaoExistente.estado,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            ...(transferir ? { estado: 'transferido_humano', status: 'transferido_humano' } : {}),
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
            metadata: { serviceId, departmentId, tentativas_invalidas: tentativas, transferir },
          });

          console.log(`[posvenda-webhook] acao ambigua tentativas=${tentativas} transferir=${transferir} sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Estado: aguardando_confirmacao_endereco
      if (sessaoExistente.estado === 'aguardando_confirmacao_endereco') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        let confirmacao = interpretarConfirmacao(text);
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const acaoAlteracao = (metadataAtual?.acao_alteracao as 'adiantar' | 'postergar' | undefined) ?? 'postergar';
        let iaMetadataEndereco: Record<string, unknown> = {};

        // IA fallback se deterministico retornou ambigua
        if (confirmacao === 'ambigua') {
          const iaResult = await tentarIAFallback('aguardando_confirmacao_endereco', text, metadataAtual);
          iaMetadataEndereco = iaResult.metadata_ia;
          if (iaResult.acao_mapeada === 'confirmar') confirmacao = 'confirmar';
          else if (iaResult.acao_mapeada === 'negar') confirmacao = 'negar';
          else if (iaResult.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('acao');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataEndereco, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano (endereco) sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }
        }

        // Cliente confirma endereco
        if (confirmacao === 'confirmar') {
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataEndereco, endereco_confirmado: true },
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
              ...iaMetadataEndereco,
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
            status: 'transferido_humano',
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

        // Mensagem ambigua: fallback com mensagem clara, manter estado
        {
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataEndereco,
              tentativas_invalidas_estado: calcularTentativasInvalidas(metadataAtual, 'aguardando_confirmacao_endereco'),
              tentativas_invalidas_ultimo_estado: 'aguardando_confirmacao_endereco',
              ultima_resposta_invalida_em: new Date().toISOString(),
              resposta_sugerida_tipo: 'fallback_confirmacao_endereco',
            },
            resposta: respostaFallbackConfirmacaoEndereco(),
            estado: sessaoExistente.estado,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

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
            metadata: { serviceId, departmentId, fallback_confirmacao_endereco: true },
          });

          console.log(`[posvenda-webhook] endereco ambiguo fallback sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Estado: aguardando_data_desejada
      if (sessaoExistente.estado === 'aguardando_data_desejada') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const acaoAlteracao = (metadataAtual?.acao_alteracao as 'adiantar' | 'postergar' | undefined) ?? 'postergar';
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const interpretacao = interpretarDataDesejada(text, hoje);

        if (!interpretacao.ok) {
          // Data nao interpretada: tentar IA fallback antes do fallback padrao
          const iaResultData = await tentarIAFallback('aguardando_data_desejada', text, metadataAtual);
          if (iaResultData.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('acao');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaResultData.metadata_ia, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano (data_desejada) sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          // IA nao resolveu: fallback padrao
          const resposta = respostaDataNaoInterpretada();
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), ...iaResultData.metadata_ia, data_desejada_texto_original: text.substring(0, 100), data_desejada_motivo_invalida: 'nao_interpretada' },
            resposta,
            estado: 'aguardando_data_desejada',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

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
            metadata: { serviceId, departmentId, data_nao_interpretada: true },
          });

          console.log(`[posvenda-webhook] data nao interpretada sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Data interpretada: validar contra acao e entrega atual
        const grupo = obterGrupoSelecionado(metadataAtual);
        const dataEntregaBr = grupo?.data_entrega ?? '';
        const partesBr = dataEntregaBr.split('/');
        const isoEntregaAtual = partesBr.length === 3
          ? `${partesBr[2]}-${partesBr[1]}-${partesBr[0]}`
          : '';

        const validacao = isoEntregaAtual
          ? validarDataDesejadaParaAcao({
              isoDesejada: interpretacao.iso,
              isoEntregaAtual,
              acao: acaoAlteracao,
              hoje,
            })
          : { valida: true as const };

        if (!validacao.valida) {
          const motivo = validacao.motivo;

          // D+90: encaminhar para humano
          if (motivo === 'data_desejada_fora_janela_d90') {
            const resposta = respostaDataInvalidaForaJanelaD90();
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                data_desejada_texto_original: text.substring(0, 100),
                data_desejada_iso: interpretacao.iso,
                data_desejada_br: interpretacao.br,
                data_desejada_valida_para_acao: false,
                motivo_data_desejada_invalida: motivo,
                precisa_humano_por_regra: true,
                motivo_bloqueio_data: motivo,
              },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });

            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano',
              status: 'transferido_humano',
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
              metadata: { serviceId, departmentId, motivo_bloqueio_data: motivo },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'transferido_humano',
              descricao: `Data desejada fora da janela D90, transferido para humano`,
              metadata: { motivo },
            });

            console.log(`[posvenda-webhook] data D90 transferido humano sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          // Outros motivos: manter estado, pedir nova data
          let resposta: RespostaSugerida;
          if (motivo === 'data_desejada_antes_d2') {
            const d2 = new Date(hoje);
            d2.setDate(d2.getDate() + 2);
            const dataMinimaBR = `${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}`;
            resposta = respostaDataInvalidaAntesD2(dataMinimaBR);
          } else if (acaoAlteracao === 'adiantar') {
            resposta = respostaDataInvalidaAdiantar();
          } else {
            resposta = respostaDataInvalidaPostergar();
          }

          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              data_desejada_texto_original: text.substring(0, 100),
              data_desejada_iso: interpretacao.iso,
              data_desejada_br: interpretacao.br,
              data_desejada_valida_para_acao: false,
              motivo_data_desejada_invalida: motivo,
            },
            resposta,
            estado: 'aguardando_data_desejada',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

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
            metadata: { serviceId, departmentId, motivo_data_invalida: motivo },
          });

          console.log(`[posvenda-webhook] data invalida motivo=${motivo} sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Data valida: salvar mensagem/evento e disparar consulta no mesmo webhook
        console.log(`[posvenda-webhook] data desejada valida ${interpretacao.iso} sessaoId=${sessaoId}`);

        // Registrar mensagem e evento da data desejada
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
          metadata: { serviceId, departmentId, data_desejada_iso: interpretacao.iso, data_desejada_br: interpretacao.br },
        });

        await supabase.from('atendimento_automatico_eventos').insert({
          sessao_id: sessaoId,
          tipo: 'data_desejada_recebida',
          descricao: `Cliente informou data desejada: ${interpretacao.br}`,
          metadata: { data_desejada_iso: interpretacao.iso, data_desejada_br: interpretacao.br, acao_alteracao: acaoAlteracao },
        });

        // Salvar estado consultando_datas + resposta de confirmação ao cliente
        const respostaConfirmacao = respostaDataDesejadaRecebida(interpretacao.br);
        const metadataConsultando = await construirMetadataComResposta({
          sessaoId,
          metadataAtual: {
            ...(metadataAtual ?? {}),
            data_desejada_texto_original: text.substring(0, 100),
            data_desejada_iso: interpretacao.iso,
            data_desejada_br: interpretacao.br,
            data_desejada_interpretada_em: new Date().toISOString(),
            data_desejada_valida_para_acao: true,
            consulta_datas_status: 'consultando',
            consulta_datas_em: new Date().toISOString(),
          },
          resposta: respostaConfirmacao,
          estado: 'consultando_datas',
          contactId,
          ticketId,
          digisacMessageId: messageId,
          telefoneAutorizado: telefoneAutorizadoFlag,
        });

        await supabase.from('atendimento_automatico_sessoes').update({
          estado: 'consultando_datas',
          metadata: metadataConsultando,
          ultima_mensagem_cliente: text.substring(0, 200),
          ultima_mensagem_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', sessaoId);

        // Disparar consulta de datas imediatamente no mesmo webhook
        const execConsulta = await executarConsultaDatasMere({
          grupo: obterGrupoSelecionado(metadataAtual),
          dataDesejadaISO: interpretacao.iso,
          sessaoId,
        });

        return await aplicarResultadoConsultaDatas({
          execConsulta,
          sessaoId,
          metadataBase: metadataConsultando as Record<string, unknown>,
          contactId,
          ticketId,
          messageId,
          telefoneAutorizadoFlag,
          supabase,
          text,
        });
      }

      // Estado: data_desejada_recebida — fallback para sessões que ficaram presas antes da correção
      // Também cobre retry se o webhook anterior falhou após salvar data_desejada_recebida
      if (sessaoExistente.estado === 'data_desejada_recebida' || sessaoExistente.estado === 'consultando_datas') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);

        // Idempotência: consulta já rodou com sucesso — sessão deve ter avançado, ignorar
        const consultaStatus = metadataAtual?.consulta_datas_status as string | undefined;
        if (consultaStatus === 'sucesso') {
          console.log(`[posvenda-webhook] consulta ja realizada ignorando sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        const grupo = obterGrupoSelecionado(metadataAtual);
        const dataDesejadaISO = metadataAtual?.data_desejada_iso as string | undefined;

        console.log(`[posvenda-webhook] retry consulta estado=${sessaoExistente.estado} sessaoId=${sessaoId}`);

        const execConsulta = await executarConsultaDatasMere({ grupo, dataDesejadaISO, sessaoId });

        return await aplicarResultadoConsultaDatas({
          execConsulta,
          sessaoId,
          metadataBase: metadataAtual ?? {},
          contactId,
          ticketId,
          messageId,
          telefoneAutorizadoFlag,
          supabase,
          text,
        });
      }

      // Estado: datas_encontradas — cliente escolhe opção
      if (sessaoExistente.estado === 'aguardando_confirmacao_reagendamento') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        let confirmacao = interpretarConfirmacao(text);
        const dataNovaBR = (metadataAtual?.data_nova_br as string | undefined) ?? (metadataAtual?.data_opcao_selecionada_br as string | undefined) ?? '';
        const dataNovaISO = (metadataAtual?.data_nova_iso as string | undefined) ?? (metadataAtual?.data_opcao_selecionada as string | undefined) ?? '';
        const dataOriginalISO = metadataAtual?.data_original_iso as string | undefined;
        const grupo = obterGrupoSelecionado(metadataAtual);
        let iaMetadataReagendamento: Record<string, unknown> = {};

        // IA fallback se deterministico retornou ambigua
        if (confirmacao === 'ambigua') {
          const iaResult = await tentarIAFallback('aguardando_confirmacao_reagendamento', text, metadataAtual);
          iaMetadataReagendamento = iaResult.metadata_ia;
          if (iaResult.acao_mapeada === 'confirmar') confirmacao = 'confirmar';
          else if (iaResult.acao_mapeada === 'negar') confirmacao = 'negar';
          else if (iaResult.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('acao');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataReagendamento, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano (reagendamento) sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }
        }

        if (confirmacao === 'confirmar') {
          const resultadoCalendar = await executarReagendamentoCalendar({
            grupo,
            dataOriginalISO: dataOriginalISO ?? '',
            dataNovaISO,
            calendarWriteEnabled: calendarWriteHabilitado(),
            calendarDestinoId: calendarReagendamentoDestinoId(),
          });

          const resposta = resultadoCalendar.dryRun
            ? respostaReagendamentoDryRun(dataNovaBR || dataNovaISO)
            : resultadoCalendar.ok
              ? respostaReagendamentoConfirmado(dataNovaBR || dataNovaISO)
              : respostaTransferidoHumanoErroReagendamento();

          const agendaAlterada = resultadoCalendar.ok && !resultadoCalendar.dryRun;
          const estadoFinal = agendaAlterada ? 'reagendamento_confirmado' : 'transferido_humano';
          const statusFinal = agendaAlterada ? sessaoExistente.status : 'transferido_humano';

          // Após sucesso do Calendar, atualizar planilha original (aba gid 190443561)
          let resultadoPlanilha: Awaited<ReturnType<typeof atualizarDataAgendaGoogleOriginalMere>> | null = null;
          if (agendaAlterada) {
            const eventosPlanilha: EventoReagendamentoPlanilha[] = resultadoCalendar.eventos
              .filter((e) => e.status === 'movido')
              .map((e) => ({
                evento_id: e.evento_id,
                calendar_id: e.calendar_id,
                pedido_venda: grupo?.eventos.find((ev) => ev.evento_id === e.evento_id)?.pedido_venda,
              }));

            try {
              resultadoPlanilha = await atualizarDataAgendaGoogleOriginalMere(
                eventosPlanilha,
                dataNovaBR || dataNovaISO,
                { dryRun: false }
              );
              console.log(`[posvenda-webhook] planilha original status=${resultadoPlanilha.status} linhas=${resultadoPlanilha.totalLinhasAtualizadas} sessaoId=${sessaoId}`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[posvenda-webhook] erro ao atualizar planilha original: ${msg} sessaoId=${sessaoId}`);
              resultadoPlanilha = {
                ok: false,
                status: 'erro',
                spreadsheetId: process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SPREADSHEET_ID ?? '',
                sheetGid: process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SHEET_GID ?? '',
                sheetTitle: null,
                colunaDataAgenda: 'Data na agenda GOOGLE',
                criterioMatch: 'evento_id_calendar_id',
                totalLinhasAtualizadas: 0,
                linhas: [],
                erros: [`Exceção ao atualizar planilha: ${msg}`],
                dryRun: false,
              };
            }
          } else {
            // Calendar dry-run ou erro: não atualizar planilha
            resultadoPlanilha = await atualizarDataAgendaGoogleOriginalMere(
              [],
              dataNovaBR || dataNovaISO,
              { dryRun: true }
            );
          }

          const planilhaOk = resultadoPlanilha?.ok ?? false;
          const reagendamentoStatusFinal = !agendaAlterada
            ? resultadoCalendar.status
            : planilhaOk
              ? 'aplicado'
              : 'aplicado_com_falha_planilha';

          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataReagendamento,
              confirmacao_reagendamento_pendente: false,
              confirmacao_reagendamento: true,
              confirmacao_reagendamento_em: new Date().toISOString(),
              calendar_write_status: resultadoCalendar.status,
              calendar_write_dry_run: resultadoCalendar.dryRun,
              calendar_write_enabled: calendarWriteHabilitado(),
              calendar_reagendamento_destino_id: resultadoCalendar.calendarDestinoId,
              calendar_eventos_total: resultadoCalendar.totalEventos,
              calendar_eventos_processados: resultadoCalendar.eventos.length,
              calendar_eventos_resultado: resultadoCalendar.eventos,
              calendar_erros: resultadoCalendar.erros,
              reagendamento_status: reagendamentoStatusFinal,
              planilha_original_update_status: resultadoPlanilha?.status ?? 'skip_dry_run_calendar',
              planilha_original_update_em: new Date().toISOString(),
              planilha_original_spreadsheet_id: resultadoPlanilha?.spreadsheetId ?? '',
              planilha_original_sheet_gid: resultadoPlanilha?.sheetGid ?? '',
              planilha_original_sheet_title: resultadoPlanilha?.sheetTitle ?? null,
              planilha_original_linhas_atualizadas: resultadoPlanilha?.linhas ?? [],
              planilha_original_total_linhas_atualizadas: resultadoPlanilha?.totalLinhasAtualizadas ?? 0,
              planilha_original_erros: resultadoPlanilha?.erros ?? [],
              planilha_original_update_dry_run: resultadoPlanilha?.dryRun ?? false,
              planilha_original_coluna_data_agenda: resultadoPlanilha?.colunaDataAgenda ?? 'Data na agenda GOOGLE',
              planilha_original_criterio_match: resultadoPlanilha?.criterioMatch ?? 'evento_id_calendar_id',
              ...(agendaAlterada
                ? {
                    data_escolhida_confirmada: dataNovaISO,
                    alterou_agenda_em: new Date().toISOString(),
                    fluxo_concluido: planilhaOk,
                    fluxo_concluido_em: planilhaOk ? new Date().toISOString() : undefined,
                    motivo_conclusao: planilhaOk ? 'reagendamento_confirmado' : 'reagendamento_confirmado_falha_planilha',
                  }
                : { precisa_humano_por_regra: true, motivo_transferencia_humano: resultadoCalendar.dryRun ? 'calendar_write_dry_run' : 'erro_reagendamento_calendar' }),
            },
            resposta,
            estado: estadoFinal,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: estadoFinal,
            status: statusFinal,
            metadata: novoMetadata,
            data_escolhida: agendaAlterada ? dataNovaISO : sessaoExistente.data_escolhida,
            alterou_agenda: agendaAlterada,
            motivo_falha: resultadoCalendar.ok ? null : (resultadoCalendar.erros[0]?.codigo ?? 'erro_reagendamento_calendar'),
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
            metadata: {
              serviceId,
              departmentId,
              confirmacao_reagendamento: true,
              calendar_write_status: resultadoCalendar.status,
              dry_run: resultadoCalendar.dryRun,
            },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: agendaAlterada ? 'reagendamento_confirmado' : 'reagendamento_calendar_nao_aplicado',
            descricao: agendaAlterada
              ? `Reagendamento automatico aplicado para ${dataNovaBR || dataNovaISO}`
              : `Reagendamento automatico nao aplicado: ${resultadoCalendar.status}`,
            metadata: {
              data_original_iso: dataOriginalISO ?? null,
              data_nova_iso: dataNovaISO,
              resultado: resultadoCalendar,
            },
          });

          console.log(`[posvenda-webhook] confirmacao reagendamento status=${resultadoCalendar.status} dryRun=${resultadoCalendar.dryRun} sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        if (confirmacao === 'negar') {
          const datasDisponiveis = (metadataAtual?.datas_disponiveis ?? []) as DatasDisponiveisMere[];
          const voltarParaDatas = datasDisponiveis.length > 0;
          const resposta = voltarParaDatas ? respostaReagendamentoCancelado() : respostaTransferidoHumanoErroReagendamento();
          const estadoFinal = voltarParaDatas ? 'datas_encontradas' : 'transferido_humano';

          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataReagendamento,
              confirmacao_reagendamento_pendente: false,
              confirmacao_reagendamento: false,
              confirmacao_reagendamento_cancelada_em: new Date().toISOString(),
              ...(voltarParaDatas ? {} : { precisa_humano_por_regra: true, motivo_transferencia_humano: 'confirmacao_reagendamento_negada_sem_opcoes' }),
            },
            resposta,
            estado: estadoFinal,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: estadoFinal,
            ...(voltarParaDatas ? {} : { status: 'transferido_humano' }),
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
            metadata: { serviceId, departmentId, confirmacao_reagendamento: false },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'reagendamento_cancelado',
            descricao: 'Cliente negou confirmacao final de reagendamento',
            metadata: { data_nova_iso: dataNovaISO || null, voltou_para_datas: voltarParaDatas },
          });

          console.log(`[posvenda-webhook] confirmacao reagendamento negada voltarParaDatas=${voltarParaDatas} sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        {
          const resposta = respostaConfirmacaoReagendamentoAmbigua(dataNovaBR || dataNovaISO || 'a nova data');
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              ...iaMetadataReagendamento,
              confirmacao_reagendamento_pendente: true,
              ultima_confirmacao_reagendamento_ambigua_em: new Date().toISOString(),
            },
            resposta,
            estado: 'aguardando_confirmacao_reagendamento',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

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
            metadata: { serviceId, departmentId, confirmacao_reagendamento_ambigua: true },
          });

          console.log(`[posvenda-webhook] confirmacao reagendamento ambigua sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      if (sessaoExistente.estado === 'datas_encontradas') {
        const metadataAtual = sessaoExistente.metadata as Record<string, unknown> | null;
        const telefoneSessao = sessaoExistente.telefone;
        const telefoneAutorizadoFlag = telefoneAutorizado(telefoneSessao);
        const datasDisponiveis = (metadataAtual?.datas_disponiveis ?? []) as DatasDisponiveisMere[];
        const totalOpcoes = datasDisponiveis.length;

        if (metadataAtual?.aguardando_resposta_postergar_sem_opcoes === true) {
          const respostaOferta = interpretarRespostaOfertaPostergar(text);
          const grupo = obterGrupoSelecionado(metadataAtual);
          const dataAtualBR = grupo?.data_entrega ?? '';
          const opcoesPosteriores = (metadataAtual?.opcoes_datas_posteriores ?? []) as DatasDisponiveisMere[];

          if (respostaOferta === 'aceitar' && opcoesPosteriores.length > 0) {
            const numeroOpcaoManterPostergar = opcoesPosteriores.length + 1;
            const resposta = respostaDatasEncontradas(formatarOpcoesDatasParaCliente(opcoesPosteriores, true));
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                acao_alteracao: 'postergar',
                acao_alteracao_original: metadataAtual?.acao_alteracao_original ?? 'adiantar',
                aguardando_resposta_postergar_sem_opcoes: false,
                aceitou_verificar_postergar_em: new Date().toISOString(),
                datas_disponiveis: opcoesPosteriores,
                total_datas_disponiveis: opcoesPosteriores.length,
                opcoes_datas_exibidas_total: opcoesPosteriores.length,
                sem_opcoes_para_acao: false,
                opcao_manter_data_atual_numero: numeroOpcaoManterPostergar,
                opcao_manter_data_atual_habilitada: true,
              },
              resposta,
              estado: 'datas_encontradas',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'datas_encontradas',
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
              metadata: { serviceId, departmentId, aceitou_verificar_postergar: true },
            });
            console.log(`[posvenda-webhook] cliente aceitou verificar postergar sessaoId=${sessaoId} total=${opcoesPosteriores.length}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          if (respostaOferta === 'recusar') {
            const resposta = respostaManterDataAtual(dataAtualBR || String(metadataAtual?.data_entrega_atual_iso ?? 'a data atual'));
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                aguardando_resposta_postergar_sem_opcoes: false,
                recusou_verificar_postergar_em: new Date().toISOString(),
                fluxo_concluido: true,
                motivo_conclusao: 'mantida_data_atual',
              },
              resposta,
              estado: 'reagendamento_cancelado',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'reagendamento_cancelado',
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
              metadata: { serviceId, departmentId, recusou_verificar_postergar: true },
            });
            return { ok: true, saved: true, origem: 'cliente' };
          }

          if (respostaOferta === 'humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('acao');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                aguardando_resposta_postergar_sem_opcoes: false,
                precisa_humano_por_regra: true,
                motivo_transferencia_humano: 'cliente_pediu_humano',
              },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano',
              status: 'transferido_humano',
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
              metadata: { serviceId, departmentId, pediu_humano_oferta_postergar: true },
            });
            return { ok: true, saved: true, origem: 'cliente' };
          }
        }

        const numeroOpcaoManter = (metadataAtual?.opcao_manter_data_atual_numero as number | undefined) ?? (datasDisponiveis.length + 1);
        const opcaoManterHabilitada = metadataAtual?.opcao_manter_data_atual_habilitada === true || metadataAtual?.opcao_manter_data_atual_numero !== undefined;

        if (opcaoManterHabilitada && interpretarManterDataAtual(text, numeroOpcaoManter)) {
          const grupo = obterGrupoSelecionado(metadataAtual);
          const dataAtualBR = grupo?.data_entrega ?? '';
          const dataAtualISO = dataBRParaISO(dataAtualBR);
          const origem = /^\d+$/.test(text.trim()) ? 'numero' : 'texto';
          const resposta = respostaManterDataAtual(dataAtualBR || dataAtualISO || 'a data atual');
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              acao_final: 'manter_data_atual',
              data_entrega_atual_iso: dataAtualISO,
              calendar_alterado: false,
              planilha_alterada: false,
              fluxo_concluido: true,
              motivo_conclusao: 'mantida_data_atual',
              opcao_manter_data_atual_escolhida: true,
              opcao_manter_data_atual_origem: origem,
            },
            resposta,
            estado: 'reagendamento_cancelado',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });
          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'reagendamento_cancelado',
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
            metadata: { serviceId, departmentId, manter_data_atual: true, origem },
          });
          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'manter_data_atual',
            descricao: 'Cliente escolheu manter a data atual',
            metadata: { data_atual_iso: dataAtualISO, origem },
          });
          console.log(`[posvenda-webhook] cliente escolheu manter data atual sessaoId=${sessaoId} dataAtual=${dataAtualISO ?? '-'} origem=${origem}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        const selecaoOpcao = selecionarOpcaoDataPorTexto(text, datasDisponiveis);

        if (selecaoOpcao.ok) {
          const indiceEscolhido = selecaoOpcao.indice;
          const opcaoSelecionada = selecaoOpcao.opcao;
          const grupo = obterGrupoSelecionado(metadataAtual);
          const dataOriginalBR = grupo?.data_entrega ?? '';
          const dataOriginalISO = dataBRParaISO(dataOriginalBR);

          if (!grupo || !dataOriginalISO) {
            const resposta = respostaTransferidoHumanoErroReagendamento();
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: {
                ...(metadataAtual ?? {}),
                precisa_humano_por_regra: true,
                motivo_transferencia_humano: !grupo ? 'grupo_agendamento_nao_encontrado' : 'data_original_invalida',
                data_opcao_selecionada_indice: indiceEscolhido,
                data_opcao_selecionada: opcaoSelecionada.dataISO,
                data_opcao_selecionada_br: opcaoSelecionada.dataBR,
              },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });

            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano',
              status: 'transferido_humano',
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
              metadata: { serviceId, departmentId, opcao_selecionada: indiceEscolhido, erro_reagendamento: true },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'erro_pre_confirmacao_reagendamento',
              descricao: 'Nao foi possivel preparar confirmacao final de reagendamento',
              metadata: { data_original_br: dataOriginalBR || null, data_nova_iso: opcaoSelecionada.dataISO },
            });

            return { ok: true, saved: true, origem: 'cliente' };
          }

          const resposta = respostaConfirmarReagendamentoFinal(dataOriginalBR, opcaoSelecionada.dataBR);
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtual ?? {}),
              data_original_br: dataOriginalBR,
              data_original_iso: dataOriginalISO,
              data_nova_br: opcaoSelecionada.dataBR,
              data_nova_iso: opcaoSelecionada.dataISO,
              data_opcao_selecionada_indice: indiceEscolhido,
              data_opcao_selecionada: opcaoSelecionada.dataISO,
              data_opcao_selecionada_br: opcaoSelecionada.dataBR,
              data_opcao_selecionada_payload_original: opcaoSelecionada,
              data_opcao_selecionada_em: new Date().toISOString(),
              confirmacao_reagendamento_pendente: true,
            },
            resposta,
            estado: 'aguardando_confirmacao_reagendamento',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            estado: 'aguardando_confirmacao_reagendamento',
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
            metadata: {
              serviceId,
              departmentId,
              opcao_selecionada: indiceEscolhido,
              data_original_iso: dataOriginalISO,
              data_nova_iso: opcaoSelecionada.dataISO,
              confirmacao_reagendamento_pendente: true,
            },
          });

          await supabase.from('atendimento_automatico_eventos').insert({
            sessao_id: sessaoId,
            tipo: 'confirmacao_reagendamento_pendente',
            descricao: `Cliente selecionou data ${opcaoSelecionada.dataBR}; aguardando confirmacao final`,
            metadata: {
              data_original_iso: dataOriginalISO,
              data_original_br: dataOriginalBR,
              data_nova_iso: opcaoSelecionada.dataISO,
              data_nova_br: opcaoSelecionada.dataBR,
              equipe: opcaoSelecionada.equipe,
              indice: indiceEscolhido,
            },
          });

          console.log(`[posvenda-webhook] opcao selecionada aguardando confirmacao indice=${indiceEscolhido} data=${opcaoSelecionada.dataISO} sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }

        // Opção inválida: tentar IA fallback antes do fallback padrao
        {
          let iaMetadataDatas: Record<string, unknown> = {};
          let opcaoIAIndice: number | null = null;

          const iaResult = await tentarIAFallback('datas_encontradas', text, metadataAtual);
          iaMetadataDatas = iaResult.metadata_ia;

          if (iaResult.acao_mapeada === 'opcao_data_escolhida' && iaResult.dados_extraidos) {
            const idx = iaResult.dados_extraidos.indice as number | undefined;
            if (typeof idx === 'number' && idx >= 1 && idx <= totalOpcoes) {
              opcaoIAIndice = idx;
            }
          } else if (iaResult.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoMuitasTentativas('acao');
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataDatas, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano (datas) sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          if (opcaoIAIndice !== null) {
            const indiceEscolhido = opcaoIAIndice;
            const opcaoSelecionada = datasDisponiveis[indiceEscolhido - 1];
            const grupo = obterGrupoSelecionado(metadataAtual);
            const dataOriginalBR = grupo?.data_entrega ?? '';
            const dataOriginalISO = dataBRParaISO(dataOriginalBR);

            if (!grupo || !dataOriginalISO) {
              const resposta = respostaTransferidoHumanoErroReagendamento();
              const novoMetadata = await construirMetadataComResposta({
                sessaoId,
                metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataDatas, precisa_humano_por_regra: true, motivo_transferencia_humano: !grupo ? 'grupo_agendamento_nao_encontrado' : 'data_original_invalida', data_opcao_selecionada_indice: indiceEscolhido, data_opcao_selecionada: opcaoSelecionada.dataISO, data_opcao_selecionada_br: opcaoSelecionada.dataBR },
                resposta,
                estado: 'transferido_humano',
                contactId,
                ticketId,
                digisacMessageId: messageId,
                telefoneAutorizado: telefoneAutorizadoFlag,
              });
              await supabase.from('atendimento_automatico_sessoes').update({
                estado: 'transferido_humano', status: 'transferido_humano',
                metadata: novoMetadata,
                ultima_mensagem_cliente: text.substring(0, 200),
                ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
              }).eq('id', sessaoId);
              await supabase.from('atendimento_automatico_mensagens').insert({
                sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
                digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
                tipo_mensagem: msg.type as string | undefined,
                timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
                status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, erro: !grupo ? 'grupo_nao_encontrado' : 'data_invalida' },
              });
              console.log(`[posvenda-webhook] IA fallback datas erro grupo/data sessaoId=${sessaoId}`);
              return { ok: true, saved: true, origem: 'cliente' };
            }

            const resposta = respostaConfirmarReagendamentoFinal(dataOriginalBR, opcaoSelecionada.dataBR);
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataDatas, data_opcao_selecionada_indice: indiceEscolhido, data_opcao_selecionada: opcaoSelecionada.dataISO, data_opcao_selecionada_br: opcaoSelecionada.dataBR, data_nova_iso: opcaoSelecionada.dataISO, data_nova_br: opcaoSelecionada.dataBR, confirmacao_reagendamento_pendente: true },
              resposta,
              estado: 'aguardando_confirmacao_reagendamento',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlag,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'aguardando_confirmacao_reagendamento',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, opcao_selecionada: indiceEscolhido, data_original_iso: dataOriginalISO, data_nova_iso: opcaoSelecionada.dataISO, confirmacao_reagendamento_pendente: true },
            });
            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'confirmacao_reagendamento_pendente',
              descricao: `IA selecionou data ${opcaoSelecionada.dataBR}; aguardando confirmacao final`,
              metadata: { data_original_iso: dataOriginalISO, data_original_br: dataOriginalBR, data_nova_iso: opcaoSelecionada.dataISO, data_nova_br: opcaoSelecionada.dataBR, equipe: opcaoSelecionada.equipe, indice: indiceEscolhido, ia_fallback: true },
            });
            console.log(`[posvenda-webhook] IA fallback selecionou opcao indice=${indiceEscolhido} data=${opcaoSelecionada.dataISO} sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          // IA nao resolveu: fallback padrao
          const totalOpcoesComManter = opcaoManterHabilitada ? totalOpcoes + 1 : totalOpcoes;
          const resposta = respostaDataOpcaoInvalida(totalOpcoesComManter > 0 ? totalOpcoesComManter : 3);
          const novoMetadata = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: { ...(metadataAtual ?? {}), ...iaMetadataDatas, ultima_opcao_invalida_em: new Date().toISOString() },
            resposta,
            estado: sessaoExistente.estado,
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlag,
          });

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
            metadata: { serviceId, departmentId, opcao_invalida: true },
          });

          console.log(`[posvenda-webhook] opcao invalida em datas_encontradas sessaoId=${sessaoId}`);
          return { ok: true, saved: true, origem: 'cliente' };
        }
      }

      // Estado: documento_recebido/pedido_localizado/pedido_nao_localizado + alterar_entrega
      const estadosPermitemAcaoAlteracao = ['documento_recebido', 'pedido_localizado', 'pedido_nao_localizado'];
      if (estadosPermitemAcaoAlteracao.includes(sessaoExistente.estado) && sessaoExistente.tipo_solicitacao === 'alterar_entrega') {
        const acaoInterpretadaLegado = interpretarAcaoAlteracao(text);
        if (acaoInterpretadaLegado === 'adiantar' || acaoInterpretadaLegado === 'postergar') {
          const acao = acaoInterpretadaLegado;
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
              status: 'transferido_humano',
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

        // Estado pedido_nao_localizado: nunca ficar silencioso
        if (sessaoExistente.estado === 'pedido_nao_localizado') {
          const metadataAtualPNL = sessaoExistente.metadata as Record<string, unknown> | null;
          const telefoneSessaoPNL = sessaoExistente.telefone;
          const telefoneAutorizadoFlagPNL = telefoneAutorizado(telefoneSessaoPNL);
          const documento = detectarDocumento(text);

          if (documento) {
            const { novoEstado, novoStatus, motivoFalha, metadataBusca } = await prepararBuscaAgendaPorDocumento({
              documento,
              documentoAnterior: sessaoExistente.documento_informado ?? null,
              modo: 'inicial',
              sessaoId,
              metadataAtual: metadataAtualPNL,
              contactId,
              ticketId,
              messageId,
              telefoneAutorizado: telefoneAutorizadoFlagPNL,
            });

            await supabase.from('atendimento_automatico_sessoes').update({
              documento_informado: documento,
              estado: novoEstado,
              ...(novoStatus ? { status: novoStatus } : {}),
              ...(motivoFalha ? { motivo_falha: motivoFalha } : {}),
              metadata: metadataBusca,
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
              metadata: { serviceId, departmentId, documento_detectado: true, retentativa_pedido_nao_localizado: true },
            });

            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: novoEstado === 'transferido_humano' ? 'documento_nao_localizado_retentativa' : 'documento_recebido_retentativa',
              descricao: novoEstado === 'transferido_humano'
                ? 'Documento reenviado apos pedido nao localizado tambem nao localizou entrega'
                : 'Documento reenviado apos pedido nao localizado localizou entrega',
              metadata: {
                tamanho_documento: documento.length,
                busca_agenda_status: metadataBusca.busca_agenda_status,
                total_agendamentos_encontrados: metadataBusca.total_agendamentos_encontrados,
                total_grupos_agendamento: metadataBusca.total_grupos_agendamento,
                motivo_falha: motivoFalha ?? null,
              },
            });

            console.log(`[posvenda-webhook] retentativa documento em pedido_nao_localizado sessaoId=${sessaoId} estado=${novoEstado}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          // Sem documento detectado: tentar IA fallback antes do fallback padrao
          const iaResultPNL = await tentarIAFallback('pedido_nao_localizado', text, metadataAtualPNL);
          if (iaResultPNL.acao_mapeada === 'transferir_humano') {
            const resposta = respostaTransferidoHumanoSemDocumentoRelocalizacao();
            const novoMetadata = await construirMetadataComResposta({
              sessaoId,
              metadataAtual: { ...(metadataAtualPNL ?? {}), ...iaResultPNL.metadata_ia, precisa_humano_por_regra: true, motivo_transferencia_humano: 'ia_fallback' },
              resposta,
              estado: 'transferido_humano',
              contactId,
              ticketId,
              digisacMessageId: messageId,
              telefoneAutorizado: telefoneAutorizadoFlagPNL,
            });
            await supabase.from('atendimento_automatico_sessoes').update({
              estado: 'transferido_humano', status: 'transferido_humano',
              metadata: novoMetadata,
              ultima_mensagem_cliente: text.substring(0, 200),
              ultima_mensagem_em: new Date().toISOString(), updated_at: new Date().toISOString(),
            }).eq('id', sessaoId);
            await supabase.from('atendimento_automatico_mensagens').insert({
              sessao_id: sessaoId, digisac_message_id: messageId, digisac_ticket_id: ticketId,
              digisac_contact_id: contactId ?? null, origem: 'cliente', texto: text,
              tipo_mensagem: msg.type as string | undefined,
              timestamp_digisac: msg.timestamp ? new Date(msg.timestamp as number).toISOString() : null,
              status: 'processada', metadata: { serviceId, departmentId, ia_fallback: true, transferido: true },
            });
            console.log(`[posvenda-webhook] IA fallback transferiu humano (pedido_nao_localizado) sessaoId=${sessaoId}`);
            return { ok: true, saved: true, origem: 'cliente' };
          }

          const tentativasPNL = calcularTentativasInvalidas(metadataAtualPNL, 'pedido_nao_localizado');
          const transferirPNL = tentativasPNL >= 2;
          const respostaPNL = transferirPNL
            ? respostaTransferidoHumanoSemDocumentoRelocalizacao()
            : respostaPedidoNaoLocalizado();

          const novoMetadataPNL = await construirMetadataComResposta({
            sessaoId,
            metadataAtual: {
              ...(metadataAtualPNL ?? {}),
              ...iaResultPNL.metadata_ia,
              tentativas_invalidas_estado: tentativasPNL,
              tentativas_invalidas_ultimo_estado: 'pedido_nao_localizado',
              ultima_resposta_invalida_em: new Date().toISOString(),
              ...(transferirPNL ? {
                precisa_humano_por_regra: true,
                motivo_transferencia_humano: 'sem_documento_pedido_nao_localizado',
              } : {}),
            },
            resposta: respostaPNL,
            estado: transferirPNL ? 'transferido_humano' : 'pedido_nao_localizado',
            contactId,
            ticketId,
            digisacMessageId: messageId,
            telefoneAutorizado: telefoneAutorizadoFlagPNL,
          });

          await supabase.from('atendimento_automatico_sessoes').update({
            ...(transferirPNL ? { estado: 'transferido_humano', status: 'transferido_humano' } : {}),
            metadata: novoMetadataPNL,
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
            metadata: { serviceId, departmentId, tentativas_invalidas_estado: tentativasPNL, transferido_humano: transferirPNL },
          });

          if (transferirPNL) {
            await supabase.from('atendimento_automatico_eventos').insert({
              sessao_id: sessaoId,
              tipo: 'transferido_humano_sem_documento',
              descricao: 'Transferido para humano apos 2 tentativas sem CPF/CNPJ em pedido_nao_localizado',
              metadata: { tentativas: tentativasPNL, motivo: 'sem_documento_pedido_nao_localizado' },
            });
          }

          console.log(`[posvenda-webhook] pedido_nao_localizado sem documento tentativas=${tentativasPNL} transferir=${transferirPNL} sessaoId=${sessaoId}`);
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
