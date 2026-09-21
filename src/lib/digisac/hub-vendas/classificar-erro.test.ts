import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/digisac/contatos', () => ({ buscarContatoCompleto: vi.fn() }))
vi.mock('./envio', () => ({}))
vi.mock('./preparar-fila', () => ({ analisarReconciliacaoLead: vi.fn() }))
vi.mock('./alertas', () => ({
  alertarAnaliseManual: vi.fn(),
  alertarErroEnvio: vi.fn(),
  alertarResultadoIncerto: vi.fn(),
}))

const { classificarErro } = await import('./processar-fila')

type Etapa = 'pre_envio' | 'envio' | 'pos_envio'
const estado = (etapa: Etapa, messageId: string | null = null) => ({ etapa, messageId })

const ERRO_500_FALSY = 'mensagem_api_erro status=500 body={"error":"HttpError","message":"[sendMessageToId] Message came out falsy for contact: 55***40@c.us","status":500}'
const ERRO_SERVERPOD = 'contato_criacao_falhou status=500 body={"error":"HttpError","message":"[0973f84b-8294-4615-9657-ba95b6346246] serverPod is not set.","status":500}'

describe('classificarErro — matriz de classificacao', () => {
  describe('definitivos (sem retry)', () => {
    it('contato explicitamente invalido no DigiSac: nao gasta retry e nao afeta a saude da conexao', () => {
      const erro = classificarErro(new Error('contato_invalido_digisac (data.valid=false) origem=mensagem_api_erro status=500'), estado('envio'))

      expect(erro).toMatchObject({ categoria: 'contato_invalido', retentavel: false, incrementaInfra: false, resultadoIncerto: false })
    })

    it('configuracao invalida (sem mensagem ativa / bot nao configurado)', () => {
      expect(classificarErro(new Error('sem_mensagem_ativa'))).toMatchObject({ categoria: 'configuracao', retentavel: false, incrementaInfra: false, resultadoIncerto: false })
      expect(classificarErro(new Error('digisac_bot_user_id_nao_configurado'))).toMatchObject({ categoria: 'configuracao', retentavel: false })
    })

    it('placeholder nao resolvido', () => {
      expect(classificarErro(new Error('placeholder_nao_resolvido'))).toMatchObject({ categoria: 'placeholder_nao_resolvido', retentavel: false, incrementaInfra: false })
    })

    it.each([401, 403])('autenticacao invalida (HTTP %i): sem retry, conta como problema da conexao', (status) => {
      expect(classificarErro(new Error(`mensagem_api_erro status=${status} body={}`), estado('envio')))
        .toMatchObject({ categoria: 'autenticacao', retentavel: false, incrementaInfra: true, resultadoIncerto: false })
    })
  })

  describe('transitorios (retry com backoff)', () => {
    it('serverPod is not set (caso Bigorrilho 07/09 / Hauer 02/09) continua retentavel e nao afeta a conexao', () => {
      expect(classificarErro(new Error(ERRO_SERVERPOD))).toMatchObject({
        categoria: 'indisponibilidade',
        retentavel: true,
        incrementaInfra: false,
        resultadoIncerto: false,
      })
    })

    it('serverPod is not set continua retentavel em qualquer etapa antes do POST aceito', () => {
      expect(classificarErro(new Error(ERRO_SERVERPOD), estado('envio'))).toMatchObject({ retentavel: true, resultadoIncerto: false })
    })

    it('rate limit (429): retentavel', () => {
      expect(classificarErro(new Error('contato_criacao_falhou status=429'))).toMatchObject({ categoria: 'rate_limit', retentavel: true, incrementaInfra: true })
    })

    it('falha de contato, ticket e mensagem sem evidencia de entrega: retentaveis', () => {
      expect(classificarErro(new Error('contato_criacao_falhou status=400 body={}'))).toMatchObject({ categoria: 'contato', retentavel: true, incrementaInfra: false })
      expect(classificarErro(new Error('ticket_transfer_falhou status=500 body={}'))).toMatchObject({ categoria: 'ticket', retentavel: true, incrementaInfra: false })
      expect(classificarErro(new Error('mensagem_api_erro status=500 body={}'), estado('envio'))).toMatchObject({ categoria: 'mensagem', retentavel: true, incrementaInfra: true })
    })

    it('"Message came out falsy" sozinho NAO prova contato invalido: segue como erro de mensagem retentavel', () => {
      const erro = classificarErro(new Error(ERRO_500_FALSY), estado('envio'))

      expect(erro.categoria).not.toBe('contato_invalido')
      expect(erro).toMatchObject({ categoria: 'mensagem', retentavel: true, resultadoIncerto: false })
    })

    it.each(['Digisac Request Timeout (30s)', 'fetch failed', 'network error', 'ECONNRESET', 'The operation was aborted'])(
      'rede/timeout ANTES do envio (%s): transitorio, nunca incerto (nada foi enviado)',
      (mensagem) => {
        expect(classificarErro(new Error(mensagem), estado('pre_envio')))
          .toMatchObject({ categoria: 'indisponibilidade', retentavel: true, incrementaInfra: false, resultadoIncerto: false })
      },
    )

    it('rede/timeout ao consultar durante o envio nao vira "erro definitivo": segue o caminho de resultado incerto', () => {
      expect(classificarErro(new Error('Digisac Request Timeout (30s)'), estado('envio')))
        .toMatchObject({ categoria: 'timeout_resultado_incerto', retentavel: false, resultadoIncerto: true })
    })

    it('erro desconhecido antes do envio: erro_interno retentavel', () => {
      expect(classificarErro(new Error('algo inesperado'))).toMatchObject({ categoria: 'erro_interno', retentavel: true, incrementaInfra: false })
    })
  })

  describe('incertos (sem retry: pode ja ter sido entregue)', () => {
    it('falha depois de o POST ter sido aceito (ex.: erro ao gravar a confirmacao): incerto, com o messageId para conferencia', () => {
      const erro = classificarErro(new Error('connection terminated unexpectedly'), estado('pos_envio', 'msg-123'))

      expect(erro).toMatchObject({ categoria: 'timeout_resultado_incerto', retentavel: false, incrementaInfra: false, resultadoIncerto: true })
      expect(erro.mensagem).toContain('msg-123')
    })

    it('falha pos-envio nunca vira retentavel, mesmo com texto de erro "retentavel" (duplicidade)', () => {
      for (const texto of ['rate limit 429', 'contato_criacao_falhou', 'ticket', 'mensagem', 'qualquer']) {
        expect(classificarErro(new Error(texto), estado('pos_envio', 'msg-1'))).toMatchObject({ retentavel: false, resultadoIncerto: true })
      }
    })

    it('pos-envio ainda respeita erros de configuracao/placeholder (nao sao sobre a entrega)', () => {
      expect(classificarErro(new Error('placeholder_nao_resolvido'), estado('pos_envio'))).toMatchObject({ categoria: 'placeholder_nao_resolvido', resultadoIncerto: false })
    })
  })

  describe('robustez da deteccao de status', () => {
    it('digitos "401"/"403" soltos no texto (ex.: em ids) nao sao lidos como erro de autenticacao', () => {
      expect(classificarErro(new Error('mensagem_api_erro status=500 body={"id":"abc4013xyz"}'), estado('envio')).categoria).toBe('mensagem')
      expect(classificarErro(new Error('contato_criacao_falhou status=500 body={"ref":"40312"}')).categoria).toBe('contato')
    })

    it('aceita valor nao-Error (string) sem quebrar', () => {
      expect(classificarErro('erro qualquer')).toMatchObject({ categoria: 'erro_interno', retentavel: true })
    })

    it('mensagem longa e truncada em 500 caracteres', () => {
      expect(classificarErro(new Error('x'.repeat(2000))).mensagem).toHaveLength(500)
    })
  })
})
