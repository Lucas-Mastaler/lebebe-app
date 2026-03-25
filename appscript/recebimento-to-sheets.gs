/**
 * Google Apps Script para receber dados de finalização de recebimento
 * 
 * INSTRUÇÕES DE CONFIGURAÇÃO:
 * 1. Abra sua planilha do Google Sheets
 * 2. Vá em Extensões > Apps Script
 * 3. Cole este código
 * 4. Clique em "Implantar" > "Nova implantação"
 * 5. Tipo: "Aplicativo da Web"
 * 6. Executar como: "Eu"
 * 7. Quem tem acesso: "Qualquer pessoa"
 * 8. Copie a URL gerada
 * 9. Adicione no .env.local: GOOGLE_SHEET_RECEBIMENTO_URL=<URL_COPIADA>
 */

// Nome da aba onde os dados serão salvos
const SHEET_NAME = 'Recebimentos';

/**
 * Função que processa requisições POST do webhook
 */
function doPost(e) {
  try {
    // Parse JSON do body
    const data = JSON.parse(e.postData.contents);
    
    // Abre a planilha ativa
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Se a aba não existir, cria com cabeçalhos
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Carimbo de data/hora',
        'QUEM ESTÁ PREENCHENDO?',
        'HORÁRIO INICIO DO RECEBIMENTO',
        'HORÁRIO FIM DO RECEBIMENTO',
        'TEMPO TOTAL (segundos)',
        'TEMPO TOTAL (formatado)',
        'QUANTIDADE DE CHAPAS',
        'MOTORISTA AJUDOU?',
        'QUANTOS KILOS?',
        'QUANTOS VOLUMES?',
        'NÚMERO DAS NF RECEBIDAS',
        'MOTORISTA',
        'ALGUM PROBLEMA QUE DEVE SER RESOLVIDO NOS PRÓXIMOS CARREGAMENTOS?',
        'OUTROS TIPOS DE PROBLEMAS'
      ]);
      
      // Formata cabeçalho
      const headerRange = sheet.getRange(1, 1, 1, 14);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }
    
    // Formata tempo total (segundos para HH:MM:SS)
    const formatarTempo = (segundos) => {
      const horas = Math.floor(segundos / 3600);
      const minutos = Math.floor((segundos % 3600) / 60);
      const secs = segundos % 60;
      return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    // Adiciona nova linha com os dados
    sheet.appendRow([
      data.carimbo || new Date().toLocaleString('pt-BR'),
      data.quem_preencheu || '',
      data.horario_inicio || '',
      data.horario_fim || '',
      data.tempo_total_segundos || 0,
      formatarTempo(data.tempo_total_segundos || 0),
      data.quantidade_chapas || 0,
      data.motorista_ajudou || '',
      data.quantos_kilos || 0,
      data.quantos_volumes || 0,
      data.numero_nfs || '',
      data.motorista || '',
      data.problema_proximos_carregamentos || '',
      data.outros_problemas || ''
    ]);
    
    // Auto-ajusta largura das colunas
    sheet.autoResizeColumns(1, 14);
    
    // Retorna sucesso
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Dados salvos com sucesso'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Log de erro
    Logger.log('Erro ao processar webhook: ' + error.toString());
    
    // Retorna erro
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Função de teste (opcional - para testar manualmente)
 */
function testar() {
  const dadosTeste = {
    postData: {
      contents: JSON.stringify({
        carimbo: '14/07/2025 11:21:34',
        quem_preencheu: 'LUCAS',
        horario_inicio: '14:00:00',
        horario_fim: '15:21:00',
        tempo_total_segundos: 4860,
        quantidade_chapas: 0,
        motorista_ajudou: 'Sim',
        quantos_kilos: 1500,
        quantos_volumes: 120,
        numero_nfs: '263815, 263814, 263798',
        motorista: 'João Silva',
        problema_proximos_carregamentos: '',
        outros_problemas: ''
      })
    }
  };
  
  const resultado = doPost(dadosTeste);
  Logger.log(resultado.getContent());
}
