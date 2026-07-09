// ia-fallback.ts
// Camada de IA fallback controlada para o atendimento automatico pos-venda (Mere).
// So e chamada quando o fluxo deterministico nao consegue interpretar a mensagem.
// A IA so pode escolher acoes permitidas pelo estado atual. Nunca inventa fluxos.

export type AcaoIA =
  | 'confirmar'
  | 'negar'
  | 'adiantar'
  | 'postergar'
  | 'endereco_correto'
  | 'endereco_incorreto'
  | 'data_informada'
  | 'opcao_data_escolhida'
  | 'pedir_documento'
  | 'documento_informado'
  | 'pedir_esclarecimento'
  | 'transferir_humano'
  | 'nenhuma_acao_segura';

export type ConfiancaIA = 'alta' | 'media' | 'baixa';

export type DecisaoIA = {
  acao: AcaoIA;
  confianca: ConfiancaIA;
  mensagem_cliente: string;
  motivo: string;
  dados_extraidos: Record<string, unknown>;
  modelo_ia: string;
  mensagem_sugerida?: string;
};

export type ContextoSessaoIA = {
  estado: string;
  tipo_solicitacao: string | null;
  mensagem_cliente: string;
  opcoes_datas?: { indice: number; dataBR: string }[];
  data_original_br?: string;
  data_nova_br?: string;
  pedido_localizado?: boolean;
  acoes_permitidas: AcaoIA[];
};

const ACOES_VALIDAS: ReadonlySet<string> = new Set<AcaoIA>([
  'confirmar',
  'negar',
  'adiantar',
  'postergar',
  'endereco_correto',
  'endereco_incorreto',
  'data_informada',
  'opcao_data_escolhida',
  'pedir_documento',
  'documento_informado',
  'pedir_esclarecimento',
  'transferir_humano',
  'nenhuma_acao_segura',
]);

function iaHabilitada(): boolean {
  return process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED === 'true';
}

function obterApiKey(): string | null {
  return process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY ?? null;
}

function obterModelo(): string {
  return process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_MODEL || 'deepseek-v4-flash';
}

function obterBaseUrl(): string {
  return process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_BASE_URL || 'https://api.deepseek.com';
}

function obterProvider(): string {
  return process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER || 'deepseek';
}

function mascararDocumento(texto: string): string {
  return texto.replace(/\d{3}[\d.\-/]{5,}\d{2}/g, '[documento]');
}

function montarPromptSistema(acoesPermitidas: AcaoIA[]): string {
  const acoesLista = acoesPermitidas.join(', ');
  return `Voce e uma camada de interpretacao da Mere, assistente pos-venda da loja Le Bebe.
Sua unica funcao e interpretar a mensagem do cliente e escolher UMA acao permitida.

REGRAS OBRIGATORIAS:
- Voce so pode escolher uma das seguintes acoes: ${acoesLista}
- Se nao tiver certeza, escolha "transferir_humano" ou "pedir_esclarecimento" (conforme disponivel).
- NAO invente dados.
- NAO prometa reagendamento.
- NAO prometa horario especifico.
- NAO diga que pedido foi localizado se o sistema nao localizou.
- NAO ignore bloqueios.
- NAO crie novas datas.
- NAO mencione sistemas internos (Google Calendar, OSRM, planilhas, motor, etc).
- NAO invente status de pedido, produto ou pagamento.

Retorne SOMENTE um JSON valido com este schema:
{
  "acao": "<uma das acoes permitidas>",
  "confianca": "alta" | "media" | "baixa",
  "mensagem_cliente": "<resumo curto do que o cliente disse>",
  "motivo": "<explicacao curta da decisao>",
  "dados_extraidos": {},
  "mensagem_sugerida": "<mensagem opcional para o cliente, max 500 chars, apenas se util>"
}

A "mensagem_sugerida" so deve ser usada para pedir esclarecimento, orientar a enviar CPF/CNPJ, ou explicar que vai encaminhar para a equipe.
Para confirmacoes, bloqueios, sucesso ou erro de reagendamento, DEIXE "mensagem_sugerida" vazia (o sistema usa mensagens padrao).`;
}

function montarPromptUsuario(ctx: ContextoSessaoIA): string {
  const partes: string[] = [
    `Estado atual: ${ctx.estado}`,
    `Tipo de solicitacao: ${ctx.tipo_solicitacao ?? 'nao_definido'}`,
    `Acoes permitidas: ${ctx.acoes_permitidas.join(', ')}`,
    `Mensagem do cliente: "${mascararDocumento(ctx.mensagem_cliente)}"`,
  ];

  if (ctx.pedido_localizado !== undefined) {
    partes.push(`Pedido localizado: ${ctx.pedido_localizado ? 'sim' : 'nao'}`);
  }
  if (ctx.data_original_br) {
    partes.push(`Data original: ${ctx.data_original_br}`);
  }
  if (ctx.data_nova_br) {
    partes.push(`Data nova selecionada: ${ctx.data_nova_br}`);
  }
  if (ctx.opcoes_datas && ctx.opcoes_datas.length > 0) {
    const opcoes = ctx.opcoes_datas.map((o) => `${o.indice} - ${o.dataBR}`).join(', ');
    partes.push(`Opcoes de data disponiveis: ${opcoes}`);
  }

  return partes.join('\n');
}

function extrairJSON(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continua
  }
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      // continua
    }
  }
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // continua
    }
  }
  throw new Error(`IA fallback retornou texto nao-JSON (${raw.length} chars)`);
}

function validarDecisao(raw: unknown, acoesPermitidas: AcaoIA[], modelo: string): DecisaoIA {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Resposta da IA nao e um objeto JSON');
  }

  const obj = raw as Record<string, unknown>;

  const acaoRaw = String(obj.acao ?? '');
  if (!ACOES_VALIDAS.has(acaoRaw)) {
    throw new Error(`Acao "${acaoRaw}" nao esta na lista de acoes validas`);
  }
  if (!acoesPermitidas.includes(acaoRaw as AcaoIA)) {
    throw new Error(`Acao "${acaoRaw}" nao esta nas acoes permitidas para este estado`);
  }

  const confiancaRaw = String(obj.confianca ?? 'baixa');
  const confianca: ConfiancaIA =
    confiancaRaw === 'alta' || confiancaRaw === 'media' ? (confiancaRaw as ConfiancaIA) : 'baixa';

  const mensagemSugerida = typeof obj.mensagem_sugerida === 'string' ? obj.mensagem_sugerida : '';
  if (mensagemSugerida.length > 500) {
    throw new Error('mensagem_sugerida excede 500 caracteres');
  }

  const dadosExtraidos =
    obj.dados_extraidos && typeof obj.dados_extraidos === 'object'
      ? (obj.dados_extraidos as Record<string, unknown>)
      : {};

  return {
    acao: acaoRaw as AcaoIA,
    confianca,
    mensagem_cliente: String(obj.mensagem_cliente ?? '').substring(0, 200),
    motivo: String(obj.motivo ?? '').substring(0, 300),
    dados_extraidos: dadosExtraidos,
    modelo_ia: modelo,
    mensagem_sugerida: mensagemSugerida || undefined,
  };
}

async function chamarDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 400) {
        // Retentar sem response_format
        const bodySemFormat = { ...body };
        delete bodySemFormat.response_format;
        const res2 = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodySemFormat),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res2.ok) {
          throw new Error(`DeepSeek API erro ${res2.status}: ${errBody.slice(0, 200)}`);
        }
        const data2 = await res2.json();
        const content2 = data2?.choices?.[0]?.message?.content;
        if (typeof content2 !== 'string' || content2.trim() === '') {
          throw new Error('DeepSeek retornou conteudo vazio (sem response_format)');
        }
        return content2;
      }
      throw new Error(`DeepSeek API erro ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error('DeepSeek retornou conteudo vazio');
    }

    return content;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export type ResultadoIAFallback =
  | { ok: true; decisao: DecisaoIA }
  | { ok: false; erro: string; codigo: string };

export async function interpretarComIA(ctx: ContextoSessaoIA): Promise<ResultadoIAFallback> {
  if (!iaHabilitada()) {
    return { ok: false, erro: 'IA fallback desabilitada por env', codigo: 'ia_desabilitada' };
  }

  const apiKey = obterApiKey();
  if (!apiKey) {
    return { ok: false, erro: 'API key especifica nao configurada', codigo: 'api_key_especifica_ausente' };
  }

  const model = obterModelo();
  const baseUrl = obterBaseUrl();
  const provider = obterProvider();

  if (provider !== 'deepseek') {
    return { ok: false, erro: `Provider "${provider}" nao suportado`, codigo: 'provider_nao_suportado' };
  }

  const systemPrompt = montarPromptSistema(ctx.acoes_permitidas);
  const userPrompt = montarPromptUsuario(ctx);

  let raw: string;
  try {
    raw = await chamarDeepSeek(systemPrompt, userPrompt, model, apiKey, baseUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ia-fallback] erro na chamada DeepSeek: ${msg}`);
    return { ok: false, erro: msg, codigo: 'erro_api' };
  }

  let parsed: unknown;
  try {
    parsed = extrairJSON(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ia-fallback] JSON invalido: ${msg}`);
    return { ok: false, erro: msg, codigo: 'json_invalido' };
  }

  try {
    const decisao = validarDecisao(parsed, ctx.acoes_permitidas, model);
    console.log(`[ia-fallback] ok acao=${decisao.acao} confianca=${decisao.confianca} modelo=${model}`);
    return { ok: true, decisao };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ia-fallback] validacao falhou: ${msg}`);
    return { ok: false, erro: msg, codigo: 'acao_invalida' };
  }
}

export function iaFallbackHabilitada(): boolean {
  return iaHabilitada();
}

export function metadataIAFallback(decisao: DecisaoIA | null, erro: ResultadoIAFallback | null): Record<string, unknown> {
  if (erro && !erro.ok) {
    return {
      ia_fallback_chamada: true,
      ia_fallback_erro: erro.codigo,
      ia_fallback_provider: obterProvider(),
      ia_fallback_model: obterModelo(),
    };
  }
  if (decisao) {
    return {
      ia_fallback_chamada: true,
      ia_fallback_em: new Date().toISOString(),
      ia_fallback_estado: '',
      ia_fallback_acao: decisao.acao,
      ia_fallback_confianca: decisao.confianca,
      ia_fallback_motivo_resumido: decisao.motivo.substring(0, 100),
      ia_fallback_usada_para_resposta: true,
      ia_fallback_model: decisao.modelo_ia,
    };
  }
  return {
    ia_fallback_chamada: false,
    ia_fallback_erro: 'ia_desabilitada',
  };
}

// ---------------------------------------------------------------------------
// Integracao com webhook-processor: mapeia acao IA -> acao deterministica
// ---------------------------------------------------------------------------

function acoesPermitidasPorEstado(estado: string): AcaoIA[] {
  switch (estado) {
    case 'aguardando_confirmacao_pedido':
      return ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'];
    case 'aguardando_escolha_acao':
      return ['adiantar', 'postergar', 'transferir_humano', 'pedir_esclarecimento'];
    case 'aguardando_confirmacao_endereco':
      return ['endereco_correto', 'endereco_incorreto', 'transferir_humano', 'pedir_esclarecimento'];
    case 'aguardando_data_desejada':
      return ['data_informada', 'pedir_esclarecimento', 'transferir_humano'];
    case 'datas_encontradas':
      return ['opcao_data_escolhida', 'pedir_esclarecimento', 'transferir_humano'];
    case 'aguardando_confirmacao_reagendamento':
      return ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'];
    case 'pedido_nao_localizado':
    case 'aguardando_novo_documento_ou_esclarecimento':
      return ['documento_informado', 'pedir_documento', 'transferir_humano', 'pedir_esclarecimento'];
    default:
      return ['transferir_humano'];
  }
}

export type ResultadoIANormalizado = {
  usada: boolean;
  acao_mapeada: string | null;
  dados_extraidos: Record<string, unknown> | null;
  decisao: DecisaoIA | null;
  erro_codigo: string | null;
  metadata_ia: Record<string, unknown>;
};

export async function tentarIAFallback(
  estado: string,
  text: string,
  metadata: Record<string, unknown> | null,
): Promise<ResultadoIANormalizado> {
  const acoes = acoesPermitidasPorEstado(estado);

  const ctx: ContextoSessaoIA = {
    estado,
    tipo_solicitacao: (metadata?.tipo_solicitacao as string) ?? null,
    mensagem_cliente: text,
    acoes_permitidas: acoes,
    pedido_localizado: metadata?.busca_agenda_status === 'encontrado',
  };

  if (metadata?.data_original_br) ctx.data_original_br = metadata.data_original_br as string;
  if (metadata?.data_nova_br) ctx.data_nova_br = metadata.data_nova_br as string;
  if (metadata?.data_opcao_selecionada_br && !ctx.data_nova_br) {
    ctx.data_nova_br = metadata.data_opcao_selecionada_br as string;
  }

  const datasDisponiveis = metadata?.datas_disponiveis as
    | { dataBR?: string; dataISO?: string }[]
    | undefined;
  if (datasDisponiveis && Array.isArray(datasDisponiveis)) {
    ctx.opcoes_datas = datasDisponiveis.map((d, i) => ({
      indice: i + 1,
      dataBR: d.dataBR ?? '',
    }));
  }

  const result = await interpretarComIA(ctx);

  if (!result.ok) {
    return {
      usada: true,
      acao_mapeada: null,
      dados_extraidos: null,
      decisao: null,
      erro_codigo: result.codigo,
      metadata_ia: {
        ia_fallback_chamada: true,
        ia_fallback_erro: result.codigo,
        ia_fallback_provider: obterProvider(),
        ia_fallback_model: obterModelo(),
        ia_fallback_estado: estado,
      },
    };
  }

  const d = result.decisao;

  if (d.confianca === 'baixa') {
    return {
      usada: true,
      acao_mapeada: null,
      dados_extraidos: d.dados_extraidos,
      decisao: d,
      erro_codigo: 'confianca_baixa',
      metadata_ia: {
        ia_fallback_chamada: true,
        ia_fallback_em: new Date().toISOString(),
        ia_fallback_estado: estado,
        ia_fallback_acao: d.acao,
        ia_fallback_confianca: d.confianca,
        ia_fallback_motivo_resumido: d.motivo.substring(0, 100),
        ia_fallback_usada_para_resposta: false,
        ia_fallback_model: d.modelo_ia,
        ia_fallback_erro: 'confianca_baixa',
      },
    };
  }

  const mapeamento: Record<AcaoIA, string | null> = {
    confirmar: 'confirmar',
    negar: 'negar',
    adiantar: 'adiantar',
    postergar: 'postergar',
    endereco_correto: 'confirmar',
    endereco_incorreto: 'negar',
    data_informada: 'data_informada',
    opcao_data_escolhida: 'opcao_data_escolhida',
    pedir_documento: 'pedir_documento',
    documento_informado: 'documento_informado',
    pedir_esclarecimento: null,
    transferir_humano: 'transferir_humano',
    nenhuma_acao_segura: null,
  };

  const acaoMapeada = mapeamento[d.acao] ?? null;

  return {
    usada: true,
    acao_mapeada: acaoMapeada,
    dados_extraidos: d.dados_extraidos,
    decisao: d,
    erro_codigo: null,
    metadata_ia: {
      ia_fallback_chamada: true,
      ia_fallback_em: new Date().toISOString(),
      ia_fallback_estado: estado,
      ia_fallback_acao: d.acao,
      ia_fallback_confianca: d.confianca,
      ia_fallback_motivo_resumido: d.motivo.substring(0, 100),
      ia_fallback_usada_para_resposta: acaoMapeada !== null,
      ia_fallback_model: d.modelo_ia,
    },
  };
}
