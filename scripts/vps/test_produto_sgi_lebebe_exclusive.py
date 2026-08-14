import os
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

import produto_sgi_lebebe_exclusive as fluxo


def config() -> fluxo.ConfiguracaoProdutoSgi:
    return fluxo.ConfiguracaoProdutoSgi(
        pedido_id='10000000-0000-4000-8000-000000000001',
        modelo_produto_id_sgi='39879',
        modelo_nome_esperado='LEBEBE EXCLUSIVE (MODELO PADRÃO - NÃO USAR)',
        nome_produto='LEBEBE EXCLUSIVE (PORTÃO 123456)',
        custo=Decimal('123.45'),
        preco=Decimal('456.78'),
    )


class EstadoRetomavelTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.pasta_original = fluxo.PASTA_ESTADOS
        fluxo.PASTA_ESTADOS = Path(self.temp.name)

    def tearDown(self):
        fluxo.PASTA_ESTADOS = self.pasta_original
        self.temp.cleanup()

    def test_salva_antes_do_callback_e_retoma_estado_local_mais_avancado(self):
        estado = fluxo.carregar_estado(config(), {'etapa': 'NAO_INICIADO'})
        observado = []

        def checkpoint(valor, etapa, _detalhes):
            caminho = fluxo._caminho_estado(valor['pedido_id'])
            self.assertTrue(caminho.exists())
            observado.append(etapa)

        estado['produto_id_sgi'] = '39880'
        fluxo._emitir(estado, 'PRODUTO_DUPLICADO', {}, checkpoint)
        retomado = fluxo.carregar_estado(config(), {'etapa': 'NAO_INICIADO'})
        self.assertEqual(retomado['etapa'], 'PRODUTO_DUPLICADO')
        self.assertEqual(retomado['produto_id_sgi'], '39880')
        self.assertEqual(observado, ['PRODUTO_DUPLICADO'])

    def test_rejeita_reuso_do_checkpoint_para_outro_valor(self):
        estado = fluxo.carregar_estado(config(), {'etapa': 'NAO_INICIADO'})
        fluxo.salvar_estado(estado)
        divergente = fluxo.ConfiguracaoProdutoSgi(
            **{**config().__dict__, 'preco': Decimal('999.99')}
        )
        with self.assertRaisesRegex(RuntimeError, 'ESTADO_LOCAL_DIVERGENTE'):
            fluxo.carregar_estado(divergente, {'etapa': 'NAO_INICIADO'})


@unittest.skipUnless(os.environ.get('RUN_SGI_READONLY') == '1', 'consulta SGI opt-in')
class ModeloSgiReadOnlyTest(unittest.TestCase):
    def test_modelo_39879_e_busca_exata(self):
        mensagens = []
        logger = lambda nivel, evento, detalhes: mensagens.append((nivel, evento, detalhes))
        _, produto, custo, _ = fluxo._configurar_modulos(config(), logger)
        custo.validar_credencial()
        sessao = custo.carregar_sessao_sgi()
        custo.validar_sessao_http(sessao)
        fluxo._validar_modelo(sessao, produto, config())
        self.assertIn('39879', fluxo._ids_produtos_por_nome(
            sessao, produto, config().modelo_nome_esperado,
        ))


if __name__ == '__main__':
    unittest.main()
