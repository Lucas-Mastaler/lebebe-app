import {
  ehTermoGenericoEndereco,
  ehTermoNaoMunicipal,
  extrairSegmentosDisplayName,
  normalizarComponenteGeografico,
  resolverBairroCuritibaCanonico,
  resolverMunicipioRmcCanonico,
} from './vocabulario-geografico'

export type FonteBairroGeografico =
  | 'suburb'
  | 'neighbourhood'
  | 'city_district'
  | 'quarter'
  | 'display_name'
  | 'nenhuma'
  | 'ambigua'

export type ResultadoBairroGeografico = {
  valorCanonico: string | null
  valorNormalizado: string | null
  origem: FonteBairroGeografico
  bairroOficialCuritiba: boolean
  termoGenerico: boolean
  matchEsperado: boolean
  divergenciaReal: boolean
  indeterminado: boolean
  ambiguo: boolean
  candidatos: Array<{ fonte: FonteBairroGeografico; valor: string; canonico: string | null; generico: boolean }>
}

export type FonteMunicipioGeografico =
  | 'city'
  | 'town'
  | 'municipality'
  | 'administrative_area_level_2'
  | 'locality'
  | 'formatted_address'
  | 'county'
  | 'display_name'
  | 'nenhuma'
  | 'ambigua'

export type ResultadoMunicipioGeografico = {
  valorCanonico: string | null
  valorNormalizado: string | null
  origem: FonteMunicipioGeografico
  municipioRmc: boolean
  termoNaoMunicipal: boolean
  matchEsperado: boolean
  divergenciaReal: boolean
  indeterminado: boolean
  ambiguo: boolean
  candidatos: Array<{ fonte: FonteMunicipioGeografico; valor: string; canonico: string | null; naoMunicipal: boolean }>
}

type AddressLike = {
  suburb?: string | null
  neighbourhood?: string | null
  city_district?: string | null
  quarter?: string | null
  city?: string | null
  town?: string | null
  municipality?: string | null
  county?: string | null
}

function pushUnico<T extends { fonte: string; valor: string }>(lista: T[], item: T) {
  const valorNorm = normalizarComponenteGeografico(item.valor)
  if (!valorNorm) return
  if (lista.some((existente) => existente.fonte === item.fonte && normalizarComponenteGeografico(existente.valor) === valorNorm)) return
  lista.push(item)
}

export function resolverBairroGeografico({
  bairroEsperado,
  address,
  displayName,
}: {
  bairroEsperado?: string | null
  address?: AddressLike | null
  displayName?: string | null
}): ResultadoBairroGeografico {
  const esperadoCanonico = resolverBairroCuritibaCanonico(bairroEsperado) ?? null
  const esperadoNormalizado = normalizarComponenteGeografico(esperadoCanonico ?? bairroEsperado)
  const candidatos: ResultadoBairroGeografico['candidatos'] = []

  for (const [fonte, valor] of [
    ['suburb', address?.suburb],
    ['neighbourhood', address?.neighbourhood],
    ['city_district', address?.city_district],
    ['quarter', address?.quarter],
  ] as const) {
    const valorBruto = String(valor ?? '').trim()
    if (!valorBruto) continue
    pushUnico(candidatos, {
      fonte,
      valor: valorBruto,
      canonico: resolverBairroCuritibaCanonico(valorBruto),
      generico: ehTermoGenericoEndereco(valorBruto),
    })
  }

  for (const segmento of extrairSegmentosDisplayName(displayName)) {
    const canonico = resolverBairroCuritibaCanonico(segmento)
    if (!canonico) continue
    pushUnico(candidatos, {
      fonte: 'display_name',
      valor: segmento,
      canonico,
      generico: false,
    })
  }

  const oficiais = candidatos.filter((c) => c.canonico)
  const genericos = candidatos.filter((c) => c.generico)

  const matchEsperado = !!esperadoNormalizado && oficiais.some((c) => normalizarComponenteGeografico(c.canonico) === esperadoNormalizado)
  if (matchEsperado) {
    const escolhido = esperadoCanonico ?? oficiais.find((c) => normalizarComponenteGeografico(c.canonico) === esperadoNormalizado)?.canonico ?? null
    const origem = oficiais.find((c) => normalizarComponenteGeografico(c.canonico) === esperadoNormalizado)?.fonte ?? 'display_name'
    return {
      valorCanonico: escolhido,
      valorNormalizado: normalizarComponenteGeografico(escolhido),
      origem,
      bairroOficialCuritiba: true,
      termoGenerico: false,
      matchEsperado: true,
      divergenciaReal: false,
      indeterminado: false,
      ambiguo: false,
      candidatos,
    }
  }

  const canonicosUnicos = [...new Set(oficiais.map((c) => c.canonico).filter(Boolean) as string[])]
  if (canonicosUnicos.length > 1) {
    return {
      valorCanonico: null,
      valorNormalizado: null,
      origem: 'ambigua',
      bairroOficialCuritiba: false,
      termoGenerico: genericos.length > 0,
      matchEsperado: false,
      divergenciaReal: false,
      indeterminado: true,
      ambiguo: true,
      candidatos,
    }
  }

  if (canonicosUnicos.length === 1) {
    const escolhido = canonicosUnicos[0]
    const origem = oficiais.find((c) => c.canonico === escolhido)?.fonte ?? 'display_name'
    return {
      valorCanonico: escolhido,
      valorNormalizado: normalizarComponenteGeografico(escolhido),
      origem,
      bairroOficialCuritiba: true,
      termoGenerico: false,
      matchEsperado: false,
      divergenciaReal: !!esperadoNormalizado && normalizarComponenteGeografico(escolhido) !== esperadoNormalizado,
      indeterminado: false,
      ambiguo: false,
      candidatos,
    }
  }

  return {
    valorCanonico: null,
    valorNormalizado: null,
    origem: 'nenhuma',
    bairroOficialCuritiba: false,
    termoGenerico: genericos.length > 0,
    matchEsperado: false,
    divergenciaReal: false,
    indeterminado: true,
    ambiguo: false,
    candidatos,
  }
}

export function resolverMunicipioGeografico({
  cidadeEsperada,
  address,
  displayName,
  extras = [],
}: {
  cidadeEsperada?: string | null
  address?: AddressLike | null
  displayName?: string | null
  extras?: Array<{ fonte: FonteMunicipioGeografico; valor?: string | null }>
}): ResultadoMunicipioGeografico {
  const esperadoNormalizado = normalizarComponenteGeografico(cidadeEsperada)
  const esperadoRmcCanonico = resolverMunicipioRmcCanonico(cidadeEsperada)
  const candidatos: ResultadoMunicipioGeografico['candidatos'] = []

  for (const [fonte, valor] of [
    ['city', address?.city],
    ['town', address?.town],
    ['municipality', address?.municipality],
    ...extras.map((extra) => [extra.fonte, extra.valor] as const),
    ['county', address?.county],
  ] as const) {
    const valorBruto = String(valor ?? '').trim()
    if (!valorBruto) continue
    const canonico = resolverMunicipioRmcCanonico(valorBruto)
    const naoMunicipal = ehTermoNaoMunicipal(valorBruto)
    const fonteMunicipalEstruturada = fonte !== 'county'
    pushUnico(candidatos, {
      fonte,
      valor: valorBruto,
      canonico: canonico ?? (fonteMunicipalEstruturada && !naoMunicipal ? valorBruto : normalizarComponenteGeografico(valorBruto) === esperadoNormalizado ? valorBruto : null),
      naoMunicipal,
    })
  }

  for (const segmento of extrairSegmentosDisplayName(displayName)) {
    const canonicoRmc = resolverMunicipioRmcCanonico(segmento)
    const canonico = canonicoRmc ?? (normalizarComponenteGeografico(segmento) === esperadoNormalizado ? segmento : null)
    if (!canonico) continue
    pushUnico(candidatos, {
      fonte: 'display_name',
      valor: segmento,
      canonico,
      naoMunicipal: false,
    })
  }

  const municipais = candidatos.filter((c) => c.canonico && !c.naoMunicipal)
  const matchEsperado = !!esperadoNormalizado && municipais.some((c) => normalizarComponenteGeografico(c.canonico) === esperadoNormalizado)
  if (matchEsperado) {
    const escolhido = esperadoRmcCanonico ?? municipais.find((c) => normalizarComponenteGeografico(c.canonico) === esperadoNormalizado)?.canonico ?? null
    const origem = municipais.find((c) => normalizarComponenteGeografico(c.canonico) === esperadoNormalizado)?.fonte ?? 'display_name'
    return {
      valorCanonico: escolhido,
      valorNormalizado: normalizarComponenteGeografico(escolhido),
      origem,
      municipioRmc: !!resolverMunicipioRmcCanonico(escolhido),
      termoNaoMunicipal: false,
      matchEsperado: true,
      divergenciaReal: false,
      indeterminado: false,
      ambiguo: false,
      candidatos,
    }
  }

  const canonicosUnicos = [...new Set(municipais.map((c) => normalizarComponenteGeografico(c.canonico)).filter(Boolean))]
  if (canonicosUnicos.length > 1) {
    return {
      valorCanonico: null,
      valorNormalizado: null,
      origem: 'ambigua',
      municipioRmc: false,
      termoNaoMunicipal: candidatos.some((c) => c.naoMunicipal),
      matchEsperado: false,
      divergenciaReal: false,
      indeterminado: true,
      ambiguo: true,
      candidatos,
    }
  }

  if (municipais.length === 1) {
    const escolhido = municipais[0].canonico
    return {
      valorCanonico: escolhido,
      valorNormalizado: normalizarComponenteGeografico(escolhido),
      origem: municipais[0].fonte,
      municipioRmc: !!resolverMunicipioRmcCanonico(escolhido),
      termoNaoMunicipal: false,
      matchEsperado: false,
      divergenciaReal: !!esperadoNormalizado && normalizarComponenteGeografico(escolhido) !== esperadoNormalizado,
      indeterminado: false,
      ambiguo: false,
      candidatos,
    }
  }

  return {
    valorCanonico: null,
    valorNormalizado: null,
    origem: 'nenhuma',
    municipioRmc: false,
    termoNaoMunicipal: candidatos.some((c) => c.naoMunicipal),
    matchEsperado: false,
    divergenciaReal: false,
    indeterminado: true,
    ambiguo: false,
    candidatos,
  }
}
