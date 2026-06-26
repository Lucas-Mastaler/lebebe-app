import { NextRequest, NextResponse } from "next/server";

import { validarBearerToken } from "@/lib/auth/bearer-auth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_000;

type AuditTipo = "geocoding" | "search_execution";

type PayloadResult =
  | { ok: true; table: "geocoding_audit" | "search_execution_audit"; record: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function respostaErro(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bodyTooLarge(request: NextRequest, body?: unknown) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) return true;

  if (body !== undefined) {
    return Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES;
  }

  return false;
}

function stringOrNull(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.slice(0, maxLength);
}

function requiredString(value: unknown, maxLength: number) {
  return stringOrNull(value, maxLength);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function integerOrNull(value: unknown) {
  const numeric = numberOrNull(value);
  return numeric === null ? null : Math.round(numeric);
}

function integerOrDefault(value: unknown, fallback: number) {
  const numeric = integerOrNull(value);
  return numeric === null ? fallback : numeric;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function isoOrNull(value: unknown) {
  const str = stringOrNull(value, 80);
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : str;
}

function uuidOrNull(value: unknown) {
  const str = stringOrNull(value, 36);
  if (!str) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
    ? str
    : null;
}

function buildGeocodingRecord(payload: Record<string, unknown>): PayloadResult {
  const chaveEndereco = requiredString(payload.chave_endereco, 500);
  if (!chaveEndereco || typeof payload.cache_hit !== "boolean") {
    return { ok: false, status: 400, error: "Payload invalido" };
  }

  return {
    ok: true,
    table: "geocoding_audit",
    record: {
      chave_endereco: chaveEndereco,
      endereco_completo: stringOrNull(payload.endereco_completo, 2_000),
      cache_hit: payload.cache_hit,
      provider: stringOrNull(payload.provider, 100) || "unknown",
      confidence: numberOrNull(payload.confidence),
      user_email: stringOrNull(payload.user_email, 320),
      origin: stringOrNull(payload.origin, 80) || "MODAL",
      duration_ms: integerOrNull(payload.duration_ms),
    },
  };
}

function buildSearchExecutionRecord(payload: Record<string, unknown>): PayloadResult {
  const totalDurationMs = integerOrNull(payload.total_duration_ms);
  if (totalDurationMs === null || totalDurationMs < 0) {
    return { ok: false, status: 400, error: "Payload invalido" };
  }

  const record: Record<string, unknown> = {
    origin: stringOrNull(payload.origin, 100) || "MODAL",
    user_email: stringOrNull(payload.user_email, 320),
    cep: stringOrNull(payload.cep, 20),
    endereco_pesquisado: stringOrNull(payload.endereco_pesquisado, 2_000),
    endereco_curto: stringOrNull(payload.endereco_curto, 500),
    tempo_necessario: stringOrNull(payload.tempo_necessario, 50),
    is_rural: booleanOrDefault(payload.is_rural, false),
    is_condominio: booleanOrDefault(payload.is_condominio, false),
    total_duration_ms: totalDurationMs,
    search_time_seconds: numberOrNull(payload.search_time_seconds),
    total_candidates: integerOrDefault(payload.total_candidates, 0),
    total_candidates_normal: integerOrDefault(payload.total_candidates_normal, 0),
    total_candidates_especial: integerOrDefault(payload.total_candidates_especial, 0),
    total_candidates_premium: integerOrDefault(payload.total_candidates_premium, 0),
    total_candidates_hora_marcada: integerOrDefault(payload.total_candidates_hora_marcada, 0),
    total_slots_processed: integerOrDefault(payload.total_slots_processed, 0),
    total_slots_available: integerOrDefault(payload.total_slots_available, 0),
    early_stop: booleanOrDefault(payload.early_stop, false),
    status: stringOrNull(payload.status, 50) || "success",
    error_message: stringOrNull(payload.error_message, 2_000),
    started_at: isoOrNull(payload.started_at),
    finished_at: isoOrNull(payload.finished_at),
  };

  const clientToken = stringOrNull(payload.client_token, 200);
  const motor = stringOrNull(payload.motor, 20);
  const rota = stringOrNull(payload.rota, 100);
  const tipoExecucao = stringOrNull(payload.tipo_execucao, 30);
  const runId = uuidOrNull(payload.run_id);

  if (clientToken) record.client_token = clientToken;
  if (motor) record.motor = motor;
  if (rota) record.rota = rota;
  if (tipoExecucao) record.tipo_execucao = tipoExecucao;
  if (runId) record.run_id = runId;

  return {
    ok: true,
    table: "search_execution_audit",
    record,
  };
}

function buildRecord(tipo: unknown, payload: unknown): PayloadResult {
  if (tipo !== "geocoding" && tipo !== "search_execution") {
    return { ok: false, status: 400, error: "Tipo invalido" };
  }

  if (!isRecord(payload)) {
    return { ok: false, status: 400, error: "Payload invalido" };
  }

  const auditTipo = tipo as AuditTipo;
  return auditTipo === "geocoding"
    ? buildGeocodingRecord(payload)
    : buildSearchExecutionRecord(payload);
}

export async function POST(request: NextRequest) {
  const auth = validarBearerToken(request, "AUDITORIA LEGADO");
  if (!auth.valido) {
    return respostaErro(401, "Nao autorizado");
  }

  if (bodyTooLarge(request)) {
    return respostaErro(413, "Payload muito grande");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respostaErro(400, "JSON invalido");
  }

  if (!isRecord(body)) {
    return respostaErro(400, "Payload invalido");
  }

  if (bodyTooLarge(request, body)) {
    return respostaErro(413, "Payload muito grande");
  }

  const prepared = buildRecord(body.tipo, body.payload);
  if (!prepared.ok) {
    return respostaErro(prepared.status, prepared.error);
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from(prepared.table).insert(prepared.record);

  if (error) {
    console.error("[AUDITORIA LEGADO] Falha ao inserir auditoria", {
      tipo: body.tipo,
      code: error.code,
    });
    return respostaErro(500, "Erro ao registrar auditoria");
  }

  return NextResponse.json({ ok: true });
}
