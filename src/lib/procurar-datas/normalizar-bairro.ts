const CORRECOES_MANUAIS: Record<string, string> = {
  'agua verde': 'Água Verde',
  'cidade industrial': 'Cidade Industrial',
  'sitio cercado': 'Sítio Cercado',
  'vila izabel': 'Vila Izabel',
  'boa vista': 'Boa Vista',
  'barreirinha': 'Barreirinha',
  'bacacheri': 'Bacacheri',
  'bigorrilho': 'Bigorrilho',
  'boqueirao': 'Boqueirão',
  'cabral': 'Cabral',
  'cajuru': 'Cajuru',
  'campo comprido': 'Campo Comprido',
  'capao raso': 'Capão Raso',
  'casa': 'Casa',
  'centro': 'Centro',
  'cidade jardim': 'Cidade Jardim',
  'cristo rei': 'Cristo Rei',
  'guabirotuba': 'Guabirotuba',
  'hauer': 'Hauer',
  'alto boqueirao': 'Alto Boqueirão',
  'bairro alto': 'Bairro Alto',
  'merces': 'Mercês',
  'novo mundo': 'Novo Mundo',
  'pinheirinho': 'Pinheirinho',
  'portao': 'Portão',
  'santa felicidade': 'Santa Felicidade',
  'uberaba': 'Uberaba',
  'vista alegre': 'Vista Alegre',
};

export function normalizarBairro(bairro: string | null | undefined): string {
  if (!bairro || bairro.trim() === '') return '(sem bairro)';

  const trimmed = bairro.trim();
  const lower = trimmed.toLowerCase();
  const semAcento = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const semEspacosDuplos = semAcento.replace(/\s+/g, ' ').trim();

  if (CORRECOES_MANUAIS[semEspacosDuplos]) {
    return CORRECOES_MANUAIS[semEspacosDuplos];
  }

  return semEspacosDuplos
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizarListaBairros(
  itens: { bairro: string | null; total: number; cidade?: string | null; uf?: string | null; provider?: string | null }[]
): { bairro: string; total: number; cidade: string | null; uf: string | null; provider: string | null }[] {
  const mapa = new Map<string, { total: number; cidade: string | null; uf: string | null; provider: string | null }>();

  for (const item of itens) {
    const normalizado = normalizarBairro(item.bairro);
    const existente = mapa.get(normalizado);
    if (existente) {
      existente.total += item.total;
    } else {
      mapa.set(normalizado, {
        total: item.total,
        cidade: item.cidade ?? null,
        uf: item.uf ?? null,
        provider: item.provider ?? null,
      });
    }
  }

  return Array.from(mapa.entries())
    .map(([bairro, dados]) => ({ bairro, ...dados }))
    .sort((a, b) => b.total - a.total);
}
