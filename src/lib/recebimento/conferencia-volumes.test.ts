import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conferirVolumes } from './conferencia-volumes'
import { validateMaticUser } from '@/lib/auth/matic-auth'
import { createClient } from '@/lib/supabase/server'
import { registrarAtividadeConferencia } from './timer-activity'
import { POST as conferirTodos } from '@/app/api/recebimento/[id]/item/[itemId]/conferir-todos/route'
import { POST as alterarVolume } from '@/app/api/recebimento/[id]/item/[itemId]/volume/[volumeNumero]/route'

vi.mock('@/lib/auth/matic-auth', () => ({ validateMaticUser: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('./timer-activity', () => ({ registrarAtividadeConferencia: vi.fn() }))

const rpc = vi.fn()
const resultado = {
  volumes: [1, 2, 3].map(n => ({ id: `v${n}`, volume_numero: n, qtd_prevista: 10, qtd_recebida: 10 })),
  item_total_recebido: 30, item_total_previsto: 30, item_status: 'concluido',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(validateMaticUser).mockResolvedValue({ authorized: true })
  vi.mocked(createClient).mockResolvedValue({ rpc } as never)
  vi.mocked(registrarAtividadeConferencia).mockResolvedValue({ pausaCriada: null })
  rpc.mockResolvedValue({ data: resultado, error: null })
})

describe('conferência transacional de volumes', () => {
  it('nega acesso antes de chamar o banco', async () => {
    vi.mocked(validateMaticUser).mockResolvedValue({ authorized: false })
    expect((await conferirVolumes('rec', 'item')).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rota em lote ignora quantidades do cliente e retorna todos os volumes', async () => {
    const res = await conferirTodos(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ quantidade: 999 }) }) as never,
      { params: Promise.resolve({ id: 'rec', itemId: 'item' }) })
    expect(rpc).toHaveBeenCalledWith('conferir_recebimento_item', {
      p_recebimento_id: 'rec', p_item_id: 'item', p_volume_numero: null, p_delta: null,
    })
    expect(await res.json()).toEqual({ ...resultado, pausa_criada: null })
    expect(registrarAtividadeConferencia).toHaveBeenCalledTimes(1)
  })

  it('delta usa a mesma função e preserva os campos da resposta anterior', async () => {
    const res = await alterarVolume(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ delta: -1 }) }) as never,
      { params: Promise.resolve({ id: 'rec', itemId: 'item', volumeNumero: '2' }) })
    expect(rpc).toHaveBeenCalledWith('conferir_recebimento_item', expect.objectContaining({ p_volume_numero: 2, p_delta: -1 }))
    expect(await res.json()).toMatchObject({ volume_numero: 2, qtd_recebida: 10, item_total_recebido: 30 })
  })

  it.each(['{', 'null', '{"delta":0}', '{"delta":"1"}'])('rejeita payload inválido: %s', async body => {
    const res = await alterarVolume(new Request('https://example.test', { method: 'POST', body }) as never,
      { params: Promise.resolve({ id: 'rec', itemId: 'item', volumeNumero: '1' }) })
    expect(res.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([['PT403', 403], ['PT404', 404], ['PT409', 409], ['PT422', 422], ['PT400', 400]])('traduz %s sem registrar atividade', async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'detalhe interno' } })
    const res = await conferirVolumes('rec', 'item')
    expect(res.status).toBe(status)
    expect(JSON.stringify(await res.json())).not.toContain('detalhe interno')
    expect(registrarAtividadeConferencia).not.toHaveBeenCalled()
  })

  it('não transforma delta já salvo em erro repetível se o timer falhar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(registrarAtividadeConferencia).mockRejectedValue(new Error('timer indisponível'))
    const res = await conferirVolumes('rec', 'item', { volumeNumero: 1, delta: 1 })
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(await res.json()).toMatchObject({ item_total_recebido: 30, pausa_criada: null })
    vi.restoreAllMocks()
  })
})
