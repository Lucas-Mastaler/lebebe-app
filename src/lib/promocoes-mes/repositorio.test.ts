import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { FormularioPromocao } from './formulario'
import { criarPromocao, excluirPromocao, listarVigentes, reconciliarStorage } from './repositorio'

type Estado = {
  promocoes: Array<Record<string, string>>
  arquivos: Array<Record<string, unknown>>
  pendencias: Array<Record<string, unknown>>
  objetos: Map<string, string | null>
  falhaUpload: boolean
  falhaInsertArquivos: boolean
  falhaRemocao: boolean
  filtros: Array<[string, string, string]>
}

function criarFake(parcial: Partial<Estado> = {}) {
  const estado: Estado = {
    promocoes: [], arquivos: [], pendencias: [], objetos: new Map(),
    falhaUpload: false, falhaInsertArquivos: false, falhaRemocao: false, filtros: [], ...parcial,
  }
  const tabela = (nome: string) => {
    const dados = () => (nome === 'promocoes_mes' ? estado.promocoes : nome === 'promocoes_mes_arquivos' ? estado.arquivos : estado.pendencias) as Array<Record<string, unknown>>
    let linhas = [...dados()]
    let acao: 'select' | 'delete' = 'select'
    const api: Record<string, unknown> = {}
    const resultado = () => {
      if (acao === 'delete') {
        const ids = new Set(linhas.map((l) => l.id ?? l.caminho_objeto))
        const alvo = dados()
        for (let i = alvo.length - 1; i >= 0; i--) if (ids.has(alvo[i].id ?? alvo[i].caminho_objeto)) alvo.splice(i, 1)
        if (nome === 'promocoes_mes') estado.arquivos = estado.arquivos.filter((a) => estado.promocoes.some((p) => p.id === a.promocao_id))
        return { data: null, error: null }
      }
      return { data: linhas, error: null }
    }
    Object.assign(api, {
      select: () => api,
      order: () => api,
      eq: (c: string, v: unknown) => { linhas = linhas.filter((l) => l[c] === v); return api },
      in: (c: string, v: unknown[]) => { linhas = linhas.filter((l) => v.includes(l[c])); return api },
      lte: (c: string, v: string) => { estado.filtros.push(['lte', c, v]); linhas = linhas.filter((l) => String(l[c]) <= v); return api },
      gte: (c: string, v: string) => { estado.filtros.push(['gte', c, v]); linhas = linhas.filter((l) => String(l[c]) >= v); return api },
      maybeSingle: async () => ({ data: linhas[0] ?? null, error: null }),
      delete: () => { acao = 'delete'; return api },
      upsert: async (novas: Array<Record<string, unknown>>) => { estado.pendencias.push(...novas); return { error: null } },
      insert: async (nova: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (nome === 'promocoes_mes_arquivos' && estado.falhaInsertArquivos) return { error: { message: 'falha' } }
        dados().push(...(Array.isArray(nova) ? nova : [nova]))
        return { error: null }
      },
      then: (ok: (v: unknown) => unknown) => Promise.resolve(resultado()).then(ok),
    })
    return api
  }
  const client = {
    from: tabela,
    storage: {
      from: () => ({
        upload: async (caminho: string) => {
          if (estado.falhaUpload && estado.objetos.size >= 1) return { error: { message: 'falha' } }
          estado.objetos.set(caminho, new Date().toISOString()); return { error: null }
        },
        remove: async (caminhos: string[]) => {
          if (estado.falhaRemocao) return { error: { message: 'falha remoção' } }
          caminhos.forEach((c) => estado.objetos.delete(c)); return { error: null }
        },
        createSignedUrls: async (caminhos: string[]) => ({ data: caminhos.map((path) => ({ path, signedUrl: `https://u/${path}`, error: null })), error: null }),
        list: async (prefixo: string) => {
          if (!prefixo) {
            const pastas = new Set([...estado.objetos.keys()].map((c) => c.split('/')[0]))
            return { data: [...pastas].map((name) => ({ name, id: null, created_at: null })), error: null }
          }
          return { data: [...estado.objetos.entries()].filter(([c]) => c.startsWith(`${prefixo}/`)).map(([c, criado]) => ({ name: c.split('/')[1], id: 'x', created_at: criado })), error: null }
        },
      }),
    },
  }
  return { client: client as unknown as SupabaseClient, estado }
}

const arquivo = (nome: string) => ({ bytes: new ArrayBuffer(4), nomeOriginal: nome, mimeType: 'image/png' as const, extensao: 'png' as const, tamanhoBytes: 4 })
const form = (qtd: number): FormularioPromocao => ({ titulo: 'T', inicio: '2026-11-01', fim: '2026-11-30', arquivos: Array.from({ length: qtd }, (_, i) => arquivo(`${i}.png`)), remover: [] })

describe('repositório de promoções', () => {
  it('cria promoção com arquivos e URLs assinadas', async () => {
    const { client, estado } = criarFake()
    const p = await criarPromocao(client, form(2), 'g@x.com', '2026-11-10')
    expect(p.arquivos).toHaveLength(2)
    expect(p.arquivos.every((a) => a.url?.startsWith('https://u/'))).toBe(true)
    expect(estado.objetos.size).toBe(2)
  })

  it('falha no 2º upload: remove o 1º objeto, não grava promoção', async () => {
    const { client, estado } = criarFake({ falhaUpload: true })
    await expect(criarPromocao(client, form(2), 'g@x.com', '2026-11-10')).rejects.toMatchObject({ codigo: 'UPLOAD_FALHOU' })
    expect(estado.objetos.size).toBe(0)
    expect(estado.promocoes).toHaveLength(0)
  })

  it('falha ao gravar arquivos: desfaz promoção e remove objetos', async () => {
    const { client, estado } = criarFake({ falhaInsertArquivos: true })
    await expect(criarPromocao(client, form(2), 'g@x.com', '2026-11-10')).rejects.toMatchObject({ codigo: 'GRAVACAO_FALHOU' })
    expect(estado.objetos.size).toBe(0)
    expect(estado.promocoes).toHaveLength(0)
  })

  it('falha ao remover objeto na compensação: registra pendência (sem órfão silencioso)', async () => {
    const { client, estado } = criarFake({ falhaInsertArquivos: true, falhaRemocao: true })
    await expect(criarPromocao(client, form(1), 'g@x.com', '2026-11-10')).rejects.toBeTruthy()
    expect(estado.pendencias).toHaveLength(1)
    expect(estado.pendencias[0]).toMatchObject({ motivo: 'FALHA_APOS_UPLOAD' })
  })

  it('excluir remove linhas e objetos; falha de storage fica registrada', async () => {
    const { client, estado } = criarFake()
    const p = await criarPromocao(client, form(2), 'g@x.com', '2026-11-10')
    expect(await excluirPromocao(client, p.id)).toEqual({ objetosPendentes: 0 })
    expect(estado.objetos.size).toBe(0)

    const outro = criarFake()
    const q = await criarPromocao(outro.client, form(1), 'g@x.com', '2026-11-10')
    outro.estado.falhaRemocao = true
    expect(await excluirPromocao(outro.client, q.id)).toEqual({ objetosPendentes: 1 })
    expect(outro.estado.pendencias[0]).toMatchObject({ motivo: 'REMOCAO_PROMOCAO' })
  })

  it('vigentes filtra por inicio <= hoje <= fim (inclusivo)', async () => {
    const { client, estado } = criarFake()
    estado.promocoes.push(
      { id: 'a', titulo: 'começa hoje', inicio: '2026-11-10', fim: '2026-11-20', created_at: '', updated_at: '' },
      { id: 'b', titulo: 'termina hoje', inicio: '2026-11-01', fim: '2026-11-10', created_at: '', updated_at: '' },
      { id: 'c', titulo: 'futura', inicio: '2026-11-11', fim: '2026-11-20', created_at: '', updated_at: '' },
      { id: 'd', titulo: 'encerrada', inicio: '2026-11-01', fim: '2026-11-09', created_at: '', updated_at: '' },
    )
    const r = await listarVigentes(client, '2026-11-10')
    expect(r.map((p) => p.id).sort()).toEqual(['a', 'b'])
    expect(estado.filtros).toContainEqual(['lte', 'inicio', '2026-11-10'])
    expect(estado.filtros).toContainEqual(['gte', 'fim', '2026-11-10'])
  })

  it('reconciliação encontra órfãos antigos, preserva uploads recentes e limpa ao aplicar', async () => {
    const { client, estado } = criarFake()
    const velho = new Date(Date.now() - 3_600_000).toISOString()
    estado.objetos.set('p1/velho.png', velho)
    estado.objetos.set('p1/recente.png', new Date().toISOString())
    estado.arquivos.push({ id: 'x', caminho_objeto: 'p1/sem-objeto.png' })
    const seco = await reconciliarStorage(client, false)
    expect(seco.objetosOrfaos).toEqual(['p1/velho.png'])
    expect(seco.arquivosSemObjeto).toEqual(['p1/sem-objeto.png'])
    expect(estado.objetos.has('p1/velho.png')).toBe(true)
    const aplicado = await reconciliarStorage(client, true)
    expect(aplicado.removidos).toBe(1)
    expect(estado.objetos.has('p1/velho.png')).toBe(false)
    expect(estado.objetos.has('p1/recente.png')).toBe(true)
  })
})
