export type FiltrosPerformance = {
  periodo: 'hoje' | '7dias' | '30dias' | 'personalizado';
  dataInicio?: string;
  dataFim?: string;
  motor: 'legado' | 'v2' | 'todos';
  status: 'success' | 'error' | 'todos';
  cidade?: string;
  provider?: string;
  cache?: 'todos' | 'hit' | 'miss';
};

export type ResumoMotor = {
  motor: string;
  total_buscas: number;
  tempo_medio_ms: number;
  tempo_tipico_ms: number;
  casos_mais_lentos_ms: number;
  erros: number;
  buscas_ate_30s: number;
  buscas_acima_60s: number;
};

export type FaixaTempo = {
  faixa: string;
  motor: string;
  total: number;
};

export type EvolucaoDiaria = {
  data: string;
  motor: string;
  total_buscas: number;
  tempo_medio_ms: number;
  tempo_tipico_ms: number;
};

export type ProviderCache = {
  provider: string;
  cache_hit: boolean;
  chamadas: number;
  tempo_medio_ms: number;
  tempo_tipico_ms: number;
  casos_mais_lentos_ms: number;
  confianca_media: number;
};

export type BairroRanking = {
  bairro: string;
  total: number;
  cidade: string | null;
  uf: string | null;
};

export type CepRanking = {
  cep: string;
  total: number;
  motor: string;
};

export type PontosAtencao = {
  v2_acima_30s: number;
  buscas_erro: { motor: string; total: number }[];
  cache_sem_bairro: number;
  providers_lentos: { provider: string; tempo_medio_ms: number }[];
};

export type PerformanceResponse = {
  resumo: ResumoMotor[];
  faixas: FaixaTempo[];
  evolucao: EvolucaoDiaria[];
  provedores: ProviderCache[];
  bairros: BairroRanking[];
  ceps: CepRanking[];
  pontos_atencao: PontosAtencao;
  total_economia_cache_sec: number | null;
};
