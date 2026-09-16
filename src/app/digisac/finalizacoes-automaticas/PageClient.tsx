'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, AlertCircle, Bot, CheckCircle2, Clock, XCircle, Loader2, FilePlus2, Lock, RefreshCw, Search, Wifi, WifiOff, ChevronDown, ChevronRight, Play, History } from 'lucide-react';
import type { RegistroFechamentoAutomatico, StatusFechamento, TipoChamadoFechamento, UltimaMensagemPor } from '@/lib/digisac/finalizacoesAutomaticas';
import { Alert, Badge, Button, Card, CardContent, CardHeader, ConfirmDialog, FilterFieldGroup, FilterPanel, Input, KpiCard, PageContainer, PageHeader, ResponsiveTable, type ResponsiveTableColumn, useFilterState } from '@/components/design-system';
import { Checkbox } from '@/components/ui/checkbox';
import { TABLE_PAGE_SIZE } from '@/lib/design-system/pagination';

interface RegistroExecucaoResumo {
  id: string;
  created_at: string;
  origem: 'cron' | 'manual';
  status: 'sucesso' | 'erro' | 'parcial' | 'sem_itens' | 'em_andamento';
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  total_encontrados: number;
  total_elegiveis: number;
  total_finalizados: number;
  total_ignorados: number;
  total_erros: number;
  mensagem: string | null;
  erro: string | null;
  request_id: string | null;
}

interface ExecucoesResponse {
  ok: boolean;
  ultimaCron: RegistroExecucaoResumo | null;
  ultimaManual: RegistroExecucaoResumo | null;
  execucoes: RegistroExecucaoResumo[];
}

interface ConexaoDisponivel {
  serviceId: string;
  serviceName: string;
  type: string;
  habilitada: boolean;
}

interface ListagemResponse {
  items: RegistroFechamentoAutomatico[];
  total: number;
  page: number;
  pageSize: number;
  resumo?: Resumo;
}

interface Resumo {
  total: number;
  pendentes: number;
  finalizados: number;
  erros: number;
  ignorados: number;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  finalizado: 'Finalizado',
  erro: 'Erro',
  ignorado: 'Ignorado',
};

const TIPO_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  receptivo: 'Receptivo',
  indefinido: 'Indefinido',
};

const MENSAGEM_POR_LABELS: Record<string, string> = {
  cliente: 'Cliente',
  nos: 'Nós',
  desconhecido: 'Desconhecido',
};

interface FiltrosDraft {
  busca: string;
  status: StatusFechamento | '';
  tipo: TipoChamadoFechamento | '';
  mensagemPor: UltimaMensagemPor | '';
  conexao: string;
}

const FILTROS_VAZIOS: FiltrosDraft = {
  busca: '',
  status: '',
  tipo: '',
  mensagemPor: '',
  conexao: '',
};

function BadgeStatus({ status }: { status: string }) {
  const tone = status === 'finalizado' ? 'success' : status === 'erro' ? 'danger' : status === 'pendente' ? 'warning' : 'neutral';
  const Icon = status === 'finalizado' ? CheckCircle2 : status === 'erro' ? XCircle : status === 'pendente' ? Clock : undefined;
  return <Badge tone={tone}>{Icon && <Icon className="size-3" />}{STATUS_LABELS[status] ?? status}</Badge>;
}

function BadgeTipo({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-xs text-muted-foreground">—</span>;
  return <Badge tone={tipo === 'ativo' ? 'info' : tipo === 'receptivo' ? 'brand' : 'neutral'}>{TIPO_LABELS[tipo] ?? tipo}</Badge>;
}

function BadgePor({ por }: { por: string | null }) {
  if (!por) return <span className="text-xs text-muted-foreground">—</span>;
  return <Badge tone={por === 'cliente' ? 'warning' : por === 'nos' ? 'info' : 'neutral'}>{MENSAGEM_POR_LABELS[por] ?? por}</Badge>;
}

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function FinalizacoesAutomaticasPageClient() {
  const [data, setData] = useState<ListagemResponse | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const filters = useFilterState<FiltrosDraft>(FILTROS_VAZIOS);
  const [conexoes, setConexoes] = useState<ConexaoDisponivel[]>([]);
  const [toggleConexaoId, setToggleConexaoId] = useState<string | null>(null);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [sucessoConexao, setSucessoConexao] = useState<string | null>(null);
  const [conexoesExpandido, setConexoesExpandido] = useState(false);

  const [execucoes, setExecucoes] = useState<ExecucoesResponse | null>(null);
  const [isCarregandoExecucoes, setIsCarregandoExecucoes] = useState(false);
  const [isExecutandoManual, setIsExecutandoManual] = useState(false);
  const [resultadoExecucaoManual, setResultadoExecucaoManual] = useState<{ status: string; mensagem: string; totalFinalizados: number; totalErros: number; totalIgnorados: number } | null>(null);
  const [erroExecucaoManual, setErroExecucaoManual] = useState<string | null>(null);

  const [isRegistrando, setIsRegistrando] = useState(false);
  const [resultadoRegistro, setResultadoRegistro] = useState<{
    totalInseridos: number;
    totalJaExistentes: number;
    totalErros: number;
    totalIgnorados: number;
  } | null>(null);
  const [erroRegistro, setErroRegistro] = useState<string | null>(null);

  const [fechandoId, setFechandoId] = useState<string | null>(null);
  const [erroFechar, setErroFechar] = useState<string | null>(null);
  const [sucessoFechar, setSucessoFechar] = useState<string | null>(null);

  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const [erroVerificar, setErroVerificar] = useState<string | null>(null);
  const [sucessoVerificar, setSucessoVerificar] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isFechandoLote, setIsFechandoLote] = useState(false);
  const [resultadoLote, setResultadoLote] = useState<{
    totalFinalizados: number;
    totalErros: number;
    totalIgnorados: number;
  } | null>(null);
  const [erroLote, setErroLote] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const itensSeleccionaveis = (data?.items ?? []).filter(
    i => i.status === 'pendente' || i.status === 'erro'
  );

  const todosSeleccionados =
    itensSeleccionaveis.length > 0 &&
    itensSeleccionaveis.every(i => selecionados.has(i.id));

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(itensSeleccionaveis.map(i => i.id)));
    }
  };

  const handleFecharChamado = async (id: string) => {
    setFechandoId(id);
    setErroFechar(null);
    setSucessoFechar(null);
    try {
      const res = await fetch(`/api/digisac/finalizacoes-automaticas/${id}/fechar`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Erro ${res.status}`);
      }
      setSucessoFechar(`Chamado ${json.protocolo ?? json.digisac_ticket_id?.slice(0, 8)} fechado com sucesso.`);
      setSelecionados(prev => { const next = new Set(prev); next.delete(id); return next; });
      buscarDados(page);
      buscarResumoGlobal();
    } catch (err) {
      setErroFechar(err instanceof Error ? err.message : 'Erro ao fechar chamado');
    } finally {
      setFechandoId(null);
    }
  };

  const handleVerificarStatus = async (id: string) => {
    setVerificandoId(id);
    setErroVerificar(null);
    setSucessoVerificar(null);
    try {
      const res = await fetch(`/api/digisac/finalizacoes-automaticas/${id}/verificar-status`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Erro ${res.status}`);
      }
      if (json.fechado) {
        setSucessoVerificar(`Chamado ${json.protocolo ?? ''} confirmado como fechado no Digisac.`);
      } else {
        setErroVerificar(json.mensagem ?? 'Chamado segue aberto no Digisac');
      }
      buscarDados(page);
    } catch (err) {
      setErroVerificar(err instanceof Error ? err.message : 'Erro ao verificar status');
    } finally {
      setVerificandoId(null);
    }
  };

  const handleFecharSelecionados = async () => {
    if (selecionados.size === 0) return;
    setIsFechandoLote(true);
    setResultadoLote(null);
    setErroLote(null);
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/fechar-selecionados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selecionados) }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      setResultadoLote({
        totalFinalizados: json.totalFinalizados ?? 0,
        totalErros: json.totalErros ?? 0,
        totalIgnorados: json.totalIgnorados ?? 0,
      });
      setSelecionados(new Set());
      buscarDados(page);
      buscarResumoGlobal();
    } catch (err) {
      setErroLote(err instanceof Error ? err.message : 'Erro ao fechar selecionados');
    } finally {
      setIsFechandoLote(false);
    }
  };

  const handleRegistrarPendentes = async () => {
    setIsRegistrando(true);
    setResultadoRegistro(null);
    setErroRegistro(null);
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/registrar-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters.draft.conexao ? { serviceId: filters.draft.conexao } : {}),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      if (json.ok) {
        setResultadoRegistro({
          totalInseridos: json.totalInseridos ?? 0,
          totalJaExistentes: json.totalJaExistentes ?? 0,
          totalErros: json.totalErros ?? 0,
          totalIgnorados: json.totalIgnorados ?? 0,
        });
      } else {
        throw new Error(json.error ?? 'Erro desconhecido');
      }
      buscarDados(1);
      setPage(1);
      buscarResumoGlobal();
    } catch (err) {
      setErroRegistro(err instanceof Error ? err.message : 'Erro ao registrar pendentes');
    } finally {
      setIsRegistrando(false);
    }
  };

  const carregarExecucoes = useCallback(async () => {
    setIsCarregandoExecucoes(true);
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/execucoes');
      if (!res.ok) return;
      const json: ExecucoesResponse = await res.json();
      setExecucoes(json);
    } catch {
      // silencioso
    } finally {
      setIsCarregandoExecucoes(false);
    }
  }, []);

  const handleExecutarManual = async () => {
    setIsExecutandoManual(true);
    setResultadoExecucaoManual(null);
    setErroExecucaoManual(null);
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/executar', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      setResultadoExecucaoManual({
        status: json.fechamento?.status ?? 'sucesso',
        mensagem: json.fechamento?.mensagem ?? 'Execucao concluida',
        totalFinalizados: json.fechamento?.totalFinalizados ?? 0,
        totalErros: json.fechamento?.totalErros ?? 0,
        totalIgnorados: json.fechamento?.totalIgnorados ?? 0,
      });
      carregarExecucoes();
      buscarDados(page);
      buscarResumoGlobal();
    } catch (err) {
      setErroExecucaoManual(err instanceof Error ? err.message : 'Erro ao executar');
    } finally {
      setIsExecutandoManual(false);
    }
  };

  const carregarConexoes = useCallback(async () => {
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/conexoes');
      const json = await res.json();
      if (json.ok && Array.isArray(json.conexoes)) {
        setConexoes(json.conexoes);
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    carregarConexoes();
    carregarExecucoes();
  }, [carregarConexoes, carregarExecucoes]);

  const handleToggleConexao = async (serviceId: string, serviceName: string, ativoAtual: boolean) => {
    setToggleConexaoId(serviceId);
    setErroConexao(null);
    setSucessoConexao(null);
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/conexoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, ativo: !ativoAtual }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Erro ${res.status}`);
      }
      setSucessoConexao(`${serviceName} ${!ativoAtual ? 'ativada' : 'desativada'} com sucesso.`);
      await carregarConexoes();
      if (filters.draft.conexao === serviceId && ativoAtual) {
        filters.setField('conexao', '');
      }
    } catch (err) {
      setErroConexao(err instanceof Error ? err.message : 'Erro ao alterar conexao');
    } finally {
      setToggleConexaoId(null);
    }
  };

  const buscarResumoGlobal = useCallback(async () => {
    try {
      const res = await fetch('/api/digisac/finalizacoes-automaticas/resumo');
      if (!res.ok) return;
      const json = await res.json();
      if (json.resumo) {
        setResumo(json.resumo);
      }
    } catch {
      // silencioso
    }
  }, []);

  const buscarDados = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', String(TABLE_PAGE_SIZE));
      if (filters.applied.busca.trim()) params.set('busca', filters.applied.busca.trim());
      if (filters.applied.status) params.set('status', filters.applied.status);
      if (filters.applied.tipo) params.set('tipoChamado', filters.applied.tipo);
      if (filters.applied.mensagemPor) params.set('ultimaMensagemPor', filters.applied.mensagemPor);
      if (filters.applied.conexao) params.set('serviceId', filters.applied.conexao);

      const res = await fetch(`/api/digisac/finalizacoes-automaticas?${params.toString()}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json: ListagemResponse = await res.json();
      setData(json);

      if (json.resumo) {
        setResumo(json.resumo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [filters.applied]);

  useEffect(() => {
    buscarDados(1);
    setPage(1);
  }, [buscarDados]);

  const totalPages = data ? Math.ceil(data.total / TABLE_PAGE_SIZE) : 0;

  const columns: ResponsiveTableColumn<RegistroFechamentoAutomatico>[] = [
    { key: 'data', header: 'Data', width: 'compact', render: (item) => formatarData(item.finalizado_em ?? item.created_at) },
    { key: 'contato', header: 'Contato', width: 'content', className: 'font-medium text-slate-800', render: (item) => <><div>{item.nome_contato ?? '—'}</div>{item.telefone_contato && <div className="text-xs font-normal text-muted-foreground">{item.telefone_contato}</div>}</> },
    { key: 'conexao', header: 'Conexão', width: 'standard', render: (item) => item.service_name ?? conexoes.find(c => c.serviceId === item.service_id)?.serviceName ?? item.service_id?.slice(0, 8) ?? '—' },
    { key: 'protocolo', header: 'Protocolo', width: 'content', render: (item) => item.protocolo && item.ticket_history_url ? <a href={item.ticket_history_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{item.protocolo}<ExternalLink className="size-3" /></a> : item.protocolo ?? '—' },
    { key: 'tipo', header: 'Tipo', width: 'compact', render: (item) => <BadgeTipo tipo={item.tipo_chamado} /> },
    { key: 'mensagem', header: 'Última msg.', width: 'compact', render: (item) => <BadgePor por={item.ultima_mensagem_por} /> },
    { key: 'ultima', header: 'Última msg. em', width: 'compact', render: (item) => formatarData(item.ultima_mensagem_em) },
    { key: 'horas', header: 'Horas sem int.', width: 'compact', render: (item) => item.horas_sem_interacao != null ? `${item.horas_sem_interacao}h` : '—' },
    { key: 'status', header: 'Status', width: 'compact', render: (item) => <BadgeStatus status={item.status} /> },
    { key: 'erro', header: 'Erro', width: 'wide', className: 'text-destructive', render: (item) => item.erro ?? '—' },
    { key: 'acao', header: 'Ação', width: 'compact', render: (item) => <div className="flex flex-col items-start gap-2">{(item.status === 'pendente' || item.status === 'erro') && <Checkbox checked={selecionados.has(item.id)} onCheckedChange={() => toggleSelecionado(item.id)} aria-label={`Selecionar ${item.protocolo ?? item.id}`} />}{item.status === 'pendente' ? <Button size="sm" variant="destructive" loading={fechandoId === item.id} disabled={isFechandoLote} onClick={() => setConfirmacao({ title: 'Fechar chamado?', description: 'Esta ação fecha o chamado real no Digisac.', confirmLabel: 'Fechar chamado', onConfirm: () => handleFecharChamado(item.id) })}><Lock className="size-3" />Fechar</Button> : item.status === 'erro' ? <div className="flex flex-col gap-1"><Button size="sm" variant="destructive" loading={fechandoId === item.id} disabled={isFechandoLote || verificandoId === item.id} onClick={() => setConfirmacao({ title: 'Tentar novamente?', description: 'Esta ação tenta fechar o chamado real no Digisac.', confirmLabel: 'Tentar fechar', onConfirm: () => handleFecharChamado(item.id) })}><RefreshCw className="size-3" />Tentar</Button><Button size="sm" variant="secondary" loading={verificandoId === item.id} disabled={isFechandoLote || fechandoId === item.id} onClick={() => handleVerificarStatus(item.id)}><Search className="size-3" />Verificar</Button></div> : '—'}</div> },
  ];

  return (
    <PageContainer className="space-y-6">

        {/* Header */}
        <PageHeader
          icon={<Bot className="size-6" />}
          eyebrow="Digisac"
          title="Finalizações automáticas"
          description="Acompanhamento dos chamados finalizados automaticamente após 24h sem interação."
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="destructive"
                loading={isFechandoLote}
                disabled={selecionados.size === 0}
                onClick={() => setConfirmacao({
                  title: 'Fechar chamados selecionados?',
                  description: `Esta ação fecha ${selecionados.size} chamado(s) real(is) no Digisac.`,
                  confirmLabel: 'Fechar selecionados',
                  onConfirm: handleFecharSelecionados,
                })}
              >
                <Lock className="size-4" />
                Fechar selecionados{selecionados.size > 0 && ` (${selecionados.size})`}
              </Button>
              <Button variant="secondary" loading={isRegistrando} onClick={handleRegistrarPendentes}>
                <RefreshCw className="size-4" />
                Atualizar chamados
              </Button>
            </div>
          }
        />
        <p className="-mt-4 text-right text-xs text-muted-foreground">Busca no Digisac novos chamados elegíveis e registra como pendentes. Não finaliza chamados.</p>

        {/* Bloco de status da automacao */}
        <Card className="p-4">
          <CardHeader
            icon={<History className="size-4" />}
            title="Status da automação"
            action={<div className="flex items-center gap-2">
              <Button size="sm" loading={isExecutandoManual} onClick={() => setConfirmacao({
                title: 'Executar finalizações automáticas?',
                description: 'A ação busca chamados elegíveis no Digisac e finaliza os pendentes.',
                confirmLabel: 'Executar agora',
                destructive: false,
                onConfirm: handleExecutarManual,
              })}><Play className="size-3.5" />Executar agora</Button>
              <Button variant="ghost" size="sm" loading={isCarregandoExecucoes} onClick={carregarExecucoes}><RefreshCw className="size-3.5" />Atualizar</Button>
            </div>}
          />
          <CardContent className="space-y-3">

          {erroExecucaoManual && (
            <Alert tone="danger" title="Não foi possível executar a automação.">{erroExecucaoManual}</Alert>
          )}
          {resultadoExecucaoManual && (
            <Alert tone="success" title="Execução manual concluída.">
              <span>Execucao manual concluida:</span>
              <span><strong>{resultadoExecucaoManual.totalFinalizados}</strong> finalizados</span>
              {resultadoExecucaoManual.totalErros > 0 && <span><strong>{resultadoExecucaoManual.totalErros}</strong> erros</span>}
              {resultadoExecucaoManual.totalIgnorados > 0 && <span><strong>{resultadoExecucaoManual.totalIgnorados}</strong> ignorados</span>}
              <span className="italic">{resultadoExecucaoManual.mensagem}</span>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ultima execucao automatica (cron) */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Ultima execucao automatica (cron)</p>
              {!execucoes ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : !execucoes.ultimaCron ? (
                <p className="text-xs text-slate-400">Nenhuma execucao registrada ainda.</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {execucoes.ultimaCron.status === 'sucesso' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Sucesso</span>}
                    {execucoes.ultimaCron.status === 'erro' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Erro</span>}
                    {execucoes.ultimaCron.status === 'parcial' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><AlertCircle className="w-3 h-3" />Parcial</span>}
                    {execucoes.ultimaCron.status === 'sem_itens' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><Clock className="w-3 h-3" />Sem itens</span>}
                    {execucoes.ultimaCron.status === 'em_andamento' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" />Em andamento</span>}
                  </div>
                  <p className="text-xs text-slate-600">{formatarData(execucoes.ultimaCron.iniciado_em)}</p>
                  <p className="text-xs text-slate-700"><strong>{execucoes.ultimaCron.total_encontrados}</strong> encontrados · <strong>{execucoes.ultimaCron.total_finalizados}</strong> finalizados · <strong>{execucoes.ultimaCron.total_ignorados}</strong> ignorados · <strong>{execucoes.ultimaCron.total_erros}</strong> erros</p>
                  {execucoes.ultimaCron.duracao_ms != null && <p className="text-xs text-slate-400">Duração: {(execucoes.ultimaCron.duracao_ms / 1000).toFixed(1)}s</p>}
                  {execucoes.ultimaCron.mensagem && <p className="text-xs text-slate-500 italic">{execucoes.ultimaCron.mensagem}</p>}
                  {execucoes.ultimaCron.erro && <p className="text-xs text-red-600 mt-1">Erro: {execucoes.ultimaCron.erro}</p>}
                </div>
              )}
            </div>

            {/* Ultima execucao manual */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Ultima execucao manual</p>
              {!execucoes ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : !execucoes.ultimaManual ? (
                <p className="text-xs text-slate-400">Nenhuma execucao manual registrada.</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {execucoes.ultimaManual.status === 'sucesso' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Sucesso</span>}
                    {execucoes.ultimaManual.status === 'erro' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Erro</span>}
                    {execucoes.ultimaManual.status === 'parcial' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><AlertCircle className="w-3 h-3" />Parcial</span>}
                    {execucoes.ultimaManual.status === 'sem_itens' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><Clock className="w-3 h-3" />Sem itens</span>}
                    {execucoes.ultimaManual.status === 'em_andamento' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" />Em andamento</span>}
                  </div>
                  <p className="text-xs text-slate-600">{formatarData(execucoes.ultimaManual.iniciado_em)}</p>
                  <p className="text-xs text-slate-700"><strong>{execucoes.ultimaManual.total_encontrados}</strong> encontrados · <strong>{execucoes.ultimaManual.total_finalizados}</strong> finalizados · <strong>{execucoes.ultimaManual.total_ignorados}</strong> ignorados · <strong>{execucoes.ultimaManual.total_erros}</strong> erros</p>
                  {execucoes.ultimaManual.duracao_ms != null && <p className="text-xs text-slate-400">Duração: {(execucoes.ultimaManual.duracao_ms / 1000).toFixed(1)}s</p>}
                  {execucoes.ultimaManual.mensagem && <p className="text-xs text-slate-500 italic">{execucoes.ultimaManual.mensagem}</p>}
                  {execucoes.ultimaManual.erro && <p className="text-xs text-red-600 mt-1">Erro: {execucoes.ultimaManual.erro}</p>}
                </div>
              )}
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Resultado de verificacao de status */}
        {erroVerificar && <Alert tone="warning" title="O chamado segue aberto no Digisac.">{erroVerificar}</Alert>}
        {sucessoVerificar && <Alert tone="success">{sucessoVerificar}</Alert>}

        {/* Resultado de fechamento em lote */}
        {erroLote && <Alert tone="danger" title="Erro ao fechar selecionados.">{erroLote}</Alert>}
        {resultadoLote && <Alert tone="success"><strong>{resultadoLote.totalFinalizados}</strong> finalizados; {resultadoLote.totalErros} erros; {resultadoLote.totalIgnorados} ignorados.</Alert>}

        {/* Resultado de fechamento unitario */}
        {erroFechar && <Alert tone="danger" title="Erro ao fechar chamado.">{erroFechar}</Alert>}
        {sucessoFechar && <Alert tone="success">{sucessoFechar}</Alert>}

        {/* Resultado do registro */}
        {erroRegistro && <Alert tone="danger" title="Erro ao registrar pendentes.">{erroRegistro}</Alert>}
        {resultadoRegistro && <Alert tone="info"><strong>{resultadoRegistro.totalInseridos}</strong> inseridos; <strong>{resultadoRegistro.totalJaExistentes}</strong> já existentes; {resultadoRegistro.totalIgnorados} ignorados; {resultadoRegistro.totalErros} erros.</Alert>}

        {/* Resultado toggle conexao */}
        {erroConexao && <Alert tone="danger">{erroConexao}</Alert>}
        {sucessoConexao && <Alert tone="success">{sucessoConexao}</Alert>}

        {/* Conexoes Digisac */}
        <Card className="p-4">
          <button
            onClick={() => setConexoesExpandido(v => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {conexoesExpandido ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <h2 className="text-sm font-semibold text-slate-700">Conexoes Digisac</h2>
            <span className="text-xs text-slate-400">({conexoes.filter(c => c.habilitada).length} ativas de {conexoes.length})</span>
          </button>
          {conexoesExpandido && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {conexoes.map(c => (
                <div
                  key={c.serviceId}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.serviceName}</p>
                    <p className="text-xs text-slate-400">{c.habilitada ? 'Ativa' : 'Inativa'}</p>
                  </div>
                  {c.habilitada ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 mr-2">
                      <Wifi className="w-3 h-3" /> Ativa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 mr-2">
                      <WifiOff className="w-3 h-3" /> Inativa
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleConexao(c.serviceId, c.serviceName, c.habilitada)}
                    disabled={toggleConexaoId === c.serviceId}
                    className={
                      c.habilitada
                        ? 'inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-xs font-medium hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        : 'inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    }
                  >
                    {toggleConexaoId === c.serviceId ? <Loader2 className="w-3 h-3 animate-spin" /> : c.habilitada ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cards resumo */}
        {resumo && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total registrado" value={resumo.total} icon={<FilePlus2 className="size-4" />} />
            <KpiCard label="Pendentes" value={resumo.pendentes} icon={<Clock className="size-4 text-warning" />} />
            <KpiCard label="Finalizados" value={resumo.finalizados} icon={<CheckCircle2 className="size-4 text-success" />} />
            <KpiCard label="Erros" value={resumo.erros} icon={<XCircle className="size-4 text-destructive" />} />
          </div>
        )}

        {/* Filtros */}
        <FilterPanel
          dirty={filters.dirty}
          onApply={() => { filters.apply(); setPage(1); }}
          onClear={() => { filters.clear(); setPage(1); }}
        >
          <FilterFieldGroup label="Pesquisa e status">
            <Input
              type="text"
              placeholder="Buscar por contato, telefone ou protocolo..."
              value={filters.draft.busca}
              onChange={e => filters.setField('busca', e.target.value)}
            />
            <select
              value={filters.draft.status}
              onChange={e => filters.setField('status', e.target.value as StatusFechamento | '')}
              className="border-input bg-input-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="finalizado">Finalizado</option>
              <option value="erro">Erro</option>
              <option value="ignorado">Ignorado</option>
            </select>
            <select
              value={filters.draft.tipo}
              onChange={e => filters.setField('tipo', e.target.value as TipoChamadoFechamento | '')}
              className="border-input bg-input-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Todos os tipos</option>
              <option value="ativo">Ativo</option>
              <option value="receptivo">Receptivo</option>
              <option value="indefinido">Indefinido</option>
            </select>
            <select
              value={filters.draft.mensagemPor}
              onChange={e => filters.setField('mensagemPor', e.target.value as UltimaMensagemPor | '')}
              className="border-input bg-input-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Última msg: todos</option>
              <option value="cliente">Cliente</option>
              <option value="nos">Nós</option>
              <option value="desconhecido">Desconhecido</option>
            </select>
            <select
              value={filters.draft.conexao}
              onChange={e => filters.setField('conexao', e.target.value)}
              className="border-input bg-input-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Todas habilitadas</option>
              {conexoes.filter(c => c.habilitada).map(c => (
                <option key={c.serviceId} value={c.serviceId}>{c.serviceName}</option>
              ))}
            </select>
          </FilterFieldGroup>
        </FilterPanel>

        {/* Estado de erro */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando...
          </div>
        )}

        {/* Tabela */}
        {!isLoading && data && (
          <>
            {data.items.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhum registro encontrado</p>
                <p className="text-slate-400 text-sm mt-1">
                  Ainda não há finalizações automáticas registradas. Os registros aparecerão aqui quando a automação for ativada.
                </p>
                <p className="text-slate-400 text-xs mt-4">
                  Diagnóstico disponível em:{' '}
                  <code className="bg-slate-100 px-1 rounded">/api/digisac/finalizacoes-automaticas/diagnostico</code>
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mb-2">
                  {itensSeleccionaveis.length > 0 && <Button variant="ghost" size="sm" onClick={toggleTodos}>{todosSeleccionados ? 'Desselecionar todos da página' : 'Selecionar todos da página'}</Button>}
                  {selecionados.size > 0 && <><span className="font-medium">{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</span><Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button></>}
                </div>
                <ResponsiveTable
                  columns={columns}
                  rows={data.items}
                  rowKey={(item) => item.id}
                  firstColumnSticky
                  renderMobileCard={(item) => (
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-800">{item.nome_contato ?? '—'}</p>{item.telefone_contato && <p className="text-xs text-muted-foreground">{item.telefone_contato}</p>}</div><BadgeStatus status={item.status} /></div>
                      <div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-xs text-muted-foreground">Protocolo</span><p>{item.protocolo ?? '—'}</p></div><div><span className="text-xs text-muted-foreground">Conexão</span><p>{item.service_name ?? '—'}</p></div><div><span className="text-xs text-muted-foreground">Última mensagem</span><p>{formatarData(item.ultima_mensagem_em)}</p></div><div><span className="text-xs text-muted-foreground">Sem interação</span><p>{item.horas_sem_interacao != null ? `${item.horas_sem_interacao}h` : '—'}</p></div></div>
                      {item.erro && <Alert tone="danger" title="Erro registrado">{item.erro}</Alert>}
                    </div>
                  )}
                />
              <div className="hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={todosSeleccionados}
                          onChange={toggleTodos}
                          className="rounded border-slate-300"
                          title="Selecionar todos selecionáveis da página"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contato</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Conexão</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Protocolo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Última msg por</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Última msg em</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Horas sem int.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Erro</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3">
                          {(item.status === 'pendente' || item.status === 'erro') ? (
                            <input
                              type="checkbox"
                              checked={selecionados.has(item.id)}
                              onChange={() => toggleSelecionado(item.id)}
                              className="rounded border-slate-300"
                            />
                          ) : (
                            <span />
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                          {formatarData(item.finalizado_em ?? item.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{item.nome_contato ?? '—'}</div>
                          {item.telefone_contato && (
                            <div className="text-xs text-slate-400">{item.telefone_contato}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {item.service_name ?? conexoes.find(c => c.serviceId === item.service_id)?.serviceName ?? item.service_id?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.protocolo && item.ticket_history_url ? (
                            <a
                              href={item.ticket_history_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs"
                            >
                              {item.protocolo}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">{item.protocolo ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><BadgeTipo tipo={item.tipo_chamado} /></td>
                        <td className="px-4 py-3"><BadgePor por={item.ultima_mensagem_por} /></td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatarData(item.ultima_mensagem_em)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 text-center">{item.horas_sem_interacao != null ? `${item.horas_sem_interacao}h` : '—'}</td>
                        <td className="px-4 py-3"><BadgeStatus status={item.status} /></td>
                        <td className="px-4 py-3 text-xs text-red-600 max-w-[200px] truncate" title={item.erro ?? ''}>
                          {item.erro ?? '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.status === 'pendente' && (
                            <button
                              onClick={() => handleFecharChamado(item.id)}
                              disabled={fechandoId === item.id || isFechandoLote}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {fechandoId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                              Fechar chamado
                            </button>
                          )}
                          {item.status === 'erro' && (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleFecharChamado(item.id)}
                                disabled={fechandoId === item.id || isFechandoLote || verificandoId === item.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {fechandoId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Tentar novamente
                              </button>
                              <button
                                onClick={() => handleVerificarStatus(item.id)}
                                disabled={fechandoId === item.id || isFechandoLote || verificandoId === item.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-500 text-white rounded text-xs font-medium hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {verificandoId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                Verificar status
                              </button>
                            </div>
                          )}
                          {item.status !== 'pendente' && item.status !== 'erro' && (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>Total: {data.total} registros</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { const p = page - 1; setPage(p); buscarDados(p); }}
                    disabled={page <= 1}
                  >
                    Anterior
                  </Button>
                  <span>Página {page} de {totalPages}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { const p = page + 1; setPage(p); buscarDados(p); }}
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      {confirmacao && (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setConfirmacao(null); }}
          title={confirmacao.title}
          description={confirmacao.description}
          confirmLabel={confirmacao.confirmLabel}
          destructive={confirmacao.destructive}
          onConfirm={() => { const action = confirmacao.onConfirm; setConfirmacao(null); action(); }}
        />
      )}
    </PageContainer>
  );
}
