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

function criarClienteSheetsServiceAccountEscrita() {
  const serviceEmail = process.env.GMAIL_SERVICE_EMAIL;
  const privateKeyRaw = process.env.GMAIL_PRIVATE_KEY;

  if (!serviceEmail || !privateKeyRaw) {
    throw new Error('Variáveis GMAIL_SERVICE_EMAIL e GMAIL_PRIVATE_KEY são obrigatórias.');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const jwtClient = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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

function tempoServicoValido(valor: string): boolean {
  const limpo = valor.trim();
  if (!limpo || limpo === '00:00') return false;
  if (/^\d{1,2}:[0-5]\d$/.test(limpo)) return true;
  return /^\d{1,4}\s*(?:min|mins|minuto|minutos)?$/i.test(limpo);
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
    if (!tempoServicoValido(grupo.tempo_servico) && tempoServicoValido(item.tempo_servico)) {
      grupo.tempo_servico = item.tempo_servico;
    }

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

// ─────────────────────────────────────────────────────────
// 6.0 – Atualização da aba original (escrita) após reagendamento Calendar
// ─────────────────────────────────────────────────────────

export type EventoReagendamentoPlanilha = {
  evento_id: string;
  calendar_id: string;
  pedido_venda?: string;
};

export type LinhaAtualizadaPlanilha = {
  rowNumber: number;
  pedido: string;
  evento_id: string;
  calendar_id: string;
  data_anterior: string;
  data_nova: string;
  status: 'atualizada' | 'nao_encontrada' | 'erro';
  erro?: string;
};

export type ResultadoAtualizacaoPlanilhaOriginal = {
  ok: boolean;
  status: 'sucesso' | 'sucesso_parcial' | 'erro' | 'skip_dry_run_calendar' | 'sheets_write_permission_denied' | 'coluna_ausente' | 'configuracao_ausente';
  spreadsheetId: string;
  sheetGid: string;
  sheetTitle: string | null;
  colunaDataAgenda: string;
  criterioMatch: string;
  totalLinhasAtualizadas: number;
  linhas: LinhaAtualizadaPlanilha[];
  erros: string[];
  dryRun: boolean;
};

function colunaParaLetra(colIndex: number): string {
  let letra = '';
  let idx = colIndex;
  while (idx >= 0) {
    letra = String.fromCharCode(65 + (idx % 26)) + letra;
    idx = Math.floor(idx / 26) - 1;
  }
  return letra;
}

export async function atualizarDataAgendaGoogleOriginalMere(
  eventos: EventoReagendamentoPlanilha[],
  dataNovaBR: string,
  opcoes?: { dryRun?: boolean }
): Promise<ResultadoAtualizacaoPlanilhaOriginal> {
  const spreadsheetId = process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SPREADSHEET_ID;
  const sheetGid = process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SHEET_GID;

  const resultadoBase: ResultadoAtualizacaoPlanilhaOriginal = {
    ok: false,
    status: 'configuracao_ausente',
    spreadsheetId: spreadsheetId ?? '',
    sheetGid: sheetGid ?? '',
    sheetTitle: null,
    colunaDataAgenda: 'Data na agenda GOOGLE',
    criterioMatch: 'evento_id_calendar_id',
    totalLinhasAtualizadas: 0,
    linhas: [],
    erros: [],
    dryRun: opcoes?.dryRun ?? false,
  };

  if (!spreadsheetId || !sheetGid) {
    resultadoBase.erros.push('GOOGLE_AGENDA_CONTROLE_ORIGINAL_SPREADSHEET_ID ou GOOGLE_AGENDA_CONTROLE_ORIGINAL_SHEET_GID não configurado');
    return resultadoBase;
  }

  if (opcoes?.dryRun) {
    resultadoBase.status = 'skip_dry_run_calendar';
    resultadoBase.ok = true;
    return resultadoBase;
  }

  try {
    const sheets = criarClienteSheetsServiceAccountEscrita();

    // Resolver o título da aba pelo gid
    const metaResp = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(title,sheetId))',
    });

    const sheetsList = metaResp.data.sheets ?? [];
    const sheetInfo = sheetsList.find((s) => s.properties?.sheetId === Number(sheetGid));
    const sheetTitle = sheetInfo?.properties?.title ?? null;

    if (!sheetTitle) {
      resultadoBase.status = 'erro';
      resultadoBase.erros.push(`Aba com gid ${sheetGid} não encontrada no spreadsheet`);
      return resultadoBase;
    }

    resultadoBase.sheetTitle = sheetTitle;

    // Ler range suficiente da aba original
    const rangeLeitura = `'${sheetTitle.replace(/'/g, "''")}'!A:AZ`;
    const readResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeLeitura,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const valores = readResp.data.values as string[][] | null | undefined;
    if (!valores || valores.length === 0) {
      resultadoBase.status = 'erro';
      resultadoBase.erros.push('Planilha original vazia ou sem dados');
      return resultadoBase;
    }

    // Detectar linha de cabeçalho (pode haver linhas repetidas no início)
    let headerRowIndex = -1;
    let headers: string[] = [];
    let colunas: Map<string, number> = new Map();

    for (let i = 0; i < Math.min(valores.length, 10); i++) {
      const row = valores[i];
      if (!row || row.length === 0) continue;
      const candidato = row.map((c) => normalizarHeader(c));
      if (
        candidato.includes(normalizarHeader('Pedido de Venda')) &&
        candidato.includes(normalizarHeader('EVENTO_ID')) &&
        candidato.includes(normalizarHeader('CALENDAR_ID'))
      ) {
        headerRowIndex = i;
        headers = row;
        colunas = mapearCabecalhos(row);
        break;
      }
    }

    if (headerRowIndex === -1) {
      resultadoBase.status = 'erro';
      resultadoBase.erros.push('Cabeçalho com colunas esperadas não encontrado na aba original');
      return resultadoBase;
    }

    const idxDataAgenda = colunas.get(normalizarHeader('Data na agenda GOOGLE'));
    const idxEventoId = colunas.get(normalizarHeader('EVENTO_ID'));
    const idxCalendarId = colunas.get(normalizarHeader('CALENDAR_ID'));
    const idxPedido = colunas.get(normalizarHeader('Pedido de Venda'));

    if (idxDataAgenda === undefined) {
      resultadoBase.status = 'coluna_ausente';
      resultadoBase.erros.push('Coluna "Data na agenda GOOGLE" não encontrada no cabeçalho');
      return resultadoBase;
    }
    if (idxEventoId === undefined || idxCalendarId === undefined) {
      resultadoBase.status = 'coluna_ausente';
      resultadoBase.erros.push('Colunas EVENTO_ID ou CALENDAR_ID não encontradas no cabeçalho');
      return resultadoBase;
    }

    const colunaLetra = colunaParaLetra(idxDataAgenda);
    const linhasResultado: LinhaAtualizadaPlanilha[] = [];
    let totalAtualizadas = 0;
    const erros: string[] = [];

    // Para cada evento do reagendamento, localizar linha(s) correspondente(s)
    for (const evento of eventos) {
      const eventoIdNorm = evento.evento_id.trim();
      const calendarIdNorm = evento.calendar_id.trim();
      let encontrou = false;

      for (let i = headerRowIndex + 1; i < valores.length; i++) {
        const row = valores[i];
        if (!row || row.length === 0) continue;
        if (isHeaderRowDuplicado(row, headers)) continue;

        const rowEventoId = (row[idxEventoId] ?? '').trim();
        const rowCalendarId = (row[idxCalendarId] ?? '').trim();

        if (rowEventoId === eventoIdNorm && rowCalendarId === calendarIdNorm) {
          const rowNumber = i + 1; // 1-indexed
          const dataAnterior = (row[idxDataAgenda] ?? '').trim();
          const pedido = idxPedido !== undefined ? (row[idxPedido] ?? '').trim() : (evento.pedido_venda ?? '');

          try {
            const cellRange = `'${sheetTitle.replace(/'/g, "''")}'!${colunaLetra}${rowNumber}`;
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: cellRange,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [[dataNovaBR]] },
            });

            linhasResultado.push({
              rowNumber,
              pedido,
              evento_id: eventoIdNorm,
              calendar_id: calendarIdNorm,
              data_anterior: dataAnterior,
              data_nova: dataNovaBR,
              status: 'atualizada',
            });
            totalAtualizadas++;
            encontrou = true;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            linhasResultado.push({
              rowNumber,
              pedido,
              evento_id: eventoIdNorm,
              calendar_id: calendarIdNorm,
              data_anterior: dataAnterior,
              data_nova: dataNovaBR,
              status: 'erro',
              erro: msg,
            });
            erros.push(`Erro ao atualizar linha ${rowNumber} (evento ${eventoIdNorm}): ${msg}`);
            encontrou = true;
          }
        }
      }

      if (!encontrou) {
        linhasResultado.push({
          rowNumber: -1,
          pedido: evento.pedido_venda ?? '',
          evento_id: eventoIdNorm,
          calendar_id: calendarIdNorm,
          data_anterior: '',
          data_nova: dataNovaBR,
          status: 'nao_encontrada',
        });
        erros.push(`Linha não encontrada para evento_id=${eventoIdNorm} calendar_id=${calendarIdNorm}`);
      }
    }

    const temErro = linhasResultado.some((l) => l.status === 'erro');
    const todasAtualizadas = totalAtualizadas === eventos.length;

    resultadoBase.linhas = linhasResultado;
    resultadoBase.totalLinhasAtualizadas = totalAtualizadas;
    resultadoBase.erros = erros;
    resultadoBase.ok = totalAtualizadas > 0 && !temErro;
    resultadoBase.status = todasAtualizadas
      ? 'sucesso'
      : totalAtualizadas > 0
        ? 'sucesso_parcial'
        : 'erro';

    // Detectar erro de permissão
    if (temErro && erros.some((e) => e.includes('403') || e.includes('permission') || e.includes('PERMISSION'))) {
      resultadoBase.status = 'sheets_write_permission_denied';
      resultadoBase.ok = false;
    }

    return resultadoBase;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    resultadoBase.status = msg.includes('403') || msg.includes('permission') || msg.includes('PERMISSION')
      ? 'sheets_write_permission_denied'
      : 'erro';
    resultadoBase.ok = false;
    resultadoBase.erros.push(`Falha ao atualizar planilha original: ${msg}`);
    return resultadoBase;
  }
}
