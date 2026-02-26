/**
 * =========================================================
 * Google Apps Script — Web App REST para importar NFe Matic
 * =========================================================
 *
 * Publicar como Web App:
 *   - Execute as: Me (lucas@lebebe.com.br)
 *   - Who has access: Anyone within lebebe.com.br
 *
 * Suporta DOIS modos de chamada:
 *
 * 1) JSON API (server-to-server):
 *    POST com body JSON { token, inicio, fim }
 *    Retorna: ContentService JSON
 *
 * 2) Form via iframe (browser, contorna CORS):
 *    POST com form fields: payload (JSON string), callback_origin
 *    Retorna: HtmlService com postMessage para o parent
 *
 * A restrição de domínio (Anyone within lebebe.com.br) é a
 * segurança principal. O token é opcional (defense-in-depth).
 * =========================================================
 */

// =========================================================
// Entry point — doPost
// =========================================================
function doPost(e) {
  var callbackOrigin = '';

  try {
    var body = {};

    // Detectar modo: form (iframe) vs JSON (API)
    if (e.parameter && e.parameter.callback_origin) {
      // MODO IFRAME: dados vêm como form field "payload" (JSON string)
      callbackOrigin = e.parameter.callback_origin;
      Logger.log('[LOG] Modo: iframe (callback_origin=' + callbackOrigin + ')');

      try {
        body = JSON.parse(e.parameter.payload || '{}');
      } catch (err) {
        return htmlPostMessage_({ ok: false, error: 'payload inválido' }, callbackOrigin);
      }
    } else {
      // MODO API: dados vêm no body JSON
      Logger.log('[LOG] Modo: API (JSON body)');
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        return jsonResponse_(400, { ok: false, error: 'invalid_body' });
      }
    }

    // Token: validar se configurado (opcional — domínio já protege)
    var expectedToken = PropertiesService.getScriptProperties().getProperty('LEBEBE_IMPORT_TOKEN');
    if (expectedToken && body.token && body.token !== expectedToken) {
      Logger.log('[LOG] Token inválido');
      var errAuth = { ok: false, error: 'unauthorized' };
      if (callbackOrigin) return htmlPostMessage_(errAuth, callbackOrigin);
      return jsonResponse_(401, errAuth);
    }
    Logger.log('[LOG] Auth OK (domínio + token)');

    // Validar datas
    var inicio = body.inicio; // "YYYY-MM-DD"
    var fim = body.fim;       // "YYYY-MM-DD"

    if (!inicio || !fim) {
      var errDatas = { ok: false, error: 'inicio e fim são obrigatórios' };
      if (callbackOrigin) return htmlPostMessage_(errDatas, callbackOrigin);
      return jsonResponse_(400, errDatas);
    }

    var dInicio = new Date(inicio + 'T00:00:00');
    var dFim = new Date(fim + 'T23:59:59');

    if (isNaN(dInicio.getTime()) || isNaN(dFim.getTime())) {
      var errInv = { ok: false, error: 'Datas inválidas' };
      if (callbackOrigin) return htmlPostMessage_(errInv, callbackOrigin);
      return jsonResponse_(400, errInv);
    }

    if (dInicio > dFim) {
      var errOrd = { ok: false, error: 'inicio deve ser <= fim' };
      if (callbackOrigin) return htmlPostMessage_(errOrd, callbackOrigin);
      return jsonResponse_(400, errOrd);
    }

    // Janela máxima 90 dias
    var diffDays = (dFim - dInicio) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      var errJanela = { ok: false, error: 'Janela máxima de 90 dias' };
      if (callbackOrigin) return htmlPostMessage_(errJanela, callbackOrigin);
      return jsonResponse_(400, errJanela);
    }

    // Buscar emails no Gmail
    var result = buscarNFesNoGmail_(inicio, fim);

    Logger.log('[LOG] Total de NFs consolidadas: ' + result.nfs.length);
    Logger.log('[LOG] Total de erros: ' + result.erros.length);

    var response = {
      ok: true,
      inicio: inicio,
      fim: fim,
      query: result.query,
      nfs: result.nfs,
      erros: result.erros
    };

    if (callbackOrigin) return htmlPostMessage_(response, callbackOrigin);
    return jsonResponse_(200, response);

  } catch (err) {
    Logger.log('[LOG] Erro geral: ' + err.message);
    var errGeral = { ok: false, error: err.message };
    if (callbackOrigin) return htmlPostMessage_(errGeral, callbackOrigin);
    return jsonResponse_(500, errGeral);
  }
}

// =========================================================
// Buscar NFes no Gmail
// =========================================================
function buscarNFesNoGmail_(inicio, fim) {
  // Formatar datas para query do Gmail (YYYY/MM/DD)
  var afterDate = inicio.replace(/-/g, '/');
  var beforeDate = fim.replace(/-/g, '/');

  // Ajustar before para +1 dia (Gmail before é exclusivo)
  var dBefore = new Date(fim + 'T00:00:00');
  dBefore.setDate(dBefore.getDate() + 1);
  var beforePlusOne = Utilities.formatDate(dBefore, 'GMT-3', 'yyyy/MM/dd');

  var query = 'from:(matic OR maticbrasil OR nfe OR nf-e) subject:(nfe OR nota OR fiscal OR xml OR danfe) after:' + afterDate + ' before:' + beforePlusOne + ' has:attachment';

  Logger.log('[LOG] Query Gmail: ' + query);

  var threads = GmailApp.search(query);
  Logger.log('[LOG] Threads encontradas: ' + threads.length);

  var nfsMap = {}; // chave = numero_nf normalizado
  var erros = [];
  var totalXmls = 0;

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    Logger.log('[LOG] Thread ' + t + ': ' + messages.length + ' mensagens');

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var msgId = msg.getId();
      var attachments = msg.getAttachments();

      for (var a = 0; a < attachments.length; a++) {
        var att = attachments[a];
        var fileName = att.getName().toLowerCase();

        if (fileName.indexOf('.xml') === -1) continue;

        totalXmls++;

        try {
          var xmlText = att.getDataAsString();
          var parsed = parsearNFeXML_(xmlText);

          if (!parsed) {
            erros.push({ etapa: 'parse_xml', message: 'XML inválido ou não é NFe: ' + att.getName(), emailMessageId: msgId });
            continue;
          }

          var nfKey = parsed.numero_nf;

          // Consolidar: se já existe, mesclar itens (não duplicar)
          if (nfsMap[nfKey]) {
            // Atualizar campos se necessário
            if (parsed.os_oc.length > 0) {
              for (var oi = 0; oi < parsed.os_oc.length; oi++) {
                if (nfsMap[nfKey].os_oc.indexOf(parsed.os_oc[oi]) === -1) {
                  nfsMap[nfKey].os_oc.push(parsed.os_oc[oi]);
                }
              }
            }
          } else {
            nfsMap[nfKey] = parsed;
          }

        } catch (parseErr) {
          erros.push({ etapa: 'parse_xml', message: parseErr.message, emailMessageId: msgId });
        }
      }
    }
  }

  Logger.log('[LOG] Total de XMLs processados: ' + totalXmls);

  // Converter map para array
  var nfs = [];
  for (var key in nfsMap) {
    nfs.push(nfsMap[key]);
  }

  return { query: query, nfs: nfs, erros: erros };
}

// =========================================================
// Parsear XML de NFe
// =========================================================
function parsearNFeXML_(xmlText) {
  try {
    // Verificar se é um XML de NFe
    if (xmlText.indexOf('<nfeProc') === -1 && xmlText.indexOf('<NFe') === -1 && xmlText.indexOf('<infNFe') === -1) {
      return null;
    }

    var doc = XmlService.parse(xmlText);
    var root = doc.getRootElement();

    // Navegar pelo namespace NFe
    var ns = XmlService.getNamespace('http://www.portalfiscal.inf.br/nfe');

    // Tentar encontrar infNFe
    var infNFe = findElement_(root, 'infNFe', ns);
    if (!infNFe) return null;

    // ide
    var ide = findElement_(infNFe, 'ide', ns);
    var nNF = ide ? getElementText_(ide, 'nNF', ns) : '';
    var dhEmi = ide ? (getElementText_(ide, 'dhEmi', ns) || getElementText_(ide, 'dEmi', ns)) : '';

    if (!nNF) return null;

    // Normalizar numero_nf (só dígitos)
    var numero_nf = nNF.replace(/\D/g, '');
    var data_emissao = dhEmi ? dhEmi.substring(0, 10) : '';

    // transp > vol
    var transp = findElement_(infNFe, 'transp', ns);
    var vol = transp ? findElement_(transp, 'vol', ns) : null;
    var pesoL = vol ? parseFloat(getElementText_(vol, 'pesoL', ns) || '0') : 0;
    var qVol = vol ? parseInt(getElementText_(vol, 'qVol', ns) || '0') : 0;

    // det items
    var itens = [];
    var detElements = infNFe.getChildren('det', ns);
    if (!detElements || detElements.length === 0) {
      // Tentar sem namespace
      detElements = infNFe.getChildren('det');
    }

    for (var i = 0; i < detElements.length; i++) {
      var det = detElements[i];
      var nItem = det.getAttribute('nItem') ? parseInt(det.getAttribute('nItem').getValue()) : (i + 1);

      var prod = findElement_(det, 'prod', ns);
      if (!prod) continue;

      var cProd = getElementText_(prod, 'cProd', ns) || '';
      var xProd = getElementText_(prod, 'xProd', ns) || '';
      var qCom = parseFloat(getElementText_(prod, 'qCom', ns) || '0');

      // Normalizar codigo_produto: remover zeros à esquerda
      var codigoProduto = cProd.replace(/^0+/, '') || cProd;

      if (codigoProduto) {
        itens.push({
          nItem: nItem,
          codigo_produto: codigoProduto,
          descricao: xProd,
          quantidade: Math.round(qCom)
        });
      }
    }

    // infAdic > infCpl — detectar OS/OC
    var infAdic = findElement_(infNFe, 'infAdic', ns);
    var infCpl = infAdic ? getElementText_(infAdic, 'infCpl', ns) : '';
    var os_oc = [];
    if (infCpl) {
      var osRegex = /(?:OS|OC|O\.S\.|O\.C\.)\s*[:\-]?\s*(\d+)/gi;
      var match;
      while ((match = osRegex.exec(infCpl)) !== null) {
        if (os_oc.indexOf(match[1]) === -1) {
          os_oc.push(match[1]);
        }
      }
    }

    var is_os = os_oc.length > 0;

    return {
      numero_nf: numero_nf,
      data_emissao: data_emissao,
      peso_total: pesoL,
      volumes_total: qVol,
      is_os: is_os,
      os_oc: os_oc,
      itens: itens
    };

  } catch (err) {
    Logger.log('[LOG] Erro ao parsear XML: ' + err.message);
    return null;
  }
}

// =========================================================
// Helpers
// =========================================================
function findElement_(parent, name, ns) {
  var el = parent.getChild(name, ns);
  if (!el) el = parent.getChild(name);
  if (!el) {
    // Busca recursiva no primeiro nível de filhos
    var children = parent.getChildren();
    for (var i = 0; i < children.length; i++) {
      el = children[i].getChild(name, ns);
      if (el) return el;
      el = children[i].getChild(name);
      if (el) return el;
    }
  }
  return el;
}

function getElementText_(parent, name, ns) {
  var el = parent.getChild(name, ns);
  if (!el) el = parent.getChild(name);
  return el ? el.getText() : '';
}

function jsonResponse_(statusCode, data) {
  // Apps Script Web Apps sempre retornam 200, mas incluímos status no body
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function htmlPostMessage_(data, origin) {
  // Retorna HTML que envia os dados via postMessage para o parent (iframe)
  // setXFrameOptionsMode(ALLOWALL) permite carregar em iframe cross-origin
  var jsonStr = JSON.stringify(data);
  var safeOrigin = origin.replace(/"/g, '&quot;');
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
    '<p>Processando...</p>' +
    '<script>' +
    'try {' +
    '  var data = ' + jsonStr + ';' +
    '  window.parent.postMessage({ source: "appscript-nfe", data: data }, "' + safeOrigin + '");' +
    '} catch(e) {' +
    '  window.parent.postMessage({ source: "appscript-nfe", data: { ok: false, error: e.message } }, "' + safeOrigin + '");' +
    '}' +
    '</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =========================================================
// Test helper (run from editor)
// =========================================================
function testDoPost() {
  var token = PropertiesService.getScriptProperties().getProperty('LEBEBE_IMPORT_TOKEN');
  var e = {
    parameter: {},
    postData: {
      contents: JSON.stringify({
        token: token,
        inicio: '2026-02-23',
        fim: '2026-02-26'
      })
    }
  };
  var result = doPost(e);
  Logger.log(result.getContent());
}
