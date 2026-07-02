// Le Bébé - Type Definitions

export interface Agendamento {
  id: string;
  accountId: string;
  departmentId: string;
  userId: string;
  contactId: string;
  loja: string;
  consultora: string;
  nomeWhatsapp: string;
  nomeDigisac: string;
  mensagemAgendada: string;
  comentario: string;
  tags: string;
  statusChamado: string; // "Aberto" | "Fechado"
  ultimoChamadoFechado: string; // dd/mm/aaaa HH:mm:ss

  statusCode: 'scheduled' | 'done' | 'error';
  statusLabel: string;
  statusBadgeVariant: 'info' | 'success' | 'destructive';
  abrirTicketLabel: string;
  notificarLabel: string;
  agendadoDia: string;
  agendadoHora: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FiltrosPesquisa {
  dataAgendamentoInicio?: string;
  dataAgendamentoFim?: string;
  dataCriacaoInicio?: string;
  dataCriacaoFim?: string;
  departmentId?: string;
  userId?: string;
  status?: string[];
  // Novos filtros de Ticket
  conversaAberta?: 'all' | 'yes' | 'no';
  dataUltimoChamadoFechadoInicio?: string;
  dataUltimoChamadoFechadoFim?: string;

  page: number;
  perPage: number;
}

export interface PesquisaResponse {
  items: Agendamento[];
  meta: {
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
  };
}

// Dashboard
export interface DashboardClienteDetalhe {
  contactId: string;
  nome: string;
  filial: string;
  userId?: string;
  chamadosNoPeriodo?: number;
  totalChamadosHistorico: number;
}

export interface DashboardLinha {
  departmentId: string;
  filial: string;
  totalClientesUnicos: number;
  agendamentosCriadosNoPeriodo: number;
  ratioAgendamentosPorCliente: number;
  totalChamadosAtivosNoPeriodo: number;
  totalChamadosReceptivosNoPeriodo: number;
  totalClientesUnicosAtivo: number;
  totalClientesUnicosReceptivo: number;
  totalChamadosHistoricoSomadoFilial?: number;
  clientesDetalhe?: DashboardClienteDetalhe[];
  ratioChamadosAtivosPorUnicoAtivo?: number;
  ratioChamadosReceptivosPorUnicoReceptivo?: number;
}

export interface DashboardResponse {
  periodo: {
    inicio: string;
    fim: string;
  };
  linhas: DashboardLinha[];
  linhasConsultoras?: DashboardLinhaConsultora[];
  totalChamadosHistoricoSomado?: number;
  clientesHistoricoTop?: DashboardClienteDetalhe[];
}

export interface DashboardLinhaConsultora {
  userId: string;
  consultora: string;
  totalClientesUnicos: number;
  agendamentosCriadosNoPeriodo: number;
  ratioAgendamentosPorCliente: number;
  totalChamadosAtivosNoPeriodo: number;
  totalChamadosReceptivosNoPeriodo: number;
  totalClientesUnicosAtivo: number;
  totalClientesUnicosReceptivo: number;
  ratioChamadosAtivosPorUnicoAtivo: number;
  ratioChamadosReceptivosPorUnicoReceptivo: number;
  totalChamadosHistoricoSomadoConsultora?: number;
}

export interface Departamento {
  id: string;
  nome: string;
}

export interface Usuario {
  id: string;
  nome: string;
}

// Chamados Finalizados
export interface ChamadoFinalizadoItem {
  contactId: string;
  nomeDigisac: string;
  loja: string;
  consultora: string;
  statusConversa: 'Aberta' | 'Fechado';
  tags: string;
  qtdAgendamentosTotal: number;
  qtdAgendamentosAbertos: number;
  qtdAgendamentosFinalizados: number;
  qtdAgendamentosErro: number;
}

export interface PesquisaChamadosResponse {
  items: ChamadoFinalizadoItem[];
  meta: {
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
  };
}

export interface AgendamentoContatoItem {
  id: string;
  message: string;
  createdAt: string;
  scheduledAt: string;
  notes: string;
  status: 'scheduled' | 'done' | 'error' | 'canceled' | string;
  statusLabel?: string;
}

// Google Apps Script API
export interface AppsScriptExecutePayload {
  // Endereço estruturado (PREFERIDO - melhor para geocodificação)
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  
  // Endereço completo (FALLBACK - compatibilidade)
  enderecoCompleto?: string;
  
  // Parâmetros de serviço
  tempoNecessario: string;
  isRural?: boolean;
  isCondominio?: boolean;
  dataInicial?: string; // YYYY-MM-DD (D+2 a D+90)
}

export interface AppsScriptExecuteResponse {
  ok: boolean;
  resultado?: unknown;
  error?: string;
}

// Estatisticas Digisac (dashboard/by-period)
export interface EstatisticasDigisacTotais {
  mensagensEnviadas: number;
  mensagensRecebidas: number;
  totalMensagens: number;
  relacaoEnvioRecebimento: number | null;
  tempoMedioChamadoSegundos: number;
  mediaPrimeiroTempoEsperaSegundos: number;
  mediaPrimeiroTempoEsperaAposBotSegundos: number;
  tempoMedioEsperaSegundos: number;
  contatosAtendidos: number;
  chamadosAbertos: number;
  chamadosFechados: number;
  totalChamados: number;
}

export interface EstatisticasDigisacDiario {
  data: string;
  mensagensEnviadas: number;
  mensagensRecebidas: number;
  totalMensagens: number;
}

export interface EstatisticasDigisacResponse {
  totais: EstatisticasDigisacTotais;
  diario: EstatisticasDigisacDiario[];
}

export interface ServicoDigisacDashboard {
  id: string;
  name: string;
  type: string;
  archivedAt?: string | null;
}

export interface ServicosDigisacResponse {
  servicos: ServicoDigisacDashboard[];
}

export interface ChamadoAvaliadoVacuo {
  protocol: string | null;
  ticketId: string;
  ticketHistoryUrl: string | null;
  statusVacuo: 'vacuo' | 'respondido_em_24h';
  temRespostaClienteEm24h: boolean;
  totalMensagens: number;
  mensagensClienteEm24h: number;
}

export interface VacuoAtivoResponse {
  taxaVacuoAtivo: number | null;
  chamadosAtivosTotal: number;
  chamadosAtivosElegiveis: number;
  chamadosEmVacuo: number | null;
  chamadosRespondidosEm24h: number | null;
  calculado: boolean;
  limiteExcedido: boolean;
  mensagem: string | null;
  chamadosAvaliados?: ChamadoAvaliadoVacuo[];
}
