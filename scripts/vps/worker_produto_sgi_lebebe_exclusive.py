"""Worker outbound da integração Pedidos Personalizados -> SGI."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import Any

import requests

from produto_sgi_lebebe_exclusive import (
    ConfiguracaoProdutoSgi,
    executar_fluxo,
)


def log(nivel: str, evento: str, detalhes: dict[str, Any]) -> None:
    print(json.dumps({
        'nivel': nivel,
        'evento': evento,
        **detalhes,
    }, ensure_ascii=False, sort_keys=True), flush=True)


class ClienteApp:
    def __init__(self) -> None:
        base_url = os.environ.get('LEBEBE_APP_BASE_URL', '').rstrip('/')
        token = os.environ.get('LEBEBE_SGI_WORKER_TOKEN', '')
        if not token:
            caminho_secret = Path(os.environ.get(
                'LEBEBE_SGI_WORKER_TOKEN_FILE',
                '/run/secrets/lebebe_sgi_worker_token',
            ))
            if caminho_secret.exists():
                token = caminho_secret.read_text(encoding='utf-8').strip()
        if not base_url.startswith('https://'):
            raise RuntimeError('LEBEBE_APP_BASE_URL_INVALIDA')
        if len(token) < 32:
            raise RuntimeError('LEBEBE_SGI_WORKER_TOKEN_INVALIDO')
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'User-Agent': 'lebebe-sgi-worker/1.0',
        })

    def _post(self, caminho: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        resposta = self.session.post(
            f'{self.base_url}{caminho}',
            json=payload,
            timeout=60,
        )
        if resposta.status_code >= 400:
            raise RuntimeError(f'APP_HTTP_{resposta.status_code}')
        dados = resposta.json()
        if dados.get('ok') is not True:
            raise RuntimeError('RESPOSTA_APP_INVALIDA')
        return dados

    def reivindicar(self) -> dict[str, Any] | None:
        return self._post(
            '/api/interno/pedidos-personalizados/produto-sgi/proximo'
        ).get('trabalho')

    def checkpoint(
        self,
        trabalho: dict[str, Any],
        estado: dict[str, Any],
        etapa: str,
        detalhes: dict[str, Any],
        status: str = 'PROCESSANDO',
        erro_codigo: str | None = None,
        erro_mensagem: str | None = None,
    ) -> None:
        self._post('/api/interno/pedidos-personalizados/produto-sgi/checkpoint', {
            'pedidoId': trabalho['pedidoId'],
            'claimToken': trabalho['claimToken'],
            'status': status,
            'etapa': etapa,
            'produtoIdSgi': estado.get('produto_id_sgi'),
            'codigoSgi': estado.get('codigo_sgi'),
            'procedimentoCustoSgi': estado.get('procedimento_custo_sgi'),
            'numeroLancamentoEntradaSgi': estado.get('numero_lancamento_entrada_sgi'),
            'documentoEntradaIdSgi': estado.get('documento_entrada_id_sgi'),
            'procedimentoFinalizacaoSgi': estado.get('procedimento_finalizacao_sgi'),
            'tabelaPrecoIdSgi': estado.get('tabela_preco_id_sgi'),
            'itemTabelaPrecoIdSgi': estado.get('item_tabela_preco_id_sgi'),
            'erroCodigo': erro_codigo,
            'erroMensagem': erro_mensagem,
            'eventoDetalhes': detalhes,
        })


def _remoto_para_estado(trabalho: dict[str, Any]) -> dict[str, Any]:
    return {
        'etapa': trabalho['etapa'],
        'produto_id_sgi': trabalho.get('produtoIdSgi'),
        'codigo_sgi': trabalho.get('codigoSgi'),
        'procedimento_custo_sgi': trabalho.get('procedimentoCustoSgi'),
        'numero_lancamento_entrada_sgi': trabalho.get('numeroLancamentoEntradaSgi'),
        'documento_entrada_id_sgi': trabalho.get('documentoEntradaIdSgi'),
        'procedimento_finalizacao_sgi': trabalho.get('procedimentoFinalizacaoSgi'),
        'tabela_preco_id_sgi': trabalho.get('tabelaPrecoIdSgi'),
        'item_tabela_preco_id_sgi': trabalho.get('itemTabelaPrecoIdSgi'),
    }


def processar(cliente: ClienteApp, trabalho: dict[str, Any]) -> None:
    config = ConfiguracaoProdutoSgi(
        pedido_id=trabalho['pedidoId'],
        modelo_produto_id_sgi=trabalho['modelo']['produtoIdSgi'],
        modelo_nome_esperado=trabalho['modelo']['nomeEsperado'],
        nome_produto=trabalho['nomeProduto'],
        custo=Decimal(str(trabalho['custo'])),
        preco=Decimal(str(trabalho['preco'])),
    )
    ultimo_estado = _remoto_para_estado(trabalho)

    def checkpoint(estado: dict[str, Any], etapa: str, detalhes: dict[str, Any]) -> None:
        nonlocal ultimo_estado
        ultimo_estado = estado
        cliente.checkpoint(
            trabalho,
            estado,
            etapa,
            detalhes,
            status='CONCLUIDO' if etapa == 'CONCLUIDO' else 'PROCESSANDO',
        )
        log('INFO', 'CHECKPOINT_CONFIRMADO', {
            'pedidoId': trabalho['pedidoId'],
            'etapa': etapa,
            'tentativa': trabalho['tentativa'],
        })

    try:
        executar_fluxo(config, ultimo_estado, checkpoint, log)
    except Exception as erro:
        codigo = reter_codigo_erro(erro)
        mensagem = mensagem_segura(codigo)
        try:
            cliente.checkpoint(
                trabalho,
                ultimo_estado,
                str(ultimo_estado.get('etapa', trabalho['etapa'])),
                {},
                status='ERRO',
                erro_codigo=codigo,
                erro_mensagem=mensagem,
            )
        except Exception as erro_checkpoint:
            log('ERROR', 'ERRO_SEM_CHECKPOINT_REMOTO', {
                'pedidoId': trabalho['pedidoId'],
                'codigo': codigo,
                'erroCheckpoint': type(erro_checkpoint).__name__,
            })
        log('ERROR', 'PROCESSAMENTO_FALHOU', {
            'pedidoId': trabalho['pedidoId'],
            'codigo': codigo,
            'tipo': type(erro).__name__,
        })


def reter_codigo_erro(erro: Exception) -> str:
    texto = str(erro).split(':', 1)[0].strip().upper()
    texto = ''.join(caractere if caractere.isalnum() or caractere == '_' else '_' for caractere in texto)
    return (texto or type(erro).__name__.upper())[:80]


def mensagem_segura(codigo: str) -> str:
    mensagens = {
        'MODELO_SGI_DIVERGENTE': 'O modelo SGI 39879 mudou. A operação foi interrompida antes da duplicação.',
        'PRODUTO_DESTINO_DUPLICADO_NO_SGI': 'Há mais de um produto com o nome final no SGI. É necessária revisão técnica.',
        'DUPLICACAO_INDETERMINADA': 'O resultado da duplicação não pôde ser determinado com segurança. É necessária revisão técnica.',
        'ESTADO_LOCAL_DIVERGENTE': 'O checkpoint local diverge da solicitação. É necessária revisão técnica.',
    }
    return mensagens.get(codigo, 'O SGI não concluiu a operação. Tente retomar do checkpoint salvo.')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--intervalo', type=int, default=20)
    args = parser.parse_args()
    cliente = ClienteApp()
    while True:
        try:
            trabalho = cliente.reivindicar()
            if trabalho:
                log('INFO', 'TRABALHO_REIVINDICADO', {
                    'pedidoId': trabalho['pedidoId'],
                    'etapa': trabalho['etapa'],
                    'tentativa': trabalho['tentativa'],
                })
                processar(cliente, trabalho)
            elif args.once:
                return 0
        except Exception as erro:
            log('ERROR', 'POLLING_FALHOU', {
                'codigo': reter_codigo_erro(erro),
                'tipo': type(erro).__name__,
            })
            if args.once:
                return 1
        if args.once:
            return 0
        time.sleep(max(args.intervalo, 5))


if __name__ == '__main__':
    sys.exit(main())
