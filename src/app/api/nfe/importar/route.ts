import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { createHash } from "node:crypto";
import { lerEmailComRepeticao, falhaTemporariaEmail } from "@/lib/recebimento/email-retry";
import { XmlImportError, XML_MAX_BYTES } from "@/lib/recebimento/xml-upload";
import { notaDoEmail } from "@/lib/recebimento/email-nfe";
import { sha256Xml } from "@/lib/google/drive-xml";
import { parsearNFe, type NFeData } from "@/lib/recebimento/nfe-parser";
import { validateMaticUser } from "@/lib/auth/matic-auth";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const maxDuration = 120;
const GOOGLE_READ_OPTIONS = { timeout: 15000, retry: false } as const;

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

function criarClienteGmail(subject?: string) {
  const serviceEmail = process.env.GMAIL_SERVICE_EMAIL;
  const privateKeyRaw = process.env.GMAIL_PRIVATE_KEY;
  const subjectUser = subject ?? process.env.GMAIL_IMPERSONATE_USER ?? "lucas@lebebe.com.br";

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
    const res = await lerEmailComRepeticao(() => gmail.users.messages.list({
      userId: "me",
      q: query,
      pageToken,
      maxResults: 100,
    }, GOOGLE_READ_OPTIONS));

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

async function listarAttachmentsXml(gmail: ReturnType<typeof google.gmail>, messageId: string): Promise<GmailPart[]> {
  const msg = await lerEmailComRepeticao(() => gmail.users.messages.get({ userId: "me", id: messageId }, GOOGLE_READ_OPTIONS));
  return coletarPartsRecursivo((msg.data.payload as GmailPart) ?? {}).filter(part => isXmlPart(part) && part.body?.attachmentId);
}

// ─────────────────────────────────────────────────────────
// 5.0 – Parse XML da NFe
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// 6.0 / 7.0 – Handler da rota POST
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log("[NFE][GMAIL] Início da rota POST /api/nfe/importar");

  try {
    const auth = await validateMaticUser();
    if (!auth.authorized) {
      return NextResponse.json({ ok: false, erro: "Acesso negado" }, { status: 403 });
    }

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
    let messageIds = await listarMensagens(gmail, query);
    console.log("[NFE][GMAIL] Total mensagens encontradas:", messageIds.length);

    // 3.1 – Fallback: tentar posvenda@lebebe.com.br se não encontrou nada
    let gmailAtivo = gmail;
    let mailbox = process.env.GMAIL_IMPERSONATE_USER ?? "lucas@lebebe.com.br";
    if (messageIds.length === 0) {
      const fallbackEmail = "posvenda@lebebe.com.br";
      console.log(`[NFE][GMAIL] Nenhuma mensagem encontrada. Tentando fallback: ${fallbackEmail}`);
      const gmailFallback = criarClienteGmail(fallbackEmail);
      const fallbackIds = await listarMensagens(gmailFallback, query);
      console.log(`[NFE][GMAIL] Mensagens encontradas no fallback (${fallbackEmail}):`, fallbackIds.length);
      if (fallbackIds.length > 0) {
        messageIds = fallbackIds;
        gmailAtivo = gmailFallback;
        mailbox = fallbackEmail;
      }
    }

    // O comprovante só é gravado na mesma transação que confirma nota e itens.
    const supabase = await createClient();
    const nfs: NFeData[] = [];
    const erros: { message_id: string; erro: string }[] = [];
    let salvas = 0, ignorados = 0;
    for (const msgId of messageIds) {
      let parts: GmailPart[];
      try { parts = await listarAttachmentsXml(gmailAtivo, msgId); }
      catch { erros.push({ message_id: msgId, erro: "Não foi possível ler uma das mensagens após as tentativas permitidas." }); continue; }
      if (!parts.length) { erros.push({ message_id: msgId, erro: "Nenhum anexo XML encontrado." }); continue; }
      for (const part of parts) {
        try {
          const attachmentId = part.body!.attachmentId!;
          const origem = createHash('sha256').update(JSON.stringify([mailbox.toLowerCase(), msgId, attachmentId])).digest('hex');
          const { data: processado, error: cacheError } = await supabase.from('nfe_email_anexos').select('nfe_id').eq('origem_sha256', origem).maybeSingle();
          if (cacheError) throw new Error('controle_email');
          if (processado) { ignorados++; continue; }
          const att = await lerEmailComRepeticao(() => gmailAtivo.users.messages.attachments.get({ userId: "me", messageId: msgId, id: attachmentId }, GOOGLE_READ_OPTIONS));
          if (!att.data.data) throw new XmlImportError('anexo_vazio', 'O anexo XML está vazio.');
          const bytes = decodeBase64Url(att.data.data);
          if (bytes.length > XML_MAX_BYTES) throw new XmlImportError('anexo_grande', 'Um dos XMLs ultrapassa o tamanho permitido de 2 MB.');
          const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new XmlImportError('anexo_invalido', 'O anexo XML possui um formato que não pode ser importado.');
          const nf = await parsearNFe(xml, msgId);
          const nota = notaDoEmail(nf);
          const { data, error } = await supabase.rpc('importar_anexo_email_recebimento', { p_origem_sha256: origem, p_nota: nota, p_sha256: sha256Xml(bytes) });
          if (error || !data?.nfe_id) {
            console.error('[NFE EMAIL]', { etapa: 'cadastro', codigo: error?.code ?? 'nao_confirmado' });
            erros.push({ message_id: msgId, erro: error?.message?.includes('XML_CONFLITO') ? 'Uma nota já cadastrada possui dados diferentes. Nenhum dado foi substituído.' : 'Não foi possível confirmar uma das notas. Ela poderá ser verificada na próxima busca.' });
            continue;
          }
          salvas++;
          // Mantém o contrato usado pela tela de importação do Pós-venda.
          nfs.push(nf);
        } catch (error) {
          console.error('[NFE EMAIL]', { etapa: 'anexo', codigo: error instanceof XmlImportError ? error.code : 'leitura_ou_controle' });
          erros.push({ message_id: msgId, erro: error instanceof XmlImportError ? error.message : 'Não foi possível concluir um dos anexos. Os demais continuam disponíveis.' });
        }
      }
    }

    // 6.0 – Resposta final
    return NextResponse.json({
      ok: true,
      query,
      total_mensagens: messageIds.length,
      total_salvas: salvas,
      total_ignorados: ignorados,
      nfs,
      erros,
    });
  } catch (err) {
    // 7.0 – Tratamento de erros genérico
    console.error("[NFE EMAIL]", { etapa: "busca", temporario: falhaTemporariaEmail(err) });
    return NextResponse.json({ ok: false, erro: "Não foi possível concluir a busca por novas notas no e-mail. Você pode continuar com as notas já cadastradas." }, { status: 503 });
  }
}
