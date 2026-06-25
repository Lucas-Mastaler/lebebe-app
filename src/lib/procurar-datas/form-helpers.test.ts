import { describe, expect, it } from 'vitest'
import {
  normalizarBairro,
  normalizarCidade,
  normalizarLogradouro,
  normalizarNumero,
  normalizarUF,
  validarCamposEndereco,
  mensagemErroTempo,
} from './form-helpers'

describe('form-helpers', () => {
  it('normaliza numero para apenas digitos', () => {
    expect(normalizarNumero('12abc30')).toBe('1230')
    expect(normalizarNumero('S/N')).toBe('')
    expect(normalizarNumero('1000')).toBe('1000')
  })

  it('normaliza UF para 2 letras maiusculas', () => {
    expect(normalizarUF('pr1')).toBe('PR')
    expect(normalizarUF('sp')).toBe('SP')
    expect(normalizarUF('Rio')).toBe('RI')
  })

  it('normaliza cidade removendo numeros e caracteres invalidos e convertendo para maiusculo', () => {
    expect(normalizarCidade('Curitiba 123')).toBe('CURITIBA ')
    expect(normalizarCidade('São  Paulo--')).toBe('SÃO PAULO--')
    expect(normalizarCidade('São Paulo')).toBe('SÃO PAULO')
  })

  it('normaliza logradouro permitindo numeros e pontuacao comum e convertendo para maiusculo', () => {
    expect(normalizarLogradouro('Rua  Major  Francisco, 70')).toBe('RUA MAJOR FRANCISCO, 70')
    expect(normalizarLogradouro('Av. Brasil 123@')).toBe('AV. BRASIL 123')
  })

  it('normaliza bairro permitindo numeros e convertendo para maiusculo', () => {
    expect(normalizarBairro('Centro 123')).toBe('CENTRO 123')
    expect(normalizarBairro('Bairro  @')).toBe('BAIRRO ')
    expect(normalizarBairro('Bairro')).toBe('BAIRRO')
  })

  it('permite espaco no final durante digitacao', () => {
    expect(normalizarLogradouro('RUA ')).toBe('RUA ')
    expect(normalizarBairro('CENTRO ')).toBe('CENTRO ')
    expect(normalizarCidade('CURITIBA ')).toBe('CURITIBA ')
  })

  it('valida campos de endereco obrigatorios', () => {
    const valido = validarCamposEndereco({
      logradouro: 'Rua Major',
      numero: '70',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
    })
    expect(valido.ok).toBe(true)
    expect(valido.errors).toEqual({})

    const invalido = validarCamposEndereco({
      logradouro: 'R',
      numero: '',
      bairro: 'C',
      cidade: 'C',
      uf: 'P',
    })
    expect(invalido.ok).toBe(false)
    expect(invalido.errors.logradouro).toBe('Informe o logradouro.')
    expect(invalido.errors.numero).toBe('Informe o numero.')
    expect(invalido.errors.bairro).toBe('Informe o bairro.')
    expect(invalido.errors.cidade).toBe('Informe a cidade.')
    expect(invalido.errors.uf).toBe('Informe a UF com 2 letras.')
  })

  it('retorna mensagem de erro para tempo invalido', () => {
    expect(mensagemErroTempo('', false)).toBe('Selecione ao menos um servico para calcular o tempo.')
    expect(mensagemErroTempo('00:00', false)).toBe('Selecione ao menos um servico para calcular o tempo.')
    expect(mensagemErroTempo('07:00', true)).toBe('Tempo necessario acima do limite de 06:30.')
    expect(mensagemErroTempo('02:00', false)).toBeNull()
  })
})
