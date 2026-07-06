'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, AlertCircle, Bot, CheckCircle2, Clock, XCircle, Loader2, FilePlus2, Lock, RefreshCw, Search, Wifi, WifiOff, ChevronDown, ChevronRight } from 'lucide-react';
import type { RegistroFechamentoAutomatico, StatusFechamento, TipoChamadoFechamento, UltimaMensagemPor } from '@/lib/digisac/finalizacoesAutomaticas';

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

function BadgeStatus({ status }: { status: string }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  if (status === 'finalizado') return <span className={`${base} bg-green-100 text-green-700`}><CheckCircle2 className="w-3 h-3" />{STATUS_LABELS[status] ?? status}</span>;
  if (status === 'erro') return <span className={`${base} bg-red-100 text-red-700`}><XCircle className="w-3 h-3" />{STATUS_LABELS[status] ?? status}</span>;
  if (status === 'pendente') return <span className={`${base} bg-yellow-100 text-yellow-700`}><Clock className="w-3 h-3" />{STATUS_LABELS[status] ?? status}</span>;
  return <span className={`${base} bg-slate-100 text-slate-600`}>{STATUS_LABELS[status] ?? status}</span>;
}

function BadgeTipo({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-slate-400 text-xs">—</span>;
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium';
  if (tipo === 'ativo') return <span className={`${base} bg-blue-100 text-blue-700`}>{TIPO_LABELS[tipo]}</span>;
  if (tipo === 'receptivo') return <span className={`${base} bg-purple-100 text-purple-700`}>{TIPO_LABELS[tipo]}</span>;
  return <span className={`${base} bg-slate-100 text-slate-500`}>{TIPO_LABELS[tipo] ?? tipo}</span>;
}

function BadgePor({ por }: { por: string | null }) {
  if (!por) return <span className="text-slate-400 text-xs">—</span>;
  const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium';
  if (por === 'cliente') return <span className={`${base} bg-orange-100 text-orange-700`}>{MENSAGEM_POR_LABELS[por]}</span>;
  if (por === 'nos') return <span className={`${base} bg-sky-100 text-sky-700`}>{MENSAGEM_POR_LABELS[por]}</span>;
  return <span className={`${base} bg-slate-100 text-slate-500`}>{MENSAGEM_POR_LABELS[por] ?? por}</span>;
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
  const PAGE_SIZE = 30;

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusFechamento | ''>('');
  const [filtroTipo, setFiltroTipo] = useState<TipoChamadoFechamento | ''>('');
  const [filtroMensagemPor, setFiltroMensagemPor] = useState<UltimaMensagemPor | ''>('');
  const [filtroConexao, setFiltroConexao] = useState<string>('');
  const [conexoes, setConexoes] = useState<ConexaoDisponivel[]>([]);
  const [toggleConexaoId, setToggleConexaoId] = useState<string | null>(null);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [sucessoConexao, setSucessoConexao] = useState<string | null>(null);
  const [conexoesExpandido, setConexoesExpandido] = useState(false);

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

  const handleFecharChamado = async (id: string, statusAtual: string) => {
    const msg = statusAtual === 'erro'
      ? 'Tentar novamente fechar este chamado no Digisac?'
      : 'Confirmar fechamento deste chamado no Digisac? Essa ação fecha o chamado real.';
    const confirmado = window.confirm(msg);
    if (!confirmado) return;

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
    const confirmado = window.confirm(
      `Confirmar fechamento dos chamados selecionados no Digisac? Essa ação fecha os chamados reais. (${selecionados.size} selecionados)`
    );
    if (!confirmado) return;

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
        body: JSON.stringify(filtroConexao ? { serviceId: filtroConexao } : {}),
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
    } catch (err) {
      setErroRegistro(err instanceof Error ? err.message : 'Erro ao registrar pendentes');
    } finally {
      setIsRegistrando(false);
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
  }, [carregarConexoes]);

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
      if (filtroConexao === serviceId && ativoAtual) {
        setFiltroConexao('');
      }
    } catch (err) {
      setErroConexao(err instanceof Error ? err.message : 'Erro ao alterar conexao');
    } finally {
      setToggleConexaoId(null);
    }
  };

  const buscarDados = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', String(PAGE_SIZE));
      if (busca.trim()) params.set('busca', busca.trim());
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroTipo) params.set('tipoChamado', filtroTipo);
      if (filtroMensagemPor) params.set('ultimaMensagemPor', filtroMensagemPor);
      if (filtroConexao) params.set('serviceId', filtroConexao);

      const res = await fetch(`/api/digisac/finalizacoes-automaticas?${params.toString()}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json: ListagemResponse = await res.json();
      setData(json);

      if (p === 1 && !filtroStatus && !filtroTipo && !filtroMensagemPor && !busca.trim() && !filtroConexao) {
        const items = json.items;
        const pendentes = items.filter(i => i.status === 'pendente').length;
        const finalizados = items.filter(i => i.status === 'finalizado').length;
        const erros = items.filter(i => i.status === 'erro').length;
        const ignorados = items.filter(i => i.status === 'ignorado').length;
        setResumo({ total: json.total, pendentes, finalizados, erros, ignorados });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [busca, filtroStatus, filtroTipo, filtroMensagemPor, filtroConexao]);

  useEffect(() => {
    buscarDados(1);
    setPage(1);
  }, [buscarDados]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bot className="w-7 h-7 text-slate-600" />
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Finalizações automáticas Digisac</h1>
              <p className="text-sm text-slate-500">Acompanhamento dos chamados finalizados automaticamente após 24h sem interação.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleFecharSelecionados}
                disabled={selecionados.size === 0 || isFechandoLote}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isFechandoLote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Fechar selecionados
                {selecionados.size > 0 && ` (${selecionados.size})`}
              </button>
              <button
                onClick={handleRegistrarPendentes}
                disabled={isRegistrando}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRegistrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Atualizar chamados
              </button>
            </div>
            <p className="text-xs text-slate-400 max-w-xs text-right">
              Busca no Digisac novos chamados elegiveis e registra como pendentes. Nao finaliza chamados.
            </p>
          </div>
        </div>

        {/* Resultado de verificacao de status */}
        {erroVerificar && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erroVerificar}</span>
            <button onClick={() => setErroVerificar(null)} className="ml-auto text-orange-400 hover:text-orange-600 text-xs">Fechar</button>
          </div>
        )}
        {sucessoVerificar && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{sucessoVerificar}</span>
            <button onClick={() => setSucessoVerificar(null)} className="ml-auto text-green-400 hover:text-green-600 text-xs">Fechar</button>
          </div>
        )}

        {/* Resultado de fechamento em lote */}
        {erroLote && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Erro ao fechar selecionados: {erroLote}</span>
            <button onClick={() => setErroLote(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">Fechar</button>
          </div>
        )}
        {resultadoLote && (
          <div className="flex items-center gap-4 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm flex-wrap">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
            <span><strong>{resultadoLote.totalFinalizados}</strong> finalizados</span>
            {resultadoLote.totalErros > 0 && <span className="text-red-600"><strong>{resultadoLote.totalErros}</strong> erros</span>}
            {resultadoLote.totalIgnorados > 0 && <span className="text-slate-500"><strong>{resultadoLote.totalIgnorados}</strong> ignorados</span>}
            <button onClick={() => setResultadoLote(null)} className="ml-auto text-green-400 hover:text-green-600 text-xs">Fechar</button>
          </div>
        )}

        {/* Resultado de fechamento unitario */}
        {erroFechar && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Erro ao fechar: {erroFechar}</span>
            <button onClick={() => setErroFechar(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">Fechar</button>
          </div>
        )}
        {sucessoFechar && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{sucessoFechar}</span>
            <button onClick={() => setSucessoFechar(null)} className="ml-auto text-green-400 hover:text-green-600 text-xs">Fechar</button>
          </div>
        )}

        {/* Resultado do registro */}
        {erroRegistro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Erro ao registrar: {erroRegistro}</span>
          </div>
        )}
        {resultadoRegistro && (
          <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm flex-wrap">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-blue-600" />
            <span><strong>{resultadoRegistro.totalInseridos}</strong> inseridos</span>
            <span><strong>{resultadoRegistro.totalJaExistentes}</strong> já existentes</span>
            {resultadoRegistro.totalIgnorados > 0 && (
              <span><strong>{resultadoRegistro.totalIgnorados}</strong> ignorados (outra conexão)</span>
            )}
            {resultadoRegistro.totalErros > 0 && (
              <span className="text-red-600"><strong>{resultadoRegistro.totalErros}</strong> erros</span>
            )}
          </div>
        )}

        {/* Resultado toggle conexao */}
        {erroConexao && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erroConexao}</span>
            <button onClick={() => setErroConexao(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">Fechar</button>
          </div>
        )}
        {sucessoConexao && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{sucessoConexao}</span>
            <button onClick={() => setSucessoConexao(null)} className="ml-auto text-green-400 hover:text-green-600 text-xs">Fechar</button>
          </div>
        )}

        {/* Conexoes Digisac */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
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
        </div>

        {/* Cards resumo */}
        {resumo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total registrado</p>
              <p className="text-2xl font-bold text-slate-800">{resumo.total}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{resumo.pendentes}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Finalizados</p>
              <p className="text-2xl font-bold text-green-600">{resumo.finalizados}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Erros</p>
              <p className="text-2xl font-bold text-red-600">{resumo.erros}</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Buscar por contato, telefone ou protocolo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value as StatusFechamento | '')}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="finalizado">Finalizado</option>
              <option value="erro">Erro</option>
              <option value="ignorado">Ignorado</option>
            </select>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value as TipoChamadoFechamento | '')}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Todos os tipos</option>
              <option value="ativo">Ativo</option>
              <option value="receptivo">Receptivo</option>
              <option value="indefinido">Indefinido</option>
            </select>
            <select
              value={filtroMensagemPor}
              onChange={e => setFiltroMensagemPor(e.target.value as UltimaMensagemPor | '')}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Última msg: todos</option>
              <option value="cliente">Cliente</option>
              <option value="nos">Nós</option>
              <option value="desconhecido">Desconhecido</option>
            </select>
            <select
              value={filtroConexao}
              onChange={e => setFiltroConexao(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Todas habilitadas</option>
              {conexoes.filter(c => c.habilitada).map(c => (
                <option key={c.serviceId} value={c.serviceId}>{c.serviceName}</option>
              ))}
            </select>
          </div>
        </div>

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
                {selecionados.size > 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                    <span className="font-medium">{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</span>
                    <button onClick={() => setSelecionados(new Set())} className="text-xs text-slate-400 hover:text-slate-600 underline">Limpar sele\u00e7\u00e3o</button>
                  </div>
                )}
              <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
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
                              onClick={() => handleFecharChamado(item.id, item.status)}
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
                                onClick={() => handleFecharChamado(item.id, item.status)}
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
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Total: {data.total} registros</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const p = page - 1; setPage(p); buscarDados(p); }}
                    disabled={page <= 1}
                    className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-100 transition-colors"
                  >
                    Anterior
                  </button>
                  <span>Página {page} de {totalPages}</span>
                  <button
                    onClick={() => { const p = page + 1; setPage(p); buscarDados(p); }}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-100 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
