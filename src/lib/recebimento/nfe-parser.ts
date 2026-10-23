import { parseStringPromise } from "xml2js";

interface NFeItem {
  n_item: string;
  codigo_produto: string;
  descricao: string;
  quantidade: string;
  ncm: string;
  cfop: string;
}

export interface NFeData {
  chave_acesso?: string;
  message_id: string;
  numero_nf: string;
  data_emissao: string;
  peso_total: string;
  volumes_total: string;
  obs: string;
  is_os: boolean;
  assistencias: string[];
  itens: NFeItem[];
}

export async function parsearNFe(
  xmlContent: string,
  messageId: string
): Promise<NFeData> {
  const parsed = await parseStringPromise(xmlContent, {
    explicitArray: false,
    ignoreAttrs: false,
    tagNameProcessors: [(name: string) => name.replace(/^.*:/, "")],
  });

  // Navegar até a tag <infNFe> (pode estar em nfeProc > NFe > infNFe ou NFe > infNFe)
  const nfeProc = parsed.nfeProc ?? parsed;
  const nfe = nfeProc.NFe ?? nfeProc;
  const infNFe = nfe.infNFe;

  if (!infNFe) {
    throw new Error("Tag <infNFe> não encontrada no XML.");
  }

  const ide = infNFe.ide ?? {};
  const transp = infNFe.transp ?? {};
  const vol = transp.vol ?? {};
  const infAdic = infNFe.infAdic ?? {};

  // número NF
  const numero_nf = ide.nNF ?? "";

  // data emissão
  const data_emissao = ide.dhEmi ?? ide.dEmi ?? "";

  // peso total
  const peso_total = vol.pesoB ?? vol.pesoL ?? "0";

  // volumes total
  const volumes_total = vol.qVol ?? "0";

  // observações (infCpl)
  const obs = infAdic.infCpl ?? "";

  // is_os: baseado em natOp (natureza da operação) OU obs (observações/infCpl)
  const natOp = String(ide.natOp ?? "").toUpperCase();
  const obsUpper = String(obs).toUpperCase();
  const is_os = natOp.includes("ASSIST.TECNICA") || obsUpper.includes("ASSIST.TECNICA");

  // itens
  const detRaw = infNFe.det;
  const detArray = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const itens: NFeItem[] = detArray.map(
    (det: Record<string, Record<string, unknown>>) => {
      const prod = (det.prod ?? {}) as Record<string, unknown>;
      return {
        n_item: (det.$ as Record<string, string>)?.nItem ?? "",
        codigo_produto: String(prod.cProd ?? ""),
        descricao: String(prod.xProd ?? ""),
        quantidade: String(prod.qCom ?? prod.qTrib ?? ""),
        ncm: String(prod.NCM ?? ""),
        cfop: String(prod.CFOP ?? ""),
      };
    }
  );

  // Extrair números de OS/OC das observações (com word boundary para evitar "PRODUTOS: 871")
  const assistencias: string[] = [];
  const obsStr = String(obs);

  // Regex com \b (word boundary) para evitar falsos positivos
  const regexOS = /\bO\.?\s*S\.?\s*[:\-]?\s*(\d+)\b/gi;
  const regexOC = /\bO\s*C\s*[:\-]?\s*(\d+)\b/gi;
  // Captura "S/PEDIDO: 4527" — número do pedido do cliente (usado em ASSIST.TECNICA)
  const regexSPedido = /S\s*\/\s*PEDIDO\s*[:\s]+(\d{3,8})\b/gi;

  const encontrados: string[] = [];
  let osMatch;

  while ((osMatch = regexOS.exec(obsStr)) !== null) {
    if (osMatch[1]) encontrados.push(osMatch[1]);
  }

  while ((osMatch = regexOC.exec(obsStr)) !== null) {
    if (osMatch[1]) encontrados.push(osMatch[1]);
  }

  while ((osMatch = regexSPedido.exec(obsStr)) !== null) {
    if (osMatch[1]) encontrados.push(osMatch[1]);
  }

  const regexAssistTecnica = /ASSIST\.TECNICA\s*[;,]\s*(\d{3,8})\b/gi;
  while ((osMatch = regexAssistTecnica.exec(obsStr)) !== null) {
    if (osMatch[1]) encontrados.push(osMatch[1]);
  }

  // Dedupe: remover duplicados
  const vistos = new Set<string>();
  for (const num of encontrados) {
    const soDigitos = num.replace(/\D/g, "");
    if (soDigitos && !vistos.has(soDigitos)) {
      vistos.add(soDigitos);
      assistencias.push(soDigitos);
    }
  }

  return {
    chave_acesso: String(infNFe.$?.Id ?? '').replace(/^NFe/, ''),
    message_id: messageId,
    numero_nf: String(numero_nf),
    data_emissao: String(data_emissao),
    peso_total: String(peso_total),
    volumes_total: String(volumes_total),
    obs: String(obs),
    is_os,
    assistencias,
    itens,
  };
}
