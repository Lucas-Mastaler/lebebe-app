/**************************************************************
 * 01. CONFIGURAÇÕES GERAIS
 **************************************************************/
const CONFIG_PEDIDO = {
  ABA_DADOS: 'DADOS',
  ABA_ENCOMENDAS: 'Encomendas',
  LINHA_INICIAL_DADOS: 2,
  FILIAIS: ['MARECHAL', 'PORTAO', 'BIGORRILHO', 'FEIRA']
};


/**************************************************************
 * 02. MENU AO ABRIR A PLANILHA
 **************************************************************/
function onOpen() {
  try {
    Logger.log('[onOpen] Criando menu Pedidos...');

    SpreadsheetApp.getUi()
      .createMenu('Pedidos')
      .addItem('Novo pedido', 'abrirModalNovoPedido')
      .addToUi();

    Logger.log('[onOpen] Menu criado com sucesso.');
  } catch (erro) {
    Logger.log('[onOpen] Erro ao criar menu: ' + erro);
  }
}


/**************************************************************
 * 03. ABRIR MODAL
 **************************************************************/
function abrirModalNovoPedido() {
  try {
    Logger.log('[abrirModalNovoPedido] Abrindo modal de novo pedido...');

    var html = HtmlService
      .createHtmlOutputFromFile('ModalNovoPedido')
      .setWidth(1220)
      .setHeight(640);

    SpreadsheetApp.getUi().showModalDialog(
      html,
      'Novo pedido'
    );

    Logger.log('[abrirModalNovoPedido] Modal aberto com sucesso.');
  } catch (erro) {
    Logger.log('[abrirModalNovoPedido] Erro: ' + erro);

    SpreadsheetApp.getUi().alert(
      'Erro ao abrir o modal: ' + erro.message
    );
  }
}


/**************************************************************
 * 04. BUSCAR CATÁLOGO NA ABA DADOS
 *
 * Estrutura esperada:
 * A = COLEÇÃO
 * B = DESCRIÇÃO
 * C = CUSTO
 * D = REFERÊNCIA
 * E = PREÇO UNIT.
 **************************************************************/
function buscarCatalogoDADOS() {
  try {
    Logger.log('[buscarCatalogoDADOS] Iniciando leitura da aba DADOS...');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var abaDados = ss.getSheetByName(CONFIG_PEDIDO.ABA_DADOS);

    if (!abaDados) {
      throw new Error('A aba "DADOS" não foi encontrada.');
    }

    var ultimaLinha = abaDados.getLastRow();

    Logger.log(
      '[buscarCatalogoDADOS] Última linha encontrada: ' +
      ultimaLinha
    );

    if (ultimaLinha < CONFIG_PEDIDO.LINHA_INICIAL_DADOS) {
      Logger.log('[buscarCatalogoDADOS] Não há itens na aba DADOS.');

      return {
        sucesso: true,
        itens: [],
        filiais: CONFIG_PEDIDO.FILIAIS
      };
    }

    var quantidadeLinhas =
      ultimaLinha -
      CONFIG_PEDIDO.LINHA_INICIAL_DADOS +
      1;

    /*
     * Faz somente uma leitura da planilha.
     * Isso é importante para a performance.
     */
    var dados = abaDados
      .getRange(
        CONFIG_PEDIDO.LINHA_INICIAL_DADOS,
        1,
        quantidadeLinhas,
        5
      )
      .getValues();

    var itens = [];

    for (var i = 0; i < dados.length; i++) {
      var linhaPlanilha =
        CONFIG_PEDIDO.LINHA_INICIAL_DADOS + i;

      var linha = dados[i];

      var colecao = linha[0];
      var descricao = linha[1];
      var custo = linha[2];
      var referencia = linha[3];
      var precoUnit = linha[4];

      /*
       * Ignora linhas totalmente vazias.
       */
      if (
        !colecao &&
        !descricao &&
        !custo &&
        !referencia &&
        !precoUnit
      ) {
        continue;
      }

      itens.push({
        linhaPlanilha: linhaPlanilha,
        colecao: colecao || '',
        descricao: descricao || '',
        custo: custo || '',
        referencia: referencia || '',
        precoUnit: precoUnit || '',
        quantidade: '',
        letraNome: ''
      });
    }

    Logger.log(
      '[buscarCatalogoDADOS] Total de itens carregados: ' +
      itens.length
    );

    return {
      sucesso: true,
      itens: itens,
      filiais: CONFIG_PEDIDO.FILIAIS
    };

  } catch (erro) {
    Logger.log('[buscarCatalogoDADOS] Erro: ' + erro);

    return {
      sucesso: false,
      mensagem: erro.message
    };
  }
}


/**************************************************************
 * 05. SALVAR NOVO PEDIDO
 **************************************************************/
function salvarNovoPedido(payload) {
  var lock = LockService.getDocumentLock();

  try {
    Logger.log('[salvarNovoPedido] Aguardando bloqueio do documento...');

    lock.waitLock(30000);

    Logger.log('[salvarNovoPedido] Iniciando salvamento...');

    if (!payload) {
      throw new Error('Nenhum dado foi enviado pelo modal.');
    }

    var numeroLancamento = String(
      payload.numeroLancamento || ''
    ).trim();

    var filial = String(
      payload.filial || ''
    ).trim();

    var consultora = String(
      payload.consultora || ''
    ).trim();

    var itens = payload.itens || [];

    Logger.log(
      '[salvarNovoPedido] Número de lançamento: ' +
      numeroLancamento
    );

    Logger.log(
      '[salvarNovoPedido] Filial: ' +
      filial
    );

    Logger.log(
      '[salvarNovoPedido] Consultora: ' +
      consultora
    );

    Logger.log(
      '[salvarNovoPedido] Itens recebidos: ' +
      itens.length
    );

    validarDadosPedido_(
      numeroLancamento,
      filial,
      consultora,
      itens
    );

    /*
     * Por segurança, o servidor filtra novamente os itens.
     * O modal já envia somente os selecionados.
     */
    var itensSelecionados = itens.filter(function(item) {
      var quantidade = String(
        item.quantidade || ''
      ).trim();

      return quantidade !== '';
    });

    if (itensSelecionados.length === 0) {
      throw new Error(
        'Preencha ao menos um item com quantidade.'
      );
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var abaEncomendas = ss.getSheetByName(
      CONFIG_PEDIDO.ABA_ENCOMENDAS
    );

    if (!abaEncomendas) {
      throw new Error(
        'A aba "Encomendas" não foi encontrada.'
      );
    }

    var ultimaLinha = abaEncomendas.getLastRow();
    var primeiraGravacao = ultimaLinha === 0;

    /*
     * Mantém uma linha vazia entre pedidos.
     */
    var linhaInicialDestino = primeiraGravacao
      ? 1
      : ultimaLinha + 2;

    Logger.log(
      '[salvarNovoPedido] Última linha em Encomendas: ' +
      ultimaLinha
    );

    Logger.log(
      '[salvarNovoPedido] Primeira gravação? ' +
      primeiraGravacao
    );

    Logger.log(
      '[salvarNovoPedido] Linha inicial de destino: ' +
      linhaInicialDestino
    );

    var agora = new Date();
    var linhasParaSalvar = [];

    /*
     * A coluna CONSULTORA foi adicionada em L.
     *
     * As colunas existentes continuam nas mesmas posições:
     * I = LANÇAMENTO
     * J = FILIAL
     * K = DATA/HORA
     * L = CONSULTORA
     */
    if (primeiraGravacao) {
      linhasParaSalvar.push([
        'COLEÇÃO',
        'DESCRIÇÃO',
        'CUSTO',
        'REFERÊNCIA',
        'PREÇO UNIT.',
        'QUANTIDADE',
        'LETRA OU NOME',
        'VALOR TOTAL',
        'LANÇAMENTO',
        'FILIAL',
        'DATA/HORA',
        'CONSULTORA'
      ]);
    } else {
      garantirCabecalhoConsultora_(abaEncomendas);
    }

    for (var i = 0; i < itensSelecionados.length; i++) {
      var item = itensSelecionados[i];

      var quantidade = String(
        item.quantidade || ''
      ).trim();

      var letraNome = String(
        item.letraNome || ''
      ).trim();

      linhasParaSalvar.push([
        item.colecao || '',
        item.descricao || '',
        item.custo || '',
        item.referencia || '',
        item.precoUnit || '',
        quantidade,
        letraNome,
        calcularValorTotalItem_(
          item.precoUnit,
          quantidade
        ),
        numeroLancamento,
        filial,
        agora,
        consultora
      ]);
    }

    abaEncomendas
      .getRange(
        linhaInicialDestino,
        1,
        linhasParaSalvar.length,
        12
      )
      .setValues(linhasParaSalvar);

    Logger.log(
      '[salvarNovoPedido] Pedido salvo com sucesso. Itens gravados: ' +
      itensSelecionados.length
    );

    return {
      sucesso: true,
      mensagem: 'Pedido salvo com sucesso.'
    };

  } catch (erro) {
    Logger.log('[salvarNovoPedido] Erro: ' + erro);

    return {
      sucesso: false,
      mensagem: erro.message
    };

  } finally {
    try {
      lock.releaseLock();

      Logger.log(
        '[salvarNovoPedido] Bloqueio do documento liberado.'
      );
    } catch (erroLock) {
      Logger.log(
        '[salvarNovoPedido] Não foi necessário liberar o bloqueio: ' +
        erroLock
      );
    }
  }
}


/**************************************************************
 * 06. VALIDAR DADOS DO PEDIDO
 **************************************************************/
function validarDadosPedido_(
  numeroLancamento,
  filial,
  consultora,
  itens
) {
  if (!numeroLancamento) {
    throw new Error(
      'Informe o Número de lançamento.'
    );
  }

  if (!/^\d+$/.test(numeroLancamento)) {
    throw new Error(
      'O Número de lançamento deve conter somente números.'
    );
  }

  if (!filial) {
    throw new Error(
      'Informe a Filial de venda.'
    );
  }

  if (
    CONFIG_PEDIDO.FILIAIS.indexOf(filial) === -1
  ) {
    throw new Error(
      'A filial informada é inválida.'
    );
  }

  if (!consultora) {
    throw new Error(
      'Informe a Consultora.'
    );
  }

  if (
    consultora.length < 4 ||
    consultora.length > 15
  ) {
    throw new Error(
      'A Consultora deve ter entre 4 e 15 caracteres.'
    );
  }

  if (!/^[A-Za-zÀ-ÿ\s]+$/.test(consultora)) {
    throw new Error(
      'A Consultora deve conter somente letras.'
    );
  }

  if (
    !Array.isArray(itens) ||
    itens.length === 0
  ) {
    throw new Error(
      'Nenhum item foi enviado.'
    );
  }
}


/**************************************************************
 * 07. GARANTIR CABEÇALHO DA CONSULTORA
 **************************************************************/
function garantirCabecalhoConsultora_(abaEncomendas) {
  try {
    var cabecalhoConsultora = String(
      abaEncomendas.getRange(1, 12).getValue() || ''
    ).trim();

    if (!cabecalhoConsultora) {
      abaEncomendas
        .getRange(1, 12)
        .setValue('CONSULTORA');

      Logger.log(
        '[garantirCabecalhoConsultora_] Cabeçalho CONSULTORA criado na coluna L.'
      );
    }
  } catch (erro) {
    Logger.log(
      '[garantirCabecalhoConsultora_] Erro: ' +
      erro
    );

    throw erro;
  }
}


/**************************************************************
 * 08. CALCULAR VALOR TOTAL POR ITEM
 **************************************************************/
function calcularValorTotalItem_(
  precoUnitario,
  quantidade
) {
  var preco = converterNumero_(precoUnitario);
  var qtd = converterNumero_(quantidade);

  if (!preco || !qtd) {
    return '';
  }

  return preco * qtd;
}


/**************************************************************
 * 09. CONVERTER TEXTO/MOEDA EM NÚMERO
 **************************************************************/
function converterNumero_(valor) {
  if (typeof valor === 'number') {
    return valor;
  }

  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 0;
  }

  var texto = String(valor)
    .replace(/\s/g, '')
    .replace('R$', '')
    .trim();

  /*
   * Trata valores no padrão brasileiro:
   * 1.234,56
   */
  if (
    texto.indexOf(',') !== -1
  ) {
    texto = texto
      .replace(/\./g, '')
      .replace(',', '.');
  }

  var numero = Number(texto);

  return isNaN(numero)
    ? 0
    : numero;
}