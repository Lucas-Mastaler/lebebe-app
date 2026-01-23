'use client';

import { useState, useMemo, useRef } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Agendamento, PesquisaResponse } from '@/types';
import { ModalTextoLongo } from './ModalTextoLongo';
import { cn } from '@/lib/utils';
import { BarraScrollHorizontalFixa } from './BarraScrollHorizontalFixa';

interface TabelaAgendamentosProps {
    data: PesquisaResponse | null;
    isLoading: boolean;
    error: string | null;
    clienteNomeFiltro: string;
    onPageChange: (page: number) => void;
}

const statusColors = {
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    destructive: 'bg-red-100 text-red-700 border-red-200',
};

function TruncatedCell({
    text,
    onViewFull,
}: {
    text: string;
    onViewFull: (title: string, content: string) => void;
}) {
    if (!text) return <span className="text-slate-400">-</span>;

    return (
        <div
            onClick={() => onViewFull('Visualização completa', text)}
            className="truncate max-w-full cursor-pointer hover:text-[#00A5E6] transition-colors"
            title="Clique para ver o conteúdo completo"
        >
            {text}
        </div>
    );
}

export function TabelaAgendamentos({
    data,
    isLoading,
    error,
    clienteNomeFiltro,
    onPageChange,
}: TabelaAgendamentosProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', content: '' });

    const handleViewFull = (title: string, content: string) => {
        setModalContent({ title, content });
        setModalOpen(true);
    };

    // Scroll container ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter by client name locally
    const filteredItems = useMemo(() => {
        if (!data?.items) return [];
        if (!clienteNomeFiltro.trim()) return data.items;

        const searchTerm = clienteNomeFiltro.toLowerCase().trim();
        return data.items.filter((item) =>
            item.nomeWhatsapp?.toLowerCase().includes(searchTerm) ||
            item.nomeDigisac?.toLowerCase().includes(searchTerm)
        );
    }, [data?.items, clienteNomeFiltro]);

    // Loading state
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 card-shadow">
                <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-red-200 p-6">
                <div className="flex items-center gap-3 text-red-600">
                    <span className="text-lg">⚠️</span>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    // No data state
    if (!data) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <p className="text-slate-500">
                    Use os filtros acima para pesquisar agendamentos.
                </p>
            </div>
        );
    }

    // Empty results state
    if (filteredItems.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <p className="text-slate-500">
                    Nenhum resultado para os filtros selecionados.
                </p>
            </div>
        );
    }

    const { meta } = data;

    return (
        <>
            <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-hidden flex flex-col mb-4">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
                    <h3 className="font-semibold text-slate-900">Resultados</h3>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
                        {meta.total} {meta.total === 1 ? 'item' : 'itens'}
                    </span>
                </div>

                {/* Table Window - scrolling container */}
                {/* min-w-[1400px] ensures horizontal scroll exists for small screens, pushing content out */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto w-full relative scrollbar-hide"
                >
                    <div className="min-w-[1500px]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[150px]">Loja</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[180px]">Consultora</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[180px]">Nome Whatsapp</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[180px]">Nome Digisac</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[250px]">Mensagem agendada</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[250px]">Comentário</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[200px]">Tags</TableHead>
                                    {/* Campos Personalizados REMOVIDO */}
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[100px]">Status</TableHead>
                                    {/* Novas Colunas */}
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[120px]">Status chamado</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[160px]">Último chamado fechado</TableHead>

                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[100px]">Abrir ticket?</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[100px]">Notificar?</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[120px]">Agendado (dia)</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[100px]">Agendado (hr)</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[120px]">Criado em</TableHead>
                                    <TableHead className="font-semibold text-slate-700 whitespace-nowrap w-[120px]">Atualizado em</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                        <TableCell className="whitespace-nowrap font-medium text-slate-700">{item.loja || '-'}</TableCell>
                                        <TableCell className="whitespace-nowrap">{item.consultora || '-'}</TableCell>
                                        <TableCell className="whitespace-nowrap font-medium text-slate-800">{item.nomeWhatsapp || '-'}</TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-600">{item.nomeDigisac || '-'}</TableCell>
                                        <TableCell className="max-w-[250px]">
                                            <TruncatedCell text={item.mensagemAgendada} onViewFull={handleViewFull} />
                                        </TableCell>
                                        <TableCell className="max-w-[250px]">
                                            <TruncatedCell text={item.comentario} onViewFull={handleViewFull} />
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <TruncatedCell text={item.tags} onViewFull={handleViewFull} />
                                        </TableCell>

                                        <TableCell>
                                            <span
                                                className={cn(
                                                    'px-2.5 py-1 text-xs font-medium rounded-full border shadow-sm',
                                                    statusColors[item.statusBadgeVariant] || 'bg-slate-100 text-slate-600 border-slate-200'
                                                )}
                                            >
                                                {item.statusLabel}
                                            </span>
                                        </TableCell>

                                        {/* Novas Colunas Dados */}
                                        <TableCell className="whitespace-nowrap">
                                            <span className={cn(
                                                "px-2 py-0.5 text-xs rounded-full font-medium",
                                                item.statusChamado === 'Aberto'
                                                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                            )}>
                                                {item.statusChamado || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-600 text-xs">{item.ultimoChamadoFechado || '-'}</TableCell>

                                        <TableCell className="whitespace-nowrap">{item.abrirTicketLabel}</TableCell>
                                        <TableCell className="whitespace-nowrap">{item.notificarLabel}</TableCell>
                                        <TableCell className="whitespace-nowrap">{item.agendadoDia}</TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-500">{item.agendadoHora || '-'}</TableCell>
                                        <TableCell className="whitespace-nowrap text-xs text-slate-400">{item.criadoEm}</TableCell>
                                        <TableCell className="whitespace-nowrap text-xs text-slate-400">{item.atualizadoEm}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                        Página {meta.currentPage} de {meta.lastPage}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(meta.currentPage - 1)}
                            disabled={meta.currentPage <= 1}
                            className="rounded-xl"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(meta.currentPage + 1)}
                            disabled={meta.currentPage >= meta.lastPage}
                            className="rounded-xl"
                        >
                            Próxima
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Sticky Scrollbar */}
            <BarraScrollHorizontalFixa targetRef={scrollContainerRef} bottomOffset={0} />

            {/* Modal for long text */}
            <ModalTextoLongo
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalContent.title}
                content={modalContent.content}
            />
        </>
    );
}
