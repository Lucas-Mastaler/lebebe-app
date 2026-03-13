/* ======================================
   CEP-APIBACK.gs
   ====================================== */

// ========== HELPER: Formatação Monetária (Global) ==========
function _fmtMoneyBR(n){ 
  if (typeof n !== 'number') return String(n||''); 
  return 'R$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.'); 
}

// ========== PROGRESSIVE RESULTS ==========
var _lastProgressSave = 0; // throttle timestamp

/**
 * Salva progresso parcial em PropertiesService (throttle: 1s)
 * @param {string} clientToken - Token único da pesquisa
 * @param {Array} normais - Lista de candidatos normais encontrados
 * @param {Array} extras - Lista de candidatos extras encontrados
 * @param {string} status - 'running' | 'done' | 'error'
 * @param {Object} context - Contexto com parâmetros necessários (freightParams, isRural, isCondominio, tipoBerco)
 */
function saveProgress_(clientToken, normais, extras, status, context) {
  if (!clientToken) return;
  
  // ✅ THROTTLE: não salvar mais que 1x por segundo
  var now = Date.now();
  if (status !== 'done' && status !== 'error' && (now - _lastProgressSave) < 1000) {
    return; // Skip para economizar quotas
  }
  _lastProgressSave = now;
  
  try {
    var ctx = context || {};
    
    var data = {
      normais: (normais || []).map(function(c) {
        var freteNum = 0;
        if (ctx.freightParams && c.delta !== undefined) {
          var distKm = Math.abs(c.delta);
          var isSabado = c.date ? (c.date.getDay() === 6) : false;
          freteNum = calcularFrete(distKm, isSabado, ctx.isRural, ctx.isCondominio, ctx.freightParams);
        }
        return {
          date: c.date ? c.date.toISOString() : null,
          team: c.team,
          delta: c.delta,
          availStr: c.availStr,
          frete: _fmtMoneyBR(freteNum),
          tipo: 'normal'
        };
      }),
      extras: (extras || []).map(function(c) {
        var freteNum = 0;
        if (ctx.freightParams && c.delta !== undefined) {
          var distKm = Math.abs(c.delta);
          var isSabado = c.date ? (c.date.getDay() === 6) : false;
          freteNum = calcularFrete(distKm, isSabado, ctx.isRural, ctx.isCondominio, ctx.freightParams);
          // Adicional vem do contexto (pode ser especial, premium ou hora marcada)
          freteNum = (Number(freteNum)||0) + (ctx.valorAdicional || 100);
        }
        return {
          date: c.date ? c.date.toISOString() : null,
          team: c.team,
          delta: c.delta,
          availStr: c.availStr,
          frete: _fmtMoneyBR(freteNum),
          tipo: ctx.tipoExtra || 'extra'
        };
      }),
      status: status || 'running',
      timestamp: now
    };
    
    PropertiesService.getScriptProperties().setProperty(
      'PROGRESS_' + clientToken,
      JSON.stringify(data)
    );
    
    dlog('[PROGRESS] Salvo: ' + (normais.length + extras.length) + ' resultados, status=' + status);
  } catch(e) {
    dlog('[PROGRESS] ERRO ao salvar: ' + e);
  }
}

/**
 * Retorna o progresso atual da pesquisa para o frontend
 * @param {string} clientToken - Token único da pesquisa
 * @returns {Object} {normais: [], extras: [], status: 'running'|'done'|'error'}
 */
function getProgressUpdate(clientToken) {
  if (!clientToken) return {status: 'error', error: 'No token'};
  
  try {
    var key = 'PROGRESS_' + clientToken;
    var stored = PropertiesService.getScriptProperties().getProperty(key);
    
    if (!stored) {
      return {status: 'waiting', normais: [], extras: []};
    }
    
    var data = JSON.parse(stored);
    
    // Limpar properties antigas (se já terminou e passou >5 min)
    if (data.status === 'done' && Date.now() - data.timestamp > 5*60*1000) {
      PropertiesService.getScriptProperties().deleteProperty(key);
    }
    
    return data;
  } catch(e) {
    return {status: 'error', error: String(e)};
  }
}
// ========== FIM PROGRESSIVE RESULTS ==========

// Cache de locais fixos por execução (depósito e casas)
var _FIXED_LOCATIONS_ = null;
function _getFixedLocations_(depositAddr, homeE1, homeE2) {
  if (_FIXED_LOCATIONS_) return _FIXED_LOCATIONS_;
  _FIXED_LOCATIONS_ = {
    deposit: geocodeAddressFree(depositAddr),
    homeE1: geocodeAddressFree(homeE1),
    homeE2: geocodeAddressFree(homeE2)
  };
  return _FIXED_LOCATIONS_;
}

/**
 * BACKEND – recebe parâmetros do FRONT e grava os resultados no FRONT.
 * Chamada pelo FRONT (Library): CEP.pesquisarRotaToTargetWithParams(frontId, 'PROCURAR DATAS DE ENTREGA', form)
 * form = {
 *   cep: '00000-000',
 *   isRural: true/false,
 *   tipoBerco: 'NIDO' | 'CONVENCIONAL' | ...,
 *   temComoda, temRoupeiro, temPoltrona, temPainel: true/false,
 *   tempoNecessario: 'HH:MM'
 * }
 */
function pesquisarRotaToTargetWithParams(targetSpreadsheetId, targetSheetName, form) {
  form = form || {};
  var returnOnly = !!form.returnOnly; // quando vier true, não grava na planilha: só retorna dados p/ o modal

  // ✅ TIMER: Rastrear tempo de execução
  var searchStartTime = Date.now();
  var searchElapsedSeconds = 0;
  var searchStartedAtIso = new Date(searchStartTime).toISOString();
  var processedSlotsCount = 0;

  // --- controle de idempotência (único) ---
  var clientToken = form && String(form.clientToken || '');
  var _cache = CacheService.getScriptCache();
  var _key   = clientToken ? ('RT:' + clientToken) : '';

  if (clientToken) {
    var seen = _cache.get(_key);
    if (seen === 'done') {
      Logger.log('idempotente: token já concluído ' + clientToken);
      return 'OK_DUP';
    }
    _cache.put(_key, 'inflight', 10*60); // 10 min
  }

  try {
    /* 0 – Aberturas explícitas */
    var ssSrc = abrirPlanilhaFonte_();

    var ssDest, shOut;
    if (!returnOnly) {
      ssDest = SpreadsheetApp.openById(String(targetSpreadsheetId));
      shOut  = ssDest.getSheetByName(String(targetSheetName));
      if (!shOut) { Logger.log('⚠️ Aba de destino não encontrada: ' + targetSheetName); return 'NOK_NO_SHEET'; }
    }

    /* ---------- 1 – Config (no BACKEND) ---------- */
    var cfgSheet = ssSrc.getSheets().find(function(s){ return s.getSheetId() === 718532388; });
    if (!cfgSheet) { Logger.log('⚠️ Config sheet não encontrada no backend'); return 'ERR_NO_CFG'; }

    /* ---------- 2 – Limpeza automática (>15 min) NO DESTINO ---------- */
    var lastRun = PROP_STORE.getProperty(LAST_RUN_PROP);
    if (!returnOnly && shOut && lastRun && Date.now() - new Date(lastRun).getTime() > 15 * 60 * 1000) {
      shOut.getRange('A5:J').clearContent();
      Logger.log('🗑️ Resultados antigos (destino) apagados (>15 min)');
    }
    PROP_STORE.setProperty(LAST_RUN_PROP, new Date().toISOString());
    try {
      PropertiesService.getDocumentProperties().setProperty('PRE_LAST_SIMULATION_RUN_AT', new Date().toISOString());
    } catch(e) {}

    /* ---------- 3 – Lê configurações (no BACKEND) ---------- */
    var AGENDA_SHEET = getConfig('PLANILHA DA AGENDA', cfgSheet);
    var AVAIL_SHEET  = getConfig('PLANILHA DE TEMPO DISPONIVEL', cfgSheet);
    API_KEY          = getConfig('API_KEY', cfgSheet);

    try { MAPSCO_API_KEY = String(getConfig('MAPS.CO API KEY', cfgSheet) || '').trim(); } catch(e) { MAPSCO_API_KEY=''; }
    try {
      var osrmCfg = getConfig('OSRM BASE URL', cfgSheet).trim();
      if (osrmCfg) OSRM_BASE = osrmCfg.replace(/\/+$/,'');
    } catch(e) {}
    dlog('[OSRM] endpoint ativo: ' + OSRM_BASE);
    osrmHealthWarmup();

    var MAX_EXTRA_METERS    = +getConfig('KM ADICIONAL MAX NA ROTA', cfgSheet);
    var MAX_WEEKDAY_METERS  = +getConfig('KM MAXIMO NA SEMANA',      cfgSheet);
    var MAX_SATURDAY_METERS = +getConfig('KM MAXIMO NO SÁBADO',      cfgSheet);
    var LOOK_DAYS           = +getConfig('DIAS DE PESQUISA NA AGENDA',cfgSheet);
    var MAX_POINT_KM        = +getConfig('KM MAX ENTRE PONTOS',      cfgSheet);
    var MAX_EXTRA_DYNAMIC   = +getConfig('KM ADICIONAL MAX NA ROTA ESPECIAL', cfgSheet) || 0;

    // === NOVOS PARÂMETROS: Frete Premium e Hora Marcada ===
    var MAX_EXTRA_PREMIUM         = +getConfig('KM ADICIONAL MAX NA ROTA PREMIUM', cfgSheet) || 0;
    var VALOR_ADICIONAL_ESPECIAL  = +getConfig('VALOR ADICIONAL NA ROTA ESPECIAL', cfgSheet) || 0;
    var VALOR_ADICIONAL_PREMIUM   = +getConfig('VALOR ADICIONAL NA ROTA PREMIUM', cfgSheet) || 0;
    var HORA_MARCADA_HORAS_A_MAIS = +getConfig('HORA MARCADA HORAS A MAIS', cfgSheet) || 0;
    var HORA_MARCADA_VALOR_ADICIONAL = +getConfig('HORA MARCADA VALOR ADICIONAL', cfgSheet) || 0;

    dlog('[PARAMS] KM Especial=' + MAX_EXTRA_DYNAMIC + 'm | KM Premium=' + MAX_EXTRA_PREMIUM + 'm');
    dlog('[PARAMS] Valor Especial=R$' + VALOR_ADICIONAL_ESPECIAL + ' | Valor Premium=R$' + VALOR_ADICIONAL_PREMIUM);
    dlog('[PARAMS] Hora Marcada: +' + HORA_MARCADA_HORAS_A_MAIS + 'h | Valor=R$' + HORA_MARCADA_VALOR_ADICIONAL);

    var DEPOSIT_ADDRESS = getConfig('ENDEREÇO DO DEPÓSITO', cfgSheet);
    var HOME_SAT_E1     = getConfig('ENDEREÇO DA CASA EQP 1', cfgSheet);
    var HOME_SAT_E2     = getConfig('ENDEREÇO DA CASA EQP 2', cfgSheet);
    var FIXED_LOCS      = _getFixedLocations_(DEPOSIT_ADDRESS, HOME_SAT_E1, HOME_SAT_E2);

    /* ---------- 3.1 – Parâmetros de frete ---------- */
    var freightParams = loadFreightParams(cfgSheet);

    /* ---------- 4 – Planilhas de trabalho (no BACKEND) ---------- */
    var shAv  = ssSrc.getSheetByName(AVAIL_SHEET);
    var shAg  = ssSrc.getSheetByName(AGENDA_SHEET);
    if (!shAv || !shAg) { Logger.log('⚠️ Abas de disponibilidade/agenda faltando no backend'); return 'ERR_NO_SHEETS'; }

    /* ---------- 5 – Entradas vindas do FRONT ---------- */
    var cepInput   = String(form.cep || '').trim();
    var cepFmt     = cepInput.replace(/\D/g,'').replace(/^(\d{5})(\d{3})$/, '$1-$2');
    var isRural    = !!form.isRural;
    var tipoBerco  = String(form.tipoBerco || '').trim().toUpperCase();
    var serviceMin = parseMinutes(String(form.tempoNecessario || '00:00'));

    var nomi = null;
    var locNovo = null;

    // Cache de payloads (somente returnOnly): assinatura simples com invalidação por DATA_VERSION
    var payloadSigRaw = [
      'v='+getDataVersion_(),
      'CEP='+cepFmt,
      'RURAL='+isRural,
      'COND='+!!form.isCondominio,
      'BERCO='+tipoBerco,
      'MIN='+serviceMin,
      'DATE='+(form.dataInicial||form.monthYear||form.mesPesquisa||'')
    ].join('|');
    var payloadSig = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, payloadSigRaw)
      .map(function(b){ return ('0'+(b & 255).toString(16)).slice(-2); }).join('');
    var payloadKey = 'PAYLOAD:'+payloadSig;
    if (returnOnly) {
      var cachedPayload = _cache.get(payloadKey);
      if (cachedPayload) {
        try {
          var parsedPayload = JSON.parse(cachedPayload);
          try {
            RegistrarExecucaoPesquisaAudit_({
              client_token: clientToken || null,
              origin: 'MODAL',
              user_email: Session.getActiveUser().getEmail() || null,
              cep: cepFmt || null,
              endereco_pesquisado: parsedPayload.address || null,
              endereco_curto: parsedPayload.addressShort || null,
              tempo_necessario: String(form.tempoNecessario || '') || null,
              is_rural: !!isRural,
              is_condominio: !!form.isCondominio,
              total_duration_ms: Date.now() - searchStartTime,
              search_time_seconds: Number((((Date.now() - searchStartTime) / 1000)).toFixed(1)),
              total_candidates: (parsedPayload.candidates || []).length,
              total_candidates_normal: 0,
              total_candidates_especial: 0,
              total_candidates_premium: 0,
              total_candidates_hora_marcada: 0,
              total_slots_processed: 0,
              total_slots_available: 0,
              early_stop: false,
              status: 'success',
              error_message: null,
              started_at: searchStartedAtIso,
              finished_at: new Date().toISOString()
            });
          } catch(_cachedAuditError) {}
          return parsedPayload;
        } catch(e){}
      }
    }

    // ✅ NOVO: Aceitar coordenadas já validadas do modal
    // Verifica tanto destLat/destLng (mapa) quanto lat/lng (validação de endereço)
    var modalHasDest = (form.destLat != null && form.destLng != null) || 
                       (form.lat != null && form.lng != null);
    var useModalOnly = !!form.useModalDestOnly && modalHasDest;

    // (A) Se o modal enviou coordenadas confirmadas (validação ou mapa), use-as
    if (modalHasDest) {
      // Priorizar destLat/destLng (do mapa) ou usar lat/lng (da validação)
      var useLat = form.destLat != null ? Number(form.destLat) : Number(form.lat);
      var useLng = form.destLng != null ? Number(form.destLng) : Number(form.lng);
      var useDisplay = form.destDisplay || form.enderecoCompleto || '';
      var useProvider = form.destProvider || 'validated';
      
      locNovo = { lat: useLat, lng: useLng };
      nomi = {
        lat: locNovo.lat,
        lng: locNovo.lng,
        display_name: String(useDisplay),
        enderecoCompleto: String(useDisplay),
        provider: String(useProvider),
        address: null
      };
      dlog('[MODAL-COORDS] ✅ Usando coordenadas validadas do modal: lat=' + useLat.toFixed(6) + 
           ' lng=' + useLng.toFixed(6) + ' provider=' + useProvider);
    }

    // (B0) CEP como fonte primária (rápido): usa LookupEnderecoPorCEP (L1/L2 + provedores grátis; Google só se necessário)
    if (!useModalOnly && !locNovo && /^\d{5}-\d{3}$/.test(cepFmt)) {
      try {
        var cepLookup = LookupEnderecoPorCEP(cepFmt);
        dlog('[CEP-LOOKUP] Resultado: ' + JSON.stringify({
          ok: cepLookup && cepLookup.ok,
          display: cepLookup && cepLookup.display,
          enderecoCompleto: cepLookup && cepLookup.enderecoCompleto,
          hasAddress: !!(cepLookup && cepLookup.address)
        }));
        
        if (cepLookup && cepLookup.ok) {
          locNovo = { lat: Number(cepLookup.lat||0), lng: Number(cepLookup.lng||0) };
          var endCompleto = String(cepLookup.enderecoCompleto || cepLookup.display_name || cepLookup.display || '');
          nomi = {
            lat: locNovo.lat,
            lng: locNovo.lng,
            display_name: String(cepLookup.display_name || cepLookup.display || ''),
            provider: String(cepLookup.provider||'free'),
            address: cepLookup.address || null,
            enderecoCompleto: endCompleto // ✅ Preservar endereço completo
          };
          dlog('[NOMI-SET] enderecoCompleto="' + endCompleto + '"');
        }
      } catch(_){ }
    }

    // (B) Caso NÃO seja “modal-only”, ainda podemos tentar cache/Google/Nominatim
    if (!useModalOnly && !locNovo) {
      // cache do Google salvo por LookupEnderecoPorCEP
      var ck = 'cepaddr:GOOGLE:' + cepFmt;
      try {
        var hit = CacheService.getScriptCache().get(ck);

        if (hit) {
          var obj = JSON.parse(hit);
          locNovo = { lat: Number(obj.lat||0), lng: Number(obj.lng||0) };
          nomi = {
            lat: locNovo.lat,
            lng: locNovo.lng,
            display_name: String(obj.display || ''),
            provider: 'google',
            address: obj.address || null
          };
        }
      } catch(e) {}

      // (C) Último recurso: Google estrito → Nominatim
      if (!locNovo) {
        var gOnly = geocodeCepGoogleStrict(cepFmt.replace(/\D/g,''), ['PR','SP','SC']);
        if (gOnly) {
          locNovo = { lat: gOnly.lat, lng: gOnly.lng };
          nomi = gOnly;
        } else {
          nomi = geocodeCepNominatim(cepFmt); // fallback legado
          if (nomi) locNovo = { lat: nomi.lat, lng: nomi.lng };
        }
      }
    }

    // valida
    if (!nomi || !locNovo) { 
      Logger.log('🔴 CEP inválido: "' + cepInput + '"'); 
      return 'ERR_BAD_CEP'; 
    }

    // Log com o provider real
    var prov = nomi.provider || 'desconhecido';
    dlog('[DEST] CEP="' + cepFmt + '" | provider=' + prov + ' | display="' + nomi.display_name + '"'
        + ' | lat=' + locNovo.lat.toFixed(6) + ' lng=' + locNovo.lng.toFixed(6));

    // Se algum trecho posterior monta A3, prefira o display do modal quando disponível
    var a3Text = (form.destDisplay || '') || (nomi.display_name || '');
    if (!a3Text && nomi.address) {
      var a = nomi.address;
      a3Text = [
        a.road || a.residential || a.pedestrian || '',
        a.suburb || a.neighbourhood || '',
        (a.city || a.town || a.village || ''),
        (a.state || '')
      ].filter(Boolean).join(', ');
    }
    if (!returnOnly && shOut) {
      shOut.getRange('A3').setValue(a3Text || '—');
    }

    /* ---------- 6 – Distância depósito → destino ---------- */
    var depositoLoc = FIXED_LOCS.deposit || geocodeAddressFree(DEPOSIT_ADDRESS);

    dlog('[ORIGEM] depósito="' + DEPOSIT_ADDRESS + '" | lat=' + depositoLoc.lat.toFixed(6) + ' lng=' + depositoLoc.lng.toFixed(6));
    var distKm = getDrivingKm(depositoLoc, locNovo);
    dlog('📏 Depósito → destino: ' + fmtBothKmM(distKm));

    /* ---------- 7 – Slots ---------- */
    // NOVO: procura "a partir de" com suporte a dataInicial (prioridade) ou monthYear (fallback)
    var startPick = _resolveStartFromDate_(form);
    var slots = startPick
      ? getSlots(shAv, serviceMin, LOOK_DAYS, startPick.startFrom /* sem end */)
      : getSlots(shAv, serviceMin, LOOK_DAYS);

    // 🔒 Regra: bloquear EQUIPE 2 se (BERÇO/CAMA === "FORMARE") OU (ROUPEIRO === "4 PTS (TUTTO)")
    try {
      // Preferir valores do modal
      var bercoVal    = String(form.tipoBerco || '').trim();   // BERÇO/CAMA (D2)
      var roupeiroVal = String(form.roupeiro  || '').trim();   // ROUPEIRO   (F2)

      // Se vierem vazios, buscar na planilha (D2 e F2)
      if (!bercoVal || !roupeiroVal) {
        var ssTmp = abrirPlanilhaFonte_();
        var cfgTmp = ssTmp.getSheets().find(function(s){ return s.getSheetId() === 718532388; });
        var cepSheetName = getConfig('PLANILHA DO CEP', cfgTmp);
        var shCepTmp = ssTmp.getSheetByName(cepSheetName);
        if (shCepTmp) {
          if (!bercoVal)    bercoVal    = String(shCepTmp.getRange('D2').getDisplayValue() || '').trim();
          if (!roupeiroVal) roupeiroVal = String(shCepTmp.getRange('F2').getDisplayValue() || '').trim();
        }
      }

      var bUp = bercoVal.toUpperCase();
      var rUp = roupeiroVal.toUpperCase();

      var bloqueia = (bUp === 'FORMARE') || (rUp === '4 PTS (TUTTO)');
      if (bloqueia) {
        var before2 = slots.length;
        slots = slots.filter(function(s){ return String(s.team||'').toUpperCase() !== 'EQUIPE 2'; });
        dlog('[RULE] Bloqueio aplicado (withParams): BERÇO/CAMA="' + bercoVal + '", ROUPEIRO="' + roupeiroVal +
             '" → removidos ' + (before2 - slots.length) + ' slots da EQUIPE 2');
      } else {
        dlog('[RULE] Bloqueio NÃO aplicado: BERÇO/CAMA="' + bercoVal + '", ROUPEIRO="' + roupeiroVal + '" → EQUIPE 2 permitida');
      }
    } catch(_){ /* silencioso */ }

    // 📅 Regra: EQUIPE 2 em quartas-feiras só faz serviços até 02:30
    try {
      var beforeWed = slots.length;
      slots = slots.filter(function(s){
        // Se não for quarta-feira (dia 3), mantém
        if (s.date.getDay() !== 3) return true;
        // Se não for EQUIPE 2, mantém
        if (String(s.team||'').toUpperCase() !== 'EQUIPE 2') return true;
        // É quarta + EQUIPE 2: só mantém se serviceMin <= 150min (02:30)
        var keep = serviceMin <= 150;
        if (!keep) {
          dlog('[RULE-QUARTA] Removido slot ' + formatDatePt(s.date) + ' | EQUIPE 2 | tempo=' + serviceMin + 'min > 150min (02:30)');
        }
        return keep;
      });
      var removidos = beforeWed - slots.length;
      if (removidos > 0) {
        dlog('[RULE-QUARTA] Total removido: ' + removidos + ' slots da EQUIPE 2 em quartas (tempo necessário=' + serviceMin + 'min > 02:30)');
      }
    } catch(_){ /* silencioso */ }

    // agora sim, ordena
    slots.sort((a,b)=>a.date - b.date);

    // ✅ OTIMIZAÇÃO #5: Limitar a 45 dias da data inicial (economiza processamento)
    if (startPick && startPick.startFrom) {
      const limitDate = new Date(startPick.startFrom.getTime());
      limitDate.setDate(limitDate.getDate() + 45); // 45 dias (reduzido de 60)
      const slotsBefore = slots.length;
      slots = slots.filter(function(s){ return s.date <= limitDate; });
      if (slotsBefore > slots.length) {
        dlog('[OTIMIZAÇÃO] Limitado a 45 dias: ' + slotsBefore + ' → ' + slots.length + ' slots (−' + (slotsBefore - slots.length) + ')');
      }
    }

    // ✅ OTIMIZAÇÃO #1: Processar apenas primeiros 35 slots com pontos para busca rápida
    const slotsComPontosTodos = slots.filter(function(s){ return s.pontos && s.pontos.length > 0; });
    const slotsVazios = slots.filter(function(s){ return !s.pontos || s.pontos.length === 0; });
    
    // Limitar slots com pontos para acelerar (10 candidatos geralmente vêm dos primeiros 20-30 slots)
    const slotsComPontos = slotsComPontosTodos.slice(0, 35);
    const slotsComPontosDescartados = slotsComPontosTodos.slice(35);
    
    if (slotsVazios.length > 0 || slotsComPontosDescartados.length > 0) {
      dlog('[OTIMIZAÇÃO] Total=' + slots.length + ' → processando ' + slotsComPontos.length + 
           ' com pontos (−' + slotsVazios.length + ' vazios, −' + slotsComPontosDescartados.length + ' adiados)');
    }

    /* ---------- 8 – Agenda / pontos ---------- */
    var rowsAg = shAg.getLastRow() - 1;
    var agVals = shAg.getRange(2,1,rowsAg,7).getValues();
    var agDisp = shAg.getRange(2,1,rowsAg,7).getDisplayValues();
    slots.forEach(function(s){ s.pontos = coletarPontosDoDia(s, agVals, agDisp); });

    /* ---------- 9 – Cache inteligente ---------- */
    // ✅ OTIMIZAÇÃO: Separar hash de slots (agenda) do hash de destino
    // Evita aquecimento desnecessário quando re-pesquisando mesmo CEP
    
    // Hash 1: Apenas agenda (não inclui destino)
    var slotsPayload = agDisp.map(function(r){ return r[5] + r[4]; }).join('|');
    var slotsHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, slotsPayload)
      .map(function(b){ return ('0' + (b & 255).toString(16)).slice(-2); }).join('');

    // Hash 2: Destino específico (4 decimais = ~11m precisão)
    var destinoKey = cepFmt + ':' + locNovo.lat.toFixed(4) + ',' + locNovo.lng.toFixed(4);

    var lastSlotsHash = PROP_STORE.getProperty('SLOTS_HASH');
    var warmedDestinos = PROP_STORE.getProperty('WARMED_DESTINOS') || '{}';
    var warmedMap = {};
    try { warmedMap = JSON.parse(warmedDestinos); } catch(e) {}

    var slotsChanged = (lastSlotsHash !== slotsHash);
    var destinoWarmed = !!warmedMap[destinoKey];

    if (slotsChanged || !destinoWarmed) {
      if (slotsChanged) {
        Logger.log('🔄 Slots mudaram (agenda atualizada) — aquecendo cache completo');
        warmedMap = {}; // Limpar cache de destinos quando agenda muda
      } else {
        Logger.log('🔄 Novo destino — aquecendo cache para este local');
      }
      
      warmUpCepCache(locNovo, slots, DEPOSIT_ADDRESS, HOME_SAT_E1, HOME_SAT_E2);
      
      // Salvar novos hashes
      PROP_STORE.setProperty('SLOTS_HASH', slotsHash);
      warmedMap[destinoKey] = true;
      try {
        PROP_STORE.setProperty('WARMED_DESTINOS', JSON.stringify(warmedMap));
      } catch(e) {
        // Se ficar muito grande (>9KB), limpa e mantém só este
        Logger.log('[CACHE] Properties muito grande, limpando histórico');
        PROP_STORE.setProperty('WARMED_DESTINOS', JSON.stringify({[destinoKey]: true}));
      }
    } else {
      Logger.log('✅ Cache válido (slots e destino já aquecidos)');
    }

    /* ========== FAST-PASS: PRÉVIA RÁPIDA EM <15s ========== */
    // ✅ Gera 1-3 resultados rápidos ANTES do loop pesado
    // Isso garante que o usuário veja algo na tela em ~10-12s
    dlog('[FAST-PASS] Iniciando prévia rápida...');
    var fastPassStart = Date.now();
    var fastPassNormais = [];
    var fastPassExtras = [];
    
    try {
      // Pegar primeiros 10-12 slots com pontos para análise rápida
      var fastSlots = slotsComPontos.slice(0, Math.min(12, slotsComPontos.length));
      
      for (var fi = 0; fi < fastSlots.length && fastPassNormais.length < 3; fi++) {
        var fs = fastSlots[fi];
        if (!fs.pontos || fs.pontos.length === 0) continue;
        
        // Usar Haversine (sem OSRM) para cálculo super rápido
        var closest = fs.pontos[0];
        var minDist = haversineKm(locNovo, closest.loc);
        
        for (var fj = 1; fj < fs.pontos.length; fj++) {
          var dist = haversineKm(locNovo, fs.pontos[fj].loc);
          if (dist < minDist) {
            minDist = dist;
            closest = fs.pontos[fj];
          }
        }
        
        // Distância rough em km (Haversine * 1.3 para aproximar rota real)
        var roughKm = minDist * 1.3;
        
        // Se parece viável, adicionar como candidato rápido
        if (roughKm <= MAX_POINT_KM * 2) { // Critério bem relaxado
          var fastCand = {
            date: fs.date,
            team: fs.team,
            delta: roughKm,
            availStr: fs.availStr,
            pontos: fs.pontos
          };
          
          // Separar normal vs extra (critério simplificado)
          if (roughKm <= MAX_POINT_KM * 1.2) {
            fastPassNormais.push(fastCand);
          } else {
            fastPassExtras.push(fastCand);
          }
        }
      }
      
      // Ordenar por delta crescente
      fastPassNormais.sort(function(a,b){ return a.delta - b.delta; });
      fastPassExtras.sort(function(a,b){ return a.delta - b.delta; });
      
      // Pegar no máximo 2 de cada
      fastPassNormais = fastPassNormais.slice(0, 2);
      fastPassExtras = fastPassExtras.slice(0, 1);
      
      var fastPassElapsed = Date.now() - fastPassStart;
      dlog('[FAST-PASS] Concluído em ' + fastPassElapsed + 'ms: ' + 
           fastPassNormais.length + ' normais + ' + fastPassExtras.length + ' extras');
      
      // ✅ SALVAR PRÉVIA IMEDIATAMENTE
      if (fastPassNormais.length > 0 || fastPassExtras.length > 0) {
        var ctx = { freightParams: freightParams, isRural: isRural, isCondominio: !!form.isCondominio };
        saveProgress_(clientToken, fastPassNormais, fastPassExtras, 'running', ctx);
        dlog('[FAST-PASS] Prévia salva! Usuário verá resultados em <15s');
      }
    } catch(e) {
      dlog('[FAST-PASS] ERRO: ' + e);
      // Continuar normalmente mesmo se fast-pass falhar
    }
    /* ========== FIM FAST-PASS ========== */

    /* ---------- 10 – Loop de simulação ---------- */
    // === SESSÃO: SEPARAÇÃO POR TIPO DE FRETE ===
    // - porDiaBestNormal[k]      => melhor candidato (Δ) respeitando limite base
    // - porDiaBestEspecial[k]    => melhor candidato (Δ) com +5 km acima do limite base
    // - porDiaBestPremium[k]     => melhor candidato (Δ) com +10 km acima do limite base
    // - porDiaHoraMarcada[k]     => candidatos com tempo adicional (HORA MARCADA HORAS A MAIS)
    var porDiaBestNormal    = Object.create(null);
    var porDiaBestEspecial  = Object.create(null);
    var porDiaBestPremium   = Object.create(null);
    var porDiaHoraMarcada   = Object.create(null);

    // ✅ OTIMIZAÇÃO: Processar primeiro slots com pontos (onde há trabalho real)
    // Slots vazios serão processados depois apenas se necessário
    var slotsParaProcessar = slotsComPontos.concat(slotsVazios);

    // ✅ CONFIGURAÇÃO DE EARLY STOP
    var isBackendApiCall = !!(form.limitResultsNormal && form.limitResultsNormal > 0);
    var MAX_CANDIDATOS_TOTAL = isBackendApiCall ? form.limitResultsNormal : 10;
    var totalCandidatos = 0;
    var earlyStop = false;
    
    if (isBackendApiCall) {
      dlog('[BACKEND-API] Limite ativo: ' + MAX_CANDIDATOS_TOTAL + ' resultados normais (early stop habilitado)');
    }
    
    for (var sIdx = 0; sIdx < slotsParaProcessar.length && !earlyStop; sIdx++){
      var slot = slotsParaProcessar[sIdx];
      processedSlotsCount = sIdx + 1;


      dlog('[SLOT] ' + formatDatePt(slot.date) + ' | ' + slot.team + ' | livre="' + slot.availStr + '" | pontos=' + slot.pontos.length);

      var originAddr = slot.date.getDay()===6
        ? (slot.team==='EQUIPE 1'?HOME_SAT_E1:HOME_SAT_E2)
        : DEPOSIT_ADDRESS;

      var originLoc = (slot.date.getDay()===6)
        ? (slot.team==='EQUIPE 1' ? (FIXED_LOCS.homeE1 || geocodeAddressFree(HOME_SAT_E1))
                                   : (FIXED_LOCS.homeE2 || geocodeAddressFree(HOME_SAT_E2)))
        : (FIXED_LOCS.deposit || geocodeAddressFree(DEPOSIT_ADDRESS));

      dlog('[ORIGEM] ' + formatDatePt(slot.date) + ' | ' + slot.team + ' | origem="' + originAddr + '" | lat=' + originLoc.lat.toFixed(6) + ' lng=' + originLoc.lng.toFixed(6));

      var baseRoute = rotaOtimizada(originLoc, slot.pontos);
      dlog('[ROTA BASE] ordem=' + JSON.stringify(baseRoute.order));

      var limiteKmBase  = slot.pontos.length
        ? (MAX_EXTRA_METERS/1000)
        : (slot.date.getDay()===6 ? (MAX_SATURDAY_METERS/1000) : (MAX_WEEKDAY_METERS/1000));

      // === SESSÃO: CÁLCULO DOS LIMITES POR TIPO DE FRETE ===
      var limiteKmEspecial = limiteKmBase + 5; // +5 km para especial
      var limiteKmPremium  = limiteKmBase + 10; // +10 km para premium

      dlog('[LIMITE] ' + formatDatePt(slot.date) + ' | ' + slot.team + 
           ' | base=' + (limiteKmBase*1000).toFixed(0) + ' m' +
           ' | especial=' + (limiteKmEspecial*1000).toFixed(0) + ' m' +
           ' | premium=' + (limiteKmPremium*1000).toFixed(0) + ' m');

      if (slot.pontos.length) {
        // ✅ OTIMIZAÇÃO #3: Filtro rápido (Haversine) antes de chamar OSRM (economiza ~50s)
        var nearestStraight = Infinity;
        for (var pi = 0; pi < slot.pontos.length; pi++) {
          var distReta = haversineKm(slot.pontos[pi].loc, locNovo);
          if (distReta < nearestStraight) nearestStraight = distReta;
        }
        
        // Se distância reta > MAX_POINT_KM * 1.5, descarta sem calcular rota
        // 1.5x = margem de segurança (rota pode ser até 50% maior que linha reta)
        if (nearestStraight > MAX_POINT_KM * 1.5) {
          dlog('[FILTER-EARLY] Descartado por distância reta: ' + nearestStraight.toFixed(2) + 'km (>' + (MAX_POINT_KM * 1.5).toFixed(2) + 'km)');
          continue;
        }

        // ✅ OTIMIZAÇÃO: Batch de rotas para todos os pontos deste slot
        var nearCheckRoutes = [];
        slot.pontos.forEach(function(p){
          nearCheckRoutes.push({ from: p.loc, to: locNovo });
        });
        
        var nearCheckDistances = getDrivingKmBatch(nearCheckRoutes);
        
        // Log dos resultados
        for (var pi = 0; pi < slot.pontos.length; pi++) {
          var p = slot.pontos[pi];
          var dkKm = nearCheckDistances[pi];
          dlog('[NEARCHK] "' + p.eventTitle + '" @ "' + p.addr + '" → novo=' + (dkKm*1000).toFixed(0) + ' m (' + fmtKm(dkKm) + ')');
        }

        // Encontrar ponto mais próximo
        var near = slot.pontos[0], nearKm = nearCheckDistances[0];
        for (var pi = 1; pi < slot.pontos.length; pi++) {
          if (nearCheckDistances[pi] < nearKm) {
            near = slot.pontos[pi];
            nearKm = nearCheckDistances[pi];
          }
        }
        
        // ✅ Regex melhorado: aceita espaços no CEP (ex: "81230- 380" ou "81230 - 380")
        var pontoCep = (String(near.addr).match(/(\d{5}\s*-\s*\d{3})/)||[null])[1];
        var depoCep  = (DEPOSIT_ADDRESS.match(/(\d{5}\s*-\s*\d{3})/)||[null])[1];
        
        // Normalizar CEPs removendo espaços para comparação
        if (pontoCep) pontoCep = pontoCep.replace(/\s+/g, '');
        if (depoCep) depoCep = depoCep.replace(/\s+/g, '');

        // ✅ FILTRO: Só descarta se ENCONTROU CEP diferente do depósito E distância excede limite PREMIUM
        // Agora consideramos o limite máximo possível (premium = +10km acima do normal)
        var limiteMaximoFiltro = MAX_POINT_KM + (MAX_EXTRA_PREMIUM / 1000);
        if (pontoCep && pontoCep!==depoCep && nearKm > limiteMaximoFiltro) {
          dlog('[FILTER] Descartado: CEP=' + pontoCep + ' | distância=' + nearKm.toFixed(2) + 'km > limite premium=' + limiteMaximoFiltro.toFixed(2) + 'km');
          continue;
        }
        
        // Log simplificado quando passa no filtro
        if (pontoCep) {
          dlog('[FILTER] OK: CEP=' + pontoCep + ' | distância=' + nearKm.toFixed(2) + 'km ≤ limite premium=' + limiteMaximoFiltro.toFixed(2) + 'km');
        }
      }

      // ✅ OTIMIZAÇÃO: Calcular melhor inserção com batch
      // Preparar todas as rotas necessárias de uma vez
      var bestKm = Infinity;
      var ordered = baseRoute.order.slice(1).map(function(a){ 
        return slot.pontos.find(function(p){ return p.addr===a; }); 
      });

      var insertionRoutes = [];
      var insertionMeta = []; // Guarda metadata de cada trio de rotas
      
      for (var i=0;i<=ordered.length;i++){
        var prev = i===0 ? originLoc : ordered[i-1].loc;
        var next = i < ordered.length ? ordered[i].loc : null;
        
        var metaEntry = { startIdx: insertionRoutes.length };
        insertionRoutes.push({ from: prev, to: locNovo });
        
        if (next) {
          insertionRoutes.push({ from: locNovo, to: next });
          insertionRoutes.push({ from: prev, to: next });
          metaEntry.hasNext = true;
        } else {
          metaEntry.hasNext = false;
        }
        
        insertionMeta.push(metaEntry);
      }
      
      // Executar batch de todas as rotas
      var insertionDistances = getDrivingKmBatch(insertionRoutes);
      
      // Calcular melhor inserção usando resultados do batch
      for (var i = 0; i < insertionMeta.length; i++) {
        var meta = insertionMeta[i];
        var idx = meta.startIdx;
        
        var prevNovoKm = insertionDistances[idx];
        var novoNextKm = 0;
        var prevNextKm = 0;
        
        if (meta.hasNext) {
          novoNextKm = insertionDistances[idx + 1];
          prevNextKm = insertionDistances[idx + 2];
        }
        
        var incKm = prevNovoKm + novoNextKm - prevNextKm;
        if (incKm < bestKm) bestKm = incKm;
      }

      var k = slot.date.toDateString();
      var cand = { date: slot.date, team: slot.team, delta: bestKm, availStr: slot.availStr, pontos: slot.pontos };

      // === SESSÃO: CLASSIFICAÇÃO DE CANDIDATOS POR TIPO ===
      
      // 1. Candidato NORMAL (dentro do limite base)
      if (bestKm <= limiteKmBase) {
        if (!porDiaBestNormal[k] || Math.abs(cand.delta) < Math.abs(porDiaBestNormal[k].delta)) {
          porDiaBestNormal[k] = cand;
        }
      } 
      // 2. Candidato ESPECIAL (+5 km acima do limite normal)
      else if (bestKm <= limiteKmEspecial && MAX_EXTRA_DYNAMIC > 0) {
        if (!porDiaBestEspecial[k] || Math.abs(cand.delta) < Math.abs(porDiaBestEspecial[k].delta)) {
          porDiaBestEspecial[k] = cand;
          dlog('[ESPECIAL] Candidato: ' + formatDatePt(slot.date) + ' | ' + slot.team + ' | delta=' + bestKm.toFixed(2) + 'km');
        }
      } 
      // 3. Candidato PREMIUM (+10 km acima do limite normal)
      else if (bestKm <= limiteKmPremium && MAX_EXTRA_PREMIUM > 0) {
        if (!porDiaBestPremium[k] || Math.abs(cand.delta) < Math.abs(porDiaBestPremium[k].delta)) {
          porDiaBestPremium[k] = cand;
          dlog('[PREMIUM] Candidato: ' + formatDatePt(slot.date) + ' | ' + slot.team + ' | delta=' + bestKm.toFixed(2) + 'km');
        }
      } else {
        dlog('[BEST] Δ excedeu até o limite premium — descartado');
      }

      // 4. Candidato HORA MARCADA (mesmo limite de distância dos normais, mas com tempo adicional)
      // Verifica se o slot tem tempo suficiente: serviceMin + HORA_MARCADA_HORAS_A_MAIS
      if (HORA_MARCADA_HORAS_A_MAIS > 0 && bestKm <= limiteKmBase) {
        var tempoNecessarioComAdicional = serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60); // converter horas para minutos
        // Precisamos do availMin do slot para comparar
        var slotAvailMin = parseMinutes(slot.availStr);
        
        if (slotAvailMin >= tempoNecessarioComAdicional) {
          if (!porDiaHoraMarcada[k] || Math.abs(cand.delta) < Math.abs(porDiaHoraMarcada[k].delta)) {
            porDiaHoraMarcada[k] = cand;
            dlog('[HORA MARCADA] Candidato: ' + formatDatePt(slot.date) + ' | ' + slot.team + 
                 ' | tempo disponível=' + slot.availStr + ' (precisa ' + tempoNecessarioComAdicional + 'min)');
          }
        }
      }

      // ✅ EARLY STOP: Contar total de candidatos únicos encontrados
      if (isBackendApiCall) {
        // Backend API: contar APENAS candidatos normais
        totalCandidatos = Object.keys(porDiaBestNormal).length;
        
        // Parar quando atingir o limite de normais
        if (totalCandidatos >= MAX_CANDIDATOS_TOTAL) {
          dlog('[BACKEND-API] ✅ EARLY STOP: ' + totalCandidatos + ' resultados normais encontrados');
          earlyStop = true;
        }
      } else {
        // Modal: contar todos os tipos de candidatos
        var diasUnicos = new Set();
        Object.keys(porDiaBestNormal).forEach(function(k){ diasUnicos.add(k); });
        Object.keys(porDiaBestEspecial).forEach(function(k){ diasUnicos.add(k); });
        Object.keys(porDiaBestPremium).forEach(function(k){ diasUnicos.add(k); });
        Object.keys(porDiaHoraMarcada).forEach(function(k){ diasUnicos.add(k); });
        
        totalCandidatos = diasUnicos.size;
        
        if (totalCandidatos >= MAX_CANDIDATOS_TOTAL) {
          earlyStop = true;
        }
      }
      
      // ✅ SALVAR PROGRESSO quando tiver candidatos suficientes
      if (totalCandidatos >= 3 || sIdx % 5 === 0) { // A cada 3+ candidatos ou a cada 5 slots
        var normaisList = Object.keys(porDiaBestNormal).map(function(dk){ return porDiaBestNormal[dk]; });
        var extrasList = Object.keys(porDiaBestEspecial).map(function(dk){ return porDiaBestEspecial[dk]; });
        var ctx = { freightParams: freightParams, isRural: isRural, isCondominio: !!form.isCondominio };
        saveProgress_(clientToken, normaisList, extrasList, 'running', ctx);
      }
      
      // ✅ PARAR QUANDO ENCONTRAR 10 CANDIDATOS
      if (totalCandidatos >= MAX_CANDIDATOS_TOTAL) {
        searchElapsedSeconds = ((Date.now() - searchStartTime) / 1000).toFixed(1);
        dlog('[EARLY-STOP] ✅ Encontrou ' + totalCandidatos + ' candidatos únicos em ' + searchElapsedSeconds + 's — PARANDO BUSCA');
        dlog('[EARLY-STOP] Processados ' + (sIdx + 1) + '/' + slotsParaProcessar.length + ' slots (' + 
             Math.round((sIdx + 1) / slotsParaProcessar.length * 100) + '%)');
        earlyStop = true;
      }
    }

    // === SESSÃO: SELEÇÃO FINAL DOS RESULTADOS ===
    // - até 5 dias únicos de "normal"
    // - 1 dia único de "especial"
    // - 1 dia único de "premium"
    // - 1 dia único de "hora marcada"
    var normals = Object.values(porDiaBestNormal).sort(function(a,b){ return a.date - b.date; });
    var especiais = Object.values(porDiaBestEspecial).sort(function(a,b){ return a.date - b.date; });
    var premiums = Object.values(porDiaBestPremium).sort(function(a,b){ return a.date - b.date; });
    var horaMarcadas = Object.values(porDiaHoraMarcada).sort(function(a,b){ return a.date - b.date; });

    // ✅ LOG: Todos os candidatos ANTES da seleção final
    dlog('[CANDIDATOS] Encontrados ANTES da seleção:');
    if (normals.length > 0) {
      dlog('  [NORMAIS] ' + normals.length + ' candidatos: ' + 
           normals.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team + ' | Δ=' + c.delta.toFixed(2) + 'km'; }).join(', '));
    }
    if (especiais.length > 0) {
      dlog('  [ESPECIAIS] ' + especiais.length + ' candidatos: ' + 
           especiais.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team + ' | Δ=' + c.delta.toFixed(2) + 'km'; }).join(', '));
    }
    if (premiums.length > 0) {
      dlog('  [PREMIUM] ' + premiums.length + ' candidatos: ' + 
           premiums.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team + ' | Δ=' + c.delta.toFixed(2) + 'km'; }).join(', '));
    }
    if (horaMarcadas.length > 0) {
      dlog('  [HORA MARCADA] ' + horaMarcadas.length + ' candidatos: ' + 
           horaMarcadas.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team; }).join(', '));
    }

    // ✅ FILTRO BACKEND API: Retornar apenas 3 resultados normais
    if (isBackendApiCall) {
      dlog('[BACKEND-API] Filtrando para retornar apenas ' + MAX_CANDIDATOS_TOTAL + ' resultados normais');
      
      var chosenDays = new Set();
      var listaNormal = [];
      for (var n=0; n<normals.length && listaNormal.length<MAX_CANDIDATOS_TOTAL; n++){
        var dk = normals[n].date.toDateString();
        if (!chosenDays.has(dk)) {
          listaNormal.push(normals[n]);
          chosenDays.add(dk);
        }
      }
      
      // Inicializar arrays vazios para evitar undefined
      var listaEspecial = [];
      var listaPremium = [];
      var listaHoraMarcada = [];
      
      var lista = listaNormal;
      lista.sort(function(a,b){ return a.date - b.date; });
      
      dlog('[BACKEND-API] Retornando ' + lista.length + ' resultados normais (especial/premium/hora marcada excluídos)');
    } else {
      // Modal: retornar todos os tipos (comportamento original)
      var chosenDays = new Set();
      var listaNormal = [];
      for (var n=0; n<normals.length && listaNormal.length<5; n++){
        var dk = normals[n].date.toDateString();
        if (!chosenDays.has(dk)) {
          listaNormal.push(normals[n]);
          chosenDays.add(dk);
        }
      }

      var listaEspecial = [];
      for (var e=0; e<especiais.length && listaEspecial.length<1; e++){
        var dk2 = especiais[e].date.toDateString();
        if (!chosenDays.has(dk2)) {
          listaEspecial.push(especiais[e]);
          chosenDays.add(dk2);
        }
      }

      var listaPremium = [];
      for (var p=0; p<premiums.length && listaPremium.length<1; p++){
        var dk3 = premiums[p].date.toDateString();
        if (!chosenDays.has(dk3)) {
          listaPremium.push(premiums[p]);
          chosenDays.add(dk3);
        }
      }

      var listaHoraMarcada = [];
      for (var h=0; h<horaMarcadas.length && listaHoraMarcada.length<1; h++){
        var dk4 = horaMarcadas[h].date.toDateString();
        if (!chosenDays.has(dk4)) {
          listaHoraMarcada.push(horaMarcadas[h]);
          chosenDays.add(dk4);
        }
      }

      // Combinar todas as listas e ordenar por data (mais próxima primeiro)
      var lista = [].concat(listaNormal, listaEspecial, listaPremium, listaHoraMarcada);
      lista.sort(function(a,b){ return a.date - b.date; }); // ✅ ORDENAÇÃO POR DATA
    }
    
    // ✅ LOG: Resultados SELECIONADOS para retorno
    dlog('[SELEÇÃO FINAL] Total selecionado: ' + lista.length + ' | Normais: ' + listaNormal.length + 
         ' | Especial: ' + listaEspecial.length + ' | Premium: ' + listaPremium.length + 
         ' | Hora Marcada: ' + listaHoraMarcada.length);
    
    // Log detalhado dos selecionados
    if (listaNormal.length > 0) {
      dlog('  [SELECIONADOS NORMAIS]: ' + 
           listaNormal.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team; }).join(', '));
    }
    if (listaEspecial.length > 0) {
      dlog('  [SELECIONADO ESPECIAL]: ' + 
           listaEspecial.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team; }).join(', '));
    }
    if (listaPremium.length > 0) {
      dlog('  [SELECIONADO PREMIUM]: ' + 
           listaPremium.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team; }).join(', '));
    }
    if (listaHoraMarcada.length > 0) {
      dlog('  [SELECIONADO HORA MARCADA]: ' + 
           listaHoraMarcada.map(function(c){ return formatDatePt(c.date) + ' | ' + c.team; }).join(', '));
    }
    
    if (listaNormal.length < 5) dlog('[AVISO] Menos de 5 fretes normais encontrados');
    if (listaEspecial.length < 1) dlog('[AVISO] Nenhum frete especial encontrado');
    if (listaPremium.length < 1) dlog('[AVISO] Nenhum frete premium encontrado');
    if (listaHoraMarcada.length < 1) dlog('[AVISO] Nenhum frete hora marcada encontrado');
    
    if (!lista.length){
      // nenhum — mantenho comportamento
    }

    /* 12 – Preparação dos resultados */
    // === SESSÃO: FORMATAÇÃO DOS RESULTADOS PARA EXIBIÇÃO ===
    // _fmtMoneyBR movido para escopo global (topo do arquivo)
    function _weekdayPtBr(d){ const nomes=['domingo','segunda','terça','quarta','quinta','sexta','sábado']; return nomes[d.getDay()].replace(/^./, c=>c.toUpperCase()); }
    function _labelFromDisplayText(s){
      const a3 = String(s||'').trim(); if (!a3) return '';
      const parts = a3.split(',').map(x=>x.trim());
      const bairro = (parts[1]||'').trim();
      const cidadeUf = (parts[2]||'').trim();
      const cidade = cidadeUf.split(' - ')[0].trim();
      if (!cidade) return bairro || a3;
      return (cidade.toLowerCase()==='curitiba') ? (bairro || cidade) : cidade;
    }

    var rankCounter = 1;
    const hoje = new Date(); hoje.setHours(0,0,0,0);

    const linhas = lista.map((v)=>{
      // Identificar tipo do frete
      const isEspecial = listaEspecial.indexOf(v) !== -1;
      const isPremium = listaPremium.indexOf(v) !== -1;
      const isHoraMarcada = listaHoraMarcada.indexOf(v) !== -1;
      const isNormal = !isEspecial && !isPremium && !isHoraMarcada;
      
      const diasAte = Math.ceil((v.date - hoje) / 86400000);

      let freteNum = calcularFrete(
        distKm,
        v.date.getDay() === 6,
        isRural,
        !!form.isCondominio,
        freightParams
      );
      
      // === APLICAR VALORES ADICIONAIS CONFORME TIPO ===
      var tipoLabel = '';
      var avisoExtra = '';
      
      if (isEspecial) {
        freteNum = (Number(freteNum)||0) + VALOR_ADICIONAL_ESPECIAL;
        tipoLabel = 'especial';
      } else if (isPremium) {
        freteNum = (Number(freteNum)||0) + VALOR_ADICIONAL_PREMIUM;
        tipoLabel = 'premium';
      } else if (isHoraMarcada) {
        freteNum = (Number(freteNum)||0) + HORA_MARCADA_VALOR_ADICIONAL;
        tipoLabel = 'hora-marcada';
        avisoExtra = 'limite de horário de entrega até as 16h';
      } else {
        tipoLabel = 'normal';
      }

      const o = {
        rank: rankCounter++,
        dateISO: v.date.toISOString(),
        dateDM: Utilities.formatDate(v.date,'GMT-3','dd/MM'),
        weekday: _weekdayPtBr(v.date),
        daysLeftTxt: `${diasAte} d`,
        encomenda: (tipoBerco==='NIDO'?diasAte>90:diasAte>60) ? 'Sim' : 'Não',
        frete: _fmtMoneyBR(freteNum),
        team: v.team,
        tipo: tipoLabel,
        isExtra: isEspecial || isPremium || isHoraMarcada, // para compatibilidade
        avisoHoraMarcada: avisoExtra
      };
      
      if (isEspecial) dlog('[RESULTADO ESPECIAL] ' + o.dateDM + ' | ' + o.team + ' | frete=' + o.frete);
      if (isPremium) dlog('[RESULTADO PREMIUM] ' + o.dateDM + ' | ' + o.team + ' | frete=' + o.frete);
      if (isHoraMarcada) dlog('[RESULTADO HORA MARCADA] ' + o.dateDM + ' | ' + o.team + ' | frete=' + o.frete);
      
      return o;
    });

    /* 13 – Auditoria (sempre) */
    var freteSemana = calcularFrete(distKm, false, isRural, !!form.isCondominio, freightParams);
    var freteSabado = calcularFrete(distKm, true,  isRural, !!form.isCondominio, freightParams);
    var freteStr    = 'semana: ' + freteSemana + ' / sábado: ' + freteSabado;
    function pick(oldBool, newVal){
      if (typeof newVal === 'string' && newVal.trim()) return newVal.trim();
      if (typeof oldBool === 'boolean') return oldBool ? 'SIM' : 'NÃO';
      return '-';
    }
    // Format month/year from YYYY-MM to MM/YYYY for display
    var mesPesquisaFormatted = '-';
    if (form.mesPesquisa) {
      var mesParts = String(form.mesPesquisa).split('-');
      if (mesParts.length === 2) {
        mesPesquisaFormatted = mesParts[1] + '/' + mesParts[0]; // MM/YYYY
      }
    }
    
    var paramsA = [
      'ÁREA RURAL?: ' + (isRural ? 'Sim' : 'Não'),
      'É CONDOMÍNIO?: ' + (form.isCondominio ? 'Sim' : 'Não'),
      'PROCURAR A PARTIR DE: ' + mesPesquisaFormatted,
      'BERÇO/CAMA: ' + (tipoBerco || '-'),
      'CÔMODA: '   + pick(form.temComoda,   form.comoda),
      'ROUPEIRO: ' + pick(form.temRoupeiro, form.roupeiro),
      'POLTRONA: ' + pick(form.temPoltrona, form.poltrona),
      'PAINEL: '   + pick(form.temPainel,   form.painel),
      'TEMPO NECESSÁRIO: ' + String(form.tempoNecessario || '')
    ].join('\n');

    // Monta o resumo dos resultados para auditoria
    var resultsSummary = "Resultados:\n" + linhas.map(function(r) {
      var tipoTexto = '';
      if (r.tipo === 'especial') tipoTexto = ' | Frete especial';
      else if (r.tipo === 'premium') tipoTexto = ' | Frete premium';
      else if (r.tipo === 'hora-marcada') tipoTexto = ' | Frete hora marcada';
      else tipoTexto = ' | Frete Normal';
      
      return "- " + r.dateDM + " | " + r.team + " | " + r.frete + tipoTexto;
    }).join("\n");

    logAuditRow(Session.getActiveUser().getEmail(), cepFmt, paramsA, String(form.tempoNecessario || ''), freteStr, '', '', resultsSummary);

    /* 14 – Saída: escrever na planilha OU retornar payload pro modal */
    if (!returnOnly) {
      shOut.getRange('A5:J').clearContent();
      shOut.getRange(4,1,1,9).setValues([[
        'RANKING','ENCOMENDA?','DATA ENTREGA','DIAS PARA ENTREGA',
        'ENTREGA MAIS PRÓXIMA','AUMENTO DE ROTA (m)',
        'QUAL EQUIPE','TEMPO DISPONIVEL EQUIPE NESSE DIA',
        'PREÇO A COBRAR DA ENTREGA'
      ]]);
      if (linhas.length) {
        const rowsSheet = linhas.map((o)=>[
          o.rank, o.encomenda, `${o.dateDM} (${o.weekday})`,
          parseInt(o.daysLeftTxt), '—', 0, o.team, '—', o.frete
        ]);
        shOut.getRange(5,1,rowsSheet.length,9).setValues(rowsSheet);
      }
      try { markSimulationRun(); } catch(e) {}
      return 'OK';
    } else {
      const a3TextUsed = (typeof a3Text!=='undefined' ? a3Text : '');

      // ✅ Construir endereço completo com bairro
      // Prioridade:
      // 1. Endereço confirmado no modal (form.destDisplay)
      // 2. Endereço completo do geocoding (nomi.enderecoCompleto)
      // 3. A3 calculado (a3TextUsed)
      // 4. display_name do provider
      // 5. Montar do objeto address
      // 6. Fallback CEP
      var addressFinal = '';
      if (form && form.destDisplay) {
        addressFinal = String(form.destDisplay).trim();
      } else if (nomi && nomi.enderecoCompleto) {
        // ✅ PRIORIZAR enderecoCompleto que vem do cache/geocoding
        addressFinal = String(nomi.enderecoCompleto).trim();
      } else if (a3TextUsed) {
        addressFinal = String(a3TextUsed).trim();
      } else if (nomi && nomi.display_name) {
        addressFinal = String(nomi.display_name).trim();
      } else if (nomi && nomi.address) {
        // Montar endereço a partir do objeto address
        var a = nomi.address;
        addressFinal = [
          a.road || a.residential || a.pedestrian || '',
          a.house_number || '',
          a.suburb || a.neighbourhood || '',
          (a.city || a.town || a.village || ''),
          (a.state || '')
        ].filter(Boolean).join(', ');
      }
      
      // Se ainda estiver vazio, usar CEP
      if (!addressFinal) {
        addressFinal = cepFmt ? ('CEP ' + cepFmt) : '';
      }
      
      dlog('[ADDRESS-FINAL] Selecionado: "' + addressFinal + '"');

      var addressShort = '';
      try { addressShort = MontarEnderecoCurto_(form); } catch(_e) { addressShort = ''; }

      // calcula "A partir de"
      const startPick    = _resolveStartFrom_(form, null);
      const startFromISO = startPick ? startPick.startFrom.toISOString() : '';
      const startFromDM  = startPick ? Utilities.formatDate(startPick.startFrom,'GMT-3','dd/MM/yyyy') : '';

      // ✅ Calcular tempo final se não parou antes (processou tudo)
      if (searchElapsedSeconds === 0) {
        searchElapsedSeconds = ((Date.now() - searchStartTime) / 1000).toFixed(1);
      }

      var searchFinishedAtIso = new Date().toISOString();
      var totalDurationMs = Date.now() - searchStartTime;

      RegistrarExecucaoPesquisaAudit_({
        client_token: clientToken || null,
        origin: returnOnly ? 'MODAL' : 'PLANILHA',
        user_email: Session.getActiveUser().getEmail() || null,
        cep: cepFmt || null,
        endereco_pesquisado: addressFinal || null,
        endereco_curto: addressShort || null,
        tempo_necessario: String(form.tempoNecessario || '') || null,
        is_rural: !!isRural,
        is_condominio: !!form.isCondominio,
        total_duration_ms: totalDurationMs,
        search_time_seconds: Number(searchElapsedSeconds || 0),
        total_candidates: linhas.length,
        total_candidates_normal: listaNormal.length,
        total_candidates_especial: listaEspecial.length,
        total_candidates_premium: listaPremium.length,
        total_candidates_hora_marcada: listaHoraMarcada.length,
        total_slots_processed: processedSlotsCount,
        total_slots_available: slotsParaProcessar.length,
        early_stop: !!earlyStop,
        status: 'success',
        error_message: null,
        started_at: searchStartedAtIso,
        finished_at: searchFinishedAtIso
      });

      const payload = {
        ok: true,
        cep: cepFmt,
        tempo: String(form.tempoNecessario || ''),
        label: _labelFromDisplayText(a3TextUsed),
        address: addressFinal,
        addressShort: addressShort,
        startFromISO: startFromISO,
        startFromDM:  startFromDM,
        isRural: !!isRural,
        isCondominio: !!form.isCondominio,
        params: paramsA,
        candidates: linhas,
        searchTime: searchElapsedSeconds // ✅ Tempo de busca em segundos
      }

      try { markSimulationRun(); } catch(e) {} // cache do payload feito (30 min)
      try { _cache.put(payloadKey, JSON.stringify(payload), 30*60); } catch(e){}
      
      // ✅ PROGRESSIVE: Marcar como concluído
      var ctx = { freightParams: freightParams, isRural: isRural, isCondominio: !!form.isCondominio };
      saveProgress_(clientToken, payload.normais || [], payload.extras || [], 'done', ctx);
      
      return payload;
    }

  } catch (e) {
    // <-- FECHAMENTO do try externo (faltava)
    try {
      RegistrarExecucaoPesquisaAudit_({
        client_token: clientToken || null,
        origin: returnOnly ? 'MODAL' : 'PLANILHA',
        user_email: Session.getActiveUser().getEmail() || null,
        cep: String(form.cep || '').trim() || null,
        endereco_pesquisado: String(form.destDisplay || form.enderecoCompleto || form.logradouro || '').trim() || null,
        endereco_curto: null,
        tempo_necessario: String(form.tempoNecessario || '') || null,
        is_rural: !!form.isRural,
        is_condominio: !!form.isCondominio,
        total_duration_ms: Date.now() - searchStartTime,
        search_time_seconds: Number(((Date.now() - searchStartTime) / 1000).toFixed(1)),
        total_candidates: 0,
        total_candidates_normal: 0,
        total_candidates_especial: 0,
        total_candidates_premium: 0,
        total_candidates_hora_marcada: 0,
        total_slots_processed: processedSlotsCount,
        total_slots_available: 0,
        early_stop: false,
        status: 'error',
        error_message: (e && e.message) ? String(e.message).substring(0, 500) : String(e || 'Erro desconhecido').substring(0, 500),
        started_at: searchStartedAtIso,
        finished_at: new Date().toISOString()
      });
    } catch(_auditError) {}
    Logger.log('❌ pesquisarRotaToTargetWithParams falhou: ' + (e && e.stack ? e.stack : e));
    return 'ERR_EXCEPTION';
  }
}

// ==== Helpers de mês selecionado (flexíveis com vários formatos) ====
function _parseMonthInput_(s){
  // aceita '2025-10', '10/2025', 'outubro/2025', 'out/2025'
  if (!s) return null;
  s = String(s).trim().toLowerCase();

  // normaliza nomes PT -> número
  const meses = {
    'jan':1,'janeiro':1,'fev':2,'fevereiro':2,'mar':3,'março':3,'marco':3,
    'abr':4,'abril':4,'mai':5,'maio':5,'jun':6,'junho':6,'jul':7,'julho':7,
    'ago':8,'agosto':8,'set':9,'setembro':9,'out':10,'outubro':10,'nov':11,'novembro':11,'dez':12,'dezembro':12
  };

  let y=null, m=null;

  // 2025-10
  let m1 = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m1){ y=+m1[1]; m=+m1[2]; }

  // 10/2025
  if (!y){
    let m2 = s.match(/^(\d{1,2})[-/](\d{4})$/);
    if (m2){ m=+m2[1]; y=+m2[2]; }
  }

  // outubro/2025 ou out/2025
  if (!y){
    let m3 = s.match(/^([a-zçãéôû]+)[-/](\d{4})$/i);
    if (m3){
      const mm = meses[(m3[1]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')];
      if (mm){ m=mm; y=+m3[2]; }
    }
  }

  if (!y || !m || m<1 || m>12) return null;
  const start = new Date(y, m-1, 1); start.setHours(0,0,0,0);
  const end   = new Date(y, m, 1);   end.setHours(0,0,0,0); // exclusivo
  return {year:y, month:m, start, end};
}

// tenta obter o mês do FRONT (form) ou da planilha de CEP (algumas células comuns)
function _resolveSelectedMonth_(form, shCep){
  // prioriza parâmetros do modal/front
  const byForm = form && (form.monthYear || form.mesAno || form.mesSelecionado || form.mesPesquisa || form.mes || form.ano);
  if (byForm){
    if (form.monthYear || form.mesAno || form.mesSelecionado || form.mesPesquisa){
      const p = _parseMonthInput_(form.monthYear || form.mesAno || form.mesSelecionado || form.mesPesquisa);
      if (p) return p;
    }
    if (form.mes && form.ano){
      const mm = ('0'+String(form.mes)).slice(-2);
      const p = _parseMonthInput_(`${form.ano}-${mm}`);
      if (p) return p;
    }
  }

  // fallback: tentar algumas células do sheet CEP (B2 ou J2) nos formatos 2025-10 / 10/2025 / out/2025
  try{
    if (shCep){
      const poss = ['B2','J2'];
      for (var i=0;i<poss.length;i++){
        const val = String(shCep.getRange(poss[i]).getDisplayValue()||'').trim();
        const p = _parseMonthInput_(val);
        if (p) return p;
      }
    }
  }catch(e){}

  return null; // sem filtro de mês ⇒ uso antigo (LOOK_DAYS)
}

// ==== NOVO: resolve data inicial ("start from") a partir do mês escolhido ====
// Usa form.monthYear / mesPesquisa (YYYY-MM, 10/2025, "outubro/2025", etc.)
// Regra: se for o mês atual => start = hoje + 2 dias; senão => 1º dia do mês escolhido.
function _resolveStartFrom_(form, shCep){
  // Reaproveita o parser já existente:
  const p = _resolveSelectedMonth_(form, shCep); // retorna {year, month, start, end} ou null
  if (!p) return null;

  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
  const hoje = new Date(); hoje.setHours(0,0,0,0);

  // “Hoje + 2” (mantendo hora 00:00)
  function addDays(d, n){
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    x.setHours(0,0,0,0);
    return x;
  }

  const curY = hoje.getFullYear();
  const curM = hoje.getMonth() + 1;

  let startFrom = new Date(p.year, p.month - 1, 1); // 1º dia do mês escolhido
  startFrom.setHours(0,0,0,0);

  if (p.year === curY && p.month === curM) {
    const hojeMais2 = addDays(hoje, 2);
    if (hojeMais2 > startFrom) startFrom = hojeMais2; // respeita “hoje + 2”
  }

  return { startFrom: startFrom }; // não devolvemos "end" de propósito (sem limite de mês)
}

// ==== NOVO: resolve data inicial a partir de dataInicial (YYYY-MM-DD) ====
// Prioriza form.dataInicial sobre form.monthYear
// Validação: D+2 a D+90
function _resolveStartFromDate_(form) {
  // PRIORIDADE 1: dataInicial (data específica YYYY-MM-DD)
  if (form && form.dataInicial) {
    try {
      var dataStr = String(form.dataInicial).trim();
      var dataObj = new Date(dataStr + 'T00:00:00');
      
      // Validar se é data válida
      if (isNaN(dataObj.getTime())) {
        dlog('[DATE] dataInicial inválida: ' + dataStr);
        return _resolveStartFrom_(form, null); // fallback
      }
      
      dataObj.setHours(0, 0, 0, 0);
      dlog('[DATE] Usando dataInicial: ' + dataStr + ' (' + dataObj.toISOString() + ')');
      return { startFrom: dataObj };
    } catch(e) {
      dlog('[DATE] Erro ao processar dataInicial: ' + e);
      return _resolveStartFrom_(form, null); // fallback
    }
  }
  
  // PRIORIDADE 2: monthYear (fallback para comportamento antigo)
  return _resolveStartFrom_(form, null);
}


/**
 * Lê, no BACKEND, as opções de validação dos campos D2..H2 da planilha do CEP
 * e retorna para o front como arrays de strings.
 * - D2: tipoBerco
 * - E2: comoda
 * - F2: roupeiro
 * - G2: poltrona
 * - H2: painel
 */
function getFrontOptionLists() {
  // Cache leve para evitar múltiplas leituras por segundo
  var cache = CacheService.getScriptCache();
  var ver   = getDataVersion_(); // invalida quando a versão de dados muda
  var ckey  = 'frontOpts:v='+ver;
  try {
    var hit = cache.get(ckey);
    if (hit) return JSON.parse(hit);
  } catch(_){ }

  function uniq(arr){
    const s = new Set();
    const out = [];
    (arr||[]).forEach(v=>{
      const t = String(v||'').trim();
      if (t && !s.has(t)) { s.add(t); out.push(t); }
    });
    return out;
  }

  // Abre o backend e localiza a aba de CEP (onde ficam D2..H2)
  var ssSrc = abrirPlanilhaFonte_();

  var cfgSheet = ssSrc.getSheets().find(function(s){ return s.getSheetId() === 718532388; })
               || ssSrc.getSheetByName('cep_config')
               || ssSrc.getSheetByName('CONTROLES E CONFIGURAÇÕES (PROCURAR CEP)')
               || ssSrc.getSheets().find(function(s){ return String(s.getName()||'').toLowerCase().indexOf('config') >= 0; });
  if (!cfgSheet) throw new Error('Config sheet não encontrada no backend (id 718532388 ou nome com "config").');

  var CEP_SHEET = getConfig('PLANILHA DO CEP', cfgSheet);
  var shCep = ssSrc.getSheetByName(CEP_SHEET);
  if (!shCep) throw new Error('Aba de CEP não encontrada no backend: ' + CEP_SHEET);

  var DV = SpreadsheetApp.DataValidationCriteria;

  function readOptionsFromCell(a1){
    var rng = shCep.getRange(a1);
    var dv  = rng.getDataValidation();
    if (!dv) return null;

    var type = dv.getCriteriaType();
    var vals = dv.getCriteriaValues();

    // Lista direta (itens digitados)
    if (type === DV.VALUE_IN_LIST) {
      return uniq((vals[0] || []).map(String));
    }

    // Lista a partir de intervalo
    if (type === DV.VALUE_IN_RANGE) {
      var rngList = vals[0];
      if (rngList && rngList.getNumRows && rngList.getNumColumns) {
        var data = rngList.getDisplayValues();
        var flat = [].concat.apply([], data);
        return uniq(flat);
      }
    }

    return null;
  }

  var out = {
    tipoBerco:  readOptionsFromCell('D2') || ['CONVENCIONAL','NIDO'],
    comoda:     readOptionsFromCell('E2') || ['NÃO','SIM'],
    roupeiro:   readOptionsFromCell('F2') || ['NÃO','SIM'],
    poltrona:   readOptionsFromCell('G2') || ['NÃO','SIM'],
    painel:     readOptionsFromCell('H2') || ['NÃO','SIM']
  };

  // guarda no cache por 5 minutos para reduzir chamadas repetidas
  // (invalidado automaticamente por DATA_VERSION)
  try { cache.put(ckey, JSON.stringify(out), 300); } catch(_){ }

  return out;
}


/** 
 * Lê a planilha "TEMPO SERVIÇOS" e retorna o tempo "HH:MM" compatível
 * com as opções escolhidas no front (igual ao filtro da sua fórmula).
 * Se nada selecionado (tudo "NÃO" ou vazio), retorna "<--- PREENCHA".
 * Se form.isCondominio === true, soma +10 minutos ao tempo encontrado.
 */

/* ---------------- helpers ---------------- */
function _tempoNorm_(s){
  s = String(s||'').trim().toUpperCase();
  return (s==='NÃO' || s==='NAO') ? '' : s;
}

function tempoKey_(a,b,c,d,e){
  function nz(v){ return _tempoNorm_(v); }
  return [nz(a),nz(b),nz(c),nz(d),nz(e)].join('|');
}

function _addMinHHMM_(hhmm, add){
  var m = String(hhmm||'').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(hhmm||'');
  var total = (+m[1])*60 + (+m[2]) + (+add||0);
  if (total < 0) total = 0;
  var h = Math.floor(total/60), mm = String(total%60).padStart(2,'0');
  return h + ':' + mm;
}

function _tempoVersion_(){
  // usa a versão gravada pelo gerador da aba (recomendada)
  var ver = PropertiesService.getScriptProperties().getProperty('TEMPO_SERVICOS_VERSION');
  if (ver) return ver;
  // fallback simples: muda se o tamanho da aba mudar
  try{
    var ss = abrirPlanilhaFonte_();
    var sh = ss.getSheetByName('TEMPO SERVIÇOS'); if (!sh) return 'nosheet';
    return 'r'+sh.getLastRow()+'c'+sh.getLastColumn();
  }catch(e){ return 'unknown'; }
}

/** aceita "HH:MM", Date (excel/1899) ou minutos numéricos → devolve "HH:MM" */
function _fmtHHMMFromAny_(v){
  if (typeof v === 'string') {
    var m = v.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return m[1].padStart(2,'0') + ':' + m[2];
  }
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    var h = v.getUTCHours(), m2 = v.getUTCMinutes();
    return String(h).padStart(2,'0') + ':' + String(m2).padStart(2,'0');
  }
  var n = Number(v);
  if (!isNaN(n) && n >= 0) {
    var h2 = Math.floor(n/60), m3 = n % 60;
    return String(h2).padStart(2,'0') + ':' + String(m3).padStart(2,'0');
  }
  return '';
}

/* ------------- cache shardado (rápido e leve) ------------- */
/* ----------- lookup super-rápido + cache shard versionado por DATA_VERSION ----------- */
function _loadTempoMap_(){
  var cache = CacheService.getScriptCache();

  // (A) versão principal de invalidação: DATA_VERSION
  var verDV = getDataVersion_(); // "epoch|YYYY-MM-DD HH:mm:ss"

  // (B) compatibilidade opcional com property antiga (se existir)
  var verTS = PropertiesService.getScriptProperties().getProperty('TEMPO_SERVICOS_VERSION') || '';
  var ver = verTS ? (verDV + '|' + verTS) : verDV;

  var idxKey = 'tempo:v'+ver+':index';
  var idxRaw = cache.get(idxKey);

  // (C) se índice existir, remonta dos shards
  if (idxRaw){
    try{
      var idx = JSON.parse(idxRaw); // {chunks:n}
      var all = {};
      for (var i=0;i<idx.chunks;i++){
        var part = cache.get('tempo:v'+ver+':chunk:'+i);
        if (!part) continue;
        var obj = JSON.parse(part);
        Object.assign(all, obj);
      }
      return all;
    }catch(e){
      // índice inválido → cai para reconstrução
    }
  }

  // (D) reconstrução a partir da planilha
  var ss = abrirPlanilhaFonte_();
  var sh = ss.getSheetByName('TEMPO SERVIÇOS');
  if (!sh) return {};

  var last = sh.getLastRow();
  if (last < 2) return {};

  var data = sh.getRange(2,1,last-1,8).getDisplayValues(); // A..H (chave nos A..E, tempo em H)
  var map = {}; // k -> "HH:MM"

  for (var i=0;i<data.length;i++){
    var row = data[i];
    var k = tempoKey_(row[0], row[1], row[2], row[3], row[4]);
    if (!k.replace(/\|/g,'')) continue;

    var tempoFmt = _fmtHHMMFromAny_(row[7]);
    if (tempoFmt) map[k] = tempoFmt;
  }

  // (E) shard para fugir do limite de tamanho do CacheService
  var entries = Object.entries(map);
  var chunkSize = 500; // ajuste fino se necessário
  var chunks = Math.ceil(entries.length / chunkSize);
  for (var c=0; c<chunks; c++){
    var slice = entries.slice(c*chunkSize, (c+1)*chunkSize);
    var obj = {};
    for (var j=0;j<slice.length;j++){
      obj[slice[j][0]] = slice[j][1];
    }
    cache.put('tempo:v'+ver+':chunk:'+c, JSON.stringify(obj), 6*3600);
  }
  cache.put(idxKey, JSON.stringify({chunks: chunks}), 6*3600);
  return map;
}

function getTempoNecessario(form){
  form = form || {};
  var isCondominio = !!form.isCondominio;

  var k = tempoKey_(form.tipoBerco, form.comoda, form.roupeiro, form.poltrona, form.painel);
  if (!k.replace(/\|/g,'')) return '<--- PREENCHA';

  var tempo = null;

  // 1) cache shard (rápido)
  try{
    var M = _loadTempoMap_();
    tempo = M[k] || null;
  }catch(e){ /* ignora e tenta fallback */ }

  // 2) fallback (varredura direta) — só dispara se cache estiver frio
  if (!tempo){
    try{
      var ss = abrirPlanilhaFonte_();
      var sh = ss.getSheetByName('TEMPO SERVIÇOS');
      if (sh){
        var last = sh.getLastRow();
        if (last>=2){
          var data = sh.getRange(2,1,last-1,8).getDisplayValues();
          for (var i=0;i<data.length;i++){
            if (tempoKey_(data[i][0],data[i][1],data[i][2],data[i][3],data[i][4]) === k){
              tempo = _fmtHHMMFromAny_(data[i][7]);
              break;
            }
          }
        }
      }
    }catch(e){}
  }

  if (!tempo) return '';
  return isCondominio ? _addMinHHMM_(tempo, 10) : tempo;
}


// Exposto ao front: devolve o mapa completo key -> "HH:MM"
function getTempoMap(){
  return _loadTempoMap_(); // usa o cache shardado já implementado
}


/** Abre o modal de resultados usando o payload retornado pela pesquisa */
function showAgendaModalFromRows(payload){
  if (!payload || !payload.ok) {
    SpreadsheetApp.getUi().alert('Nenhum resultado para exibir.');
    return;
  }
  const html = HtmlService
    .createHtmlOutput(generateAgendaModalHtmlFromRows_(payload))
    .setWidth(1500)
    .setHeight(920);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/** Gera o HTML do modal a partir de payload.candidates (sem tocar na planilha) */
function generateAgendaModalHtmlFromRows_(payload){
  const hasLogo = (typeof PRE_LOGO_URL!=='undefined' && PRE_LOGO_URL);
  const safe = s => String(s||'').replace(/</g,'&lt;');

  const rows = payload.candidates || [];

  let html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
:root{ --brand:#10A5E4; --brandDark:#0E8EC4; --bg:#f6f9fc; --card:#fff;
       --text:#1f2937; --muted:#6b7280; --border:#e5e7eb; --hi:#fff9d6; }
*{box-sizing:border-box}
html,body{height:100%;margin:0;padding:0;background:var(--bg);
  font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--text)}
.viewport{position:absolute; inset:16px; display:flex; flex-direction:column;}
.inner{width:90%; height:100%; margin:0 auto; display:flex; flex-direction:column; gap:12px; min-height:0;}
.hero{background:linear-gradient(135deg,var(--brand),var(--brandDark));
  color:#fff; padding:14px; display:flex; align-items:center; gap:12px; border-radius:14px;}
.hero__logo{max-width:220px; max-height:56px; object-fit:contain}
.hero__title{margin:0; font-size:20px; font-weight:800}
.hero__subtitle{margin:2px 0 0; font-size:12px; opacity:.95}
.hero__right{margin-left:auto}
.btn-close{background:rgba(255,255,255,.18); color:#fff; border:1px solid rgba(255,255,255,.35);
  padding:6px 10px; border-radius:10px; cursor:pointer; font-size:12px;}
.content{flex:1 1 auto; min-height:0; display:flex; flex-direction:column; gap:10px;}
.hint{color:var(--muted); font-size:12px; margin:0 2px;}
.table-wrap{flex:1 1 auto; min-height:0; overflow:auto; background:#fff;
  border:1px solid var(--border); border-radius:12px; padding:0;}
.table{min-width:100%; display:grid; row-gap:0;
  grid-template-columns:
    minmax(80px,.9fr)
    minmax(120px,1.2fr)
    minmax(110px,1fr)
    minmax(80px,.7fr)
    minmax(95px,.8fr)
    minmax(130px,1.1fr)
    minmax(100px,.9fr)
    minmax(130px,1fr);
}
.thead,.row{display:contents;}
.th,.td{padding:10px 10px; font-size:13px; display:flex; align-items:center; justify-content:center; text-align:center;}
.th{position:sticky; top:0; z-index:1; background:#f3f7fb; color:var(--muted); font-weight:700; border-bottom:1px solid var(--border);}
.td{border-bottom:1px dashed #eef2f6;}
.td strong{font-weight:700;}
.mono{font-variant-numeric: tabular-nums;}
.row.clickable .td{cursor:pointer;}
.row.clickable:hover .td{background:#f9fbff;}
.row.encomenda-sim .td{ background:var(--hi); }
.btn{border:1px solid var(--brand); background:#e8f6fe; color:#0f6fa1;
  padding:6px 10px; border-radius:10px; font-size:12px; cursor:pointer;}
.btn:hover{filter:brightness(0.98);}
.empty{color:var(--muted); font-style:italic; border:1px dashed var(--border);
  background:#fff; border-radius:10px; padding:12px; text-align:center; margin-top:8px;}
.footer{font-size:11px; color:var(--muted); text-align:center; margin-top:4px;}

/* Lock de clique durante o pré-agendamento */
body.busy .table-wrap{pointer-events:none; opacity:.55;}
.busy-banner{
  position:fixed; left:50%; top:14px; transform:translateX(-50%);
  background:#111; color:#fff; padding:8px 12px; border-radius:10px;
  font-size:12px; z-index:9999; box-shadow:0 2px 10px rgba(0,0,0,.15); display:none;
}
body.busy .busy-banner{display:flex;}

/* === RESUMO DA PESQUISA (linha única) === */
.summary{
  background:#fff; border:1px solid var(--border); border-radius:10px;
  padding:8px 10px; font-size:12px; color:#374151; margin-top:8px;
}
.summary strong{font-weight:700}
.summary .sep{opacity:.5; margin:0 8px}
@media (max-width: 900px){
  .summary{font-size:11px}
  .summary .hide-sm{display:none}
}

/* === NOVO: destaque para tipos de frete + legenda === */
.row.extra-special .td{ background:#f5ecff; } /* lilás claro - especial */
.row.extra-premium .td{ background:#fffbeb; } /* dourado claro - premium */
.row.extra-hora-marcada .td{ background:#fff4e6; } /* laranja claro - hora marcada */

.badge-extra{
  display:inline-block; font-size:11px; padding:2px 6px; border-radius:8px;
  border:1px solid #8b5cf6; color:#6d28d9; background:#f5ecff; margin-left:6px;
}
.badge-premium{
  display:inline-block; font-size:11px; padding:2px 6px; border-radius:8px;
  border:1px solid #d97706; color:#92400e; background:#fffbeb; margin-left:6px;
}
.badge-hora-marcada{
  display:inline-block; font-size:11px; padding:2px 6px; border-radius:8px;
  border:1px solid #ea580c; color:#9a3412; background:#fff4e6; margin-left:6px;
}

.legend{font-size:12px; color:#6b7280; margin:4px 2px 0}
.legend .dot{display:inline-block; width:10px; height:10px; border-radius:50%; margin:0 6px 0 10px; vertical-align:middle;}
.legend .dot.extra{background:#f5ecff; border:1px solid #8b5cf6;}
.legend .dot.premium{background:#fffbeb; border:1px solid #d97706;}
.legend .dot.hora-marcada{background:#fff4e6; border:1px solid #ea580c;}
.legend .dot.encomenda{background:#fff9d6; border:1px solid #d1b906;}
</style>
</head>
<body>
  <div class="busy-banner">Criando pré-agendamento…</div>
  <div class="viewport">
    <div class="inner">
      <div class="hero">
        ${hasLogo ? `<img class="hero__logo" src="${safe(PRE_LOGO_URL)}" alt="Le Bébé">` : ''}
        <div>
          <h2 class="hero__title">PRÉ-AGENDAMENTO</h2>
          <p class="hero__subtitle">Escolha uma linha para criar o evento</p>
        </div>
        <div class="hero__right"><button class="btn-close" onclick="google.script.host.close()">Fechar</button></div>
      </div>

      <!-- RESUMO: linha única logo abaixo do cabeçalho -->
      <div class="summary" aria-label="Resumo dos dados pesquisados">
        <strong>Dados pesquisados:</strong>
        <span class="sep"> </span> <strong>Endereço:</strong> ${safe(payload.addressShort || payload.address || payload.label || '')}
        <span class="sep">|</span> <strong>A partir de:</strong> ${safe(payload.startFromDM || '')}
        <span class="sep">|</span> <strong>Área rural:</strong> ${payload.isRural ? 'Sim' : 'Não'}
        <span class="sep">|</span> <strong>Condomínio:</strong> ${payload.isCondominio ? 'Sim' : 'Não'}
        <span class="sep">|</span> <strong>Tempo necessário:</strong> ${safe(payload.tempo || '')}
        <span class="sep">|</span> <strong>⏱️ Tempo de carregamento:</strong> ${payload.searchTime || '0'}s
      </div>

      <div class="content">
        <div class="legend" role="note" aria-label="Legenda">
          <span class="dot extra"></span> Frete especial
          <span class="dot premium"></span> Frete premium
          <span class="dot hora-marcada"></span> Frete hora marcada
          <span class="dot encomenda"></span> Encomenda
        </div>

        <div class="table-wrap">
          <div class="table">
            <div class="thead">
              <div class="th">Dia/Mês</div>
              <div class="th">Dia da semana</div>
              <div class="th">Faltam</div>
              <div class="th">Encomenda?</div>
              <div class="th">Valor Frete</div>
              <div class="th">Tipo de Frete</div>
              <div class="th">Equipe</div>
              <div class="th">Pré-agendar</div>
            </div>
`;

  if (!rows.length){
    html += `
          </div></div>
          <div class="empty">Nenhuma data disponível. Tente novamente.</div>`;
  } else {
    rows.forEach((o, idx)=>{
      const tipo = String(o.tipo || 'normal').toLowerCase();
      const isEspecial = tipo === 'especial';
      const isPremium = tipo === 'premium';
      const isHoraMarcada = tipo === 'hora-marcada';
      const isEncom = /^sim$/i.test(o.encomenda||'');
      
      // Determinar classe CSS
      let rowClass = 'row clickable';
      if (isEspecial) rowClass = 'row extra-special clickable';
      else if (isPremium) rowClass = 'row extra-premium clickable';
      else if (isHoraMarcada) rowClass = 'row extra-hora-marcada clickable';
      else if (isEncom) rowClass = 'row encomenda-sim clickable';
      
      // Determinar badge e texto para tipo de frete
      let tipoFreteHtml = '<span style="color:#6b7280;">normal</span>';
      if (isEspecial) tipoFreteHtml = '<span class="badge-extra">especial</span>';
      else if (isPremium) tipoFreteHtml = '<span class="badge-premium">premium</span>';
      else if (isHoraMarcada) tipoFreteHtml = '<span class="badge-hora-marcada">hora marcada</span>';
      
      html += `
            <div class="${rowClass}" data-idx="${idx}">
              <div class="td mono"><strong>${safe(o.dateDM)}</strong></div>
              <div class="td">${safe(o.weekday)}</div>
              <div class="td mono">${safe(o.daysLeftTxt)}</div>
              <div class="td">${safe(o.encomenda)}</div>
              <div class="td mono">${safe(o.frete)}</div>
              <div class="td">
                ${tipoFreteHtml}
              </div>
              <div class="td">
                ${safe(o.team)}
              </div>
              <div class="td">
                <button class="btn" data-idx="${idx}">Pré-agendar</button>
              </div>
            </div>`;
    });

    html += `
          </div>
        </div>`;
  }

  // Embute payload resumido para o JS
  const payloadJson = JSON.stringify({
    tempo: payload.tempo || '',
    label: payload.label || '',
    cep:   payload.cep   || '',
    params: payload.params || '',
    address: payload.address || '',
    startFromISO: payload.startFromISO || '',
    startFromDM:  payload.startFromDM  || '',
    isRural: !!payload.isRural,
    isCondominio: !!payload.isCondominio,
    candidates: rows.map(o=>({dateISO:o.dateISO, team:o.team, frete:o.frete, isExtra: !!o.isExtra}))
  });

  html += `
        <div class="footer">le ★ bébé</div>
      </div>
    </div>
  </div>

  <script>
    (function(){
      const PAY = ${payloadJson};
      let BUSY = false;
      function setBusy(on){
        BUSY = !!on;
        document.body.classList.toggle('busy', BUSY);
      }
      function pre(idx){
        if (BUSY) return;
        const o = (PAY.candidates||[])[idx];
        if(!o) return;
        setBusy(true);
        const cand = { dateISO:o.dateISO, team:o.team, frete:o.frete };
        const meta = { tempo:PAY.tempo, label:PAY.label, address:PAY.address, cep:PAY.cep, params:PAY.params };
        console.log('[PRE] meta enviado:', meta);


        google.script.run
          .withSuccessHandler(function(){
            // fecha ao concluir; o alerta do server (se houver) aparece depois
            google.script.host.close();
          })
          .withFailureHandler(function(err){
            setBusy(false);
            const msg = (err && err.message) ? err.message : String(err || 'Erro desconhecido.');
            alert('Não foi possível criar o pré-agendamento:\\n' + msg);
          })
          .DoPreAgendarDireto(cand, meta);
      }

      // Delegação de eventos (linha e botão)
      document.addEventListener('click', function(ev){
        const btn = ev.target.closest('button.btn[data-idx]');
        if (btn){ pre(parseInt(btn.getAttribute('data-idx'),10)); return; }
        const row = ev.target.closest('.row.clickable[data-idx]');
        if (row){
          if (ev.target.closest('button')) return;
          pre(parseInt(row.getAttribute('data-idx'),10));
        }
      }, {passive:true});
    })();
  </script>
</body></html>`;
  return html;
}

/**
 * Retorna:
 * - Se for Curitiba: BAIRRO
 * - Se for outra cidade: CIDADE
 * Nunca retorna CEP, número solto, UF ou país.
 */

// =========================================
// Sessão 1.0 – Helper: Normalizar Bairro/Cidade pro título
// =========================================
function normalizeBairro_(s) {
  let t = String(s || '').trim();
  Logger.log(`[normalizeBairro_] entrada: "${t}"`);

  // remove prefixos numéricos/CEP no começo (ex: "81630-000 - Hauer" / "4546-6530 - Hauer")
  t = t.replace(/^\s*(\d{4,5}-\d{3,4}|\d{5}-?\d{3}|[\d.\- ]+)\s*-\s*/i, '');
  Logger.log(`[normalizeBairro_] sem prefixo: "${t}"`);

  const partes = t.split(',').map(p => p.trim()).filter(Boolean);
  Logger.log(`[normalizeBairro_] partes: ${JSON.stringify(partes)}`);

  const ehCep_    = (x) => /^\d{5}-?\d{3}$/.test(x);
  const ehPais_   = (x) => /^(brasil|brazil|br)$/i.test(x);
  const ehSoNum_  = (x) => /^\d+$/.test(x);
  const ehUF_     = (x) => /^[A-Z]{2}$/.test(String(x||'').trim().toUpperCase());
  
  // ✅ NOVO: Reconhecer estados por extenso
  const ehEstadoPorExtenso_ = (x) => {
    const normalized = String(x||'').trim().toLowerCase();
    const estados = ['paraná', 'parana', 'são paulo', 'sao paulo', 'santa catarina', 'rio de janeiro',
                     'minas gerais', 'bahia', 'rio grande do sul', 'goiás', 'goias', 'espírito santo',
                     'espirito santo', 'pernambuco', 'ceará', 'ceara', 'distrito federal', 'pará', 'para',
                     'maranhão', 'maranhao', 'amazonas', 'mato grosso', 'mato grosso do sul', 'acre',
                     'rondonia', 'rondônia', 'roraima', 'amapá', 'amapa', 'tocantins', 'sergipe', 'alagoas',
                     'paraíba', 'paraiba', 'rio grande do norte', 'piauí', 'piaui'];
    return estados.indexOf(normalized) >= 0;
  };
  
  // ✅ NOVO: Reconhecer regiões administrativas (lixo de OSM)
  const ehRegiaoAdministrativa_ = (x) => {
    const normalized = String(x||'').trim().toLowerCase();
    return /região\s+(geográfica|metropolitana|sul|norte|centro|leste|oeste)/i.test(x) ||
           normalized.includes('imediata') || normalized.includes('intermediária');
  };

  const ehLugarRuim_ = (x) => ehCep_(x) || ehPais_(x) || ehSoNum_(x) || ehUF_(x) || ehRegiaoAdministrativa_(x);

  const pareceRua_ = (x) =>
    /^(rua|av\.?|avenida|travessa|rodovia|estrada|al\.?|alameda|praça|praca|loteamento)\b/i.test(x);

  // 1) achar índice da cidade:
  // ORDEM DE PRIORIDADE:
  // 1.1) "Cidade - UF" (ex: "Curitiba - PR")
  // 1.2) Cidades conhecidas diretamente (ex: "Curitiba")
  // 1.3) Cidade "solta" + UF/Estado em outro token (genérico)
  let idxCidade = -1;
  let cidade = '';
  let ufFound = '';
  
  const cidadesConhecidas = ['curitiba', 'são paulo', 'sao paulo', 'rio de janeiro', 
                             'brasília', 'brasilia', 'porto alegre', 'salvador', 
                             'fortaleza', 'belo horizonte', 'manaus', 'recife',
                             'campinas', 'guarulhos', 'são josé dos pinhais', 'colombo',
                             'pinhais', 'araucária', 'araucaria'];

  // 1.1) tenta "Cidade - UF"
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (ehLugarRuim_(p)) continue;

    const m = p.match(/^(.+?)\s*-\s*([A-Z]{2})$/); // ex: "Curitiba - PR"
    if (m) {
      cidade = m[1].trim();
      ufFound = (m[2] || '').trim().toUpperCase();
      idxCidade = i;
      break;
    }
  }
  
  // ✅ 1.2) PRIORIDADE ALTA: Cidades conhecidas (evita confundir bairro com cidade)
  if (idxCidade === -1) {
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      if (cidadesConhecidas.indexOf(p.toLowerCase()) >= 0) {
        cidade = p.trim();
        idxCidade = i;
        Logger.log(`[normalizeBairro_] ✅ Cidade identificada por lista conhecida: "${cidade}" em índice ${i}`);
        break;
      }
    }
  }

  // 1.3) fallback genérico: cidade "solta" + UF/Estado em outro token
  // CUIDADO: só usa se não achou antes (senão pode pegar bairro)
  if (idxCidade === -1) {
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      if (ehLugarRuim_(p)) continue;
      if (pareceRua_(p)) continue;

      // se tem UF ou Estado por extenso em outra parte, considera este como cidade
      for (let j = 0; j < partes.length; j++) {
        if (j === i) continue;
        const pj = partes[j];
        if (ehUF_(pj) || ehEstadoPorExtenso_(pj)) {
          cidade = p.trim();
          ufFound = ehUF_(pj) ? pj.trim().toUpperCase() : pj.trim();
          idxCidade = i;
          Logger.log(`[normalizeBairro_] ⚠️ Cidade identificada por fallback genérico: "${cidade}" em índice ${i}`);
          break;
        }
      }
      if (idxCidade !== -1) break;
    }
  }

  Logger.log(`[normalizeBairro_] idxCidade=${idxCidade} cidade="${cidade}" uf="${ufFound}"`);

  // 2) achar bairro: parte imediatamente anterior à cidade
  let bairro = '';
  if (idxCidade > 0) {
    let prev = partes[idxCidade - 1];

    // se prev tem " - ", pega o último pedaço (ex: "4546-6530 - Hauer")
    if (prev.includes(' - ')) {
      prev = prev.split(' - ').pop().trim();
    }

    // se ainda parece rua, volta mais uma parte
    if (pareceRua_(prev) && idxCidade > 1) {
      prev = partes[idxCidade - 2];
      if (prev.includes(' - ')) {
        prev = prev.split(' - ').pop().trim();
      }
    }

    // limpa lixo final
    if (!ehLugarRuim_(prev) && !pareceRua_(prev)) {
      bairro = prev.trim();
    }
  }
  
  // ✅ 2.1) NOVO: Se ainda não achou bairro e temos padrão "Rua, Bairro, Cidade"
  // Exemplo: ["Avenida X", "Prado Velho", "Curitiba", ...]
  if (!bairro && partes.length >= 3) {
    if (pareceRua_(partes[0]) && idxCidade === 2) {
      // partes[0] = rua, partes[1] = bairro, partes[2] = cidade
      const candidato = partes[1];
      if (!ehLugarRuim_(candidato) && !pareceRua_(candidato)) {
        bairro = candidato.trim();
        Logger.log(`[normalizeBairro_] ✅ Bairro identificado por padrão [Rua,Bairro,Cidade]: "${bairro}"`);
      }
    }
  }

  Logger.log(`[normalizeBairro_] bairro="${bairro}" (idxCidade=${idxCidade})`);

  // 3) regra final
  let out = '';
  if (cidade && cidade.toLowerCase() === 'curitiba') {
    out = bairro || 'CURITIBA';
  } else {
    out = cidade || bairro || 'SEM BAIRRO';
  }

  // garante que não devolve UF/pais/cep/número solto
  out = String(out || '').trim();
  if (ehLugarRuim_(out)) out = 'SEM BAIRRO';

  Logger.log(`[normalizeBairro_] resultado final: "${out}"`);
  return out;
}

/** Cria o evento direto a partir do candidato (sem depender da planilha) */
function preAgendarDireto(cand, meta){
  cand = cand || {}; meta = meta || {};
  if (!PRE_CALENDAR_ID) throw new Error('PRE_CALENDAR_ID não definido no backend (Library).');
  const cal = CalendarApp.getCalendarById(PRE_CALENDAR_ID);
  if (!cal) throw new Error('Calendário não encontrado. Verifique PRE_CALENDAR_ID.');

  const userEmail = Session.getActiveUser().getEmail() || 'usuario@dominio.com';
  const solicit   = userEmail.replace('@lebebe.com.br','').toUpperCase();

  const d = new Date(cand.dateISO);

  // >>> monta título no formato desejado
  const fonteEndereco = meta.address || meta.label || '';
  Logger.log('[preAgendarDireto] fonteEndereco="' + fonteEndereco + '"');
  const bairro = normalizeBairro_(fonteEndereco) || 'SEM BAIRRO';
  const titulo = `(${meta.tempo || ''}) ${bairro} (${(cand.team || '').toUpperCase()} - ${solicit})`.toUpperCase();

  const description =
    (meta.params||'').trim()
    + `\nEQUIPE: ${(cand.team||'').toUpperCase()}`
    + `\nFRETE: ${cand.frete||''}`
    + (meta.cep ? `\nCEP: ${meta.cep}` : '');

  const ev = cal.createAllDayEvent(titulo, d, { description });
  const eid = Utilities.base64EncodeWebSafe(ev.getId() + ' ' + PRE_CALENDAR_ID);
  const eventLink = 'https://calendar.google.com/calendar/u/0/r/eventedit/' + eid;

  const dataText = Utilities.formatDate(d,'GMT-3','dd/MM');
  logAuditRow(userEmail, meta.cep||'', (meta.params||''), (meta.tempo||''), '', dataText, eventLink);

  SpreadsheetApp.getUi().alert(`Pré-agendado: ${titulo}`);
}

/** Normaliza CEP em 00000-000; retorna "" se inválido */
function normalizeCep_(s) {
  var raw = String(s || '').replace(/\D/g, '');
  if (raw.length !== 8) return '';
  return raw.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/** Monta string amigável a partir do objeto de geocode */
function formatDisplayFromGeo_(geo) {
  if (!geo) return '';
  if (geo.display_name) return String(geo.display_name);
  if (geo.address) {
    var a = geo.address;
    return [
      a.road || a.residential || a.pedestrian || '',
      a.suburb || a.neighbourhood || '',
      (a.city || a.town || a.village || a.municipality || ''),
      (a.state || '')
    ].filter(Boolean).join(', ');
  }
  return '';
}

/* ===================================================== */
/* Sessão 4.X – CEP FREE STRICT (maps.co + LocationIQ + Photon) */
/* ===================================================== */

/**
 * ✅ FREE-ONLY: resolve CEP usando provedores grátis/pagos-baratos
 * Ordem:
 *  1) âncora (ViaCEP/BrasilAPI) → define UF/cidade (e valida PR/SP/SC)
 *  2) maps.co (com api_key se tiver)
 *  3) LocationIQ (key obrigatória se usar)
 *  4) Photon
 *
 * Retorna {lat,lng,display_name,address,provider} ou null
 */
function geocodeCepGratisStrict_(cep8, allowedUFs) {
  try {
    cep8 = String(cep8 || '').replace(/\D/g, '');
    if (cep8.length !== 8) return null;

    var allowed = Array.isArray(allowedUFs) && allowedUFs.length ? allowedUFs : ['PR','SP','SC'];

    // =========================
    // Sessão 4.X.1 – Âncora UF/cidade (OBRIGATÓRIA p/ validação)
    // =========================
    var anc = null;
    try { anc = _anchorForCep_(cep8); } catch(e) {}
    if (!anc) {
      try { anc = _viaCepLookup_(cep8) || _brasilApiLookup_(cep8); } catch(e) {}
    }

    var uf   = anc && anc.uf ? String(anc.uf).toUpperCase() : '';
    var city = anc && (anc.cidade || anc.localidade) ? String(anc.cidade || anc.localidade) : '';

    if (!uf || allowed.indexOf(uf) === -1) {
      Logger.log('[CEP-FREE] UF fora do escopo/ausente: ' + (uf || '(sem UF)'));
      return null;
    }
    if (!city) {
      Logger.log('[CEP-FREE] Sem cidade na âncora. Abortando (evita erro).');
      return null;
    }

    // =========================
    // Sessão 4.X.2 – maps.co (primeiro)
    // =========================
    var out = _geocodeCepMapsCo_(cep8, uf, city);
    if (out && _passaValidacaoCep_(out, cep8, uf, city)) return out;

    // =========================
    // Sessão 4.X.3 – LocationIQ (fallback forte)
    // =========================
    out = _geocodeCepLocationIQ_(cep8, uf, city);
    if (out && _passaValidacaoCep_(out, cep8, uf, city)) return out;

    // =========================
    // Sessão 4.X.4 – Photon
    // =========================
    out = _geocodeCepPhoton_(cep8, uf, city);
    if (out && _passaValidacaoCep_(out, cep8, uf, city)) return out;

    return null;
  } catch (e) {
    Logger.log('[CEP-FREE] erro geral: ' + (e && e.message));
    return null;
  }
}

/* =========================
   Validador ÚNICO: CEP + UF + CIDADE
   ========================= */
function _passaValidacaoCep_(out, cep8, uf, anchorCity){
  if (!out || out.lat==null || out.lng==null) return false;
  if (!isBrazilLatLng(out.lat, out.lng)) return false;

  // UF (quando possível)
  if (!ensureBrazilAndUF(out, uf)) return false;

  // CEP estrito quando vier do provider
  var pc = String(out.address && out.address.postcode || '').replace(/\D/g,'');
  if (pc && pc !== cep8) {
    Logger.log('[CEP-VALID] rejeitado: postcode "'+pc+'" ≠ '+cep8+' prov='+(out.provider||'?'));
    return false;
  }

  // CIDADE estrita (evita “Fazenda Rio Grande” quando âncora é Curitiba)
  var gotCity = _pickCityFromAddr_(out.address);
  if (!gotCity) {
    Logger.log('[CEP-VALID] rejeitado: sem cidade no address prov='+(out.provider||'?'));
    return false;
  }
  if (!_cityMatches_(gotCity, anchorCity)) {
    Logger.log('[CEP-VALID] rejeitado: cidade "'+gotCity+'" ≠ "'+anchorCity+'" prov='+(out.provider||'?'));
    return false;
  }

  return true;
}

/* =========================
   maps.co
   ========================= */
function _geocodeCepMapsCo_(cep8, uf, city) {
  try {
    var bbox = (typeof UF_BBOX !== 'undefined' && UF_BBOX && UF_BBOX[uf]) ? UF_BBOX[uf] : BR_BBOX;
    var viewbox = [bbox.left, bbox.top, bbox.right, bbox.bottom].join(',');

    var url = 'https://geocode.maps.co/search'
      + '?format=jsonv2&limit=3&addressdetails=1&accept-language=pt-BR&countrycodes=br'
      + '&bounded=1&viewbox=' + encodeURIComponent(viewbox)
      + '&postalcode=' + encodeURIComponent(cep8);

    if (city) url += '&city=' + encodeURIComponent(city);
    if (uf)   url += '&state=' + encodeURIComponent(uf);

    // key do maps.co (melhora estabilidade)
    if (typeof MAPSCO_API_KEY !== 'undefined' && MAPSCO_API_KEY) {
      url += '&api_key=' + encodeURIComponent(String(MAPSCO_API_KEY).trim());
    }

    var arr = fetchJsonWithHeaders(url, 'mapsco-cep-estrito');
    if (!Array.isArray(arr) || !arr.length) return null;

    for (var i=0; i<Math.min(3, arr.length); i++) {
      var o = arr[i];
      var pc = String(o && o.address && o.address.postcode || '').replace(/\D/g,'');
      if (pc !== cep8) continue;

      var lat = +o.lat, lng = +o.lon;
      if (!isBrazilLatLng(lat, lng)) continue;

      var out = {
        lat: lat,
        lng: lng,
        display_name: o.display_name || ('CEP ' + cep8),
        address: o.address || { postcode: cep8, state: uf, city: city },
        provider: 'maps.co'
      };

      Logger.log('[CEP-FREE] maps.co candidato → ' + out.display_name);
      return out;
    }

    return null;
  } catch (e) {
    Logger.log('[CEP-FREE] maps.co erro: ' + (e && e.message));
    return null;
  }
}

/* =========================
   LocationIQ (fallback)
   ========================= */
function _geocodeCepLocationIQ_(cep8, uf, city) {
  try {
    if (typeof LOCATIONIQ_API_KEY === 'undefined' || !LOCATIONIQ_API_KEY) {
      Logger.log('[CEP-FREE] LocationIQ SKIP: sem key');
      return null;
    }

    // ✅ addressdetails=1 é obrigatório pra vir cidade (senão não dá pra validar)
    var q = cep8 + (city ? (' ' + city) : '') + ' ' + uf + ' Brasil';
    var url = 'https://us1.locationiq.com/v1/search'
      + '?format=json'
      + '&limit=3'
      + '&addressdetails=1'
      + '&accept-language=pt-BR'
      + '&countrycodes=br'
      + '&q=' + encodeURIComponent(q)
      + '&key=' + encodeURIComponent(String(LOCATIONIQ_API_KEY).trim());

    var arr = fetchJsonWithHeaders(url, 'locationiq-cep');
    if (!Array.isArray(arr) || !arr.length) return null;

    for (var i=0; i<Math.min(3, arr.length); i++) {
      var o = arr[i];
      var lat = +o.lat, lng = +o.lon;
      if (!isBrazilLatLng(lat, lng)) continue;

      var addr = o.address || null;

      // postcode pode vir em o.postcode ou address.postcode
      var pc = String(o.postcode || (addr && addr.postcode) || '').replace(/\D/g,'');
      if (pc && pc !== cep8) continue;

      var out = {
        lat: lat,
        lng: lng,
        display_name: o.display_name || ('CEP ' + cep8),
        address: addr || { postcode: cep8, state: uf, city: city },
        provider: 'locationiq'
      };

      Logger.log('[CEP-FREE] LocationIQ candidato → ' + out.display_name);
      return out;
    }

    return null;
  } catch (e) {
    Logger.log('[CEP-FREE] LocationIQ erro: ' + (e && e.message));
    return null;
  }
}

/* =========================
   Photon
   ========================= */
function _geocodeCepPhoton_(cep8, uf, city) {
  try {
    var q = cep8 + (city ? (' ' + city) : '') + ' ' + uf + ' Brasil';
    var url = 'https://photon.komoot.io/api/'
      + '?limit=3'
      + '&q=' + encodeURIComponent(q);

    var ph = fetchJsonWithHeaders(url, 'photon-cep-estrito');
    if (!ph || !ph.features || !ph.features.length) return null;

    for (var i=0; i<Math.min(3, ph.features.length); i++) {
      var f = ph.features[i];
      var props = (f && f.properties) ? f.properties : {};
      var coords = (f && f.geometry && f.geometry.coordinates) ? f.geometry.coordinates : null;
      if (!coords || coords.length < 2) continue;

      var lon = +coords[0], lat = +coords[1];
      if (!isBrazilLatLng(lat, lon)) continue;

      var pc = String(props.postcode || '').replace(/\D/g,'');
      if (pc && pc !== cep8) continue;

      // photon costuma trazer city/state/country nas properties quando disponível
      var addr = {
        postcode: (props.postcode || cep8),
        city: (props.city || props.town || props.village || props.name || ''),
        state: (props.state || ((UF_NAMES && UF_NAMES[uf]) ? UF_NAMES[uf] : uf))
      };

      var out = {
        lat: lat,
        lng: lon,
        display_name: props.name || ('CEP ' + cep8),
        address: addr,
        provider: 'photon'
      };

      Logger.log('[CEP-FREE] Photon candidato → ' + out.display_name);
      return out;
    }

    return null;
  } catch (e) {
    Logger.log('[CEP-FREE] Photon erro: ' + (e && e.message));
    return null;
  }
}

/* ===================================================== */
/* Sessão 4.X.A – Helpers de validação (cidade/UF)        */
/* ===================================================== */

function _pickCityFromAddr_(addr){
  if (!addr) return '';
  return String(
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.locality ||
    ''
  ).trim();
}

function _normTxt_(s){
  return String(s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().trim();
}

function _cityMatches_(gotCity, anchorCity){
  if (!gotCity || !anchorCity) return false;
  return _normTxt_(gotCity) === _normTxt_(anchorCity);
}

/** Log compacto da origem do CEP */
function _logCepSource_(cepFmt, source){
  // source ∈ { 'L1_CACHE', 'L2_SHEET', 'FREE', 'FAIL' }
  Logger.log('[CEP-LOOKUP] %s → %s', String(cepFmt||'').trim(), source);
}

/* ===================================================== */
/* Sessão 1.0 – LookupEnderecoPorCEP (FRONT) – SEM GOOGLE */
/* ===================================================== */

// garante que não dá ReferenceError se não existir global
if (typeof MAPSCO_API_KEY === 'undefined')     var MAPSCO_API_KEY = '';
if (typeof LOCATIONIQ_API_KEY === 'undefined') var LOCATIONIQ_API_KEY = '';

function LookupEnderecoPorCEP(cepRaw) {

  // =========================
  // Sessão 0 – Setup (MAPS.CO / LOCATIONIQ)
  // =========================
  try {
    var ssSrc = abrirPlanilhaFonte_();
    var cfgSheet = ssSrc.getSheets().find(function (s) { return s.getSheetId() === 718532388; });
    if (cfgSheet) {
      // usa exatamente as chaves como estão na tua config
      try { MAPSCO_API_KEY     = getConfig('MAPS.CO API KEY', cfgSheet); } catch (e) {}
      try { LOCATIONIQ_API_KEY = getConfig('LOCATIONIQ API KEY', cfgSheet); } catch (e) {}
    }
  } catch (e) {}

  // =========================
  // Sessão 1 – Validação CEP
  // =========================
  var cepFmt = normalizeCep_(cepRaw);
  if (!cepFmt) {
    _logCepSource_(cepRaw, 'FAIL');
    return { ok: false, error: 'CEP inválido.' };
  }
  var cep8 = cepFmt.replace(/\D/g, '');

  // =========================
  // Sessão 1.1 – Diagnóstico CEP (logs)
  // =========================
  function _dbgCep_(label, obj) {
    try { Logger.log('[CEP-DBG] %s: %s', label, JSON.stringify(obj)); }
    catch (e) { Logger.log('[CEP-DBG] %s: %s', label, String(obj)); }
  }

  _dbgCep_('INPUT', { cepRaw: String(cepRaw || ''), cepFmt: cepFmt, cep8: cep8 });
  _dbgCep_('KEYS', {
    hasMapsCo: !!(MAPSCO_API_KEY && String(MAPSCO_API_KEY).trim()),
    hasLocationIQ: !!(LOCATIONIQ_API_KEY && String(LOCATIONIQ_API_KEY).trim())
  });

  // =========================
  // Sessão 2 – Cache keys
  // =========================
  var key = _cepCacheKey_(cep8);

  // =========================
  // Sessão 3 – L1 CacheService (6h)
  // =========================
  try {
    var L1 = CacheService.getScriptCache().get(key);
    if (L1) {
      var obj = JSON.parse(L1);
      _logCepSource_(cepFmt, 'L1_CACHE');
      return obj;
    }
  } catch (e) {
    _dbgCep_('L1_ERROR', { message: String(e) });
  }

  // =========================
  // Sessão 4 – L2 Planilha CEP_CACHE (mês)
  // =========================
  try {
    var hit = _readCepFromL2_(key);
    if (hit && hit.ok) {
      var displayText = hit.display || hit.display_name || hit.enderecoCompleto || '';
      var outL2 = {
        ok: true,
        cep: cepFmt,
        display: displayText,
        display_name: displayText, // ✅ Compatibilidade
        enderecoCompleto: displayText, // ✅ Compatibilidade
        lat: hit.lat,
        lng: hit.lng,
        provider: hit.provider || 'free',
        address: hit.address || null,
        ufs: hit.ufs || 'PR,SP,SC',
        monthTag: hit.monthTag
      };
      try { CacheService.getScriptCache().put(key, JSON.stringify(outL2), 6 * 3600); } catch (e) {}
      _logCepSource_(cepFmt, 'L2_SHEET');
      return outL2;
    }
  } catch (e) {
    _dbgCep_('L2_ERROR', { message: String(e) });
  }

  // =========================
  // Sessão 5 – FREE ONLY (sem Google)
  // =========================
  var allowedUFs = ['PR', 'SP', 'SC'];

  var geo = null;
  try {
    geo = geocodeCepGratisStrict_(cep8, allowedUFs);
    _dbgCep_('FREE_RESULT', geo);
  } catch (e) {
    _dbgCep_('FREE_ERROR', { message: String(e) });
    geo = null;
  }

  if (!geo) {
    _logCepSource_(cepFmt, 'FAIL');
    return { ok: false, error: 'CEP falhou nos provedores grátis (maps.co/locationiq/photon). Veja logs [CEP-DBG].' };
  }

  // =========================
  // Sessão 6 – Monta retorno + grava caches
  // =========================
  var provider = (geo && geo.provider) ? String(geo.provider) : 'free';
  var displayText = formatDisplayFromGeo_(geo);

  var rec = {
    ok: true,
    cep: cepFmt,
    display: displayText,
    display_name: displayText, // ✅ Compatibilidade
    enderecoCompleto: displayText, // ✅ Campo usado pelo payload
    lat: Number(geo.lat || 0),
    lng: Number(geo.lng || 0),
    provider: provider,
    address: geo.address || null,
    ufs: allowedUFs
  };
  
  _dbgCep_('FINAL_REC', { display: displayText, hasAddress: !!rec.address });

  // grava no L2 (mês)
  try { _writeCepToL2_(key, rec); } catch (e) { _dbgCep_('L2_WRITE_ERROR', String(e)); }

  // grava no L1 (6h)
  try { CacheService.getScriptCache().put(key, JSON.stringify(rec), 6 * 3600); } catch (e) {}

  _logCepSource_(cepFmt, 'FREE');
  return rec;
}


/* ===================================================== */
/* Sessão 7 – Novo Fluxo de Geocode por Endereço Completo */
/* ===================================================== */

function MontarEnderecoDisplay_(f) {
  var logradouro = String(f.logradouro || '').trim();
  var numero     = String(f.numero || '').trim();
  var bairro     = String(f.bairro || '').trim();
  var cidade     = String(f.cidade || '').trim();
  var uf         = String(f.uf || '').trim().toUpperCase();

  // limpar múltiplos espaços
  logradouro = logradouro.replace(/\s+/g, ' ');

  var parts = [];
  parts.push(logradouro);
  if (numero) parts.push(numero);
  if (bairro) parts.push(bairro);
  if (cidade) parts.push(cidade + ' - ' + uf);
  parts.push('Brasil');

  return parts.filter(Boolean).join(', ');
}

function MontarEnderecoCurto_(f) {
  var logradouro = String(f.logradouro || '').trim();
  var numero     = String(f.numero || '').trim();
  var bairro     = String(f.bairro || '').trim();
  var cidade     = String(f.cidade || '').trim();
  var uf         = String(f.uf || '').trim().toUpperCase();

  logradouro = logradouro.replace(/\s+/g, ' ');

  var parts = [];
  if (logradouro) parts.push(logradouro);
  if (numero) parts.push(numero);
  if (bairro) parts.push(bairro);
  if (cidade) {
    if (uf) parts.push(cidade + ' - ' + uf);
    else parts.push(cidade);
  } else if (uf) {
    parts.push(uf);
  }

  return parts.filter(Boolean).join(', ');
}

function NormalizarEnderecoParaCache_(f) {
  var logradouro = String(f.logradouro || '').trim();
  var bairro     = String(f.bairro || '').trim();
  var cidade     = String(f.cidade || '').trim();
  var uf         = String(f.uf || '').trim().toUpperCase();

  logradouro = logradouro.replace(/\s+/g, ' ');

  var partes = [];
  if (logradouro) partes.push(logradouro);
  if (bairro) partes.push(bairro);
  if (cidade && uf) partes.push(cidade + ' - ' + uf);
  else if (cidade) partes.push(cidade);
  else if (uf) partes.push(uf);
  
  partes.push('BRASIL');
  
  var stringBruta = partes.join(', ');
  
  // Normalizar: remover acentos e caracteres especiais, transformar em upper
  var normalizada = stringBruta.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9,\-\s]/g, '').replace(/\s+/g, ' ').trim();
  return normalizada;
}

function _hashEnderecoSemNumero_(normStr) {
  var signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, normStr);
  var hash = signature.map(function(e) {
    var v = (e < 0 ? e + 256 : e).toString(16);
    return v.length == 1 ? "0" + v : v;
  }).join("");
  return hash;
}

/**
 * 🔍 VERSÃO MELHORADA COM DIAGNÓSTICO COMPLETO
 * Resolve endereço com cache L1 + Supabase + Providers externos
 * Inclui timing detalhado e logs estruturados
 */
function ResolverEnderecoComCache_(form, origin, preloadedCache) {
  var startTime = Date.now();
  origin = origin || 'MODAL';
  preloadedCache = preloadedCache || null;
  
  // 📊 Log de contexto da execução
  Logger.log('[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====');
  var execContext = _logExecutionContext_('ResolverEnderecoComCache_', { origin: origin });
  
  // 1. Validar campos básicos minimum
  var logradouro = String(form.logradouro || '').trim();
  var cidade     = String(form.cidade || '').trim();
  var uf         = String(form.uf || '').trim().toUpperCase();

  if (logradouro.length < 3 || cidade.length < 3 || uf.length !== 2) {
    _logGeocodingError_('VALIDATION', 'Endereço incompleto', { logradouro: logradouro, cidade: cidade, uf: uf });
    Logger.log('[LOOKUP-FIM] total=' + (Date.now() - startTime) + 'ms | result=FAILED (incomplete)');
    return { ok: false, error: 'Endereço incompleto para geocode. Faltam logs vitais (Logradouro, Cidade, UF).' };
  }

  // 2. Monta strings e chave
  var normStart = Date.now();
  var addrDisplay = MontarEnderecoDisplay_(form);
  var addrNorm    = NormalizarEnderecoParaCache_(form);
  var hashKey     = _hashEnderecoSemNumero_(addrNorm);
  var normTime = Date.now() - normStart;
  
  Logger.log('[LOOKUP] addr_display="' + addrDisplay + '"');
  Logger.log('[LOOKUP] addr_norm="' + addrNorm + '" (normalized in ' + normTime + 'ms)');
  Logger.log('[LOOKUP] hash_key=' + hashKey);

  // 3. Verifica Cache L1 (6 horas)
  var l1Key = 'GEOADDR_' + hashKey;
  var l1Start = Date.now();
  try {
    var L1 = CacheService.getScriptCache().get(l1Key);
    var l1Time = Date.now() - l1Start;
    
    if (L1) {
      _logCacheOperation_('READ', hashKey, addrNorm, origin, true, 'l1', l1Time);
      
      var objL1 = JSON.parse(L1);
      objL1.enderecoCompleto = addrDisplay;
      
      var duration = Date.now() - startTime;
      RegistrarGeocodingAudit_(hashKey, addrDisplay, true, 'l1', objL1.confidence || 1.0, origin, duration);
      
      Logger.log('[LOOKUP-FIM] total=' + duration + 'ms | result=SUCCESS (L1 cache)');
      return objL1;
    } else {
      _logCacheOperation_('READ', hashKey, addrNorm, origin, false, 'l1', l1Time);
    }
  } catch(e) {
    _logGeocodingError_('CACHE', 'Erro ao ler cache L1', { error: e.message });
  }

  // 4. Verifica Cache Supabase (L2) REST
  var l2Start = Date.now();
  try {
    var fbResp = preloadedCache ? preloadedCache[hashKey] : ConsultarCacheSupabase_(hashKey);
    var l2Time = Date.now() - l2Start;
    
    if (fbResp && fbResp.lat) {
      _logCacheOperation_('READ', hashKey, addrNorm, origin, true, 'supabase', l2Time);

      var cepFromText = '';
      try {
        var txt = String(fbResp.endereco_completo || '');
        var m = txt.match(/\b\d{5}-\d{3}\b/);
        if (m && m[0]) cepFromText = String(m[0]).trim();
      } catch(_e) {}

      var L2Obj = {
        ok: true,
        lat: Number(fbResp.lat),
        lng: Number(fbResp.lng),
        enderecoCompleto: fbResp.endereco_completo || addrDisplay,
        cep: cepFromText || (fbResp.cep || ''),
        provider: 'supabase',
        confidence: Number(fbResp.confidence || 1.0)
      };
      
      var toL1 = JSON.parse(JSON.stringify(L2Obj));
      toL1.enderecoCompleto = addrDisplay;
      CacheService.getScriptCache().put(l1Key, JSON.stringify(toL1), 6 * 3600);
      
      L2Obj.enderecoCompleto = addrDisplay;
      
      var duration = Date.now() - startTime;
      RegistrarGeocodingAudit_(hashKey, addrDisplay, true, 'supabase', L2Obj.confidence, origin, duration);
      
      Logger.log('[LOOKUP-FIM] total=' + duration + 'ms | result=SUCCESS (Supabase L2 cache)');
      return L2Obj;
    } else {
      _logCacheOperation_('READ', hashKey, addrNorm, origin, false, 'supabase', l2Time);
    }
  } catch (e) {
    _logGeocodingError_('CACHE', 'Erro ao ler cache Supabase L2', { error: e.message });
  }

  Logger.log('[LOOKUP] Cache MISS → Buscando providers externos...');

  // 5. Cascata Gratuita
  var numero = String(form.numero || '').trim();
  var logradouroComNumero = numero ? (logradouro + ' ' + numero) : logradouro;
  
  var providerStart = Date.now();
  var geoOut = geocodeAddressGratisStrict_(addrDisplay, uf, cidade, logradouroComNumero);
  var providerTime = Date.now() - providerStart;
  
  Logger.log('[LOOKUP] Providers executados em ' + providerTime + 'ms');
  
  if (!geoOut || !geoOut.ok) {
    var err = (geoOut && geoOut.error) ? geoOut.error : 'Sem provider disponível com precisão adequada.';
    _logGeocodingError_('VALIDATION', 'Geocoding rejeitado', { error: err });
    Logger.log('[LOOKUP-FIM] total=' + (Date.now() - startTime) + 'ms | result=FAILED (no valid provider)');
    return { ok: false, error: err };
  }

  // 5.5 ✅ Buscar CEP correto via ViaCEP (Correios)
  var cepCorreto = geoOut.postcode || '';
  var bairroCorreios = '';
  var viaCepStart = Date.now();
  try {
    var viaCep = BuscarCepViaCorreios_(logradouro, cidade, uf, String(form.numero || ''));
    var viaCepTime = Date.now() - viaCepStart;
    
    if (viaCep && viaCep.ok && viaCep.cep) {
      Logger.log('[ViaCEP] ✅ CEP Correios: ' + viaCep.cep + ' (provider retornou: ' + (geoOut.postcode || 'N/A') + ') em ' + viaCepTime + 'ms');
      cepCorreto = viaCep.cep;
      if (viaCep.bairro) bairroCorreios = viaCep.bairro;
    } else {
      Logger.log('[ViaCEP] ⚠️ Sem CEP dos Correios, usando provider: ' + (geoOut.postcode || 'N/A') + ' (' + viaCepTime + 'ms)');
    }
  } catch(e) {
    Logger.log('[ViaCEP] Erro: ' + (e && e.message));
  }

  // 6. Monta Objeto Final de Sucesso
  var finalOut = {
    ok: true,
    lat: geoOut.lat,
    lng: geoOut.lng,
    enderecoCompleto: addrDisplay,
    display_name: geoOut.display_name || addrDisplay,
    cep: cepCorreto,
    cepProvider: geoOut.postcode || '',
    bairroCorreios: bairroCorreios,
    provider: geoOut.provider,
    confidence: geoOut.confidence || 0,
    address: geoOut.address || null
  };

  var duration = Date.now() - startTime;
  RegistrarGeocodingAudit_(hashKey, addrDisplay, false, geoOut.provider, geoOut.confidence, origin, duration);

  // 7. Salvar Caches
  var cacheWriteStart = Date.now();
  try {
    CacheService.getScriptCache().put(l1Key, JSON.stringify(finalOut), 6 * 3600);
    var cacheWriteTime = Date.now() - cacheWriteStart;
    _logCacheOperation_('WRITE', hashKey, null, origin, true, 'l1', cacheWriteTime);
  } catch(e) {
    _logGeocodingError_('CACHE', 'Erro ao gravar cache L1', { error: e.message });
  }
  
  var supaWriteStart = Date.now();
  try {
    var recordSupa = {
      chave_endereco: hashKey,
      endereco_completo: addrDisplay,
      logradouro: logradouro,
      numero: String(form.numero || '').trim(),
      bairro: String(form.bairro || '').trim(),
      cidade: cidade,
      uf: uf,
      cep: finalOut.cep,
      lat: finalOut.lat,
      lng: finalOut.lng,
      provider: finalOut.provider,
      confidence: finalOut.confidence
    };
    SalvarCacheSupabase_(recordSupa);
    var supaWriteTime = Date.now() - supaWriteStart;
    _logCacheOperation_('WRITE', hashKey, null, origin, true, 'supabase', supaWriteTime);
  } catch(e) {
    _logGeocodingError_('CACHE', 'Erro ao gravar cache Supabase', { error: e.message });
  }

  Logger.log('[LOOKUP-FIM] total=' + (Date.now() - startTime) + 'ms | result=SUCCESS (API call cached)');
  return finalOut;
}

/* ===================================================== */
/* Sessão 7.1 – Lookup CEP via ViaCEP (Dados dos Correios) */
/* ===================================================== */

/**
 * Busca o CEP correto via ViaCEP (dados oficiais dos Correios).
 * Endpoint: https://viacep.com.br/ws/{UF}/{Cidade}/{Logradouro}/json/
 * Retorna o CEP mais adequado para o número informado.
 * @param {string} logradouro - Nome da rua (ex: "Rua Pedro Demeterco")
 * @param {string} cidade - Nome da cidade (ex: "Curitiba")
 * @param {string} uf - Sigla do estado (ex: "PR")
 * @param {string|number} numero - Número do endereço (ex: "269")
 * @returns {object} { ok, cep, bairro, complemento } ou { ok: false }
 */
function BuscarCepViaCorreios_(logradouro, cidade, uf, numero) {
  try {
    if (!logradouro || !cidade || !uf) return { ok: false };
    
    // ✅ Expandir abreviações comuns de logradouro
    var logrLimpo = String(logradouro).trim().replace(/\s+/g, ' ');
    logrLimpo = logrLimpo
      .replace(/^R\.\s*/i, 'Rua ')
      .replace(/^Av\.\s*/i, 'Avenida ')
      .replace(/^Al\.\s*/i, 'Alameda ')
      .replace(/^Pç\.\s*/i, 'Praça ')
      .replace(/^Pc\.\s*/i, 'Praça ')
      .replace(/^Trav\.\s*/i, 'Travessa ')
      .replace(/^Tv\.\s*/i, 'Travessa ')
      .replace(/^Rod\.\s*/i, 'Rodovia ')
      .replace(/^Est\.\s*/i, 'Estrada ')
      .replace(/^Lot\.\s*/i, 'Loteamento ')
      .replace(/^Br\s+/i, 'BR ')
      .trim();
    
    // ViaCEP precisa de pelo menos 3 caracteres no logradouro
    if (logrLimpo.length < 3) return { ok: false };
    
    Logger.log('[ViaCEP] Logradouro expandido: "' + logrLimpo + '"');
    
    var ufEnc = encodeURIComponent(String(uf).trim().toUpperCase());
    var cidadeEnc = encodeURIComponent(String(cidade).trim());
    
    // Tentativa 1: logradouro completo expandido
    var url = 'https://viacep.com.br/ws/' + ufEnc + '/' + cidadeEnc + '/' + encodeURIComponent(logrLimpo) + '/json/';
    Logger.log('[ViaCEP] Buscando: ' + url);
    
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = resp.getResponseCode();
    var data = null;
    
    if (code === 200) {
      try { data = JSON.parse(resp.getContentText()); } catch(_) {}
    }
    
    // Se não retornou array válido, tentar fallback: só o nome (sem tipo)
    if (!Array.isArray(data) || data.length === 0) {
      var nomeSemTipo = logrLimpo
        .replace(/^(Rua|Avenida|Alameda|Praça|Travessa|Rodovia|Estrada|Loteamento|BR)\s+/i, '')
        .trim();
      
      if (nomeSemTipo.length >= 3 && nomeSemTipo !== logrLimpo) {
        Logger.log('[ViaCEP] Tentativa 2 (sem tipo): "' + nomeSemTipo + '"');
        var url2 = 'https://viacep.com.br/ws/' + ufEnc + '/' + cidadeEnc + '/' + encodeURIComponent(nomeSemTipo) + '/json/';
        
        var resp2 = UrlFetchApp.fetch(url2, { muteHttpExceptions: true });
        if (resp2.getResponseCode() === 200) {
          try { data = JSON.parse(resp2.getContentText()); } catch(_) {}
        }
      }
    }
    
    // Se ainda não tem dados válidos, desistir
    if (!Array.isArray(data) || data.length === 0) {
      Logger.log('[ViaCEP] Sem resultados após tentativas');
      return { ok: false };
    }
    
    Logger.log('[ViaCEP] Encontrou ' + data.length + ' CEP(s) para "' + logrLimpo + '"');
    
    // Se só tem 1 resultado, retorna direto
    if (data.length === 1) {
      Logger.log('[ViaCEP] ✅ CEP único: ' + data[0].cep + ' | bairro=' + data[0].bairro);
      return { ok: true, cep: data[0].cep, bairro: data[0].bairro, complemento: data[0].complemento || '' };
    }
    
    // Múltiplos CEPs: tentar encontrar o correto pelo número
    var num = parseInt(String(numero || '0').replace(/\D/g, ''), 10) || 0;
    
    if (num > 0) {
      for (var i = 0; i < data.length; i++) {
        var comp = String(data[i].complemento || '').toLowerCase();
        
        // Padrões comuns: "até 298/299", "de 300/301 ao fim", "de 100 a 200", "lado par", "lado ímpar"
        
        // Verificar par/ímpar
        if (comp.indexOf('lado par') >= 0 && num % 2 !== 0) continue;
        if ((comp.indexOf('lado ímpar') >= 0 || comp.indexOf('lado impar') >= 0) && num % 2 === 0) continue;
        
        // Padrão "até NNN" ou "até NNN/NNN"
        var mAte = comp.match(/at[eé]\s+(\d+)/);
        if (mAte) {
          var limite = parseInt(mAte[1], 10);
          if (num <= limite) {
            Logger.log('[ViaCEP] ✅ CEP por faixa "até ' + limite + '": ' + data[i].cep + ' (num=' + num + ')');
            return { ok: true, cep: data[i].cep, bairro: data[i].bairro, complemento: comp };
          }
          continue;
        }
        
        // Padrão "de NNN ao fim" ou "de NNN/NNN ao fim"
        var mDeFim = comp.match(/de\s+(\d+).*(?:ao\s+fim|em\s+diante)/);
        if (mDeFim) {
          var inicio = parseInt(mDeFim[1], 10);
          if (num >= inicio) {
            Logger.log('[ViaCEP] ✅ CEP por faixa "de ' + inicio + ' ao fim": ' + data[i].cep + ' (num=' + num + ')');
            return { ok: true, cep: data[i].cep, bairro: data[i].bairro, complemento: comp };
          }
          continue;
        }
        
        // Padrão "de NNN a NNN"
        var mRange = comp.match(/de\s+(\d+)\s+a\s+(\d+)/);
        if (mRange) {
          var de = parseInt(mRange[1], 10);
          var ate = parseInt(mRange[2], 10);
          if (num >= de && num <= ate) {
            Logger.log('[ViaCEP] ✅ CEP por faixa "' + de + '-' + ate + '": ' + data[i].cep + ' (num=' + num + ')');
            return { ok: true, cep: data[i].cep, bairro: data[i].bairro, complemento: comp };
          }
          continue;
        }
      }
    }
    
    // Fallback: retorna o primeiro resultado
    Logger.log('[ViaCEP] ⚠️ Não conseguiu determinar faixa, usando primeiro: ' + data[0].cep);
    return { ok: true, cep: data[0].cep, bairro: data[0].bairro, complemento: data[0].complemento || '' };
    
  } catch(e) {
    Logger.log('[ViaCEP] Erro: ' + (e && e.message));
    return { ok: false };
  }
}

/**
 * Registra uma busca de geocoding na tabela de auditoria do Supabase
 * @param {string} hashKey - Hash do endereço (chave_endereco)
 * @param {string} addrDisplay - Endereço completo formatado
 * @param {boolean} cacheHit - true se veio do cache, false se chamou API
 * @param {string} provider - Provider usado (locationiq, photon, supabase, l1, etc)
 * @param {number} confidence - Nível de confiança (0.0 a 1.0)
 * @param {string} origin - Origem da requisição (MODAL, API, etc)
 * @param {number} durationMs - Tempo de execução em milissegundos
 */
function RegistrarGeocodingAudit_(hashKey, addrDisplay, cacheHit, provider, confidence, origin, durationMs) {
  try {
    var userEmail = '';
    try { userEmail = Session.getActiveUser().getEmail(); } catch(e) {}
    
    var payload = {
      chave_endereco: hashKey,
      endereco_completo: addrDisplay,
      cache_hit: cacheHit,
      provider: provider || 'unknown',
      confidence: confidence || null,
      user_email: userEmail || null,
      origin: origin || 'MODAL',
      duration_ms: durationMs ? Math.round(durationMs) : null
    };
    
    // Enviar para Supabase REST API
    var SUPABASE_URL = getSupabaseUrl_();
    var SUPABASE_ANON_KEY = getSupabaseKey_();
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      Logger.log('[AUDIT] ⚠️ Supabase não configurado, pulando registro');
      return;
    }
    
    var url = SUPABASE_URL + '/rest/v1/geocoding_audit';
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: 500  // ✅ OTIMIZAÇÃO: timeout de 500ms (não bloqueia por mais tempo)
    };
    
    var t0 = Date.now();
    var response = UrlFetchApp.fetch(url, options);
    var dt = Date.now() - t0;
    var code = response.getResponseCode();
    
    if (code >= 200 && code < 300) {
      Logger.log('[AUDIT] ✅ Registrado em ' + dt + 'ms: cache_hit=' + cacheHit + ' provider=' + provider);
    } else {
      Logger.log('[AUDIT] ⚠️ Erro HTTP ' + code + ' (' + dt + 'ms): ' + response.getContentText().substring(0, 200));
    }
    
  } catch(e) {
    // Timeout ou erro de rede não deve derrubar o fluxo
    if (e && e.message && e.message.indexOf('Timeout') >= 0) {
      Logger.log('[AUDIT] ⏱️ Timeout (>500ms), mas operação continua');
    } else {
      Logger.log('[AUDIT] ❌ Erro ao registrar: ' + (e && e.message));
    }
  }
}

function RegistrarExecucaoPesquisaAudit_(payload) {
  try {
    var SUPABASE_URL = getSupabaseUrl_();
    var SUPABASE_ANON_KEY = getSupabaseKey_();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      Logger.log('[SEARCH-AUDIT] ⚠️ Supabase não configurado, pulando registro');
      return;
    }

    var url = SUPABASE_URL + '/rest/v1/search_execution_audit';

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true,
      timeout: 500  // ✅ OTIMIZAÇÃO: timeout de 500ms (não bloqueia por mais tempo)
    };

    var t0 = Date.now();
    var response = UrlFetchApp.fetch(url, options);
    var dt = Date.now() - t0;
    var code = response.getResponseCode();

    if (code >= 200 && code < 300) {
      Logger.log('[SEARCH-AUDIT] ✅ Registrado em ' + dt + 'ms: status=' + (payload && payload.status) + ' duration_ms=' + (payload && payload.total_duration_ms));
    } else {
      Logger.log('[SEARCH-AUDIT] ⚠️ Erro HTTP ' + code + ' (' + dt + 'ms): ' + response.getContentText().substring(0, 200));
    }
  } catch(e) {
    // Timeout ou erro de rede não deve derrubar o fluxo
    if (e && e.message && e.message.indexOf('Timeout') >= 0) {
      Logger.log('[SEARCH-AUDIT] ⏱️ Timeout (>500ms), mas operação continua');
    } else {
      Logger.log('[SEARCH-AUDIT] ❌ Erro ao registrar: ' + (e && e.message));
    }
  }
}

function getSupabaseUrl_() {
  try {
    var ssSrc = abrirPlanilhaFonte_();
    var cfgSheet = ssSrc.getSheets().find(function(s){ return s.getSheetId() === 718532388; });
    if (cfgSheet) {
      return getConfig('SUPABASE_URL', cfgSheet);
    }
  } catch(e) {}
  return '';
}

function getSupabaseKey_() {
  try {
    var ssSrc = abrirPlanilhaFonte_();
    var cfgSheet = ssSrc.getSheets().find(function(s){ return s.getSheetId() === 718532388; });
    if (cfgSheet) {
      return getConfig('SUPABASE_ANON_KEY', cfgSheet);
    }
  } catch(e) {}
  return '';
}

// Retro-compatibilidade com o app antigo (mantém o nome function lookupCompletoPorEndereco apontando pro novo)
function lookupCompletoPorEndereco(f) {
  return ResolverEnderecoComCache_(f, 'MODAL');
}

function TESTE_CacheSemNumero_() {
  Logger.log('=== INICIANDO TESTE SEM NUMERO ===');
  
  var a = { logradouro: 'Avenida Paulista', numero: '1578', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };
  var b = { logradouro: 'Avenida Paulista', numero: '2000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };
  
  var normA = NormalizarEnderecoParaCache_(a);
  var normB = NormalizarEnderecoParaCache_(b);
  Logger.log('Norm A: ' + normA);
  Logger.log('Norm B: ' + normB);
  
  if (normA === normB) {
    Logger.log('✅ SUCESSO! Ambas as queries normalizadas são idênticas mesmo com número distinto.');
  } else {
    Logger.log('❌ FALHA! Normalizações diferem. ' + normA + ' vs ' + normB);
  }
  
  var hashA = _hashEnderecoSemNumero_(normA);
  var hashB = _hashEnderecoSemNumero_(normB);
  Logger.log('Hash A: ' + hashA);
  Logger.log('Hash B: ' + hashB);
  
  var s1 = Date.now();
  var resA = ResolverEnderecoComCache_(a, 'TESTE_A');
  Logger.log('T1 (' + (Date.now()-s1) +'ms): ' + resA.provider + ' (Endereço Formatado: ' + resA.enderecoCompleto + ')');
  
  var s2 = Date.now();
  var resB = ResolverEnderecoComCache_(b, 'TESTE_B');
  Logger.log('T2 (' + (Date.now()-s2) +'ms): ' + resB.provider + ' (Endereço Formatado: ' + resB.enderecoCompleto + ')');
}

function TESTE_AgendaSalvaCache_() {
  Logger.log('=== INICIANDO TESTE STRING DA AGENDA ===');
  
  var strSuja = "ENDEREÇO: Av. Marechal Floriano Peixoto 5636, Hauer - Curitiba PR";
  Logger.log('String crua: ' + strSuja);
  
  var addr = strSuja.replace(/\n/g, ', ').replace(/\s+/g, ' ').replace(/,+/g, ',').trim();
  if(addr.toUpperCase().startsWith('ENDEREÇO:')) addr = addr.substring(9).trim();
  
  var mockForm = {
    logradouro: addr,
    numero: '',
    bairro: '',
    cidade: 'Curitiba',
    uf: 'PR'
  };
  
  var pM = addr.match(/(.*?)[,-]\s*([A-Za-zÀ-ÿ\s]+)\s*-\s*([A-Za-z]{2})\s*$/);
  if (!pM) pM = addr.match(/(.*?)[,-]\s*([A-Za-zÀ-ÿ\s]+)\s+([A-Za-z]{2})\s*$/);
  
  if (pM) {
     mockForm.logradouro = pM[1].trim();
     mockForm.cidade = pM[2].trim();
     mockForm.uf = pM[3].trim().toUpperCase();
     var bM = mockForm.logradouro.match(/(.*?)[,-]\s*([^,-]+)$/);
     if(bM) {
       mockForm.logradouro = bM[1].trim();
       mockForm.bairro = bM[2].trim();
     }
  }
  
  Logger.log('Form Mocado (regex aplicada): ' + JSON.stringify(mockForm));
  
  var s1 = Date.now();
  var result = ResolverEnderecoComCache_(mockForm, 'AGENDA-TEST');
  Logger.log('T1 (' + (Date.now()-s1) +'ms) RES: ' + result.provider);
  Logger.log(JSON.stringify(result));
}
