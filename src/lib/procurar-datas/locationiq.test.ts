import { afterEach, describe, expect, it, vi } from 'vitest'
import { buscarEnderecoLocationIq } from './locationiq'

const FORM_NICOLA = {
  logradouro: 'Rua Nicola Pelanda',
  numero: '100',
  bairro: 'Umbará',
  cidade: 'Curitiba',
  uf: 'PR',
}

const FORM_FORTALEZA = {
  logradouro: 'Rua Fortaleza',
  numero: '1210',
  bairro: 'Hauer',
  cidade: 'Curitiba',
  uf: 'PR',
}

const FORM_CATARINA = {
  logradouro: 'Rua Catarina Goossen',
  numero: '200',
  bairro: 'Xaxim',
  cidade: 'Curitiba',
  uf: 'PR',
  cep: '81830-020',
}

describe('buscarEnderecoLocationIq', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── Casos do fluxo base ──────────────────────────────────────────────────

  it('retorna candidato valido quando house_number e logradouro batem', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.478',
          lon: '-49.252',
          display_name: 'Rua Fortaleza, 1210, Hauer, Curitiba, Parana, Brasil',
          importance: 0.72,
          address: {
            road: 'Rua Fortaleza',
            house_number: '1210',
            suburb: 'Hauer',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81610-000',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_FORTALEZA, { fetchFn })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.resultado.provider).toBe('locationiq')
      expect(result.resultado.lat).toBe(-25.478)
      expect(result.resultado.lng).toBe(-49.252)
      expect(result.resultado.cep).toBe('81610000')
      // house_number não é mascarado — deve refletir o que o provider retornou
      const addr1 = result.resultado.address as { house_number?: string } | undefined
      expect(addr1?.house_number).toBe('1210')
    }
  })

  it('usa chave reserva quando a primaria falha com 429', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'primary-key')
    vi.stubEnv('LOCATIONIQ_API_KEY_RESERVA', 'reserve-key')

    const eventos: string[] = []
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: '-25.478',
            lon: '-49.252',
            display_name: 'Rua Fortaleza, 1210, Hauer, Curitiba, Parana, Brasil',
            address: {
              road: 'Rua Fortaleza',
              house_number: '1210',
              city: 'Curitiba',
              state: 'Parana',
              state_code: 'PR',
            },
          },
        ],
      }) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_FORTALEZA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('success')
    expect(eventos).toContain('locationiq_reserve_key_used')
  })

  it('rejeita candidato com cidade divergente', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.478',
          lon: '-49.252',
          display_name: 'Rua Fortaleza, 1210, Pinhais, Parana, Brasil',
          address: {
            road: 'Rua Fortaleza',
            house_number: '1210',
            city: 'Pinhais',
            state: 'Parana',
            state_code: 'PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_FORTALEZA, { fetchFn })

    expect(result).toEqual({ status: 'failed', motivo: 'sem_resultado_valido' })
  })

  it('aceita rua urbana sem house_number quando CEP, logradouro, cidade e UF batem', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua Catarina Goosen, Casa, Xaxim, Curitiba, Parana, Brasil',
          importance: 0.25,
          address: {
            road: 'Rua Catarina Goosen',
            suburb: 'Xaxim',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('success')
    expect(eventos).not.toContain('locationiq_rejected_no_house_number')
    if (result.status === 'success') {
      expect(result.resultado.match).toBe('aproximado_confiavel')
      expect(result.resultado.numeroOk).toBe(false)
      expect(result.resultado.numeroObrigatorio).toBe(false)
      expect(result.resultado.motivo).toBe('aceito_sem_numero_confirmado')
      const addr = result.resultado.address as { house_number?: string } | undefined
      expect(addr?.house_number).toBe('')
    }
  })

  it('aceita rua urbana sem house_number quando o formulario nao tem CEP mas o provider retorna postcode', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51142',
          lon: '-49.26940',
          display_name: 'Rua Georgino Poli Ribeiro, Xaxim, Curitiba, Parana, Brasil',
          importance: 0.18,
          address: {
            road: 'Rua Georgino Poli Ribeiro',
            suburb: 'Xaxim',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(
      {
        logradouro: 'Rua Georgino Pioli Ribeiro',
        numero: '200',
        bairro: 'Xaxim',
        cidade: 'Curitiba',
        uf: 'PR',
      },
      {
        fetchFn,
        onEvent: (event) => eventos.push(event.tipo),
      }
    )

    expect(result.status).toBe('success')
    expect(eventos).not.toContain('locationiq_rejected_no_house_number')
    if (result.status === 'success') {
      expect(result.resultado.match).toBe('aproximado_confiavel')
      expect(result.resultado.numeroOk).toBe(false)
      expect(result.resultado.numeroObrigatorio).toBe(false)
      expect(result.resultado.motivo).toBe('aceito_sem_numero_confirmado')
      expect(result.resultado.cep).toBe('81830020')
    }
  })

  it('rejeita candidato sem house_number quando o logradouro diverge mesmo com CEP', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua das Flores, Xaxim, Curitiba, Parana, Brasil',
          importance: 0.25,
          address: {
            road: 'Rua das Flores',
            suburb: 'Xaxim',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_logradouro_mismatch')
  })

  it('rejeita candidato sem house_number quando a cidade diverge mesmo com CEP e logradouro', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua Catarina Goosen, Xaxim, Pinhais, Parana, Brasil',
          importance: 0.25,
          address: {
            road: 'Rua Catarina Goosen',
            suburb: 'Xaxim',
            city: 'Pinhais',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_city_or_uf_mismatch')
  })

  it('rejeita candidato sem house_number quando a UF diverge mesmo com CEP e logradouro', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua Catarina Goosen, Xaxim, Curitiba, Santa Catarina, Brasil',
          importance: 0.25,
          address: {
            road: 'Rua Catarina Goosen',
            suburb: 'Xaxim',
            city: 'Curitiba',
            state: 'Santa Catarina',
            state_code: 'BR-SC',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_city_or_uf_mismatch')
  })

  it('nao bloqueia bairro divergente quando CEP, logradouro, cidade e UF batem', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua Catarina Goosen, Casa, Xaxim, Curitiba, Parana, Brasil',
          importance: 0.25,
          address: {
            road: 'Rua Catarina Goosen',
            suburb: 'Casa',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, { fetchFn })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.resultado.match).toBe('aproximado_confiavel')
    }
  })

  it('nao bloqueia importance baixa quando CEP, logradouro, cidade e UF batem', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua Catarina Goosen, Xaxim, Curitiba, Parana, Brasil',
          importance: 0.053,
          address: {
            road: 'Rua Catarina Goosen',
            suburb: 'Xaxim',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, { fetchFn })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.resultado.match).toBe('aproximado_confiavel')
    }
  })

  it('aceita como aproximado confiavel com bairro divergente, importance baixa e sem house_number', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51126',
          lon: '-49.26826',
          display_name: 'Rua Doutora Cenira Ribeiro, Boqueirao, Curitiba, Parana, Brasil',
          importance: 0.053,
          address: {
            road: 'Rua Doutora Cenira Ribeiro',
            suburb: 'Boqueirao',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(
      {
        logradouro: 'Rua Doutora Cenira Ribeiro',
        numero: '200',
        bairro: 'Xaxim',
        cidade: 'Curitiba',
        uf: 'PR',
        cep: '81830-020',
      },
      { fetchFn }
    )

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.resultado.match).toBe('aproximado_confiavel')
      expect(result.resultado.numeroObrigatorio).toBe(false)
    }
  })

  it('rejeita resultado sem road mesmo quando display_name contem o logradouro', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.51261',
          lon: '-49.27019',
          display_name: 'Rua Catarina Goosen, Xaxim, Curitiba, Parana, Brasil',
          importance: 0.25,
          address: {
            suburb: 'Xaxim',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81830-020',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_CATARINA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_logradouro_mismatch')
  })

  // ── Caso 1: centróide sem house_number e sem postcode ────────────────────

  it('caso 1 — rejeita centroides sem house_number e sem postcode', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.56829',
          lon: '-49.28419',
          // display_name real retornado pelo LocationIQ — não contém número
          display_name:
            'Rua Nicola Pelanda, Umbará, Curitiba, Região Geográfica Imediata de Curitiba, Paraná, Brasil',
          importance: 0.4,
          address: {
            road: 'Rua Nicola Pelanda',
            // house_number ausente — centróide da rua
            suburb: 'Umbará',
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_NICOLA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_no_house_number')
    expect(eventos).toContain('locationiq_no_valid_candidate')
    // Garantir que house_number não foi preenchido artificialmente com form.numero
    expect(result.status === 'success').toBe(false)
  })

  // ── Caso 2: house_number correto — deve aceitar ──────────────────────────

  it('caso 2 — aceita quando house_number bate com form.numero', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.56900',
          lon: '-49.28500',
          display_name: 'Rua Nicola Pelanda, 100, Umbará, Curitiba, Paraná, Brasil',
          importance: 0.75,
          address: {
            road: 'Rua Nicola Pelanda',
            house_number: '100',
            suburb: 'Umbará',
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_NICOLA, { fetchFn })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      const addr2 = result.resultado.address as { house_number?: string } | undefined
      expect(addr2?.house_number).toBe('100')
    }
  })

  // ── Caso 3: sem house_number mas display comprova número e logradouro ────

  it('caso 3 — aceita quando display_name comprova numero e logradouro sem house_number', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.56900',
          lon: '-49.28500',
          // display contém "100" e "Nicola" — comprova ambos
          display_name: 'Rua Nicola Pelanda, 100, Umbará, Curitiba, PR, Brasil',
          importance: 0.7,
          address: {
            // house_number ausente
            road: 'Rua Nicola Pelanda',
            suburb: 'Umbará',
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_NICOLA, { fetchFn })

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      // house_number deve ficar vazio — não mascarado com form.numero
      const addr3 = result.resultado.address as { house_number?: string } | undefined
      expect(addr3?.house_number).toBe('')
    }
  })

  // ── Caso 4: número divergente — deve rejeitar ────────────────────────────

  it('caso 4 — rejeita quando house_number difere do form.numero', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.56900',
          lon: '-49.28500',
          display_name: 'Rua Nicola Pelanda, 200, Umbará, Curitiba, Paraná, Brasil',
          address: {
            road: 'Rua Nicola Pelanda',
            house_number: '200', // form pede 100
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_NICOLA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_no_house_number')
  })

  // ── Caso 5: logradouro divergente — deve rejeitar ────────────────────────

  it('caso 5 — rejeita quando logradouro do resultado diverge do form', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.478',
          lon: '-49.252',
          // display e road indicam outra rua
          display_name: 'Rua das Flores, 100, Hauer, Curitiba, Paraná, Brasil',
          address: {
            road: 'Rua das Flores',
            house_number: '100',
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_NICOLA, {
      fetchFn,
      onEvent: (event) => eventos.push(event.tipo),
    })

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_logradouro_mismatch')
  })

  // ── Caso 6: CEP divergente — deve rejeitar ──────────────────────────────

  it('caso 6 — rejeita quando CEP do formulario e candidato divergem nos primeiros 5 digitos', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.478',
          lon: '-49.252',
          display_name: 'Rua Fortaleza, 1210, Hauer, Curitiba, Paraná, Brasil',
          address: {
            road: 'Rua Fortaleza',
            house_number: '1210',
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
            postcode: '80010-000', // região 80010 — diverge de 81610
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(
      { ...FORM_FORTALEZA, cep: '81610-000' },
      {
        fetchFn,
        onEvent: (event) => eventos.push(event.tipo),
      }
    )

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_cep_mismatch')
  })

  it('prioriza cep_mismatch quando candidato sem house_number tambem tem CEP divergente', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const eventos: string[] = []
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.478',
          lon: '-49.252',
          display_name: 'Rua Tenente Francisco Ferreira de Souza, Hauer, Curitiba, Parana, Brasil',
          address: {
            road: 'Rua Tenente Francisco Ferreira de Souza',
            suburb: 'Hauer',
            city: 'Curitiba',
            state: 'Parana',
            state_code: 'BR-PR',
            postcode: '81670-000',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(
      {
        logradouro: 'Rua Tenente Francisco Ferreira de Souza',
        numero: '20',
        bairro: 'Hauer',
        cidade: 'Curitiba',
        uf: 'PR',
        cep: '81630-010',
      },
      {
        fetchFn,
        onEvent: (event) => eventos.push(event.tipo),
      }
    )

    expect(result.status).toBe('failed')
    expect(eventos).toContain('locationiq_rejected_cep_mismatch')
    expect(eventos).not.toContain('locationiq_rejected_no_house_number')
  })

  // ── Caso 7: resultado rejeitado não chega como EnderecoValidado ──────────

  it('caso 7 — resultado generico rejeitado retorna failed e nunca produz EnderecoValidado', async () => {
    vi.stubEnv('LOCATIONIQ_API_KEY', 'test-key')

    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          lat: '-25.56829',
          lon: '-49.28419',
          display_name: 'Rua Nicola Pelanda, Umbará, Curitiba, Paraná, Brasil',
          address: {
            road: 'Rua Nicola Pelanda',
            // sem house_number, sem número no display
            city: 'Curitiba',
            state: 'Paraná',
            state_code: 'BR-PR',
          },
        },
      ],
    })) as unknown as typeof fetch

    const result = await buscarEnderecoLocationIq(FORM_NICOLA, { fetchFn })

    // Resultado deve ser failed — não pode ser salvo no geo_cache
    expect(result.status).toBe('failed')
    // Type guard: status === 'success' implica resultado com ok:true
    if (result.status === 'success') {
      // Este branch não deve ser alcançado
      expect(result.resultado.ok).toBe(false)
    }
  })
})
