/**
 * Calcula confiança interna normalizada para resultados de geocodificação.
 *
 * A confiança interna NÃO é o campo `importance` do provider.
 * `importance` mede relevância/popularidade do lugar — não a qualidade
 * da correspondência entre o endereço solicitado e o endereço retornado.
 *
 * Esta função usa apenas as validações estruturais já existentes no projeto
 * para produzir uma confiança na escala 0–1, compatível com o threshold
 * `GEO_CACHE_CONFIDENCE_MINIMA_HIT_SEGURO = 0.7`.
 *
 * Escala adotada:
 * - 0.97: exato com ROOFTOP (Google) e sem partial_match
 * - 0.95: exato com número confirmado e todos os campos estruturais ok
 * - 0.90: exato com bairro divergente (bairro é apenas diagnóstico)
 * - 0.85: exato com partial_match (Google)
 * - 0.80: aproximado confiável (sem número, mas CEP/logradouro/cidade/UF ancoram)
 * - 0.75: aproximado confiável com partial_match
 * - 0.80: sem validação estrutural completa (Apps Script, validação parcial)
 *
 * Resultados que não passam nas validações estruturais nunca chegam aqui —
 * são rejeitados antes por validarCandidato / validarResultadoGoogle /
 * validarEnderecoProviderDireto.
 */

export type ClassificacaoConfianca = 'exato' | 'aproximado_confiavel' | 'sem_validacao_estrutural';

export type ResultadoConfiancaInterna = {
  confidence: number;
  motivo: string;
  classificacao: ClassificacaoConfianca;
};

export type ParamsConfiancaInterna = {
  /** Classificação do match: 'exato' (número confirmado) ou 'aproximado_confiavel' (ancoragem urbana) */
  match?: string;
  /** Se o número da casa foi confirmado pelo provider */
  numeroOk?: boolean;
  /** Se o logradouro bate */
  logradouroOk?: boolean;
  /** Se a cidade bate */
  cidadeOk?: boolean;
  /** Se a UF bate */
  ufOk?: boolean;
  /** Se o CEP bate: true, false, ou 'na' quando um lado não tem CEP */
  cepOk?: boolean | 'na';
  /** Se o bairro bate: true, false, ou 'na' quando um lado não tem bairro */
  bairroOk?: boolean | 'na';
  /** Google: se o resultado é partial_match */
  partialMatch?: boolean;
  /** Google: location_type (ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE) */
  locationType?: string;
  /** Nome do provider (locationiq, google_geocoding, appsscript, etc.) */
  provider?: string;
  /** Valor bruto de importance do provider (preservado para logs, não usado no cálculo) */
  providerImportance?: number | null;
};

export function calcularConfiancaInternaEndereco(params: ParamsConfiancaInterna): ResultadoConfiancaInterna {
  const {
    match,
    numeroOk,
    logradouroOk,
    cidadeOk,
    ufOk,
    cepOk,
    bairroOk,
    partialMatch,
    locationType,
    provider,
    providerImportance,
  } = params;

  // Provider sem validação estrutural completa (Apps Script, etc.)
  // validarEnderecoProviderDireto valida CEP, cidade, UF, logradouro — mas não número.
  if (match === undefined && numeroOk === undefined) {
    const confidence = 0.80;
    console.log(
      `[confianca-interna] provider=${provider ?? '-'} providerImportance=${providerImportance ?? '-'}` +
      ` confidenceInterna=${confidence} classificacao=sem_validacao_estrutural` +
      ` motivo=sem_validacao_estrutural_completa`
    );
    return {
      confidence,
      motivo: 'sem_validacao_estrutural_completa',
      classificacao: 'sem_validacao_estrutural',
    };
  }

  // Exato: número confirmado + campos estruturais ok
  if (match === 'exato' || (numeroOk === true && logradouroOk !== false && cidadeOk !== false && ufOk !== false)) {
    let confidence = 0.95;
    let motivo = 'exato_numero_confirmado';

    // Google ROOFTOP sem partial_match é o mais preciso
    if (locationType === 'ROOFTOP' && !partialMatch) {
      confidence = 0.97;
      motivo = 'exato_rooftop';
    }

    // Bairro divergente reduz levemente (não bloqueia, é diagnóstico)
    if (bairroOk === false) {
      confidence -= 0.05;
      motivo = motivo === 'exato_rooftop' ? 'exato_rooftop_bairro_divergente' : 'exato_bairro_divergente';
    }

    // Google partial_match reduz confiança
    if (partialMatch === true) {
      confidence -= 0.10;
      motivo = 'exato_partial_match';
    }

    confidence = Math.max(confidence, 0.70);

    console.log(
      `[confianca-interna] provider=${provider ?? '-'} providerImportance=${providerImportance ?? '-'}` +
      ` confidenceInterna=${confidence} classificacao=exato` +
      ` numeroOk=${numeroOk} logradouroOk=${logradouroOk} cidadeOk=${cidadeOk} ufOk=${ufOk}` +
      ` cepOk=${cepOk} bairroOk=${bairroOk} partialMatch=${partialMatch ?? '-'} locationType=${locationType ?? '-'}` +
      ` motivo=${motivo}`
    );

    return { confidence, motivo, classificacao: 'exato' };
  }

  // Aproximado confiável: sem número confirmado, mas com ancoragem urbana forte
  if (match === 'aproximado_confiavel' || (numeroOk === false && logradouroOk && cidadeOk && ufOk)) {
    let confidence = 0.80;
    let motivo = 'aproximado_confiavel';

    // CEP confirmado aumenta confiança
    if (cepOk === true) {
      confidence += 0.05;
      motivo = 'aproximado_confiavel_cep_ok';
    }

    // Google partial_match reduz confiança
    if (partialMatch === true) {
      confidence -= 0.05;
      motivo = 'aproximado_partial_match';
    }

    confidence = Math.max(confidence, 0.70);

    console.log(
      `[confianca-interna] provider=${provider ?? '-'} providerImportance=${providerImportance ?? '-'}` +
      ` confidenceInterna=${confidence} classificacao=aproximado_confiavel` +
      ` numeroOk=${numeroOk} logradouroOk=${logradouroOk} cidadeOk=${cidadeOk} ufOk=${ufOk}` +
      ` cepOk=${cepOk} bairroOk=${bairroOk} partialMatch=${partialMatch ?? '-'} locationType=${locationType ?? '-'}` +
      ` motivo=${motivo}`
    );

    return { confidence, motivo, classificacao: 'aproximado_confiavel' };
  }

  // Fallback: resultado passou na validação mas não tem flags suficientes
  const confidence = 0.75;
  console.log(
    `[confianca-interna] provider=${provider ?? '-'} providerImportance=${providerImportance ?? '-'}` +
    ` confidenceInterna=${confidence} classificacao=sem_validacao_estrutural` +
    ` motivo=validacao_incompleta match=${match ?? '-'} numeroOk=${numeroOk ?? '-'}`
  );
  return {
    confidence,
    motivo: 'validacao_incompleta',
    classificacao: 'sem_validacao_estrutural',
  };
}
