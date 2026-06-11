// ─────────────────────────────────────────────────────────────────────────────
// motor/frete.test.ts  —  Testes unitários para cálculo de frete
//
// Cobre os 11 cenários obrigatórios:
//   1. Semana até 10 km (faixa fixa)
//   2. Sábado até 10 km (faixa fixa)
//   3. Distância entre 10 km e 25 km (faixa viagem)
//   4. Distância acima de 25 km (faixa longa)
//   5. Distância de não viagem (faixa naoViagem)
//   6. Área rural (+R$100)
//   7. Condomínio (+adicional)
//   8. Arredondamento para dezena
//   9. Adicional especial
//  10. Adicional premium
//  11. Hora marcada
//
// Todos os testes validam a paridade com o pipeline do Apps Script:
//   calcularFrete() → aplicarAjusteFrete() → + adicional por tipo
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import {
  calcularFreteBase,
  aplicarAjusteGlobal,
  calcularFrete,
  ceilDezena,
  fmtMoneyBR,
  identificarFaixa,
} from './frete'
import type { FreteParams } from './types'

// ─── Fixture: parâmetros realistas ───────────────────────────────────────────
// Valores plausíveis para permitir verificação manual da matemática.
// Não são valores reais de produção.

const PARAMS: FreteParams = {
  kmMaxViagem: 80,              // acima disso: "Não fazemos"
  kmMaxValorFixo: 10,           // até 10 km: preço base
  kmMaxLongaCidade: 25,         // 10-25 km: faixa viagem
  kmMaxNaoViagem: 50,           // 25-50 km: faixa longa / 50-80: não viagem
  valorSemanaAte10km: 130,      // base semana
  valorSabadoAte10km: 200,      // base sábado
  fatorMultiplicadorKmViagem: 8,// R$/km na viagem
  multiplicadorKmNaoViagem: 12, // R$/km não viagem
  valorDiaApos25kmSemana: 50,   // adicional semana após 25km
  valorDiaApos25kmSabado: 80,   // adicional sábado após 25km
  precoCondominioAdicional: 30, // adicional condomínio
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe('ceilDezena', () => {
  it('arredonda 131 para 140', () => expect(ceilDezena(131)).toBe(140))
  it('arredonda 130 para 130 (exato)', () => expect(ceilDezena(130)).toBe(130))
  it('arredonda 121 para 130', () => expect(ceilDezena(121)).toBe(130))
  it('arredonda 0 para 0', () => expect(ceilDezena(0)).toBe(0))
  it('arredonda 1 para 10', () => expect(ceilDezena(1)).toBe(10))
})

describe('fmtMoneyBR', () => {
  it('formata 250 como "R$ 250"', () => expect(fmtMoneyBR(250)).toBe('R$ 250'))
  it('formata 1250 com separador de milhar', () => expect(fmtMoneyBR(1250)).toBe('R$ 1.250'))
  it('formata 110 como "R$ 110"', () => expect(fmtMoneyBR(110)).toBe('R$ 110'))
})

describe('identificarFaixa', () => {
  it('retorna "fixo" para 5 km', () => expect(identificarFaixa(5, PARAMS)).toBe('fixo'))
  it('retorna "fixo" para 10 km (limite)', () => expect(identificarFaixa(10, PARAMS)).toBe('fixo'))
  it('retorna "viagem" para 15 km', () => expect(identificarFaixa(15, PARAMS)).toBe('viagem'))
  it('retorna "viagem" para 25 km (limite)', () => expect(identificarFaixa(25, PARAMS)).toBe('viagem'))
  it('retorna "longa" para 30 km', () => expect(identificarFaixa(30, PARAMS)).toBe('longa'))
  it('retorna "longa" para 50 km (limite)', () => expect(identificarFaixa(50, PARAMS)).toBe('longa'))
  it('retorna "naoViagem" para 60 km', () => expect(identificarFaixa(60, PARAMS)).toBe('naoViagem'))
  it('retorna "recusado" para 81 km', () => expect(identificarFaixa(81, PARAMS)).toBe('recusado'))
})

// ─── calcularFreteBase (antes do ajuste global ×1.2) ─────────────────────────

describe('calcularFreteBase', () => {
  it('retorna null quando distância excede limite', () => {
    expect(calcularFreteBase(81, false, false, false, PARAMS)).toBeNull()
  })

  it('semana até 10 km → base = 130, ceil = 130', () => {
    // Faixa fixo: base semana = 130 → ceil(130/10)*10 = 130
    expect(calcularFreteBase(5, false, false, false, PARAMS)).toBe(130)
  })

  it('sábado até 10 km → base = 200, ceil = 200', () => {
    expect(calcularFreteBase(8, true, false, false, PARAMS)).toBe(200)
  })

  it('semana 15 km → faixa viagem', () => {
    // base(130) + (15-10)*8 = 130 + 40 = 170 → ceil = 170
    expect(calcularFreteBase(15, false, false, false, PARAMS)).toBe(170)
  })

  it('semana 20 km → faixa viagem', () => {
    // base(130) + (20-10)*8 = 130 + 80 = 210 → ceil = 210
    expect(calcularFreteBase(20, false, false, false, PARAMS)).toBe(210)
  })

  it('semana 30 km → faixa longa', () => {
    // base(130) + add25Semana(50) + (30-25)*8 = 130 + 50 + 40 = 220 → ceil = 220
    expect(calcularFreteBase(30, false, false, false, PARAMS)).toBe(220)
  })

  it('sábado 30 km → faixa longa com add25 sábado', () => {
    // base(200) + add25Sábado(80) + (30-25)*8 = 200 + 80 + 40 = 320 → ceil = 320
    expect(calcularFreteBase(30, true, false, false, PARAMS)).toBe(320)
  })

  it('semana 60 km → faixa não viagem', () => {
    // base(130) + add25Semana(50) + (60-25)*12 = 130 + 50 + 420 = 600 → ceil = 600
    expect(calcularFreteBase(60, false, false, false, PARAMS)).toBe(600)
  })

  it('rural adiciona +100 antes do ceil', () => {
    // base(130) + 100 = 230 → ceil = 230
    expect(calcularFreteBase(5, false, true, false, PARAMS)).toBe(230)
  })

  it('condomínio adiciona +30 antes do ceil', () => {
    // base(130) + 30 = 160 → ceil = 160
    expect(calcularFreteBase(5, false, false, true, PARAMS)).toBe(160)
  })

  it('rural + condomínio juntos', () => {
    // base(130) + 100 + 30 = 260 → ceil = 260
    expect(calcularFreteBase(5, false, true, true, PARAMS)).toBe(260)
  })

  it('arredondamento quando preço não é múltiplo de 10', () => {
    // base(130) + (13-10)*8 = 130 + 24 = 154 → ceil(154/10)*10 = 160
    expect(calcularFreteBase(13, false, false, false, PARAMS)).toBe(160)
  })
})

// ─── aplicarAjusteGlobal (×1.2, ceil dezena, min R$110) ──────────────────────

describe('aplicarAjusteGlobal', () => {
  it('aplica ×1.2 e ceil dezena', () => {
    // 130 × 1.2 = 156 → ceil = 160
    expect(aplicarAjusteGlobal(130)).toBe(160)
  })

  it('aplica ×1.2 e arredonda quando exato', () => {
    // 200 × 1.2 = 240 → ceil = 240
    expect(aplicarAjusteGlobal(200)).toBe(240)
  })

  it('garante mínimo R$110', () => {
    // 50 × 1.2 = 60 → ceil = 60 → min 110 = 110
    expect(aplicarAjusteGlobal(50)).toBe(110)
  })

  it('mínimo não se aplica quando valor já é alto', () => {
    // 170 × 1.2 = 204 → ceil = 210 > 110
    expect(aplicarAjusteGlobal(170)).toBe(210)
  })

  it('valor zero → mínimo R$110', () => {
    // 0 × 1.2 = 0 → ceil = 0 → min 110 = 110
    expect(aplicarAjusteGlobal(0)).toBe(110)
  })
})

// ─── calcularFrete (pipeline completo) ───────────────────────────────────────

describe('calcularFrete', () => {
  // 1. Semana até 10 km
  it('1. semana até 10 km', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130 → ajuste: 130×1.2=156 → ceil=160 → >110 → 160
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(160)
    expect(r.faixaAplicada).toBe('fixo')
    expect(r.tipo).toBe('normal')
    expect(r.valorFormatado).toBe('R$ 160')
  })

  // 2. Sábado até 10 km
  it('2. sábado até 10 km', () => {
    const r = calcularFrete({
      distKm: 8,
      isSabado: true,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 200 → ajuste: 200×1.2=240 → ceil=240 → 240
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(240)
    expect(r.faixaAplicada).toBe('fixo')
  })

  // 3. Distância entre 10 km e 25 km (faixa viagem)
  it('3. distância entre 10 e 25 km', () => {
    const r = calcularFrete({
      distKm: 18,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130 + (18-10)*8 = 130+64 = 194 → ceil=200
    // Ajuste: 200×1.2=240 → ceil=240 → 240
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(240)
    expect(r.faixaAplicada).toBe('viagem')
  })

  // 4. Distância acima de 25 km (faixa longa)
  it('4. distância acima de 25 km (faixa longa)', () => {
    const r = calcularFrete({
      distKm: 35,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130 + add25Semana(50) + (35-25)*8 = 130+50+80 = 260 → ceil=260
    // Ajuste: 260×1.2=312 → ceil=320 → 320
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(320)
    expect(r.faixaAplicada).toBe('longa')
  })

  // 5. Distância de não viagem (50-80 km)
  it('5. distância de não viagem', () => {
    const r = calcularFrete({
      distKm: 60,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130 + add25Semana(50) + (60-25)*12 = 130+50+420 = 600 → ceil=600
    // Ajuste: 600×1.2=720 → ceil=720 → 720
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(720)
    expect(r.faixaAplicada).toBe('naoViagem')
  })

  // 6. Área rural (+R$100)
  it('6. área rural adiciona R$100', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: true,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130+100=230 → ceil=230
    // Ajuste: 230×1.2=276 → ceil=280 → 280
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(280)
  })

  // 7. Condomínio (+adicional)
  it('7. condomínio adiciona precoCondominioAdicional', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: true,
      params: PARAMS,
    })
    // Base: 130+30=160 → ceil=160
    // Ajuste: 160×1.2=192 → ceil=200 → 200
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(200)
  })

  // 8. Arredondamento para dezena (distância que gera preço não-múltiplo)
  it('8. arredondamento para dezena', () => {
    const r = calcularFrete({
      distKm: 13,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130 + (13-10)*8 = 130+24 = 154 → ceil=160
    // Ajuste: 160×1.2=192 → ceil=200 → 200
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(200)
    // Confirma que ambos os arredondamentos (base + ajuste) funcionam
  })

  // 9. Adicional especial
  it('9. adicional especial', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
      tipo: 'especial',
      valorAdicionalEspecial: 100,
    })
    // Base: 130 → ceil=130 → ajuste: 130×1.2=156 → ceil=160
    // + especial: 160+100 = 260
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(260)
    expect(r.tipo).toBe('especial')
  })

  // 10. Adicional premium
  it('10. adicional premium', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
      tipo: 'premium',
      valorAdicionalPremium: 150,
    })
    // Base: 130 → ajuste: 160 → + premium: 160+150 = 310
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(310)
    expect(r.tipo).toBe('premium')
  })

  // 11. Hora marcada
  it('11. hora marcada', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
      tipo: 'hora-marcada',
      horaMarcadaValorAdicional: 80,
    })
    // Base: 130 → ajuste: 160 → + hora-marcada: 160+80 = 240
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(240)
    expect(r.tipo).toBe('hora-marcada')
  })

  // ─── Cenários adicionais de paridade ───────────────────────────────────────

  it('distância acima do limite máximo → recusado', () => {
    const r = calcularFrete({
      distKm: 81,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    expect(r.ok).toBe(false)
    expect(r.valorFrete).toBe(0)
    expect(r.valorFormatado).toBe('Não fazemos')
    expect(r.faixaAplicada).toBe('recusado')
  })

  it('sábado com faixa longa usa add25 sábado', () => {
    const r = calcularFrete({
      distKm: 30,
      isSabado: true,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 200 + add25Sábado(80) + (30-25)*8 = 200+80+40 = 320 → ceil=320
    // Ajuste: 320×1.2=384 → ceil=390 → 390
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(390)
    expect(r.faixaAplicada).toBe('longa')
  })

  it('rural + condomínio + tipo especial combinados', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: true,
      isCondominio: true,
      params: PARAMS,
      tipo: 'especial',
      valorAdicionalEspecial: 100,
    })
    // Base: 130+100+30=260 → ceil=260
    // Ajuste: 260×1.2=312 → ceil=320
    // + especial: 320+100=420
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(420)
    expect(r.tipo).toBe('especial')
  })

  it('distância zero → preço base com ajuste mínimo', () => {
    const r = calcularFrete({
      distKm: 0,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    // Base: 130 → ceil=130
    // Ajuste: 130×1.2=156 → ceil=160 → >110 → 160
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(160)
    expect(r.faixaAplicada).toBe('fixo')
  })

  it('tipo default é normal quando não especificado', () => {
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    expect(r.tipo).toBe('normal')
  })

  it('mínimo R$110 aplicado com base muito baixa', () => {
    const paramsBarato: FreteParams = {
      ...PARAMS,
      valorSemanaAte10km: 20,
    }
    const r = calcularFrete({
      distKm: 5,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: paramsBarato,
    })
    // Base: 20 → ceil=20
    // Ajuste: 20×1.2=24 → ceil=30 → min 110 = 110
    expect(r.ok).toBe(true)
    expect(r.valorFrete).toBe(110)
  })

  it('formatação monetária no resultado', () => {
    const r = calcularFrete({
      distKm: 60,
      isSabado: false,
      isRural: false,
      isCondominio: false,
      params: PARAMS,
    })
    expect(r.valorFormatado).toBe('R$ 720')
  })
})
