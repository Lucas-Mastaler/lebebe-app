import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('ia-fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('interpretarComIA', () => {
    it('retorna ia_desabilitada quando env nao esta true', async () => {
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED;
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY;
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER;
      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.codigo).toBe('ia_desabilitada');
      }
    });

    it('retorna api_key_especifica_ausente quando habilitada mas sem key', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', '');
      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.codigo).toBe('api_key_especifica_ausente');
      }
    });

    it('retorna decisao valida quando IA responde corretamente', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_MODEL', 'deepseek-chat');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  acao: 'confirmar',
                  confianca: 'alta',
                  mensagem_cliente: 'cliente confirmou',
                  motivo: 'cliente disse sim',
                  dados_extraidos: {},
                }),
              },
            },
          ],
        }),
      });

      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim, pode confirmar',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.decisao.acao).toBe('confirmar');
        expect(result.decisao.confianca).toBe('alta');
        expect(result.decisao.modelo_ia).toBe('deepseek-chat');
      }
    });

    it('retorna acao_invalida quando IA escolhe acao nao permitida', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  acao: 'adiantar',
                  confianca: 'alta',
                  mensagem_cliente: 'teste',
                  motivo: 'teste',
                  dados_extraidos: {},
                }),
              },
            },
          ],
        }),
      });

      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.codigo).toBe('acao_invalida');
      }
    });

    it('retorna json_invalido quando IA retorna texto nao-JSON', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'isso nao e JSON',
              },
            },
          ],
        }),
      });

      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.codigo).toBe('json_invalido');
      }
    });

    it('retorna erro_api quando fetch falha', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.codigo).toBe('erro_api');
      }
    });

    it('retorna provider_nao_suportado quando provider nao e deepseek', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'openai');

      const { interpretarComIA } = await import('./ia-fallback');
      const result = await interpretarComIA({
        estado: 'aguardando_confirmacao_pedido',
        tipo_solicitacao: 'confirmar_entrega',
        mensagem_cliente: 'sim',
        acoes_permitidas: ['confirmar', 'negar', 'transferir_humano', 'pedir_esclarecimento'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.codigo).toBe('provider_nao_suportado');
      }
    });
  });

  describe('tentarIAFallback', () => {
    it('retorna acao_mapeada null e erro ia_desabilitada quando IA desabilitada', async () => {
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED;
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY;
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER;
      const { tentarIAFallback } = await import('./ia-fallback');
      const result = await tentarIAFallback('aguardando_confirmacao_pedido', 'sim', null);
      expect(result.usada).toBe(true);
      expect(result.acao_mapeada).toBeNull();
      expect(result.erro_codigo).toBe('ia_desabilitada');
    });

    it('mapeia confirmar para confirmar quando IA responde', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  acao: 'confirmar',
                  confianca: 'alta',
                  mensagem_cliente: 'confirmou',
                  motivo: 'cliente disse sim',
                  dados_extraidos: {},
                }),
              },
            },
          ],
        }),
      });

      const { tentarIAFallback } = await import('./ia-fallback');
      const result = await tentarIAFallback('aguardando_confirmacao_pedido', 'sim', null);
      expect(result.usada).toBe(true);
      expect(result.acao_mapeada).toBe('confirmar');
      expect(result.erro_codigo).toBeNull();
      expect(result.metadata_ia).toHaveProperty('ia_fallback_chamada', true);
      expect(result.metadata_ia).toHaveProperty('ia_fallback_usada_para_resposta', true);
    });

    it('retorna confianca_baixa e acao_mapeada null quando confianca e baixa', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  acao: 'confirmar',
                  confianca: 'baixa',
                  mensagem_cliente: 'nao claro',
                  motivo: 'mensagem ambigua',
                  dados_extraidos: {},
                }),
              },
            },
          ],
        }),
      });

      const { tentarIAFallback } = await import('./ia-fallback');
      const result = await tentarIAFallback('aguardando_confirmacao_pedido', 'talvez', null);
      expect(result.usada).toBe(true);
      expect(result.acao_mapeada).toBeNull();
      expect(result.erro_codigo).toBe('confianca_baixa');
      expect(result.metadata_ia).toHaveProperty('ia_fallback_usada_para_resposta', false);
    });

    it('mapeia transferir_humano corretamente', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY', 'test-key');
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER', 'deepseek');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  acao: 'transferir_humano',
                  confianca: 'alta',
                  mensagem_cliente: 'cliente confuso',
                  motivo: 'nao da pra entender',
                  dados_extraidos: {},
                }),
              },
            },
          ],
        }),
      });

      const { tentarIAFallback } = await import('./ia-fallback');
      const result = await tentarIAFallback('aguardando_escolha_acao', 'quero falar com alguem', null);
      expect(result.usada).toBe(true);
      expect(result.acao_mapeada).toBe('transferir_humano');
    });
  });

  describe('iaFallbackHabilitada', () => {
    it('retorna false quando env nao esta true', async () => {
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED;
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_API_KEY;
      delete process.env.ATENDIMENTO_POSVENDA_IA_FALLBACK_PROVIDER;
      const { iaFallbackHabilitada } = await import('./ia-fallback');
      expect(iaFallbackHabilitada()).toBe(false);
    });

    it('retorna true quando env esta true', async () => {
      vi.stubEnv('ATENDIMENTO_POSVENDA_IA_FALLBACK_ENABLED', 'true');
      const { iaFallbackHabilitada } = await import('./ia-fallback');
      expect(iaFallbackHabilitada()).toBe(true);
    });
  });
});
