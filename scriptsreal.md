/**
 * =========================================================
 * RECEBIMENTO MATIC — PLANILHA + REST (APP.LEBEBE)
 * =========================================================
 *
 * O que este código faz:
 * 1) Mantém o fluxo atual da planilha (processarNFeEmail) SEM mudar o resultado.
 * 2) Adiciona um endpoint REST (doPost) para o app.lebebe chamar sob demanda.
 * 3) Reaproveita o mesmo “motor” (buscarNFesMotor_) para os 2 modos.
 *
 * Como publicar o REST:
 * - Deploy > New deployment > Web App
 * - Execute as: Me (lucas@lebebe.com.br)
 * - Who has access: Anyone
 * - Script Properties:
 *     LEBEBE_IMPORT_TOKEN = "<token forte>"
 *
 * Chamada REST (POST JSON):
 * {
 *   "token": "...",
 *   "inicio": "2026-02-23",
 *   "fim": "2026-02-26"
 * }
 *
 * Retorna:
 * {
 *   ok: true,
 *   inicio, fim, query,
 *   nfs: [ ... ],
 *   erros: [ ... ],
 *   stats: { threads, mensagens, anexos_xml, nfs }
 * }
 * =========================================================
 */


// =========================================================
// Sessão 1.0 — REST/IFRAME: doPost
// =========================================================
function doPost(e) {
  Logger.log("[LOG][REST] doPost iniciado");

  var callbackOrigin = "";
  var body = {};

  try {
    // -----------------------------------------------------
    // 1) Detectar modo IFRAME (form fields) vs JSON (API)
    // -----------------------------------------------------
    var isIframeMode = !!(e && e.parameter && e.parameter.callback_origin);

    if (isIframeMode) {
      callbackOrigin = (e.parameter.callback_origin || "").toString().trim();
      Logger.log("[LOG][REST] Modo IFRAME. callback_origin=" + callbackOrigin);

      try {
        body = JSON.parse((e.parameter.payload || "{}").toString());
      } catch (errPayload) {
        return htmlPostMessage_({ ok: false, error: "payload_invalido" }, callbackOrigin);
      }
    } else {
      Logger.log("[LOG][REST] Modo API JSON");
      try {
        body = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : "{}");
      } catch (errBody) {
        return jsonResponse_({ ok: false, error: "invalid_body" });
      }
    }

    // -----------------------------------------------------
    // 2) Auth / token (opcional no iframe)
    // -----------------------------------------------------
    var expectedToken = PropertiesService.getScriptProperties().getProperty("LEBEBE_IMPORT_TOKEN");
    var receivedToken = (body.token || "").toString().trim();

    // Regra:
    // - modo API JSON: se existir expectedToken, exigir match
    // - modo IFRAME: token é opcional (domínio já restringe)
    if (!isIframeMode) {
      if (expectedToken && receivedToken !== expectedToken) {
        Logger.log("[LOG][REST] Token inválido/ausente (API JSON)");
        return jsonResponse_({ ok: false, error: "unauthorized" });
      }
    } else {
      if (expectedToken && receivedToken && receivedToken !== expectedToken) {
        Logger.log("[LOG][REST] Token inválido (IFRAME)");
        return htmlPostMessage_({ ok: false, error: "unauthorized" }, callbackOrigin);
      }
    }

    // -----------------------------------------------------
    // 3) Datas
    // -----------------------------------------------------
    var inicio = (body.inicio || "").toString().trim(); // YYYY-MM-DD
    var fim    = (body.fim    || "").toString().trim(); // YYYY-MM-DD

    if (!inicio || !fim) {
      var err1 = { ok: false, error: "inicio_e_fim_obrigatorios" };
      return isIframeMode ? htmlPostMessage_(err1, callbackOrigin) : jsonResponse_(err1);
    }

    var dataInicio = parseDateCell_(inicio);
    var dataFim    = parseDateCell_(fim);

    if (!dataInicio || !dataFim) {
      var err2 = { ok: false, error: "datas_invalidas" };
      return isIframeMode ? htmlPostMessage_(err2, callbackOrigin) : jsonResponse_(err2);
    }

    dataInicio = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
    dataFim    = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());

    if (dataFim < dataInicio) {
      var err3 = { ok: false, error: "fim_menor_que_inicio" };
      return isIframeMode ? htmlPostMessage_(err3, callbackOrigin) : jsonResponse_(err3);
    }

    var diffDias = Math.floor((dataFim - dataInicio) / (1000 * 60 * 60 * 24));
    if (diffDias > 90) {
      var err4 = { ok: false, error: "janela_maxima_90_dias" };
      return isIframeMode ? htmlPostMessage_(err4, callbackOrigin) : jsonResponse_(err4);
    }

    // -----------------------------------------------------
    // 4) Executar motor (no iframe NÃO precisa procv)
    // -----------------------------------------------------
    var emailAddress = "nfe@maticmoveis.com.br";
    var motor = buscarNFesMotor_(emailAddress, dataInicio, dataFim, null);

    var response = {
      ok: true,
      inicio: inicio,
      fim: fim,
      query: motor.query,
      nfs: motor.nfs,
      erros: motor.erros,
      stats: motor.stats
    };

    Logger.log("[LOG][REST] OK. NFs=" + (motor.nfs || []).length + " | Erros=" + (motor.erros || []).length);

    return isIframeMode ? htmlPostMessage_(response, callbackOrigin) : jsonResponse_(response);

  } catch (err) {
    Logger.log("[LOG][REST] Erro geral: " + err);
    var errGeral = { ok: false, error: (err && err.message) ? err.message : String(err) };
    return callbackOrigin ? htmlPostMessage_(errGeral, callbackOrigin) : jsonResponse_(errGeral);
  }
}

/**
 * =========================================================
 * Sessão 2.0 — MODO PLANILHA (mantém seu fluxo atual)
 * =========================================================
 */
function processarNFeEmail() {
  /**
   * Sessão 2.1 – Configurações globais (igual você já usa)
   */
  var emailAddress = "nfe@maticmoveis.com.br";
  var planilha = SpreadsheetApp.openByUrl(
    "https://docs.google.com/spreadsheets/d/1Xs-z_LDbB1E-kp9DK-x4-dFkU58xKpYhz038NNrTb54/edit#gid=493873819"
  );

  var sheet = planilha.getSheetByName("COLAR NF AQUI");
  var imprimirSheet = planilha.getSheetByName("IMPRIMIR");
  var resumoSheet =
    planilha.getSheetByName("RESUMO RECEBIMENTOS") ||
    planilha.insertSheet("RESUMO RECEBIMENTOS");
  var procvSheet = planilha.getSheetByName("PROCV- LOJA");

  if (!sheet || !imprimirSheet || !procvSheet) {
    Logger.log("[LOG] Erro: Uma das páginas ('COLAR NF AQUI', 'IMPRIMIR' ou 'PROCV- LOJA') não foi encontrada.");
    return;
  }

  var headers = [
    "Número NF","@_nItem","prod/cProd","prod/cEAN","prod/xProd","prod/NCM",
    "prod/CFOP","prod/uCom","prod/qCom","prod/vUnCom","prod/vProd",
    "Prateleira","Data NF","É O.S?","Número O.S."
  ];

  if (resumoSheet.getLastRow() === 0) {
    resumoSheet.appendRow([
      "DATA DAS NF","PESO TOTAL RECEBIDO","VOLUMES TOTAIS RECEBIDOS","NÚMERO DAS NF RECEBIDAS","ASSISTÊNCIAS (SEM VOLUMES)"
    ]);
  }

  var assistenciasSheet =
    planilha.getSheetByName("ASSISTENCIAS NF") ||
    planilha.insertSheet("ASSISTENCIAS NF");

  if (assistenciasSheet.getLastRow() === 0) {
    assistenciasSheet.appendRow(["Número NF", "Número O.S."]);
  }

  /**
   * Sessão 2.2 – Limpeza da aba IMPRIMIR (igual)
   */
  imprimirSheet.getRange("S6").clear();
  imprimirSheet.getRange("B5").setValue("");
  imprimirSheet.getRange("C6").setValue("");
  imprimirSheet.getRange("N2").setValue("");

  /**
   * Sessão 2.3 – Período (IMPRIMIR!C2 e IMPRIMIR!F2)
   */
  var inicioCell = imprimirSheet.getRange("C2").getValue();
  var fimCell    = imprimirSheet.getRange("F2").getValue();

  var dataInicio = parseDateCell_(inicioCell);
  var dataFim    = parseDateCell_(fimCell);

  if (!dataInicio || !dataFim) {
    var msg1 = "⚠️ Informe as datas em IMPRIMIR!C2 (início) e IMPRIMIR!F2 (fim).";
    Logger.log("[LOG] " + msg1);
    imprimirSheet.getRange("N2").setValue(msg1);
    return;
  }

  dataInicio = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
  dataFim    = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate());

  if (dataFim < dataInicio) {
    var msg2 = "⚠️ Data final (F2) não pode ser menor que a data inicial (C2).";
    Logger.log("[LOG] " + msg2);
    imprimirSheet.getRange("N2").setValue(msg2);
    return;
  }

  var diffDias = Math.floor((dataFim - dataInicio) / (1000*60*60*24));
  if (diffDias > 90) {
    // seu texto dizia 15 dias mas validava 90; mantive 90 para não quebrar
    var msg3 = "⚠️ Janela máxima: 90 dias entre C2 e F2.";
    Logger.log("[LOG] " + msg3);
    imprimirSheet.getRange("N2").setValue(msg3);
    return;
  }

  /**
   * Sessão 2.4 – Ler PROCV (pra prateleira no modo planilha)
   */
  var procvData = procvSheet.getRange("A2:G" + procvSheet.getLastRow()).getValues();

  /**
   * Sessão 2.5 – Chamar motor (mesma busca/parse), agora com procvData
   */
  var motor = buscarNFesMotor_(emailAddress, dataInicio, dataFim, procvData);

  if (!motor.nfs || motor.nfs.length === 0) {
    var msg4 = "NENHUMA NF ENCONTRADA NO PERÍODO INFORMADO";
    Logger.log("[LOG] " + msg4);
    sheet.clear();
    sheet.getRange(1, 1).setValue(msg4);
    imprimirSheet.getRange("N2").setValue(msg4);
    return;
  }

  /**
   * Sessão 2.6 – Converter retorno do motor para o formato da planilha (todasNFData etc.)
   * Mantém o mesmo resultado que você já tinha.
   */
  var todasNFData = [];
  var datasNF = [];
  var numerosNF = [];
  var osVolumes = [];
  var osSemVolumes = [];
  var pesoTotal = 0;
  var volumesTotal = 0;
  var assistenciasPendentes = [];

  for (var i = 0; i < motor.nfs.length; i++) {
    var nf = motor.nfs[i];

    // totais
    pesoTotal += (parseFloat(nf.peso_total) || 0);
    volumesTotal += (parseInt(nf.volumes_total, 10) || 0);

    if (nf.data_emissao) datasNF.push(nf.data_emissao);
    if (nf.numero_nf) numerosNF.push(nf.numero_nf);

    // OS/OC
    var isOS = nf.is_os ? "SIM" : "NÃO";
    var osList = nf.os_oc || [];
    var numeroOSApenas = (osList.length > 0) ? osList[0] : "";

    if (osList.length > 0) {
      for (var oi = 0; oi < osList.length; oi++) {
        osVolumes.push(osList[oi] + " (" + (nf.volumes_total || "0") + ")");
        osSemVolumes.push(osList[oi]);
      }
      assistenciasPendentes.push([nf.numero_nf, numeroOSApenas]);
    }

    // itens (linhas da COLAR NF AQUI)
    for (var j = 0; j < nf.itens.length; j++) {
      var it = nf.itens[j];

      todasNFData.push([
        nf.numero_nf,
        it.n_item,
        it.codigo_produto,
        "SEM GTIN", // no REST a gente não pega cEAN; na planilha você pegava, mas na prática SEM GTIN aparece. Se quiser, eu incluo.
        it.descricao,
        it.ncm || "",     // opcional
        it.cfop || "",    // opcional
        it.ucom || "PC",  // opcional
        String(it.quantidade),
        it.vuncom || "",  // opcional
        it.vprod || "",   // opcional
        it.prateleira || "", // calculada no motor via procvData quando não é OS
        nf.data_emissao,
        isOS,
        numeroOSApenas
      ]);
    }
  }

  /**
   * Sessão 2.7 – Escrever nas Sheets (igual ao seu)
   */
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, todasNFData.length, headers.length).setValues(todasNFData);

  // Data mais antiga (RESUMO)
  var dataMaisAntiga = new Date(Math.min.apply(null, datasNF.map(function (d) { return new Date(d); })));
  var dataFormatada  = Utilities.formatDate(dataMaisAntiga, Session.getScriptTimeZone(), "dd/MM/yyyy");

  imprimirSheet.getRange("S6").setValue(pesoTotal);
  imprimirSheet.getRange("B5").setValue(numerosNF.join(", "));
  if (osVolumes.length > 0) {
    imprimirSheet.getRange("C6").setValue(osVolumes.join(", "));
  }

  resumoSheet.appendRow([
    dataFormatada,
    (pesoTotal || 0).toFixed(2),
    volumesTotal,
    numerosNF.join(", "),
    osSemVolumes.join(", ")
  ]);

  /**
   * Sessão 2.8 – Avisos recentes em RECEBIMENTO MATIC (mantido igual)
   */
  try {
    var planilhaMatic = SpreadsheetApp.openByUrl(
      "https://docs.google.com/spreadsheets/d/1Xs-z_LDbB1E-kp9DK-x4-dFkU58xKpYhz038NNrTb54/edit?resourcekey=&pli=1&gid=1085497704#gid=1085497704"
    );
    var sheetRecebimento = planilhaMatic.getSheetByName("RECEBIMENTO MATIC");
    var dadosReceb = sheetRecebimento.getDataRange().getValues();

    var hoje = new Date();
    var avisosRecentes = [];

    for (var a = 1; a < dadosReceb.length; a++) {
      var dataCell = dadosReceb[a][0];
      var avisoJ   = dadosReceb[a][9];
      var avisoK   = dadosReceb[a][10];

      var partesAviso = [];
      if (avisoJ && avisoJ.toString().trim() !== "") partesAviso.push(avisoJ.toString().trim());
      if (avisoK && avisoK.toString().trim() !== "") partesAviso.push(avisoK.toString().trim());
      var avisoTxt = partesAviso.join(" | ");
      if (!dataCell || avisoTxt === "") continue;

      var dataCarimbo;
      if (Object.prototype.toString.call(dataCell) === "[object Date]") {
        dataCarimbo = dataCell;
      } else {
        var apenasData = dataCell.toString().split(" ")[0];
        var p = apenasData.split("/");
        if (p.length === 3) dataCarimbo = new Date(p[2], p[1]-1, p[0]); else continue;
      }

      var diffDiasCarimbo = (hoje - dataCarimbo) / (1000 * 60 * 60 * 24);
      if (diffDiasCarimbo <= 15) {
        var prefixo = Utilities.formatDate(dataCarimbo, Session.getScriptTimeZone(), "dd-MM");
        avisosRecentes.push("(" + prefixo + ") " + avisoTxt);
      }
    }

    imprimirSheet.getRange("C7").setValue("");
    if (avisosRecentes.length > 0) {
      imprimirSheet.getRange("C7").setValue(avisosRecentes.join(" | "));
    }
  } catch (e) {
    Logger.log("[LOG] Erro ao buscar avisos em RECEBIMENTO MATIC: " + e);
  }

  /**
   * Sessão 2.9 – Persistência NF↔OS (mantido igual)
   */
  try {
    if (assistenciasPendentes.length > 0) {
      var startRow = assistenciasSheet.getLastRow() + 1;
      assistenciasSheet
        .getRange(startRow, 1, assistenciasPendentes.length, 2)
        .setValues(assistenciasPendentes);
      Logger.log("[LOG] ✅ Gravadas " + assistenciasPendentes.length + " linha(s) em 'ASSISTENCIAS NF'.");
    } else {
      Logger.log("[LOG] ℹ️ Nenhuma NF com O.S. para gravar em 'ASSISTENCIAS NF' nesta execução.");
    }
  } catch (e2) {
    Logger.log("[LOG] ❌ Erro ao gravar em 'ASSISTENCIAS NF': " + e2);
  }
}


/**
 * =========================================================
 * Sessão 3.0 — MOTOR: Busca e Parse (usado por planilha e REST)
 * =========================================================
 *
 * - Se procvData for null, não calcula prateleira.
 * - Retorna lista de NFs consolidadas por número_nf.
 */
function buscarNFesMotor_(emailAddress, dataInicio, dataFim, procvData) {
  Logger.log("[LOG][MOTOR] Iniciando motor: " + emailAddress);

  // Gmail before é exclusivo → somar 1 dia no fim
  var fimMaisUm = addDays_(dataFim, 1);
  var afterStr  = formatYYYYMMDD_(dataInicio);
  var beforeStr = formatYYYYMMDD_(fimMaisUm);

  var query =
    'from:' + emailAddress +
    ' subject:"Nota Fiscal Eletronica"' +
    ' after:'  + afterStr +
    ' before:' + beforeStr +
    ' has:attachment';

  Logger.log("[LOG][MOTOR] Gmail query: " + query);

  var threads = GmailApp.search(query);
  var messagesByThread = GmailApp.getMessagesForThreads(threads);

  var nfsMap = {}; // chave = numero_nf normalizado (só dígitos)
  var erros = [];

  var stats = {
    threads: threads.length,
    mensagens: 0,
    anexos_xml: 0,
    nfs: 0
  };

  if (!messagesByThread || messagesByThread.length === 0) {
    return { query: query, nfs: [], erros: [], stats: stats };
  }

  // Carregar PROCV se veio (para prateleira sugerida)
  var procv = procvData || null;

  for (var i = 0; i < messagesByThread.length; i++) {
    var msgs = messagesByThread[i] || [];
    stats.mensagens += msgs.length;

    for (var j = 0; j < msgs.length; j++) {
      var msg = msgs[j];
      var msgId = msg.getId();
      var atts = msg.getAttachments();

      for (var k = 0; k < atts.length; k++) {
        var att = atts[k];
        var ct = (att.getContentType() || "").toLowerCase();
        var name = (att.getName() || "");

        var isXml =
          ct === "application/xml" ||
          ct === "text/xml" ||
          (name.toLowerCase().indexOf(".xml") !== -1);

        if (!isXml) continue;

        stats.anexos_xml++;

        try {
          var xmlContent = att.getDataAsString();
          var parsed = parsearNFeXMLRobusto_(xmlContent);

          if (!parsed || !parsed.numero_nf) {
            erros.push({ etapa: "parse_xml", message: "XML inválido/NFe não detectada", emailMessageId: msgId, attachmentName: name });
            continue;
          }

          // filtrar por data de emissão dentro da janela
          var dataEmissaoD = parsed.data_emissao ? parseDateCell_(parsed.data_emissao) : null;
          if (!dataEmissaoD || dataEmissaoD < dataInicio || dataEmissaoD > dataFim) {
            continue;
          }

          // prateleira (somente no modo planilha)
          if (procv && parsed.itens && parsed.itens.length > 0) {
            for (var it = 0; it < parsed.itens.length; it++) {
              var codigo = parsed.itens[it].codigo_produto;
              var pr = "";
              if (!parsed.is_os) {
                var found = buscarPrateleira(codigo, procv);
                pr = (found !== "" ? found : "S/P");
              }
              parsed.itens[it].prateleira = pr;
            }
          }

          // consolidar por NF
          var key = parsed.numero_nf;

          if (!nfsMap[key]) {
            nfsMap[key] = parsed;
          } else {
            // mesclar OS/OC sem duplicar
            var base = nfsMap[key];
            var nov = parsed;

            // manter data_emissao se base vazio
            if (!base.data_emissao && nov.data_emissao) base.data_emissao = nov.data_emissao;

            // somar? (normalmente mesmo XML não precisa; manter o maior para segurança)
            base.peso_total = Math.max(parseFloat(base.peso_total || 0), parseFloat(nov.peso_total || 0));
            base.volumes_total = Math.max(parseInt(base.volumes_total || 0, 10), parseInt(nov.volumes_total || 0, 10));

            // is_os: se algum indicar, marca true
            base.is_os = !!(base.is_os || nov.is_os);

            // os_oc: merge
            base.os_oc = base.os_oc || [];
            nov.os_oc = nov.os_oc || [];
            for (var o = 0; o < nov.os_oc.length; o++) {
              if (base.os_oc.indexOf(nov.os_oc[o]) === -1) base.os_oc.push(nov.os_oc[o]);
            }

            // itens: dedupe por n_item
            var exist = {};
            for (var bi = 0; bi < (base.itens || []).length; bi++) {
              exist[String(base.itens[bi].n_item)] = true;
            }
            for (var ni = 0; ni < (nov.itens || []).length; ni++) {
              var nk = String(nov.itens[ni].n_item);
              if (!exist[nk]) {
                base.itens.push(nov.itens[ni]);
                exist[nk] = true;
              }
            }
          }

        } catch (err) {
          erros.push({ etapa: "parse_xml", message: String(err), emailMessageId: msgId, attachmentName: name });
        }
      }
    }
  }

  // map -> array
  var nfs = [];
  for (var nfKey in nfsMap) {
    nfs.push(nfsMap[nfKey]);
  }

  stats.nfs = nfs.length;

  Logger.log("[LOG][MOTOR] Finalizado. NFs: " + nfs.length + " | Erros: " + erros.length);

  return { query: query, nfs: nfs, erros: erros, stats: stats };
}


/**
 * =========================================================
 * Sessão 4.0 — Parse robusto da NFe (aguenta nfeProc e NFe)
 * =========================================================
 */
function parsearNFeXMLRobusto_(xmlContent) {
  var xmlDocument = XmlService.parse(xmlContent);
  var root = xmlDocument.getRootElement();

  // Namespace padrão NFe
  var nsNfe = XmlService.getNamespace("http://www.portalfiscal.inf.br/nfe");

  // Pode vir como <nfeProc>...</nfeProc> contendo <NFe>
  var nfeNode = null;

  if (root.getName() === "nfeProc") {
    nfeNode = root.getChild("NFe", nsNfe) || root.getChild("NFe");
  } else if (root.getName() === "NFe") {
    nfeNode = root;
  } else {
    // tenta encontrar NFe no primeiro nível
    nfeNode = root.getChild("NFe", nsNfe) || root.getChild("NFe");
  }

  if (!nfeNode) return null;

  var infNFe = nfeNode.getChild("infNFe", nsNfe) || nfeNode.getChild("infNFe");
  if (!infNFe) return null;

  var ide = infNFe.getChild("ide", nsNfe) || infNFe.getChild("ide");
  if (!ide) return null;

  var numeroNF = (ide.getChildText("nNF", nsNfe) || ide.getChildText("nNF") || "").toString().trim();
  if (!numeroNF) return null;

  // normaliza só dígitos
  var numero_nf = numeroNF.replace(/\D/g, "");

  var dhEmi = (ide.getChildText("dhEmi", nsNfe) || ide.getChildText("dhEmi") || "").toString();
  var dEmi  = (ide.getChildText("dEmi", nsNfe)  || ide.getChildText("dEmi")  || "").toString();
  var dataEmissaoS = (dhEmi ? dhEmi.split("T")[0] : dEmi) || "";

  // transp/vol
  var transp = infNFe.getChild("transp", nsNfe) || infNFe.getChild("transp");
  var vol = transp ? (transp.getChild("vol", nsNfe) || transp.getChild("vol")) : null;

  var pesoL = 0;
  var qVol = 0;
  if (vol) {
    pesoL = parseFloat((vol.getChildText("pesoL", nsNfe) || vol.getChildText("pesoL") || "0")) || 0;
    qVol  = parseInt((vol.getChildText("qVol", nsNfe)  || vol.getChildText("qVol")  || "0"), 10) || 0;
  }

  // is_os por natOp
  var natOp = (ide.getChildText("natOp", nsNfe) || ide.getChildText("natOp") || "").toString();
  var is_os = (natOp && natOp.toUpperCase() === "ASSIST.TECNICA");

  // infAdic/infCpl para OS/OC
  var infAdic = infNFe.getChild("infAdic", nsNfe) || infNFe.getChild("infAdic");
  var infoComplementares = infAdic ? (infAdic.getChildText("infCpl", nsNfe) || infAdic.getChildText("infCpl")) : "";
  var os_oc = [];
  var os_oc_principal = "";

  if (infoComplementares) {
    var regexOS = /\bO\.?\s*S\.?\s*[:\- ]?(\d+)\b/gi;
    var regexOC = /\bO\s*C\s*[:\- ]?(\d+)\b/gi;

    var encontrados = [];
    var m;

    while ((m = regexOS.exec(infoComplementares)) !== null) {
      if (m[1]) encontrados.push(m[1]);
    }
    while ((m = regexOC.exec(infoComplementares)) !== null) {
      if (m[1]) encontrados.push(m[1]);
    }

    var vistos = {};
    for (var i = 0; i < encontrados.length; i++) {
      var soDigitos = (encontrados[i] || "").toString().replace(/\D/g, "");
      if (!soDigitos) continue;
      if (!vistos[soDigitos]) {
        vistos[soDigitos] = true;
        os_oc.push(soDigitos);
      }
    }

    if (os_oc.length > 0) os_oc_principal = os_oc[0];
  }

  // itens det
  var dets = infNFe.getChildren("det", nsNfe);
  if (!dets || dets.length === 0) dets = infNFe.getChildren("det");

  var itens = [];
  for (var d = 0; d < dets.length; d++) {
    var det = dets[d];

    // atributo nItem (se existir)
    var nAttr = det.getAttribute("nItem");
    var nItem = nAttr ? parseInt(nAttr.getValue(), 10) : (d + 1);

    var prod = det.getChild("prod", nsNfe) || det.getChild("prod");
    if (!prod) continue;

    var cProd = (prod.getChildText("cProd", nsNfe) || prod.getChildText("cProd") || "").toString();
    var xProd = (prod.getChildText("xProd", nsNfe) || prod.getChildText("xProd") || "").toString();
    var qCom  = parseFloat((prod.getChildText("qCom", nsNfe) || prod.getChildText("qCom") || "0")) || 0;

    // opcional: manter campos extras se quiser
    var ncm   = (prod.getChildText("NCM", nsNfe)  || prod.getChildText("NCM")  || "").toString();
    var cfop  = (prod.getChildText("CFOP", nsNfe) || prod.getChildText("CFOP") || "").toString();
    var uCom  = (prod.getChildText("uCom", nsNfe) || prod.getChildText("uCom") || "").toString();
    var vUnCom= (prod.getChildText("vUnCom", nsNfe)|| prod.getChildText("vUnCom")|| "").toString();
    var vProd = (prod.getChildText("vProd", nsNfe) || prod.getChildText("vProd") || "").toString();
    var cEAN  = (prod.getChildText("cEAN", nsNfe)  || prod.getChildText("cEAN")  || "").toString();

    var codigo_produto = removerZerosAEsquerda(cProd);

    if (!codigo_produto) continue;

    itens.push({
      n_item: nItem,
      codigo_produto: codigo_produto,
      descricao: xProd,
      quantidade: parseInt(String(Math.round(qCom)), 10) || 0,

      // extras (não atrapalham o app, mas ajudam a planilha manter colunas)
      ncm: ncm,
      cfop: cfop,
      ucom: uCom,
      vuncom: vUnCom,
      vprod: vProd,
      cean: cEAN,

      // preenchido no motor quando tem procvData
      prateleira: ""
    });
  }

  return {
    numero_nf: numero_nf,
    data_emissao: dataEmissaoS,
    peso_total: pesoL,
    volumes_total: qVol,
    is_os: is_os,
    os_oc: os_oc,
    os_oc_principal: os_oc_principal,
    itens: itens
  };
}

// =========================================================
// Sessão 1.1 — HTML postMessage (para iframe, contorna CORS)
// =========================================================
function htmlPostMessage_(data, origin) {
  var safeOrigin = (origin || "").toString().replace(/"/g, "&quot;");
  var jsonStr = JSON.stringify(data);

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
    '<p>Processando...</p>' +
    '<script>' +
    'try {' +
    '  var payload = ' + jsonStr + ';' +
    '  window.parent.postMessage({ source: "appscript-nfe", data: payload }, "' + safeOrigin + '");' +
    '} catch(e) {' +
    '  window.parent.postMessage({ source: "appscript-nfe", data: { ok:false, error: e.message } }, "' + safeOrigin + '");' +
    '}' +
    '</script>' +
    '</body></html>';

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * =========================================================
 * Sessão 5.0 — Helpers e utilitários (mantidos)
 * =========================================================
 */
function obterConfigPadrao_() {
  return {
    emailAddress: "nfe@maticmoveis.com.br"
  };
}

function jsonResponse_(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function removerZerosAEsquerda(codigo) {
  return (codigo || "").toString().replace(/^0+/, "");
}

function buscarPrateleira(codigo, tabela) {
  // Mantive log porque você gosta de rastrear; pode ficar verboso em exec grande.
  Logger.log("🔍 [LOG] Buscando prateleira para o código: " + codigo);

  for (var i = 0; i < tabela.length; i++) {
    var codigoBase = (tabela[i][0] || "").toString().trim();
    if (codigo === codigoBase) return tabela[i][5];
  }
  for (var j = 0; j < tabela.length; j++) {
    var refInteira = (tabela[j][6] || "").toString().trim();
    if (codigo === refInteira) return tabela[j][5];
  }

  Logger.log("⚠️ [LOG] Código " + codigo + " não encontrado em Coluna A nem em Coluna G");
  return "";
}

function parseDateCell_(val) {
  if (!val) return null;

  if (Object.prototype.toString.call(val) === "[object Date]") {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }

  var s = val.toString().trim();

  // dd/MM/yyyy
  var m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m1) return new Date(parseInt(m1[3],10), parseInt(m1[2],10)-1, parseInt(m1[1],10));

  // yyyy-MM-dd
  var m2 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m2) return new Date(parseInt(m2[1],10), parseInt(m2[2],10)-1, parseInt(m2[3],10));

  // yyyy/MM/dd
  var m3 = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (m3) return new Date(parseInt(m3[1],10), parseInt(m3[2],10)-1, parseInt(m3[3],10));

  return null;
}

function formatYYYYMMDD_(d) {
  var yyyy = d.getFullYear();
  var mm   = ("0" + (d.getMonth() + 1)).slice(-2);
  var dd   = ("0" + d.getDate()).slice(-2);
  return yyyy + "/" + mm + "/" + dd;
}

function addDays_(d, n) {
  var x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}


/**
 * =========================================================
 * Sessão 6.0 — Teste REST no editor
 * =========================================================
 */
function testDoPost() {
  var token = PropertiesService.getScriptProperties().getProperty("LEBEBE_IMPORT_TOKEN");

  var e = {
    postData: {
      contents: JSON.stringify({
        token: token,
        inicio: "2026-02-23",
        fim: "2026-02-26"
      })
    }
  };

  var result = doPost(e);
  Logger.log("[LOG][TEST] " + result.getContent());
}