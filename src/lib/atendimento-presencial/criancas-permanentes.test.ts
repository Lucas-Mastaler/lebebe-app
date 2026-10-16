import { describe, expect, it } from 'vitest'
import { descreverInformacaoNascimento, opcoesCriancasDisponiveis, selecionarCriancaCadastrada, type CriancaReutilizavel } from './criancas-permanentes'
import { validarFichaDadosRascunho, validarFichaParaConclusao, type FichaDadosRascunho } from './ficha-schema'
const cliente = '10000000-0000-4000-8000-000000000001'
const id = '20000000-0000-4000-8000-000000000001'
const item: CriancaReutilizavel = { id, clienteId: cliente, origem:'permanente', parentesco:'Filha', dados:{id:'local-alice',nome:'Alice',situacao:'ja_nasceu',idadeUnidade:'anos',idadeValor:2},registradoEm:'2025-01-01' }
const ficha: FichaDadosRascunho = {versaoFluxo:2,tipoAtendimento:'cliente',consultoraNome:'Ana',criancas:[],departamentos:['moveis'],produtosInteresse:[],motivosResultado:[],resultadoAtendimento:'sim',etapaAtual:'ficha'}
describe('crianças reutilizáveis', () => {
  it('cliente sem cadastro oferece lista vazia',()=>expect(opcoesCriancasDisponiveis([],[],cliente)).toEqual([]))
  it('seleção dispensa redigitação e não modifica cadastro',()=>{ const selecionada=selecionarCriancaCadastrada(item,cliente); expect(selecionada).toMatchObject({nome:'Alice',parentesco:'Filha',criancaPermanenteId:id,vinculoClienteId:cliente}); expect(item.dados).not.toHaveProperty('criancaPermanenteId') })
  it('não oferece selecionadas; remover seleção devolve a opção',()=>{ expect(opcoesCriancasDisponiveis([item],[selecionarCriancaCadastrada(item,cliente)],cliente)).toEqual([]); expect(opcoesCriancasDisponiveis([item],[],cliente)).toEqual([item]) })
  it('permite segunda criança e parentesco diferente',()=>{const outra={...item,id:'20000000-0000-4000-8000-000000000002',parentesco:'Sobrinha'};expect(opcoesCriancasDisponiveis([item,outra],[selecionarCriancaCadastrada(item,cliente)],cliente)).toEqual([outra])})
  it('isola cliente e impede selecionar origem não confirmada',()=>{expect(opcoesCriancasDisponiveis([item],[],'outra')).toEqual([]);expect(()=>selecionarCriancaCadastrada(item,'outra')).toThrow();expect(()=>selecionarCriancaCadastrada({...item,origem:'historica'},cliente)).toThrow()})
  it('não transforma idade histórica em atual',()=>expect(descreverInformacaoNascimento(item)).toBe('Idade informada: 2 anos (registro de 01/01/2025)'))
  it('preserva cadastro novo e permanente no autosave',()=>{const criancas=[{id:'nova-crianca',situacao:'nao_informado' as const,parentesco:'Neta'},selecionarCriancaCadastrada(item,cliente)];const validacao=validarFichaDadosRascunho({...ficha,criancas});expect(validacao.ok && validacao.dados.criancas).toEqual(criancas)})
  it('rejeita referência malformada em vez de descartar criança',()=>expect(validarFichaDadosRascunho({...ficha,criancas:[{...item.dados,criancaPermanenteId:'inválido'}]})).toMatchObject({ok:false,field:'criancas'}))
  it('bloqueia transporte de criança para outro cliente',()=>expect(validarFichaParaConclusao({clienteId:'outro',numeroLancamento:22,ficha:{...ficha,criancas:[selecionarCriancaCadastrada(item,cliente)]}})).toMatchObject({ok:false,field:'criancas'}))
  it('preserva limite de oito',()=>expect(validarFichaDadosRascunho({...ficha,criancas:Array.from({length:9},(_,i)=>({...item.dados,id:`crianca-${i}`}))})).toMatchObject({ok:false,field:'criancas'}))
  it('registro antigo não ganha identidade nem parentesco fictício',()=>{const result=validarFichaDadosRascunho({...ficha,versaoFluxo:undefined,tipoAtendimento:undefined,criancas:[item.dados]});expect(result.ok && result.dados.criancas).toEqual([item.dados])})
})
