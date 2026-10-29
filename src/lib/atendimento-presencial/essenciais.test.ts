import { describe, expect, it } from 'vitest'
import { faseEssenciais, produtosEssenciaisDaFase, pendenciaEssenciais, incluirEssencialNoInteresse, validarEssenciaisRascunho, respostaEssencial, type EstadoEssenciais } from './essenciais'
import { validarFichaDadosRascunho, type FichaCriancaRascunho } from './ficha-schema'

const c: FichaCriancaRascunho = { id: 'crianca-1', situacao: 'gestacao', criancaPermanenteId: '10000000-0000-4000-8000-000000000001', vinculoClienteId: '10000000-0000-4000-8000-000000000002' }
const anterior = (resposta: 'sim' | 'nao'): EstadoEssenciais => ({ [c.criancaPermanenteId!]: { coleito: { resposta, atendimentoId: 'anterior', registradoEm: '2026-01-01T12:00:00Z', filial: 'Outra filial', consultora: 'Ana' } } })
describe('essenciais oficiais', () => {
  it('inclui os doze produtos da gestação e as inclusões aprovadas', () => {
    expect(produtosEssenciaisDaFase(-1)).toHaveLength(12)
    expect(produtosEssenciaisDaFase(-1)).toEqual(expect.arrayContaining(['carrinho', 'bebe_conforto', 'base', 'colchao']))
    expect(produtosEssenciaisDaFase(0)).toContain('poltrona')
    expect(produtosEssenciaisDaFase(9)).toContain('carrinho_passeio')
  })
  it('respeita todas as fronteiras e a fase desconhecida', () => {
    expect(produtosEssenciaisDaFase(3)).toEqual(produtosEssenciaisDaFase(0))
    expect(produtosEssenciaisDaFase(4)).toEqual(produtosEssenciaisDaFase(8))
    expect(produtosEssenciaisDaFase(8)).not.toContain('carrinho_passeio')
    expect(produtosEssenciaisDaFase(12)).toEqual(produtosEssenciaisDaFase(9))
    expect(produtosEssenciaisDaFase(13)).toEqual([])
    expect(produtosEssenciaisDaFase(null)).toEqual([])
    expect(faseEssenciais({ id: 'nada', situacao: 'nao_informado' })).toBeNull()
  })
  it('calcula idade atual e não inventa idade para presente', () => {
    expect(faseEssenciais({ ...c, situacao: 'presente_outra_pessoa' })).toBeNull()
    expect(faseEssenciais({ ...c, situacao: 'ja_nasceu', dataReferenciaNascimento: '2026-01-01' }, '2026-10-28')).toBe(9)
    expect(faseEssenciais({ id: 'nova', situacao: 'ja_nasceu', idadeUnidade: 'meses', idadeValor: 0 })).toBe(0)
    expect(faseEssenciais({ ...c, situacao: 'ja_nasceu', idadeUnidade: 'meses', idadeValor: 3 })).toBeNull()
  })
  it('reutiliza o mesmo produto entre gestação e nascimento', () => {
    expect(respostaEssencial(c, 'coleito', {}, anterior('sim')).confirmada).toBe(true)
    expect(respostaEssencial({ ...c, situacao: 'ja_nasceu', idadeUnidade: 'meses', idadeValor: 2 }, 'coleito', {}, anterior('sim')).resposta).toBe('sim')
  })
  it('Não anterior precisa de clique direto, sem trocar por Sim', () => {
    expect(respostaEssencial(c, 'coleito', {}, anterior('nao')).confirmada).toBe(false)
    expect(respostaEssencial(c, 'coleito', { [c.id]: { coleito: 'nao' } }, anterior('nao')).confirmada).toBe(true)
  })
  it('não compartilha com outra criança', () => {
    expect(respostaEssencial({ ...c, criancaPermanenteId: 'outra' }, 'coleito', {}, anterior('sim')).resposta).toBeUndefined()
  })
  it('bloqueia fase desconhecida, mas dispensa a lista acima de 12 meses', () => {
    expect(pendenciaEssenciais([{ ...c, situacao: 'nao_informado' }], {}, {})).toContain('Confirme')
    expect(pendenciaEssenciais([{ ...c, situacao: 'ja_nasceu', dataReferenciaNascimento: '2024-01-01' }], {}, {}, '2026-10-28')).toBeNull()
  })
  it('inclui quantidade 1 com venda não marcada e não incrementa no segundo clique', () => {
    const primeiro = incluirEssencialNoInteresse([], 'Berço')
    expect(primeiro.produtos).toEqual([{ descricao: 'Berço', quantidade: 1, vendido: false }])
    expect(incluirEssencialNoInteresse(primeiro.produtos, '  BERCO  ').produtos).toBe(primeiro.produtos)
    expect(incluirEssencialNoInteresse(Array(20).fill('x'), 'novo').resultado).toBe('limite')
  })
  it('rejeita payload com criança alheia, chave desconhecida ou valor inválido', () => {
    expect(validarEssenciaisRascunho({ alheia: { coleito: 'sim' } }, [c])).toBe(false)
    expect(validarEssenciaisRascunho({ [c.id]: { inventado: 'sim' } }, [c])).toBe(false)
    expect(validarEssenciaisRascunho({ [c.id]: { coleito: true } }, [c])).toBe(false)
  })
  it('mantém essenciais no contrato de autosave sem degradar a ficha', () => {
    const dados = { versaoEssenciais: 1, essenciais: { [c.id]: { coleito: 'sim' } }, criancas: [c], departamentos: [], produtosInteresse: [], motivosResultado: [], etapaAtual: 'ficha' }
    const validacao = validarFichaDadosRascunho(dados)
    expect(validacao.ok).toBe(true)
    if (validacao.ok) expect(validacao.dados.essenciais).toEqual(dados.essenciais)
    expect(validarFichaDadosRascunho({ ...dados, versaoEssenciais: undefined }).ok).toBe(false)
  })
})
