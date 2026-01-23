import { fetchDigisac } from './clienteDigisac';
import { executarComLimite } from './limiteConcorrencia';

// Cache simples em memória: ContactId -> { data: ContactData, timestamp: number }
const contactCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

export async function buscarContatoCompleto(contactId: string): Promise<any> {
    const now = Date.now();
    const cached = contactCache.get(contactId);

    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    try {
        // Tentativa 1: Busca direta por ID com includes
        // Tenta buscar endpoint padrão. A API do Digisac costuma ser /contacts/{id}
        // Se precisar de include, adicionamos query params.
        // O prompt pede tags e customFields. Geralmente vêm no detalhe, mas vamos garantir.
        let contato = await fetchDigisac(`/contacts/${contactId}?include[0][model]=tag&include[1][model]=service`);
        // Nota: O prompt diz 'Incluir tags e customFields'. 
        // Em muitas impls do Digisac, customFields vem na raiz ou como 'data'. Tags vem como relação.
        // Ajuste conforme padrão comum se não especificado, mas o prompt deu dica de include.

        // Se a busca direta falhar (ex: 404 ou 400 por formato de ID, embora aqui devêssemos ter IDs validos do schedule), 
        // vamos ao fallback se der erro que não seja 404 real? 
        // O prompt pediu "fallback (tenta /contacts/{id}... se falhar usa listagem)".

        if (!contato || !contato.id) {
            throw new Error('Contato vazio na busca direta');
        }

        contactCache.set(contactId, { data: contato, timestamp: now });
        return contato;

    } catch (e) {
        console.warn(`[DIGISAC] Falha ao buscar contato ${contactId} via ID direto. Tentando fallback listagem.`, e);

        try {
            // Tentativa 2: Fallback via listagem filtrada
            const listagem = await fetchDigisac(`/contacts?where[id]=${contactId}&include[0][model]=tag`);
            // Digisac list response usually: { rows: [...], count: ... } or just array? 
            // O prompt do schedule diz `items: []`. Vamos assumir padrão Digisac comum `rows` ou array direto.
            // Para segurança, checamos ambos.

            const itens = Array.isArray(listagem) ? listagem : (listagem.rows || listagem.data || []);
            const contato = itens[0];

            if (contato) {
                contactCache.set(contactId, { data: contato, timestamp: now });
                return contato;
            }
        } catch (e2) {
            console.error(`[DIGISAC] Falha total ao buscar contato ${contactId}`, e2);
        }
    }

    // Se falhar tudo, retorna null/objeto vazio para não quebrar a tabela
    return { name: 'Desconhecido (Erro)' };
}

export async function buscarContatosPorIds(contactIds: string[]): Promise<Map<string, any>> {
    // Deduplicar IDs
    const uniqueIds = Array.from(new Set(contactIds)).filter(id => !!id);

    // Limitador de concorrência usando o helper (que vamos assumir existir e importar corretamente, vou corrigir o import acima se o nome for diferente)
    // O nome do arquivo criado foi limiteConcorrencia.ts e a função executarComLimite.

    // Função wrapper que retorna [id, data]
    const tasks = uniqueIds.map(id => async () => {
        const data = await buscarContatoCompleto(id);
        return { id, data };
    });

    // Import da função correta
    const { executarComLimite } = await import('./limiteConcorrencia');

    const resultados = await executarComLimite(tasks, 5); // 5 requisições simultâneas

    const mapa = new Map<string, any>();
    resultados.forEach(r => mapa.set(r.id, r.data));

    return mapa;
}
