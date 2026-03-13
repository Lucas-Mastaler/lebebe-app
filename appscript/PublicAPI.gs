function AbrirProcurarData() {
  const html = HtmlService.createHtmlOutputFromFile('procurar_modal')
    .setWidth(840)
    .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Procurar datas de entrega');
}

function LookupCompletoPorEndereco(form) {
  return lookupCompletoPorEndereco(form);
}

function ExecutarPesquisaViaModal(form) {
  form = form || {};
  if (form.mesPesquisa && !form.monthYear) form.monthYear = form.mesPesquisa;
  if (!form.clientToken) form.clientToken = 't' + Date.now() + '-' + Math.random().toString(16).slice(2);
  form.returnOnly = true;
  const FRONT_ID   = SpreadsheetApp.getActive().getId();
  const TARGET_TAB = 'PROCURAR DATAS DE ENTREGA';
  return pesquisarRotaToTargetWithParams(FRONT_ID, TARGET_TAB, form);
}

function GetTempoMap(){
  return getTempoMap();
}

function ShowAgendaModalFromRows(payload){
  return showAgendaModalFromRows(payload);
}

function GetFrontOptionLists(){
  return getFrontOptionLists();
}

function GetTempoNecessario(form){
  return getTempoNecessario(form);
}

function DoPreAgendarDireto(cand, meta){
  return preAgendarDireto(cand, meta);
}

// ✅ Função de ping para verificação de conectividade
function ping() {
  return true;
}

// ========== EXECUTION API (apps.script.run) ==========

/**
 * FUNÇÃO PRINCIPAL DA API - Chamada via Google Apps Script Execution API
 * 
 * ATUALIZADA para suportar endereço estruturado + encoding UTF-8
 * 
 * Arquitetura: n8n → backend → Execution API → apiProcurarDatasPorEndereco() → resultado → backend → n8n
 * 
 * @param {Object} dados - Objeto com os parâmetros da busca
 * @returns {Object} Objeto JSON serializável com resultado padronizado
 */
function apiProcurarDatasPorEndereco(dados) {
  var startTime = Date.now();
  var executionId = 'exec-' + startTime + '-' + Math.random().toString(16).slice(2, 8);
  
  Logger.log('========================================');
  Logger.log('[API-EXEC-START] ID: ' + executionId);
  Logger.log('[API-EXEC-START] Timestamp: ' + new Date().toISOString());
  Logger.log('[API-PAYLOAD-RAW] ' + JSON.stringify(dados || {}));
  Logger.log('========================================');
  
  try {
    // ===== VALIDAÇÃO 1: Payload existe =====
    if (!dados || typeof dados !== 'object') {
      Logger.log('[API-ERROR] Payload ausente ou inválido');
      return {
        ok: false,
        error: 'Payload ausente ou inválido. Esperado: objeto com endereço e tempoNecessario',
        executionId: executionId
      };
    }
    
    // ===== VALIDAÇÃO 2: Campos de endereço =====
    // Suporta endereço estruturado (PREFERIDO) ou enderecoCompleto (fallback)
    var logradouro = String(dados.logradouro || '').trim();
    var numero = String(dados.numero || '').trim();
    var bairro = String(dados.bairro || '').trim();
    var cidade = String(dados.cidade || '').trim();
    var uf = String(dados.uf || '').trim();
    var cep = String(dados.cep || '').trim();
    var enderecoCompleto = String(dados.enderecoCompleto || '').trim();
    
    var temEnderecoEstruturado = !!(logradouro || numero || bairro || cidade || uf || cep);
    var temEnderecoCompleto = !!enderecoCompleto;
    
    if (!temEnderecoEstruturado && !temEnderecoCompleto) {
      Logger.log('[API-ERROR] Endereço não fornecido');
      return {
        ok: false,
        error: 'Endereço não fornecido. Envie campos estruturados (logradouro, numero, bairro, cidade, uf, cep) OU enderecoCompleto',
        executionId: executionId
      };
    }
    
    // ===== MONTAGEM DE ENDEREÇO =====
    var enderecoFinal = '';
    var enderecoOrigem = '';
    
    if (temEnderecoEstruturado) {
      // PRIORIDADE 1: Montar a partir de campos estruturados
      var partes = [];
      
      if (logradouro) partes.push(logradouro);
      if (numero) partes.push(numero);
      if (bairro) partes.push(bairro);
      if (cidade) partes.push(cidade);
      if (uf) partes.push(uf);
      if (cep) partes.push(cep);
      
      enderecoFinal = partes.join(', ');
      enderecoOrigem = 'estruturado';
      
      Logger.log('[API-ENDERECO] Montado de campos estruturados');
      Logger.log('[API-ENDERECO-CAMPOS] logradouro: "' + logradouro + '"');
      Logger.log('[API-ENDERECO-CAMPOS] numero: "' + numero + '"');
      Logger.log('[API-ENDERECO-CAMPOS] bairro: "' + bairro + '"');
      Logger.log('[API-ENDERECO-CAMPOS] cidade: "' + cidade + '"');
      Logger.log('[API-ENDERECO-CAMPOS] uf: "' + uf + '"');
      Logger.log('[API-ENDERECO-CAMPOS] cep: "' + cep + '"');
    } else {
      // PRIORIDADE 2: Usar enderecoCompleto como fallback
      enderecoFinal = enderecoCompleto;
      enderecoOrigem = 'completo';
      
      Logger.log('[API-ENDERECO] Usando enderecoCompleto (fallback)');
    }
    
    // Log de encoding para diagnóstico
    Logger.log('[API-ENDERECO-FINAL] "' + enderecoFinal + '"');
    Logger.log('[API-ENDERECO-LENGTH] ' + enderecoFinal.length + ' caracteres');
    Logger.log('[API-ENDERECO-ORIGEM] ' + enderecoOrigem);
    
    // Verificar caracteres especiais (diagnóstico de encoding)
    var temAcentos = /[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/.test(enderecoFinal);
    Logger.log('[API-ENDERECO-UTF8] Contém acentos: ' + (temAcentos ? 'SIM' : 'NÃO'));
    
    if (temAcentos) {
      // Exemplos de caracteres com acento encontrados
      var exemplos = enderecoFinal.match(/[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/g) || [];
      Logger.log('[API-ENDERECO-UTF8-EXEMPLOS] ' + exemplos.slice(0, 10).join(', '));
    }
    
    // ===== VALIDAÇÃO 3: Tempo necessário =====
    var tempoNecessario = String(dados.tempoNecessario || '').trim();
    
    if (!tempoNecessario) {
      Logger.log('[API-ERROR] Campo obrigatório ausente: tempoNecessario');
      return {
        ok: false,
        error: 'Campo obrigatório ausente: tempoNecessario (formato esperado: HH:MM)',
        executionId: executionId
      };
    }
    
    if (!/^\d{1,2}:\d{2}$/.test(tempoNecessario)) {
      Logger.log('[API-ERROR] Formato inválido de tempoNecessario: ' + tempoNecessario);
      return {
        ok: false,
        error: 'Formato inválido de tempoNecessario. Esperado: HH:MM (ex: 00:30, 01:15)',
        tempoRecebido: tempoNecessario,
        executionId: executionId
      };
    }
    
    // ===== NORMALIZAÇÃO: Booleanos =====
    var isRural = false;
    var isCondominio = false;
    
    if (dados.isRural === true || dados.isRural === 'true' || dados.isRural === 1 || dados.isRural === '1') {
      isRural = true;
    }
    
    if (dados.isCondominio === true || dados.isCondominio === 'true' || dados.isCondominio === 1 || dados.isCondominio === '1') {
      isCondominio = true;
    }
    
    // ===== VALIDAÇÃO 4: monthYear (opcional) =====
    var monthYear = String(dados.monthYear || dados.mesPesquisa || '').trim();
    
    if (monthYear) {
      var monthYearValid = /^(\d{4})[-\/](\d{2})$/.test(monthYear) || /^(\d{2})[-\/](\d{4})$/.test(monthYear);
      
      if (!monthYearValid) {
        Logger.log('[API-ERROR] Formato inválido de monthYear: ' + monthYear);
        return {
          ok: false,
          error: 'Formato inválido de monthYear. Esperado: YYYY-MM (ex: 2026-04) ou MM/YYYY',
          monthYearRecebido: monthYear,
          executionId: executionId
        };
      }
    }
    
    // ===== PAYLOAD NORMALIZADO =====
    var dadosNormalizados = {
      enderecoCompleto: enderecoFinal,
      enderecoOrigem: enderecoOrigem,
      enderecoEstruturado: temEnderecoEstruturado ? {
        logradouro: logradouro || null,
        numero: numero || null,
        bairro: bairro || null,
        cidade: cidade || null,
        uf: uf || null,
        cep: cep || null
      } : null,
      tempoNecessario: tempoNecessario,
      isRural: isRural,
      isCondominio: isCondominio,
      monthYear: monthYear,
      tipoBerco: String(dados.tipoBerco || '').trim(),
      comoda: String(dados.comoda || '').trim(),
      roupeiro: String(dados.roupeiro || '').trim(),
      poltrona: String(dados.poltrona || '').trim(),
      painel: String(dados.painel || '').trim()
    };
    
    Logger.log('[API-PAYLOAD-NORMALIZED] ' + JSON.stringify(dadosNormalizados));
    Logger.log('[API-PROCESSING] Iniciando processamento...');
    
    // ===== PROCESSAMENTO: Chamar função principal =====
    var resultado = ProcurarDatasPorEndereco(dadosNormalizados);
    
    // ===== GARANTIR SERIALIZAÇÃO JSON =====
    var resultadoSerializavel = JSON.parse(JSON.stringify(resultado));
    
    // ===== ADICIONAR METADADOS =====
    resultadoSerializavel.executionId = executionId;
    resultadoSerializavel.executionTime = ((Date.now() - startTime) / 1000).toFixed(2) + 's';
    resultadoSerializavel.timestamp = new Date().toISOString();
    resultadoSerializavel.enderecoOrigem = enderecoOrigem;
    
    var statusFinal = resultadoSerializavel.ok ? 'SUCCESS' : 'FAILED';
    Logger.log('[API-EXEC-END] Status: ' + statusFinal);
    Logger.log('[API-EXEC-END] Tempo: ' + resultadoSerializavel.executionTime);
    Logger.log('[API-EXEC-END] Candidatos: ' + (resultadoSerializavel.totalCandidatos || 0));
    Logger.log('========================================');
    
    return resultadoSerializavel;
    
  } catch (error) {
    Logger.log('========================================');
    Logger.log('[API-EXEC-ERROR] ' + (error && error.message || String(error)));
    Logger.log('[API-EXEC-ERROR] Stack: ' + (error && error.stack || 'N/A'));
    Logger.log('========================================');
    
    return {
      ok: false,
      error: 'Erro ao processar requisição: ' + (error && error.message || String(error)),
      errorType: error && error.name || 'UnknownError',
      executionId: executionId,
      executionTime: ((Date.now() - startTime) / 1000).toFixed(2) + 's',
      timestamp: new Date().toISOString()
    };
  }
}

// ========== WEB APP (DEPRECATED - mantido para compatibilidade) ==========
// NOTA: Não usar mais. A integração oficial é via Execution API (apiProcurarDatasPorEndereco)

/*
function doPost(e) {
  try {
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: 'JSON inválido: ' + (parseError && parseError.message)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!payload.enderecoCompleto || !payload.tempoNecessario) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: 'Campos obrigatórios: enderecoCompleto, tempoNecessario'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var resultado = ProcurarDatasPorEndereco(payload);
    
    return ContentService.createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('[API-ERROR] ' + (error && error.message));
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'Erro interno: ' + (error && error.message || String(error))
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  
  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      message: 'API está online',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    ok: false,
    error: 'Use POST para enviar dados. GET disponível apenas para ?action=ping'
  })).setMimeType(ContentService.MimeType.JSON);
}
*/

/**
 * Função principal que processa a busca de datas por endereço completo
 * 
 * @param {Object} dados - { enderecoCompleto, tempoNecessario, isRural?, isCondominio?, monthYear? }
 * @returns {Object} { ok, candidates[], address, searchTime, ... }
 */
function ProcurarDatasPorEndereco(dados) {
  try {
    // Preparar o objeto form para a função de pesquisa
    var form = {
      // Endereço completo (será geocodificado)
      enderecoCompleto: String(dados.enderecoCompleto || '').trim(),
      
      // Tempo de serviço
      tempoNecessario: String(dados.tempoNecessario || '00:30').trim(),
      
      // Componentes do serviço (vazios pois já temos o tempo total)
      tipoBerco: String(dados.tipoBerco || '').trim(),
      comoda: String(dados.comoda || '').trim(),
      roupeiro: String(dados.roupeiro || '').trim(),
      poltrona: String(dados.poltrona || '').trim(),
      painel: String(dados.painel || '').trim(),
      
      // Características do local
      isRural: !!dados.isRural,
      isCondominio: !!dados.isCondominio,
      
      // Período de busca (opcional)
      monthYear: dados.monthYear || dados.mesPesquisa || '',
      
      // Token único para idempotência
      clientToken: 'n8n-' + Date.now() + '-' + Math.random().toString(16).slice(2),
      
      // Modo: retornar JSON, não gravar na planilha
      returnOnly: true
    };

    // ===== LOG PRÉ-GEOCODIFICAÇÃO =====
    Logger.log('[GEOCODE-PRE] Endereço a geocodificar: "' + form.enderecoCompleto + '"');
    Logger.log('[GEOCODE-PRE] Length: ' + form.enderecoCompleto.length + ' chars');
    
    // Verificar se caracteres especiais estão corretos
    var exemplosCaracteres = form.enderecoCompleto.substring(0, 50);
    Logger.log('[GEOCODE-PRE] Primeiros 50 chars: "' + exemplosCaracteres + '"');

    // ===== GEOCODIFICAÇÃO COM URL ENCODING CORRETO =====
    var geoResult = geocodeAddressOSM(form.enderecoCompleto);
    
    // ===== LOG PÓS-GEOCODIFICAÇÃO =====
    if (!geoResult || !geoResult.lat || !geoResult.lng) {
      Logger.log('[GEOCODE-FAIL] Não foi possível geocodificar');
      Logger.log('[GEOCODE-FAIL] Endereço enviado: "' + form.enderecoCompleto + '"');
      Logger.log('[GEOCODE-FAIL] Resultado: ' + JSON.stringify(geoResult || null));
      
      return {
        ok: false,
        error: 'Não foi possível geocodificar o endereço. Verifique se está completo e correto.',
        endereco: form.enderecoCompleto,
        debugInfo: {
          enderecoLength: form.enderecoCompleto.length,
          geoResult: geoResult || null
        }
      };
    }

    Logger.log('[GEOCODE-SUCCESS] lat=' + geoResult.lat + ', lng=' + geoResult.lng);

    // Adicionar coordenadas ao form
    form.lat = geoResult.lat;
    form.lng = geoResult.lng;
    form.useModalDestOnly = true; // Usar apenas as coordenadas validadas

    // Executar a pesquisa
    const FRONT_ID = SpreadsheetApp.getActive().getId();
    const TARGET_TAB = 'PROCURAR DATAS DE ENTREGA';
    
    var payload = pesquisarRotaToTargetWithParams(FRONT_ID, TARGET_TAB, form);
    
    // Verificar erros
    if (!payload || typeof payload === 'string') {
      var errorMsg = payload || 'Erro desconhecido';
      return {
        ok: false,
        error: 'Erro na pesquisa: ' + errorMsg,
        endereco: form.enderecoCompleto
      };
    }

    // Sucesso - formatar resposta para o n8n
    if (payload.ok && payload.candidates) {
      // ===== NORMALIZAÇÃO UTF-8 (NFC) =====
      // Corrige double-encoding de acentos (ex: "SÃ¡bado" → "Sábado")
      function _nfcSafe(txt) {
        if (!txt) return '';
        var s = String(txt);
        // Se o runtime suporta normalize (V8), usar NFC
        if (typeof s.normalize === 'function') {
          s = s.normalize('NFC');
        }
        return s;
      }

      return {
        ok: true,
        endereco: _nfcSafe(payload.address || form.enderecoCompleto),
        enderecoSimplificado: _nfcSafe(payload.addressShort || ''),
        coordenadas: {
          lat: geoResult.lat,
          lng: geoResult.lng
        },
        tempoServico: form.tempoNecessario,
        isRural: form.isRural,
        isCondominio: form.isCondominio,
        totalCandidatos: payload.candidates.length,
        tempoProcessamento: payload.searchTime || 0,
        candidatos: payload.candidates.map(function(c) {
          return {
            data: _nfcSafe(c.date || c.dateDM),
            dataISO: c.dateISO,
            diaSemana: _nfcSafe(c.weekday),
            equipe: _nfcSafe(c.team),
            horario: _nfcSafe(c.window),
            frete: _nfcSafe(c.frete),
            tipoFrete: _nfcSafe(c.tipoFrete || c.tipo || 'NORMAL'),
            distanciaKm: c.distKm,
            motivoExtras: _nfcSafe(c.motivoExtras || c.avisoHoraMarcada || ''),
            rank: c.rank || 0
          };
        })
      };
    }

    return {
      ok: false,
      error: 'Nenhuma data disponível encontrada',
      endereco: form.enderecoCompleto
    };
    
  } catch (error) {
    Logger.log('[N8N-API-ERROR] ' + (error && error.message));
    Logger.log(error && error.stack);
    return {
      ok: false,
      error: 'Erro ao processar: ' + (error && error.message || String(error))
    };
  }
}

function ExecutarPesquisaViaModalAndShow(form) {
  form = form || {};
  if (form.mesPesquisa && !form.monthYear) form.monthYear = form.mesPesquisa;
  if (!form.clientToken) form.clientToken = 't' + Date.now() + '-' + Math.random().toString(16).slice(2);
  form.returnOnly = true;

  const FRONT_ID   = SpreadsheetApp.getActive().getId();
  const TARGET_TAB = 'PROCURAR DATAS DE ENTREGA';

  try {
    // aquecer caches no backend
    getFrontOptionLists();
    getTempoMap();

    const payload = pesquisarRotaToTargetWithParams(FRONT_ID, TARGET_TAB, form);
    if (!payload || payload === 'ERR_BAD_CEP' || payload === 'ERR_EXCEPTION' || payload === 'ERR_NO_SHEETS') {
      return { ok:false, error: 'Não foi possível gerar resultados. (' + String(payload || 'erro') + ')' };
    }
    if (payload && payload.ok) {
      showAgendaModalFromRows(payload);
      return { ok:true };
    }
    return { ok:false, error:'Nenhum resultado encontrado.' };
  } catch (e) {
    return { ok:false, error: (e && e.message) ? e.message : String(e || 'Erro desconhecido') };
  }
}

// ✅ API para polling de progresso
function GetProgressUpdate(clientToken) {
  return getProgressUpdate(clientToken);
}

// ========== MAP SELECTOR MODAL ==========

/**
 * Abre modal de seleção de localização no mapa
 * Retorna coordenadas selecionadas pelo usuário
 */
function showMapSelector() {
  const html = HtmlService.createHtmlOutputFromFile('mapa_selecao')
    .setWidth(900)
    .setHeight(700);
  
  SpreadsheetApp.getUi().showModalDialog(html, '📍 Selecione a Localização no Mapa');
}

/**
 * Salva a seleção do mapa e REABRE o modal principal automaticamente
 * Injeta dados diretamente no HTML para preenchimento instantâneo
 * @param {Object} coords - {lat, lng, display}
 */
function saveMapSelection(coords) {
  Logger.log('[MapSelector] ========== INÍCIO saveMapSelection ==========');
  
  if (!coords || !coords.lat || !coords.lng) {
    Logger.log('[MapSelector] ERRO: Coordenadas inválidas');
    throw new Error('Coordenadas inválidas');
  }
  
  Logger.log('[MapSelector] Coords recebidas: ' + JSON.stringify(coords));
  
  // ✅ Injeta dados via script no HTML para preenchimento INSTANTÂNEO
  Logger.log('[MapSelector] Criando HTML do modal principal...');
  const html = HtmlService.createHtmlOutputFromFile('procurar_modal');
  
  const scriptInject = `
    \u003cscript\u003e
      window._mapSelectionData = ${JSON.stringify(coords)};
      console.log('[Map] Dados injetados via script:', window._mapSelectionData);
    \u003c/script\u003e
  `;
  
  Logger.log('[MapSelector] Injetando dados no HTML...');
  const fullHtml = html.getContent().replace('\u003c/head\u003e', scriptInject + '\u003c/head\u003e');
  const htmlWithData = HtmlService.createHtmlOutput(fullHtml)
    .setWidth(700)
    .setHeight(650);
  
  Logger.log('[MapSelector] Abrindo modal principal...');
  SpreadsheetApp.getUi().showModalDialog(htmlWithData, 'Procurar datas de entrega');
  
  Logger.log('[MapSelector] ========== FIM saveMapSelection (sucesso) ==========');
  return true;
}


/**
 * Recupera a seleção do mapa salva anteriormente
 * @returns {Object|null} {lat, lng, display, provider} ou null se não existir
 */
function getMapSelection() {
  const key = 'MAP_SELECTION_' + Session.getTemporaryActiveUserKey();
  const stored = PropertiesService.getUserProperties().getProperty(key);
  
  if (!stored) return null;
  
  const data = JSON.parse(stored);
  
  // Limpar se muito antigo (>10 min)
  if (Date.now() - data.timestamp > 10 * 60 * 1000) {
    PropertiesService.getUserProperties().deleteProperty(key);
    return null;
  }
  
  // ✅ LIMPA IMEDIATAMENTE APÓS RETORNAR (uso único)
  PropertiesService.getUserProperties().deleteProperty(key);
  Logger.log('[MapSelector] Dados retornados e limpos: ' + JSON.stringify(data));
  
  return {
    ok: true,
    lat: data.lat,
    lng: data.lng,
    display: data.display,
    provider: data.provider
  };
}