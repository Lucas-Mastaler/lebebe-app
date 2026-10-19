import {describe, expect, it} from 'vitest'
import {MOTIVOS_VISITA, MOTIVOS_VISITA_HISTORICOS, MOTIVOS_VENDA_PERDIDA, MOTIVOS_NEGOCIACAO, motivosParaResultado, motivosParaEdicao, migrarFichaDadosRascunho, validarFichaDadosRascunho, validarFichaParaConclusao, type FichaDadosRascunho} from './ficha-schema'
import {normalizarDetalheParaFichaEdicao, montarPayloadEdicaoAtendimento, serializarClienteRegistro, registroSemTelefone, type RegistroAtendimentoDetalheDTO} from './registros'
const ficha: FichaDadosRascunho={versaoFluxo:2,tipoAtendimento:'cliente',consultoraNome:'ANA',criancas:[],departamentos:['moveis'],produtosInteresse:[],resultadoAtendimento:'nao',motivosResultado:['outra_loja_fisica','outra_loja_internet'],etapaAtual:'resultado',lojasMotivos:{outra_loja_fisica:'Loja Física',outra_loja_internet:'Loja Internet'}}
describe('refinamento funcional autorizado',()=>{
 it('SEM TELEFONE independe da recusa e inclui histórico; exclui Não cliente',()=>{
  expect(registroSemTelefone({versaoFluxo:null,tipoAtendimento:null,clienteTelefone:null})).toBe(true)
  expect(registroSemTelefone({versaoFluxo:2,tipoAtendimento:'cliente',clienteTelefone:null})).toBe(true)
  expect(registroSemTelefone({versaoFluxo:2,tipoAtendimento:'cliente',clienteTelefone:'+55 (41) 99999-9999'})).toBe(false)
  expect(registroSemTelefone({versaoFluxo:2,tipoAtendimento:'nao_cliente',clienteTelefone:null})).toBe(false)
 })
 it('oferece as listas exatas e em ordem por resultado',()=>{
  expect(MOTIVOS_VENDA_PERDIDA.map(i=>i.label)).toEqual(['Cor (Queria cor diferente)','Medidas (Não coube no quarto)','Sem estoque','Achou caro produto','Achou caro o frete','Fechou em outra loja física','Fechou em outra loja internet','Não respondeu mais (vácuo)','Prazo de entrega'])
  expect(MOTIVOS_NEGOCIACAO.map(i=>i.label)).toEqual(['Virada de cartão','Sem medidas (precisa tirar as medidas)','Vai ganhar de presente','Precisa conversar com outra pessoa','Tá pesquisando','Vai aguardar mais perto do nascimento','Início de gestação (menos de 3 meses)'])
  expect(motivosParaResultado('sim')).toEqual([])
  expect(motivosParaResultado('nao')).toEqual(MOTIVOS_VENDA_PERDIDA)
  expect(motivosParaResultado('negociacao')).toEqual(MOTIVOS_NEGOCIACAO)
 })
 it('oferece sete motivos de visita, mantendo antigos aceitos',()=>{
  expect(MOTIVOS_VISITA.map(i=>i.label)).toEqual(['Acompanhante (entrou separado)','Pedido de informação','Vendedor ambulante/entregador/iFood/Panfleto','Entrega de mercadoria','Currículo','Representante','Outros'])
  for(const {chave} of [...MOTIVOS_VISITA,...MOTIVOS_VISITA_HISTORICOS])expect(validarFichaParaConclusao({ficha:{...ficha,tipoAtendimento:'nao_cliente',motivoVisita:chave,criancas:[],departamentos:[]},clienteId:null}).ok).toBe(true)
 })
 it('recupera múltiplos motivos, lojas e identificadores históricos sem conversão',()=>{
  expect(migrarFichaDadosRascunho(ficha)).toEqual(ficha)
  const legado={...ficha,motivosResultado:['preco','cor_acabamento'] as const}
  const recuperado=migrarFichaDadosRascunho(legado)
  expect(recuperado.motivosResultado).toEqual(legado.motivosResultado)
  expect(motivosParaEdicao(recuperado).slice(-2).map(m=>m.chave)).toEqual(legado.motivosResultado)
 })
 it('lojas são opcionais e não reaproveitam complemento de motivo removido',()=>{
  expect(validarFichaParaConclusao({ficha:{...ficha,lojasMotivos:undefined},clienteId:'cliente'})).toEqual({ok:true,numeroLancamento:null})
  expect(migrarFichaDadosRascunho({...ficha,motivosResultado:['outra_loja_fisica']}).lojasMotivos).toEqual({outra_loja_fisica:'Loja Física'})
  expect(validarFichaDadosRascunho({...ficha,lojasMotivos:{outra_loja_fisica:'x'.repeat(121)}}).ok).toBe(false)
  expect(validarFichaDadosRascunho({...ficha,lojasMotivos:{preco:'Loja'}}).ok).toBe(false)
 })
 it('reabre e edita complementos independentes na estrutura persistida',()=>{
  const detalhe: RegistroAtendimentoDetalheDTO={
    atendimento:{id:'atendimento',status:'concluido',draftClientId:'draft',consultoraUsuarioId:'usuario',unidadeId:'unidade',dadosRascunho:ficha,
      versaoFluxo:2,tipoAtendimento:'cliente',clienteId:'cliente',resultadoAtendimento:'nao',version:3,consultoraNomeManual:'Ana',
      motivoOutro:null,observacoes:null,numeroLancamento:null,concluidoEm:'2026-10-16T12:00:00Z',iniciadoEm:'2026-10-16T11:00:00Z',
      ultimaAtividadeEm:'2026-10-16T12:00:00Z',expiraEm:'2026-10-16T12:00:00Z',criadoPor:'usuario',atualizadoPor:'usuario',
      createdAt:'2026-10-16T11:00:00Z',updatedAt:'2026-10-16T12:00:00Z',expirado:false},
    cliente:null,historico:[],criancas:[],departamentos:[{id:'d',departamento:'moveis'}],produtosInteresse:[],
    motivos:[{id:'f',motivo:'outra_loja_fisica',complemento:'Física'},{id:'i',motivo:'outra_loja_internet',complemento:'Internet'}],
  }
  const edicao=normalizarDetalheParaFichaEdicao(detalhe)
  expect(edicao.lojasMotivos).toEqual({outra_loja_fisica:'Física',outra_loja_internet:'Internet'})
  expect(montarPayloadEdicaoAtendimento({detalhe,ficha:edicao,numeroLancamento:null}).dadosRascunho.lojasMotivos).toEqual(edicao.lojasMotivos)
 })
 it('usa telefone informado ou normalizado associado ao cliente',()=>{
  expect(serializarClienteRegistro({id:'c',nome:'Cliente',telefone_informado:null,telefone_normalizado_ddi:'5541999999999'})?.telefone).toBe('5541999999999')
  expect(serializarClienteRegistro({id:'c',nome:'Cliente',telefone_informado:'(41) 99999-9999',telefone_normalizado:'41999999999'})?.telefone).toBe('(41) 99999-9999')
 })
})
