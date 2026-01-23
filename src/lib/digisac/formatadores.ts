
export function formatarDataPtBr(isoString: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Ajuste fuso horário se necessário, mas 'dd/mm/aaaa' local do servidor pode ser UTC se não cuidar.
        // O prompt pede uso de data-fns ou nativo. Vamos de nativo com Intl para Pt-BR que trata timezone corretamente se passar o options.
        // Mas a string ISO já tem o ponto no tempo. 
        // Se quisermos exibir na timezone do usuario/navegador, o front faz isso. 
        // O BACKEND deve retornar string formatada "dd/mm/aaaa"; vamos assumir timezone America/Sao_Paulo (o cliente é BR).

        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        }).format(date);
    } catch {
        return isoString;
    }
}

export function formatarHoraPtBr(isoString: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Sao_Paulo'
        }).format(date);
    } catch {
        return isoString;
    }
}

export function formatarTags(tags: any[]): string {
    if (!Array.isArray(tags) || tags.length === 0) return '';
    // Preferir label quando existir (padrão n8n), com fallbacks comuns
    return tags
        .map((t) => t.label || t.name || t.title || (t.tag?.name) || t)
        .join(', ');
}

export function formatarCamposPersonalizados(customFields: any): string {
    if (!customFields) return '';

    // Pode vir como objeto { "key": "value" } ou array [{ label: "...", value: "..." }]
    // O prompt diz "CampoX: Valor | CampoY: Valor"

    if (Array.isArray(customFields)) {
        return customFields
            .map(cf => `${cf.label || cf.name}: ${cf.value}`)
            .join(' | ');
    }

    if (typeof customFields === 'object') {
        return Object.entries(customFields)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
    }

    return '';
}
