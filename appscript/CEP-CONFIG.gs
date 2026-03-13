/**
 * Sessão 0.0 – Descrição
 * ----------------------
 *  • Simula a inclusão de um novo destino na rota de entrega
 *  • Gera ranking de datas viáveis e calcula o VALOR DO FRETE
 *  • Registra auditoria com frete comparativo e link do pré-agendamento
 *  • Versão 5.0 08-10-2025
 */

/* ===================================================== */
/* Sessão 1.0 – Variáveis Globais                         */
/* ===================================================== */
var API_KEY = '';
var OSRM_BASE = 'https://router.project-osrm.org'; // default; pode ser trocado por config
var MAPSCO_API_KEY = '';
var LOCATIONIQ_API_KEY = ''; // ✅ Adicionado para suporte LocationIQ
const PROP_STORE      = PropertiesService.getScriptProperties();
const GEO_TTL_S       = 14 * 24 * 3600;     // cache geocode (aumentado para 14d)
const DIST_TTL_S      = 72 * 3600;     // cache distâncias
const LAST_RUN_PROP   = 'LAST_RUN_SIMULATE';
const BR_BBOX  = { left:-73.99, bottom:-33.75, right:-34.79, top:5.27 };

// === BACKEND (Library) – Constantes usadas pelo modal/resultados ===
const PRE_CALENDAR_ID = 'lebebe.com.br_ot8qr0qu24r0a5sni3rc97ero8@group.calendar.google.com';
// Opcional (só para o logo no cabeçalho do modal de resultados)
const PRE_LOGO_URL = 'https://static.wixstatic.com/media/b1fd5e_a646fac4868449aa87093817e95af73a~mv2.png/v1/fill/w_263,h_107,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/b1fd5e_a646fac4868449aa87093817e95af73a~mv2.png';

// === ID da SUA planilha BACKEND (a própria CONFERENCIA AGENDA LEBEBE) ===
const SOURCE_SPREADSHEET_ID = '1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U';

// Helpers de abertura de planilhas
function abrirPlanilhaFonte_(){
  try {
    if (typeof SOURCE_SPREADSHEET_ID === 'string' && SOURCE_SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
    }
  } catch (e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

function abrirPlanilhaFront_(){
  try { return SpreadsheetApp.getActive(); } catch (e) { return SpreadsheetApp.getActiveSpreadsheet(); }
}

// ===== DEBUG / LOG HELPERS =====
const DEBUG = true; // coloque false para silenciar
function dlog(msg){ if (DEBUG) Logger.log(msg); }
function toM(km){ return Math.round((km||0)*1000); }
function fmtM(m){ return toM(m/1000) + ' m'; } // caso receba km por engano
function fmtKm(km){ return (km||0).toFixed(2) + ' km'; }
function fmtBothKmM(km){ return `${fmtM(km*1000)} (${fmtKm(km)})`; }
function isBrazilLatLng(lat, lng){
  return lat<=BR_BBOX.top && lat>=BR_BBOX.bottom && lng>=BR_BBOX.left && lng<=BR_BBOX.right;
}

// ---- Nominatim oficial: desligado para evitar 403 (pode ligar no futuro)
const NOMI_ALLOW_OFFICIAL = false; // true = tenta oficial por último; false = nunca usa

// ----- Brasil / UF helpers -----
const UF_NAMES  = {
  AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia', CE:'Ceará',
  DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão',
  MG:'Minas Gerais', MS:'Mato Grosso do Sul', MT:'Mato Grosso', PA:'Pará',
  PB:'Paraíba', PE:'Pernambuco', PI:'Piauí', PR:'Paraná', RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte', RO:'Rondônia', RR:'Roraima', RS:'Rio Grande do Sul',
  SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo', TO:'Tocantins'
};
// BBox aproximada por UF (PR, SP, SC)
const UF_BBOX = {
  PR: { left:-54.60, bottom:-26.80, right:-48.00, top:-22.50 },
  SP: { left:-53.50, bottom:-25.50, right:-44.00, top:-19.70 },
  SC: { left:-53.84, bottom:-29.40, right:-48.00, top:-25.00 }
};

// Threshold para fallback Google quando confiança < 0.85
const ADDR_GOOGLE_FALLBACK_THRESHOLD = 0.85;

function normalize(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function stateMatchesName(gotState, uf){
  const name = UF_NAMES[uf] || uf;
  return !!gotState && (normalize(gotState).includes(normalize(name)) || normalize(gotState)===normalize(uf));
}
function ensureBrazilAndUF(out, uf){
  if (!out) return null;
  if (!isBrazilLatLng(out.lat, out.lng)) return null;
  if (!out.address) return null;
  const got = out.address.state || out.address.region || out.address['state_district'] || '';
  if (uf && !stateMatchesName(got, uf)) {
    dlog(`[CEP-VALID] rejeitado: UF esperada ${uf} ≠ "${got}"`);
    return null;
  }
  return out;
}

// Normalização canônica de endereço para geração de chave de cache e scoring
function addrNormalizeForKey_(addr, uf){
  let s = String(addr||'').toUpperCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  // remove país e complementos comuns
  s = s.replace(/\b(BRASIL|BRAZIL)\b/g,' ');
  s = s.replace(/\b(APT|APTO|APARTAMENTO|BL|BLOCO|CASA|FUNDOS|FRENTE|SALA(O)?|LOJA|CONJ|CONJUNTO|QD|QUADRA|LT|LOTE|N\.?\s?\d+|NO\.?|NUMERO)\b/g,' ');
  // unifica tipos
  s = s.replace(/\b(AVENIDA)\b/g,'AV');
  s = s.replace(/\b(RUA)\b/g,'R');
  s = s.replace(/\b(RODOVIA)\b/g,'ROD');
  s = s.replace(/\b(ROD\.)\b/g,'ROD');
  s = s.replace(/\b(ALAMEDA)\b/g,'AL');
  s = s.replace(/\b(TRAVESSA)\b/g,'TRAV');
  // limpa pontuações e múltiplos espaços
  s = s.replace(/[^A-Z0-9\s-]/g,' ');
  s = s.replace(/\s+/g,' ').trim();
  if (uf) s += ' ' + String(uf).toUpperCase();
  return s;
}

/** ================= CORE (CEP): versão de dados + caches ================== **/

const CORE_CACHE_TTL_SEC = 6 * 3600; // 6h
const CORE_CACHE = CacheService.getScriptCache();

function _coreNowBRT_() {
  const tz = SpreadsheetApp.getActiveSpreadsheet()?.getSpreadsheetTimeZone() || 'GMT-03:00';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
}

/** Lê cep_config no BACKEND (SOURCE_SPREADSHEET_ID) e retorna "epoch|YYYY-MM-DD HH:mm:ss" */
function getDataVersion_() {
  try {
    const ss = (typeof SOURCE_SPREADSHEET_ID === 'string' && SOURCE_SPREADSHEET_ID)
      ? SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheets().find(s => s.getSheetId() === 718532388) || ss.getSheetByName('cep_config');
    if (!sh) return 'noversion|'+_coreNowBRT_();

    const last = Math.max(1, sh.getLastRow());
    if (last < 1) return 'noversion|'+_coreNowBRT_();

    const colA = sh.getRange(1,1,last,2).getValues(); // A:B
    for (let i=0;i<colA.length;i++){
      const k = String(colA[i][0]).trim().toUpperCase();
      if (k === 'DATA_VERSION') {
        const v = String(colA[i][1] || '').trim();
        return v || 'noversion|'+_coreNowBRT_();
      }
    }
    return 'noversion|'+_coreNowBRT_();
  } catch(e){
    return 'noversion|'+_coreNowBRT_();
  }
}

/** Cache versionado pela DATA_VERSION do backend */
function getVersionedCache_(keyBase, loaderFn, ttlSec = CORE_CACHE_TTL_SEC) {
  const ver = getDataVersion_();             // invalidação global
  const key = `${keyBase}:v=${ver}`;
  const cached = CORE_CACHE.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }
  const fresh = loaderFn();
  try { CORE_CACHE.put(key, JSON.stringify(fresh), ttlSec); } catch(_) {}
  return fresh;
}

/** Cache simples (não versionado) — bom p/ CEP (não depende de planilha) */
function getSimpleCache_(key, loaderFn, ttlSec = CORE_CACHE_TTL_SEC) {
  const cached = CORE_CACHE.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }
  const fresh = loaderFn();
  try { CORE_CACHE.put(key, JSON.stringify(fresh), ttlSec); } catch(_) {}
  return fresh;
}

//caches do CEP
function _cepMonthlyTag_() {
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
  return Utilities.formatDate(new Date(), tz, 'yyyyMM'); // ex.: 202510
}

function _cepCacheKey_(cep8) {
  var month = _cepMonthlyTag_();
  var ufsTag = 'PR,SP,SC';   // mantenha igual ao filtro da busca
  var provV  = 'google-v1';  // se mudar lógica/provider, incremente (invalida tudo)
  return cep8 + ':' + month + ':' + provV + ':' + ufsTag;
}

function _ensureCepCacheSheet_() {
  var ss = abrirPlanilhaFonte_();
  var sh = ss.getSheetByName('CEP_CACHE');
  if (sh) return sh;

  sh = ss.insertSheet('CEP_CACHE');
  sh.getRange(1,1,1,10).setValues([[
    'KEY','CEP','MONTH_TAG','PROVIDER','UFS','DISPLAY','LAT','LNG','ADDRESS_JSON','UPDATED_AT'
  ]]);
  sh.setFrozenRows(1);
  return sh;
}

function _readCepFromL2_(key) {
  var sh = _ensureCepCacheSheet_();
  var tf = sh.createTextFinder(key).matchEntireCell(true);
  var m  = tf.findNext();
  if (!m) return null;

  var r = m.getRow();
  var row = sh.getRange(r,1,1,10).getValues()[0];
  return {
    ok: true,
    cep: row[1],
    monthTag: row[2],
    provider: row[3],
    ufs: row[4],
    display: row[5],
    lat: Number(row[6]||0),
    lng: Number(row[7]||0),
    address: row[8] ? JSON.parse(row[8]) : null
  };
}

function _writeCepToL2_(key, rec) {
  var sh = _ensureCepCacheSheet_();
  var tf = sh.createTextFinder(key).matchEntireCell(true);
  var m  = tf.findNext();

  var payload = [
    key,
    rec.cep || '',
    _cepMonthlyTag_(),
    rec.provider || 'google',
    (rec.ufs && Array.isArray(rec.ufs)) ? rec.ufs.join(',') : (rec.ufs || 'PR,SP,SC'),
    rec.display || '',
    Number(rec.lat || 0),
    Number(rec.lng || 0),
    rec.address ? JSON.stringify(rec.address) : '',
    new Date()
  ];

  if (m) {
    var r = m.getRow();
    sh.getRange(r,1,1,10).setValues([payload]);
  } else {
    sh.appendRow(payload);
  }
}

/** opcional: limpe cache (ex.: manter só últimos N ou últimos M meses) */
function cleanupCepCache_(monthsToKeep, maxRows) {
  monthsToKeep = monthsToKeep || 3;
  maxRows      = maxRows || 10000;

  var sh = _ensureCepCacheSheet_();
  var last = sh.getLastRow();
  if (last <= 1) return;

  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
  var now = new Date();
  var curTag = Utilities.formatDate(now, tz, 'yyyyMM');

  var data = sh.getRange(2,1,last-1,10).getValues(); // sem cabeçalho
  var keep = [];
  for (var i=0;i<data.length;i++){
    var row = data[i];
    var monthTag = String(row[2]||'');
    // mantém este e (monthsToKeep-1) anteriores
    if (monthTag && (curTag >= monthTag) && (Number(curTag) - Number(monthTag) < monthsToKeep)) {
      keep.push(row);
    }
  }
  // corta por tamanho máximo também
  if (keep.length > maxRows-1) {
    keep = keep.slice(keep.length - (maxRows-1));
  }

  sh.clearContents();
  sh.getRange(1,1,1,10).setValues([[
    'KEY','CEP','MONTH_TAG','PROVIDER','UFS','DISPLAY','LAT','LNG','ADDRESS_JSON','UPDATED_AT'
  ]]);
  if (keep.length) sh.getRange(2,1,keep.length,10).setValues(keep);
  sh.setFrozenRows(1);
}


/* ===================================================== */
/* Sessão 2.0 – Utilitário de Config                      */
/* ===================================================== */
function getConfig(prop, sheet) {
  const rows = sheet.getDataRange().getValues();
  for (const [k, v] of rows) {
    if (String(k).trim() === prop) return String(v);
  }
  throw new Error(`Config "${prop}" não encontrada`);
}

/* ===================================================== */
/* Sessão 4.0 – Geocodificação (OSM) & Distâncias (OSRM) */
/* ===================================================== */

// ------- helpers de cache -------
function _addrCacheKey(addr) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(addr).trim());
  const hex = bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  return 'GA:' + hex; // chave curta pro CacheService
}

// ====== RATE LIMIT & PERSIST CACHE ======
const NOMI_MIN_DELAY_MS = 1200;                 // 1.2s entre chamadas (padrão)
const RATE_LIMITS = {
  'nominatim': 1200,
  'nominatim-structured': 1200,
  'osm-addr': 1200,
  'mapsco-addr': 200,
  'mapsco-cep-estrito': 200,
  'photon-addr': 200,
  'photon-cep-estrito': 100,
  'google-addr': 100,
  'google-cep': 100,
  'google-cep-only': 100,
  'OSRM': 50,        // ✅ Reduzido de 100ms para 50ms (servidor próprio osrm.lebebe.cloud)
  'osrm': 50,
  'osrm-public': 900
};
const GEOCEP_PREFIX     = 'GEOCEP:';            // cache persistente p/ CEP
const CACHE_SALT_PROP   = 'CACHE_SALT';         // p/ "estourar" cache de distâncias

function respectRateLimit(ns, minMs) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) { /* segue sem lock se falhar */ }
  try {
    const key = `RL_${ns}`;
    const last = +(PROP_STORE.getProperty(key) || '0');
    const now  = Date.now();
    const delay = (RATE_LIMITS[ns] != null) ? RATE_LIMITS[ns] : (minMs || 100);
    const wait = last + delay - now;
    if (wait > 0) Utilities.sleep(wait + Math.floor(Math.random()*100));
    PROP_STORE.setProperty(key, String(Date.now()));
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function fetchJsonWithHeaders(url, providerName) {
  respectRateLimit(providerName || 'nominatim', RATE_LIMITS[providerName || 'nominatim'] || NOMI_MIN_DELAY_MS);
  let res;
  try {
    res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true,
      headers: {
        'User-Agent': 'LeBebe-AppsScript/4.3-b (contato@lebebe.com.br)',
        'Accept': 'application/json'
      }
    });
  } catch (e) {
    dlog(`[GEOCODE] ERRO de rede (${providerName}) em ${url}\n${e && e.message}`);
    return null; // não derruba sua execução
  }

  const code = res.getResponseCode();
  const body = res.getContentText();
  const ctype = String(res.getHeaders()['Content-Type'] || '');
  if (code !== 200) {
    dlog(`[GEOCODE] HTTP ${code} (${providerName}) em ${url}\n${body.slice(0,180)}...`);
    return null;
  }
  if (ctype.toLowerCase().indexOf('json') === -1 && body.trim().charAt(0) !== '[' && body.trim().charAt(0) !== '{') {
    dlog(`[GEOCODE] Conteúdo não-JSON (${providerName}) em ${url}\n${body.slice(0,180)}...`);
    return null;
  }
  try { return JSON.parse(body); } catch(e) {
    dlog(`[GEOCODE] Falha no JSON.parse (${providerName})\n${body.slice(0,180)}...`);
    return null;
  }
}

// === Fetch com retry específico para HTTP 503 ===
function fetchJson503Retry(url, providerName, maxTries) {
  var tries = Math.max(2, maxTries || 2); // pelo menos 2 tentativas
  for (var i=1; i<=tries; i++){
    try {
      respectRateLimit(providerName || 'nominatim', RATE_LIMITS[providerName || 'nominatim'] || NOMI_MIN_DELAY_MS);
      var res = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: {
          'User-Agent': 'LeBebe-AppsScript/4.3-b (contato@lebebe.com.br)',
          'Accept': 'application/json'
        }
      });
      var code = res.getResponseCode();
      if (code === 503) {
        dlog('['+providerName+'] HTTP 503; retry em 1s ('+i+'/'+tries+')');
        Utilities.sleep(1000);
        continue;
      }
      if (code !== 200) {
        dlog('['+providerName+'] HTTP '+code+' em '+url+' | body: '+String(res.getContentText()).slice(0,180));
        return null;
      }
      var body = res.getContentText();
      try { return JSON.parse(body); } catch(e){ dlog('['+providerName+'] JSON inválido'); return null; }
    } catch (e) {
      dlog('['+providerName+'] exceção de rede: '+(e && e.message));
      // continua o loop para tentar novamente, se houver tentativas restantes
    }
  }
  // se chegou aqui, não conseguiu sucesso
  return null;
}

// ==== OSRM (distância via rota) ====
function cacheKeyCoords(a,b){
  // se coordenadas forem idênticas, retorna indicador de mesma origem
  if (a.lat===b.lat && a.lng===b.lng) return 'SAME';
  // ✅ OTIMIZAÇÃO: 4 decimais (~11m precisão) ao invés de 6 (~11cm) para aumentar cache hits
  // exemplo: D_-25.1235_-49.2346_-25.3457_-49.4568
  return ['D',a.lat.toFixed(4),a.lng.toFixed(4),b.lat.toFixed(4),b.lng.toFixed(4)].join('_');
}

// ✅ NOVA FUNÇÃO: Distância reta (Haversine) para filtro rápido antes de OSRM
function haversineKm(a, b) {
  const R = 6371; // raio da Terra em km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  return R * c;
}

function osrmRouteDistanceKm(base, a, b){
  try{
    const providerName = (String(base).indexOf('router.project-osrm.org')>=0) ? 'osrm-public' : 'OSRM';
    respectRateLimit(providerName, RATE_LIMITS[providerName] || 100);
    const url = `${base}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false`;
    const r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'LeBebe-AppsScript/4.3-b',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    });
    if (r.getResponseCode() !== 200) return null;
    const j = JSON.parse(r.getContentText());
    const route = j && j.routes && j.routes[0];
    if (!route || route.distance==null) return null;
    return (route.distance || 0) / 1000.0;
  }catch(e){ return null; }
}

function getDrivingKm(a,b){
  const cache = CacheService.getScriptCache();
  const key = cacheKeyCoords(a,b);
  const hit = cache.get(key);
  if (hit) return +hit;

  let t0 = Date.now();
  let km = osrmRouteDistanceKm(OSRM_BASE, a, b);
  let d0 = Date.now() - t0;
  dlog(`[OSRM] base=${OSRM_BASE} → ${km!=null?'OK':'FAIL'} em ${d0}ms`);
  if (km != null) { try{ cache.put(key, String(km), DIST_TTL_S); }catch(_){ } return km; }

  const PUBLIC = 'https://router.project-osrm.org';
  if ((OSRM_BASE||'').indexOf('router.project-osrm.org') === -1){
    let t1 = Date.now();
    km = osrmRouteDistanceKm(PUBLIC, a, b);
    let d1 = Date.now() - t1;
    dlog(`[OSRM] público=${PUBLIC} → ${km!=null?'OK':'FAIL'} em ${d1}ms`);
    if (km != null) { try{ cache.put(key, String(km), DIST_TTL_S); }catch(_){ } return km; }
  }

  const hk = haversine(a.lat,a.lng,b.lat,b.lng);
  try{ cache.put(key, String(hk), DIST_TTL_S); }catch(_){ }
  return hk;
}

/**
 * ✅ NOVA: Calcula distâncias OSRM em paralelo (batch)
 * Reduz tempo de 67 chamadas sequenciais (~35s) para batch paralelo (~5-8s)
 * @param {Array<{from: {lat,lng}, to: {lat,lng}}>} routes - Array de rotas
 * @returns {Array<number>} - Array de distâncias em km (mesma ordem do input)
 */
function getDrivingKmBatch(routes) {
  if (!routes || !routes.length) return [];
  
  const cache = CacheService.getScriptCache();
  const results = new Array(routes.length);
  const requests = [];
  const requestIndexes = [];
  
  // 1. Verificar cache primeiro (evita chamadas desnecessárias)
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    if (!r || !r.from || !r.to) {
      results[i] = 0;
      continue;
    }
    
    const key = cacheKeyCoords(r.from, r.to);
    
    if (key === 'SAME') {
      results[i] = 0;
      continue;
    }
    
    const hit = cache.get(key);
    if (hit) {
      results[i] = +hit;
      continue;
    }
    
    // Precisa buscar OSRM
    const url = `${OSRM_BASE}/route/v1/driving/${r.from.lng},${r.from.lat};${r.to.lng},${r.to.lat}?overview=false&alternatives=false&steps=false`;
    requests.push({
      url: url,
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'LeBebe-AppsScript/4.3-b',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    });
    requestIndexes.push(i);
  }
  
  // 2. Se não há requisições pendentes, retorna (tudo veio do cache)
  if (requests.length === 0) {
    dlog(`[OSRM-BATCH] ✅ Todas as ${routes.length} rotas vieram do cache`);
    return results;
  }
  
  // 3. Fazer batch com UrlFetchApp.fetchAll() em chunks (evita rate limit)
  const BATCH_SIZE = 20; // Máximo de 20 requisições paralelas por vez
  const allResponses = [];
  const t0 = Date.now();
  
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    try {
      const chunkResponses = UrlFetchApp.fetchAll(chunk);
      allResponses.push(...chunkResponses);
      
      // Pequena pausa entre chunks para respeitar rate limit
      if (i + BATCH_SIZE < requests.length) {
        Utilities.sleep(50);
      }
    } catch(e) {
      dlog(`[OSRM-BATCH] Erro no chunk ${i}-${i+BATCH_SIZE}: ${e && e.message}`);
      // Preenche com nulls para manter índices corretos
      for (let j = 0; j < chunk.length; j++) {
        allResponses.push(null);
      }
    }
  }
  
  const dt = Date.now() - t0;
  const avgPerRoute = requests.length > 0 ? (dt / requests.length).toFixed(0) : 0;
  dlog(`[OSRM-BATCH] ${requests.length} rotas em ${dt}ms (${avgPerRoute}ms/rota, ${routes.length - requests.length} do cache)`);
  
  // 4. Processar respostas e popular resultados
  for (let i = 0; i < allResponses.length; i++) {
    const res = allResponses[i];
    const idx = requestIndexes[i];
    const r = routes[idx];
    const key = cacheKeyCoords(r.from, r.to);
    
    if (!res) {
      // Erro na requisição, usar Haversine
      const hk = haversineKm(r.from, r.to);
      results[idx] = hk;
      try { cache.put(key, String(hk), DIST_TTL_S); } catch(_) {}
      continue;
    }
    
    try {
      if (res.getResponseCode() === 200) {
        const j = JSON.parse(res.getContentText());
        const route = j && j.routes && j.routes[0];
        if (route && route.distance != null) {
          const km = (route.distance || 0) / 1000.0;
          results[idx] = km;
          try { cache.put(key, String(km), DIST_TTL_S); } catch(_) {}
          continue;
        }
      }
    } catch(e) {
      dlog(`[OSRM-BATCH] Erro ao processar rota ${idx}: ${e && e.message}`);
    }
    
    // Fallback: Haversine
    const hk = haversineKm(r.from, r.to);
    results[idx] = hk;
    try { cache.put(key, String(hk), DIST_TTL_S); } catch(_) {}
  }
  
  return results;
}

function osrmHealthWarmup(){
  try{
    respectRateLimit('OSRM', RATE_LIMITS['OSRM']||100);
    const r = UrlFetchApp.fetch(OSRM_BASE.replace(/\/$/,'') + '/health', {
      muteHttpExceptions: true,
      headers: { 'User-Agent':'LeBebe-AppsScript/4.3-b', 'ngrok-skip-browser-warning':'true' }
    });
    Logger.log('[OSRM] /health %s → %s', OSRM_BASE, r.getResponseCode());
  }catch(e){ Logger.log('[OSRM] /health falhou: ' + (e && e.message)); }
}

function warmUpCepCache(locNovo, slots, DEPOSIT_ADDRESS, HOME_SAT_E1, HOME_SAT_E2){
  try{
    const origins = [];
    try{ const d = geocodeAddressFree(DEPOSIT_ADDRESS); if (d) origins.push(d); }catch(_){ }
    try{ const h1 = geocodeAddressFree(HOME_SAT_E1);   if (h1) origins.push(h1); }catch(_){ }
    try{ const h2 = geocodeAddressFree(HOME_SAT_E2);   if (h2) origins.push(h2); }catch(_){ }

    // ✅ OTIMIZADO: Coletar todas as rotas primeiro, depois processar em batch
    const allRoutes = [];
    
    // Rotas de origens fixas → destino novo
    const seen = new Set();
    origins.forEach(o=>{
      const k = `${Number(o.lat).toFixed(5)},${Number(o.lng).toFixed(5)}`;
      if (seen.has(k)) return; 
      seen.add(k);
      allRoutes.push({ from: o, to: locNovo });
    });

    // Rotas de todos os pontos agendados → destino novo
    (slots||[]).forEach(s=>{
      (s.pontos||[]).forEach(p=>{
        if (p && p.loc) {
          allRoutes.push({ from: p.loc, to: locNovo });
        }
      });
    });
    
    // Executar tudo em batch (paralelo)
    if (allRoutes.length > 0) {
      dlog(`[WARMUP] Aquecendo ${allRoutes.length} rotas em batch...`);
      getDrivingKmBatch(allRoutes);
      dlog(`[WARMUP] ✅ Cache aquecido`);
    }
  }catch(e){ dlog('[WARMUP] erro: ' + (e && e.message)); }
}

// ===== Descobre UF no texto do endereço (ex.: "Curitiba-PR") =====
function pickUFFromText(addr, fallbackUF){
  const m = String(addr||'').toUpperCase().match(/\b(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\b/);
  return m ? m[1] : (fallbackUF || 'PR');
}

// ===== Geocode de ENDEREÇO: maps.co → Photon → (opcional) Nominatim =====
// ===== Address Cache L2 (ADDR_CACHE) =====
function _ensureAddrCacheSheet_(){
  var ss = abrirPlanilhaFonte_();
  var sh = ss.getSheetByName('ADDR_CACHE');
  if (sh) return sh;
  sh = ss.insertSheet('ADDR_CACHE');
  sh.getRange(1,1,1,10).setValues([[
    'KEY','RAW','NORM_KEY','UF_HINT','DISPLAY','LAT','LNG','PROVIDER','CONF_SCORE','UPDATED_AT'
  ]]);
  sh.setFrozenRows(1);
  return sh;
}

function _readAddrFromL2_(normKey){
  try{
    var sh = _ensureAddrCacheSheet_();
    var last = sh.getLastRow(); if (last<=1) return null;
    var rng = sh.getRange(2,3,last-1,1); // coluna C = NORM_KEY
    var tf  = rng.createTextFinder(String(normKey)).matchEntireCell(true);
    var m   = tf.findNext();
    if (!m) return null;
    var r = m.getRow();
    var row = sh.getRange(r,1,1,10).getValues()[0];
    return {
      raw: row[1], normKey: row[2], uf: row[3], display: row[4],
      lat: Number(row[5]||0), lng: Number(row[6]||0), provider: row[7]||'', conf: Number(row[8]||0)
    };
  }catch(e){ return null; }
}

function _writeAddrToL2_(normKey, raw, uf, display, lat, lng, provider, conf){
  try{
    var sh = _ensureAddrCacheSheet_();
    var last = Math.max(2, sh.getLastRow()+1);
    var payload = [
      String(normKey), String(raw||''), String(normKey), String(uf||''), String(display||''),
      Number(lat||0), Number(lng||0), String(provider||''), Number(conf||0), new Date()
    ];
    sh.appendRow(payload);
  }catch(e){}
}

function _addressConfidenceScore_(out, uf, qNorm){
  if (!out || out.lat==null || out.lng==null) return 0;
  let score = 0;
  if (isBrazilLatLng(out.lat, out.lng)) score += 0.35;
  // UF match (quando disponível)
  try { if (ensureBrazilAndUF(out, uf)) score += 0.35; } catch(_){ }
  // CEP no texto (se houver)
  const cep8 = (String(qNorm||'').match(/\b(\d{8})\b/)||[])[1];
  if (cep8 && out.address && String(out.address.postcode||'').replace(/\D/g,'')===cep8) score += 0.15;
  // tokens do endereço presentes no display
  try{
    const disp = String(out.display_name||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const toks = String(qNorm||'').split(/\s+/).filter(w=>w.length>=4);
    let hits=0; toks.forEach(t=>{ if (disp.indexOf(t)>=0) hits++; });
    if (hits>=2) score += 0.15; else if (hits===1) score += 0.08;
  }catch(_){ }
  return Math.min(1, score);
}

function geocodeAddressGoogle(addr, ufHint){
  if (!API_KEY) return null;
  const comps = ['country:BR'];
  if (ufHint) comps.push('administrative_area:'+String(ufHint).toUpperCase());
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
    + '?address=' + encodeURIComponent(String(addr))
    + '&components=' + encodeURIComponent(comps.join('|'))
    + '&language=pt-BR'
    + '&key=' + encodeURIComponent(API_KEY);
  const j = fetchJsonWithHeaders(url, 'google-addr');
  if (!j || j.status!=='OK' || !j.results || !j.results.length) return null;
  const r = j.results[0];
  const loc = r.geometry && r.geometry.location;
  if (!loc || typeof loc.lat!=='number' || typeof loc.lng!=='number') return null;
  const compsArr = r.address_components||[];
  function pick(type){ const c = compsArr.find(x=>(x.types||[]).indexOf(type)>=0); return c ? {long:c.long_name, short:c.short_name} : null; }
  const ufC = pick('administrative_area_level_1');
  const out = {
    lat: loc.lat, lng: loc.lng,
    display_name: r.formatted_address || String(addr),
    address: { state: (ufC && (ufC.long||ufC.short)) || '' },
    provider: 'google'
  };
  return out;
}

function geocodeAddressOSM(addr){
  const cache = CacheService.getScriptCache();
  const uf = pickUFFromText(addr, 'PR');
  const ufName = UF_NAMES[uf] || uf;
  const bbox = UF_BBOX[uf] || BR_BBOX;
  const q = `${String(addr).trim()}, Brasil`;
  const normKey = addrNormalizeForKey_(addr, uf);
  const k = _addrCacheKey(normKey);

  // L1
  const hit = cache.get(k);
  if (hit) return JSON.parse(hit);
  // L2
  const l2 = _readAddrFromL2_(normKey);
  if (l2 && l2.lat && l2.lng){
    cache.put(k, JSON.stringify({lat:l2.lat,lng:l2.lng}), GEO_TTL_S);
    return { lat:l2.lat, lng:l2.lng };
  }

  // Provedores gratuitos em paralelo (maps.co + Photon)
  const mapscoKey = (typeof MAPSCO_API_KEY!=='undefined' && MAPSCO_API_KEY) ? `&api_key=${encodeURIComponent(MAPSCO_API_KEY)}` : '';
  const reqs = [
    {
      url: 'https://geocode.maps.co/search'
        + '?format=jsonv2&limit=3&addressdetails=1&accept-language=pt-BR&countrycodes=br'
        + '&bounded=1&viewbox=' + [bbox.left,bbox.top,bbox.right,bbox.bottom].join(',')
        + '&q=' + encodeURIComponent(q)
        + mapscoKey,
      muteHttpExceptions:true, followRedirects:true, validateHttpsCertificates:true,
      headers:{'User-Agent':'LeBebe-AppsScript/4.3-b','Accept':'application/json'}
    },
    {
      url: 'https://photon.komoot.io/api/'
        + '?limit=3&bbox=' + [bbox.left,bbox.bottom,bbox.right,bbox.top].join(',')
        + '&q=' + encodeURIComponent(q),
      muteHttpExceptions:true, followRedirects:true, validateHttpsCertificates:true,
      headers:{'User-Agent':'LeBebe-AppsScript/4.3-b','Accept':'application/json'}
    }
  ];
  let cands = [];
  try{
    const res = UrlFetchApp.fetchAll(reqs);
    // maps.co
    try{
      const r0 = res[0]; if (r0.getResponseCode()===200){
        const arr = JSON.parse(r0.getContentText('UTF-8'))||[];
        arr.slice(0,3).forEach(o=>{
          const out = { lat:+o.lat, lng:+o.lon, address:o.address||{state:ufName}, display_name:o.display_name, provider:'maps.co' };
          const conf = _addressConfidenceScore_(out, uf, normKey);
          if (ensureBrazilAndUF(out, uf)) cands.push({out, conf});
        });
      }
    }catch(_){ }
    // photon
    try{
      const r1 = res[1]; if (r1.getResponseCode()===200){
        const ph = JSON.parse(r1.getContentText('UTF-8'))||{};
        (ph.features||[]).slice(0,3).forEach(f=>{
          const coords = (f.geometry && f.geometry.coordinates) || [null,null];
          const [lon,lat] = coords; if (lat==null||lon==null) return;
          const out = { lat:+lat, lng:+lon, address:{state:ufName}, display_name:(f.properties&&f.properties.name)||String(addr), provider:'photon' };
          const conf = _addressConfidenceScore_(out, uf, normKey);
          if (ensureBrazilAndUF(out, uf)) cands.push({out, conf});
        });
      }
    }catch(_){ }
  }catch(e){ dlog('[GEO] fetchAll err: ' + (e && e.message)); }

  // Escolhe melhor candidato
  cands.sort((a,b)=>b.conf-a.conf);
  const best = cands[0];
  if (best && best.conf >= ADDR_GOOGLE_FALLBACK_THRESHOLD){
    cache.put(k, JSON.stringify({lat:best.out.lat,lng:best.out.lng}), GEO_TTL_S);
    _writeAddrToL2_(normKey, addr, uf, best.out.display_name||'', best.out.lat, best.out.lng, best.out.provider||'', best.conf);
    dlog(`[GEO] BEST(${best.out.provider}) conf=${best.conf.toFixed(2)} → (${best.out.lat.toFixed(6)},${best.out.lng.toFixed(6)})`);
    return { lat: best.out.lat, lng: best.out.lng };
  }

  // Fallback Google se disponível e abaixo do threshold
  if (API_KEY){
    const g = geocodeAddressGoogle(addr, uf);
    if (g){
      const conf = _addressConfidenceScore_(g, uf, normKey);
      cache.put(k, JSON.stringify({lat:g.lat,lng:g.lng}), GEO_TTL_S);
      _writeAddrToL2_(normKey, addr, uf, g.display_name||'', g.lat, g.lng, g.provider||'google', conf);
      dlog(`[GEO] GOOGLE fallback conf=${conf.toFixed(2)} → (${g.lat.toFixed(6)},${g.lng.toFixed(6)})`);
      return { lat:g.lat, lng:g.lng };
    }
  }

  // Se não tem Google, retorna somente se tiver um candidato razoável (>=0.75)
  if (best && best.conf >= 0.75){
    cache.put(k, JSON.stringify({lat:best.out.lat,lng:best.out.lng}), GEO_TTL_S);
    _writeAddrToL2_(normKey, addr, uf, best.out.display_name||'', best.out.lat, best.out.lng, best.out.provider||'', best.conf);
    return { lat: best.out.lat, lng: best.out.lng };
  }

  dlog('[GEO] Falha/baixa confiança nos provedores (endereço).');
  return null;
}

// Alias para manter compatibilidade
function geocodeAddress(addr){ return geocodeAddressOSM(addr); }
function geocodeAddressFree(addr){ return geocodeAddressOSM(addr); }

// ===== Persist Cache (Script Properties) =====
function pget(key) {
  try {
    const raw = PROP_STORE.getProperty(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj.exp && Date.now() > obj.exp) {
      PROP_STORE.deleteProperty(key);
      return null;
    }
    return obj ? obj.val : null;
  } catch (e) {
    return null;
  }
}

function pset(key, val, ttlSec) {
  const obj = { val: val, exp: ttlSec ? (Date.now() + ttlSec * 1000) : null };
  PROP_STORE.setProperty(key, JSON.stringify(obj));
}

/* ===== Sessão 4.1 – ViaCEP (descobre UF + cidade pelo CEP) ===== */
function _viaCepLookup_(cep8){
  try{
    const url = 'https://viacep.com.br/ws/'+cep8+'/json/';
    const resp = UrlFetchApp.fetch(url, {muteHttpExceptions:true, headers:{'User-Agent':'AppsScript-LeBebe/1.0'}});
    if (resp.getResponseCode() !== 200) return null;
    const j = JSON.parse(resp.getContentText('UTF-8'));
    if (!j || j.erro) return null;
    return { logradouro:j.logradouro||'', bairro:j.bairro||'', cidade:j.localidade||'', uf:(j.uf||'').toUpperCase() };
  }catch(e){ return null; }
}


/* ===== Sessão 4.2 – Geocode CEP (ViaCEP + maps.co + Photon com UF fixo) ===== */

// fallback simples para obter UF/cidade quando o ViaCEP não retorna
function _brasilApiLookup_(cep8){
  try{
    const url = 'https://brasilapi.com.br/api/cep/v2/'+cep8;
    const resp = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    if (resp.getResponseCode() !== 200) return null;
    const j = JSON.parse(resp.getContentText('UTF-8'));
    if (!j) return null;
    return { logradouro:j.street||'', bairro:j.neighborhood||'', cidade:j.city||'', uf:(j.state||'').toUpperCase() };
  }catch(e){ return null; }
}

function _anchorForCep_(cep8){
  try{
    const reqs = [
      { url: 'https://viacep.com.br/ws/'+cep8+'/json/',     name: 'viacep'    },
      { url: 'https://brasilapi.com.br/api/cep/v2/'+cep8,   name: 'brasilapi' }
    ].map(r => ({
      url: r.url,
      muteHttpExceptions: true,
      headers: { 'User-Agent':'AppsScript-LeBebe/1.0' }
    }));

    const res = UrlFetchApp.fetchAll(reqs);

    // ViaCEP (res[0])
    try{
      const r0 = res[0];
      if (r0.getResponseCode() === 200) {
        const j = JSON.parse(r0.getContentText('UTF-8'));
        if (j && !j.erro) {
          return { logradouro:j.logradouro||'', bairro:j.bairro||'', cidade:j.localidade||'', uf:(j.uf||'').toUpperCase() };
        }
      }
    }catch(_){}

    // BrasilAPI (res[1])
    try{
      const r1 = res[1];
      if (r1.getResponseCode() === 200) {
        const j = JSON.parse(r1.getContentText('UTF-8'));
        if (j) {
          return { logradouro:j.street||'', bairro:j.neighborhood||'', cidade:j.city||'', uf:(j.state||'').toUpperCase() };
        }
      }
    }catch(_){}

    return null;
  }catch(e){
    return null;
  }
}

// ===== Geocode CEP via Google (usado só no CEP inicial A2 como fallback) =====
function geocodeCepGoogle(cepRaw, anchorUF, anchorCity){
  const cep = String(cepRaw).replace(/\D/g,'');
  if (!cep || cep.length!==8 || !API_KEY) return null;

  // montamos query somente com components (postal_code + país BR)
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
            + '?components=' + encodeURIComponent('country:BR|postal_code:'+cep)
            + '&key=' + encodeURIComponent(API_KEY);

  const j = fetchJsonWithHeaders(url, 'google-cep');
  if (!j || j.status!=='OK' || !j.results || !j.results.length) return null;

  const res   = j.results[0];
  const comps = res.address_components || [];

  function pick(type){
    const c = comps.find(x => (x.types||[]).indexOf(type)>=0);
    return c ? { long:c.long_name, short:c.short_name } : null;
  }

  const pc      = pick('postal_code');
  const country = pick('country');
  if (!pc || pc.short.replace(/\D/g,'') !== cep) return null;     // exige CEP exato
  if (!country || country.short!=='BR') return null;              // exige Brasil

  const ufC   = pick('administrative_area_level_1'); // ex.: PR / Paraná
  const cityC = pick('locality') || pick('administrative_area_level_2') || pick('sublocality');

  // Se veio uma âncora (ViaCEP/BrasilAPI), valida UF/cidade também
  if (anchorUF && ufC && anchorUF.toUpperCase() !== String(ufC.short||'').toUpperCase()) return null;
  if (anchorCity && cityC && normalize(cityC.long) !== normalize(anchorCity)) return null;

  const lat = res.geometry && res.geometry.location && res.geometry.location.lat;
  const lng = res.geometry && res.geometry.location && res.geometry.location.lng;
  if (lat==null || lng==null) return null;

  const ufName = ufC ? (ufC.long || ufC.short || '') : '';
  const out = {
    lat: +lat,
    lng: +lng,
    display_name: res.formatted_address || (`CEP ${cep}`),
    address: {
      city:  cityC ? (cityC.long || '') : '',
      state: ufName,                   // "Paraná" (ou "PR" se não vier long_name)
      postcode: cep
    },
    provider: 'google'
  };
  dlog(`[GOOGLE] CEP OK → ${out.display_name} (${out.lat},${out.lng})`);
  return out;
}

/**
 * Geocode de CEP usando SOMENTE Google, estrito a:
 *  - country: BR
 *  - postal_code == CEP informado
 *  - UF ∈ {PR, SP, SC} (se allowedUFs informado)
 * Retorna {lat,lng,display_name,address,provider:'google'} ou null.
 */
function geocodeCepGoogleStrict(cepRaw, allowedUFs) {
  var cep = String(cepRaw).replace(/\D/g,'');
  if (cep.length !== 8) return null;
  if (!API_KEY) { dlog('[GOOGLE] API_KEY ausente'); return null; }

  // retry leve em caso de glitch momentâneo
  var tries = 2, j = null;
  for (var t=1; t<=tries; t++){
    var url = 'https://maps.googleapis.com/maps/api/geocode/json'
            + '?components=' + encodeURIComponent('country:BR|postal_code:'+cep)
            + '&key=' + encodeURIComponent(API_KEY);
    j = fetchJsonWithHeaders(url, 'google-cep-only');
    if (j && j.status === 'OK') break;
    if (t < tries) Utilities.sleep(800);
  }
  if (!j || j.status !== 'OK' || !j.results || !j.results.length) {
    dlog('[GOOGLE-STRICT] FAIL status=' + (j && j.status) + ' msg=' + (j && j.error_message));
    return null;
  }

  // escolhe o resultado que tenha types mais específicos (postal_code / street_address) primeiro
  var best = j.results.find(function(r){ return (r.types||[]).indexOf('postal_code')>=0; })
         || j.results.find(function(r){ return (r.types||[]).indexOf('street_address')>=0; })
         || j.results[0];

  var comps = best.address_components || [];
  function pick(type){
    var c = comps.find(function(x){ return (x.types||[]).indexOf(type)>=0; });
    return c ? { long:c.long_name, short:c.short_name } : null;
  }

  var pc      = pick('postal_code');
  var country = pick('country');
  var ufC     = pick('administrative_area_level_1');
  var cityC   = pick('locality') || pick('administrative_area_level_2') || pick('sublocality');

  // validações estritas
  if (!pc || pc.short.replace(/\D/g,'') !== cep) return null;
  if (!country || country.short !== 'BR')        return null;

  if (Array.isArray(allowedUFs) && allowedUFs.length){
    var ufShort = (ufC && ufC.short) ? ufC.short.toUpperCase() : '';
    if (!ufShort || allowedUFs.indexOf(ufShort) === -1) return null;
  }

  var loc = best.geometry && best.geometry.location;
  if (!loc || typeof loc.lat!=='number' || typeof loc.lng!=='number') return null;

  var out = {
    lat: loc.lat,
    lng: loc.lng,
    display_name: best.formatted_address || ('CEP '+cep),
    address: {
      city:  cityC ? (cityC.long || '') : '',
      state: ufC ? (ufC.long || ufC.short || '') : '',
      postcode: cep
    },
    provider: 'google'
  };
  dlog('[GOOGLE] CEP ONLY OK → ' + out.display_name + ' ('+out.lat+','+out.lng+')');
  return out;
}


function _nominatimByStructured_(cep8, anc){
  // anc: { logradouro, bairro, cidade, uf }
  if (!cep8 || !anc) return null;

  // Monta UF por extenso para o Nominatim
  var uf = String(anc.uf || '').toUpperCase();
  var ufName = UF_NAMES[uf] || uf; // ex.: PR -> "Paraná"

  // Tenta tanto sem hífen quanto com hífen
  var cepHyphen = cep8.replace(/(\d{5})(\d{3})/, '$1-$2');

  // Separa rua/bairro em campos apropriados
  var street = String(anc.logradouro || '').trim();
  var suburb = String(anc.bairro || '').trim();
  var city   = String(anc.cidade || '').trim();

  // BBox por UF para reduzir ambiguidades
  var bbox = UF_BBOX[uf] || BR_BBOX;
  var viewbox = [bbox.left,bbox.top,bbox.right,bbox.bottom].join(',');

  // helper para chamar
  function call(struct){
    var base = 'https://nominatim.openstreetmap.org/search';
    var qs = [
      'format=jsonv2',
      'addressdetails=1',
      'accept-language=pt-BR',
      'limit=1',
      'countrycodes=br',
      'bounded=1',
      'viewbox=' + encodeURIComponent(viewbox)
    ];
    if (struct.postalcode) qs.push('postalcode=' + encodeURIComponent(struct.postalcode));
    if (city)   qs.push('city='   + encodeURIComponent(city));
    if (ufName) qs.push('state='  + encodeURIComponent(ufName));
    if (street) qs.push('street=' + encodeURIComponent(street + (suburb ? (', ' + suburb) : '')));

    var url = base + '?' + qs.join('&');
    try{
      respectRateLimit('NOMI', NOMI_MIN_DELAY_MS);
      var resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions:true,
        headers:{ 'User-Agent':'AppsScript-LeBebe/1.0', 'Accept':'application/json' }
      });
      if (resp.getResponseCode() !== 200) {
        dlog('[NOMI] erro estruturado: Endereço não disponível: ' + url);
        return null;
      }
      var arr = JSON.parse(resp.getContentText('UTF-8'));
      if (!Array.isArray(arr) || !arr.length) return null;
      var o = arr[0];
      return {
        lat:+o.lat, lng:+o.lon,
        display_name:o.display_name,
        address:o.address || {},
        provider:'nominatim-structured'
      };
    }catch(e){
      dlog('[NOMI] exceção estruturado: ' + e);
      return null;
    }
  }

  // 1ª tentativa: CEP sem hífen
  var r1 = call({ postalcode: cep8 });
  if (r1 && _hasStrictPostcode(r1, cep8)) return r1;

  // 2ª tentativa: CEP com hífen
  var r2 = call({ postalcode: cepHyphen });
  if (r2 && _hasStrictPostcode(r2, cep8)) return r2;

  // 3ª tentativa: relaxa (sem street), ainda ancorado em cidade/UF + CEP
  var r3 = (function(){
    var base = 'https://nominatim.openstreetmap.org/search';
    var q = [
      'format=jsonv2','addressdetails=1','accept-language=pt-BR','limit=1',
      'countrycodes=br','bounded=1','viewbox=' + encodeURIComponent(viewbox),
      'q=' + encodeURIComponent(cepHyphen + ' ' + city + ' ' + ufName + ' Brasil')
    ];
    var url = base + '?' + q.join('&');
    try{
      respectRateLimit('NOMI', NOMI_MIN_DELAY_MS);
      var resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions:true,
        headers:{ 'User-Agent':'AppsScript-LeBebe/1.0', 'Accept':'application/json' }
      });
      if (resp.getResponseCode() !== 200) return null;
      var arr = JSON.parse(resp.getContentText('UTF-8'));
      if (!Array.isArray(arr) || !arr.length) return null;
      var o = arr[0];
      return {
        lat:+o.lat, lng:+o.lon,
        display_name:o.display_name,
        address:o.address || {},
        provider:'nominatim-q-relaxed'
      };
    }catch(e){ return null; }
  })();

  if (r3 && (_hasStrictPostcode(r3, cep8)
          ||  _stateMatchesName(r3.address && r3.address.state, uf) )) {
    return r3;
  }

  return null;
}

function geocodeCepNominatim(cepRaw){
  var cep8 = String(cepRaw).replace(/\D/g,'');
  if (cep8.length !== 8) return null;

  // ---------- cache persistente (14d) + volátil (6h)
  var CKp = GEOCEP_PREFIX + cep8;
  var hitP = pget(CKp); if (hitP) return hitP;
  var cache = CacheService.getScriptCache();
  var CKv = 'NOMI:' + cep8;
  var hitV = cache.get(CKv); if (hitV) { try { return JSON.parse(hitV); } catch(e){} }

  // ---------- 0) ÂNCORA: ViaCEP → BrasilAPI (UF/cidade/rua/bairro)
  const tA = Date.now();
  var anc = _anchorForCep_(cep8);
  Logger.log('[ANCHOR] %s em %dms', cep8, Date.now()-tA);

  if (!anc) {
    anc = _viaCepLookup_(cep8) || _brasilApiLookup_(cep8);
  }

  var anchorUF   = anc && anc.uf ? String(anc.uf).toUpperCase() : null;
  var anchorCity = anc && anc.cidade ? String(anc.cidade) : null;

  var ALLOWED = new Set(['PR','SP','SC']);
  if (!anchorUF || !ALLOWED.has(anchorUF)) {
    dlog('[CEP-ANCHOR] UF fora de escopo ou ausente: ' + (anchorUF||'(desconhecida)'));
    return null;
  }

  // ---------- 0.1) Sem cidade conhecida: tente Google direto (components=postal_code)
  if (!anchorCity) {
    if (API_KEY) {
      var outG0 = geocodeCepGoogle(cep8.replace(/(\d{5})(\d{3})/,'$1-$2'), null, null);
      if (outG0) {
        cache.put(CKv, JSON.stringify(outG0), 6*3600);
        pset(CKp, outG0, 14*24*3600);
        return outG0;
      }
    }
    dlog('[CEP-ANCHOR] Sem cidade; sem sucesso no Google. Abortando.');
    return null;
  }

  // =========================================
  // Sessão P1 – geocodeCepNominatim: respeitar NOMI_ALLOW_OFFICIAL
  // =========================================

  // ---------- 1) Nominatim (OFICIAL) – só se NOMI_ALLOW_OFFICIAL = true
  if (NOMI_ALLOW_OFFICIAL) {
    try {
      var q = {
        format:'jsonv2',
        addressdetails:'1',
        'accept-language':'pt-BR',
        limit:'1',
        countrycodes:'br',
        postalcode: cep8,
        city: anchorCity,
        // ⚠️ Aqui estava anchorUF (PR). Melhor usar nome por extenso quando possível:
        state: (UF_NAMES[anchorUF] || anchorUF),
        street: [anc.logradouro||'', anc.bairro||''].filter(Boolean).join(', ')
      };

      var uN = 'https://nominatim.openstreetmap.org/search?' + Object.keys(q)
        .map(function(k){ return k+'='+encodeURIComponent(q[k]); })
        .join('&');

      var arrN = fetchJson503Retry(uN, 'nominatim-structured', 2);

      // Se vier 403, loga claro e segue para próximos provedores
      // (fetchJson503Retry já devolve null em http != 200, então aqui é só "sem resultado")
      if (arrN && arrN.length) {
        var oN = arrN[0];
        var pcN = String(oN && oN.address && oN.address.postcode || '').replace(/\D/g,'');
        if (pcN === cep8) {
          var outN = { lat:+oN.lat, lng:+oN.lon, display_name:oN.display_name, address:oN.address, provider:'nominatim' };
          cache.put(CKv, JSON.stringify(outN), 6*3600);
          pset(CKp, outN, 14*24*3600);
          dlog('[NOMI] Estruturado OK ('+anchorUF+') → ' + outN.display_name);
          return outN;
        } else {
          dlog('[NOMI] descartado: postcode "'+(pcN||'-')+'" ≠ '+cep8);
        }
      }
    } catch (e) {
      dlog('[NOMI] exceção estruturado: ' + (e && e.message));
    }
  } else {
    dlog('[NOMI] SKIP: NOMI_ALLOW_OFFICIAL=false (evitando 403 do Nominatim oficial)');
  }
  // ---------- 2) maps.co – estrito (postcode deve bater). Usa retry 503.
  try{
    var uM = 'https://geocode.maps.co/search'
           + '?format=jsonv2&limit=1&addressdetails=1&accept-language=pt-BR&countrycodes=br'
           + '&postalcode=' + encodeURIComponent(cep8)
           + '&city=' + encodeURIComponent(anchorCity)
           + '&state=' + encodeURIComponent(anchorUF);
    var uP = 'https://photon.komoot.io/api/'
           + '?limit=1&q=' + encodeURIComponent(cep8 + ' ' + anchorCity + ' ' + anchorUF + ' Brasil');

    var reqs = [
      { url:uM, muteHttpExceptions:true, headers:{'User-Agent':'LeBebe-AppsScript/4.3-b','Accept':'application/json'} },
      { url:uP, muteHttpExceptions:true, headers:{'User-Agent':'LeBebe-AppsScript/4.3-b','Accept':'application/json'} }
    ];
    var res = UrlFetchApp.fetchAll(reqs);

    // analisar maps.co primeiro
    try{
      var r0 = res[0];
      if (r0.getResponseCode()===200){
        var arrM = JSON.parse(r0.getContentText('UTF-8'))||[];
        if (arrM.length){
          var oM = arrM[0];
          var pcM = String(oM && oM.address && oM.address.postcode || '').replace(/\D/g,'');
          if (pcM === cep8){
            var outM = { lat:+oM.lat, lng:+oM.lon, display_name:oM.display_name, address:oM.address, provider:'maps.co' };
            cache.put(CKv, JSON.stringify(outM), 6*3600);
            pset(CKp, outM, 14*24*3600);
            dlog('[MAPS.CO] CEP estrito OK ('+anchorUF+') → ' + outM.display_name);
            return outM;
          }
        }
      }
    }catch(_){ }

    // analisar Photon
    try{
      var r1 = res[1];
      if (r1.getResponseCode()===200){
        var ph = JSON.parse(r1.getContentText('UTF-8'))||{};
        if (ph.features && ph.features.length){
          var f = ph.features[0], props = f.properties || {};
          var pcP = String(props.postcode||'').replace(/\D/g,'');
          if (pcP === cep8){
            var coords = (f.geometry && f.geometry.coordinates) || [null,null];
            var lon = coords[0], lat = coords[1];
            if (lat != null && lon != null){
              var outP = { lat:+lat, lng:+lon, display_name:(props.name||('CEP '+cep8)), address:{postcode:props.postcode||''}, provider:'photon' };
              cache.put(CKv, JSON.stringify(outP), 6*3600);
              pset(CKp, outP, 14*24*3600);
              dlog('[PHOTON] CEP estrito OK ('+anchorUF+') → ' + outP.display_name);
              return outP;
            }
          }
        }
      }
    }catch(_){ }
  }catch(e){ dlog('[CEP-STRICT] paralelos erro: '+(e && e.message)); }

  // Nenhum resultado até aqui
  return null;
}

function getSlots(sh, minMin, lookDays, startDate, endDate){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const start = startDate ? new Date(+startDate) : hoje;
  const max   = endDate   ? new Date(+endDate)   : new Date(hoje.getTime()+lookDays*86400000);

  const last = sh.getLastRow(); if (last < 2) return [];
  const disp = sh.getRange(2,1,last-1,4).getDisplayValues();

  const out = [];
  disp.forEach((r,i)=>{
    const d = sh.getRange(i+2,1).getValue();              // data real
    const teamRaw = r[1];
    const team = normTeam(teamRaw);
    const availStr = r[3];
    const avail = parseMinutes(availStr);

    const ok = (d instanceof Date && d >= start && d < max && team && avail >= minMin);
    if (ok) out.push({ date:d, team, availStr });
  });
  return out;
}

function coletarPontosDoDia(slot,vals,disp){
  const pts=[];
  
  // ✅ OTIMIZAÇÃO: Pré-carregar cache Supabase em batch
  var addressFormsToPreload = [];
  var addressHashesToPreload = [];
  
  // Primeira passagem: coletar todos os endereços que precisam de geocoding
  vals.forEach((r,i)=>{
    const d=r[0];
    if(!(d instanceof Date) || d.getTime()!==slot.date.getTime()) return;
    if(normTeam(disp[i][6])!==slot.team) return;
    
    let addr = (disp[i][5]||'').trim();
    if(!addr){
      const m=(disp[i][4]||'').match(/ENDEREÇO:[^0-9a-zA-Z]*([\s\S]+?)(?:\n\n|\n[A-Z0-9]+:|$)/i);
      if(!m) {
        const m2 = (disp[i][4]||'').match(/ENDEREÇO:[^0-9]*(\d+.*?\d{5}-\d{3})/i);
        if(m2) addr = m2[1].trim();
        else return;
      } else {
        addr = m[1].trim();
      }
    }
    
    addr = addr.replace(/\n/g, ', ').replace(/\s+/g, ' ').replace(/,+/g, ',').trim();
    if(addr.toUpperCase().startsWith('ENDEREÇO:')) addr = addr.substring(9).trim();
    
    var mockForm = {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: 'Curitiba',
      uf: 'PR'
    };
    
    var cepAddrM = addr.match(/\b(\d{5}-?\d{3})\b/);
    if (cepAddrM) addr = addr.replace(/,?\s*\b\d{5}-?\d{3}\b/, '').trim();
    if (/\bPARANÁ\b/i.test(addr)) addr = addr.replace(/,?\s*\bPARANÁ\b/i, '').trim();
    var addrClean = addr.replace(/[,\-\s]+$/, '').trim();
    var ufAddrM = addrClean.match(/[,\-]\s*([A-Za-z]{2})\s*$/);
    if (ufAddrM) {
      mockForm.uf = ufAddrM[1].toUpperCase();
      addrClean = addrClean.substring(0, addrClean.length - ufAddrM[0].length).replace(/[,\-\s]+$/, '').trim();
    }
    var addrParts = addrClean.split(/\s*,\s*/).filter(function(p){ return p.length > 0; });
    if (addrParts.length >= 4) {
      mockForm.logradouro = addrParts[0];
      mockForm.numero = addrParts[1];
      mockForm.bairro = addrParts[2];
      mockForm.cidade = addrParts[3];
    } else if (addrParts.length === 3) {
      mockForm.logradouro = addrParts[0];
      mockForm.numero = addrParts[1];
      mockForm.bairro = addrParts[2];
    } else if (addrParts.length === 2) {
      mockForm.logradouro = addrParts[0];
      if (/^\d/.test(addrParts[1])) {
        var dashInPart = addrParts[1].match(/^(\d+[A-Za-z]?)\s*-\s*(.+)$/);
        if (dashInPart) {
          mockForm.numero = dashInPart[1];
          mockForm.bairro = dashInPart[2].trim();
        } else {
          mockForm.numero = addrParts[1];
        }
      } else {
        mockForm.bairro = addrParts[1];
      }
    } else {
      mockForm.logradouro = addrParts[0] || addr;
    }
    if (mockForm.numero && !mockForm.bairro) {
      var dashInNum = mockForm.numero.match(/^(\d+[A-Za-z]?)\s*-\s*(.+)$/);
      if (dashInNum) {
        mockForm.numero = dashInNum[1];
        mockForm.bairro = dashInNum[2].trim();
      }
    }
    mockForm.logradouro = mockForm.logradouro.replace(/^[\-,\s]+/, '').trim();
    mockForm.bairro = mockForm.bairro.replace(/^[\-,\s]+/, '').trim();
    mockForm.cidade = mockForm.cidade.replace(/^[\-,\s]+/, '').trim();
    
    // Calcular hash e adicionar à lista de pré-carregamento
    if (mockForm.logradouro.length >= 3 && mockForm.cidade.length >= 3 && mockForm.uf.length === 2) {
      var addrNorm = NormalizarEnderecoParaCache_(mockForm);
      var hashKey = _hashEnderecoSemNumero_(addrNorm);
      addressHashesToPreload.push(hashKey);
      addressFormsToPreload.push({ mockForm: mockForm, originalAddr: addr, eventIndex: i });
    }
  });
  
  // Pré-carregar cache em batch (1 query vs N queries)
  var preloadedCache = {};
  if (addressHashesToPreload.length > 0) {
    try {
      preloadedCache = ConsultarCacheSupabaseBatch_(addressHashesToPreload);
      dlog('[BATCH-PRELOAD] ✅ ' + addressHashesToPreload.length + ' endereços pré-carregados');
    } catch(e) {
      dlog('[BATCH-PRELOAD] ❌ Erro: ' + (e && e.message) + ', continuando sem batch');
    }
  }
  
  // Segunda passagem: processar endereços com cache pré-carregado
  addressFormsToPreload.forEach(function(item){
    var i = item.eventIndex;
    var mockForm = item.mockForm;
    var addr = item.originalAddr;
    var source = (disp[i][5]||'').trim() ? 'LUGAR' : 'OBSERVAÇÕES';
    
    dlog('[PARSE-ADDR] logr="' + mockForm.logradouro + '" num="' + mockForm.numero + '" bairro="' + mockForm.bairro + '" cidade="' + mockForm.cidade + '" uf="' + mockForm.uf + '"');
    
    // ✅ OTIMIZAÇÃO: Passa cache pré-carregado para evitar consulta individual
    const locRes = ResolverEnderecoComCache_(mockForm, 'AGENDA', preloadedCache);
    const loc = locRes.ok ? locRes : null;
    
    if(loc){
      var displayFinal = locRes.enderecoCompleto || addr;
      pts.push({addr: displayFinal, loc: loc, eventTitle: disp[i][2]});
      dlog(`[PTS] ${formatDatePt(slot.date)} | ${slot.team} | "${disp[i][2]}" | fonte=${source} | norm="${displayFinal}" (Provider: ${loc.provider})`);
    }else{
      var erroTxt = locRes ? locRes.error : 'Desconhecido';
      dlog(`[PTS][ERRO] geocode falhou | "${disp[i][2]}" | raw_addr="${addr}" | erro=${erroTxt}`);
    }
  });
  return pts;
}

/* ===================================================== */
/* Sessão 7.0 – Otimização de Rota                        */
/* ===================================================== */
function rotaOtimizada(origin,pontos){
  if(!pontos.length) return{km:0,order:['DEPÓSITO']};
  if(pontos.length===1){
    return{km:getDrivingKm(origin,pontos[0].loc),order:['DEPÓSITO',pontos[0].addr]};
  }
  let rest=[...pontos], ord=[], cur={loc:origin};
  while(rest.length){
    rest.sort((a,b)=>haversine(cur.loc.lat,cur.loc.lng,a.loc.lat,a.loc.lng)
                   -haversine(cur.loc.lat,cur.loc.lng,b.loc.lat,b.loc.lng));
    cur=rest.shift(); ord.push(cur);
  }
  if(ord.length>3) twoOptSwap(ord,origin,12);
  let tot=0,prev={loc:origin};
  ord.forEach(p=>{ tot+=getDrivingKm(prev.loc,p.loc); prev=p; });
  return{km:tot,order:['DEPÓSITO',...ord.map(p=>p.addr)]};
}
function twoOptSwap(path,origin,maxIter){
  const n=path.length;
  for(let it=0;it<maxIter;it++){
    let imp=false;
    for(let i=0;i<n-2;i++){
      for(let k=i+1;k<n-1;k++){
        const A=i===0?origin:path[i-1].loc, B=path[i].loc, C=path[k].loc, D=path[k+1].loc;
        if(getDrivingKm(A,C)+getDrivingKm(B,D)<getDrivingKm(A,B)+getDrivingKm(C,D)){
          path.splice(i,k-i+1,...path.slice(i,k+1).reverse()); imp=true;
        }
      }
    }
    if(!imp) break;
  }
}

/* ===================================================== */
/* Sessão 8.0 – FRETE                                     */
/* ===================================================== */
function loadFreightParams(cfg){
  const params={};
  const data = cfg.getRange(14,1,cfg.getLastRow()-13,2).getValues();
  data.forEach(([k,v])=>{
    if(!k) return;
    const key = String(k).trim().toUpperCase();
    const num = parseFloat(String(v).replace('R$','').replace(',','.').trim());
    params[key] = isNaN(num) ? v : num;
  });
  return params;
}
function calcularFrete(distKm, isSat, isRural, isCondominio, p){
  const lim     = p['KILOMETRAGEM MÁXIMA DE VIAGEM'];
  if (distKm > lim) return 'Não fazemos';

  const kmFixo  = p['KILOMETRAGEM MÁXIMA DE VALOR FIXO'];
  const kmLong  = p['KILOMETRAGEM MÁXIMA DE LONGA CIDADE'];
  const kmNaoV  = p['KILOMETRAGEM MÁXIMA DE NÃO VIAGEM'];

  const base    = isSat ? p['VALOR SÁBADO ATÉ 10KM'] : p['VALOR SEMANA ATÉ 10KM'];
  const fator   = p['FATOR MULTIPLICADOR PARA KILOMETRAGEM EM VIAGEM'];
  const multNV  = p['MULTIPLICADOR DE KM NÃO VIAGEM'];
  const add25S  = p['VALOR DIA APÓS 25KM: SEMANA'];
  const add25Sa = p['VALOR DIA APÓS 25KM: SÁBADO'];

  // Novo: adicional de condomínio (default 0 se faltar)
  const addCondo = Number(p['PREÇO CONDOMINIO ADICIONAL'] || 0);

  let preco;
  if (distKm <= kmFixo) {
    // Faixa 1: até km fixo → preço base
    preco = base;
  } else if (distKm <= kmLong) {
    // Faixa 2: em viagem (normal)
    preco = base + (distKm - kmFixo) * fator;
  } else if (distKm <= kmNaoV) {
    // Faixa 3: em viagem após "longa cidade"
    const add25 = isSat ? add25Sa : add25S;        // ← aplica adicional do dia aqui também
    preco = base + add25 + (distKm - kmLong) * fator;
  } else {
    // Faixa 4: não viagem
    const add25 = isSat ? add25Sa : add25S;        // ← adicional do dia
    preco = base + add25 + (distKm - kmLong) * multNV;
  }

  if (isRural)      preco += 100;                  // adicional fixo rural já existente
  if (isCondominio) preco += Number(p['PREÇO CONDOMINIO ADICIONAL'] || 0);             // ← NOVO adicional de condomínio

  return Math.ceil(preco / 10) * 10;               // arredonda pra cima na dezena
}

/* ===================================================== */
/* Sessão 9.0 – Utilidades Gerais                         */
/* ===================================================== */
function parseMinutes(t){
  if(!t) return 0;
  if(t instanceof Date) return t.getHours()*60+t.getMinutes();
  if(typeof t==='number') return Math.round(t*24*60);
  const p=String(t).split(':'), h=+p[0]||0, m=+p[1]||0;
  return h*60+m;
}
function haversine(lat1,lon1,lat2,lon2){
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function normTeam(s){
  s=String(s).toUpperCase();
  if(/EQUIPE\s*0?1|EQP\s*0?1/.test(s)) return 'EQUIPE 1';
  if(/EQUIPE\s*0?2|EQP\s*0?2/.test(s)) return 'EQUIPE 2';
  return null;
}
function formatDatePt(d){
  const ds=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  return Utilities.formatDate(d,'GMT-3','dd/MM')+` (${ds[d.getDay()]})`;
}

/* ===== Sessão 9.1 – Manutenção de Cache ===== */
function clearCepCache(cepRaw){
  const cep = String(cepRaw).replace(/\D/g,'');
  const cache = CacheService.getScriptCache();
  cache.remove('NOMI:' + cep);                 // cache volátil (6h)
  PROP_STORE.deleteProperty('GEOCEP:' + cep);  // cache persistente (até 14d)
  dlog('[CACHE] limpo CEP ' + cep);
}

/* ===================================================== */
/* Sessão 10.0 – Auditoria (atualizada)                   */
/* ===================================================== */
function logAuditRow(userEmail, cep, params, tempo, frete, scheduledDate, eventLink, resultsSummary) {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const auditSheet = ss.getSheetByName('AUDITORIA');
  if (!auditSheet) return;

  const timestamp = new Date();
  const propKey   = 'LAST_AUDIT_ROW_' + userEmail;

  if (!scheduledDate) {
    // registro da simulação
    auditSheet.appendRow([
      timestamp, userEmail, cep, params, frete, tempo, '', '', resultsSummary || ''
    ]);
    PROP_STORE.setProperty(propKey, String(auditSheet.getLastRow()));
  } else {
    // completa quando pré-agendamento é feito
    const saved = PROP_STORE.getProperty(propKey);
    if (saved) {
      auditSheet.getRange(+saved, 7).setValue(scheduledDate); // col G
      auditSheet.getRange(+saved, 8).setValue(eventLink);     // col H
      // Não atualizamos resultsSummary aqui pois ele já foi gravado na simulação
      PROP_STORE.deleteProperty(propKey);
    }
  }
}

/* ===================================================== */
/* Sessão 11.0 – Geocodificação por Endereço Completo    */
/* ===================================================== */

/**
 * 🔍 VERSÃO MELHORADA COM DIAGNÓSTICO COMPLETO
 * Tenta geocodificar endereço usando providers gratuitos (LocationIQ, maps.co, Photon)
 * Inclui logs estruturados para diagnóstico de permissões e chaves de API
 */
function geocodeAddressGratisStrict_(addrFull, uf, city, logradouro) {
  var startTime = Date.now();
  var execContext = _logExecutionContext_('geocodeAddressGratisStrict_', { addrFull: addrFull, uf: uf, city: city });
  
  Logger.log('[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====');
  Logger.log('[GEO-PROVIDER] addr="' + (addrFull || '').substring(0, 100) + '" | uf=' + uf + ' | city=' + city);
  
  // ✅ Carregar chaves de API da configuração (PLANILHA BACKEND)
  var keysLoadStart = Date.now();
  try {
    var ssSrc = abrirPlanilhaFonte_();
    var cfgSheet = ssSrc.getSheets().find(function(s){ return s.getSheetId() === 718532388; });
    if (cfgSheet) {
      try { MAPSCO_API_KEY = getConfig('MAPS.CO API KEY', cfgSheet); } catch(e) {
        _logGeocodingError_('PERMISSION', 'Falha ao ler MAPS.CO API KEY da planilha backend', { error: e.message });
      }
      try { LOCATIONIQ_API_KEY = getConfig('LOCATIONIQ API KEY', cfgSheet); } catch(e) {
        _logGeocodingError_('PERMISSION', 'Falha ao ler LOCATIONIQ API KEY da planilha backend', { error: e.message });
      }
    } else {
      _logGeocodingError_('PERMISSION', 'Config sheet (id=718532388) não encontrada na planilha backend', { 
        spreadsheetId: SOURCE_SPREADSHEET_ID 
      });
    }
  } catch(e) {
    _logGeocodingError_('PERMISSION', 'Falha ao abrir planilha backend (possível falta de permissão)', { 
      error: e.message,
      spreadsheetId: SOURCE_SPREADSHEET_ID
    });
  }
  
  var keysLoadTime = Date.now() - keysLoadStart;
  Logger.log('[GEO-KEYS] Chaves carregadas da planilha backend em ' + keysLoadTime + 'ms');
  
  // Diagnóstico completo das chaves
  _logApiKeysStatus_();
  
  var bkp = null;
  
  // 1. Tentar LocationIQ primeiro (melhor para endereços completos no BR)
  var liqStart = Date.now();
  _logProviderAttempt_('locationiq', 'TRYING', null, null);
  try {
    var liq = _geocodeAddressLocationIQ_(addrFull, uf, city, logradouro);
    var liqTime = Date.now() - liqStart;
    
    if (liq && liq.ok) {
      _logProviderAttempt_('locationiq', 'SUCCESS', { 
        confidence: liq.confidence, 
        display_name: liq.display_name,
        lat: liq.lat,
        lng: liq.lng
      }, liqTime);
      
      if (liq.confidence >= 0.8) {
        Logger.log('[GEO-RESULT] ✅ SELECIONADO: locationiq (high confidence) | total=' + (Date.now() - startTime) + 'ms');
        return liq; // Muito bom, retorna direto
      }
      if (!bkp || liq.confidence > bkp.confidence) bkp = liq; // Salva como backup
    } else {
      _logProviderAttempt_('locationiq', 'FAILED', { error: 'Sem resultado válido' }, liqTime);
    }
  } catch(e) { 
    var liqTime = Date.now() - liqStart;
    _logProviderAttempt_('locationiq', 'FAILED', { error: e.message }, liqTime);
    
    // Detecta erro de permissão do UrlFetchApp
    if (e.message && (e.message.indexOf('UrlFetchApp') >= 0 || e.message.indexOf('Permission') >= 0 || e.message.indexOf('Authorization') >= 0)) {
      _logGeocodingError_('PERMISSION', 'LocationIQ: Falha de permissão no UrlFetchApp', { error: e.message });
    } else {
      _logGeocodingError_('NETWORK', 'LocationIQ: Erro de rede', { error: e.message, endpoint: 'https://us1.locationiq.com' });
    }
  }

  // 2. Tentar maps.co
  var mcoStart = Date.now();
  _logProviderAttempt_('mapsco', 'TRYING', null, null);
  try {
    var mco = _geocodeAddressMapsCo_(addrFull, uf, city, logradouro);
    var mcoTime = Date.now() - mcoStart;
    
    if (mco && mco.ok) {
      _logProviderAttempt_('mapsco', 'SUCCESS', {
        confidence: mco.confidence,
        display_name: mco.display_name,
        lat: mco.lat,
        lng: mco.lng
      }, mcoTime);
      
      if (mco.confidence >= 0.8) {
        Logger.log('[GEO-RESULT] ✅ SELECIONADO: mapsco (high confidence) | total=' + (Date.now() - startTime) + 'ms');
        return mco;
      }
      if (!bkp || mco.confidence > bkp.confidence) bkp = mco;
    } else {
      _logProviderAttempt_('mapsco', 'FAILED', { error: 'Sem resultado válido' }, mcoTime);
    }
  } catch(e) {
    var mcoTime = Date.now() - mcoStart;
    _logProviderAttempt_('mapsco', 'FAILED', { error: e.message }, mcoTime);
    
    if (e.message && (e.message.indexOf('UrlFetchApp') >= 0 || e.message.indexOf('Permission') >= 0)) {
      _logGeocodingError_('PERMISSION', 'maps.co: Falha de permissão no UrlFetchApp', { error: e.message });
    } else {
      _logGeocodingError_('NETWORK', 'maps.co: Erro de rede', { error: e.message, endpoint: 'https://geocode.maps.co' });
    }
  }

  // 3. Tentar Photon
  var phoStart = Date.now();
  _logProviderAttempt_('photon', 'TRYING', null, null);
  try {
    var pho = _geocodeAddressPhoton_(addrFull, uf, city, logradouro);
    var phoTime = Date.now() - phoStart;
    
    if (pho && pho.ok) {
      _logProviderAttempt_('photon', 'SUCCESS', {
        confidence: pho.confidence,
        display_name: pho.display_name,
        lat: pho.lat,
        lng: pho.lng
      }, phoTime);
      
      if (pho.confidence >= 0.8) {
        Logger.log('[GEO-RESULT] ✅ SELECIONADO: photon (high confidence) | total=' + (Date.now() - startTime) + 'ms');
        return pho;
      }
      if (!bkp || pho.confidence > bkp.confidence) bkp = pho;
    } else {
      _logProviderAttempt_('photon', 'FAILED', { error: 'Sem resultado válido' }, phoTime);
    }
  } catch(e) {
    var phoTime = Date.now() - phoStart;
    _logProviderAttempt_('photon', 'FAILED', { error: e.message }, phoTime);
    
    if (e.message && (e.message.indexOf('UrlFetchApp') >= 0 || e.message.indexOf('Permission') >= 0)) {
      _logGeocodingError_('PERMISSION', 'Photon: Falha de permissão no UrlFetchApp', { error: e.message });
    } else {
      _logGeocodingError_('NETWORK', 'Photon: Erro de rede', { error: e.message, endpoint: 'https://photon.komoot.io' });
    }
  }

  // 4. Retorna o melhor encontrado, se tiver confiança mínima de 0.65
  if (bkp && bkp.confidence >= 0.65) {
    Logger.log('[GEO-RESULT] ✅ SELECIONADO: ' + bkp.provider + ' (backup) | conf=' + bkp.confidence.toFixed(2) + ' | total=' + (Date.now() - startTime) + 'ms');
    return bkp;
  }
  
  if (bkp) {
    _logProviderAttempt_(bkp.provider, 'REJECTED', { 
      confidence: bkp.confidence, 
      reason: 'Confidence ' + bkp.confidence.toFixed(2) + ' < 0.65 (threshold)' 
    }, null);
    _logGeocodingError_('VALIDATION', 'Melhor resultado rejeitado por baixa confiança', {
      provider: bkp.provider,
      confidence: bkp.confidence,
      threshold: 0.65,
      reason: 'Confidence ' + bkp.confidence.toFixed(2) + ' < 0.65'
    });
  } else {
    Logger.log('[GEO-RESULT] ❌ NENHUM PROVIDER retornou resultado | total=' + (Date.now() - startTime) + 'ms');
  }

  Logger.log('[LOOKUP-FIM] total=' + (Date.now() - startTime) + 'ms | result=FAILED');
  return { ok: false, error: 'Nenhum provedor retornou resultado com precisão suficiente (min 0.65).' };
}

function ValidarRetornoGeocode_(georesult, inputCity, inputUF, inputLogra, inputCEP) {
  var conf = 0;
  var logs = [];
  
  if (!georesult || !isBrazilLatLng(georesult.lat, georesult.lng)) {
    dlog('[VALIDAÇÃO] ❌ Fora do Brasil ou sem coordenadas');
    return 0;
  }
  
  conf += 0.3; // Base por ser no Brasil
  logs.push('Brasil=+0.3');
  
  var resCity = _normTxt_(_pickCityFromAddr_(georesult.address));
  var reqCity = _normTxt_(inputCity);
  
  var resState = _normTxt_(georesult.address && georesult.address.state);
  var reqState = _normTxt_(inputUF);
  var reqStateFullName = _normTxt_(UF_NAMES[inputUF] || '');

  // Validação UF
  if (reqState && (resState === reqState || resState === reqStateFullName)) {
    conf += 0.2;
    logs.push('UF_OK=+0.2');
  } else {
    logs.push('UF_DIFF=+0.0 (esperado="' + reqState + '", recebido="' + resState + '")');
  }
  
  // Validação Cidade (crítico)
  if (reqCity && resCity && (resCity === reqCity || resCity.indexOf(reqCity) >= 0 || reqCity.indexOf(resCity) >= 0)) {
    conf += 0.3;
    logs.push('CIDADE_OK=+0.3');
  } else {
    logs.push('CIDADE_DIFF=REJEITADO (esperado="' + reqCity + '", recebido="' + resCity + '")');
    dlog('[VALIDAÇÃO] ❌ CIDADE INCORRETA | ' + logs.join(' | '));
    return 0.1; // Red flag gigante
  }
  
  // ✅ NOVO: Validação de CEP (se disponível)
  if (inputCEP && georesult.postcode) {
    var inputCEPClean = String(inputCEP).replace(/\D/g, '');
    var resCEPClean = String(georesult.postcode).replace(/\D/g, '');
    
    // Comparar primeiros 5 dígitos (região)
    var inputPrefix = inputCEPClean.substring(0, 5);
    var resPrefix = resCEPClean.substring(0, 5);
    
    if (inputPrefix === resPrefix) {
      conf += 0.15;
      logs.push('CEP_REGION_OK=+0.15 (ambos=' + inputPrefix + ')');
    } else {
      // CEP de região diferente é problemático
      conf -= 0.25;
      logs.push('CEP_REGION_DIFF=-0.25 (esperado=' + inputPrefix + ', recebido=' + resPrefix + ')');
    }
  } else {
    logs.push('CEP_N/A=+0.0');
  }
  
  // Validar se achou a rua e não apenas um "ponto genérico" da cidade
  var resDisp = _normTxt_(georesult.display_name || '');
  var reqLogra = _normTxt_(inputLogra || '');
  
  if (reqLogra && resDisp) {
    var tokens = reqLogra.split(' ').filter(function(t) { return t.length > 3; });
    var hitCount = 0;
    for (var i=0; i<tokens.length; i++) {
      if (resDisp.indexOf(tokens[i]) >= 0) hitCount++;
    }
    if (hitCount > 0 || resDisp.indexOf(reqLogra) >= 0) {
      conf += 0.2;
      logs.push('LOGRADOURO_OK=+0.2 (hits=' + hitCount + ')');
    } else {
      conf -= 0.3;
      logs.push('LOGRADOURO_MISS=-0.3 (nenhum token encontrado)');
    }
  } else {
    logs.push('LOGRADOURO_N/A=+0.0');
  }

  var finalConf = Math.max(0, Math.min(1, conf));
  dlog('[VALIDAÇÃO] FINAL=' + finalConf.toFixed(2) + ' | ' + logs.join(' | '));
  return finalConf;
}

function _geocodeAddressLocationIQ_(addrFull, uf, city, logradouro) {
  if (typeof LOCATIONIQ_API_KEY === 'undefined' || !LOCATIONIQ_API_KEY) {
    dlog('[LocationIQ] ❌ API Key não configurada');
    return null;
  }
  
  // ✅ GEOCODING ESTRUTURADO: Melhor precisão passando campos separados
  var structuredQuery = [
    logradouro ? 'street=' + encodeURIComponent(logradouro) : '',
    city ? 'city=' + encodeURIComponent(city) : '',
    uf ? 'state=' + encodeURIComponent(uf) : '',
    'country=Brazil'
  ].filter(Boolean).join('&');
  
  var url = 'https://us1.locationiq.com/v1/search.php?key=' + encodeURIComponent(LOCATIONIQ_API_KEY)
          + '&' + structuredQuery
          + '&format=json&addressdetails=1&limit=3&countrycodes=br&accept-language=pt-BR';
  
  dlog('[LocationIQ] Buscando estruturado: ' + structuredQuery);
  
  var arr = fetchJsonWithHeaders(url, 'locationiq-addr');
  if (!arr || !arr.length) return null;

  var best = null;
  var bestConf = 0;

  for (var i=0; i<Math.min(3, arr.length); i++) {
    var o = arr[i];
    var out = {
      lat: Number(o.lat),
      lng: Number(o.lon),
      display_name: o.display_name,
      address: o.address || {},
      postcode: (o.address && o.address.postcode) ? o.address.postcode : '',
      provider: 'locationiq'
    };
    var inputCEP = (String(addrFull || '').match(/\b\d{5}-?\d{3}\b/) || [])[0];
    var conf = ValidarRetornoGeocode_(out, city, uf, logradouro, inputCEP);
    if (!best || conf > bestConf) {
      best = out;
      bestConf = conf;
    }
  }

  if (best) {
    best.ok = true;
    best.confidence = bestConf;
    return best;
  }
  return null;
}

function _geocodeAddressMapsCo_(addrFull, uf, city, logradouro) {
  var url = 'https://geocode.maps.co/search?q=' + encodeURIComponent(addrFull)
          + '&format=jsonv2&addressdetails=1&limit=3&countrycodes=br';
  if (typeof MAPSCO_API_KEY !== 'undefined' && MAPSCO_API_KEY) {
    url += '&api_key=' + encodeURIComponent(MAPSCO_API_KEY);
  }

  var arr = fetchJsonWithHeaders(url, 'mapsco-addr');
  if (!arr || !arr.length) return null;

  var best = null;
  var bestConf = 0;

  for (var i=0; i<Math.min(3, arr.length); i++) {
    var o = arr[i];
    var out = {
      lat: Number(o.lat),
      lng: Number(o.lon),
      display_name: o.display_name,
      address: o.address || {},
      postcode: (o.address && o.address.postcode) ? o.address.postcode : '',
      provider: 'maps.co'
    };
    var inputCEP = (String(addrFull || '').match(/\b\d{5}-?\d{3}\b/) || [])[0];
    var conf = ValidarRetornoGeocode_(out, city, uf, logradouro, inputCEP);
    if (!best || conf > bestConf) {
      best = out;
      bestConf = conf;
    }
  }

  if (best) {
    best.ok = true;
    best.confidence = bestConf;
    return best;
  }
  return null;
}

function _geocodeAddressPhoton_(addrFull, uf, city, logradouro) {
  var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(addrFull) + '&limit=3';
  var j = fetchJsonWithHeaders(url, 'photon-addr');
  if (!j || !j.features || !j.features.length) return null;

  var best = null;
  var bestConf = 0;

  for (var i=0; i<Math.min(3, j.features.length); i++) {
    var f = j.features[i];
    var c = f.geometry && f.geometry.coordinates;
    if (!c || c.length < 2) continue;
    
    var out = {
      lat: Number(c[1]),
      lng: Number(c[0]),
      display_name: f.properties && f.properties.name ? f.properties.name : addrFull,
      address: f.properties || {},
      postcode: (f.properties && f.properties.postcode) ? f.properties.postcode : '',
      provider: 'photon'
    };
    var inputCEP = (String(addrFull || '').match(/\b\d{5}-?\d{3}\b/) || [])[0];
    var conf = ValidarRetornoGeocode_(out, city, uf, logradouro, inputCEP);
    if (!best || conf > bestConf) {
      best = out;
      bestConf = conf;
    }
  }

  if (best) {
    best.ok = true;
    best.confidence = bestConf;
    return best;
  }
  return null;
}

/* ===================================================== */
/* Sessão 12.0 – Supabase Cache Integration              */
/* ===================================================== */

function _loadSupabaseConfig_() {
  try {
    var ssSrc = abrirPlanilhaFonte_();
    var cfgSheet = ssSrc.getSheets().find(function (s) { return s.getSheetId() === 718532388; });
    if (!cfgSheet) return null;

    var url = '';
    var key = '';
    var table = 'geo_cache';
    try { url = getConfig('SUPABASE_URL', cfgSheet); } catch(e){}
    try { key = getConfig('SUPABASE_ANON_KEY', cfgSheet); } catch(e){}
    try { table = getConfig('SUPABASE_TABLE', cfgSheet); } catch(e){}

    if (!url || !key) return null;
    return { url: url.replace(/\/$/, ''), key: key, table: table };
  } catch(e) {
    return null;
  }
}

function ConsultarCacheSupabase_(hashEndereco) {
  var cfg = _loadSupabaseConfig_();
  if (!cfg) return null;

  var endpoint = cfg.url + '/rest/v1/' + cfg.table + '?chave_endereco=eq.' + encodeURIComponent(hashEndereco) + '&select=*&limit=1';
  
  var options = {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'apikey': cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Accept': 'application/json'
    }
  };

  try {
    var resp = UrlFetchApp.fetch(endpoint, options);
    if (resp.getResponseCode() === 200) {
      var arr = JSON.parse(resp.getContentText());
      if (arr && arr.length > 0) return arr[0];
    }
  } catch(e) {
    dlog('[SUPABASE] Erro consulta: ' + e.message);
  }
  return null;
}

/**
 * ✅ OTIMIZAÇÃO: Consulta múltiplos endereços em batch (1 query vs N queries)
 * Reduz tempo de 30 × 2.5s = 75s para ~3s (economia de 72s)
 * @param {Array<string>} hashArray - Array de hashes de endereço
 * @returns {Object} - Mapa { hash: record }
 */
function ConsultarCacheSupabaseBatch_(hashArray) {
  if (!hashArray || !hashArray.length) return {};
  
  // Limite seguro de 50 itens por batch
  var MAX_BATCH_SIZE = 50;
  if (hashArray.length > MAX_BATCH_SIZE) {
    dlog('[SUPABASE-BATCH] ⚠️ Limite excedido (' + hashArray.length + '), processando em chunks');
    var results = {};
    for (var i = 0; i < hashArray.length; i += MAX_BATCH_SIZE) {
      var chunk = hashArray.slice(i, i + MAX_BATCH_SIZE);
      var chunkResults = ConsultarCacheSupabaseBatch_(chunk);
      for (var k in chunkResults) {
        results[k] = chunkResults[k];
      }
    }
    return results;
  }
  
  var cfg = _loadSupabaseConfig_();
  if (!cfg) return {};
  
  try {
    var t0 = Date.now();
    
    // Construir query com IN para múltiplos valores (sem aspas!)
    var hashesEscaped = hashArray.map(function(h) {
      return String(h).replace(/[^a-zA-Z0-9]/g, '');
    }).join(',');
    
    var endpoint = cfg.url + '/rest/v1/' + cfg.table 
      + '?chave_endereco=in.(' + hashesEscaped + ')'
      + '&select=chave_endereco,endereco_completo,logradouro,numero,bairro,cidade,uf,cep,lat,lng,provider,confidence';
    
    var options = {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        'apikey': cfg.key,
        'Authorization': 'Bearer ' + cfg.key,
        'Accept': 'application/json'
      }
    };
    
    var resp = UrlFetchApp.fetch(endpoint, options);
    var dt = Date.now() - t0;
    
    if (resp.getResponseCode() !== 200) {
      dlog('[SUPABASE-BATCH] ⚠️ HTTP ' + resp.getResponseCode() + ' em ' + dt + 'ms, usando fallback');
      return _consultarCacheSupabaseFallback_(hashArray);
    }
    
    var arr = JSON.parse(resp.getContentText());
    var resultMap = {};
    
    if (arr && arr.length > 0) {
      for (var i = 0; i < arr.length; i++) {
        var record = arr[i];
        if (record && record.chave_endereco) {
          resultMap[record.chave_endereco] = record;
        }
      }
    }
    
    dlog('[SUPABASE-BATCH] ✅ ' + hashArray.length + ' hashes consultados em ' + dt + 'ms (' + Object.keys(resultMap).length + ' hits)');
    return resultMap;
    
  } catch(e) {
    dlog('[SUPABASE-BATCH] ❌ Erro: ' + (e && e.message) + ', usando fallback');
    return _consultarCacheSupabaseFallback_(hashArray);
  }
}

/**
 * Fallback: consulta sequencial se batch falhar
 * @private
 */
function _consultarCacheSupabaseFallback_(hashArray) {
  dlog('[SUPABASE-FALLBACK] Consultando ' + hashArray.length + ' endereços sequencialmente');
  var results = {};
  for (var i = 0; i < hashArray.length; i++) {
    var hash = hashArray[i];
    var record = ConsultarCacheSupabase_(hash);
    if (record) {
      results[hash] = record;
    }
  }
  return results;
}

function SalvarCacheSupabase_(record) {
  var cfg = _loadSupabaseConfig_();
  if (!cfg) return;

  var endpoint = cfg.url + '/rest/v1/' + cfg.table;

  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      'apikey': cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Prefer': 'resolution=merge-duplicates'
    },
    payload: JSON.stringify(record)
  };

  try {
    UrlFetchApp.fetch(endpoint, options);
  } catch(e) {
    dlog('[SUPABASE] Erro gravação: ' + e.message);
  }
}

/* ===================================================== */
/* 🔍 FUNÇÕES AUXILIARES DE DIAGNÓSTICO E OBSERVABILIDADE */
/* ===================================================== */

/**
 * Loga contexto completo da execução atual
 * @param {string} functionName - Nome da função sendo executada
 * @param {object} params - Parâmetros relevantes (opcional)
 * @returns {object} Contexto da execução
 */
function _logExecutionContext_(functionName, params) {
  var context = {
    function: functionName || 'UNKNOWN',
    timestamp: new Date().toISOString(),
    activeUser: 'INDISPONIVEL',
    effectiveUser: 'INDISPONIVEL',
    timezone: 'INDISPONIVEL',
    params: params || null
  };
  
  try { context.activeUser = Session.getActiveUser().getEmail() || 'EMPTY'; } catch(e) { context.activeUser = 'ERROR: ' + e.message; }
  try { context.effectiveUser = Session.getEffectiveUser().getEmail() || 'EMPTY'; } catch(e) { context.effectiveUser = 'ERROR: ' + e.message; }
  try { context.timezone = Session.getScriptTimeZone() || 'EMPTY'; } catch(e) { context.timezone = 'ERROR: ' + e.message; }
  
  Logger.log('[LOOKUP-CONTEXTO] func=' + context.function + ' | timestamp=' + context.timestamp);
  Logger.log('[LOOKUP-USUARIO] activeUser=' + context.activeUser + ' | effectiveUser=' + context.effectiveUser + ' | timezone=' + context.timezone);
  
  if (params) {
    try {
      var paramSummary = typeof params === 'object' ? JSON.stringify(params).substring(0, 200) : String(params).substring(0, 200);
      Logger.log('[LOOKUP-PARAMS] ' + paramSummary);
    } catch(e) { }
  }
  
  return context;
}

/**
 * Diagnóstica status das chaves de API (UserProperties vs ScriptProperties vs Planilha)
 * NÃO expõe a chave completa, apenas os 4 últimos caracteres mascarados
 * @returns {object} Status das chaves
 */
function _logApiKeysStatus_() {
  var status = {
    locationiq: { user: 'MISSING', script: 'MISSING', global: 'MISSING' },
    mapsco: { user: 'MISSING', script: 'MISSING', global: 'MISSING' }
  };
  
  // ⚠️ RISCO: As chaves são lidas da PLANILHA BACKEND via getConfig(), não de Properties
  // Se o usuário não tem acesso à planilha, as chaves ficam vazias
  
  // Verifica UserProperties (não usado atualmente, mas documentado)
  try {
    var userProps = PropertiesService.getUserProperties();
    var lociqUser = userProps.getProperty('LOCATIONIQ_API_KEY');
    var mapscoUser = userProps.getProperty('MAPSCO_API_KEY');
    
    if (lociqUser && lociqUser.length > 0) {
      status.locationiq.user = 'CONFIGURED(***' + lociqUser.substring(Math.max(0, lociqUser.length - 4)) + ')';
    }
    if (mapscoUser && mapscoUser.length > 0) {
      status.mapsco.user = 'CONFIGURED(***' + mapscoUser.substring(Math.max(0, mapscoUser.length - 4)) + ')';
    }
  } catch(e) { 
    status.locationiq.user = 'ERROR';
    status.mapsco.user = 'ERROR';
  }
  
  // Verifica ScriptProperties (não usado atualmente, mas documentado)
  try {
    var scriptProps = PropertiesService.getScriptProperties();
    var lociqScript = scriptProps.getProperty('LOCATIONIQ_API_KEY');
    var mapscoScript = scriptProps.getProperty('MAPSCO_API_KEY');
    
    if (lociqScript && lociqScript.length > 0) {
      status.locationiq.script = 'CONFIGURED(***' + lociqScript.substring(Math.max(0, lociqScript.length - 4)) + ')';
    }
    if (mapscoScript && mapscoScript.length > 0) {
      status.mapsco.script = 'CONFIGURED(***' + mapscoScript.substring(Math.max(0, mapscoScript.length - 4)) + ')';
    }
  } catch(e) {
    status.locationiq.script = 'ERROR';
    status.mapsco.script = 'ERROR';
  }
  
  // Verifica variáveis globais (carregadas da planilha)
  if (typeof LOCATIONIQ_API_KEY !== 'undefined' && LOCATIONIQ_API_KEY && String(LOCATIONIQ_API_KEY).trim().length > 0) {
    var key = String(LOCATIONIQ_API_KEY).trim();
    status.locationiq.global = 'CONFIGURED(***' + key.substring(Math.max(0, key.length - 4)) + ')';
  }
  if (typeof MAPSCO_API_KEY !== 'undefined' && MAPSCO_API_KEY && String(MAPSCO_API_KEY).trim().length > 0) {
    var key = String(MAPSCO_API_KEY).trim();
    status.mapsco.global = 'CONFIGURED(***' + key.substring(Math.max(0, key.length - 4)) + ')';
  }
  
  Logger.log('[GEO-KEYS] USER LocationIQ=' + status.locationiq.user + ' | SCRIPT LocationIQ=' + status.locationiq.script + ' | GLOBAL LocationIQ=' + status.locationiq.global);
  Logger.log('[GEO-KEYS] USER maps.co=' + status.mapsco.user + ' | SCRIPT maps.co=' + status.mapsco.script + ' | GLOBAL maps.co=' + status.mapsco.global);
  Logger.log('[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.');
  
  return status;
}

/**
 * Loga operação de cache (HIT ou MISS)
 * @param {string} operation - 'READ' ou 'WRITE'
 * @param {string} hashKey - Hash do endereço
 * @param {string} addrNorm - Endereço normalizado
 * @param {string} origin - Origem da chamada (MODAL, AGENDA, API)
 * @param {boolean} hit - true se HIT, false se MISS
 * @param {string} provider - Provider do cache (l1, supabase, locationiq, etc)
 * @param {number} timingMs - Tempo da operação em ms
 */
function _logCacheOperation_(operation, hashKey, addrNorm, origin, hit, provider, timingMs) {
  var status = hit ? 'HIT' : 'MISS';
  var timing = timingMs ? ' (' + Math.round(timingMs) + 'ms)' : '';
  
  Logger.log('[GEO-CACHE] op=' + operation + ' | status=' + status + ' | key=' + hashKey + ' | origin=' + origin + ' | provider=' + (provider || 'N/A') + timing);
  
  if (operation === 'READ' && !hit) {
    Logger.log('[GEO-CACHE] addr_norm="' + (addrNorm || 'N/A') + '"');
  }
}

/**
 * Loga tentativa de provider com resultado
 * @param {string} provider - Nome do provider (locationiq, mapsco, photon)
 * @param {string} status - 'TRYING', 'SUCCESS', 'FAILED', 'REJECTED'
 * @param {object} details - Detalhes adicionais
 * @param {number} timingMs - Tempo da operação em ms
 */
function _logProviderAttempt_(provider, status, details, timingMs) {
  var timing = timingMs ? ' (' + Math.round(timingMs) + 'ms)' : '';
  var msg = '[GEO-PROVIDER] provider=' + provider + ' | status=' + status + timing;
  
  if (details) {
    if (details.confidence !== undefined) msg += ' | confidence=' + Number(details.confidence).toFixed(2);
    if (details.display_name) msg += ' | display="' + String(details.display_name).substring(0, 80) + '"';
    if (details.lat && details.lng) msg += ' | coords=(' + details.lat.toFixed(6) + ',' + details.lng.toFixed(6) + ')';
    if (details.error) msg += ' | error=' + details.error;
  }
  
  Logger.log(msg);
}

/**
 * Loga erro de geocodificação com diagnóstico
 * @param {string} errorType - Tipo do erro (PERMISSION, NETWORK, VALIDATION, etc)
 * @param {string} message - Mensagem de erro
 * @param {object} context - Contexto adicional
 */
function _logGeocodingError_(errorType, message, context) {
  Logger.log('[GEO-ERRO] type=' + errorType + ' | msg=' + message);
  
  if (errorType === 'PERMISSION') {
    Logger.log('[GEO-ERRO] 🔒 DIAGNÓSTICO: Falha de permissão. Possíveis causas:');
    Logger.log('[GEO-ERRO]   1. Deployment configurado como "Execute as USER_ACCESSING" sem escopo de UrlFetchApp autorizado');
    Logger.log('[GEO-ERRO]   2. Usuário não tem permissão para acessar planilha backend (chaves de API ficam vazias)');
    Logger.log('[GEO-ERRO]   3. Script não tem permissão para fazer requisições externas (UrlFetchApp bloqueado)');
    Logger.log('[GEO-ERRO]   ✅ SOLUÇÃO: Deploy como "Execute as ME" ou compartilhe planilha backend com todos os usuários');
  } else if (errorType === 'NETWORK') {
    Logger.log('[GEO-ERRO] 🌐 DIAGNÓSTICO: Falha de rede ao chamar provider externo');
    Logger.log('[GEO-ERRO]   Endpoint: ' + (context && context.endpoint ? context.endpoint : 'N/A'));
    Logger.log('[GEO-ERRO]   HTTP Code: ' + (context && context.httpCode ? context.httpCode : 'N/A'));
  } else if (errorType === 'VALIDATION') {
    Logger.log('[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos');
    Logger.log('[GEO-ERRO]   Motivo: ' + (context && context.reason ? context.reason : 'N/A'));
  }
  
  if (context) {
    try {
      var ctxStr = JSON.stringify(context).substring(0, 300);
      Logger.log('[GEO-ERRO] context=' + ctxStr);
    } catch(e) { }
  }
}