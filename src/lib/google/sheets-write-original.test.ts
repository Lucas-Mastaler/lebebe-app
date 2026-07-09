import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { atualizarDataAgendaGoogleOriginalMere, type EventoReagendamentoPlanilha } from './sheets-service-account';

const { mockSpreadsheetsGet, mockValuesGet, mockValuesUpdate } = vi.hoisted(() => ({
  mockSpreadsheetsGet: vi.fn(),
  mockValuesGet: vi.fn(),
  mockValuesUpdate: vi.fn(),
}));

vi.mock('googleapis', () => {
  const sheetsMock = {
    spreadsheets: {
      get: mockSpreadsheetsGet,
      values: {
        get: mockValuesGet,
        update: mockValuesUpdate,
      },
    },
  };

  return {
    google: {
      sheets: () => sheetsMock,
    },
  };
});

vi.mock('google-auth-library', () => ({
  JWT: class {
    authorize = vi.fn().mockResolvedValue({});
  },
}));

const SPREADSHEET_ID = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U';
const SHEET_GID = '190443561';
const SHEET_TITLE = 'Controle Original';

const HEADERS = [
  'Filial de Venda',
  'Nome do Cliente',
  'Pedido de Venda',
  'CPF',
  'Data na agenda GOOGLE',
  'EVENTO_ID',
  'CALENDAR_ID',
];

function makeRow(pedido: string, cpf: string, dataAgenda: string, eventoId: string, calendarId: string): string[] {
  return ['', '', pedido, cpf, dataAgenda, eventoId, calendarId];
}

function setupEnv() {
  process.env.GMAIL_SERVICE_EMAIL = 'test@test.iam.gserviceaccount.com';
  process.env.GMAIL_PRIVATE_KEY = 'test-key';
  process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SPREADSHEET_ID = SPREADSHEET_ID;
  process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SHEET_GID = SHEET_GID;
}

function setupSheetsMock(rows: string[][], updateError?: Error) {
  mockSpreadsheetsGet.mockResolvedValue({
    data: {
      sheets: [
        { properties: { title: SHEET_TITLE, sheetId: Number(SHEET_GID) } },
      ],
    },
  });

  mockValuesGet.mockResolvedValue({
    data: { values: rows },
  });

  if (updateError) {
    mockValuesUpdate.mockRejectedValue(updateError);
  } else {
    mockValuesUpdate.mockResolvedValue({ data: {} });
  }
}

describe('atualizarDataAgendaGoogleOriginalMere', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SPREADSHEET_ID;
    delete process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SHEET_GID;
  });

  it('1. Calendar dry-run: nao atualiza planilha', async () => {
    const resultado = await atualizarDataAgendaGoogleOriginalMere(
      [{ evento_id: 'ev1', calendar_id: 'cal1' }],
      '03/08/2026',
      { dryRun: true }
    );

    expect(resultado.status).toBe('skip_dry_run_calendar');
    expect(resultado.totalLinhasAtualizadas).toBe(0);
    expect(resultado.ok).toBe(true);
  });

  it('2. Calendar aplicado com 2 eventos: atualiza 2 linhas', async () => {
    const rows = [
      HEADERS,
      makeRow('65469', '12345678901', '17/07/2026', 'ev65469', 'cal_principal'),
      makeRow('65384', '12345678901', '17/07/2026', 'ev65384', 'cal_principal'),
    ];

    setupSheetsMock(rows);

    const eventos: EventoReagendamentoPlanilha[] = [
      { evento_id: 'ev65469', calendar_id: 'cal_principal', pedido_venda: '65469' },
      { evento_id: 'ev65384', calendar_id: 'cal_principal', pedido_venda: '65384' },
    ];

    const resultado = await atualizarDataAgendaGoogleOriginalMere(eventos, '03/08/2026');

    expect(resultado.status).toBe('sucesso');
    expect(resultado.totalLinhasAtualizadas).toBe(2);
    expect(resultado.linhas).toHaveLength(2);
    expect(resultado.linhas[0].status).toBe('atualizada');
    expect(resultado.linhas[0].data_anterior).toBe('17/07/2026');
    expect(resultado.linhas[0].data_nova).toBe('03/08/2026');
    expect(resultado.linhas[1].status).toBe('atualizada');
  });

  it('3. Evento nao encontrado na planilha: registra erro, nao atualiza linha errada', async () => {
    const rows = [
      HEADERS,
      makeRow('65469', '12345678901', '17/07/2026', 'ev65469', 'cal_principal'),
    ];

    setupSheetsMock(rows);

    const eventos: EventoReagendamentoPlanilha[] = [
      { evento_id: 'ev_inexistente', calendar_id: 'cal_principal', pedido_venda: '99999' },
    ];

    const resultado = await atualizarDataAgendaGoogleOriginalMere(eventos, '03/08/2026');

    expect(resultado.status).toBe('erro');
    expect(resultado.totalLinhasAtualizadas).toBe(0);
    expect(resultado.linhas[0].status).toBe('nao_encontrada');
    expect(resultado.erros.length).toBeGreaterThan(0);
  });

  it('4. Cabecalho repetido: nao atualiza linha de cabecalho', async () => {
    const rows = [
      HEADERS,
      HEADERS, // cabecalho duplicado
      makeRow('65469', '12345678901', '17/07/2026', 'ev65469', 'cal_principal'),
    ];

    setupSheetsMock(rows);

    const eventos: EventoReagendamentoPlanilha[] = [
      { evento_id: 'ev65469', calendar_id: 'cal_principal', pedido_venda: '65469' },
    ];

    const resultado = await atualizarDataAgendaGoogleOriginalMere(eventos, '03/08/2026');

    expect(resultado.status).toBe('sucesso');
    expect(resultado.totalLinhasAtualizadas).toBe(1);
    // A linha atualizada deve ser a linha 3 (rowNumber=3), nao a linha 2 (cabecalho duplicado)
    expect(resultado.linhas[0].rowNumber).toBe(3);
  });

  it('5. Falta coluna Data na agenda GOOGLE: nao escreve, erro controlado', async () => {
    const headersSemDataAgenda = ['Filial', 'Pedido de Venda', 'EVENTO_ID', 'CALENDAR_ID'];
    const rows = [
      headersSemDataAgenda,
      ['', '65469', 'ev65469', 'cal_principal'],
    ];

    setupSheetsMock(rows);

    const eventos: EventoReagendamentoPlanilha[] = [
      { evento_id: 'ev65469', calendar_id: 'cal_principal' },
    ];

    const resultado = await atualizarDataAgendaGoogleOriginalMere(eventos, '03/08/2026');

    expect(resultado.status).toBe('coluna_ausente');
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.length).toBeGreaterThan(0);
  });

  it('6. Falta permissao de escrita: erro controlado sheets_write_permission_denied', async () => {
    const rows = [
      HEADERS,
      makeRow('65469', '12345678901', '17/07/2026', 'ev65469', 'cal_principal'),
    ];

    setupSheetsMock(rows, new Error('The caller does not have permission 403'));

    const eventos: EventoReagendamentoPlanilha[] = [
      { evento_id: 'ev65469', calendar_id: 'cal_principal' },
    ];

    const resultado = await atualizarDataAgendaGoogleOriginalMere(eventos, '03/08/2026');

    expect(resultado.status).toBe('sheets_write_permission_denied');
    expect(resultado.ok).toBe(false);
  });

  it('7. Configuracao ausente: retorna erro sem chamar API', async () => {
    delete process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SPREADSHEET_ID;
    delete process.env.GOOGLE_AGENDA_CONTROLE_ORIGINAL_SHEET_GID;

    const resultado = await atualizarDataAgendaGoogleOriginalMere(
      [{ evento_id: 'ev1', calendar_id: 'cal1' }],
      '03/08/2026'
    );

    expect(resultado.status).toBe('configuracao_ausente');
    expect(resultado.ok).toBe(false);
  });
});
