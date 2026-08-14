"""Fluxo SGI reutilizável e retomável para pedidos Lebebe Exclusive.

Reusa os três módulos HTTP já validados no erp-capturador. Cada etapa grava
estado local atomicamente antes de notificar o App, reduzindo a janela entre a
mutação externa e o checkpoint central.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable

from bs4 import BeautifulSoup


BASE_MODULO = Path(os.environ.get('ERP_CAPTURADOR_BASE', '/workspace/erp-capturador'))
PASTA_SCRIPTS = BASE_MODULO / 'scripts'
PASTA_ESTADOS = BASE_MODULO / 'dados' / 'produto_sgi_lebebe_exclusive'
CAMINHO_ORQUESTRADOR_LEGADO = PASTA_SCRIPTS / 'cadastrar_produto_sgi.py'

ETAPAS = (
    'NAO_INICIADO',
    'PRODUTO_DUPLICADO',
    'PRODUTO_RENOMEADO',
    'CUSTO_CRIADO',
    'CUSTO_FINALIZADO',
    'PRECO_ATUALIZADO',
    'CONCLUIDO',
)

Checkpoint = Callable[[dict[str, Any], str, dict[str, Any]], None]
Logger = Callable[[str, str, dict[str, Any]], None]


@dataclass(frozen=True)
class ConfiguracaoProdutoSgi:
    pedido_id: str
    modelo_produto_id_sgi: str
    modelo_nome_esperado: str
    nome_produto: str
    custo: Decimal
    preco: Decimal


def _carregar_modulo(nome: str, caminho: Path):
    spec = importlib.util.spec_from_file_location(nome, caminho)
    if not spec or not spec.loader:
        raise RuntimeError(f'Modulo SGI nao encontrado: {caminho}')
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _decimal_sgi(valor: Decimal) -> str:
    texto = f'{valor.quantize(Decimal("0.01")):,.2f}'
    return texto.replace(',', '#').replace('.', ',').replace('#', '.')


def _estado_inicial(config: ConfiguracaoProdutoSgi) -> dict[str, Any]:
    return {
        'pedido_id': config.pedido_id,
        'nome_produto': config.nome_produto,
        'custo': str(config.custo.quantize(Decimal('0.01'))),
        'preco': str(config.preco.quantize(Decimal('0.01'))),
        'etapa': 'NAO_INICIADO',
        'produto_id_sgi': None,
        'codigo_sgi': None,
        'procedimento_custo_sgi': None,
        'numero_lancamento_entrada_sgi': None,
        'documento_entrada_id_sgi': None,
        'procedimento_finalizacao_sgi': None,
        'tabela_preco_id_sgi': '3',
        'item_tabela_preco_id_sgi': None,
    }


def _caminho_estado(pedido_id: str) -> Path:
    if not re.fullmatch(r'[0-9a-f-]{36}', pedido_id, flags=re.I):
        raise ValueError('pedido_id invalido')
    return PASTA_ESTADOS / f'{pedido_id}.json'


def carregar_estado(config: ConfiguracaoProdutoSgi, remoto: dict[str, Any]) -> dict[str, Any]:
    esperado = _estado_inicial(config)
    caminho = _caminho_estado(config.pedido_id)
    local: dict[str, Any] = {}
    if caminho.exists():
        local = json.loads(caminho.read_text(encoding='utf-8'))

    for campo in ('pedido_id', 'nome_produto', 'custo', 'preco'):
        if campo in local and str(local[campo]) != str(esperado[campo]):
            raise RuntimeError(f'ESTADO_LOCAL_DIVERGENTE:{campo}')

    estado = {**esperado, **local}
    etapa_remota = remoto.get('etapa', 'NAO_INICIADO')
    if etapa_remota not in ETAPAS:
        raise RuntimeError('ETAPA_REMOTA_INVALIDA')
    for campo in (
        'produto_id_sgi', 'codigo_sgi', 'procedimento_custo_sgi',
        'numero_lancamento_entrada_sgi', 'documento_entrada_id_sgi',
        'procedimento_finalizacao_sgi', 'tabela_preco_id_sgi',
        'item_tabela_preco_id_sgi',
    ):
        if not estado.get(campo) and remoto.get(campo):
            estado[campo] = str(remoto[campo])
    if ETAPAS.index(etapa_remota) > ETAPAS.index(estado['etapa']):
        estado['etapa'] = etapa_remota
    return estado


def salvar_estado(estado: dict[str, Any]) -> None:
    PASTA_ESTADOS.mkdir(parents=True, exist_ok=True)
    caminho = _caminho_estado(str(estado['pedido_id']))
    temporario = caminho.with_suffix('.json.tmp')
    temporario.write_text(
        json.dumps(estado, ensure_ascii=False, sort_keys=True, indent=2) + '\n',
        encoding='utf-8',
    )
    os.chmod(temporario, 0o600)
    os.replace(temporario, caminho)


def _emitir(
    estado: dict[str, Any],
    etapa: str,
    detalhes: dict[str, Any],
    checkpoint: Checkpoint,
) -> None:
    if ETAPAS.index(etapa) < ETAPAS.index(estado['etapa']):
        raise RuntimeError('REGRESSAO_DE_ETAPA_LOCAL')
    estado['etapa'] = etapa
    salvar_estado(estado)
    checkpoint(dict(estado), etapa, detalhes)


def _configurar_modulos(config: ConfiguracaoProdutoSgi, logger: Logger):
    base = _carregar_modulo('cadastro_produto_sgi_base', CAMINHO_ORQUESTRADOR_LEGADO)
    base.log = lambda mensagem: logger('INFO', 'SGI_BASE', {'mensagem': mensagem})
    produto, custo, preco = base.carregar_fluxos_validados()
    produto.log = base.log
    custo.log = base.log
    preco.log = base.log

    base.PRODUTO_MODELO_ID = config.modelo_produto_id_sgi
    base.NOVO_NOME = config.nome_produto
    base.CUSTO = _decimal_sgi(config.custo)
    base.PRECO_VENDA = _decimal_sgi(config.preco)
    produto.PRODUTO_BASE_ID = config.modelo_produto_id_sgi
    produto.NOVO_NOME = config.nome_produto
    produto.INCLUIR_COPIA_TABELA_PRECO = True
    custo.PRODUTO_MODELO_ID = config.modelo_produto_id_sgi
    custo.NOVO_NOME = config.nome_produto
    custo.CUSTO = _decimal_sgi(config.custo)
    custo.CUSTO_5_CASAS = f'{config.custo.quantize(Decimal("0.00001"))}'
    preco.TABELA_PRECO_ID = '3'
    preco.NOVO_PRECO_SGI = _decimal_sgi(config.preco)
    return base, produto, custo, preco


def _ids_produtos_por_nome(sessao, produto, nome_exato: str) -> set[str]:
    ids: set[str] = set()
    pagina = 1
    total_paginas = 1
    while pagina <= total_paginas:
        resposta = sessao.get(
            f'{produto.URL_BASE_SGI}/produtos',
            params={'filtros[descricao_ilike]': nome_exato, 'page': pagina},
            timeout=60,
            allow_redirects=True,
        )
        if resposta.status_code != 200 or 'id="usuario"' in resposta.text:
            raise RuntimeError(f'BUSCA_PRODUTO_FALHOU:HTTP_{resposta.status_code}')
        soup = BeautifulSoup(resposta.text, 'html.parser')
        candidatos = {
            match.group(1)
            for link in soup.find_all('a', href=True)
            if (match := re.fullmatch(r'/produtos/(\d+)/edit', link.get('href', '')))
        }
        for produto_id in candidatos:
            html_produto = produto.abrir_produto(sessao, produto_id)
            if produto.extrair_nome_produto(html_produto) == nome_exato:
                ids.add(produto_id)
        paginas = [
            int(match.group(1))
            for link in soup.find_all('a', href=True)
            if (match := re.search(r'[?&]page=(\d+)', link.get('href', '')))
        ]
        total_paginas = max(paginas, default=1)
        pagina += 1
    return ids


def _validar_modelo(sessao, produto, config: ConfiguracaoProdutoSgi) -> None:
    html_modelo = produto.abrir_produto(sessao, config.modelo_produto_id_sgi)
    nome_modelo = produto.extrair_nome_produto(html_modelo)
    if nome_modelo != config.modelo_nome_esperado:
        raise RuntimeError('MODELO_SGI_DIVERGENTE')


def _obter_ou_criar_produto(
    sessao,
    produto,
    preco,
    config: ConfiguracaoProdutoSgi,
    estado: dict[str, Any],
    checkpoint: Checkpoint,
) -> tuple[str, str]:
    produto_id = estado.get('produto_id_sgi')
    if not produto_id:
        existentes = _ids_produtos_por_nome(sessao, produto, config.nome_produto)
        if len(existentes) > 1:
            raise RuntimeError('PRODUTO_DESTINO_DUPLICADO_NO_SGI')
        if existentes:
            produto_id = next(iter(existentes))
        else:
            modelos_antes = _ids_produtos_por_nome(sessao, produto, config.modelo_nome_esperado)
            html_modelo = produto.abrir_produto(sessao, config.modelo_produto_id_sgi)
            csrf_token = produto.extrair_csrf_token(html_modelo)
            try:
                produto_id = produto.duplicar_produto(sessao, csrf_token)
            except Exception:
                modelos_depois = _ids_produtos_por_nome(sessao, produto, config.modelo_nome_esperado)
                novos = modelos_depois - modelos_antes
                if len(novos) != 1:
                    raise RuntimeError('DUPLICACAO_INDETERMINADA')
                produto_id = next(iter(novos))

        estado['produto_id_sgi'] = str(produto_id)
        html_produto = produto.abrir_produto(sessao, str(produto_id))
        estado['codigo_sgi'] = preco.extrair_codigo_produto(html_produto)
        _emitir(estado, 'PRODUTO_DUPLICADO', {'recuperado': bool(existentes)}, checkpoint)

    html_produto = produto.abrir_produto(sessao, str(produto_id))
    nome_atual = produto.extrair_nome_produto(html_produto)
    if nome_atual != config.nome_produto:
        if nome_atual != config.modelo_nome_esperado:
            raise RuntimeError('NOME_PRODUTO_INTERMEDIARIO_DIVERGENTE')
        token = produto.extrair_authenticity_token(html_produto)
        produto.renomear_produto(sessao, str(produto_id), token)
        nome_atual = produto.validar_produto_criado(sessao, str(produto_id))
        if nome_atual != config.nome_produto:
            raise RuntimeError('NOME_PRODUTO_FINAL_DIVERGENTE')

    html_produto = produto.abrir_produto(sessao, str(produto_id))
    codigo = preco.extrair_codigo_produto(html_produto)
    estado['codigo_sgi'] = codigo
    if ETAPAS.index(estado['etapa']) < ETAPAS.index('PRODUTO_RENOMEADO'):
        _emitir(estado, 'PRODUTO_RENOMEADO', {}, checkpoint)
    return str(produto_id), str(codigo)


def _cadastrar_custo(
    sessao,
    base,
    custo,
    produto_id: str,
    estado: dict[str, Any],
    checkpoint: Checkpoint,
) -> None:
    if ETAPAS.index(estado['etapa']) < ETAPAS.index('CUSTO_CRIADO'):
        token_entrada = custo.abrir_tela_entrada(sessao)
        custo.preparar_item_entrada(sessao, produto_id)
        procedimento = custo.cadastrar_custo(sessao, produto_id, token_entrada)
        numero_lancamento = custo.aguardar_processamento(sessao, procedimento)
        html_lancamento = base.carregar_html_lancamento(sessao, custo, numero_lancamento)
        documento_id = base.extrair_documento_entrada_id(html_lancamento)
        estado.update({
            'procedimento_custo_sgi': str(procedimento),
            'numero_lancamento_entrada_sgi': str(numero_lancamento),
            'documento_entrada_id_sgi': str(documento_id),
        })
        _emitir(estado, 'CUSTO_CRIADO', {}, checkpoint)

    numero_lancamento = str(estado['numero_lancamento_entrada_sgi'])
    documento_id = str(estado['documento_entrada_id_sgi'])
    html_lancamento = base.carregar_html_lancamento(sessao, custo, numero_lancamento)
    status = base.extrair_status_documento(html_lancamento)
    if status != 'finalizado':
        campos = custo.montar_payload_finalizacao(html_lancamento, produto_id, documento_id)
        procedimento = custo.finalizar_lancamento(
            sessao, numero_lancamento, documento_id, produto_id, campos,
        )
        estado['procedimento_finalizacao_sgi'] = str(procedimento)
        custo.aguardar_finalizacao(sessao, procedimento, numero_lancamento, documento_id)
        html_lancamento = base.carregar_html_lancamento(sessao, custo, numero_lancamento)
        status = base.extrair_status_documento(html_lancamento)
    if status != 'finalizado':
        raise RuntimeError('CUSTO_NAO_FINALIZADO')
    if f'/entrada/{documento_id}/impressoes' not in html_lancamento:
        raise RuntimeError('COMPROVANTE_ENTRADA_AUSENTE')
    if ETAPAS.index(estado['etapa']) < ETAPAS.index('CUSTO_FINALIZADO'):
        _emitir(estado, 'CUSTO_FINALIZADO', {'statusDocumento': status}, checkpoint)


def _atualizar_preco(
    sessao,
    preco,
    produto_id: str,
    codigo: str,
    config: ConfiguracaoProdutoSgi,
    estado: dict[str, Any],
    checkpoint: Checkpoint,
) -> None:
    preco.PRODUTO_ID = produto_id
    tabela = preco.abrir_tabela_preco(sessao)
    html_filtrado = preco.filtrar_produto_tabela(sessao, codigo, tabela['authenticity_token'])
    item = preco.localizar_item_tabela(html_filtrado, codigo)
    if str(item['produto_id']) != produto_id:
        raise RuntimeError('ITEM_PRECO_DE_OUTRO_PRODUTO')
    item_id = str(item['item_tabela_preco_id'])
    atual = Decimal(str(item['preco']))
    if atual != config.preco:
        preco.alterar_preco_minimo(sessao, tabela['csrf_token'], item_id)
    validado = preco.validar_novo_preco(sessao, codigo)
    if str(validado['produto_id']) != produto_id or Decimal(str(validado['preco'])) != config.preco:
        raise RuntimeError('PRECO_FINAL_DIVERGENTE')
    estado['item_tabela_preco_id_sgi'] = str(validado['item_tabela_preco_id'])
    if ETAPAS.index(estado['etapa']) < ETAPAS.index('PRECO_ATUALIZADO'):
        _emitir(estado, 'PRECO_ATUALIZADO', {}, checkpoint)


def executar_fluxo(
    config: ConfiguracaoProdutoSgi,
    remoto: dict[str, Any],
    checkpoint: Checkpoint,
    logger: Logger,
) -> dict[str, Any]:
    estado = carregar_estado(config, remoto)
    salvar_estado(estado)
    base, produto, custo, preco = _configurar_modulos(config, logger)
    custo.validar_credencial()
    sessao = custo.carregar_sessao_sgi()
    custo.validar_sessao_http(sessao)
    _validar_modelo(sessao, produto, config)

    produto_id, codigo = _obter_ou_criar_produto(
        sessao, produto, preco, config, estado, checkpoint,
    )
    _cadastrar_custo(sessao, base, custo, produto_id, estado, checkpoint)
    _atualizar_preco(sessao, preco, produto_id, codigo, config, estado, checkpoint)

    html_final = produto.abrir_produto(sessao, produto_id)
    if produto.extrair_nome_produto(html_final) != config.nome_produto:
        raise RuntimeError('VALIDACAO_FINAL_NOME_DIVERGENTE')
    if preco.extrair_codigo_produto(html_final) != codigo:
        raise RuntimeError('VALIDACAO_FINAL_CODIGO_DIVERGENTE')
    _emitir(estado, 'CONCLUIDO', {'validacaoFinal': True}, checkpoint)
    return estado
