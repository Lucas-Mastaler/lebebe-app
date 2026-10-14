import { expect, it } from 'vitest'
import { lerLocalizacaoAuditoria, normalizarLocalizacaoAuditoria } from './localizacao-auditoria'
const ponto={lat:-25.665061,lng:-49.298785}
it('mantém histórico antigo como não registrado',()=>expect(lerLocalizacaoAuditoria(undefined)).toBeNull())
it('entrada tradicional exige método explícito, sem inferir ausência de metadado',()=>{
  expect(normalizarLocalizacaoAuditoria(undefined,ponto)).toBeNull()
  expect(normalizarLocalizacaoAuditoria({metodo:'endereco-tradicional'},ponto)).toMatchObject({metodo:'endereco-tradicional',...ponto})
})
it('grava link original e ponto efetivo, sem aceitar coordenadas divergentes do metadado',()=>{
  const linkOriginal='https://maps.app.goo.gl/aF2ERzRMNpZomkdr9'
  expect(normalizarLocalizacaoAuditoria({metodo:'google-maps-link',linkOriginal,nome:'Casa Nostra',lat:0,lng:0},ponto)).toMatchObject({...ponto,linkOriginal,nome:'Casa Nostra'})
})
it('coordenadas diretas não inventam link histórico',()=>expect(normalizarLocalizacaoAuditoria({metodo:'coordenadas-diretas'},ponto)?.linkOriginal).toBeUndefined())
it.each(['javascript:alert(1)','https://evil.example','https://google.com.evil.example/maps'])('link inseguro não vira href: %s',(linkOriginal)=>{
  expect(normalizarLocalizacaoAuditoria({metodo:'google-maps-link',linkOriginal},ponto)?.linkOriginal).toBeUndefined()
})
