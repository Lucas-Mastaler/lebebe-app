// Helper determinístico: extrai trechos factuais relevantes de um transcript
// para inclusão no prompt consolidado. Sem chamada de IA.
//
// Captura linhas que contenham:
//   - datas no formato dd/mm (com ou sem ano)
//   - valores monetários R$
//   - palavras-chave: prazo, entrega, montagem, link, cartão, pix, boleto,
//     frete, desconto, condição, parcela, pagamento, loja, fecha, fechando

const PALAVRAS_CHAVE = [
  'entrega',
  'montagem',
  'prazo',
  'dia ',
  'link',
  'pagamento',
  'pagar',
  'cartão',
  'cartao',
  'pix',
  'boleto',
  'parcela',
  'frete',
  'desconto',
  'condição',
  'condicao',
  'fecha',
  'fechando',
  'fechar',
  'loja',
  'presencial',
  'promoção',
  'promocao',
]

const REGEX_DATA = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/
const REGEX_VALOR = /R\$\s*\d/i

const MAX_TRECHOS = 30
const MAX_CHARS_POR_LINHA = 200

export function extrairTrechosFatuais(transcript: string): string[] {
  if (!transcript || transcript.trim().length === 0) return []

  const linhas = transcript.split('\n')
  const trechos: string[] = []

  for (const linha of linhas) {
    if (trechos.length >= MAX_TRECHOS) break

    const linhaLimpa = linha.trim()
    if (!linhaLimpa) continue

    // Remove o prefixo de timestamp/autor que o transcript.ts adiciona: "[dd/mm/aaaa HH:mm] Autor: "
    // Mantém o conteúdo real da mensagem para avaliação de palavras-chave
    const conteudo = linhaLimpa.replace(/^\[[\d/]+ [\d:]+\]\s*\w+:\s*/, '').toLowerCase()

    // Testa data apenas no conteudo (apos remover prefixo), para evitar
    // que o timestamp do prefixo [dd/mm/aaaa HH:mm] dispare captura indevida
    const conteudoOriginal = linhaLimpa.replace(/^\[\d{1,2}\/\d{1,2}\/\d{4} \d{2}:\d{2}\]\s*[^:]+:\s*/, '')
    const temData = REGEX_DATA.test(conteudoOriginal)
    const temValor = REGEX_VALOR.test(conteudoOriginal)
    const temPalavraChave = PALAVRAS_CHAVE.some((p) => conteudo.includes(p))

    if (temData || temValor || temPalavraChave) {
      // Preserva linha original truncada para não estourar o prompt
      trechos.push(linhaLimpa.slice(0, MAX_CHARS_POR_LINHA))
    }
  }

  return trechos
}
