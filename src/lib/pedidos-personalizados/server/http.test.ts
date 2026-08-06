import { describe, expect, it, vi } from 'vitest'
import {
  LIMITE_CORPO_JSON_BYTES,
  lerJsonLimitado,
  mapearErroBanco,
  registrarResultado,
} from './http'

describe('HTTP e erros de pedidos personalizados', () => {
  it('lê JSON válido e rejeita JSON malformado', async () => {
    const valido = await lerJsonLimitado(new Request('http://localhost', { method: 'POST', body: '{"ok":true}' }))
    expect(valido).toMatchObject({ ok: true, valor: { ok: true } })
    const invalido = await lerJsonLimitado(new Request('http://localhost', { method: 'POST', body: '{' }))
    expect(invalido.ok).toBe(false)
    if (!invalido.ok) expect(invalido.response.status).toBe(400)
  })

  it('rejeita Content-Length e corpo real acima de 256 KiB', async () => {
    const peloHeader = await lerJsonLimitado(new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-length': String(LIMITE_CORPO_JSON_BYTES + 1) },
      body: '{}',
    }))
    expect(peloHeader.ok).toBe(false)
    if (!peloHeader.ok) expect(peloHeader.response.status).toBe(413)

    const peloCorpo = await lerJsonLimitado(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ texto: 'x'.repeat(LIMITE_CORPO_JSON_BYTES) }),
    }))
    expect(peloCorpo.ok).toBe(false)
    if (!peloCorpo.ok) expect(peloCorpo.response.status).toBe(413)
  })

  it.each([
    [{ code: 'P0003', message: 'CONFLITO_VERSAO' }, 409, 'CONFLITO_VERSAO'],
    [{ code: 'P0002', message: 'PEDIDO_NAO_ENCONTRADO' }, 404, 'PEDIDO_NAO_ENCONTRADO'],
    [{ code: '42501', message: 'USUARIO_INVALIDO' }, 403, 'ACESSO_NEGADO'],
    [{ code: 'P0001', message: 'EDICAO_COMERCIAL_BLOQUEADA' }, 422, 'EDICAO_COMERCIAL_BLOQUEADA'],
    [{ code: '23505', message: 'duplicate key' }, 409, 'CONFLITO_RECURSO'],
    [{ code: 'XX000', message: 'select segredo from tabela' }, 500, 'ERRO_INTERNO'],
  ])('mapeia erro sem expor detalhes internos', async (error, status, codigo) => {
    const response = mapearErroBanco(error)
    const texto = JSON.stringify(await response.json())
    expect(response.status).toBe(status)
    expect(texto).toContain(codigo)
    if (error.message !== codigo) expect(texto).not.toContain(error.message)
  })

  it('gera log estruturado apenas com identificadores técnicos', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    registrarResultado({
      rota: '/api/pedidos-personalizados/pedidos',
      operacao: 'listar',
      inicio: Date.now(),
      usuarioId: 'usuario-tecnico',
      pedidoId: 'pedido-tecnico',
      unidade: 'bigorrilho',
    }, 'sucesso', 'PEDIDOS_LISTADOS')
    expect(info).toHaveBeenCalledWith('[pedidos-personalizados]', expect.objectContaining({
      usuarioId: 'usuario-tecnico',
      pedidoId: 'pedido-tecnico',
      unidade: 'bigorrilho',
      resultado: 'sucesso',
    }))
  })
})
