import { describe, expect, it } from 'vitest'
import { montarEnderecoDisplayProcurarDatas, montarHashEnderecoLegado } from './endereco-cache'

describe('endereco-cache', () => {
  it('monta display no formato usado pelo fluxo de procurar datas', () => {
    expect(
      montarEnderecoDisplayProcurarDatas({
        logradouro: 'Av Marechal Floriano Peixoto',
        numero: '5000',
        bairro: 'Hauer',
        cidade: 'Curitiba',
        uf: 'pr',
      })
    ).toBe('Av Marechal Floriano Peixoto, 5000, Hauer, Curitiba - PR, Brasil')
  })

  it('gera hash legado ignorando numero do endereco', () => {
    const base = {
      logradouro: 'Av Marechal Floriano Peixoto',
      bairro: 'Hauer',
      cidade: 'Curitiba',
      uf: 'PR',
    }

    expect(montarHashEnderecoLegado({ ...base, numero: '5000' })).toBe(
      montarHashEnderecoLegado({ ...base, numero: '5636' })
    )
  })
})

