import {describe,expect,it} from 'vitest'
import {calcularReferenciaNascimento,descreverIdadeAproximada,criancaJaNasceu,dataAtendimentoLocal} from './idade-aproximada'
import {validarFichaDadosRascunho} from './ficha-schema'
describe('idade aproximada sem deslocar referência',()=>{
 it('3 meses em outubro e consulta sete meses depois',()=>{const ref=calcularReferenciaNascimento('2026-10-15','meses',3);expect(ref).toBe('2026-07-01');expect(descreverIdadeAproximada(ref,'2027-05-15')).toBe('Aproximadamente 10 meses')})
 it('um ano e consulta em novembro de 2027',()=>{const ref=calcularReferenciaNascimento('2026-10-15','anos',1);expect(ref).toBe('2025-10-01');expect(descreverIdadeAproximada(ref,'2027-11-01')).toBe('Aproximadamente 2 anos')})
 it('virada do ano e idade acima das faixas de entrada',()=>{expect(calcularReferenciaNascimento('2027-01-31','meses',3)).toBe('2026-10-01');expect(descreverIdadeAproximada('2020-01-01','2030-01-01')).toBe('Aproximadamente 10 anos')})
 it('data do atendimento usa fuso da loja',()=>expect(dataAtendimentoLocal('2026-10-16T01:00:00Z')).toBe('2026-10-15'))
 it.each(['2026-13-15','2026-02-30','invalida'])('não calcula com data inválida %s',(data)=>expect(()=>calcularReferenciaNascimento(data,'meses',3)).toThrow())
 it('presente nasceu compartilha ramo sem transformar previsão',()=>{expect(criancaJaNasceu({situacao:'presente_outra_pessoa',presenteJaNasceu:true})).toBe(true);expect(criancaJaNasceu({situacao:'presente_outra_pessoa',presenteJaNasceu:false})).toBe(false)})
 it('rascunho preserva presente e data estimada',()=>{const crianca={id:'teste-presente',situacao:'presente_outra_pessoa',presenteJaNasceu:true,idadeUnidade:'meses',idadeValor:3,dataReferenciaNascimento:'2026-07-01'};const result=validarFichaDadosRascunho({criancas:[crianca],departamentos:[],produtosInteresse:[],motivosResultado:[],etapaAtual:'ficha'});expect(result.ok&&result.dados.criancas).toEqual([crianca])})
})
