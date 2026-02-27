import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { parseStringPromise } from "xml2js";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────

interface NFeItem {
  n_item: string;
  codigo_produto: string;
  descricao: string;
  quantidade: string;
  ncm: string;
  cfop: string;
}

interface NFeData {
  message_id: string;
  numero_nf: string;
  data_emissao: string;
  peso_total: string;
  volumes_total: string;
  obs: string;
  is_os: boolean;
  assistencias: string[];
  itens: NFeItem[];
}

// ─────────────────────────────────────────────────────────
// 1.0 – Validação de entrada
// ─────────────────────────────────────────────────────────

function validarEntrada(body: Record<string, unknown>): string | null {
  const { inicio, fim } = body;

  if (!inicio || typeof inicio !== "string") {
    return "Campo 'inicio' é obrigatório (formato YYYY-MM-DD).";
  }
  if (!fim || typeof fim !== "string") {
    return "Campo 'fim' é obrigatório (formato YYYY-MM-DD).";
  }

  const rgx = /^\d{4}-\d{2}-\d{2}$/;
  if (!rgx.test(inicio)) return "'inicio' deve estar no formato YYYY-MM-DD.";
  if (!rgx.test(fim)) return "'fim' deve estar no formato YYYY-MM-DD.";

  const dtInicio = new Date(inicio);
  const dtFim = new Date(fim);

  if (isNaN(dtInicio.getTime())) return "'inicio' é uma data inválida.";
  if (isNaN(dtFim.getTime())) return "'fim' é uma data inválida.";
  if (dtFim < dtInicio) return "'fim' deve ser maior ou igual a 'inicio'.";

  const diffMs = dtFim.getTime() - dtInicio.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 90) return "O intervalo máximo permitido é de 90 dias.";

  return null;
}

// ─────────────────────────────────────────────────────────
// 2.0 – Autenticação JWT (Service Account + Domain-Wide)
// ─────────────────────────────────────────────────────────

function criarClienteGmail() {
  const serviceEmail = process.env.GMAIL_SERVICE_EMAIL;
  const privateKeyRaw = process.env.GMAIL_PRIVATE_KEY;
  const subjectUser = process.env.GMAIL_IMPERSONATE_USER || "lucas@lebebe.com.br";

  if (!serviceEmail || !privateKeyRaw) {
    throw new Error("Variáveis GMAIL_SERVICE_EMAIL e GMAIL_PRIVATE_KEY são obrigatórias.");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const jwtClient = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    subject: subjectUser,
  });

  return google.gmail({ version: "v1", auth: jwtClient });
}

// ─────────────────────────────────────────────────────────
// 3.0 – Listar mensagens
// ─────────────────────────────────────────────────────────

async function listarMensagens(
  gmail: ReturnType<typeof google.gmail>,
  query: string
) {
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      pageToken,
      maxResults: 100,
    });

    if (res.data.messages) {
      for (const m of res.data.messages) {
        if (m.id) messageIds.push(m.id);
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return messageIds;
}

// ─────────────────────────────────────────────────────────
// 4.0 – Helpers: varredura recursiva + decode base64url
// ─────────────────────────────────────────────────────────

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
}

function coletarPartsRecursivo(payload: GmailPart): GmailPart[] {
  const collected: GmailPart[] = [];

  if (payload.filename || payload.body?.attachmentId) {
    collected.push(payload);
  }

  if (payload.parts) {
    for (const child of payload.parts) {
      collected.push(...coletarPartsRecursivo(child));
    }
  }

  return collected;
}

function decodeBase64Url(data: string): Buffer {
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad === 2) base64 += "==";
  else if (pad === 3) base64 += "=";
  return Buffer.from(base64, "base64");
}

function isXmlPart(part: GmailPart): boolean {
  const filename = (part.filename ?? "").toLowerCase();
  const mime = (part.mimeType ?? "").toLowerCase();
  return filename.endsWith(".xml") || mime.includes("xml");
}

// ─────────────────────────────────────────────────────────
// 4.1 – Baixar attachments XML
// ─────────────────────────────────────────────────────────

interface AttachmentResult {
  messageId: string;
  filename: string;
  xmlContent: string;
}

async function baixarAttachmentsXml(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<AttachmentResult[]> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
  });

  const allParts = coletarPartsRecursivo(
    (msg.data.payload as GmailPart) ?? {}
  );
  const xmlParts = allParts.filter(
    (p) => isXmlPart(p) && p.body?.attachmentId
  );

  console.log(
    `[NFE][GMAIL] Mensagem ${messageId}: xml_attachments=${xmlParts.length}`
  );

  const results: AttachmentResult[] = [];

  for (const part of xmlParts) {
    const attachmentId = part.body!.attachmentId!;
    const filename = part.filename ?? "attachment.xml";

    const att = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const base64Data = att.data.data;
    if (!base64Data) continue;

    const buffer = decodeBase64Url(base64Data);
    const xmlContent = buffer.toString("utf-8");

    results.push({ messageId, filename, xmlContent });
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// 5.0 – Parse XML da NFe
// ─────────────────────────────────────────────────────────

async function parsearNFe(
  xmlContent: string,
  messageId: string
): Promise<NFeData> {
  const parsed = await parseStringPromise(xmlContent, {
    explicitArray: false,
    ignoreAttrs: false,
    tagNameProcessors: [(name: string) => name.replace(/^.*:/, "")],
  });

  // Navegar até a tag <infNFe> (pode estar em nfeProc > NFe > infNFe ou NFe > infNFe)
  const nfeProc = parsed.nfeProc ?? parsed;
  const nfe = nfeProc.NFe ?? nfeProc;
  const infNFe = nfe.infNFe;

  if (!infNFe) {
    throw new Error("Tag <infNFe> não encontrada no XML.");
  }

  const ide = infNFe.ide ?? {};
  const transp = infNFe.transp ?? {};
  const vol = transp.vol ?? {};
  const infAdic = infNFe.infAdic ?? {};

  // número NF
  const numero_nf = ide.nNF ?? "";

  // data emissão
  const data_emissao = ide.dhEmi ?? ide.dEmi ?? "";

  // peso total
  const peso_total = vol.pesoB ?? vol.pesoL ?? "0";

  // volumes total
  const volumes_total = vol.qVol ?? "0";

  // observações (infCpl)
  const obs = infAdic.infCpl ?? "";

  // is_os: baseado em natOp (natureza da operação)
  const natOp = String(ide.natOp ?? "").toUpperCase();
  const is_os = natOp === "ASSIST.TECNICA";

  // itens
  const detRaw = infNFe.det;
  const detArray = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const itens: NFeItem[] = detArray.map(
    (det: Record<string, Record<string, unknown>>) => {
      const prod = (det.prod ?? {}) as Record<string, unknown>;
      return {
        n_item: (det.$ as Record<string, string>)?.nItem ?? "",
        codigo_produto: String(prod.cProd ?? ""),
        descricao: String(prod.xProd ?? ""),
        quantidade: String(prod.qCom ?? prod.qTrib ?? ""),
        ncm: String(prod.NCM ?? ""),
        cfop: String(prod.CFOP ?? ""),
      };
    }
  );

  // Extrair números de OS/OC das observações (com word boundary para evitar "PRODUTOS: 871")
  const assistencias: string[] = [];
  const obsStr = String(obs);
  
  // Regex com \b (word boundary) para evitar falsos positivos
  const regexOS = /\bO\.?\s*S\.?\s*[:\-]?\s*(\d+)\b/gi;
  const regexOC = /\bO\s*C\s*[:\-]?\s*(\d+)\b/gi;
  
  const encontrados: string[] = [];
  let osMatch;
  
  while ((osMatch = regexOS.exec(obsStr)) !== null) {
    if (osMatch[1]) encontrados.push(osMatch[1]);
  }
  
  while ((osMatch = regexOC.exec(obsStr)) !== null) {
    if (osMatch[1]) encontrados.push(osMatch[1]);
  }
  
  // Dedupe: remover duplicados
  const vistos = new Set<string>();
  for (const num of encontrados) {
    const soDigitos = num.replace(/\D/g, "");
    if (soDigitos && !vistos.has(soDigitos)) {
      vistos.add(soDigitos);
      assistencias.push(soDigitos);
    }
  }

  return {
    message_id: messageId,
    numero_nf: String(numero_nf),
    data_emissao: String(data_emissao),
    peso_total: String(peso_total),
    volumes_total: String(volumes_total),
    obs: String(obs),
    is_os,
    assistencias,
    itens,
  };
}

// ─────────────────────────────────────────────────────────
// 6.0 / 7.0 – Handler da rota POST
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log("[NFE][GMAIL] Início da rota POST /api/nfe/importar");

  try {
    // 1.0 – Validação
    const body = await request.json();
    const erroValidacao = validarEntrada(body);
    if (erroValidacao) {
      console.log("[NFE][GMAIL] Erro de validação:", erroValidacao);
      return NextResponse.json({ ok: false, erro: erroValidacao }, { status: 400 });
    }

    const { inicio, fim } = body as { inicio: string; fim: string };

    // Formatar datas para a query do Gmail (YYYY/MM/DD)
    const afterDate = inicio.replace(/-/g, "/");

    // Somar 1 dia ao "before" porque o Gmail usa before como exclusive
    // Usar string math para evitar bug de timezone (Date local vs UTC)
    const [yStr, mStr, dStr] = fim.split("-");
    const tmpDate = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr) + 1));
    const beforeDatePlusOne = `${tmpDate.getUTCFullYear()}/${String(tmpDate.getUTCMonth() + 1).padStart(2, "0")}/${String(tmpDate.getUTCDate()).padStart(2, "0")}`;

    const query = `from:nfe@maticmoveis.com.br subject:"Nota Fiscal Eletronica" after:${afterDate} before:${beforeDatePlusOne} has:attachment`;
    console.log("[NFE][GMAIL] Query:", query);

    // 2.0 – Autenticação
    const gmail = criarClienteGmail();

    // 3.0 – Listar mensagens
    const messageIds = await listarMensagens(gmail, query);
    console.log("[NFE][GMAIL] Total mensagens encontradas:", messageIds.length);

    // 4.0 + 5.0 – Processar cada mensagem
    const nfs: NFeData[] = [];
    const erros: { message_id: string; erro: string }[] = [];

    for (const msgId of messageIds) {
      try {
        const attachments = await baixarAttachmentsXml(gmail, msgId);

        if (attachments.length === 0) {
          erros.push({ message_id: msgId, erro: "Nenhum anexo XML encontrado." });
          continue;
        }

        for (const att of attachments) {
          try {
            const nfeData = await parsearNFe(att.xmlContent, msgId);
            nfs.push(nfeData);
          } catch (parseErr) {
            const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
            erros.push({ message_id: msgId, erro: `Erro ao parsear ${att.filename}: ${msg}` });
          }
        }
      } catch (msgErr) {
        const msg = msgErr instanceof Error ? msgErr.message : String(msgErr);
        erros.push({ message_id: msgId, erro: msg });
      }
    }

    console.log("[NFE][GMAIL] Total NFs processadas:", nfs.length);
    if (erros.length > 0) {
      console.log("[NFE][GMAIL] Erros encontrados:", erros.length);
    }

    // 5.5 – Persistir no Supabase (upsert nfe + nfe_itens)
    const supabase = await createClient();
    let salvas = 0;

    for (const nf of nfs) {
      try {
        const numeroNfNorm = nf.numero_nf.replace(/\D/g, "");
        const dataEmissaoDate = String(nf.data_emissao).substring(0, 10);

        const { data: nfeRow, error: nfeError } = await supabase
          .from("nfe")
          .upsert(
            {
              numero_nf: numeroNfNorm,
              data_emissao: dataEmissaoDate,
              peso_total: parseFloat(nf.peso_total) || 0,
              volumes_total: parseInt(nf.volumes_total) || 0,
              obs: nf.obs || null,
              is_os: nf.is_os,
            },
            { onConflict: "numero_nf" }
          )
          .select()
          .single();

        if (nfeError) {
          console.error(`[NFE][GMAIL] Erro upsert NF ${numeroNfNorm}:`, nfeError.message);
          erros.push({ message_id: nf.message_id, erro: `Supabase upsert NF: ${nfeError.message}` });
          continue;
        }

        // Limpar itens antigos e reinserir
        await supabase.from("nfe_itens").delete().eq("nfe_id", nfeRow.id);

        for (const item of nf.itens) {
          const { data: sku } = await supabase
            .from("matic_sku")
            .select("volumes_por_item")
            .eq("codigo_produto", item.codigo_produto)
            .single();

          const volumesPorItem = sku?.volumes_por_item || 1;
          const qtd = Math.round(parseFloat(item.quantidade) || 0);
          const volumesPrevistosTotal = qtd * volumesPorItem;

          await supabase.from("nfe_itens").insert({
            nfe_id: nfeRow.id,
            n_item: parseInt(item.n_item) || null,
            codigo_produto: item.codigo_produto,
            descricao: item.descricao,
            quantidade: qtd,
            volumes_por_item: volumesPorItem,
            volumes_previstos_total: volumesPrevistosTotal,
            status: "pendente",
          });
        }

        // Salvar assistências (OS/OC)
        if (nf.assistencias.length > 0) {
          await supabase.from("nfe_assistencias").delete().eq("nfe_id", nfeRow.id);
          for (const os of nf.assistencias) {
            await supabase.from("nfe_assistencias").insert({
              nfe_id: nfeRow.id,
              os_oc_numero: os,
            });
          }
        }

        salvas++;
        console.log(`[NFE][GMAIL] NF ${numeroNfNorm} salva: ${nf.itens.length} itens, ${nf.assistencias.length} OS`);
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        erros.push({ message_id: nf.message_id, erro: `DB: ${msg}` });
      }
    }

    console.log(`[NFE][GMAIL] Total NFs salvas no banco: ${salvas}/${nfs.length}`);

    // 6.0 – Resposta final
    return NextResponse.json({
      ok: true,
      query,
      total_mensagens: messageIds.length,
      total_salvas: salvas,
      nfs,
      erros,
    });
  } catch (err) {
    // 7.0 – Tratamento de erros genérico
    const message = err instanceof Error ? err.message : "Erro interno desconhecido.";
    console.error("[NFE][GMAIL] Erro fatal:", message);
    return NextResponse.json({ ok: false, erro: message }, { status: 500 });
  }
}
