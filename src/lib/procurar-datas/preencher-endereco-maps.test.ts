import { expect, it } from 'vitest'
import { preencherEnderecoMaps } from './preencher-endereco-maps'
it('preenche dados disponíveis sem inventar rua ou número',()=>{
  expect(preencherEnderecoMaps({uf:'PR',logradouro:'Antigo'}, {cidade:'Contenda',uf:'PR'},new Set())).toEqual({cidade:'Contenda',uf:'PR',cep:'',numero:'',logradouro:'',bairro:''})
})
it('respeita os campos digitados mesmo quando divergentes',()=>{
  expect(preencherEnderecoMaps({cidade:'Digitada',logradouro:'Rua manual'}, {cidade:'Contenda',uf:'PR',logradouro:'Rua retornada',bairro:'Centro'},new Set(['cidade','logradouro']))).toMatchObject({cidade:'Digitada',logradouro:'Rua manual',bairro:'Centro',uf:'PR'})
})
it('UF padrão anterior não impede preenchimento automático',()=>expect(preencherEnderecoMaps({uf:'PR'},{cidade:'Joinville',uf:'SC'},new Set()).uf).toBe('SC'))
