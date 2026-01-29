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
