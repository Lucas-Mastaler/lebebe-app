function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// interpretarConfirmacao
// ---------------------------------------------------------------------------

const PREFIXOS_NEGACAO = ['nao'];

const TOKENS_CONFIRMACAO = [
  'sim',
  'ss',
  'sin',
  'simm',
  'siim',
  'isso',
  'correto',
  'certo',
  'exato',
  'ok',
  'okay',
  'confirmo',
  'confirmado',
  'pode ser',
  'pode',
  'ta certo',
  'esta correto',
  'esta certo',
  'e esse',
  'e essa',
  'e isso',
  'e essa mesma',
  'e esse mesmo',
];

const TOKENS_NEGACAO = [
  'nao',
  'n',
  'errado',
  'incorreto',
  'outro',
  'outra',
  'trocar',
  'mudar',
  'nao e esse',
  'nao e essa',
  'nao esta correto',
  'nao esta certo',
  'endereco errado',
  'endereco incorreto',
];

export function interpretarConfirmacao(texto: string): 'confirmar' | 'negar' | 'ambigua' {
  const n = normalizar(texto);

  if (!n) return 'ambigua';

  // Presença de negação explícita: qualquer token de negação basta para negar
  for (const token of TOKENS_NEGACAO) {
    if (n === token || n.startsWith(token + ' ') || n.includes(' ' + token + ' ') || n.endsWith(' ' + token)) {
      return 'negar';
    }
  }

  // Começa com 'nao' ou 'n ' (ex: "n, está errado", "nao é isso")
  for (const pref of PREFIXOS_NEGACAO) {
    if (n.startsWith(pref)) return 'negar';
  }

  // Verificar confirmação — mas somente se não houver sinal de negação no mesmo texto
  const temNegacao = TOKENS_NEGACAO.some(
    (t) => n === t || n.startsWith(t + ' ') || n.includes(' ' + t + ' ') || n.endsWith(' ' + t)
  ) || PREFIXOS_NEGACAO.some((p) => n.startsWith(p));

  if (temNegacao) return 'negar';

  for (const token of TOKENS_CONFIRMACAO) {
    if (
      n === token ||
      n.startsWith(token + ' ') ||
      n.includes(' ' + token + ' ') ||
      n.endsWith(' ' + token) ||
      // ruído curto após token: ex "sim4" => token=sim, resto="4" (1 char)
      (token === 'sim' && n.startsWith('sim') && n.length <= token.length + 3)
    ) {
      return 'confirmar';
    }
  }

  return 'ambigua';
}

// ---------------------------------------------------------------------------
// interpretarAcaoAlteracao
// ---------------------------------------------------------------------------

const TOKENS_ADIANTAR = [
  '1',
  'adiantar',
  'adianta',
  'adiantamento',
  'antecipar',
  'antecipa',
  'antecipacao',
  'antecipação',
  'mais cedo',
  'antes',
  'pra antes',
  'para antes',
  'quero adiantar',
  'quero antecipar',
  'quero antes',
  'quero mais cedo',
];

const TOKENS_POSTERGAR = [
  '2',
  'postergar',
  'postega',
  'postergar entrega',
  'jogar pra frente',
  'mais pra frente',
  'pra frente',
  'para frente',
  'mais tarde',
  'depois',
  'deixar para depois',
  'deixar pra depois',
  'quero depois',
  'quero mais tarde',
  'quero postergar',
  'mais adiante',
  'adiar',
  'adia',
];

function casar(n: string, tokens: string[]): boolean {
  return tokens.some(
    (t) =>
      n === t ||
      n.startsWith(t + ' ') ||
      n.endsWith(' ' + t) ||
      n.includes(' ' + t + ' ')
  );
}

export function interpretarAcaoAlteracao(texto: string): 'adiantar' | 'postergar' | 'ambigua' {
  const n = normalizar(texto);

  if (!n) return 'ambigua';

  const isAdiantar = casar(n, TOKENS_ADIANTAR);
  const isPostergar = casar(n, TOKENS_POSTERGAR);

  if (isAdiantar && isPostergar) return 'ambigua';
  if (isAdiantar) return 'adiantar';
  if (isPostergar) return 'postergar';

  return 'ambigua';
}

// ---------------------------------------------------------------------------
// Contador de tentativas inválidas por estado (helper puro, sem I/O)
// ---------------------------------------------------------------------------

export function calcularTentativasInvalidas(
  metadataAtual: Record<string, unknown> | null,
  estadoAtual: string,
): number {
  const ultimoEstado = metadataAtual?.tentativas_invalidas_ultimo_estado as string | undefined;
  const contadorAtual = metadataAtual?.tentativas_invalidas_estado as number | undefined;

  if (ultimoEstado !== estadoAtual) return 1; // primeiro erro neste estado
  return (contadorAtual ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Detecção de CLIENTE RETIRA na coluna EQUIPE AGENDA (helper puro, sem I/O)
// ---------------------------------------------------------------------------

export function ehClienteRetiraEquipeAgenda(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  const n = normalizar(String(valor));
  if (!n) return false;
  return n.includes('cliente retira');
}
