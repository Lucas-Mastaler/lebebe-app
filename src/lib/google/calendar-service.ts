import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// ─────────────────────────────────────────────────────────
// 1.0 – Configuração e Autenticação OAuth 2.0
// ─────────────────────────────────────────────────────────

export async function criarClienteCalendar() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Variáveis GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN são obrigatórias."
    );
  }

  console.log("[CALENDAR SERVICE] Criando OAuth2Client...");

  const oauth2Client = new OAuth2Client({
    clientId: clientId,
    clientSecret: clientSecret,
  });

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  console.log("[CALENDAR SERVICE] ✓ OAuth2Client configurado com refresh_token");

  try {
    console.log("[CALENDAR SERVICE] Obtendo access_token via refresh...");
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    console.log("[CALENDAR SERVICE] ✓ Access token obtido com sucesso");
    console.log(`[CALENDAR SERVICE] Token expira em: ${new Date(credentials.expiry_date || 0).toISOString()}`);
  } catch (error: any) {
    console.error("[CALENDAR SERVICE] ❌ Erro ao fazer refresh do access_token:", error.message);
    throw new Error("Falha ao renovar access token. Verifique o refresh_token.");
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}

// ─────────────────────────────────────────────────────────
// 2.0 – Funções de manipulação de eventos
// ─────────────────────────────────────────────────────────

export interface EventoCalendar {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
  [key: string]: any;
}

export async function buscarEvento(
  calendarId: string,
  eventoId: string
): Promise<EventoCalendar | null> {
  console.log(`[CALENDAR SERVICE] Buscando evento ${eventoId} no calendário ${calendarId}`);
  
  try {
    const calendar = await criarClienteCalendar();
    const response = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventoId,
    });

    console.log(`[CALENDAR SERVICE] ✓ Evento encontrado: ${response.data.summary}`);
    return response.data as EventoCalendar;
  } catch (error: any) {
    console.error(`[CALENDAR SERVICE] ❌ Erro ao buscar evento:`, error.message);
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}

export async function criarEvento(
  calendarId: string,
  evento: Partial<EventoCalendar>
): Promise<EventoCalendar> {
  console.log(`[CALENDAR SERVICE] Criando novo evento no calendário ${calendarId}`);
  console.log(`[CALENDAR SERVICE] Título: ${evento.summary}`);
  
  try {
    const calendar = await criarClienteCalendar();
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: evento as any,
    });

    console.log(`[CALENDAR SERVICE] ✓ Evento criado com ID: ${response.data.id}`);
    return response.data as EventoCalendar;
  } catch (error: any) {
    console.error(`[CALENDAR SERVICE] ❌ Erro ao criar evento:`, error.message);
    throw error;
  }
}

export async function atualizarEvento(
  calendarId: string,
  eventoId: string,
  evento: Partial<EventoCalendar>
): Promise<EventoCalendar> {
  console.log(`[CALENDAR SERVICE] Atualizando evento ${eventoId} no calendário ${calendarId}`);
  
  try {
    const calendar = await criarClienteCalendar();
    const response = await calendar.events.update({
      calendarId: calendarId,
      eventId: eventoId,
      requestBody: evento as any,
    });

    console.log(`[CALENDAR SERVICE] ✓ Evento atualizado com sucesso`);
    return response.data as EventoCalendar;
  } catch (error: any) {
    console.error(`[CALENDAR SERVICE] ❌ Erro ao atualizar evento:`, error.message);
    throw error;
  }
}

export async function moverEvento(
  calendarIdOrigem: string,
  calendarIdDestino: string,
  eventoId: string
): Promise<EventoCalendar> {
  console.log(`[CALENDAR SERVICE] Movendo evento ${eventoId} de ${calendarIdOrigem} para ${calendarIdDestino}`);
  
  try {
    const calendar = await criarClienteCalendar();
    const response = await calendar.events.move({
      calendarId: calendarIdOrigem,
      eventId: eventoId,
      destination: calendarIdDestino,
    });

    console.log(`[CALENDAR SERVICE] ✓ Evento movido com sucesso`);
    return response.data as EventoCalendar;
  } catch (error: any) {
    console.error(`[CALENDAR SERVICE] ❌ Erro ao mover evento:`, error.message);
    throw error;
  }
}
