import React, { useEffect, useRef, useState } from 'react';

interface BarraScrollHorizontalFixaProps {
    /** 
     * Ref do elemento que contém o conteúdo que scrolla horizontalmente.
     * A barra vai sincronizar com esse elemento.
     */
    targetRef: React.RefObject<HTMLDivElement | null>;
    /**
     * Margem inferior para nao colar no fundo da tela se tiver outros elementos fixos.
     * Default 0.
     */
    bottomOffset?: number;
}

export function BarraScrollHorizontalFixa({ targetRef, bottomOffset = 0 }: BarraScrollHorizontalFixaProps) {
    const scrollTrackRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [contentWidth, setContentWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    // Sincronizar scroll: Barra -> Tabela
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (targetRef.current && scrollTrackRef.current) {
            // Evitar loop infinito de eventos de scroll
            // Se a diferença for pequena, ignorar? Não, React normaliza.
            // Apenas setar se diferente.
            if (targetRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
                targetRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
        }
    };

    useEffect(() => {
        const target = targetRef.current;
        const track = scrollTrackRef.current;
        if (!target) return;

        // Sincronizar scroll: Tabela -> Barra
        const handleTargetScroll = () => {
            if (track && track.scrollLeft !== target.scrollLeft) {
                track.scrollLeft = target.scrollLeft;
            }
        };

        target.addEventListener('scroll', handleTargetScroll);

        // Monitorar redimensionamento para ajustar largura do "conteúdo dummy" da barra
        // e visibilidade.
        const updateMetrics = () => {
            if (!target) return;
            const sWidth = target.scrollWidth;
            const cWidth = target.clientWidth;

            setContentWidth(sWidth);
            setContainerWidth(cWidth);
            // Mostrar apenas se houver scroll
            setIsVisible(sWidth > cWidth + 1); // +1 margem de erro
        };

        // ResizeObserver é melhor que window.resize pois detecta mudanças no elemento (ex: dados carregaram e tabela cresceu)
        const resizeObserver = new ResizeObserver(() => {
            updateMetrics();
        });

        resizeObserver.observe(target);
        // Também observar o body para garantir redimensionamentos da janela
        resizeObserver.observe(document.body);

        // Initial check
        updateMetrics();

        return () => {
            target.removeEventListener('scroll', handleTargetScroll);
            resizeObserver.disconnect();
        };
    }, [targetRef]);

    if (!isVisible) return null;

    return (
        <div
            ref={scrollTrackRef}
            onScroll={handleScroll}
            className="fixed left-0 right-0 z-50 overflow-x-auto bg-white/80 backdrop-blur border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] py-2"
            style={{
                bottom: bottomOffset,
                zIndex: 9999 // Garantir que fique acima de tudo no rodapé
            }}
        >
            {/* Elemento fantasma que força a largura do scroll */}
            <div style={{ width: contentWidth, height: '1px' }} />
        </div>
    );
}
