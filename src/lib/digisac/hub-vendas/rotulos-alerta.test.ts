import { describe, expect, it } from 'vitest'
import { rotuloStatusAlertaHubVendas, rotuloTipoAlertaHubVendas, tomStatusAlertaHubVendas } from './rotulos-alerta'

describe('rotulos de alerta Hub/Vendas', () => {
  it('traduz tipos conhecidos sem alterar o identificador de origem', () => {
    expect(rotuloTipoAlertaHubVendas('resumo_diario')).toBe('Resumo diário')
    expect(rotuloTipoAlertaHubVendas('teste_manual')).toBe('Alerta de teste')
    expect(rotuloTipoAlertaHubVendas('cron_falhou')).toBe('Rotina automática falhou')
    expect(rotuloTipoAlertaHubVendas('erro_envio')).toBe('Erro de envio')
  })

  it('mostra um tipo desconhecido de forma legivel, sem esconder o nome', () => {
    expect(rotuloTipoAlertaHubVendas('evento_novo_loja')).toBe('Evento novo loja')
  })

  it('traduz os status que o banco realmente grava', () => {
    expect(rotuloStatusAlertaHubVendas('enviado')).toBe('Enviado')
    expect(rotuloStatusAlertaHubVendas('falha')).toBe('Falha')
    expect(tomStatusAlertaHubVendas('enviado')).toBe('success')
    expect(tomStatusAlertaHubVendas('falha')).toBe('danger')
  })

  it('nao trata deduplicado como status previsto da tela', () => {
    expect(rotuloStatusAlertaHubVendas('deduplicado')).toBe('Deduplicado')
    expect(tomStatusAlertaHubVendas('deduplicado')).toBe('neutral')
  })
})
