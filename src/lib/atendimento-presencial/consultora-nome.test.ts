import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FICHA_CONSULTORA_NOME_MAX_CHARS,
  normalizarNomeConsultora,
  validarFichaDadosRascunho,
  validarFichaParaConclusao,
  validarNomeConsultora,
  type FichaDadosRascunho,
} from './ficha-schema'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260718100000_atendimento_presencial_consultora_nome.sql'
)

function fichaValida(consultoraNome?: string): FichaDadosRascunho {
  return {
    consultoraNome,
    criancas: [{ id: 'cri-1', situacao: 'gestacao' }],
    departamentos: ['p_pesada'],
    produtosInteresse: [],
    motivosResultado: ['qualidade_produto'],
    resultadoAtendimento: 'sim',
    etapaAtual: 'revisao',
  }
}

describe('normalizarNomeConsultora', () => {
  it('normaliza espacos duplicados', () => {
    expect(normalizarNomeConsultora('Ana    Clara')).toBe('Ana Clara')
  })

  it('faz trim', () => {
    expect(normalizarNomeConsultora('  Ana Clara  ')).toBe('Ana Clara')
  })

  it('limita a 30 caracteres', () => {
    expect(normalizarNomeConsultora('A'.repeat(40)).length).toBe(30)
  })

  it('retorna string vazia para nao-string', () => {
    expect(normalizarNomeConsultora(123)).toBe('')
    expect(normalizarNomeConsultora(null)).toBe('')
    expect(normalizarNomeConsultora(undefined)).toBe('')
  })
})

describe('validarNomeConsultora', () => {
  it('aceita Ana Clara', () => {
    expect(validarNomeConsultora('Ana Clara')).toBe(true)
  })

  it('aceita nome com acento: Vitória', () => {
    expect(validarNomeConsultora('Vitória')).toBe(true)
  })

  it('aceita nome com 30 caracteres', () => {
    expect(validarNomeConsultora('A'.repeat(30))).toBe(true)
  })

  it('rejeita nome com 31 caracteres', () => {
    expect(validarNomeConsultora('A'.repeat(31))).toBe(false)
  })

  it('rejeita nome com numeros: Sharon123', () => {
    expect(validarNomeConsultora('Sharon123')).toBe(false)
  })

  it('rejeita e-mail: posvenda@lebebe.com.br', () => {
    expect(validarNomeConsultora('posvenda@lebebe.com.br')).toBe(false)
  })

  it('rejeita nome com hifen: Ana-Clara', () => {
    expect(validarNomeConsultora('Ana-Clara')).toBe(false)
  })

  it('rejeita nome com simbolo: Maria!', () => {
    expect(validarNomeConsultora('Maria!')).toBe(false)
  })

  it('rejeita valor vazio', () => {
    expect(validarNomeConsultora('')).toBe(false)
    expect(validarNomeConsultora('   ')).toBe(false)
  })

  it('rejeita nome com apenas 1 caractere', () => {
    expect(validarNomeConsultora('A')).toBe(false)
  })
})

describe('validarFichaParaConclusao - consultoraNome', () => {
  it('rejeita conclusao sem consultoraNome', () => {
    const resultado = validarFichaParaConclusao({
      ficha: fichaValida(undefined),
      clienteId: 'cliente-1',
      numeroLancamento: 123,
    })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.field).toBe('consultoraNome')
    }
  })

  it('rejeita conclusao com consultoraNome com numeros', () => {
    const resultado = validarFichaParaConclusao({
      ficha: fichaValida('Sharon123'),
      clienteId: 'cliente-1',
      numeroLancamento: 123,
    })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.field).toBe('consultoraNome')
    }
  })

  it('aceita conclusao com consultoraNome valido', () => {
    const resultado = validarFichaParaConclusao({
      ficha: fichaValida('Ana Clara'),
      clienteId: 'cliente-1',
      numeroLancamento: 123,
    })
    expect(resultado.ok).toBe(true)
  })
})

describe('validarFichaDadosRascunho - consultoraNome', () => {
  it('normaliza espacos duplicados no rascunho', () => {
    const resultado = validarFichaDadosRascunho({
      ...fichaValida('Ana    Clara'),
    })
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.dados.consultoraNome).toBe('Ana Clara')
    }
  })

  it('aceita rascunho sem consultoraNome (nullable)', () => {
    const resultado = validarFichaDadosRascunho({
      criancas: [],
      departamentos: ['p_pesada'],
      produtosInteresse: [],
      motivosResultado: ['qualidade_produto'],
      resultadoAtendimento: 'nao',
      etapaAtual: 'ficha',
    })
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.dados.consultoraNome).toBeUndefined()
    }
  })
})

describe('migration consultora_nome - validacao SQL', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('constraint verifica tamanho 2-30', () => {
    expect(sql).toContain('char_length(btrim(consultora_nome)) between 2 and 30')
  })

  it('constraint aplica regex de letras e espacos', () => {
    expect(sql).toContain("btrim(consultora_nome) ~ '^[A-Za-z")
  })

  it('normalizar_payload_ficha usa regexp_replace para espacos duplicados', () => {
    expect(sql).toContain("regexp_replace(btrim(p_dados->>'consultoraNome'), '[[:space:]]+', ' ', 'g')")
  })

  it('normalizar_payload_ficha valida min 2 e max 30', () => {
    expect(sql).toContain('char_length(v_consultora_nome) < 2 or char_length(v_consultora_nome) > 30')
  })

  it('normalizar_payload_ficha valida regex', () => {
    expect(sql).toContain("v_consultora_nome !~ '^[A-Za-z")
  })

  it('concluir RPC normaliza com regexp_replace', () => {
    expect(sql).toContain("regexp_replace(btrim(coalesce(p_consultora_nome, v_payload->>'consultoraNome')), '[[:space:]]+', ' ', 'g')")
  })

  it('concluir RPC valida max 30', () => {
    expect(sql).toContain('char_length(v_consultora_nome) > 30')
  })

  it('concluir RPC valida regex', () => {
    expect(sql).toContain("v_consultora_nome !~ '^[A-Za-z")
  })

  it('editar_concluido RPC tambem valida max 30 e regex', () => {
    const editarIdx = sql.indexOf('atendimento_presencial_editar_concluido')
    const editarSection = sql.slice(editarIdx)
    expect(editarSection).toContain('char_length(v_consultora_nome) > 30')
    expect(editarSection).toContain("v_consultora_nome !~ '^[A-Za-z")
  })

  it('nao contem limite 120 para consultora_nome', () => {
    const consultoraNomeMatches = sql.match(/consultora_nome[^;]*?> 120/g)
    expect(consultoraNomeMatches).toBeNull()
  })
})

describe('FICHA_CONSULTORA_NOME_MAX_CHARS', () => {
  it('e igual a 30', () => {
    expect(FICHA_CONSULTORA_NOME_MAX_CHARS).toBe(30)
  })
})
