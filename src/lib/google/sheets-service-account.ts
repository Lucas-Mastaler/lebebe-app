import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// ─────────────────────────────────────────────────────────
// 1.0 – Tipos
// ─────────────────────────────────────────────────────────

export type AgendamentoEncontrado = {
  filial_venda: string;
  nome_cliente: string;
  pedido_venda: string;
  data_agenda_google: string;
  status_estoque: string;
  quanto_tempo_entrega: string;
  produtos_pendentes: string;
  endereco_cliente: string;
  produtos_lancamento: string;
  equipe_agenda: string;
  pendente_pagamento: string;
  cpf_mascarado: string;
  tempo_servico: string;
  evento_id: string;
  calendar_id: string;
};

export type EventoGrupo = {
  pedido_venda: string;
  evento_id: string;
  calendar_id: string;
  tempo_servico: string;
  equipe_agenda: string;
  data_agenda_google: string;
  endereco_cliente: string;
};

export type GrupoAgendamento = {
  indice: number;
  nome_cliente: string;
  cpf_mascarado: string;
  data_entrega: string;
  endereco_completo: string;
  endereco_curto: string;
  pedidos_venda: string[];
  produtos: string[];
  tempo_para_entrega: string;
  tempo_servico: string;
  equipe_agenda: string;
  pendente_pagamento: string;
  status_estoque: string;
  produtos_pendentes: string;
  eventos: EventoGrupo[];
  itens_originais: AgendamentoEncontrado[];
};

export type BuscaAgendaResultado =
  | { ok: true; agendamentos: AgendamentoEncontrado[]; total: number; grupos: GrupoAgendamento[]; total_grupos: number }
  | { ok: false; erro: string };

// ─────────────────────────────────────────────────────────
// 2.0 – Autenticação JWT (Service Account)
// ─────────────────────────────────────────────────────────

function criarClienteSheetsServiceAccount() {
  const serviceEmail = process.env.GMAIL_SERVICE_EMAIL;
  const privateKeyRaw = process.env.GMAIL_PRIVATE_KEY;

  if (!serviceEmail || !privateKeyRaw) {
    throw new Error('Variáveis GMAIL_SERVICE_EMAIL e GMAIL_PRIVATE_KEY são obrigatórias.');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const jwtClient = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth: jwtClient });
}

// ─────────────────────────────────────────────────────────
// 3.0 – Helpers de normalização e mascaramento
// ─────────────────────────────────────────────────────────

function normalizarDocumento(doc: string): string {
  return doc.replace(/\D/g, '');
}

function mascararDocumento(doc: string): string {
  const digitos = doc.replace(/\D/g, '');
  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.***.***-${digitos.slice(-2)}`;
  }
  if (digitos.length === 14) {
    return `${digitos.slice(0, 2)}.***.***/****-${digitos.slice(-2)}`;
  }
  return '***';
}

function normalizarHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mapearCabecalhos(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => {
    map.set(normalizarHeader(h), idx);
  });
  return map;
}

function valorCelula(row: string[], idx: number | undefined): string {
  if (idx === undefined) return '';
  return row[idx] ?? '';
}

function isHeaderRowDuplicado(row: string[], headers: string[]): boolean {
  if (row.length < headers.length) return false;
  for (let i = 0; i < headers.length; i++) {
    if (normalizarHeader(row[i] ?? '') !== normalizarHeader(headers[i] ?? '')) {
      return false;
    }
  }
  return true;
}

function resolverRangeAba(): string {
  const sheetName = process.env.GOOGLE_AGENDA_CONTROLE_SHEET_NAME ?? 'N8N- CONTROLE AGENDA';
  const abaEscapada = sheetName.replace(/'/g, "''");
  return `'${abaEscapada}'!A:AZ`;
}

// ─────────────────────────────────────────────────────────
// 4.0 – Agrupamento por entrega (data + endereço normalizado)
// ─────────────────────────────────────────────────────────

function normalizarTextoChave(valor: string): string {
  return valor
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairEnderecoCurto(endereco: string): string {
  const partes = endereco.split(',').map((p) => p.trim()).filter(Boolean);
  if (partes.length <= 2) return endereco.trim();
  return `${partes.slice(0, 2).join(', ')}...`;
}

export function agruparAgendamentosPorEntrega(
  agendamentos: AgendamentoEncontrado[]
): GrupoAgendamento[] {
  const mapa = new Map<string, GrupoAgendamento>();

  for (const item of agendamentos) {
    const chave = `${normalizarTextoChave(item.data_agenda_google)}|||${normalizarTextoChave(item.endereco_cliente)}`;

    if (!mapa.has(chave)) {
      const grupo: GrupoAgendamento = {
        indice: mapa.size + 1,
        nome_cliente: item.nome_cliente,
        cpf_mascarado: item.cpf_mascarado,
        data_entrega: item.data_agenda_google,
        endereco_completo: item.endereco_cliente,
        endereco_curto: extrairEnderecoCurto(item.endereco_cliente),
        pedidos_venda: [],
        produtos: [],
        tempo_para_entrega: item.quanto_tempo_entrega,
        tempo_servico: item.tempo_servico,
        equipe_agenda: item.equipe_agenda,
        pendente_pagamento: item.pendente_pagamento,
        status_estoque: item.status_estoque,
        produtos_pendentes: item.produtos_pendentes,
        eventos: [],
        itens_originais: [],
      };
      mapa.set(chave, grupo);
    }

    const grupo = mapa.get(chave)!;

    const pedido = item.pedido_venda.trim();
    if (pedido && !grupo.pedidos_venda.includes(pedido)) {
      grupo.pedidos_venda.push(pedido);
    }

    const produtosItem = item.produtos_lancamento
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    for (const produto of produtosItem) {
      if (!grupo.produtos.includes(produto)) {
        grupo.produtos.push(produto);
      }
    }

    grupo.eventos.push({
      pedido_venda: item.pedido_venda,
      evento_id: item.evento_id,
      calendar_id: item.calendar_id,
      tempo_servico: item.tempo_servico,
      equipe_agenda: item.equipe_agenda,
      data_agenda_google: item.data_agenda_google,
      endereco_cliente: item.endereco_cliente,
    });

    grupo.itens_originais.push(item);
  }

  return Array.from(mapa.values());
}

// ─────────────────────────────────────────────────────────
// 5.0 – Busca por documento na planilha de controle de agenda
// ─────────────────────────────────────────────────────────

export async function buscarAgendamentosPorDocumento(
  documento: string
): Promise<BuscaAgendaResultado> {
  const spreadsheetId = process.env.GOOGLE_AGENDA_CONTROLE_SPREADSHEET_ID;

  if (!spreadsheetId) {
    return { ok: false, erro: 'GOOGLE_AGENDA_CONTROLE_SPREADSHEET_ID não configurado' };
  }

  try {
    const sheets = criarClienteSheetsServiceAccount();
    const range = resolverRangeAba();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const valores = response.data.values as string[][] | null | undefined;
    if (!valores || valores.length === 0) {
      return { ok: true, agendamentos: [], total: 0, grupos: [], total_grupos: 0 };
    }

    const headers = valores[0];
    const colunas = mapearCabecalhos(headers);

    const documentoBusca = normalizarDocumento(documento);
    const idxCpf = colunas.get('cpf');

    if (idxCpf === undefined) {
      return { ok: false, erro: 'Coluna CPF não encontrada na planilha' };
    }

    const agendamentos: AgendamentoEncontrado[] = [];

    for (let i = 1; i < valores.length; i++) {
      const row = valores[i];
      if (row.length === 0) continue;
      if (isHeaderRowDuplicado(row, headers)) continue;

      const cpfRow = normalizarDocumento(row[idxCpf] ?? '');
      if (cpfRow !== documentoBusca) continue;

      agendamentos.push({
        filial_venda: valorCelula(row, colunas.get('filial de venda')),
        nome_cliente: valorCelula(row, colunas.get('nome do cliente')),
        pedido_venda: valorCelula(row, colunas.get('pedido de venda')),
        data_agenda_google: valorCelula(row, colunas.get('data na agenda google')),
        status_estoque: valorCelula(row, colunas.get('algo nao chegou ainda?')),
        quanto_tempo_entrega: valorCelula(row, colunas.get('quanto tempo pra entrega?')),
        produtos_pendentes: valorCelula(row, colunas.get('produtos pendentes')),
        endereco_cliente: valorCelula(row, colunas.get('endereco do cliente')),
        produtos_lancamento: valorCelula(row, colunas.get('produtos desse lancamento')),
        equipe_agenda: valorCelula(row, colunas.get('equipe agenda')),
        pendente_pagamento: valorCelula(row, colunas.get('pendente de pagamento?')),
        cpf_mascarado: mascararDocumento(valorCelula(row, idxCpf)),
        tempo_servico: valorCelula(row, colunas.get('tempo do servico')),
        evento_id: valorCelula(row, colunas.get('evento_id')),
        calendar_id: valorCelula(row, colunas.get('calendar_id')),
      });
    }

    const grupos = agruparAgendamentosPorEntrega(agendamentos);
    return { ok: true, agendamentos, total: agendamentos.length, grupos, total_grupos: grupos.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, erro: `Falha ao consultar planilha: ${msg}` };
  }
}
