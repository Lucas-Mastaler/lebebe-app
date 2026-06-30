const CORRECOES_MANUAIS: Record<string, string> = {
  'agua verde': 'Água Verde',
  'cidade industrial': 'Cidade Industrial',
  'cidade industrial de curitiba': 'Cidade Industrial de Curitiba',
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
  'reboucas': 'Rebouças',
  'santo antonio': 'Santo Antônio',
  'iguacu': 'Iguaçu',
  'sao miguel': 'São Miguel',
  'santo inacio': 'Santo Inácio',
  'ahu': 'Ahú',
  'sao marcos': 'São Marcos',
  'guaira': 'Guaíra',
  'alto da gloria': 'Alto da Glória',
  'mossungue': 'Mossunguê',
  'umbara': 'Umbará',
  'sao domingos': 'São Domingos',
  'santa quiteria': 'Santa Quitéria',
  'cambui': 'Cambuí',
  'ina': 'Iná',
  'jardim das americas': 'Jardim das Américas',
  'campina do siqueira': 'Campina do Siqueira',
  'parque da fonte': 'Parque da Fonte',
  'campina da barra': 'Campina da Barra',
  'centro civico': 'Centro Cívico',
  'sao joao': 'São João',
  'sao lourenco': 'São Lourenço',
  'weissopolis': 'Weissópolis',
  'lindoia': 'Lindóia',
  'tatuquara': 'Tatuquara',
  'parolin': 'Parolin',
  'orleans': 'Orleans',
  'costeira': 'Costeira',
  'vargem grande': 'Vargem Grande',
  'pilarzinho': 'Pilarzinho',
  'pedro moro': 'Pedro Moro',
  'tingui': 'Tingui',
  'atuba': 'Atuba',
  'xaxim': 'Xaxim',
  'cic': 'CIC',
  'abranches': 'Abranches',
  'cascatinha': 'Cascatinha',
  'estados': 'Estados',
  'gralha azul': 'Gralha Azul',
  'pineville': 'Pineville',
  'campo de santana': 'Campo de Santana',
  'emiliano perneta': 'Emiliano Perneta',
  'alto da rua xv': 'Alto da Rua XV',
  'jardim botanico': 'Jardim Botânico',
  'cachoeira': 'Cachoeira',
  'itaqui': 'Itaqui',
  'lapa': 'Lapa',
  'batel': 'Batel',
  'arruda': 'Arruda',
  'seminario': 'Seminário',
  'afonso pena': 'Afonso Pena',
  'estrela': 'Estrela',
  'pinhais': 'Pinhais',
  'jardim elizabete': 'Jardim Elizabete',
  'santa candida': 'Santa Cândida',
  'campo pequeno': 'Campo Pequeno',
};

const PALAVRAS_LIGACAO = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

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
    .map((word, idx) => {
      if (idx > 0 && PALAVRAS_LIGACAO.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function normalizarListaBairros(
  itens: { bairro: string | null; total: number; cidade?: string | null; uf?: string | null; provider?: string | null }[]
): { bairro: string; total: number; cidade: string | null; uf: string | null; provider: string | null }[] {
  const mapa = new Map<string, { total: number; cidade: string | null; uf: string | null; provider: string | null }>([]);

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
