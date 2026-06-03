// ============================================================
// CLASSIFICAÇÃO DE PRODUTOS SGI POR DEPARTAMENTO / SUBGRUPO
// Usa apenas a descrição do produto — nunca "Local de Estocagem"
//
// Prioridade:
//  1. Tabela oficial sgi_produtos_classificacao_referencia (por código)
//  2. Regras por palavra-chave (função síncrona classificarProduto)
//  3. Não classificado
// ============================================================

export interface ClassificacaoProduto {
  departamento: string
  subgrupo: string
  regra: string
  confianca: number
}

export interface ClassificacaoVenda {
  departamentos: string[]
  subgrupos: string[]
  departamentos_texto: string
  subgrupos_texto: string
}

// ─── Normalização ─────────────────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function contem(norm: string, palavra: string): boolean {
  return norm.includes(palavra)
}

// ─── Palavras que BLOQUEIAM classificação automática como Móveis ──────────────
// Se a descrição contiver qualquer uma dessas, não classificar como Móveis
// mesmo que contenha "berco", "cama" etc. — pertencem ao Enxoval.

const BLOQUEIO_MOVEIS: string[] = [
  'capa',
  'kit berco', 'kit berço',
  'protetor', 'protetora',
  'lencol', 'lençol',
  'saia berco', 'saia berço',
  'tranca', 'trança',
  'travesseiro',
  'edredom',
  'cobertor',
  'acolchoado',
]

function temBloqueioMoveis(norm: string): boolean {
  return BLOQUEIO_MOVEIS.some((b) => contem(norm, b))
}

// ─── Regras especiais com lógica composta (avaliadas antes das genéricas) ─────

function regraEspecial(norm: string): ClassificacaoProduto | null {
  // MATIC → Móveis (desde que não tenha bloqueio de enxoval)
  if (contem(norm, 'matic') && !temBloqueioMoveis(norm)) {
    let subgrupo = 'Móveis'
    if (contem(norm, 'berco') || contem(norm, 'berço')) subgrupo = 'Berço'
    else if (contem(norm, 'comoda') || contem(norm, 'comoda')) subgrupo = 'Cômoda'
    else if (contem(norm, 'roupeiro') || contem(norm, 'guarda roupa') || contem(norm, 'guarda-roupa')) subgrupo = 'Roupeiro'
    else if (contem(norm, 'gaveteiro')) subgrupo = 'Gaveteiro'
    else if (contem(norm, 'cama') || contem(norm, 'mini cama') || contem(norm, 'bicama')) subgrupo = 'Cama'
    return { departamento: 'Móveis', subgrupo, regra: 'matic', confianca: 1.0 }
  }

  // Cadeira + auto → P. Pesada / Cadeiras Auto (prioridade sobre base/isofix)
  if (contem(norm, 'cadeira') && contem(norm, 'auto')) {
    return { departamento: 'P. Pesada', subgrupo: 'Cadeiras Auto', regra: 'cadeira+auto', confianca: 1.0 }
  }

  // Cadeira + alimentacao → P. Pesada / Cadeiras Alimentação
  if (contem(norm, 'cadeira') && (contem(norm, 'alimentacao') || contem(norm, 'alimentação'))) {
    return { departamento: 'P. Pesada', subgrupo: 'Cadeiras Alimentação', regra: 'cadeira+alimentacao', confianca: 1.0 }
  }

  return null
}

// ─── Regras genéricas por departamento ───────────────────────────────────────

interface Regra {
  palavras: string[]
  subgrupo: string
  bloqueio?: string[] // palavras que impedem esta regra
}

interface Departamento {
  nome: string
  regras: Regra[]
}

const DEPARTAMENTOS: Departamento[] = [
  {
    nome: 'Móveis',
    regras: [
      { palavras: ['berco', 'berco'], subgrupo: 'Berço', bloqueio: [...BLOQUEIO_MOVEIS] },
      { palavras: ['comoda'], subgrupo: 'Cômoda' },
      { palavras: ['roupeiro', 'guarda roupa', 'guarda-roupa'], subgrupo: 'Roupeiro' },
      { palavras: ['gaveteiro'], subgrupo: 'Gaveteiro' },
      { palavras: ['poltrona'], subgrupo: 'Poltrona' },
      { palavras: ['mini cama', 'bicama', 'cama'], subgrupo: 'Cama', bloqueio: [...BLOQUEIO_MOVEIS] },
      { palavras: ['colchao'], subgrupo: 'Colchão', bloqueio: [...BLOQUEIO_MOVEIS] },
      { palavras: ['prateleira', 'nicho'], subgrupo: 'Acessórios móveis' },
    ],
  },
  {
    nome: 'P. Pesada',
    regras: [
      { palavras: ['carrinho'], subgrupo: 'Carrinho' },
      { palavras: ['bebe conforto', 'bebe-conforto'], subgrupo: 'Bebê conforto' },
      { palavras: ['banheira'], subgrupo: 'Banheiras' },
      {
        palavras: ['base isofix', 'isofix', 'base iso'],
        subgrupo: 'Base/Isofix',
        bloqueio: ['cadeira auto', 'cadeira carro', 'cadeirinha'],
      },
      { palavras: ['cadeirinha', 'cadeira de carro', 'cadeira carro'], subgrupo: 'Cadeiras Auto' },
      {
        palavras: ['cadeira de alimentacao', 'cadeira de alimentação'],
        subgrupo: 'Cadeiras Alimentação',
      },
      { palavras: ['moises'], subgrupo: 'Moisés' },
    ],
  },
  {
    nome: 'Roupas',
    regras: [
      { palavras: ['body', 'bodies'], subgrupo: 'Body' },
      { palavras: ['macacao'], subgrupo: 'Macacão' },
      { palavras: ['conjunto'], subgrupo: 'Conjunto' },
      { palavras: ['vestido'], subgrupo: 'Vestido' },
      { palavras: ['calca', 'mijao', 'pagao', 'salopete', 'jardineira'], subgrupo: 'Calça' },
      { palavras: ['saida maternidade'], subgrupo: 'Saída maternidade' },
      { palavras: ['meia', 'sapatinho', 'touca', 'luva', 'blusa', 'camiseta', 'casaco'], subgrupo: 'Acessórios vestuário' },
    ],
  },
  {
    nome: 'Enxoval',
    regras: [
      {
        palavras: [
          'acolchoado',
          'manta', 'cobertor', 'edredom',
          'lencol',
          'travesseiro',
          'kit berco',
          'protetor', 'protetora',
          'saia berco',
          'tranca', 'trança',
          'ninho', 'colchonete',
          'capa protetora',
        ],
        subgrupo: 'Cama/Berço',
      },
      { palavras: ['toalha', 'fralda de banho'], subgrupo: 'Banho' },
      { palavras: ['bolsa', 'mochila'], subgrupo: 'Bolsa/Mochila' },
      { palavras: ['fralda', 'cueiro', 'trocador'], subgrupo: 'Higiene' },
      { palavras: ['babador'], subgrupo: 'Babador' },
    ],
  },
  {
    nome: 'Puericultura leve',
    regras: [
      { palavras: ['chupeta', 'mamadeira', 'copo', 'prato', 'talher', 'talheres'], subgrupo: 'Alimentação' },
      { palavras: ['esterilizador', 'termometro'], subgrupo: 'Higiene' },
      { palavras: ['brinquedo', 'pelucia', 'naninha'], subgrupo: 'Brinquedo' },
      { palavras: ['mordedor'], subgrupo: 'Acessórios bebê' },
    ],
  },
  {
    nome: 'Outros',
    regras: [
      { palavras: ['abajur'], subgrupo: 'Decoração' },
      { palavras: ['sacola', 'embalagem', 'presente', 'garantia', 'servico', 'montagem', 'frete'], subgrupo: 'Serviço/Embalagem' },
    ],
  },
]

// ─── Classificar produto por palavras-chave (síncrono) ───────────────────────

export function classificarProduto(descricaoProduto: string): ClassificacaoProduto {
  if (!descricaoProduto?.trim()) {
    return { departamento: 'Não classificado', subgrupo: 'Não classificado', regra: '', confianca: 0 }
  }

  const norm = normalizar(descricaoProduto)

  // 1. Regras compostas especiais (MATIC, cadeira+auto, cadeira+alimentacao)
  const especial = regraEspecial(norm)
  if (especial) return especial

  // 2. Regras genéricas por departamento
  for (const depto of DEPARTAMENTOS) {
    for (const regra of depto.regras) {
      // Verificar bloqueios desta regra
      if (regra.bloqueio?.some((b) => contem(norm, b))) continue
      for (const palavra of regra.palavras) {
        if (contem(norm, palavra)) {
          return {
            departamento: depto.nome,
            subgrupo: regra.subgrupo,
            regra: palavra,
            confianca: 0.85,
          }
        }
      }
    }
  }

  return { departamento: 'Não classificado', subgrupo: 'Não classificado', regra: '', confianca: 0 }
}

// ─── Ordem de exibição dos departamentos ─────────────────────────────────────

const ORDEM_DEPARTAMENTOS = ['Móveis', 'P. Pesada', 'Roupas', 'Enxoval', 'Puericultura leve', 'Outros', 'Não classificado']

function ordenarDeptos(deptos: string[]): string[] {
  return [...deptos].sort((a, b) => {
    const ia = ORDEM_DEPARTAMENTOS.indexOf(a)
    const ib = ORDEM_DEPARTAMENTOS.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

// ─── Agregar classificação da venda ──────────────────────────────────────────

export interface SgiProdutoMinimo {
  produto: string | null
}

export function classificarVenda(produtos: SgiProdutoMinimo[]): ClassificacaoVenda {
  const departamentosSet = new Set<string>()
  const subgruposSet = new Set<string>()

  for (const p of produtos) {
    if (!p.produto) continue
    const { departamento, subgrupo } = classificarProduto(p.produto)
    departamentosSet.add(departamento)
    subgruposSet.add(subgrupo)
  }

  const temDeptoReal = [...departamentosSet].some(
    (d) => d !== 'Outros' && d !== 'Não classificado'
  )

  let departamentos = [...departamentosSet]
  if (temDeptoReal) {
    departamentos = departamentos.filter((d) => d !== 'Outros')
  }
  if (departamentos.some((d) => d !== 'Não classificado')) {
    departamentos = departamentos.filter((d) => d !== 'Não classificado')
  }

  let subgrupos = [...subgruposSet]
  if (temDeptoReal) {
    subgrupos = subgrupos.filter((s) => s !== 'Serviço/Embalagem')
  }
  if (subgrupos.some((s) => s !== 'Não classificado')) {
    subgrupos = subgrupos.filter((s) => s !== 'Não classificado')
  }

  const deptoOrdenado = ordenarDeptos(departamentos)
  const subgrupoOrdenado = [...subgrupos].sort()

  return {
    departamentos: deptoOrdenado,
    subgrupos: subgrupoOrdenado,
    departamentos_texto: deptoOrdenado.join(', ') || 'Não classificado',
    subgrupos_texto: subgrupoOrdenado.join(', ') || 'Não classificado',
  }
}
