/**************************************************************
 * SALVAR PEDIDO
 **************************************************************/
function salvarPedido() {
  try {
    Logger.log('[salvarPedido] Iniciando salvamento...');

    // Sessão 1 – Planilhas e dados básicos
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var resumoPedido = ss.getSheetByName('Resumo pedido');
    var encomendas = ss.getSheetByName('Encomendas');

    if (!resumoPedido || !encomendas) {
      throw new Error(
        'A aba "Resumo pedido" ou "Encomendas" não foi encontrada.'
      );
    }

    // Pega os dados da aba Resumo pedido
    var ultimaLinhaResumo = resumoPedido.getLastRow();

    if (ultimaLinhaResumo < 2) {
      Logger.log('[salvarPedido] Não há dados para copiar.');
      return;
    }

    var intervalo = resumoPedido.getRange(
      'A2:J' + ultimaLinhaResumo
    );

    var dados = intervalo
      .getValues()
      .filter(function(linha) {
        return linha.some(function(celula) {
          return celula !== '';
        });
      });

    if (dados.length === 0) {
      Logger.log('[salvarPedido] Nenhuma linha preenchida encontrada.');
      return;
    }

    // Valores extras
    // E1 = lançamento
    // G1 = filial
    // K2 = consultora
    var valorLancamento = resumoPedido
      .getRange('E1')
      .getValue();

    var valorFilial = resumoPedido
      .getRange('G1')
      .getValue();

    var valorConsultora = resumoPedido
      .getRange('K2')
      .getValue();

    Logger.log(
      '[salvarPedido] Lançamento: ' +
      valorLancamento
    );

    Logger.log(
      '[salvarPedido] Filial: ' +
      valorFilial
    );

    Logger.log(
      '[salvarPedido] Consultora: ' +
      valorConsultora
    );


    // Sessão 2 – Calcular linha inicial na aba Encomendas
    var ultimaLinhaEncomendas = encomendas.getLastRow();

    var primeiroBloco =
      ultimaLinhaEncomendas === 0;

    var linhaInicial =
      primeiroBloco
        ? 1
        : ultimaLinhaEncomendas + 2;

    /*
     * Se for o primeiro bloco, copia também o cabeçalho.
     * Nos próximos blocos, pula a primeira linha do resumo,
     * pois ela corresponde ao cabeçalho.
     */
    var linhasParaCopiar =
      primeiroBloco
        ? dados
        : dados.slice(1);

    if (linhasParaCopiar.length === 0) {
      Logger.log(
        '[salvarPedido] Nenhuma linha restante para copiar.'
      );

      return;
    }


    // Sessão 3 – Copiar os dados principais
    encomendas
      .getRange(
        linhaInicial,
        1,
        linhasParaCopiar.length,
        10
      )
      .setValues(linhasParaCopiar);


    // Sessão 4 – Montar colunas extras
    // I = LANÇAMENTO
    // J = FILIAL
    // K = CONSULTORA
    var extras = [];

    for (
      var i = 0;
      i < linhasParaCopiar.length;
      i++
    ) {
      if (primeiroBloco && i === 0) {
        extras.push([
          'LANÇAMENTO',
          'FILIAL',
          'CONSULTORA'
        ]);
      } else {
        extras.push([
          valorLancamento,
          valorFilial,
          valorConsultora
        ]);
      }
    }

    encomendas
      .getRange(
        linhaInicial,
        9,
        extras.length,
        3
      )
      .setValues(extras);


    // Sessão 5 – Coluna L com data/hora
    var agora = new Date();
    var datasHora = [];

    for (
      var j = 0;
      j < linhasParaCopiar.length;
      j++
    ) {
      if (primeiroBloco && j === 0) {
        datasHora.push(['DATA/HORA']);
      } else {
        datasHora.push([agora]);
      }
    }

    encomendas
      .getRange(
        linhaInicial,
        12,
        datasHora.length,
        1
      )
      .setValues(datasHora);


    Logger.log(
      '[salvarPedido] Salvamento concluído. Linhas adicionadas: ' +
      linhasParaCopiar.length
    );

  } catch (erro) {
    Logger.log(
      '[salvarPedido] Erro: ' +
      erro
    );

    SpreadsheetApp
      .getUi()
      .alert(
        'Erro ao salvar o pedido: ' +
        erro.message
      );
  }
}