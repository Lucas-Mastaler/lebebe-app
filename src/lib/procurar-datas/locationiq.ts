import type { EnderecoValidado, ValidarEnderecoRequest } from './contratos'
import {
  montarEnderecoDisplayProcurarDatas,
  normalizarCep,
  normalizarNumeroEndereco,
  normalizarTexto,
} from './endereco-cache'

type LocationIqAddress = {
  road?: string
  house_number?: string
  suburb?: string
  neighbourhood?: string
  city_district?: string
  quarter?: string
  city?: string
  town?: string
  municipality?: string
  county?: string
  state?: string
  state_code?: string
  postcode?: string
}

type LocationIqCandidate = {
  lat?: string
  lon?: string
  display_name?: string
  importance?: number
  address?: LocationIqAddress
}

export type LocationIqEvent =
  | { tipo: 'locationiq_start'; reserva: boolean }
  | { tipo: 'locationiq_reserve_key_used' }
  | { tipo: 'locationiq_success'; reserva: boolean }
  | { tipo: 'locationiq_failed'; reserva: boolean; motivo: string }
  | { tipo: 'locationiq_rejected_no_house_number' }
  | { tipo: 'locationiq_rejected_logradouro_mismatch' }
  | { tipo: 'locationiq_rejected_cep_mismatch' }
  | { tipo: 'locationiq_rejected_city_or_uf_mismatch' }
  | { tipo: 'locationiq_no_valid_candidate' }

export type ResultadoLocationIq =
  | { status: 'success'; resultado: EnderecoValidado; reservaUsada: boolean }
  | { status: 'failed'; motivo: string }

const UF_NOMES: Record<string, string> = {
  AC: 'ACRE',
  AL: 'ALAGOAS',
  AP: 'AMAPA',
  AM: 'AMAZONAS',
  BA: 'BAHIA',
  CE: 'CEARA',
  DF: 'DISTRITO FEDERAL',
  ES: 'ESPIRITO SANTO',
  GO: 'GOIAS',
  MA: 'MARANHAO',
  MT: 'MATO GROSSO',
  MS: 'MATO GROSSO DO SUL',
  MG: 'MINAS GERAIS',
  PA: 'PARA',
  PB: 'PARAIBA',
  PR: 'PARANA',
  PE: 'PERNAMBUCO',
  PI: 'PIAUI',
  RJ: 'RIO DE JANEIRO',
  RN: 'RIO GRANDE DO NORTE',
  RS: 'RIO GRANDE DO SUL',
  RO: 'RONDONIA',
  RR: 'RORAIMA',
  SC: 'SANTA CATARINA',
  SP: 'SAO PAULO',
  SE: 'SERGIPE',
  TO: 'TOCANTINS',
}

function obterChavesLocationIq(): Array<{ chave: string; reserva: boolean }> {
  const primaria = process.env.LOCATIONIQ_API_KEY?.trim()
  const reserva = process.env.LOCATIONIQ_API_KEY_RESERVA?.trim()
  return [
    ...(primaria ? [{ chave: primaria, reserva: false }] : []),
    ...(reserva ? [{ chave: reserva, reserva: true }] : []),
  ]
}

function montarUrlLocationIq(form: ValidarEnderecoRequest, apiKey: string): URL {
  const url = new URL('https://us1.locationiq.com/v1/search.php')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('street', `${String(form.logradouro ?? '').trim()} ${String(form.numero ?? '').trim()}`.trim())
  url.searchParams.set('city', String(form.cidade ?? '').trim())
  url.searchParams.set('state', String(form.uf ?? '').trim().toUpperCase())
  url.searchParams.set('country', 'Brazil')
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '3')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('accept-language', 'pt-BR')
  return url
}

function cidadeDoCandidato(address: LocationIqAddress | undefined): string {
  return normalizarTexto(address?.city ?? address?.town ?? address?.municipality ?? address?.county)
}

function ufCompativel(address: LocationIqAddress | undefined, uf: string): boolean {
  const ufNorm = normalizarTexto(uf)
  const stateCode = normalizarTexto(address?.state_code).replace(/^BR-/, '').replace(/^BR\s+/, '')
  const state = normalizarTexto(address?.state)
  return stateCode === ufNorm || state === UF_NOMES[ufNorm]
}

/**
 * Extrai tokens fortes do logradouro, removendo prefixos de tipo (Rua, Av., etc.)
 * e filtrando tokens com menos de 4 caracteres.
 * Equivalente ao comportamento de addrNormalizeForKey_ do legado Apps Script.
 */
function tokensFortesLogradouro(logradouro: string): string[] {
  const semPrefixo = normalizarTexto(logradouro)
    .replace(/^(AV\.?|AVENIDA|R\.?|RUA|AL\.?|ALAMEDA|TRAV\.?|TRAVESSA|ROD\.?|RODOVIA|EST\.?|ESTRADA|PC\.?|PRACA|LARGO|VIA)\s+/i, '')
    .trim()
  return semPrefixo
    .split(/\s+/)
    .filter((t) => t.length >= 4)
}

/**
 * Retorna se o texto contém ao menos um token forte do logradouro.
 */
function textoContemLogradouro(texto: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const textoNorm = normalizarTexto(texto)
  return tokens.some((t) => textoNorm.includes(t))
}

type MotivoRejeicao =
  | 'city_or_uf_mismatch'
  | 'logradouro_mismatch'
  | 'no_house_number'
  | 'cep_mismatch'
  | 'bairro_mismatch'
  | 'importance_baixa'

/**
 * Extrai o bairro do candidato LocationIQ, tentando múltiplos campos.
 */
function bairroDoCandidato(address: LocationIqAddress | undefined): string {
  return (
    normalizarTexto(
      address?.suburb ??
        address?.neighbourhood ??
        address?.city_district ??
        address?.quarter ??
        ''
    )
  )
}

type FlagsDiagnosticas = {
  cidadeOk: boolean
  ufOk: boolean
  logradouroOk: boolean
  numeroOk: boolean
  numeroObrigatorio: boolean
  cepOk: boolean | 'na'
  bairroOk: boolean | 'na'
  ancoragemUrbanaForte: boolean
}

/**
 * Valida um candidato LocationIQ.
 * Mantem o numero obrigatorio no payload, mas permite aceite aproximado quando
 * o provider nao confirma numero e ha ancoragem urbana forte por CEP/logradouro/cidade/UF.
 *
 * Regras aplicadas:
 * 1. Coordenadas válidas.
 * 2. Cidade e UF compatíveis (equivalente ao legado).
 * 3. Logradouro: ao menos 1 token forte do form deve aparecer no display_name ou address.road
 *    (equivalente a LOGRADOURO_MISS=-0.30 do legado, que derrubava score abaixo de 0.65).
 * 4. Numero: quando confirmado pelo provider, deve bater com o form. Quando ausente,
 *    deixa de bloquear se CEP/logradouro/cidade/UF ancoram o candidato como rua.
 * 5. CEP: se ambos (form e candidato) têm CEP, os 5 primeiros dígitos devem bater.
 *    (equivalente à penalidade CEP_REGION_DIFF=-0.25 do legado).
 */
function validarCandidato(
  candidate: LocationIqCandidate,
  form: ValidarEnderecoRequest
): { valido: true; resultado: EnderecoValidado; flags: FlagsDiagnosticas } | { valido: false; motivo: MotivoRejeicao; flags: FlagsDiagnosticas } {
  const lat = Number(candidate.lat)
  const lng = Number(candidate.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      valido: false,
      motivo: 'city_or_uf_mismatch',
      flags: {
        cidadeOk: false,
        ufOk: false,
        logradouroOk: false,
        numeroOk: false,
        numeroObrigatorio: true,
        cepOk: 'na',
        bairroOk: 'na',
        ancoragemUrbanaForte: false,
      },
    }
  }

  const cidadeForm = normalizarTexto(form.cidade)
  const ufForm = normalizarTexto(form.uf)

  // Pré-calcular todas as flags diagnósticas antes das rejeições antecipadas
  const cidadeOk = !!cidadeForm && cidadeDoCandidato(candidate.address) === cidadeForm
  const ufOk = !!ufForm && ufCompativel(candidate.address, ufForm)

  const tokens = tokensFortesLogradouro(String(form.logradouro ?? ''))
  const display = candidate.display_name ?? ''
  const road = candidate.address?.road ?? ''
  const roadNorm = normalizarTexto(road)
  const logradouroOk = !!roadNorm && (textoContemLogradouro(display, tokens) || textoContemLogradouro(road, tokens))

  const numeroForm = normalizarNumeroEndereco(String(form.numero ?? ''))
  const houseNumber = normalizarNumeroEndereco(candidate.address?.house_number ?? '')
  const providerConfirmouNumeroDivergente = !!houseNumber && houseNumber !== numeroForm
  let numeroOk: boolean
  if (houseNumber) {
    numeroOk = houseNumber === numeroForm
  } else {
    const displayNorm = normalizarTexto(display)
    numeroOk = displayNorm.includes(numeroForm) && textoContemLogradouro(display, tokens)
  }

  const cepForm = normalizarNumeroEndereco(String(form.cep ?? '')).substring(0, 5)
  const cepCandidato = normalizarNumeroEndereco(candidate.address?.postcode ?? '').substring(0, 5)
  const cepOk: boolean | 'na' =
    cepForm.length === 5 && cepCandidato.length === 5 ? cepForm === cepCandidato : 'na'
  const postcodePresente = cepCandidato.length === 5
  const cepAncoragemOk = cepForm.length === 5 ? cepOk === true : postcodePresente

  // Validação de bairro (apenas diagnóstico, não rejeita)
  const bairroForm = normalizarTexto(form.bairro)
  const bairroCandidate = bairroDoCandidato(candidate.address)
  const bairroOk: boolean | 'na' =
    !bairroForm || !bairroCandidate ? 'na' : bairroForm === bairroCandidate

  const displayNorm = normalizarTexto(display)
  const resultadoPareceRua =
    !!roadNorm ||
    /\b(RUA|AVENIDA|ALAMEDA|TRAVESSA|RODOVIA|ESTRADA|PRACA|LARGO|VIA)\b/.test(displayNorm)
  const ancoragemUrbanaForte =
    !providerConfirmouNumeroDivergente &&
    !numeroOk &&
    cepAncoragemOk &&
    cidadeOk &&
    ufOk &&
    logradouroOk &&
    resultadoPareceRua
  const numeroObrigatorio = !ancoragemUrbanaForte

  const flags: FlagsDiagnosticas = {
    cidadeOk,
    ufOk,
    logradouroOk,
    numeroOk,
    numeroObrigatorio,
    cepOk,
    bairroOk,
    ancoragemUrbanaForte,
  }

  // Rejeicoes em ordem. Bairro e importance seguem apenas como diagnostico.
  const motivos: MotivoRejeicao[] = []
  if (!cidadeForm || !ufForm) motivos.push('city_or_uf_mismatch')
  if (!cidadeOk || !ufOk) motivos.push('city_or_uf_mismatch')
  if (!logradouroOk) motivos.push('logradouro_mismatch')
  if (cepOk === false) motivos.push('cep_mismatch')
  if (!numeroOk && numeroObrigatorio) motivos.push('no_house_number')
  if (motivos.length > 0) {
    return { valido: false, motivo: motivos[0], flags }
  }

  const address = candidate.address ?? {}
  const enderecoCompleto = display || montarEnderecoDisplayProcurarDatas(form)
  return {
    valido: true,
    flags,
    resultado: {
      ok: true,
      lat,
      lng,
      enderecoCompleto,
      display: enderecoCompleto,
      display_name: enderecoCompleto,
      cep: normalizarCep(address.postcode),
      provider: 'locationiq',
      match: numeroOk ? 'exato' : 'aproximado_confiavel',
      numeroOk,
      numeroObrigatorio,
      classificacaoDiagnostica: numeroOk ? 'exato' : 'aproximado_confiavel',
      motivo: numeroOk ? 'aceito_numero_confirmado' : 'aceito_sem_numero_confirmado',
      confidence: typeof candidate.importance === 'number' ? candidate.importance : null,
      address: {
        road: address.road || String(form.logradouro ?? ''),
        house_number: address.house_number ?? '',
        suburb: address.suburb || address.neighbourhood || String(form.bairro ?? ''),
        city: address.city || address.town || address.municipality || String(form.cidade ?? ''),
        state: address.state || String(form.uf ?? ''),
        postcode: address.postcode || '',
      },
    },
  }
}

/**
 * Gera array de motivos diagnósticos para log (não afeta aceite).
 */
function motivosDiagnosticos(
  flags: FlagsDiagnosticas,
  importance: number | undefined
): MotivoRejeicao[] {
  const motivos: MotivoRejeicao[] = []
  if (!flags.numeroOk) motivos.push('no_house_number')
  if (!flags.logradouroOk) motivos.push('logradouro_mismatch')
  if (!flags.cidadeOk || !flags.ufOk) motivos.push('city_or_uf_mismatch')
  if (flags.cepOk === false) motivos.push('cep_mismatch')
  if (flags.bairroOk === false) motivos.push('bairro_mismatch')
  if (importance !== undefined && importance < 0.1) motivos.push('importance_baixa')
  return motivos
}

/**
 * Classificação diagnóstica para log (não afeta aceite).
 */
function classificacaoDiagnostica(
  flags: FlagsDiagnosticas,
  importance: number | undefined
): 'aproximado_confiavel' | 'generico_rejeitado' {
  void importance
  // Se falta numero, mas CEP/logradouro/cidade/UF ancoram bem, o candidato e aproximado confiavel.
  if (
    flags.ancoragemUrbanaForte
  ) {
    return 'aproximado_confiavel'
  }
  // Caso contrario, generico rejeitado.
  return 'generico_rejeitado'
}

export async function buscarEnderecoLocationIq(
  form: ValidarEnderecoRequest,
  options: {
    fetchFn?: typeof fetch
    onEvent?: (event: LocationIqEvent) => void
  } = {}
): Promise<ResultadoLocationIq> {
  const fetchFn = options.fetchFn ?? fetch
  const chaves = obterChavesLocationIq()
  if (chaves.length === 0) return { status: 'failed', motivo: 'locationiq_key_ausente' }

  let ultimoMotivo = 'sem_resultado_valido'
  for (const { chave, reserva } of chaves) {
    if (reserva) options.onEvent?.({ tipo: 'locationiq_reserve_key_used' })
    options.onEvent?.({ tipo: 'locationiq_start', reserva })

    try {
      const response = await fetchFn(montarUrlLocationIq(form, chave), { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        ultimoMotivo = `http_${response.status}`
        options.onEvent?.({ tipo: 'locationiq_failed', reserva, motivo: ultimoMotivo })
        continue
      }

      const data = (await response.json()) as unknown
      if (!Array.isArray(data)) {
        ultimoMotivo = 'payload_invalido'
        options.onEvent?.({ tipo: 'locationiq_failed', reserva, motivo: ultimoMotivo })
        continue
      }

      const candidatos = data as LocationIqCandidate[]
      const contadores: Record<string, number> = {}
      let aceitos = 0

      for (let idx = 0; idx < candidatos.length; idx++) {
        const candidate = candidatos[idx]
        const validacao = validarCandidato(candidate, form)

        const lat = Number(candidate.lat)
        const lng = Number(candidate.lon)
        const latStr = Number.isFinite(lat) ? lat.toFixed(5) : '-'
        const lngStr = Number.isFinite(lng) ? lng.toFixed(5) : '-'
        const displayTrunc = (candidate.display_name ?? '').slice(0, 80)
        const addr = candidate.address ?? {}
        const bairroCandidate = bairroDoCandidato(addr) || '-'
        const cidadeCandidate = addr.city ?? addr.town ?? addr.municipality ?? '-'
        const bairroForm = normalizarTexto(form.bairro)
        const flags = validacao.flags

        // Motivos diagnósticos para log (não afeta aceite)
        const motivosDiag = motivosDiagnosticos(flags, candidate.importance)
        const motivosStr = motivosDiag.join(',')

        if (validacao.valido) {
          console.log(
            `[PROCURAR_DATAS][validar-endereco][locationiq_candidate]` +
            ` idx=${idx} reserva=${reserva} motivo=${validacao.resultado.motivo ?? 'aceito'}` +
            ` motivos=${motivosStr || 'nenhum'}` +
            ` lat=${latStr} lng=${lngStr}` +
            ` importance=${candidate.importance ?? '-'}` +
            ` house_number="${addr.house_number ?? '-'}"` +
            ` road="${addr.road ?? '-'}"` +
            ` bairroForm="${bairroForm}" bairroCandidate="${bairroCandidate}" bairroOk=${flags.bairroOk}` +
            ` city="${cidadeCandidate}"` +
            ` state="${addr.state ?? '-'}"` +
            ` postcode="${addr.postcode ?? '-'}"` +
            ` cidadeOk=${flags.cidadeOk} ufOk=${flags.ufOk}` +
            ` logradouroOk=${flags.logradouroOk} numeroOk=${flags.numeroOk} numeroObrigatorio=${flags.numeroObrigatorio} cepOk=${flags.cepOk}` +
            ` classificacaoDiagnostica=${validacao.resultado.classificacaoDiagnostica ?? 'aceito'}` +
            ` display="${displayTrunc}"`
          )
          aceitos++
          options.onEvent?.({ tipo: 'locationiq_success', reserva })
          return { status: 'success', resultado: validacao.resultado, reservaUsada: reserva }
        }

        const motivo = validacao.motivo
        contadores[motivo] = (contadores[motivo] ?? 0) + 1

        // Classificação diagnóstica mais precisa
        const classDiag = classificacaoDiagnostica(flags, candidate.importance)

        console.log(
          `[PROCURAR_DATAS][validar-endereco][locationiq_candidate]` +
          ` idx=${idx} reserva=${reserva} motivos=${motivosStr}` +
          ` lat=${latStr} lng=${lngStr}` +
          ` importance=${candidate.importance ?? '-'}` +
          ` house_number="${addr.house_number ?? '-'}"` +
          ` road="${addr.road ?? '-'}"` +
          ` bairroForm="${bairroForm}" bairroCandidate="${bairroCandidate}" bairroOk=${flags.bairroOk}` +
          ` city="${cidadeCandidate}"` +
          ` state="${addr.state ?? '-'}"` +
          ` postcode="${addr.postcode ?? '-'}"` +
          ` cidadeOk=${flags.cidadeOk} ufOk=${flags.ufOk}` +
          ` logradouroOk=${flags.logradouroOk} numeroOk=${flags.numeroOk} numeroObrigatorio=${flags.numeroObrigatorio} cepOk=${flags.cepOk}` +
          ` classificacaoDiagnostica=${classDiag}` +
          ` display="${displayTrunc}"`
        )

        if (motivo === 'logradouro_mismatch') {
          options.onEvent?.({ tipo: 'locationiq_rejected_logradouro_mismatch' })
        } else if (motivo === 'no_house_number') {
          options.onEvent?.({ tipo: 'locationiq_rejected_no_house_number' })
        } else if (motivo === 'cep_mismatch') {
          options.onEvent?.({ tipo: 'locationiq_rejected_cep_mismatch' })
        } else if (motivo === 'city_or_uf_mismatch') {
          options.onEvent?.({ tipo: 'locationiq_rejected_city_or_uf_mismatch' })
        }
      }

      const rejeitados = candidatos.length - aceitos
      const motivosStr = Object.entries(contadores)
        .map(([k, v]) => `${k}:${v}`)
        .join(',')
      console.log(
        `[PROCURAR_DATAS][validar-endereco][locationiq_summary]` +
        ` reserva=${reserva} total=${candidatos.length} aceitos=${aceitos} rejeitados=${rejeitados}` +
        ` motivos=${motivosStr || 'nenhum'}`
      )

      ultimoMotivo = 'sem_resultado_valido'
      if (rejeitados > 0) {
        options.onEvent?.({ tipo: 'locationiq_no_valid_candidate' })
      }
      options.onEvent?.({ tipo: 'locationiq_failed', reserva, motivo: ultimoMotivo })
    } catch (error) {
      ultimoMotivo = error instanceof Error ? error.message : 'erro_desconhecido'
      options.onEvent?.({ tipo: 'locationiq_failed', reserva, motivo: ultimoMotivo })
    }
  }

  return { status: 'failed', motivo: ultimoMotivo }
}
