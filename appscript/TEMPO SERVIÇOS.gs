/**
 * Gera a aba "TEMPO SERVIÇOS" com todas as variações e tempos calculados.
 * Para quartos completos (berço + cômoda + roupeiro), soma +15 min ao roupeiro.
 */
function gerarTempoServiCalcula() {

  // =========================
  // Sessão 0 – Setup e logs
  // =========================
  Logger.log("🔄 [INFO] Iniciando gerarTempoServiCalcula()");
  const ss   = SpreadsheetApp.getActive();
  const name = 'TEMPO SERVIÇOS';

  let sh = ss.getSheetByName(name);
  if (sh) {
    Logger.log("🧹 [INFO] Apagando aba antiga: " + name);
    ss.deleteSheet(sh);
  }
  sh = ss.insertSheet(name, 0);
  Logger.log("✅ [INFO] Aba criada: " + name);

  // =========================
  // Sessão 1 – Opções
  // =========================
  const berco = [
    '',
    'DIVERSOS',
    '2 DIVERSOS',
    '2 BERÇOS DIVERSOS',
    'NIDO',
    'FORMARE', // ✅ NOVO
    'MAXX',    // ✅ NOVO (15 min a menos que FORMARE)
    'CAMA',
    '2 CAMAS', // ✅ NOVO (mesmo tempo de 2 BERÇOS DIVERSOS)
    'DIVERSOS E CAMA',
    'NIDO E CAMA',
    'FORMARE E CAMA', // ✅ NOVO
    'MAXX E CAMA'     // ✅ NOVO
  ];

  const comoda   = ['', 'SIM', '2 COMODAS'];

  const roupeiro = [
    '',
    '2 PTS',
    '3 PTS',
    '4 PTS (DIVERSOS)',
    '4 PTS (TUTTO)',
    '4 PTS (PROVENCE/FLOW)',
    'DESLIZANTE (DIVERSOS)',
    'DESLIZANTE TUTTO'
  ];

  const poltrona = ['', 'SIM', '2 POLTRONAS'];

  const painel = [
    '',
    '1 PAINEL',
    '2 PAINEIS',
    '2 PAINEIS E 1 MODULO',
    '1 PAINEL E 1 MODULO',
    '1 PAINEL E 2 MODULOS'
  ];

  // =========================
  // Sessão 2 – Tempos base (minutos)
  // =========================
  const BASE = {
    BERCO_DIVERSOS:      40,
    BERCO_2DIVERSOS:     75,
    BERCO_NIDO:          40,

    // ✅ FORMARE mantém o que era MAXX/FORMARE
    BERCO_FORMARE:       90,
    // ✅ MAXX = FORMARE - 15
    BERCO_MAXX:          75,

    BERCO_CAMA:          60,
    BERCO_DIVERSOS_CAMA: 75,
    BERCO_NIDO_CAMA:     75,

    // ✅ combos com cama (mantém lógica antiga, só separando)
    BERCO_FORMARE_CAMA:  105, // era BASE.BERCO_MAXX_CAMA (do antigo MAXX/FORMARE)
    BERCO_MAXX_CAMA:     90, // 15 min a menos

    COMODA_1:           50,
    COMODA_2:           105,

    ROUPEIRO_23:            100,
    ROUPEIRO_4:             120,
    ROUPEIRO_TUTTO_4PTS:    150,
    ROUPEIRO_PROVENCE_FLOW: 135,
    ROUPEIRO_DESLIZANTE_TUTTO: 135,

    POLTRONA_1:         30,
    POLTRONA_2_SOLO:    45,
    POLTRONA_2_ADD:     15,

    PAINEL_1:           120,
    PAINEL_2:           210
  };

  // =========================
  // Sessão 3 – Funções auxiliares
  // =========================
  const clean = v => v === 'NÃO' ? '' : v;

  const rouptype = (t) => {
    if (!t) return '';
    const up = String(t).toUpperCase();

    // ✅ casos específicos (ordem importa!)
    if (/4 PTS\s*\(TUTTO\)/.test(up)) return 'TUTTO_4PTS';
    if (/DESLIZANTE/.test(up) && /TUTTO/.test(up)) return 'DESLIZANTE_TUTTO';
    if (/PROVENCE\/FLOW/.test(up) || /PROVENCE/.test(up)) return 'PROVENCE_FLOW';

    // ✅ genéricos
    if (/4 PTS/.test(up) || /DESLIZANTE/.test(up)) return '4';
    if (/2 PTS|3 PTS/.test(up)) return '23';

    return '';
  };

  const panelMin = (p) => {
    if (!p) return 0;
    const up = p.toUpperCase();

    let mods = +(/\b(\d)\s*MODULO/.exec(up)?.[1] || 0);
    if (/2 MODULOS/.test(up)) mods = 2;
    if (/1 MODULO/.test(up))  mods = 1;

    const base = /2 PAINEIS/.test(up) ? BASE.PAINEL_2 : BASE.PAINEL_1;
    return base + mods * 30;
  };

  const bercoMin = (b, inCombo) => {
    const v = (b || '').toUpperCase();
    if (!v) return 0;

    if (v === 'DIVERSOS') return BASE.BERCO_DIVERSOS;

    if (v === '2 DIVERSOS' || v === '2 BERÇOS DIVERSOS') return BASE.BERCO_2DIVERSOS;
    if (v === '2 CAMAS') return BASE.BERCO_2DIVERSOS; // ✅ igual 2 berços diversos

    if (v === 'NIDO') return BASE.BERCO_NIDO;

    // ✅ separados
    if (v === 'FORMARE') return BASE.BERCO_FORMARE;
    if (v === 'MAXX')    return BASE.BERCO_MAXX;

    if (v === 'CAMA') return BASE.BERCO_CAMA;

    if (v === 'DIVERSOS E CAMA') return inCombo ? 75 : BASE.BERCO_DIVERSOS_CAMA;
    if (v === 'NIDO E CAMA')     return inCombo ? 75 : BASE.BERCO_NIDO_CAMA;

    // ✅ separados (mantendo a lógica antiga do inCombo)
    if (v === 'FORMARE E CAMA')  return inCombo ? 120 : BASE.BERCO_FORMARE_CAMA;
    if (v === 'MAXX E CAMA')     return inCombo ? 105 : BASE.BERCO_MAXX_CAMA;

    return 0;
  };

  // =========================
  // Sessão 4 – Geração
  // =========================
  Logger.log("🧠 [INFO] Gerando combinações...");
  const data = [];

  for (const Braw of berco)
    for (const Craw of comoda)
      for (const Rraw of roupeiro)
        for (const Praw of poltrona)
          for (const Paraw of painel) {

            const B  = clean(Braw);
            const C  = clean(Craw);
            const R  = clean(Rraw);
            const P  = clean(Praw);
            const Pa = clean(Paraw);

            if (!(B || C || R || P || Pa)) continue;

            const hasComoda   = C !== '';
            const hasRoupeiro = rouptype(R) !== '';
            const hasBerco    = B !== '';
            const mainCount   = (hasBerco ? 1 : 0) + (hasComoda ? 1 : 0) + (hasRoupeiro ? 1 : 0);

            let min = panelMin(Pa) + bercoMin(B, hasComoda || hasRoupeiro);
            min += (C === 'SIM') ? BASE.COMODA_1 : (C === '2 COMODAS' ? BASE.COMODA_2 : 0);

            // roupeiro
            const rt = rouptype(R);
            let rouMin =
              (rt === '23')              ? BASE.ROUPEIRO_23 :
              (rt === '4')               ? BASE.ROUPEIRO_4 :
              (rt === 'TUTTO_4PTS')       ? BASE.ROUPEIRO_TUTTO_4PTS :
              (rt === 'DESLIZANTE_TUTTO') ? BASE.ROUPEIRO_DESLIZANTE_TUTTO :
              (rt === 'PROVENCE_FLOW')    ? BASE.ROUPEIRO_PROVENCE_FLOW :
                                            0;

            // ✅ Regra: quarto completo soma +15 no roupeiro,
            // EXCETO quando for FORMARE/MAXX + CÔMODA + (TUTTO ou PROVENCE)
            const bercoUp = (B || '').toUpperCase();
            const isFormareOuMaxx = (bercoUp === 'FORMARE' || bercoUp === 'MAXX');
            const isRoupeiroTuttoOuProvence = (rt === 'TUTTO_4PTS' || rt === 'DESLIZANTE_TUTTO' || rt === 'PROVENCE_FLOW');

            if (mainCount === 3 && rt) {
              const deveSomar15 = !(isFormareOuMaxx && hasComoda && isRoupeiroTuttoOuProvence);
              if (deveSomar15) {
                rouMin += 30;
              } else {
                Logger.log("ℹ️ [INFO] Regra especial aplicada: sem +15 no roupeiro (FORMARE/MAXX + CÔMODA + " + rt + ")");
              }
            }

            min += rouMin;

            // poltronas
            if (P === 'SIM' && !hasBerco && !hasComoda && !hasRoupeiro && !Pa) {
              min += BASE.POLTRONA_1;
            }
            if (P === '2 POLTRONAS') {
              min += (!hasBerco && !hasComoda && !hasRoupeiro && !Pa)
                ? BASE.POLTRONA_2_SOLO
                : BASE.POLTRONA_2_ADD;
            }

            // descontos
            // ✅ agora FORMARE ou MAXX contam como "formare-like" (mesma regra antiga)
            const berForm = /^FORMARE/.test(B) || /^MAXX/.test(B);

            let desc = 0;
            if (mainCount === 2) {
              if (hasBerco && hasComoda) {
                desc = (berForm || B.startsWith('2') || C === '2 COMODAS') ? 30 : 15;
              } else if (hasRoupeiro && (hasBerco || hasComoda)) {
                desc = (rt === '23' ? 45 : 30);
              }
            }
            if (mainCount === 3) {
              desc = (rt === '23' ? (berForm ? 90 : 75) : (berForm ? 75 : 60));
            }
            min -= desc;
            
            const parts = [];
            if (B) parts.push(`BERÇO ${B}`);
            if (C === 'SIM') parts.push('CÔMODA');
            else if (C)      parts.push('2 COMODAS');
            if (R) parts.push(R);
            if (P === 'SIM') parts.push('POLTRONA');
            else if (P)      parts.push('2 POLTRONAS');
            if (Pa) parts.push(Pa);

            data.push([
              B, C, R, P, Pa,
              parts.join(', '),
              min,
              Utilities.formatDate(new Date(min * 60 * 1000), 'GMT', 'HH:mm')
            ]);
          }

  // =========================
  // Sessão 5 – Gravação
  // =========================
  Logger.log("💾 [INFO] Gravando " + data.length + " linhas na aba...");
  sh.getRange(1, 1, 1, 8).setValues([[
    'BERÇO', 'CÔMODA', 'ROUPEIRO', 'POLTRONA', 'PAINEL',
    'VARIAÇÃO', 'MINUTOS', 'TEMPO'
  ]]);

  if (data.length > 0) {
    sh.getRange(2, 1, data.length, 8).setValues(data);
  }

  SpreadsheetApp.flush();

  // =========================
  // Sessão 6 – Versão / cache
  // =========================
  PropertiesService.getScriptProperties()
    .setProperty('TEMPO_SERVICOS_VERSION', String(Date.now()));

  Logger.log("✅ [INFO] Finalizado gerarTempoServiCalcula() | Linhas: " + data.length);
}
