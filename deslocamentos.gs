/**
 * Sessão 1.0 – Variáveis Globais
 * ------------------------------
 */
const CFG_SHEET_ID      = 718532388;
const CAL_DESLOC_E1     = 'lebebe.com.br_jv9ficm9er76am9kpm86t05nfo@group.calendar.google.com';
const CAL_DESLOC_E2     = 'lebebe.com.br_r77ap0bqal0hlhijmf7ad3rq1s@group.calendar.google.com';
const DAYS_AHEAD        = 1;
const PROP_LAST_RUN     = 'LAST_RUN_DESLOC';
const PROP_POINTS_HASH  = 'LAST_POINTS_HASH';
const GEO_TTL_SECS      = 15 * 24 * 3600;
const DIST_TTL_SECS     = 15 * 24 * 3600;
// Janela de análise (relativa a hoje)
const WINDOW_DAYS_MIN = 2;   // D+2
const WINDOW_DAYS_MAX = 100; // até D+100
// Propriedade que guarda as assinaturas por dia/equipe
const PROP_CAL_SIG_MAP = 'CAL_SIG_MAP_V1';
const PROP_DESLOC_BACKEND_URL = 'DESLOCAMENTOS_API_URL';
const PROP_DESLOC_BACKEND_TOKEN = 'APPS_SCRIPT_DESLOCAMENTOS_TOKEN';
const DESLOC_BACKEND_ENDPOINT_PATH = '/api/procurar-datas/interno/deslocamentos/calcular/v1';
const CFG_DESLOC_USAR_LEGADO = 'DESLOCAMENTOS USAR LEGADO?';
// Limites de segurança para quilometragem
const MAX_TOTAL_KM = 160;              // total do dia (ajuste se quiser)
const MAX_POINT_KM_FROM_ORIGIN = 80;  // ponto muito longe da origem → suspeito

// Fallback por haversine quando o OSRM exagerar
const HAVERSINE_ROAD_FACTOR = 1.28;     // “rua” ~28% acima da linha reta (ajuste se quiser)
const HAVERSINE_ACCEPT_PCT  = 0.80;     // aceitamos fallback se haversine*factor <= 80% do limite


const MONITOR_CAL_IDS = [
  //AGENDAS EQUIPE 1
  // EQP1 principal
  'lebebe.com.br_jv9ficm9er76am9kpm86t05nfo@group.calendar.google.com',
  // EQP1 pendente
  'c_f95026c40c9bf3fdbea5c1482252522b34536fd5877f7f9b82904128fa7f4ac7@group.calendar.google.com',
    //HORA MARCADA EQP 1
  'c_80ffd705800afd46fe21c57e7470eb8f86f20bdb197f91dd0b7e9599fada0ebb@group.calendar.google.com',

  ///////////////////////////////////////////////////////////////////////////////////////////////

  //AGENDAS EQUIPE 2
  // EQP2 principal
  'lebebe.com.br_r77ap0bqal0hlhijmf7ad3rq1s@group.calendar.google.com',
  // EQP2 pendente
  'c_r7b684kgg0rt64lbrabeacf5po@group.calendar.google.com',
   //HORA MARCADA EQP 2
  'c_34997be850c99f047dfa6bf199d813b61545f50d6fc4766effc30a1a030d599c@group.calendar.google.com'
];

const GEO_MIN_CONFIDENCE_ADDR_PARTS = 2; // mínimo de partes úteis no endereço geocodificado
const GEO_BLOCK_GENERIC_CURITIBA = true;

const GEO_GENERIC_TERMS = [
  'PRACA TIRADENTES',
  'PRAÇA TIRADENTES',
  'MARCO ZERO',
  'MARCO CENTRAL',
  'CENTRO DE CURITIBA',
  'CENTRO CIVICO',
  'CENTRO CÍVICO'
];

// ====== Gratuito: OSRM + Geocode aberto ======
const OSRM_DEFAULT_BASE = 'https://router.project-osrm.org'; // fallback público
const NOMINATIM_URL     = 'https://nominatim.openstreetmap.org/search';
const MAPSCO_URL        = 'https://geocode.maps.co/search';
const LOCATIONIQ_URL    = 'https://us1.locationiq.com/v1/search';

const FIXED_KNOWN_LOCATIONS = [
  {
    label: 'DEPOSITO_LEBEBE',
    aliases: [
      'R. Dr. Francisco Soares, 860, Curitiba-PR,',
      'R. Dr. Francisco Soares, 860, Curitiba-PR',
      'Rua Doutor Francisco Soares, 860, Curitiba - PR, 81030-470',
      'Rua Doutor Francisco Soares, 860, Novo Mundo, Curitiba - PR, 81030-470',
      '860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, PR, 81030-470, Brasil'
    ],
    lat: -25.4934984,
    lng: -49.2765509,
    display: '860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, Paraná, 81030-470, Brasil'
  },
  {
    label: 'LOJA_LEBEBE',
    aliases: [
      'Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470',
      'Rua Deputado Neo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470',
      'Rua Deputado Néo Martins, 872, Curitiba - PR, 81030-470',
      'Rua Deputado Neo Martins, 872, Curitiba - PR, 81030-470',
      '872, Rua Deputado Néo Martins, Novo Mundo, Curitiba, PR, 81030-470, Brasil'
    ],
    lat: -25.4944568,
    lng: -49.2771426,
    display: '872, Rua Deputado Néo Martins, Novo Mundo, Curitiba, Paraná, 81030-470, Brasil'
  }
];


// Cabeçalhos educados p/ serviços OSM (evita bloqueio)
function _osmHeaders_(email){
  const h = {
    'Accept': 'application/json',
    'User-Agent': 'LeBebe-Automation/1.0 (Apps Script)'
  };
  if (email) h['From'] = String(email);
  return h;
}

const CONFIG_CACHE_MEM = {};

function _cacheConfigKey_(cfgSheet){
  try {
    return String(cfgSheet.getParent().getId()) + '|' + String(cfgSheet.getSheetId());
  } catch(e) {
    return 'default';
  }
}

/**
 * Sessão 2.0 – Funções Auxiliares
 * -------------------------------
 */
function haversineKm(a, b){
  const R=6371; // km
  const toRad = x => x*Math.PI/180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat/2)**2 +
             Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(sa));
}

// Caixa “plausível” (Curitiba + RMC). Ajuste se quiser ampliar.
const CURI_BBOX = { latMin:-25.80, latMax:-25.10, lngMin:-49.60, lngMax:-48.80 };

function _inCwbBox_(loc){
  return loc.lat >= CURI_BBOX.latMin && loc.lat <= CURI_BBOX.latMax &&
         loc.lng >= CURI_BBOX.lngMin && loc.lng <= CURI_BBOX.lngMax;
}

// Retorna o mesmo loc validado ou null se incoerente (longe demais / fora bounding box)

function validateLocationDistance_(origemLoc, loc){
  if (!loc) return null;
  const d = haversineKm(origemLoc, loc);
  if (d > MAX_POINT_KM_FROM_ORIGIN) {
    Logger.log(`⚠️ Localização incoerente: ${loc.display} → ${d.toFixed(1)} km da origem.`);
    return null;
  }
  if (!_inCwbBox_(loc)) {
    Logger.log(`⚠️ Fora da caixa Curitiba/RMC: ${loc.display} (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)})`);
    return null;
  }
  return loc;
}

function approximateByHaversine_(addr) {
  // Centro de Curitiba
  const base = { lat: -25.4284, lng: -49.2733 };
  const cepMatch = String(addr || '').match(/\b(\d{5})-(\d{3})\b/);
  if (!cepMatch) return null;

  // deslocamento pseudoaleatório por CEP (mantém dentro da região)
  const code = parseInt(cepMatch[1], 10) || 0;
  const offsetLat = ((code % 100) - 50) / 5000; // até ±0.01°
  const offsetLng = ((code % 70) - 35) / 5000;  // até ±0.007°
  const approx = {
    lat: base.lat + offsetLat,
    lng: base.lng + offsetLng,
    display: `≈ ${addr} (aprox. Haversine Curitiba)`
  };
  Logger.log(`[GEO] 🧭 fallback aproximado para ${addr}: ${approx.lat.toFixed(5)}, ${approx.lng.toFixed(5)}`);
  return approx;
}

// Extrai cidade e UF "..., Piraquara - PR, ..." → {city:"Piraquara", uf:"PR"}
function _extractCityUf_(addr){
  const s = String(addr||'');
  // tenta "Cidade - UF"
  let m = s.match(/,\s*([A-Za-zÀ-ÖØ-öø-ÿ'\s]+)\s*-\s*([A-Za-z]{2})\b/i);
  if (m) return { city: m[1].trim(), uf: m[2].toUpperCase() };
  // tenta "Cidade, UF"
  m = s.match(/,\s*([A-Za-zÀ-ÖØ-öø-ÿ'\s]+)\s*,\s*([A-Za-z]{2})\b/i);
  if (m) return { city: m[1].trim(), uf: m[2].toUpperCase() };
  return { city:'', uf:'' };
}

function _extractCep_(addr){
  const m = String(addr || '').match(/\b\d{5}-\d{3}\b/);
  return m ? m[0] : '';
}

function _normCompareText_(s){
  return stripAccents_(String(s || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _extractCityCandidates_(addr){
  const s = String(addr || '');
  const out = [];
  const byUf = s.match(/,\s*([^,]+?)\s*-\s*([A-Za-z]{2})\b/gi) || [];
  byUf.forEach(chunk => {
    const m = chunk.match(/,\s*([^,]+?)\s*-\s*([A-Za-z]{2})\b/i);
    if (m && m[1]) out.push(m[1].trim());
  });

  const parts = s.split(',').map(x => x.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++){
    if (/^[A-Za-z]{2}$/.test(parts[i]) && i > 0) out.push(parts[i-1]);
  }

  const seen = {};
  return out.filter(city => {
    const k = _normCompareText_(city);
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}


function _extractStreetCandidate_(addr){
  const parts = String(addr || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  if (/^\d+[A-Z\-\/]*$/i.test(parts[0]) && parts[1]) return parts[1];
  return parts[0];
}

function _extractNumber_(addr){
  const s = String(addr || '');

  // 1) número logo no início: "123, Rua X..."
  let m = s.match(/^\s*(\d+)\s*,/);
  if (m) return m[1];

  // 2) número entre vírgulas: "Rua X, 123, Bairro..."
  // evita capturar trecho de CEP
  m = s.match(/,\s*(\d+)\s*,/);
  if (m) return m[1];

  // 3) padrões como "nº 123", "n. 123", "numero 123"
  m = s.match(/\b(?:n[º°o]?|numero|número)\s*[:\-]?\s*(\d+)\b/i);
  if (m) return m[1];

  return '';
}

function _streetKey_(s){
  return _normCompareText_(s)
    .replace(/\bR\b/g, ' RUA ')
    .replace(/\bRUA\b/g, ' RUA ')
    .replace(/\bAV\b/g, ' AVENIDA ')
    .replace(/\bDR\b/g, ' DOUTOR ')
    .replace(/\bDRA\b/g, ' DOUTORA ')
    .replace(/\bROD\b/g, ' RODOVIA ')
    .replace(/\bAL\b/g, ' ALAMEDA ')
    .replace(/\bTV\b/g, ' TRAVESSA ')
    .replace(/\b(PRACA|PRAÇA)\b/g, ' PRACA ')
    .replace(/\bRUA\b/g, ' ')
    .replace(/\bAVENIDA\b/g, ' ')
    .replace(/\bRODOVIA\b/g, ' ')
    .replace(/\bALAMEDA\b/g, ' ')
    .replace(/\bTRAVESSA\b/g, ' ')
    .replace(/\bPRACA\b/g, ' ')
    .replace(/\bDOUTOR\b/g, ' ')
    .replace(/\bDOUTORA\b/g, ' ')
    .replace(/\bPROFESSOR\b/g, ' ')
    .replace(/\bSANTO\b/g, ' ')
    .replace(/\bSANTA\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function _streetTokens_(s){
  return _streetKey_(s).split(' ').filter(Boolean);
}

function _isStreetCompatible_(originalStreet, geoStreet){
  const a = _streetKey_(originalStreet);
  const b = _streetKey_(geoStreet);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const ta = _streetTokens_(a);
  const tbSet = {};
  _streetTokens_(b).forEach(t => tbSet[t] = true);

  let common = 0;
  ta.forEach(t => { if (tbSet[t]) common++; });

  return common >= Math.min(2, ta.length);
}

function _normalizeKnownAddress_(s){
  return _normCompareText_(s)
    .replace(/\bR\b/g, ' RUA ')
    .replace(/\bAV\b/g, ' AVENIDA ')
    .replace(/\bDR\b/g, ' DOUTOR ')
    .replace(/\bDRA\b/g, ' DOUTORA ')
    .replace(/\bBRASIL\b/g, ' ')
    .replace(/\bBRAZIL\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFixedKnownLocation_(addr){
  const norm = _normalizeKnownAddress_(addr);
  if (!norm) return null;

  for (let i = 0; i < FIXED_KNOWN_LOCATIONS.length; i++){
    const item = FIXED_KNOWN_LOCATIONS[i];
    const aliases = item.aliases || [];
    for (let j = 0; j < aliases.length; j++){
      const aliasNorm = _normalizeKnownAddress_(aliases[j]);
      if (!aliasNorm) continue;
      if (norm === aliasNorm || norm.includes(aliasNorm) || aliasNorm.includes(norm)){
        return {
          lat: item.lat,
          lng: item.lng,
          display: item.display,
          sourceLabel: item.label
        };
      }
    }
  }
  return null;
}

function validateGeocodeCoherence_(addrOriginal, loc){
  if (!loc) return false;

  if (isGenericCentroidGeocode_(addrOriginal, loc)) {
    return false;
  }

  const original = String(addrOriginal || '');
  const display  = String(loc.display || '');

  const ufOrigInfo = _extractCityUf_(original);
  const ufGeoInfo  = _extractCityUf_(display);
  if (ufOrigInfo.uf && ufGeoInfo.uf && ufOrigInfo.uf !== ufGeoInfo.uf) {
    Logger.log(`⚠️ UF divergente: original="${ufOrigInfo.uf}" | geo="${ufGeoInfo.uf}" | geoDisplay="${display}"`);
    return false;
  }

  const origCities = _extractCityCandidates_(original);
  const geoCities  = _extractCityCandidates_(display);
  if (origCities.length && geoCities.length) {
    const geoNorms = geoCities.map(_normCompareText_);
    const hasMatch = origCities.some(c => geoNorms.includes(_normCompareText_(c)));
    if (!hasMatch) {
      Logger.log(`⚠️ Cidade divergente: original="${origCities.join(' | ')}" | geo="${geoCities.join(' | ')}" | geoDisplay="${display}"`);
      return false;
    }
  }

  const nOrig = _extractNumber_(original);
  const nGeo  = _extractNumber_(display);
  if (nOrig && nGeo && nOrig !== nGeo) {
    Logger.log(`⚠️ Número divergente: original="${nOrig}" | geo="${nGeo}" | geoDisplay="${display}"`);
    return false;
  }

  const streetOrig = _extractStreetCandidate_(original);
  const streetGeo  = _extractStreetCandidate_(display);
  if (streetOrig && streetGeo && !_isStreetCompatible_(streetOrig, streetGeo)) {
    Logger.log(`⚠️ Logradouro divergente: original="${streetOrig}" | geo="${streetGeo}" | geoDisplay="${display}"`);
    return false;
  }

  const cepOrig = _extractCep_(original);
  const cepGeo  = _extractCep_(display);
  if (cepOrig && cepGeo && cepOrig !== cepGeo) {
    Logger.log(`ℹ️ CEP divergente, mas mantido porque rua/número/cidade bateram: original="${cepOrig}" | geo="${cepGeo}" | geoDisplay="${display}"`);
  }

  return true;
}

function buildMapsLinkFromAddresses_(origemTexto, orderedPoints){
  const parts = [String(origemTexto || '').trim()]
    .concat((orderedPoints || []).map(p => String(p.addrOriginal || p.addrGeo || '').trim()))
    .filter(Boolean);

  return 'https://www.google.com/maps/dir/' + parts.map(encodeURIComponent).join('/');
}

function formatarLinhaPonto_(p){
  const original = String((p && p.addrOriginal) || '').trim();
  const geo      = String((p && p.addrGeo) || '').trim();

  if (!original && !geo) return '';
  if (!original) return geo;
  if (!geo) return original;

  const o = _normCompareText_(original);
  const g = _normCompareText_(geo);
  if (o && g && o === g) return original;

  return `${original}\n  ↳ GEO: ${geo}`;
}

// CEP-first com país BR e viés por cidade/UF quando disponível
function reGeocodeByCep_(addr, cfgSheet, forceRefresh){
  const m = String(addr||'').match(/\b\d{5}-\d{3}\b/);
  if (!m) return null;

  const cep = m[0];
  const hint = _extractCityUf_(addr);
  const qCepCityUF = [cep, hint.city, hint.uf, 'Brasil'].filter(Boolean).join(', ');
  const qCepBR     = `${cep}, Brasil`;
  let loc = null, providerUsed = 'none';

  // ===== LocationIQ (com país BR) =====
  try{
    const lqKey = String(getConfig('LOCATIONIQ API KEY', cfgSheet) || '').trim();
    if (lqKey){
      const base = LOCATIONIQ_URL;
      // 1ª tentativa: CEP + cidade/UF
      const qs1 = `key=${encodeURIComponent(lqKey)}&q=${encodeURIComponent(qCepCityUF)}&format=json&limit=1&addressdetails=1&countrycodes=br&normalizecity=1`;
      let r = UrlFetchApp.fetch(base + '?' + qs1, { muteHttpExceptions:true, timeout:15000 });
      if (r.getResponseCode() === 200){
        const j = JSON.parse(r.getContentText());
        if (Array.isArray(j) && j.length){
          const p = j[0];
          loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||qCepCityUF) };
          providerUsed = 'locationiq (cep+city/uf)';
        }
      }
      // 2ª: só CEP (BR)
      if (!loc){
        const qs2 = `key=${encodeURIComponent(lqKey)}&q=${encodeURIComponent(qCepBR)}&format=json&limit=1&addressdetails=1&countrycodes=br&normalizecity=1`;
        r = UrlFetchApp.fetch(base + '?' + qs2, { muteHttpExceptions:true, timeout:15000 });
        if (r.getResponseCode() === 200){
          const j = JSON.parse(r.getContentText());
          if (Array.isArray(j) && j.length){
            const p = j[0];
            loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||qCepBR) };
            providerUsed = 'locationiq (cep)';
          }
        }
      }
    }
  }catch(e){ Logger.log('⚠️ reGeocodeByCep_ (LocationIQ) falhou: '+e); }

  // ===== Nominatim (com país BR) =====
  if (!loc){
    try{
      const nomEmail = String(getConfig('NOMINATIM EMAIL', cfgSheet) || '').trim();
      const base = NOMINATIM_URL;
      // 1ª: CEP + cidade/UF
      let params = { q: qCepCityUF, format:'json', addressdetails:'1', limit:'1', email:nomEmail||'', countrycodes:'br' };
      let qs = Object.keys(params).map(k=>k+'='+encodeURIComponent(params[k])).join('&');
      let r  = UrlFetchApp.fetch(base + '?' + qs, { muteHttpExceptions:true, headers:_osmHeaders_(nomEmail), timeout:15000 });
      if (r.getResponseCode() === 200){
        const j = JSON.parse(r.getContentText());
        if (Array.isArray(j) && j.length){
          const p = j[0];
          loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||qCepCityUF) };
          providerUsed = 'nominatim (cep+city/uf)';
        }
      }
      // 2ª: só CEP (BR)
      if (!loc){
        params = { q: qCepBR, format:'json', addressdetails:'1', limit:'1', email:nomEmail||'', countrycodes:'br' };
        qs = Object.keys(params).map(k=>k+'='+encodeURIComponent(params[k])).join('&');
        r  = UrlFetchApp.fetch(base + '?' + qs, { muteHttpExceptions:true, headers:_osmHeaders_(nomEmail), timeout:15000 });
        if (r.getResponseCode() === 200){
          const j = JSON.parse(r.getContentText());
          if (Array.isArray(j) && j.length){
            const p = j[0];
            loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||qCepBR) };
            providerUsed = 'nominatim (cep)';
          }
        }
      }
    }catch(e){ Logger.log('⚠️ reGeocodeByCep_ (Nominatim) falhou: '+e); }
  }

  Logger.log(`[GEO-CEP] ${loc ? '✅ OK' : '❌ FAIL'} via ${providerUsed} para ${qCepCityUF}`);
  return loc;
}

function normalizeLocation_(s){
  // normaliza para assinatura estável
  return String(s||'')
    .trim()
    .replace(/\s+/g,' ')        // espaços múltiplos -> 1
    .toUpperCase();             // case-insensitive
}
function md5Hex(str){
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str);
  return b.map(x => ('0' + (x & 0xFF).toString(16)).slice(-2)).join('');
}
function toYmd(d){ return Utilities.formatDate(onlyDate(d), 'GMT-3', 'yyyy-MM-dd'); }

// Qual equipe pelo índice do calendário monitorado

function teamFromCalId(calId){
  const i = MONITOR_CAL_IDS.indexOf(calId);
  if (i < 0) return null;
  return i <= 2 ? 'EQUIPE 1' : 'EQUIPE 2';
}

function isOurDeslocEvent_(evt) {
  const t = String(
    (evt && (evt.summary || evt.title)) || ''
  ).toUpperCase();

  return (
    t.includes('DESLOCAMENTO') ||
    t.includes('ROTA PARCIAL') ||
    t.includes('FALHA ROTA')
  );
}

function isGenericCentroidGeocode_(addrOriginal, loc){
  if (!loc) return true;

  const displayRaw = String(loc.display || '').trim();
  const display = _normCompareText_(displayRaw);
  const original = String(addrOriginal || '').trim();

  if (!display) return true;

  // 1) bloqueia retornos explicitamente aproximados
  if (/\bAPROX\b/.test(display)) {
    Logger.log(`⚠️ GEO genérico bloqueado por retorno aproximado: "${displayRaw}"`);
    return true;
  }

  // 2) bloqueia centróides clássicos
  for (const term of GEO_GENERIC_TERMS){
    if (display.includes(_normCompareText_(term))) {
      Logger.log(`⚠️ GEO genérico bloqueado por termo centróide: "${displayRaw}"`);
      return true;
    }
  }

  const streetOrig = _extractStreetCandidate_(original);
  const streetGeo  = _extractStreetCandidate_(displayRaw);

  const hasStreetOrig = !!_streetKey_(streetOrig);
  const hasStreetGeo  = !!_streetKey_(streetGeo);
  const streetMatches = hasStreetOrig && hasStreetGeo && _isStreetCompatible_(streetOrig, streetGeo);

  // 3) se o original tem número e o geo não tem,
  // só bloquear se também NÃO houver rua compatível
  const nOrig = _extractNumber_(original);
  const nGeo  = _extractNumber_(displayRaw);

  if (nOrig && !nGeo && !streetMatches) {
    Logger.log(`⚠️ GEO genérico bloqueado: original tem número, geo não tem e rua não é compatível. original="${original}" | geo="${displayRaw}"`);
    return true;
  }

  // 4) se tem rua nas duas pontas e não bate, bloquear
  if (hasStreetOrig && hasStreetGeo && !streetMatches) {
    Logger.log(`⚠️ GEO genérico bloqueado: logradouro incompatível. original="${streetOrig}" | geo="${streetGeo}" | geoDisplay="${displayRaw}"`);
    return true;
  }

  // 5) retorno pobre demais
  const parts = displayRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (parts.length < GEO_MIN_CONFIDENCE_ADDR_PARTS) {
    Logger.log(`⚠️ GEO genérico bloqueado: poucas partes no endereço geocodificado: "${displayRaw}"`);
    return true;
  }

  // 6) retorno regional demais: sem rua e sem número
  const hasOnlyRegionalInfo =
    !nGeo &&
    !hasStreetGeo &&
    parts.length <= 4;

  if (hasOnlyRegionalInfo) {
    Logger.log(`⚠️ GEO genérico bloqueado: retorno apenas regional: "${displayRaw}"`);
    return true;
  }

  return false;
}

function buildMapsLinkFromAddresses_(origemTexto, orderedPoints){
  const parts = [String(origemTexto || '').trim()]
    .concat((orderedPoints || []).map(p => String(p.addrOriginal || p.addrGeo || '').trim()))
    .filter(Boolean);

  return 'https://www.google.com/maps/dir/' + parts.map(encodeURIComponent).join('/');
}

function sanitizeAddressForMaps_(addr){
  return String(addr || '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}


function getConfig(prop, cfgSheet) {
  const cacheKey = _cacheConfigKey_(cfgSheet);
  if (!CONFIG_CACHE_MEM[cacheKey]) {
    const rows = cfgSheet.getDataRange().getValues();
    const map = {};
    for (let i = 0; i < rows.length; i++) {
      const k = String(rows[i][0] || '').trim();
      if (!k) continue;
      map[k] = String(rows[i][1] || '');
    }
    CONFIG_CACHE_MEM[cacheKey] = map;
  }

  if (!(prop in CONFIG_CACHE_MEM[cacheKey])) {
    throw new Error(`Config "${prop}" não encontrada`);
  }

  return CONFIG_CACHE_MEM[cacheKey][prop];
}

function normTeam(s) {
  s = String(s||'').toUpperCase();
  if (/EQUIPE\s*0?1|EQP\s*0?1/.test(s)) return 'EQUIPE 1';
  if (/EQUIPE\s*0?2|EQP\s*0?2/.test(s)) return 'EQUIPE 2';
  return null;
}
function onlyDate(d) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}

function osrmHealthWarmup(cfgSheet){
  const base = _getOsrmBase_(cfgSheet);
  try{
    try{
      const h = UrlFetchApp.fetch(base + '/health', {muteHttpExceptions:true, timeout: 10000});
      if (h.getResponseCode() === 200) return true;
    }catch(e){}
    const a = {lat:-25.4284, lng:-49.2733}, b = {lat:-25.4352, lng:-49.2767};
    const r = osrmRoute_(a,b,cfgSheet,true);
    return r.km >= 0;
  }catch(e){
    Logger.log('⚠️ Warmup OSRM falhou: '+e);
    return false;
  }
}

function stripAccents_(s){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

// Geocode simples BR (maps.co → nominatim) sem cache/validação pesada
function _geocodeSimpleBR_(q, cfgSheet){
  try {
    const mapscoKey = String(getConfig('MAPS.CO API KEY', cfgSheet) || '').trim();
    const url = MAPSCO_URL + '?q=' + encodeURIComponent(q) + (mapscoKey ? ('&api_key=' + mapscoKey) : '');
    let r = UrlFetchApp.fetch(url, { muteHttpExceptions:true, timeout:12000 });
    if (r.getResponseCode() === 200){
      const j = JSON.parse(r.getContentText());
      if (Array.isArray(j) && j.length){
        const p = j[0];
        return { lat:+p.lat, lng:+p.lon, display:String(p.display_name||q) };
      }
    }
  } catch(e){}
  try {
    const nomEmail = String(getConfig('NOMINATIM EMAIL', cfgSheet) || '').trim();
    const params = { q, format:'json', addressdetails:'1', limit:'1', email:nomEmail||'', countrycodes:'br' };
    const qs = Object.keys(params).map(k=>k+'='+encodeURIComponent(params[k])).join('&');
    const r  = UrlFetchApp.fetch(NOMINATIM_URL + '?' + qs, { muteHttpExceptions:true, headers:_osmHeaders_(nomEmail), timeout:12000 });
    if (r.getResponseCode() === 200){
      const j = JSON.parse(r.getContentText());
      if (Array.isArray(j) && j.length){
        const p = j[0];
        return { lat:+p.lat, lng:+p.lon, display:String(p.display_name||q) };
      }
    }
  } catch(e){}
  return null;
}

function approximateByHaversineForCep_(cep, addrHint, cfgSheet){
  // Desativado de propósito.
  // Aproximação por CEP puro está gerando falso positivo operacional.
  // Melhor falhar do que criar rota errada.
  return null;
}

function deleteDeslocamentoEventsForDayTeam_(dia, team){
  try {
    const calId = (team === 'EQUIPE 1') ? CAL_DESLOC_E1 : CAL_DESLOC_E2;
    const cal   = CalendarApp.getCalendarById(calId);
    const eventsDay = cal.getEventsForDay(dia);

    const candidatos = eventsDay.filter(e => {
      const t = String(e.getTitle() || '').toUpperCase();
      return t.includes('DESLOCAMENTO') && t.includes(team);
    });

    candidatos.forEach(ev => ev.deleteEvent());

    if (candidatos.length) {
      Logger.log(`🗑️ Evento(s) antigos de deslocamento removidos: ${candidatos.length} | ${formatDatePt(dia)} | ${team}`);
    }
  } catch (e) {
    Logger.log(`⚠️ Falha ao remover evento antigo de deslocamento: ${e.message}`);
  }
}

function geocodeAddress(addr, cfgSheet, skipCache=false) {
  const addrOriginal = String(addr || '').trim();
  if (!addrOriginal) return null;

  let addrBusca = addrOriginal;
  if (!/brasil|brazil/i.test(addrBusca)) addrBusca += ', Brasil';

  Logger.log(`[GEO-INPUT] original="${addrOriginal}" | busca="${addrBusca}"`);

  let origemLoc = null;
  try {
    const depo = String(getConfig('ENDEREÇO DO DEPÓSITO', cfgSheet) || '').trim();
    if (depo) {
      const fixedDepo = getFixedKnownLocation_(depo);
      if (fixedDepo) {
        origemLoc = { lat: fixedDepo.lat, lng: fixedDepo.lng, display: fixedDepo.display };
      } else {
        const depoAddr = depo + (/(brasil|brazil)/i.test(depo) ? '' : ', Brasil');
        try {
          const mapscoKey = String(getConfig('MAPS.CO API KEY', cfgSheet) || '').trim();
          const url = MAPSCO_URL + '?q=' + encodeURIComponent(depoAddr) + (mapscoKey ? ('&api_key=' + mapscoKey) : '');
          const r   = UrlFetchApp.fetch(url, { muteHttpExceptions:true, timeout:10000 });
          if (r.getResponseCode() === 200) {
            const j = JSON.parse(r.getContentText());
            if (Array.isArray(j) && j.length) {
              const p = j[0];
              origemLoc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||depoAddr) };
            }
          }
        } catch(e) {}
      }
    }
  } catch(e) {}

  if (!origemLoc) {
    origemLoc = { lat: -25.49350, lng: -49.27655, display: 'Depósito (fallback)' };
  }

  const cache = CacheService.getScriptCache();
  const keyRaw = 'GEO_' + md5Hex(addrBusca);

  if (!skipCache) {
    const hit = cache.get(keyRaw);
    if (hit) {
      try {
        const cached = JSON.parse(hit);
        if (
          validateLocationDistance_(origemLoc, cached) &&
          validateGeocodeCoherence_(addrOriginal, cached) &&
          !isGenericCentroidGeocode_(addrOriginal, cached)
        ) {
          Logger.log(`[GEO-CACHE] ✅ ${cached.display}`);
          return cached;
        }
        Logger.log(`[GEO-CACHE] ⚠️ ignorado por incoerência: ${cached.display || addrOriginal}`);
      } catch(e){}
    }
  }

  let mapscoKey = '', nomEmail = '', lqKey = '';
  try { mapscoKey = String(getConfig('MAPS.CO API KEY', cfgSheet) || '').trim(); } catch(e){}
  try { nomEmail  = String(getConfig('NOMINATIM EMAIL', cfgSheet) || '').trim(); } catch(e){}
  try { lqKey     = String(getConfig('LOCATIONIQ API KEY', cfgSheet) || '').trim(); } catch(e){}

  function _acceptAndCache_(loc, srcLabel){
    const valid = validateLocationDistance_(origemLoc, loc);
    if (!valid) {
      Logger.log(`[GEO] ❌ ${srcLabel} rejeitado por distância/box: ${loc.display}`);
      return null;
    }
    if (!validateGeocodeCoherence_(addrOriginal, valid)) {
      Logger.log(`[GEO] ❌ ${srcLabel} rejeitado por divergência semântica: ${valid.display}`);
      return null;
    }
    if (isGenericCentroidGeocode_(addrOriginal, valid)) {
      Logger.log(`[GEO] ❌ ${srcLabel} rejeitado por centróide/genérico: ${valid.display}`);
      return null;
    }
    cache.put(keyRaw, JSON.stringify(valid), GEO_TTL_SECS);
    Logger.log(`[GEO] ✅ ${srcLabel} OK: original="${addrOriginal}" | geo="${valid.display}" | lat=${valid.lat}, lng=${valid.lng}`);
    return valid;
  }

  // 1) Maps.co
  try {
    const url = MAPSCO_URL + '?q=' + encodeURIComponent(addrBusca) + (mapscoKey ? ('&api_key=' + mapscoKey) : '');
    Logger.log(`[GEO-TRY] provider=maps.co query="${addrBusca}"`);
    const r   = UrlFetchApp.fetch(url, { muteHttpExceptions:true, timeout:15000 });
    if (r.getResponseCode() === 200) {
      const j = JSON.parse(r.getContentText());
      if (Array.isArray(j) && j.length) {
        const p = j[0];
        const loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||addrBusca) };
        const ok = _acceptAndCache_(loc, 'maps.co');
        if (ok) return ok;
      }
    }
  } catch(e) {
    Logger.log('⚠️ maps.co falhou: ' + e);
  }

  // 2) Nominatim
  try {
    const params = { q: addrBusca, format:'json', addressdetails:'1', limit:'1', email:nomEmail||'', countrycodes:'br' };
    const qs = Object.keys(params).map(k=>k+'='+encodeURIComponent(params[k])).join('&');
    Logger.log(`[GEO-TRY] provider=nominatim query="${addrBusca}"`);
    const r  = UrlFetchApp.fetch(NOMINATIM_URL + '?' + qs, {
      muteHttpExceptions:true,
      headers:_osmHeaders_(nomEmail),
      timeout:15000
    });
    if (r.getResponseCode() === 200) {
      const j = JSON.parse(r.getContentText());
      if (Array.isArray(j) && j.length) {
        const p = j[0];
        const loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||addrBusca) };
        const ok = _acceptAndCache_(loc, 'nominatim');
        if (ok) return ok;
      }
    }
  } catch(e) {
    Logger.log('⚠️ Nominatim falhou: ' + e);
  }

  // 3) LocationIQ
  try {
    if (lqKey) {
      const params = { key:lqKey, q:addrBusca, format:'json', addressdetails:'1', limit:'1', countrycodes:'br', normalizecity:'1' };
      const qs = Object.keys(params).map(k=>k+'='+encodeURIComponent(params[k])).join('&');
      Logger.log(`[GEO-TRY] provider=locationiq query="${addrBusca}"`);
      const r  = UrlFetchApp.fetch(LOCATIONIQ_URL + '?' + qs, { muteHttpExceptions:true, timeout:15000 });
      if (r.getResponseCode() === 200) {
        const j = JSON.parse(r.getContentText());
        if (Array.isArray(j) && j.length) {
          const p = j[0];
          const loc = { lat:+p.lat, lng:+p.lon, display:String(p.display_name||addrBusca) };
          const ok = _acceptAndCache_(loc, 'locationiq');
          if (ok) return ok;
        } else {
          Logger.log('[GEO] ❌ locationiq vazio para: ' + addrBusca);
        }
      }
    } else {
      Logger.log('[GEO] (locationiq) chave ausente no config');
    }
  } catch(e) {
    Logger.log('⚠️ LocationIQ falhou: ' + e);
  }

  // 4) fallback por CEP ainda pode tentar, mas só se for realmente coerente
  const cepMatch = String(addrOriginal).match(/\b\d{5}-\d{3}\b/);
  if (cepMatch) {
    const byCep = reGeocodeByCep_(addrOriginal, cfgSheet, true);
    if (byCep) {
      const ok = _acceptAndCache_(byCep, 'fallback CEP');
      if (ok) return ok;
      Logger.log('[GEO] ⚠️ fallback CEP rejeitado: ' + byCep.display);
    }
  }

  // 5) tenta sem acento
  const noAcc = stripAccents_(addrOriginal);
  if (noAcc && noAcc !== addrOriginal) {
    const loc = geocodeAddress(noAcc, cfgSheet, true);
    if (loc) return loc;
  }

  // 6) NÃO usa mais fallback aproximado final
  Logger.log('[GEO] ❌ falhou para: ' + addrOriginal);
  return null;
}

function _getOsrmBase_(cfgSheet){
  try {
    const raw = String(getConfig('OSRM BASE URL', cfgSheet) || '').trim();
    return raw ? raw.replace(/\/+$/,'') : OSRM_DEFAULT_BASE;
  } catch(e){
    return OSRM_DEFAULT_BASE;
  }
}

/** Chama OSRM /route; retorna {km, durationSec} */
function osrmRoute_(a, b, cfgSheet, skipCache=false){
  const base = _getOsrmBase_(cfgSheet);
  // Cache por par de coordenadas (5 casas decimais)
  const key  = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  const c    = CacheService.getScriptCache();
  if (!skipCache){
    const h = c.get('OSRM:'+key);
    if (h) return JSON.parse(h);
  }

  // OSRM espera lon,lat (atenção!)
  const aStr = `${a.lng},${a.lat}`;
  const bStr = `${b.lng},${b.lat}`;
  const url  = `${base}/route/v1/driving/${aStr};${bStr}?overview=false&alternatives=false&steps=false`;

  try{
    const r  = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    if (r.getResponseCode() !== 200) throw new Error('OSRM HTTP '+r.getResponseCode());
    const j  = JSON.parse(r.getContentText());
    if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('OSRM code '+j.code);
    const rt = j.routes[0];
    const out = { km: (rt.distance||0)/1000, durationSec: Math.round(rt.duration||0) };
    c.put('OSRM:'+key, JSON.stringify(out), DIST_TTL_SECS);
    return out;
  } catch(e){
    Logger.log('⚠️ OSRM falhou: '+e);
    // fallback "zero" para não quebrar fluxo
    return { km: 0, durationSec: 0 };
  }
}

/** Compat: devolve só km (mantém assinatura antiga em quem chama) */
function getDrivingKm(a, b, cfgSheet, skipCache=false){
  return osrmRoute_(a,b,cfgSheet,skipCache).km;
}

function calcularTempoKm(distKm, usaRodovia) {
  const speed = usaRodovia?50:40;
  const mins = Math.round(distKm*60/speed);
  const h = Math.floor(mins/60), m = mins%60;
  return ('0'+h).slice(-2)+('0'+m).slice(-2);
}

function haversineRouteKm(origemLoc, orderedPoints){
  if (!origemLoc) return 0;
  let total = 0;
  let prev = origemLoc;
  (orderedPoints || []).forEach(p => {
    if (!p || !p.loc) return;
    total += haversineKm(prev, p.loc);
    prev = p.loc;
  });
  return total;
}

function rotaOtimizada(origin, pontos, cfgSheet, skipCache=false){
  if (!pontos.length) {
    return { km:0, order:['DEPÓSITO'], orderOriginal:['DEPÓSITO'], orderedPoints:[] };
  }

  if (pontos.length === 1){
    const p = pontos[0];
    return {
      km: getDrivingKm(origin, p.loc, cfgSheet, skipCache),
      order: ['DEPÓSITO', p.addrGeo || p.loc.display || p.addrOriginal],
      orderOriginal: ['DEPÓSITO', p.addrOriginal || p.addrGeo || p.loc.display],
      orderedPoints: [p]
    };
  }

  let rest = [...pontos], ord = [], cur = { loc: origin };
  while (rest.length){
    rest.sort((a,b)=>
      Math.hypot(cur.loc.lat-a.loc.lat, cur.loc.lng-a.loc.lng)
      - Math.hypot(cur.loc.lat-b.loc.lat, cur.loc.lng-b.loc.lng)
    );
    cur = rest.shift();
    ord.push(cur);
  }

  for(let it=0; it<12; it++){
    let improved = false;
    for(let i=0; i<ord.length-2; i++){
      for(let k=i+1; k<ord.length-1; k++){
        const A = i===0 ? origin : ord[i-1].loc;
        const B = ord[i].loc;
        const C = ord[k].loc;
        const D = ord[k+1].loc;
        const before = getDrivingKm(A,B,cfgSheet,skipCache) + getDrivingKm(C,D,cfgSheet,skipCache);
        const after  = getDrivingKm(A,C,cfgSheet,skipCache) + getDrivingKm(B,D,cfgSheet,skipCache);
        if (after < before){
          ord.splice(i, k-i+1, ...ord.slice(i, k+1).reverse());
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  let tot = 0, prev = { loc: origin };
  ord.forEach(p => {
    tot += getDrivingKm(prev.loc, p.loc, cfgSheet, skipCache);
    prev = p;
  });

  return {
    km: tot,
    order: ['DEPÓSITO', ...ord.map(p => p.addrGeo || p.loc.display || p.addrOriginal)],
    orderOriginal: ['DEPÓSITO', ...ord.map(p => p.addrOriginal || p.addrGeo || p.loc.display)],
    orderedPoints: ord
  };
}

function getRoundedTime(distKm){
  const m=[
    {km:21,time:'00:00'},
    {km:35,time:'00:30'},
    {km:51,time:'00:45'},
    {km:61,time:'01:00'},
    {km:75,time:'01:30'},
    {km:91,time:'02:00'},
    {km:105,time:'02:30'},
    {km:120,time:'03:00'},
    {km:151,time:'03:30'}
  ];
  for(const x of m) if(distKm<=x.km) return x.time;
  return m[m.length-1].time;
}

function getStructuredAddress(addr){
  addr = String(addr || '').trim();
  if (!addr) return '';

  // normalização leve, sem desmontar demais o endereço
  addr = addr.replace(/\s-\s/g, ', ');
  addr = addr.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').replace(/,+/g, ', ');

  // mantém mais partes para não perder cidade/bairro/cep
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  let out = parts.join(', ');
  if (!/brasil|brazil/i.test(out)) out += ', Brasil';
  return out;
}


function coletarPontosDoDia(slot, agVals, agDisp, cfgSheet){
  const pts = [];
  for(let i=0; i<agVals.length; i++){
    const d = agVals[i][0];
    if (!(d instanceof Date) || onlyDate(d).getTime() !== onlyDate(slot.dia || slot.date).getTime()) continue;
    if (normTeam(agDisp[i][6]) !== slot.team) continue;

    let fullAddr = (agDisp[i][5] || '').trim();
    if (!fullAddr){
      const obs = agDisp[i][4] || '';
      const m = obs.match(/ENDEREÇO:[^0-9]*(\d+.*?\d{5}-\d{3})/i);
      if (!m) continue;
      fullAddr = m[1].trim();
    }

    const structured = getStructuredAddress(fullAddr);

    let loc = geocodeAddress(fullAddr, cfgSheet, false);
    if (!loc && structured && structured !== fullAddr) loc = geocodeAddress(structured, cfgSheet, false);

    if (loc){
      pts.push({
        addrOriginal: fullAddr,
        addrGeo: loc.display || fullAddr,
        loc
      });
    }
  }
  return pts;
}

function formatDatePt(d){
  const ds=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  return Utilities.formatDate(d,'GMT-3','dd/MM')+` (${ds[d.getDay()]})`;
}

function getMainSpreadsheet_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch(e){}
  return SpreadsheetApp.openById('1H8mFLzEL8XcFh0UX_hOJF-ublRZcdbhwLc7ooNEeJ5U');
}

/** Lê a aba de agenda e adiciona chaves yyyy-mm-dd|EQUIPE com assinaturas (endereços) */
function _collectSheetSlots_(tMin, tMax){
  const outSlots = {};   // key -> { dia, team }
  const outSig   = {};   // key -> array de assinaturas (endereços normalizados)

  const ss   = getMainSpreadsheet_();
  const cfg  = ss.getSheets().find(s => s.getSheetId() === CFG_SHEET_ID)
           || ss.getSheets().find(s => s.getName().toUpperCase().includes('CONTROLES E CONFIGURAÇÕES'));
  if(!cfg) return {slots:{}, sigBag:{}};

  const AGENDA = getConfig('PLANILHA DA AGENDA', cfg);
  const shAg   = ss.getSheetByName(AGENDA);
  if(!shAg) return {slots:{}, sigBag:{}};

  const rowsAg = shAg.getLastRow() - 1;
  if (rowsAg <= 0) return {slots:{}, sigBag:{}};

  const agVals = shAg.getRange(2, 1, rowsAg, 7).getValues();        // A:G (DATA, FIM, DESC, DUR, OBS, LUGAR, EQUIPE)
  const agDisp = shAg.getRange(2, 1, rowsAg, 7).getDisplayValues();

  for (let i=0;i<agVals.length;i++){
    const d = agVals[i][0];
    if (!(d instanceof Date)) continue;
    const day = onlyDate(d);
    if (day.getTime() < onlyDate(tMin).getTime() || day.getTime() >= onlyDate(tMax).getTime()) continue;
    if (day.getDay() === 0) continue; // domingo fora

    const team = normTeam(agDisp[i][6]); // col G = equipe
    if (!team) continue;

    // endereço: preferir LUGAR; se vazio, extrair de OBS
    let addr = (agDisp[i][5] || '').trim();
    if (!addr) {
      const obs = agDisp[i][4] || '';
      const m = obs.match(/ENDEREÇO:[^0-9]*(\d+.*?\d{5}-\d{3})/i);
      if (m) addr = m[1].trim();
    }
    // sem endereço não assina
    const key = `${toYmd(day)}|${team}`;
    if (!outSlots[key]) outSlots[key] = { dia: day, team };
    if (!outSig[key])   outSig[key]   = [];
    outSig[key].push(normalizeLocation_(addr||'')); // pode ser vazio; ainda ajuda a assinatura
  }

  // coloca o token de origem (depósito vs. casa) pra diferenciar sábado
  Object.keys(outSlots).forEach(key=>{
    const {dia, team} = outSlots[key];
    const originToken = (dia.getDay() === 6)
      ? `ORIGEM=CASA_${team === 'EQUIPE 1' ? 'E1' : 'E2'}`
      : 'ORIGEM=DEPOSITO';
    (outSig[key] || (outSig[key] = [])).push(originToken);
  });

  return {slots: outSlots, sigBag: outSig};
}

function buildMapsLinkFromCoords_(origemLoc, orderedPoints){
  const coords = [`${origemLoc.lat},${origemLoc.lng}`]
    .concat((orderedPoints || []).map(p => `${p.loc.lat},${p.loc.lng}`));
  return 'https://www.google.com/maps/dir/' + coords.map(encodeURIComponent).join('/');
}

/**
 * Sessão 3.0 – Recalcula somente os dias/equipes necessários
 * ----------------------------------------------------------
 */

function recalcDeslocamentoDiaEquipe(dia, team, forceRefresh) {
  if (onlyDate(dia).getDay() === 0) {
    Logger.log(`⏭️ Domingo detectado: ${formatDatePt(dia)} | ${team} — não recalcula.`);
    return;
  }

  const hoje = onlyDate(new Date());
  const diaMs = onlyDate(dia).getTime();
  const dMin = hoje.getTime() + WINDOW_DAYS_MIN * 24 * 3600 * 1000;
  const dMax = hoje.getTime() + WINDOW_DAYS_MAX * 24 * 3600 * 1000;
  if (diaMs < dMin || diaMs > dMax) {
    Logger.log(`⏭️ Ignorado ${formatDatePt(dia)} (${team}) — fora da janela D+${WINDOW_DAYS_MIN} a D+${WINDOW_DAYS_MAX}`);
    return;
  }

  const ss = getMainSpreadsheet_();
  let cfg = ss.getSheets().find(s => s.getSheetId() === CFG_SHEET_ID);
  if (!cfg) {
    cfg = ss.getSheets().find(s =>
      s.getName().toUpperCase().includes('CONTROLES E CONFIGURAÇÕES')
    );
  }

  osrmHealthWarmup(cfg);
  const AGENDA = getConfig('PLANILHA DA AGENDA', cfg);
  const shAg   = ss.getSheetByName(AGENDA);
  if (!shAg) return;

  const rowsAg = shAg.getLastRow() - 1;
  if (rowsAg <= 0) return;

  const agVals = shAg.getRange(2, 1, rowsAg, 7).getValues();
  const agDisp = shAg.getRange(2, 1, rowsAg, 7).getDisplayValues();

  Logger.log(`--- Recalc ${formatDatePt(dia)} | ${team} ---`);

  const rawAddrs = [];
  for (let i = 0; i < agVals.length; i++) {
    const d = agVals[i][0];
    if (!(d instanceof Date) || onlyDate(d).getTime() !== onlyDate(dia).getTime()) continue;
    if (normTeam(agDisp[i][6]) !== team) continue;

    let addr = (agDisp[i][5] || '').trim();
    if (!addr) {
      const obs = agDisp[i][4] || '';
      const m = obs.match(/ENDEREÇO:[^0-9]*(\d+.*?\d{5}-\d{3})/i);
      if (m) addr = m[1].trim();
    }
    if (addr) rawAddrs.push(addr);
  }

  if (!rawAddrs.length) {
    Logger.log(`⚠️ Nenhum endereço para ${formatDatePt(dia)} | ${team}`);
    deleteDeslocamentoEventsForDayTeam_(dia, team);
    return;
  }

  const pontos = [];
  rawAddrs.forEach(fullAddr => {
    const fullNorm = String(fullAddr || '').trim();
    const structured = getStructuredAddress(fullNorm);
    let loc = null;

    if (fullNorm) loc = geocodeAddress(fullNorm, cfg, forceRefresh);
    if (!loc && structured && structured !== fullNorm) loc = geocodeAddress(structured, cfg, forceRefresh);

    if (!loc) {
      const noAcc = stripAccents_(fullNorm);
      if (noAcc && noAcc !== fullNorm) loc = geocodeAddress(noAcc, cfg, true);
    }

    if (loc && !isGenericCentroidGeocode_(fullAddr, loc)) {
      pontos.push({
        addrOriginal: fullAddr,
        addrGeo: loc.display || fullAddr,
        loc
      });
      Logger.log(`[GEO-FINAL] original="${fullAddr}" | geo="${loc.display}" | lat=${loc.lat}, lng=${loc.lng}`);
    } else {
      Logger.log(`⚠️ Geocode falhou ou foi considerado genérico p/ endereço: "${fullAddr}" (dia ${formatDatePt(dia)} | ${team})`);
    }
  });

  const seenAddrs = new Set();
  const pontosBase = [];
  for (const p of pontos){
    const key = normalizeLocation_(p.addrOriginal);
    if (seenAddrs.has(key)) {
      Logger.log(`↪️ Endereço duplicado ignorado: "${p.addrOriginal}"`);
      continue;
    }
    seenAddrs.add(key);
    pontosBase.push(p);
  }

  const HOME_E1 = getConfig('ENDEREÇO DA CASA EQP 1', cfg);
  const HOME_E2 = getConfig('ENDEREÇO DA CASA EQP 2', cfg);
  const DEPOSIT = getConfig('ENDEREÇO DO DEPÓSITO', cfg);

  const origemStr = (dia.getDay() === 6)
    ? (team === 'EQUIPE 1' ? HOME_E1 : HOME_E2)
    : DEPOSIT;

  let origemLoc = getFixedKnownLocation_(origemStr);
  if (origemLoc) {
    origemLoc = { lat: origemLoc.lat, lng: origemLoc.lng, display: origemLoc.display };
    Logger.log(`[GEO-ORIGEM-FIXA] ✅ ${team}: ${origemLoc.display} | lat=${origemLoc.lat}, lng=${origemLoc.lng}`);
  } else {
    origemLoc = geocodeAddress(origemStr, cfg, forceRefresh);
  }

  if (!origemLoc) {
    Logger.log(`🔴 Origem não geocodificada para ${team}.`);
    deleteDeslocamentoEventsForDayTeam_(dia, team);
    return;
  }

  if (!pontosBase.length) {
    Logger.log(`⚠️ Nenhum ponto válido para rota em ${formatDatePt(dia)} | ${team}`);
    deleteDeslocamentoEventsForDayTeam_(dia, team);
    return;
  }

  const warns = [];
  let rotaObj = rotaOtimizada(origemLoc, pontosBase, cfg, forceRefresh);
  let tempoStr = getRoundedTime(rotaObj.km);
  let mapsLinkCoords = buildMapsLinkFromCoords_(origemLoc, rotaObj.orderedPoints);
  let mapsLinkOriginal = buildMapsLinkFromAddresses_(
    sanitizeAddressForMaps_(origemStr),
    rotaObj.orderedPoints
  );

  let usedHaversineFallback = false;
  if (rotaObj.km > MAX_TOTAL_KM){
    const havKm = haversineRouteKm(origemLoc, rotaObj.orderedPoints);
    const estKm = havKm * HAVERSINE_ROAD_FACTOR;

    if (estKm <= MAX_TOTAL_KM * HAVERSINE_ACCEPT_PCT){
      warns.push(`⚠️ OSRM retornou ${rotaObj.km.toFixed(2)} km; adotado fallback ≈${estKm.toFixed(2)} km (haversine×${HAVERSINE_ROAD_FACTOR})`);
      Logger.log(`🧭 Haversine usado: OSRM=${rotaObj.km.toFixed(2)} km | HAV=${havKm.toFixed(2)} | EST=${estKm.toFixed(2)}`);
      rotaObj.km = estKm;
      tempoStr   = getRoundedTime(rotaObj.km);
      usedHaversineFallback = true;
    } else {
      warns.push(`⚠️ OSRM muito alto (${rotaObj.km.toFixed(2)} km) e haversine (${havKm.toFixed(2)} km) não plausível para fallback.`);
      Logger.log(`🧭 Haversine descartado: EST=${estKm.toFixed(2)} > limite plausível`);
    }
  }

  Logger.log(`→ Rota calculada: ${rotaObj.km.toFixed(2)} km (${tempoStr})`);
  Logger.log(`→ Link Maps (coords reais): ${mapsLinkCoords}`);
  Logger.log(`→ Link Maps (endereços originais): ${mapsLinkOriginal}`);

  const exceeded = rotaObj.km > MAX_TOTAL_KM;
  const titlePrefix = exceeded ? '⚠️⚠️ ' : (usedHaversineFallback ? '⚠️ ' : '');

  const pontosDesc = rotaObj.orderedPoints.map(formatarLinhaPonto_).filter(Boolean).join('\n→ ');

  try {
    const calId = (team === 'EQUIPE 1') ? CAL_DESLOC_E1 : CAL_DESLOC_E2;
    const cal   = CalendarApp.getCalendarById(calId);
    const title = `${titlePrefix}9 (${tempoStr}) DESLOCAMENTO ${team}`;

    const desc =
      `Distância total: ${rotaObj.km.toFixed(2)} km` +
      (exceeded ? `  ← acima de ${MAX_TOTAL_KM} km (verificar geocodificação)\n` : `\n`) +
      (usedHaversineFallback ? `Método: Fallback Haversine (×${HAVERSINE_ROAD_FACTOR})\n` : '') +
      `Origem real geocodificada:\n${origemLoc.display}\n\n` +
      (warns.length ? `Avisos:\n- ${warns.join('\n- ')}\n\n` : '') +
      `Pontos da rota (original x geocodificado):\nDEPÓSITO/ORIGEM\n→ ${pontosDesc}\n\n` +
      `🗺️ Rota no Google Maps (coordenadas reais):\n${mapsLinkCoords}\n\n` +
      `🗺️ Rota no Google Maps (endereços originais do agendamento):\n${mapsLinkOriginal}`;

    const eventsDay = cal.getEventsForDay(dia);
    const candidatos = eventsDay.filter(e => {
      const t = String(e.getTitle() || '').toUpperCase();
      return t.includes('DESLOCAMENTO') && t.includes(team);
    });

    if (candidatos.length > 1) {
      for (let i = 1; i < candidatos.length; i++) candidatos[i].deleteEvent();
      Logger.log(`🧹 Duplicados removidos: ${candidatos.length - 1} deslocamentos do dia (${team}).`);
    }

    if (candidatos.length >= 1) {
      const ev = candidatos[0];
      ev.setTitle(title);
      ev.setDescription(desc);
      ev.setAllDayDate(dia);
      Logger.log(`♻️ Evento atualizado: ${title}`);
    } else {
      cal.createAllDayEvent(title, dia, { description: desc });
      Logger.log(`✅ Evento criado: ${title}`);
    }

  } catch (e) {
    Logger.log(`⚠️ Falha ao criar/atualizar evento de deslocamento: ${e.message}`);
  }
}

function usarLegadoDeslocamentos_(cfgSheet) {
  let rawValue = '';
  try {
    rawValue = getConfig(CFG_DESLOC_USAR_LEGADO, cfgSheet);
  } catch (e) {
    Logger.log('Deslocamentos: flag de rollback legado ausente; usando backend novo.');
    return false;
  }

  const raw = String(rawValue || '').trim().toUpperCase();
  if (!raw) {
    Logger.log('Deslocamentos: flag de rollback legado vazia; usando backend novo.');
    return false;
  }

  const ativo = ['SIM', 'S', 'TRUE', '1', 'YES'].indexOf(raw) >= 0;
  if (ativo) Logger.log('Deslocamentos: rollback legado ativado temporariamente; riscos antigos preservados.');
  return ativo;
}

function getDeslocamentosApiUrl_(cfgSheet) {
  const props = PropertiesService.getScriptProperties();
  const raw = String(props.getProperty(PROP_DESLOC_BACKEND_URL) || getConfig('DESLOCAMENTOS API URL', cfgSheet) || '').trim();
  if (!raw) throw new Error('DESLOCAMENTOS_API_URL nao configurado em Script Properties.');
  if (/\/api\/procurar-datas\/interno\/deslocamentos\/calcular\/v1\/?$/.test(raw)) return raw;
  return raw.replace(/\/+$/, '') + DESLOC_BACKEND_ENDPOINT_PATH;
}

function getDeslocamentosApiToken_() {
  const token = String(PropertiesService.getScriptProperties().getProperty(PROP_DESLOC_BACKEND_TOKEN) || '').trim();
  if (!token) throw new Error('APPS_SCRIPT_DESLOCAMENTOS_TOKEN nao configurado em Script Properties.');
  return token;
}

function coletarAtendimentosDeslocamento_(dia, team, shAg) {
  const rowsAg = shAg.getLastRow() - 1;
  if (rowsAg <= 0) return [];

  const agVals = shAg.getRange(2, 1, rowsAg, 7).getValues();
  const agDisp = shAg.getRange(2, 1, rowsAg, 7).getDisplayValues();
  const itens = [];

  for (let i = 0; i < agVals.length; i++) {
    const d = agVals[i][0];
    if (!(d instanceof Date) || onlyDate(d).getTime() !== onlyDate(dia).getTime()) continue;
    if (normTeam(agDisp[i][6]) !== team) continue;

    let addr = (agDisp[i][5] || '').trim();
    if (!addr) {
      const obs = agDisp[i][4] || '';
      const m = obs.match(/ENDERE[CÇ]O:[^0-9]*(\d+.*?\d{5}-\d{3})/i);
      if (m) addr = m[1].trim();
    }
    if (!addr) continue;

    itens.push({
      id: `agenda-linha-${i + 2}`,
      linha: i + 2,
      titulo: String(agDisp[i][2] || '').trim(),
      enderecoOriginal: addr
    });
  }

  return itens;
}

function consultarBackendDeslocamentos_(payload, cfgSheet) {
  const url = getDeslocamentosApiUrl_(cfgSheet);
  const token = getDeslocamentosApiToken_();
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-LeBebe-Run-Id': payload.runId
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const text = response.getContentText() || '{}';
  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    throw new Error('backend_json_invalido_http_' + status);
  }

  if (status >= 500) {
    Logger.log(
      `Backend retornou erro interno | ` +
      `http=${status} | ` +
      `url=${url} | ` +
      `body=${String(text).slice(0, 1500)}`
    );

    throw new Error(
      `backend_http_${status}: ` +
      `${String(body && (body.error || body.message || body.motivo) || text).slice(0, 500)}`
    );
  }

  if (status === 401) {
    throw new Error('backend_unauthorized');
  }

  return { status, body };
}

function coordenadaValida_(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const latRaw = String(lat).trim();
  const lngRaw = String(lng).trim();
  if (!latRaw || !lngRaw) return false;

  const latNum = Number(latRaw);
  const lngNum = Number(lngRaw);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return false;
  }

  if (latNum === 0 && lngNum === 0) {
    return false;
  }

  return (
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180
  );
}

function itemBackendTemCoordenadaValida_(item) {
  return !!item && coordenadaValida_(item.lat, item.lng);
}

function logCoordenadaBackendInvalida_(contexto, item) {
  const id = item && (item.id || item.linha || item.eventId || item.enderecoOriginal);
  Logger.log(
    `Deslocamentos: coordenada invalida do backend ignorada (${contexto}) | ` +
    `id=${String(id || '-').slice(0, 80)} | ` +
    `lat=${String(item && item.lat).slice(0, 40)} | ` +
    `lng=${String(item && item.lng).slice(0, 40)}`
  );
}

function buildMapsLinkBackend_(origem, ordem) {
  const coords = [];
  if (origem) {
    if (coordenadaValida_(origem.lat, origem.lng)) {
      coords.push(`${Number(origem.lat)},${Number(origem.lng)}`);
    } else {
      logCoordenadaBackendInvalida_('origem', origem);
    }
  }
  (ordem || []).forEach(p => {
    if (coordenadaValida_(p.lat, p.lng)) {
      coords.push(`${Number(p.lat)},${Number(p.lng)}`);
    } else {
      logCoordenadaBackendInvalida_('rota', p);
    }
  });
  return 'https://www.google.com/maps/dir/' + coords.map(encodeURIComponent).join('/');
}

function buildMapsLinkBackendEnderecos_(origemOriginal, ordem) {
  const enderecos = [
    String(origemOriginal || '').trim(),
    ...(ordem || []).map(p => String(p.enderecoOriginal || '').trim())
  ].filter(Boolean);
  return 'https://www.google.com/maps/dir/' + enderecos.map(encodeURIComponent).join('/');
}

function formatarLinhaBackend_(p) {
  const refs = (p.referencias || []).map(r => {
    const partes = [];
    if (r.linha) partes.push('linha ' + r.linha);
    if (r.eventId) partes.push('event ' + String(r.eventId).slice(0, 12));
    if (r.titulo) partes.push(String(r.titulo).slice(0, 60));
    return partes.join(' | ');
  }).filter(Boolean);
  return `📍 ${p.enderecoOriginal || p.display || '-'}\n  refs: ${refs.join('; ') || '-'}`;
}

function truncarTextoBackend_(valor, limite) {
  const texto = String(valor || '').replace(/\s+/g, ' ').trim();
  if (texto.length <= limite) return texto || '-';
  return texto.slice(0, Math.max(0, limite - 3)) + '...';
}

function motivoItemBackend_(item) {
  const partes = [];
  if (item && item.motivo) partes.push(item.motivo);
  if (item && item.rejectionReason) partes.push(item.rejectionReason);
  if (item && Array.isArray(item.rejectionReasons)) partes.push(item.rejectionReasons.join('; '));
  return truncarTextoBackend_(partes.filter(Boolean).join(' | '), 180);
}

function montarDescricaoAlertaBackend_(dia, team, resposta, quantidadeEsperada, runId) {
  const itensBackend = Array.isArray(resposta && resposta.itens) ? resposta.itens : [];
  const pendentes = itensBackend.filter(item => !itemBackendTemCoordenadaValida_(item));
  const resolvidos = itensBackend.filter(itemBackendTemCoordenadaValida_).length;
  const linhasPendentes = pendentes.slice(0, 20).map(item => {
    return '- ' +
      truncarTextoBackend_(item.enderecoOriginal || item.display || item.id || '-', 120) +
      ' | status=' + truncarTextoBackend_(item.status || '-', 40) +
      ' | motivo=' + motivoItemBackend_(item);
  });

  return [
    'Backend nao gerou rota valida. Rota anterior preservada.',
    `Data/equipe: ${formatDatePt(dia)} | ${team}`,
    `RunId: ${runId || (resposta && resposta.runId) || '-'}`,
    `Status: ${(resposta && resposta.status) || '-'}`,
    `Motivo geral: ${truncarTextoBackend_(resposta && resposta.motivo, 180)}`,
    `Quantidade esperada: ${quantidadeEsperada}`,
    `Quantidade resolvida: ${resolvidos}`,
    `Quantidade pendente: ${pendentes.length}`,
    'Pendencias:',
    linhasPendentes.length ? linhasPendentes.join('\n') : '-'
  ].join('\n');
}

function validarRespostaBackendValida_(resposta, quantidadeEsperada) {
  const erros = [];

  if (!resposta || resposta.ok !== true) {
    erros.push('resposta_backend_nao_ok');
  }

  if (!resposta || resposta.status !== 'VALIDA') {
    erros.push('status_backend_nao_valido');
  }

  if (
    !resposta ||
    !resposta.origem ||
    !coordenadaValida_(resposta.origem.lat, resposta.origem.lng)
  ) {
    erros.push('origem_sem_coordenada_valida');
  }

  const rota = resposta && resposta.rota;

  if (!rota || !Array.isArray(rota.ordem) || rota.ordem.length === 0) {
    erros.push('rota_sem_paradas');
  } else {
    rota.ordem.forEach((ponto, indice) => {
      if (!coordenadaValida_(ponto && ponto.lat, ponto && ponto.lng)) {
        erros.push(`rota_ponto_${indice}_coordenada_invalida`);
      }
    });
  }

  const distanciaKm = Number(rota && rota.distanciaTotalKm);

  if (!Number.isFinite(distanciaKm) || distanciaKm < 0) {
    erros.push('distancia_total_invalida');
  }

  if (
    rota &&
    rota.duracaoTotalSegundos !== null &&
    rota.duracaoTotalSegundos !== undefined
  ) {
    const duracao = Number(rota.duracaoTotalSegundos);

    if (!Number.isFinite(duracao) || duracao < 0) {
      erros.push('duracao_total_invalida');
    }
  }

  const itens = Array.isArray(resposta && resposta.itens)
    ? resposta.itens
    : [];

  if (!itens.length) {
    erros.push('resposta_sem_itens');
  }

  itens.forEach((item, indice) => {
    if (item && item.usableInRoute === false) {
      erros.push(`item_${indice}_nao_utilizavel`);
    }

    if (!itemBackendTemCoordenadaValida_(item)) {
      erros.push(`item_${indice}_coordenada_invalida`);
    }
  });

  const resumo = resposta && resposta.summary
    ? resposta.summary
    : {};

  const totalFalhas = Number(
    resumo.failed !== undefined
      ? resumo.failed
      : resumo.totalFalhas
  );

  if (Number.isFinite(totalFalhas) && totalFalhas > 0) {
    erros.push(`resumo_com_${totalFalhas}_falhas`);
  }

  const totalEventos = Number(resumo.totalEventos);

  if (
    Number.isFinite(totalEventos) &&
    Number.isFinite(Number(quantidadeEsperada)) &&
    totalEventos !== Number(quantidadeEsperada)
  ) {
    erros.push(
      `quantidade_eventos_divergente_${totalEventos}_de_${quantidadeEsperada}`
    );
  }

  return {
    ok: erros.length === 0,
    erros: erros
  };
}

function scanSlotTemEndereco_(contextoScan) {
  return !!(contextoScan && contextoScan.hasAnyLocation);
}

function quantidadeAssinaturasEndereco_(contextoScan) {
  const assinaturas = (contextoScan && contextoScan.assinaturas) || [];
  return assinaturas.filter(s => s && String(s).trim() !== '' && !/^ORIGEM=/.test(String(s))).length;
}

function apagarAlertasDeslocamento_(dia, team) {
  try {
    const calId = (team === 'EQUIPE 1') ? CAL_DESLOC_E1 : CAL_DESLOC_E2;
    const cal = CalendarApp.getCalendarById(calId);
    cal.getEventsForDay(dia).forEach(ev => {
      const t = String(ev.getTitle() || '').toUpperCase();
      if ((t.includes('ROTA PARCIAL') || t.includes('FALHA ROTA')) && t.includes(team)) {
        ev.deleteEvent();
      }
    });
  } catch (e) {
    Logger.log('Falha ao apagar alertas de deslocamento: ' + e.message);
  }
}

function atualizarAlertaDeslocamento_(dia, team, titulo, descricao) {
  try {
    const calId = (team === 'EQUIPE 1') ? CAL_DESLOC_E1 : CAL_DESLOC_E2;
    const cal = CalendarApp.getCalendarById(calId);
    const title = `${titulo} ${team}`;
    const candidatos = cal.getEventsForDay(dia).filter(ev => {
      const t = String(ev.getTitle() || '').toUpperCase();
      return (t.includes('ROTA PARCIAL') || t.includes('FALHA ROTA')) && t.includes(team);
    });

    if (candidatos.length >= 1) {
      candidatos[0].setTitle(title);
      candidatos[0].setDescription(descricao);
      candidatos[0].setAllDayDate(dia);
      for (let i = 1; i < candidatos.length; i++) candidatos[i].deleteEvent();
    } else {
      cal.createAllDayEvent(title, dia, { description: descricao });
    }
  } catch (e) {
    Logger.log('Falha ao criar/atualizar alerta de deslocamento: ' + e.message);
  }
}

function atualizarEventoDeslocamentoBackend_(dia, team, resposta, quantidadeEsperada) {
  const rota = resposta && resposta.rota;
  if (!rota || !Array.isArray(rota.ordem)) throw new Error('resposta_backend_sem_rota');

  const distanciaKm = Number(rota.distanciaTotalKm);
  if (!Number.isFinite(distanciaKm)) throw new Error('distancia_backend_invalida');

  const tempoStr = getRoundedTime(distanciaKm);
  const mapsLinkCoordenadas = buildMapsLinkBackend_(resposta.origem, rota.ordem);
  const mapsLinkEnderecos = buildMapsLinkBackendEnderecos_(
    resposta.origem && resposta.origem.enderecoOriginal,
    rota.ordem
  );
  const pontosDesc = rota.ordem.map(formatarLinhaBackend_).join('\n\n');
  const itensBackend = Array.isArray(resposta && resposta.itens)
    ? resposta.itens
    : [];
  const totalEsperadoNumero = Number(quantidadeEsperada);
  const totalEsperado = Number.isFinite(totalEsperadoNumero)
    ? totalEsperadoNumero
    : itensBackend.length;

  const rejeitados = itensBackend.filter(item => {
    const valido = itemBackendTemCoordenadaValida_(item);
    const rejeitado = !valido || (item && item.usableInRoute === false);
    if (rejeitado) logCoordenadaBackendInvalida_('item', item);
    return rejeitado;
  });

  const resolvidos = itensBackend.filter(item => {
    return (
      itemBackendTemCoordenadaValida_(item) &&
      (!item || item.usableInRoute !== false)
    );
  });

  const totalIncluido = itensBackend.length
    ? resolvidos.length
    : rota.ordem.length;
  const totalPendente = Math.max(0, totalEsperado - totalIncluido);

  const desc =
    (resposta.status === 'PARCIAL'
      ? `*⚠️ ROTA PARCIAL*\n\n` +
        `A distância e o tempo abaixo foram calculados somente com os endereços resolvidos.\n\n` +
        `Quantidade esperada: ${totalEsperado}\n` +
        `Quantidade incluída na rota: ${totalIncluido}\n` +
        `Quantidade pendente: ${totalPendente}\n\n` +
        (rejeitados.length
          ? `*Endereços não incluídos:*\n` +
            rejeitados
              .map(i => `📍 ${truncarTextoBackend_(i.enderecoOriginal || i.id, 120)}\n  motivo: ${i.status || '-'} ${motivoItemBackend_(i)}`)
              .join('\n\n') +
            '\n\n'
          : '')
      : '') +
    `*Origem:*\n${(resposta.origem && (resposta.origem.enderecoOriginal || resposta.origem.display)) || '-'}\n\n` +
    `*Pontos da rota:*\n*ORIGEM*\n\n${pontosDesc}\n\n` +
    (resposta.status !== 'PARCIAL' && rejeitados.length ? `Itens nao usados:\n- ${rejeitados.map(i => `${truncarTextoBackend_(i.enderecoOriginal || i.id, 120)}: ${i.status || '-'} ${motivoItemBackend_(i)}`).join('\n- ')}\n\n` : '') +
    `*Rota no Google Maps (coordenadas reais):*\n${mapsLinkCoordenadas}\n\n` +
    `*Rota no Google Maps (enderecos originais):*\n${mapsLinkEnderecos}\n\n` +
    (resposta.status === 'PARCIAL'
      ? `Distancia parcial OSRM Table: ${distanciaKm.toFixed(2)} km\n` +
        `Duracao parcial OSRM Table: ${rota.duracaoTotalSegundos == null ? 'nao informada' : Math.round(rota.duracaoTotalSegundos / 60) + ' min'}\n`
      : `Distancia total OSRM Table: ${distanciaKm.toFixed(2)} km\n` +
        `Duracao OSRM Table: ${rota.duracaoTotalSegundos == null ? 'nao informada' : Math.round(rota.duracaoTotalSegundos / 60) + ' min'}\n`) +
    `RunId: ${resposta.runId || '-'}\n` +
    `Status backend: ${resposta.status}`;

  const calId = (team === 'EQUIPE 1') ? CAL_DESLOC_E1 : CAL_DESLOC_E2;
  const cal = CalendarApp.getCalendarById(calId);
  const title = `9 (${tempoStr}) DESLOCAMENTO ${team}`;
  const eventsDay = cal.getEventsForDay(dia);
  const candidatos = eventsDay.filter(e => {
    const t = String(e.getTitle() || '').toUpperCase();
    return t.includes('DESLOCAMENTO') && t.includes(team);
  });

  if (candidatos.length > 1) {
    for (let i = 1; i < candidatos.length; i++) candidatos[i].deleteEvent();
  }

  if (candidatos.length >= 1) {
    candidatos[0].setTitle(title);
    candidatos[0].setDescription(desc);
    candidatos[0].setAllDayDate(dia);
  } else {
    cal.createAllDayEvent(title, dia, { description: desc });
  }

  // Apagar alertas ROTA PARCIAL e FALHA ROTA quando atualiza evento normal
  apagarAlertasDeslocamento_(dia, team);
}

function recalcDeslocamentoDiaEquipeBackend_(dia, team, cfg, shAg, contextoScan, opcoes) {
  const opts = opcoes || {};
  const modoTeste = opts.modoTeste === true;

  if (onlyDate(dia).getDay() === 0) return { ok:false, motivo:'domingo' };

  const itens = coletarAtendimentosDeslocamento_(dia, team, shAg);

  if (!itens.length) {
    if (modoTeste) {
      Logger.log(
        `Teste controlado sem atendimentos na planilha. ` +
        `Nenhum evento ou hash sera alterado | ${formatDatePt(dia)} | ${team}`
      );

      return {
        ok: false,
        status: 'TESTE_SEM_ATENDIMENTOS',
        runId: null
      };
    }

    if (scanSlotTemEndereco_(contextoScan)) {
      const runIdDivergencia =
        `desloc-${toYmd(dia)}-${team.replace(/\s+/g, '-').toLowerCase()}` +
        `-divergencia-${Date.now()}`;

      const desc = [
        'Scanner encontrou assinatura/endereco no Calendar, mas a coleta da planilha retornou zero atendimentos.',
        'Rota anterior preservada.',
        `Data/equipe: ${formatDatePt(dia)} | ${team}`,
        `RunId: ${runIdDivergencia}`,
        `Quantidade esperada: ${quantidadeAssinaturasEndereco_(contextoScan)}`,
        'Quantidade resolvida: 0',
        `Quantidade pendente: ${quantidadeAssinaturasEndereco_(contextoScan)}`,
        'Pendencias:',
        (
          (contextoScan.assinaturas || [])
            .filter(s => s && String(s).trim() !== '' && !/^ORIGEM=/.test(String(s)))
            .slice(0, 20)
            .map(s => '- ' + truncarTextoBackend_(s, 160))
            .join('\n') || '-'
        )
      ].join('\n');

      atualizarAlertaDeslocamento_(dia, team, 'FALHA ROTA', desc);

      Logger.log(
        `Deslocamentos: divergencia de fontes preservou rota anterior | ` +
        `${formatDatePt(dia)} | ${team} | runId=${runIdDivergencia}`
      );

      return {
        ok: false,
        status: 'DIVERGENCIA_FONTES',
        runId: runIdDivergencia
      };
    }

    deleteDeslocamentoEventsForDayTeam_(dia, team);
    apagarAlertasDeslocamento_(dia, team);

    return {
      ok: true,
      status: 'SEM_ATENDIMENTOS'
    };
  }

  const HOME_E1 = getConfig('ENDEREÇO DA CASA EQP 1', cfg);
  const HOME_E2 = getConfig('ENDEREÇO DA CASA EQP 2', cfg);
  const DEPOSIT = getConfig('ENDEREÇO DO DEPÓSITO', cfg);
  const origemStr = (dia.getDay() === 6)
    ? (team === 'EQUIPE 1' ? HOME_E1 : HOME_E2)
    : DEPOSIT;

    Logger.log(
    `Deslocamentos: origem enviada ao backend | ` +
    `data=${toYmd(dia)} | equipe=${team} | origem="${origemStr}"`
  );

  const runId = `desloc-${toYmd(dia)}-${team.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  const payload = {
    runId,
    dataISO: toYmd(dia),
    equipe: team,
    origem: origemStr,
    itens
  };

  const resposta = consultarBackendDeslocamentos_(payload, cfg).body;
  if (!resposta || resposta.ok !== true) throw new Error('backend_resposta_nao_ok');

  if (
    resposta.status === 'VALIDA' ||
    resposta.status === 'PARCIAL'
  ) {
    if (resposta.status === 'VALIDA') {
      const validacaoResposta = validarRespostaBackendValida_(
        resposta,
        itens.length
      );

      if (!validacaoResposta.ok) {
        const errosTexto = validacaoResposta.erros.join(', ');

        const desc = [
          'Backend retornou status VALIDA, mas a resposta falhou na validacao defensiva do Apps Script.',
          'Rota anterior preservada.',
          `Data/equipe: ${formatDatePt(dia)} | ${team}`,
          `RunId: ${runId}`,
          `Erros: ${truncarTextoBackend_(errosTexto, 800)}`
        ].join('\n');

        atualizarAlertaDeslocamento_(
          dia,
          team,
          'FALHA ROTA',
          desc
        );

        Logger.log(
          `Deslocamentos: resposta VALIDA rejeitada pelo Apps Script | ` +
          `runId=${runId} | erros=${errosTexto}`
        );

        return {
          ok: false,
          status: 'FALHA_RESPOSTA_INVALIDA',
          runId: runId
        };
      }
    }

    // Para PARCIAL, validar apenas o essencial
    if (resposta.status === 'PARCIAL') {
      if (!resposta.origem || !coordenadaValida_(resposta.origem.lat, resposta.origem.lng)) {
        throw new Error('parcial_sem_origem_valida');
      }
      const rota = resposta.rota;
      if (!rota || !Array.isArray(rota.ordem) || rota.ordem.length === 0) {
        throw new Error('parcial_sem_ordem');
      }
      const distanciaParcialKm = Number(rota.distanciaTotalKm);
      if (!Number.isFinite(distanciaParcialKm) || distanciaParcialKm < 0) {
        throw new Error('parcial_distancia_invalida');
      }

      rota.ordem.forEach((ponto, indice) => {
        if (!coordenadaValida_(ponto && ponto.lat, ponto && ponto.lng)) {
          throw new Error(`parcial_ponto_${indice}_coordenada_invalida`);
        }
      });

      if (
        rota.duracaoTotalSegundos !== null &&
        rota.duracaoTotalSegundos !== undefined
      ) {
        const duracaoParcial = Number(rota.duracaoTotalSegundos);
        if (!Number.isFinite(duracaoParcial) || duracaoParcial < 0) {
          throw new Error('parcial_duracao_invalida');
        }
      }
    }

    atualizarEventoDeslocamentoBackend_(
      dia,
      team,
      resposta,
      itens.length
    );

    Logger.log(
      `Deslocamento backend atualizado | ` +
      `${formatDatePt(dia)} | ${team} | ` +
      `status=${resposta.status} | runId=${runId}`
    );

    return {
      ok: true,
      status: resposta.status,
      runId
    };
  }

  // PARCIAL já foi tratado acima como evento normal de DESLOCAMENTO.
  // Somente falhas sem rota utilizável chegam a este ramo.
  const titulo = 'FALHA ROTA';
  const desc = montarDescricaoAlertaBackend_(dia, team, resposta, itens.length, runId);
  atualizarAlertaDeslocamento_(dia, team, titulo, desc);
  Logger.log(`Deslocamento backend sem confirmacao: ${formatDatePt(dia)} | ${team} | status=${resposta.status}`);
  return { ok:false, status:resposta.status || 'FALHA', runId };
}

function parseCalendarEventDate_(start) {
  if (!start) return null;

  // Eventos de dia inteiro retornam somente yyyy-MM-dd.
  // Não usar new Date("yyyy-MM-dd"), pois isso interpreta como UTC
  // e pode deslocar para o dia anterior em America/Sao_Paulo.
  if (start.date) {
    const partes = String(start.date)
      .split('-')
      .map(Number);

    if (
      partes.length !== 3 ||
      !partes[0] ||
      !partes[1] ||
      !partes[2]
    ) {
      return null;
    }

    return new Date(
      partes[0],
      partes[1] - 1,
      partes[2],
      0,
      0,
      0,
      0
    );
  }

  // Eventos com horário possuem offset/timezone e podem ser
  // interpretados normalmente.
  if (start.dateTime) {
    const data = new Date(start.dateTime);

    if (Number.isNaN(data.getTime())) {
      return null;
    }

    return onlyDate(data);
  }

  return null;
}

function scanChangedSlots_() {
  const today  = onlyDate(new Date());
  const tMin   = new Date(today.getTime() + WINDOW_DAYS_MIN * 86400000);
  const tMax   = new Date(today.getTime() + (WINDOW_DAYS_MAX + 1) * 86400000); // exclusivo

  const prevMap = JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_CAL_SIG_MAP) || '{}');
  const newMap  = {};
  const slots   = {};  // key -> { dia, team }
  const sigBag  = {};  // key -> array de linhas de assinatura

  const timeMinIso = tMin.toISOString();
  const timeMaxIso = tMax.toISOString();

  // 1) Coleta das agendas monitoradas (como já era)
  MONITOR_CAL_IDS.forEach(calId => {
    let pageToken = null;
    do {
      const resp = Calendar.Events.list(calId, {
        timeMin:      timeMinIso,
        timeMax:      timeMaxIso,
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   250,
        pageToken
      });
      pageToken = resp.nextPageToken;
      (resp.items || []).forEach(evt => {
        if (isOurDeslocEvent_(evt)) return;
        const d = parseCalendarEventDate_(evt.start);
        if (!d) return;
        if (d.getDay() === 0) return; // domingo fora

        const team = teamFromCalId(calId);
        if (!team) return;
        const key  = `${toYmd(d)}|${team}`;
        if (!slots[key]) slots[key] = { dia: d, team };
        if (!sigBag[key]) sigBag[key] = [];

        const locSig = normalizeLocation_(evt.location || '');
        sigBag[key].push(locSig);
      });
    } while(pageToken);
  });

  // 2) Coleta da PLANILHA (NOVO) — garante incluir sábados e dias sem eventos na agenda
  const sheetPack = _collectSheetSlots_(tMin, tMax);
  Object.keys(sheetPack.slots).forEach(key=>{
    if (!slots[key]) slots[key] = sheetPack.slots[key];
    (sigBag[key] || (sigBag[key] = [])).push.apply(
      sigBag[key],
      sheetPack.sigBag[key] || []
    );

  });

  // 3) Token de origem (se vieram só do calendário ele ainda não foi aplicado)
  Object.keys(slots).forEach(key=>{
    const {dia, team} = slots[key];
    const originToken = (dia.getDay() === 6)
      ? `ORIGEM=CASA_${team === 'EQUIPE 1' ? 'E1' : 'E2'}`
      : 'ORIGEM=DEPOSITO';
    (sigBag[key] || (sigBag[key] = [])).push(originToken);
  });

  // 4) Calcula hashes e detecta mudanças
  Object.keys(sigBag).forEach(key=>{
    const arr = sigBag[key].slice().sort();
    newMap[key] = md5Hex(arr.join('\n'));
  });

  function montarChangeSlot(key) {
    const slot = slots[key];
    const assinaturas = (sigBag[key] || []).slice();
    return {
      dia: slot.dia,
      team: slot.team,
      key,
      assinaturas,
      hasAnyLocation: assinaturas.some(s => s && s.trim() !== '' && !/^ORIGEM=/.test(s))
    };
  }

  const changed = [];

  Object.keys(newMap).forEach(key => {
    if (newMap[key] !== prevMap[key]) {
      changed.push(montarChangeSlot(key));
    }
  });

  const changedKey = new Set(
    changed.map(o => `${toYmd(o.dia)}|${o.team}`)
  );

  // Detecta dias/equipes que existiam antes, mas desapareceram totalmente.
  Object.keys(prevMap).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(newMap, key)) return;
    if (changedKey.has(key)) return;

    const partes = key.split('|');
    if (partes.length !== 2) return;

    const ymd = partes[0];
    const team = normTeam(partes[1]);

    if (!team) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;

    const dia = new Date(`${ymd}T00:00:00-03:00`);

    if (Number.isNaN(dia.getTime())) return;
    if (dia.getTime() < tMin.getTime()) return;
    if (dia.getTime() >= tMax.getTime()) return;
    if (dia.getDay() === 0) return;

    changed.push({
      dia: dia,
      team: team,
      key: key,
      assinaturas: [],
      hasAnyLocation: false,
      removidoDaAgenda: true
    });

    changedKey.add(key);

    Logger.log(
      `Deslocamentos: dia/equipe removido completamente detectado | ` +
      `${ymd} | ${team}`
    );
  });

  // 5) Força recálculo se não houver evento de deslocamento criado mas houver endereço
  const calDeslocE1 = CalendarApp.getCalendarById(CAL_DESLOC_E1);
  const calDeslocE2 = CalendarApp.getCalendarById(CAL_DESLOC_E2);

  Object.keys(sigBag).forEach(key=>{
    if (changedKey.has(key)) return;
    const [ymd, team] = key.split('|');
    const d = new Date(`${ymd}T00:00:00-03:00`);
    if (d.getTime() < tMin.getTime() || d.getTime() >= tMax.getTime()) return;
    if (d.getDay() === 0) return;

    // há alguma assinatura com endereço?
    const hasAnyLocation = (sigBag[key] || []).some(s => s && s.trim() !== '' && !/^ORIGEM=/.test(s));
    if (!hasAnyLocation) return;

    const cal = (team === 'EQUIPE 1') ? calDeslocE1 : calDeslocE2;
    const hasDesloc = cal.getEventsForDay(d).some(e => /DESLOCAMENTO/.test((e.getTitle()||'').toUpperCase()));
    if (!hasDesloc) {
      changed.push(montarChangeSlot(key));
      changedKey.add(key);
    }
  });

  return { changes: changed, prevMap, newMap };
}


/**
 * Sessão 3.1 – Agendador inteligente
 * ----------------------------------
 * Só chama recalc para os dias/equipes modificados
 */
function gerarEventosDeslocamentoLegadoDesativado_() {
  const scan = scanChangedSlots_();
  const changes = scan.changes || [];

  if (!changes.length) {
    Logger.log(
      `Nada mudou entre D+${WINDOW_DAYS_MIN} e D+${WINDOW_DAYS_MAX}.`
    );
    return;
  }

  changes.forEach(({ dia, team }) => {
    try {
      recalcDeslocamentoDiaEquipe(dia, team, true);
    } catch (e) {
      Logger.log(
        `Erro ao recalc legado ${formatDatePt(dia)} ${team}: ${e.message}`
      );
    }
  });
}

function gerarEventosDeslocamento() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('Deslocamentos: execucao ignorada porque outra rotina esta em andamento.');
    return;
  }

  try {
    const scan = scanChangedSlots_();
    const changes = scan.changes || [];

    if (!changes.length) {
      Logger.log(`Nada mudou entre D+${WINDOW_DAYS_MIN} e D+${WINDOW_DAYS_MAX}.`);
      return;
    }

    const ss = getMainSpreadsheet_();
    let cfg = ss.getSheets().find(s => s.getSheetId() === CFG_SHEET_ID);
    if (!cfg) {
      cfg = ss.getSheets().find(s =>
        s.getName().toUpperCase().includes('CONTROLES E CONFIGURAÇÕES')
      );
    }
    if (!cfg) throw new Error('Aba de configuracoes nao localizada.');

    const AGENDA = getConfig('PLANILHA DA AGENDA', cfg);
    const shAg = ss.getSheetByName(AGENDA);
    if (!shAg) throw new Error('Aba de agenda nao localizada.');

    const usarLegado = usarLegadoDeslocamentos_(cfg);
    const confirmMap = Object.assign({}, scan.prevMap || {});

    changes.forEach(change => {
      const {dia, team} = change;
      const key = `${toYmd(dia)}|${team}`;
      try {
        if (usarLegado) {
          recalcDeslocamentoDiaEquipe(dia, team, true);
          Logger.log(`Rollback legado executado sem confirmar hash automaticamente: ${formatDatePt(dia)} | ${team}. Rerun pode ocorrer.`);
          return;
        }

        const resultado = recalcDeslocamentoDiaEquipeBackend_(dia, team, cfg, shAg, change);
        if (resultado && resultado.ok === true) {
          if (resultado.status === 'SEM_ATENDIMENTOS') {
            const aindaExisteNoScan = Object.prototype.hasOwnProperty.call(
              scan.newMap || {},
              key
            );

            if (aindaExisteNoScan) {
              // O dia/equipe ainda existe nas fontes, mas não possui endereço
              // utilizável. Confirmar o hash evita repetir o mesmo processamento
              // em toda execução horária sem que tenha ocorrido nova mudança.
              confirmMap[key] = scan.newMap[key];

              Logger.log(
                `Deslocamentos: hash confirmado para dia/equipe sem atendimentos utilizaveis | ` +
                `${formatDatePt(dia)} | ${team}`
              );
            } else {
              // O dia/equipe desapareceu completamente das fontes monitoradas.
              delete confirmMap[key];

              Logger.log(
                `Deslocamentos: hash removido porque o dia/equipe desapareceu das fontes | ` +
                `${formatDatePt(dia)} | ${team}`
              );
            }
          } else {
            confirmMap[key] = scan.newMap[key];
          }
        }
      } catch (e) {
        Logger.log(`Erro ao recalc ${formatDatePt(dia)} ${team}: ${e.message}`);
        atualizarAlertaDeslocamento_(dia, team, 'FALHA ROTA', `Rota anterior preservada.\nErro: ${e.message}`);
      }
    });

    PropertiesService.getScriptProperties().setProperty(PROP_CAL_SIG_MAP, JSON.stringify(confirmMap));
  } finally {
    lock.releaseLock();
  }
}

function testarDeslocamentoBackendControlado() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('Teste controlado de deslocamentos ignorado porque outra rotina esta em andamento.');
    return;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const dataRaw = String(props.getProperty('DESLOCAMENTOS_TESTE_DATA') || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)) {
      throw new Error('DESLOCAMENTOS_TESTE_DATA deve estar no formato yyyy-MM-dd.');
    }

    const equipe = normTeam(props.getProperty('DESLOCAMENTOS_TESTE_EQUIPE'));
    if (equipe !== 'EQUIPE 1' && equipe !== 'EQUIPE 2') {
      throw new Error('DESLOCAMENTOS_TESTE_EQUIPE deve ser EQUIPE 1 ou EQUIPE 2.');
    }

    const dia = new Date(`${dataRaw}T00:00:00-03:00`);
    if (Number.isNaN(dia.getTime()) || toYmd(dia) !== dataRaw) {
      throw new Error('DESLOCAMENTOS_TESTE_DATA invalida.');
    }

    const ss = getMainSpreadsheet_();
    let cfg = ss.getSheets().find(s => s.getSheetId() === CFG_SHEET_ID);
    if (!cfg) {
      cfg = ss.getSheets().find(s =>
        s.getName().toUpperCase().includes('CONTROLES E CONFIGURAÇÕES')
      );
    }
    if (!cfg) throw new Error('Aba de configuracoes nao localizada.');

    const AGENDA = getConfig('PLANILHA DA AGENDA', cfg);
    const shAg = ss.getSheetByName(AGENDA);
    if (!shAg) throw new Error('Aba de agenda nao localizada.');

    Logger.log(`Teste controlado deslocamentos backend | modo=controlado | data=${dataRaw} | equipe=${equipe}`);
    const resultado = recalcDeslocamentoDiaEquipeBackend_(
      dia,
      equipe,
      cfg,
      shAg,
      {
        key: `${dataRaw}|${equipe}`,
        assinaturas: [],
        hasAnyLocation: false
      },
      {
        modoTeste: true
      }
    );
    Logger.log(`Teste controlado deslocamentos backend | status=${(resultado && resultado.status) || '-'} | runId=${(resultado && resultado.runId) || '-'}`);
    return resultado;
  } catch (e) {
    Logger.log('Teste controlado deslocamentos backend falhou; rota anterior preservada em erro/parcial: ' + e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function resetarLastRun() {
  PropertiesService.getScriptProperties().deleteProperty('LAST_RUN_DESLOC');
  Logger.log('✅ LAST_RUN_DESLOC apagado com sucesso.');
}

function resetCalSigMap(){
  PropertiesService.getScriptProperties().deleteProperty(PROP_CAL_SIG_MAP);
  Logger.log('🗑️ Assinaturas (PROP_CAL_SIG_MAP) limpas.');
}

/**
 * Verificação periódica dos deslocamentos.
 *
 * Não usa gatilhos de alteração do Calendar porque o próprio script cria e
 * atualiza eventos nas agendas monitoradas. Isso poderia disparar um ciclo de
 * novas execuções.
 *
 * A função roda a cada 5 minutos, mas só faz o scanner entre 07h e 22h.
 */
function verificarDeslocamentosPeriodicamente() {
  const hora = Number(
    Utilities.formatDate(
      new Date(),
      'America/Sao_Paulo',
      'H'
    )
  );

  if (hora < 7 || hora > 22) {
    Logger.log(
      `Deslocamentos: verificacao periodica ignorada fora do horario | hora=${hora}`
    );
    return;
  }

  gerarEventosDeslocamento();
}

/**
 * Remove todos os gatilhos antigos e atuais ligados aos deslocamentos.
 *
 * Inclui os handlers anteriores para que a migração elimine os seis gatilhos
 * de Calendar e o gatilho horário já instalados.
 */
function removerTodosGatilhosDeslocamentos_() {
  const handlers = {
    aoAlterarCalendarioDeslocamentos: true,
    verificarDeslocamentosHorarioComercial: true,
    verificarDeslocamentosPeriodicamente: true
  };

  let removidos = 0;

  ScriptApp.getProjectTriggers().forEach(trigger => {
    const handler = trigger.getHandlerFunction();

    if (handlers[handler]) {
      ScriptApp.deleteTrigger(trigger);
      removidos++;
    }
  });

  Logger.log(
    `Deslocamentos: gatilhos antigos removidos=${removidos}`
  );

  return removidos;
}

/**
 * Instala somente um gatilho baseado no tempo, a cada 5 minutos.
 *
 * Execute manualmente uma vez depois de salvar o código.
 */
function instalarGatilhoPeriodicoDeslocamentos() {
  removerTodosGatilhosDeslocamentos_();

  ScriptApp
    .newTrigger('verificarDeslocamentosPeriodicamente')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log(
    'Deslocamentos: gatilho periodico criado a cada 1 minuto.'
  );
}

/**
 * Nome mantido por compatibilidade com a instrução anterior.
 *
 * Agora instala somente o gatilho periódico seguro e não cria gatilhos de
 * alteração do Calendar.
 */
function instalarTodosGatilhosDeslocamentos() {
  instalarGatilhoPeriodicoDeslocamentos();

  Logger.log(
    'Deslocamentos: sistema de gatilho periodico instalado sem gatilhos de Calendar.'
  );
}

/**
 * Função de emergência para interromper todos os gatilhos de deslocamentos.
 *
 * Pode ser executada manualmente sem alterar hashes ou eventos.
 */
function desativarTodosGatilhosDeslocamentos() {
  const removidos = removerTodosGatilhosDeslocamentos_();

  Logger.log(
    `Deslocamentos: todos os gatilhos foram desativados | removidos=${removidos}`
  );
}
