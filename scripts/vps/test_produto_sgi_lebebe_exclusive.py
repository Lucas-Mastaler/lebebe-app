import os
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

import produto_sgi_lebebe_exclusive as fluxo
import worker_produto_sgi_lebebe_exclusive as worker


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


class BuscaProdutosHtmlTest(unittest.TestCase):
    def test_extrai_produtos_e_paginacao_sem_bs4(self):
        class Resposta:
            status_code = 200
            text = '''
                <a href="/produtos/39879/edit">Modelo</a>
                <a class="link" href="/produtos/40000/edit">Destino</a>
                <a href="/produtos/40001/edit">Outro</a>
                <a href="/produtos?filtro=x&amp;page=3">3</a>
            '''

        class Sessao:
            def get(self, *_args, **_kwargs):
                return Resposta()

        class Produto:
            URL_BASE_SGI = 'https://sgi.exemplo'

            @staticmethod
            def abrir_produto(_sessao, produto_id):
                return produto_id

            @staticmethod
            def extrair_nome_produto(html_produto):
                return 'nome exato' if html_produto in {'39879', '40000'} else 'outro nome'

        self.assertEqual(
            fluxo._ids_produtos_por_nome(Sessao(), Produto(), 'nome exato'),
            {'39879', '40000'},
        )


class RenomeacaoTest(unittest.TestCase):
    def _modulo_falso(self, nome_inicial, nome_final, chamadas):
        class Produto:
            NOVO_NOME = ''
            def abrir_produto(self, _sessao, produto_id):
                chamadas.append(('abrir', produto_id)); return 'html'
            def extrair_nome_produto(self, _html): return nome_inicial
            def extrair_authenticity_token(self, _html): return 'csrf'
            def renomear_produto(self, _sessao, produto_id, token): chamadas.append(('patch', produto_id, token))
            def validar_produto_criado(self, _sessao, produto_id): chamadas.append(('validar', produto_id)); return nome_final
        class Custo:
            def validar_credencial(self): chamadas.append(('credencial',))
            def carregar_sessao_sgi(self): return object()
            def validar_sessao_http(self, _sessao): chamadas.append(('sessao',))
        class Base:
            def carregar_fluxos_validados(self): return Produto(), Custo(), object()
        return Base()

    def test_renomeia_mesmo_id_com_patch_parcial(self):
        chamadas = []; anterior = fluxo._carregar_modulo
        fluxo._carregar_modulo = lambda *_: self._modulo_falso('LEBEBE EXCLUSIVE (MARECHAL ANA SILVA)', 'LEBEBE EXCLUSIVE (MARECHAL 65459 ANA SILVA)', chamadas)
        try:
            fluxo.executar_renomeacao(config().pedido_id, '21187', 'LEBEBE EXCLUSIVE (MARECHAL 65459 ANA SILVA)', lambda *_: None)
        finally: fluxo._carregar_modulo = anterior
        self.assertIn(('patch', '21187', 'csrf'), chamadas)
        self.assertIn(('validar', '21187'), chamadas)
        self.assertFalse(any(chamada[0] in {'duplicar', 'custo', 'preco', 'finalizar'} for chamada in chamadas))

    def test_nome_ja_correto_nao_faz_segundo_patch(self):
        chamadas = []; anterior = fluxo._carregar_modulo
        fluxo._carregar_modulo = lambda *_: self._modulo_falso('LEBEBE EXCLUSIVE (MARECHAL 65459 ANA SILVA)', 'LEBEBE EXCLUSIVE (MARECHAL 65459 ANA SILVA)', chamadas)
        try:
            fluxo.executar_renomeacao(config().pedido_id, '21187', 'LEBEBE EXCLUSIVE (MARECHAL 65459 ANA SILVA)', lambda *_: None)
        finally: fluxo._carregar_modulo = anterior
        self.assertNotIn(('patch', '21187', 'csrf'), chamadas)

    def test_rejeita_id_ausente_sem_chamar_sgi(self):
        with self.assertRaisesRegex(RuntimeError, 'PRODUTO_ID_SGI_OBRIGATORIO'):
            fluxo.executar_renomeacao(config().pedido_id, '', 'NOME', lambda *_: None)


class WorkerDispatchTest(unittest.TestCase):
    def setUp(self):
        self.trabalho = {'pedidoId': config().pedido_id, 'claimToken': 'claim', 'etapa': 'NAO_INICIADO', 'tentativa': 1, 'nomeProduto': 'LEBEBE EXCLUSIVE (MARECHAL ANA SILVA)', 'produtoIdSgi': '21187', 'operacao': 'RENOMEAR_PRODUTO'}
        self.chamadas = []
        class Cliente:
            def checkpoint(_, *args, **kwargs): self.chamadas.append(('checkpoint', args, kwargs))
        self.cliente = Cliente()

    def test_dispatch_renomeacao_nao_chama_criacao(self):
        renomear, criar = worker.executar_renomeacao, worker.executar_fluxo
        worker.executar_renomeacao = lambda *args: self.chamadas.append(('renomear', args))
        worker.executar_fluxo = lambda *args: self.chamadas.append(('criar', args))
        try: worker.processar(self.cliente, self.trabalho)
        finally: worker.executar_renomeacao, worker.executar_fluxo = renomear, criar
        self.assertEqual([x[0] for x in self.chamadas].count('renomear'), 1)
        self.assertNotIn('criar', [x[0] for x in self.chamadas])

    def test_operacao_desconhecida_nao_executa_nada(self):
        self.trabalho['operacao'] = 'DESCONHECIDA'
        with self.assertRaisesRegex(RuntimeError, 'OPERACAO_DESCONHECIDA'):
            worker.processar(self.cliente, self.trabalho)
        self.assertEqual(self.chamadas, [])


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
