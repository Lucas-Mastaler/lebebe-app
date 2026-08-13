import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const HASH_ESPERADO = 'A5C769093DF468998DD03B513B33C1F4007BD68D9E8223B5E9116DE624CBCAB6'
const CABECALHO_ESPERADO = ['COLEÇÃO', 'DESCRIÇÃO ', 'CUSTO', 'REFERÊNCIA', 'PREÇO UNIT.']
const QUANTIDADE_ORIGEM = 3078
const QUANTIDADE_FINAL = 3077

function registrar(etapa, mensagem) {
  console.log(`[LOG] [${etapa}] ${mensagem}`)
}

function analisarCsv(conteudo) {
  const linhas = []
  let linha = []
  let campo = ''
  let entreAspas = false

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice]
    if (entreAspas) {
      if (caractere === '"' && conteudo[indice + 1] === '"') {
        campo += '"'
        indice += 1
      } else if (caractere === '"') {
        entreAspas = false
      } else {
        campo += caractere
      }
    } else if (caractere === '"') {
      entreAspas = true
    } else if (caractere === ',') {
      linha.push(campo)
      campo = ''
    } else if (caractere === '\n') {
      linha.push(campo.replace(/\r$/, ''))
      linhas.push(linha)
      linha = []
      campo = ''
    } else {
      campo += caractere
    }
  }

  if (entreAspas) throw new Error('CSV_INVALIDO_ASPAS_NAO_FECHADAS')
  if (campo !== '' || linha.length > 0) {
    linha.push(campo.replace(/\r$/, ''))
    linhas.push(linha)
  }
  return linhas
}

function normalizarBusca(valor) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizarReferenciaBusca(valor) {
  return normalizarBusca(valor).replace(/[^A-Z0-9]/g, '')
}

function limparDescricao(valor) {
  return valor.replace(/\s+/g, ' ').trim()
}

function converterMoeda(valor) {
  const normalizado = valor.trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(?:\.\d{2})$/.test(normalizado)) throw new Error(`MOEDA_INVALIDA:${valor}`)
  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`MOEDA_NAO_POSITIVA:${valor}`)
  return numero.toFixed(2)
}

function codigoDeterministico(item) {
  const base = JSON.stringify([
    item.colecao,
    item.descricao,
    item.custo_unitario,
    item.referencia,
    item.preco_unitario,
  ])
  return `LEX-${createHash('sha256').update(base, 'utf8').digest('hex').slice(0, 32).toUpperCase()}`
}

function prepararCatalogo(conteudo) {
  const linhas = analisarCsv(conteudo)
  const cabecalho = linhas.shift()
  if (!cabecalho || JSON.stringify(cabecalho) !== JSON.stringify(CABECALHO_ESPERADO)) {
    throw new Error('CABECALHO_CSV_INESPERADO')
  }
  if (linhas.length !== QUANTIDADE_ORIGEM) {
    throw new Error(`QUANTIDADE_ORIGEM_INVALIDA:${linhas.length}`)
  }

  const chavesExatas = new Map()
  const itens = []
  const duplicatasDescartadas = []

  for (const [indice, campos] of linhas.entries()) {
    const linhaOrigem = indice + 2
    if (campos.length !== 5 || campos.some((campo) => campo.trim() === '')) {
      throw new Error(`LINHA_INVALIDA:${linhaOrigem}`)
    }
    const [colecaoRaw, descricaoRaw, custoRaw, referenciaRaw, precoRaw] = campos
    const chaveExata = JSON.stringify(campos.map((campo) => campo.trim()))
    const primeiraLinha = chavesExatas.get(chaveExata)
    if (primeiraLinha !== undefined) {
      duplicatasDescartadas.push({ primeiraLinha, linhaDescartada: linhaOrigem, referencia: referenciaRaw.trim() })
      continue
    }
    chavesExatas.set(chaveExata, linhaOrigem)

    const item = {
      ordem: itens.length + 1,
      linha_origem: linhaOrigem,
      colecao: colecaoRaw.trim(),
      descricao: limparDescricao(descricaoRaw),
      custo_unitario: converterMoeda(custoRaw),
      referencia: referenciaRaw.trim(),
      preco_unitario: converterMoeda(precoRaw),
      colecao_busca: normalizarBusca(colecaoRaw),
      descricao_busca: normalizarBusca(descricaoRaw),
      referencia_busca: normalizarReferenciaBusca(referenciaRaw),
    }
    itens.push({ ...item, codigo: codigoDeterministico(item) })
  }

  if (itens.length !== QUANTIDADE_FINAL) throw new Error(`QUANTIDADE_FINAL_INVALIDA:${itens.length}`)
  if (
    duplicatasDescartadas.length !== 1
    || duplicatasDescartadas[0].primeiraLinha !== 621
    || duplicatasDescartadas[0].linhaDescartada !== 652
    || duplicatasDescartadas[0].referencia !== '76029'
  ) throw new Error(`DUPLICATA_INTEGRAL_INESPERADA:${JSON.stringify(duplicatasDescartadas)}`)
  if (new Set(itens.map((item) => item.codigo)).size !== itens.length) {
    throw new Error('COLISAO_CODIGO_TECNICO')
  }
  return { itens, duplicatasDescartadas }
}

async function executar() {
  const caminhoInformado = process.argv.slice(2).find((argumento) => !argumento.startsWith('--'))
  if (!caminhoInformado) {
    throw new Error('Uso: node --env-file=.env.local scripts/importar-catalogo-lebebe-exclusive.mjs <csv> [--aplicar]')
  }
  const aplicar = process.argv.includes('--aplicar')
  const caminhoCsv = resolve(caminhoInformado)

  registrar('INÍCIO', `Arquivo: ${caminhoCsv}`)
  const buffer = await readFile(caminhoCsv)
  const hash = createHash('sha256').update(buffer).digest('hex').toUpperCase()
  if (hash !== HASH_ESPERADO) throw new Error(`HASH_ARQUIVO_DIVERGENTE:${hash}`)

  const conteudo = buffer.toString('utf8')
  const { itens, duplicatasDescartadas } = prepararCatalogo(conteudo)
  registrar('VALIDAÇÃO', `Hash confirmado: ${hash}`)
  registrar('VALIDAÇÃO', `Linhas de origem: ${QUANTIDADE_ORIGEM}`)
  registrar('VALIDAÇÃO', `Produtos finais: ${itens.length}`)
  registrar('VALIDAÇÃO', `Duplicata integral descartada: linhas ${duplicatasDescartadas[0].primeiraLinha}/${duplicatasDescartadas[0].linhaDescartada}, referência ${duplicatasDescartadas[0].referencia}`)

  if (!aplicar) {
    registrar('FIM', 'Validação concluída sem escrita. Use --aplicar para importar.')
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('VARIAVEIS_SUPABASE_AUSENTES')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  registrar('IMPORTAÇÃO', 'Enviando catálogo validado para a transação no Supabase.')
  const { data, error } = await supabase.rpc('importar_catalogo_lebebe_exclusive', {
    p_arquivo_sha256: hash,
    p_itens: itens,
  })
  if (error) throw new Error(`IMPORTACAO_FALHOU:${error.code ?? 'SEM_CODIGO'}:${error.message}`)
  const retorno = Array.isArray(data) ? data[0] : data
  if (Number(retorno?.total_importado) !== QUANTIDADE_FINAL) {
    throw new Error(`TOTAL_RPC_DIVERGENTE:${JSON.stringify(retorno)}`)
  }

  const { count, error: erroContagem } = await supabase
    .from('pedidos_personalizados_produtos')
    .select('id, fornecedor:pedidos_personalizados_fornecedores!inner(chave)', { count: 'exact', head: true })
    .eq('fornecedor.chave', 'lebebe_exclusive')
    .eq('ativo', true)
  if (erroContagem) throw new Error(`RECONCILIACAO_FALHOU:${erroContagem.message}`)
  if (count !== QUANTIDADE_FINAL) throw new Error(`CONTAGEM_FINAL_DIVERGENTE:${count}`)

  registrar('FIM', `Importação reconciliada: ${count} produtos ativos.`)
}

executar().catch((erro) => {
  registrar('ERRO', erro instanceof Error ? erro.message : String(erro))
  process.exitCode = 1
})
