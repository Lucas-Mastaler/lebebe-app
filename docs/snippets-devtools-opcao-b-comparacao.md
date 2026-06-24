# Snippets DevTools — Opção B: Comparação Legado × V2 com Payload Real

> **Versão:** 2026-06-18 — Atualizado para usar `disponibilidade-real`
>
> Para validar a Opção B, execute B0 → B1 → B2 → B3/B4 na sequência.
> A Opção B só estará concluída quando `keysEmComum > 0`.

## B0 — Preparação: Carregar fixture legado real

```javascript
// 1. Carregar fixture legado real (caso-normal-simples-2026-06-12.json)
const fixtureResponse = await fetch('/docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json');
const fixtureLegado = await fixtureResponse.json();

// 2. Extrair candidatos do payload legado
const candidatosLegadoRaw = fixtureLegado.responseDone.body.progress.payload.candidates;

// 3. Adaptar para formato do comparador (simula o adaptador)
// NOTA: Usar fonte 'disponibilidade-real' para alinhar com a v2 real
const candidatosLegado = candidatosLegadoRaw.map((c, idx) => ({
  dataISO: c.dateISO.split('T')[0],
  equipe: c.team,
  tipo: c.tipo,
  elegivel: true,
  horaMarcada: !!(c.avisoHoraMarcada && c.avisoHoraMarcada.trim()),
  elegivelHoraMarcada: !!(c.avisoHoraMarcada && c.avisoHoraMarcada.trim()),
  kmAdicionalNaRotaM: null,
  slotTemPontos: null,
  limiteBaseM: null,
  limiteEspecialM: null,
  limitePremiumM: null,
  motivos: null,
  ordem: c.rank || idx + 1,
  comparacaoKey: `${c.dateISO.split('T')[0]}::${c.team}::disponibilidade-real::${c.rank || idx + 1}`
}));

console.log('B0: Candidatos legado adaptados:', candidatosLegado.length);
console.log('B0: Primeiro candidato:', candidatosLegado[0]);
console.log('B0: Chaves geradas:', candidatosLegado.map(c => c.comparacaoKey));
```

## B1 — Comparação com candidatos v2 reais (disponibilidade real)

```javascript
// 1. Chamar rota de diagnóstico com comparação usando disponibilidade real
// NOTA: Agora usando usarDisponibilidadeRealDiagnostica: true
// e fonteV2ComparacaoDiagnostico: 'disponibilidade-real'
const response = await fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // Request base (mesmo do legado)
    cep: fixtureLegado.request.payload.cep,
    dataInicial: fixtureLegado.request.payload.dataInicial,
    tempoNecessario: fixtureLegado.request.payload.tempoNecessario,
    destLat: fixtureLegado.request.payload.lat,
    destLng: fixtureLegado.request.payload.lng,

    // Flags de diagnóstico — NOVO: usar disponibilidade real
    usarDisponibilidadeRealDiagnostica: true,  // IMPORTANTE: ativa candidatos reais
    usarComparacaoLegadoV2Diagnostico: true,
    legadoComparacaoDiagnostico: {
      candidatos: candidatosLegado  // Já com comparacaoKey usando 'disponibilidade-real'
    },
    fonteV2ComparacaoDiagnostico: 'disponibilidade-real',  // NOVO: fonte real
    toleranciaKmAdicionalMComparacaoDiagnostico: 100
  })
});

const resultado = await response.json();

// 2. Exibir resultados da comparação
console.log('B1: Comparacao executada');
console.log('B1: OK:', resultado.diagnosticoComparacaoLegadoV2?.ok);
console.log('B1: Fonte V2:', resultado.diagnosticoComparacaoLegadoV2?.fonteV2ComparacaoDiagnostico);
console.log('B1: Estratégia de chave:', resultado.diagnosticoComparacaoLegadoV2?.estrategiaChave);
console.log('B1: Resumo:', resultado.diagnosticoComparacaoLegadoV2?.resumo);

// 3. Verificar critério mínimo para Opção B concluída
const keysEmComum = resultado.diagnosticoComparacaoLegadoV2?.resumo?.keysEmComum ?? 0;
console.log('B1: Keys em comum:', keysEmComum);
console.log('B1: Status:', keysEmComum > 0 ? '✅ Opção B validável' : '❌ Opção B bloqueada (keysEmComum = 0)');
```

## B2 — Análise de divergências

```javascript
const divs = resultado.diagnosticoComparacaoLegadoV2?.divergencias || [];

console.log(`B2: Total de divergências: ${divs.length}`);

// Agrupar por tipo
const porTipo = {};
divs.forEach(d => {
  porTipo[d.tipoDivergencia] = (porTipo[d.tipoDivergencia] || 0) + 1;
});

console.log('B2: Divergências por tipo:', porTipo);

// Mostrar primeiras 5 divergências
divs.slice(0, 5).forEach((d, i) => {
  console.log(`B2: ${i + 1}. [${d.tipoDivergencia}] ${d.campo} - ${d.chave}`);
  console.log(`   Legado: ${JSON.stringify(d.legado).substring(0, 40)}`);
  console.log(`   V2: ${JSON.stringify(d.v2).substring(0, 40)}`);
});
```

## B3 — Verificação de duplicidades

```javascript
const dups = resultado.diagnosticoComparacaoLegadoV2?.duplicidades;

console.log('B3: Duplicidades legado:', dups?.legado?.length || 0);
console.log('B3: Duplicidades v2:', dups?.v2?.length || 0);

if (dups?.legado?.length > 0) {
  console.log('B3: Detalhes duplicidades legado:');
  dups.legado.forEach(d => {
    console.log(`   - Chave: ${d.chave}, Qtd: ${d.quantidade}`);
  });
}

if (dups?.v2?.length > 0) {
  console.log('B3: Detalhes duplicidades v2:');
  dups.v2.forEach(d => {
    console.log(`   - Chave: ${d.chave}, Qtd: ${d.quantidade}`);
  });
}
```

## B4 — Inspeção de amostras

```javascript
const amostras = resultado.diagnosticoComparacaoLegadoV2?.amostras;

console.log('B4: Amostra legado:', amostras?.legado?.length || 0);
console.log('B4: Amostra v2:', amostras?.v2?.length || 0);
console.log('B4: Pareados:', amostras?.presentesNosDois?.length || 0);

// Primeiro pareado
if (amostras?.presentesNosDois?.length > 0) {
  const primeiro = amostras.presentesNosDois[0];
  console.log('B4: Primeiro pareado:');
  console.log('   Chave:', primeiro.chave);
  console.log('   Legado tipo:', primeiro.legado.tipo);
  console.log('   V2 tipo:', primeiro.v2.tipo);
}
```

## Critérios de Sucesso da Opção B

Execute os snippets B0-B4 e verifique:

| Critério | Esperado | Resultado |
|----------|----------|-----------|
| B0 | Fixture carregado e candidatos adaptados | ☐ |
| B1 | Comparação executada sem erro | ☐ |
| B1 | Estratégia de chave = `comparacaoKey` | ☐ |
| B2 | Divergências classificadas por tipo | ☐ |
| B3 | Sem duplicidades (legado e v2) | ☐ |
| B4 | Amostras preenchidas | ☐ |

## K0 — Inspeção de Payload Necessário (Quando km adicional está ausente)

Use este snippet quando `keysEmComum: 0` e candidatos v2 aparecem como `indisponivel` com `kmAdicionalNaRotaM: null`.

```javascript
// K0: Inspecionar resposta diagnóstica e identificar campos disponíveis
const r = resultado; // resultado do B1

console.log('=== K0: INSPEÇÃO DE PAYLOAD ===');

// 1. Verificar blocos disponíveis
console.log('\n1. Blocos disponíveis:');
console.log('   diagnosticoDisponibilidadeReal:', !!r.diagnosticoDisponibilidadeReal);
console.log('   diagnosticoCandidatosDisponibilidadeReal:', !!r.diagnosticoCandidatosDisponibilidadeReal);
console.log('   diagnosticoCandidatosReaisAdaptados:', !!r.diagnosticoCandidatosReaisAdaptados);
console.log('   diagnosticoKmAdicionalRealControlado:', !!r.diagnosticoKmAdicionalRealControlado);
console.log('   diagnosticoComparacaoLegadoV2:', !!r.diagnosticoComparacaoLegadoV2);

// 2. Verificar se candidatos reais têm km adicional
console.log('\n2. Candidatos reais — kmAdicionalNaRotaM:');
const candV2 = r.diagnosticoComparacaoLegadoV2?.amostras?.v2 || [];
candV2.slice(0, 5).forEach((c, i) => {
  console.log(`   ${i+1}. ${c.dataISO}::${c.equipe}: km=${c.kmAdicionalNaRotaM}, tipo=${c.tipo}`);
});

// 3. Verificar motivos de indisponibilidade
console.log('\n3. Motivos de indisponibilidade v2:');
const indisponiveis = candV2.filter(c => c.tipo === 'indisponivel');
indisponiveis.slice(0, 5).forEach((c, i) => {
  console.log(`   ${i+1}. ${c.dataISO}::${c.equipe}: ${c.motivos?.[0] || 'sem motivo'}`);
});

// 4. Verificar se temos dados de agenda disponíveis
console.log('\n4. Dados de agenda na resposta:');
console.log('   disponibilidadeReal retorna agenda?', 
  r.diagnosticoDisponibilidadeReal?.disponibilidades?.some(d => d.pontosAgenda || d.linhasAgenda) ? 'SIM' : 'NÃO');
console.log('   NOTA: Disponibilidade real lê TEMPO DISPONIVEL, não AGENDA (shAg)');

// 5. Exibir formato necessário para km adicional real controlado
console.log('\n5. FORMATO NECESSÁRIO para usarKmAdicionalRealControladoDiagnostico:');
console.log(JSON.stringify({
  usarDisponibilidadeRealDiagnostica: true,
  usarKmAdicionalRealControladoDiagnostico: true,  // <-- FALTA ISTO
  usarComparacaoLegadoV2Diagnostico: true,
  fonteV2ComparacaoDiagnostico: 'disponibilidade-real',
  
  // Campos obrigatórios para km adicional real:
  destLat: -25.50919,  // <-- FALCAO SE NÃO VEIO DO body
  destLng: -49.26715,  // <-- FALCAO SE NÃO VEIO DO body
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',  // <-- OSRM oficial (igual ao legado)
  
  // DADOS DA AGENDA (shAg) — atualmente não fornecidos automaticamente:
  equipeAgendaDiagnostica: 'EQUIPE 1',
  linhasAgendaDiagnostica: [
    // Formato LinhaAgendaShAgV2: [data, equipe, titulo, ..., endereco]
    ['03/07/2026', 'EQUIPE 1', 'Evento 1', '', '', 'Rua A, 123', 'Bairro X', 'Curitiba', 'PR'],
    ['03/07/2026', 'EQUIPE 1', 'Evento 2', '', '', 'Rua B, 456', 'Bairro Y', 'Curitiba', 'PR'],
  ],
  cacheCoordenadasAgendaDiagnostico: {
    'Rua A, 123, Bairro X, Curitiba, PR': { lat: -25.50, lng: -49.27 },
    'Rua B, 456, Bairro Y, Curitiba, PR': { lat: -25.51, lng: -49.28 },
  }
}, null, 2));

console.log('\n=== K0: CONCLUSÃO ===');
console.log('O problema é que disponibilidade-real lê TEMPO DISPONIVEL,');
console.log('mas km-adicional-real-controlado precisa de AGENDA (shAg).');
console.log('São planilhas diferentes. A rota ainda não reaproveita dados automaticamente.');
console.log('Para avançar, use o payload completo acima ou aguarde implementação de leitura de agenda real.');
```

---

## K1 — Payload com Agenda Manual (modo controlado legado)

Use este payload quando quiser fornecer manualmente as linhas da agenda:

```javascript
const payloadManual = {
  // Request base (do fixture legado)
  cep: '80000-000',
  dataInicial: '2026-06-20',
  tempoNecessario: '00:40',
  destLat: -25.50919,
  destLng: -49.26715,
  
  // Flags de diagnóstico
  usarDisponibilidadeRealDiagnostica: true,
  usarKmAdicionalRealControladoDiagnostico: true,
  usarComparacaoLegadoV2Diagnostico: true,
  fonteV2ComparacaoDiagnostico: 'disponibilidade-real',
  
  // OSRM oficial da v2 (igual ao legado). Nao usar router.project-osrm.org como primario.
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 10000,
  
  // Agenda (shAg) — fornecida manualmente
  equipeAgendaDiagnostica: 'EQUIPE 1',
  linhasAgendaDiagnostica: [
    // Formato: [data, equipe, titulo, tempo, obs, endereco, bairro, cidade, uf]
    ['03/07/2026', 'EQUIPE 1', 'Entrega A', '08:00', '', 'Av. Sete de Setembro, 1000', 'Centro', 'Curitiba', 'PR'],
    ['08/07/2026', 'EQUIPE 1', 'Entrega B', '09:00', '', 'Rua XV de Novembro, 500', 'Centro', 'Curitiba', 'PR'],
  ],
  cacheCoordenadasAgendaDiagnostico: {},
  
  // Legado para comparação
  legadoComparacaoDiagnostico: {
    candidatos: candidatosLegado  // do B0
  },
  toleranciaKmAdicionalMComparacaoDiagnostico: 100
};
```

---

## K2 — Payload com Leitura Automática da Agenda Real e Mapa por Slot (recomendado)

Use este payload para ler automaticamente a planilha AGENDA (shAg) do Google Sheets e calcular kmAdicionalNaRotaM por slot:

```javascript
const payloadAgendaReal = {
  // Request base (do fixture legado)
  cep: '80000-000',
  dataInicial: '2026-07-01',  // Data inicial para validação de julho
  tempoNecessario: '00:40',
  destLat: -25.50919,
  destLng: -49.26715,
  
  // Flags de diagnóstico
  usarDisponibilidadeRealDiagnostica: true,
  usarAgendaRealDiagnostica: true,  // Lê AGENDA/shAg automaticamente
  usarKmAdicionalRealControladoDiagnostico: true,
  usarComparacaoLegadoV2Diagnostico: true,
  fonteV2ComparacaoDiagnostico: 'disponibilidade-real',
  
  // OSRM oficial da v2 (igual ao legado). Nao usar router.project-osrm.org como primario.
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 10000,
  
  // GID da aba de agenda (validado: 14790013 — substituir se a aba mudar)
  gidAgendaDiagnostica: 14790013,

  // Equipe para filtrar na agenda (obrigatório)
  equipeAgendaDiagnostica: 'EQUIPE 1',
  
  // Cache de coordenadas (opcional, pode ser {})
  cacheCoordenadasAgendaDiagnostico: {},
  
  // Legado para comparação
  legadoComparacaoDiagnostico: {
    candidatos: candidatosLegado  // do B0
  },
  toleranciaKmAdicionalMComparacaoDiagnostico: 100
};

// Executar
const response = await fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payloadAgendaReal)
});

const resultado = await response.json();

// Verificar leitura da agenda real
console.log('K2: Agenda real lida:', resultado.diagnosticoAgendaReal?.ok);
console.log('K2: Agenda real erro:', resultado.diagnosticoAgendaReal?.erro ?? '(sem erro)');
console.log('K2: Linhas de agenda:', resultado.diagnosticoAgendaReal?.leitura?.linhasConvertidas);

// 2. Diagnóstico de entrada do mapa automático (quando condição falha)
if (!resultado.diagnosticoMapaKmAdicionalPorSlot?.executado) {
  console.log('K2-AGENDA erroAgenda:', resultado.diagnosticoMapaKmAdicionalPorSlot?.erroAgenda ?? '(nao disponivel)');
  console.log('K2-AGENDA agendaRealLinhas:', resultado.diagnosticoMapaKmAdicionalPorSlot?.agendaRealLinhas);
}

// === K2-SLOT: Verificar mapa por slot ===

// 1. Mapa por slot calculado? (nível superior - preenchido automaticamente quando usarAgendaRealDiagnostico está ativo)
const mapaKm = resultado.diagnosticoMapaKmAdicionalPorSlot;
console.log('K2-SLOT mapaKmExecutado:', mapaKm?.executado);
console.log('K2-SLOT mapaKmOk:', mapaKm?.ok);
console.log('K2-SLOT mapaKmMotivo:', mapaKm?.motivo ?? '(sem motivo, ok)');
console.log('K2-SLOT slotsRecebidos:', mapaKm?.slotsRecebidos);
console.log('K2-SLOT slotsComKm:', mapaKm?.slotsComKm);
console.log('K2-SLOT slotsComFallbackHaversine:', mapaKm?.slotsComFallbackHaversine);
console.log('K2-SLOT slotsComErro:', mapaKm?.slotsComErro);
console.log('K2-SLOT amostra:', JSON.stringify(mapaKm?.amostraDetalhesPorSlot, null, 2));

// 2. Diagnóstico de entrada do mapa automático (quando condição falha)
if (mapaKm?.motivo?.includes('Condicao de entrada falhou')) {
  console.log('K2-SLOT usarAgendaRealDiagnostico:', mapaKm?.usarAgendaRealDiagnostico);
  console.log('K2-SLOT agendaRealComDadosDisponivel:', mapaKm?.agendaRealComDadosDisponivel);
  console.log('K2-SLOT agendaRealOk:', mapaKm?.agendaRealOk);
  console.log('K2-SLOT agendaRealLinhas:', mapaKm?.agendaRealLinhas);
}

// 3. Diagnóstico de pré-requisitos (quando slots foram gerados mas cálculo falhou)
if (mapaKm?.slotsGerados !== undefined) {
  console.log('K2-SLOT slotsGerados:', mapaKm?.slotsGerados);
  console.log('K2-SLOT destinoInformado:', mapaKm?.destinoInformado);
  console.log('K2-SLOT osrmBaseUrlInformado:', mapaKm?.osrmBaseUrlInformado);
}

// 4. Mapa aninhado no bloco de disponibilidade real (para verificação adicional)
const blocoReal = resultado.diagnosticoCandidatosDisponibilidadeReal;
const mapaKmAninhado = blocoReal?.diagnosticoMapaKmAdicionalPorSlot;
console.log('K2-SLOT mapaKmAninhadoExecutado:', mapaKmAninhado?.executado);
console.log('K2-SLOT mapaKmAninhadoOk:', mapaKmAninhado?.ok);
console.log('K2-SLOT mapaKmPorSlotAtivado:', blocoReal?.parametros?.mapaKmPorSlotAtivado);

// 5. Candidatos com origemKmAdicional
const amostra = blocoReal?.candidatosOrdenadosAmostra ?? [];
console.log('K2-SLOT candidatos:');
amostra.forEach(c => {
  console.log(`  ${c.dataISO} ${c.equipe} tipo=${c.tipo} km=${c.kmAdicionalNaRotaM} origemKm=${c.origemKmAdicional} chave=${c.chaveSlotKm}`);
});

// 6. kms únicos (deve ser > 1 se mapa por slot funcionou)
const kmsUnicos = [...new Set(amostra.map(c => c.kmAdicionalNaRotaM))];
console.log('K2-SLOT kmsUnicosV2:', kmsUnicos);
console.log('K2-SLOT quantidadeKmsUnicosV2:', kmsUnicos.length);

// 7. Verificar comparação
console.log('K2-SLOT keysEmComum:', resultado.diagnosticoComparacaoLegadoV2?.resumo?.keysEmComum);
console.log('K2-SLOT legadoSemV2:', resultado.diagnosticoComparacaoLegadoV2?.resumo?.legadoSemV2);
console.log('K2-SLOT divergencias:', resultado.diagnosticoComparacaoLegadoV2?.divergencias?.length);
console.log('K2-SLOT divergencias detalhe:', JSON.stringify(
  resultado.diagnosticoComparacaoLegadoV2?.divergencias?.slice(0, 5),
  null, 2
));

// Critério de sucesso:
// mapaKmExecutado: true
// mapaKmOk: true
// quantidadeKmsUnicosV2 > 1
// origemKmAdicional: 'slot' (não 'global-fallback')
```

---

## K3 — Diagnóstico de Inserção por Slot (pontosRotaBase, candidatos, delta)

Este snippet ativa a flag `usarInsercaoPorSlotDiagnostico` para expor o cálculo completo de inserção por slot:
- Pontos da rota base (origem + agenda)
- Todos os candidatos de inserção testados (com trechos individuais)
- Melhor inserção escolhida
- `kmAdicionalNaRotaM` final

Use para investigar divergências entre v2 e legado no `kmAdicionalNaRotaM`.

Atualizacao 2026-06-19:
- Quando `usarAgendaRealDiagnostica: true` e `usarDisponibilidadeRealDiagnostica: true`, o bloco `diagnosticoInsercaoPorSlot` reaproveita os slots reais montados da agenda real + janela de datas.
- `slotsAgendaDiagnostica` manual continua aceito para cenario controlado, mas nao e mais obrigatorio para agenda real.
- Verifique `diagnosticoInsercaoPorSlot.parametros.fonteSlots`; o fluxo real deve retornar `agenda-real-janela`.

```javascript
// === K3: Diagnóstico de inserção por slot ===

const payloadInsercao = {
  cep: '81830-020',
  dataInicial: '2026-06-29',
  tempoNecessario: '00:40',
  destLat: -25.5091859,
  destLng: -49.2671477,
  destDisplay: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
  destProvider: 'supabase',
  enderecoCompleto: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
  gidAgendaDiagnostica: 14790013,
  usarAgendaRealDiagnostica: true,
  usarDisponibilidadeRealDiagnostica: true,
  usarKmAdicionalRealControladoDiagnostico: true,
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 15000,
  equipeAgendaDiagnostica: 'EQUIPE 1',
  cacheCoordenadasAgendaDiagnostico: {},
  usarInsercaoPorSlotDiagnostico: true,
  usarComparacaoLegadoV2Diagnostico: true,
  fonteV2ComparacaoDiagnostico: 'disponibilidade-real'
};

const response = await fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payloadInsercao)
});

const resultado = await response.json();

// Verificar bloco
const bloco = resultado.diagnosticoInsercaoPorSlot;
console.log('K3 executado:', bloco?.executado);
console.log('K3 ok:', bloco?.ok);
console.log('K3 modo:', bloco?.modo);
console.log('K3 osrmBaseUrlUsada:', bloco?.parametros?.osrmBaseUrlUsada);
console.log('K3 osrmFallbackUsado:', bloco?.parametros?.osrmFallbackUsado);
console.log('K3 slotsRecebidos:', bloco?.parametros?.slotsRecebidos);
console.log('K3 fonteSlots:', bloco?.parametros?.fonteSlots);

const slot0307 = bloco?.slots?.['2026-07-03::EQUIPE 1'];
console.log('K3 slot0307Encontrado:', !!slot0307);
console.log('K3 slot0307 km final:', slot0307?.kmAdicionalNaRotaMFinal);
console.log('K3 slot0307 pontos:', slot0307?.pontosRotaBase?.length ?? 0);
console.log('K3 slot0307 candidatos:', slot0307?.candidatosInsercao?.length ?? 0);
console.log('K3 slot0307 melhorInsercao:', slot0307?.melhorInsercao);

// Verificar cada slot
if (bloco?.slots) {
  for (const [chave, slot] of Object.entries(bloco.slots)) {
    console.log(`\n=== ${chave} ===`);
    console.log('  origemCalculo:', slot.origemCalculo);
    console.log('  kmAdicionalNaRotaMFinal:', slot.kmAdicionalNaRotaMFinal);
    console.log('  origemOperacional.tipo:', slot.origemOperacional?.tipo);
    console.log('  origemOperacional.origem:', slot.origemOperacional?.origem);
    console.log('  destinoNovo:', slot.destinoNovo);

    console.log('  pontosRotaBase:');
    slot.pontosRotaBase?.forEach(p => {
      console.log(`    [${p.indice}] ${p.tipo}: ${p.label} (${p.lat}, ${p.lng}) ${p.endereco ?? ''}`);
    });

    console.log('  candidatosInsercao:');
    slot.candidatosInsercao?.forEach(c => {
      console.log(`    pos=${c.indiceInsercao} ${c.antes}→${c.depois ?? 'FIM'} delta=${c.deltaM}m`);
      console.log(`      trechoAntNovo=${c.trechoAnteriorNovoM}m trechoNovoProx=${c.trechoNovoProximoM}m trechoAntProx=${c.trechoAnteriorProximoM}m`);
    });

    console.log('  melhorInsercao:', slot.melhorInsercao);
  }
}

// Critério de sucesso:
// - bloco.executado: true
// - bloco.ok: true
// - bloco.parametros.slotsRecebidos > 0
// - bloco.parametros.fonteSlots === 'agenda-real-janela'
// - bloco.slots['2026-07-03::EQUIPE 1'] preenchido
// - slot 03/07 tem pontosRotaBase, candidatosInsercao e melhorInsercao
// - kmAdicionalNaRotaMFinal corresponde ao delta da melhorInsercao
```

---

| Recurso | Status | Nota |
|---------|--------|------|
| Disponibilidade real (TEMPO DISPONIVEL) | ✅ Implementado | `buscarDisponibilidadeRealDiagnosticaComDados` |
| Candidatos reais com disponibilidade | ✅ Implementado | `gerarCandidatosComDisponibilidadeRealV2` |
| Mapa de kmAdicionalPorSlot automático | ✅ Implementado | Calculado automaticamente quando `usarAgendaRealDiagnostica` está ativo |
| Aplicação de mapa por slot em candidatos reais | ✅ Implementado | Cada candidato recebe km específico do seu slot (equivalência legado) |
| Km adicional real controlado | ✅ Implementado | `calcularKmAdicionalRealControladoV2` |
| **Leitura automática de AGENDA (shAg)** | ✅ **Implementado 2026-06-18** | `buscarAgendaRealDiagnosticaComDados` via flag `usarAgendaRealDiagnostica` |
| Reaproveitamento de dados | ✅ **Implementado** | Quando `usarAgendaRealDiagnostica: true`, a rota lê AGENDA automaticamente e alimenta `kmAdicionalRealControlado` |

---

## Próximo Passo

**Opção B1 (com km adicional real):**
1. Executar K0 para confirmar que o problema é km adicional ausente
2. Montar payload K1 com `linhasAgendaDiagnostica` e `cacheCoordenadasAgendaDiagnostico`
3. Executar B1 com payload completo
4. Verificar `keysEmComum > 0`

**Opção B2 (sem km adicional real, sintético):**
Use `fonteV2ComparacaoDiagnostico: 'diagnostico-candidatos'` para testar estrutura sem OSRM.

---

## Nota K3/K7 - cache de coordenadas da AGENDA real

No fluxo atual, `usarAgendaRealDiagnostica: true` le as linhas reais da AGENDA, mas nao faz geocoding real dos pontos. Para que `pontosRotaBase`, `candidatosInsercao` e `melhorInsercao` sejam preenchidos, o payload precisa enviar `cacheCoordenadasAgendaDiagnostico` com coordenadas para os enderecos encontrados.

Com `cacheCoordenadasAgendaDiagnostico: {}`, o resultado esperado e diagnostico: os enderecos podem aparecer em `parseAgenda.descartados` com motivo `sem_coordenadas_cache`.

Formato esperado:

```javascript
const cacheCoordenadasAgendaDiagnostico = {
  // chave normalizada do endereco -> coordenadas vindas do cache/geocoding real
  // 'rua rio ivai, 269, weissopolis, pinhais - pr, 83322-370': { lat: -25.x, lng: -49.x },
  // 'avenida sao jose, 814, cristo rei, curitiba - pr, 80050-350': { lat: -25.x, lng: -49.x },
};
```

Use essa variavel no payload K3:

```javascript
cacheCoordenadasAgendaDiagnostico,
```

---

## K9 - Comparar trechos OSRM atuais do slot 03/07

Objetivo: comparar, sem alterar producao, os tres trechos da melhor insercao do
slot `2026-07-03::EQUIPE 1` entre OSRM `/route` e `/table` no endpoint dedicado.

Trechos investigados:
- `DEPOSITO -> Cornelius`
- `Cornelius -> Avenida Sao Jose`
- `DEPOSITO -> Avenida Sao Jose`

Resultado observado em 2026-06-19 no OSRM dedicado `https://osrm.lebebe.cloud`:
- `/route`: `4023 + 12017 - 8871 = 7169m`
- `/table`: `4017 + 11995 - 8854 = 7158m`

Conclusao diagnostica: com as coordenadas atuais usadas pela v2, a diferenca
entre `/route` e `/table` e pequena neste caso (11m no delta). O valor legado
antigo `5430m` nao e explicado por endpoint `/route` vs `/table` usando essas
coordenadas atuais. A divergencia fica concentrada no trecho base
`DEPOSITO -> Avenida Sao Jose`: para o delta ser `5430m` mantendo os dois
primeiros trechos do K9, esse trecho teria que estar perto de `10582m`.

Snippet DevTools para comparar `/route` e `/table` no OSRM dedicado:

```javascript
const osrmBase = 'https://osrm.lebebe.cloud';
const pontos = {
  deposito: { lat: -25.4876648, lng: -49.2692262, nome: 'DEPOSITO' },
  cornelius: { lat: -25.5091859, lng: -49.2671477, nome: 'Cornelius' },
  saoJose: { lat: -25.4352613, lng: -49.2415798, nome: 'Avenida Sao Jose' },
};

async function osrmRouteM(a, b) {
  const url = `${osrmBase}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const json = await res.json();
  return Math.round(json.routes?.[0]?.distance ?? NaN);
}

async function osrmTable() {
  const coords = [pontos.deposito, pontos.cornelius, pontos.saoJose]
    .map((p) => `${p.lng},${p.lat}`)
    .join(';');
  const res = await fetch(`${osrmBase}/table/v1/driving/${coords}?annotations=distance`, {
    headers: { Accept: 'application/json' },
  });
  const json = await res.json();
  return json.distances;
}

const route = {
  depositoCornelius: await osrmRouteM(pontos.deposito, pontos.cornelius),
  corneliusSaoJose: await osrmRouteM(pontos.cornelius, pontos.saoJose),
  depositoSaoJose: await osrmRouteM(pontos.deposito, pontos.saoJose),
};
route.delta = route.depositoCornelius + route.corneliusSaoJose - route.depositoSaoJose;

const table = await osrmTable();
const tableResumo = {
  depositoCornelius: Math.round(table[0][1]),
  corneliusSaoJose: Math.round(table[1][2]),
  depositoSaoJose: Math.round(table[0][2]),
};
tableResumo.delta =
  tableResumo.depositoCornelius + tableResumo.corneliusSaoJose - tableResumo.depositoSaoJose;

console.table({ route, table: tableResumo });
console.log('Trecho base necessario para delta 5430m:', route.depositoCornelius + route.corneliusSaoJose - 5430);
```

Snippet Apps Script somente para logar os tres trechos atuais com `getDrivingKm`
(nao limpa cache e nao altera planilha/config):

```javascript
function DIAG_K9_TrechosMelhorInsercao_0307() {
  var deposito = { lat: -25.4876648, lng: -49.2692262 };
  var cornelius = { lat: -25.5091859, lng: -49.2671477 };
  var saoJose = { lat: -25.4352613, lng: -49.2415798 };

  var a = getDrivingKm(deposito, cornelius);
  var b = getDrivingKm(cornelius, saoJose);
  var c = getDrivingKm(deposito, saoJose);
  var delta = a + b - c;

  Logger.log('[DIAG-K9] OSRM_BASE=%s', OSRM_BASE);
  Logger.log('[DIAG-K9] deposito->cornelius=%s km', a);
  Logger.log('[DIAG-K9] cornelius->saoJose=%s km', b);
  Logger.log('[DIAG-K9] deposito->saoJose=%s km', c);
  Logger.log('[DIAG-K9] delta=%s km', delta);
  Logger.log('[DIAG-K9] cacheKey deposito->saoJose=%s', cacheKeyCoords(deposito, saoJose));
}
```

**Para concluir Opção B com dados reais:**
É necessário implementar leitura da planilha AGENDA (shAg) no modo diagnóstico, ou fornecer manualmente os dados da agenda no payload.

---

## K11 — Detalhamento da Comparação dos 4 Candidatos Cornelius

Este snippet imprime os 4 candidatos principais (03/07, 08/07, 11/07, 13/07) comparados individualmente, incluindo tipo, elegibilidade, horaMarcada, ordem, km, regras aplicadas e divergências por chave.

Use para investigar `divergenciasOrdem=3` reportado pelo comparador.

```javascript
// === K11: Detalhamento dos 4 candidatos Cornelius ===

const payloadK11 = {
  cep: '81830-020',
  dataInicial: '2026-06-29',
  tempoNecessario: '00:40',
  destLat: -25.5091859,
  destLng: -49.2671477,
  destDisplay: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
  destProvider: 'supabase',
  enderecoCompleto: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
  gidAgendaDiagnostica: 14790013,
  usarAgendaRealDiagnostica: true,
  usarDisponibilidadeRealDiagnostica: true,
  usarKmAdicionalRealControladoDiagnostico: true,
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 15000,
  equipeAgendaDiagnostica: 'EQUIPE 1',
  cacheCoordenadasAgendaDiagnostico: {
    'avenida sao jose, 814, cristo rei, curitiba - pr, 80050-350': { lat: -25.4352613, lng: -49.2415798 },
    'rua rio ivai, 269, weissopolis, pinhais - pr, 83322-370': { lat: -25.4665832, lng: -49.1853016 },
  },
  usarComparacaoLegadoV2Diagnostico: true,
  fonteV2ComparacaoDiagnostico: 'disponibilidade-real',
  // Fixture legado para comparacao
  legadoComparacaoDiagnostico: {
    candidatos: [
      { dataISO: '2026-07-03', team: 'EQUIPE 1', tipo: 'especial', isExtra: true, rank: 1, avisoHoraMarcada: '' },
      { dataISO: '2026-07-08', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 2, avisoHoraMarcada: '' },
      { dataISO: '2026-07-11', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 3, avisoHoraMarcada: '' },
      { dataISO: '2026-07-13', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 4, avisoHoraMarcada: '' },
    ]
  }
};

const response = await fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payloadK11)
});

const resultado = await response.json();

// Bloco de comparacao
const comp = resultado.diagnosticoComparacaoLegadoV2;
console.log('=== K11: Comparacao Legado x v2 ===');
console.log('executado:', comp?.executado);
console.log('ok:', comp?.ok);
console.log('estrategiaChave:', comp?.estrategiaChave);
console.log('');

// Resumo
console.log('--- Resumo ---');
console.log('candidatosLegado:', comp?.resumo?.candidatosLegado);
console.log('candidatosV2:', comp?.resumo?.candidatosV2);
console.log('presentesNosDois:', comp?.resumo?.presentesNosDois);
console.log('apenasNoLegado:', comp?.resumo?.apenasNoLegado);
console.log('apenasNaV2:', comp?.resumo?.apenasNaV2);
console.log('');

// Divergencias agregadas
console.log('--- Divergencias Agregadas ---');
console.log('divergenciasTipo:', comp?.resumo?.divergenciasTipo);
console.log('divergenciasElegibilidade:', comp?.resumo?.divergenciasElegibilidade);
console.log('divergenciasHoraMarcada:', comp?.resumo?.divergenciasHoraMarcada);
console.log('divergenciasKm:', comp?.resumo?.divergenciasKm);
console.log('divergenciasOrdem:', comp?.resumo?.divergenciasOrdem);
console.log('divergenciasMotivo:', comp?.resumo?.divergenciasMotivo);
console.log('');

// Detalhe por candidato nos 4 slots criticos
const datasCriticas = ['2026-07-03', '2026-07-08', '2026-07-11', '2026-07-13'];
const presentes = comp?.amostras?.presentesNosDois || [];

console.log('--- Detalhe por Candidato (presentesNosDois) ---');
for (const dataISO of datasCriticas) {
  const candidato = presentes.find(p => p.chave === dataISO || p.chave.startsWith(`${dataISO}::`));
  if (candidato) {
    const { legado, v2 } = candidato;
    console.log(`\n[${dataISO}]`);
    console.log('  tipo:         legado=' + legado.tipo + ' | v2=' + v2.tipo + (legado.tipo !== v2.tipo ? ' ⚠️' : ' ✅'));
    console.log('  elegivel:     legado=' + legado.elegivel + ' | v2=' + v2.elegivel + (legado.elegivel !== v2.elegivel ? ' ⚠️' : ' ✅'));
    console.log('  horaMarcada:  legado=' + legado.horaMarcada + ' | v2=' + v2.horaMarcada + (legado.horaMarcada !== v2.horaMarcada ? ' ⚠️' : ' ✅'));
    console.log('  ordem:        legado=' + legado.ordem + ' | v2=' + v2.ordem + (legado.ordem !== v2.ordem ? ' ⚠️ ORDEM DIFERENTE' : ' ✅'));
    console.log('  kmAdicional:  legado=' + legado.kmAdicionalNaRotaM + ' | v2=' + v2.kmAdicionalNaRotaM);
    console.log('  regraTipo:    v2=' + v2.regraTipoAplicada);
    console.log('  regraHora:    v2=' + v2.regraHoraMarcadaAplicada);
    console.log('  slotTemPontos: v2=' + v2.slotTemPontos + ' (fonte: ' + v2.fonteSlotTemPontos + ')');
    console.log('  limites:      base=' + v2.limiteBaseM + 'm especial=' + v2.limiteEspecialM + 'm premium=' + v2.limitePremiumM + 'm');
  } else {
    console.log(`\n[${dataISO}] ❌ NAO ENCONTRADO em presentesNosDois`);
    // Verificar se esta apenas em um lado
    const soLegado = comp?.amostras?.legado?.find(l => l.dataISO === dataISO);
    const soV2 = comp?.amostras?.v2?.find(v => v.dataISO === dataISO);
    if (soLegado) console.log('  -> Apenas no legado:', soLegado);
    if (soV2) console.log('  -> Apenas na v2:', soV2);
  }
}

// Divergencias individuais
console.log('\n--- Divergencias Individuais (detalhe) ---');
if (comp?.divergencias?.length > 0) {
  for (const d of comp.divergencias) {
    console.log(`[${d.chave}] ${d.campo}: legado=${JSON.stringify(d.legado)} v2=${JSON.stringify(d.v2)} (${d.severidade})`);
    if (d.observacao) console.log('  ->', d.observacao);
  }
} else {
  console.log('Nenhuma divergencia individual registrada.');
}

// Criterio de sucesso:
// - presentesNosDois >= 4 (03/07, 08/07, 11/07, 13/07)
// - divergenciasTipo = 0
// - divergenciasElegibilidade = 0
// - divergenciasHoraMarcada = 0
// - divergenciasOrdem investigada (pode ser informativa se ordem diferente mas ranking final equivalente)
// - 03/07: tipo=especial, elegivel=true, horaMarcada=false
// - 08/07, 11/07, 13/07: tipo=normal, elegivel=true, horaMarcada=false
```

---

## K12.1 — Validação do Recorte Final v2 (resultado-final-legado-equivalente)

Snippet para validar o recorte final com `maxNormais=3` usando a fonte `resultado-final-legado-equivalente`.

```javascript
// === K12.1: Validacao do recorte final v2 (maxNormais=3) ===

const payloadK12 = {
  cep: '81830-020',
  dataInicial: '2026-06-29',
  tempoNecessario: '00:40',
  destLat: -25.5091859,
  destLng: -49.2671477,
  destDisplay: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
  destProvider: 'supabase',
  enderecoCompleto: 'rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil',
  gidAgendaDiagnostica: 14790013,
  usarAgendaRealDiagnostica: true,
  usarDisponibilidadeRealDiagnostica: true,
  usarKmAdicionalRealControladoDiagnostico: true,
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 15000,
  equipeAgendaDiagnostica: 'EQUIPE 1',
  cacheCoordenadasAgendaDiagnostico: {
    'avenida sao jose, 814, cristo rei, curitiba - pr, 80050-350': { lat: -25.4352613, lng: -49.2415798 },
    'rua rio ivai, 269, weissopolis, pinhais - pr, 83322-370': { lat: -25.4665832, lng: -49.1853016 },
  },
  usarComparacaoLegadoV2Diagnostico: true,
  fonteV2ComparacaoDiagnostico: 'resultado-final-legado-equivalente',
  legadoComparacaoDiagnostico: {
    candidatos: [
      { dataISO: '2026-07-03', team: 'EQUIPE 1', tipo: 'especial', isExtra: true, rank: 1, avisoHoraMarcada: '' },
      { dataISO: '2026-07-08', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 2, avisoHoraMarcada: '' },
      { dataISO: '2026-07-11', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 3, avisoHoraMarcada: '' },
      { dataISO: '2026-07-13', team: 'EQUIPE 1', tipo: 'normal', isExtra: false, rank: 4, avisoHoraMarcada: '' },
    ]
  }
};

const response = await fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payloadK12)
});
const resultado = await response.json();

// Bloco de recorte final
const final = resultado.diagnosticoResultadoFinalLegadoEquivalente;
console.log('=== K12.1: Recorte Final v2 ===');
console.log('executado:', final?.executado);
console.log('ok:', final?.ok);
console.log('avisoDiagnostico:', final?.avisoDiagnostico);
console.log('');

// Resumo
const resumo = final?.resumo;
console.log('--- Resumo ---');
console.log('totalRecebidos:', resumo?.totalRecebidos);
console.log('totalElegiveis:', resumo?.totalElegiveis);
console.log('totalRecortados:', resumo?.totalRecortados);
console.log('normaisRecortados:', resumo?.normaisRecortados);
console.log('especiaisRecortados:', resumo?.especiaisRecortados);
console.log('premiumsRecortados:', resumo?.premiumsRecortados);
console.log('horaMarcadaRecortados:', resumo?.horaMarcadaRecortados);
console.log('maxNormaisAplicado:', resumo?.maxNormaisAplicado);
console.log('');

// Candidatos finais
console.log('--- Candidatos Finais ---');
(final?.candidatosFinais ?? []).forEach(c => {
  console.log(`  rank=${c.rank} ${c.dataISO} ${c.equipe} tipo=${c.tipo} elegivel=${c.elegivel} km=${c.kmAdicionalNaRotaM}`);
});
console.log('quantidade:', final?.candidatosFinais?.length);

// Validacao de limites
console.log('');
console.log('--- Validacao de Limites ---');
const nOk = (resumo?.normaisRecortados ?? 99) <= 3;
const eOk = (resumo?.especiaisRecortados ?? 99) <= 1;
const pOk = (resumo?.premiumsRecortados ?? 99) <= 1;
const hOk = (resumo?.horaMarcadaRecortados ?? 99) <= 1;
const datasFinais = (final?.candidatosFinais ?? []).map(c => c.dataISO);
const semDup = new Set(datasFinais).size === datasFinais.length;
console.log('normaisOk (<=3):', nOk);
console.log('especiaisOk (<=1):', eOk);
console.log('premiumsOk (<=1):', pOk);
console.log('horaMarcadaOk (<=1):', hOk);
console.log('semDatasDuplicadas:', semDup);
console.log('datasDuplicadas:', datasFinais.filter((d, i) => datasFinais.indexOf(d) !== i));

// Criterio de aceite:
// - normaisRecortados <= 3    ✅
// - especiaisRecortados <= 1  ✅
// - premiumsRecortados <= 1   ✅
// - horaMarcadaRecortados <= 1 ✅
// - semDatasDuplicadas = true  ✅
// - maxNormaisAplicado = 3     ✅
```

### Resultado K12.1 validado em 22/06/2026

Executado no cenário Cornelius (`2026-06-29`, agenda `14790013`, EQUIPE 1):

```text
status: 200
httpOk: true
resultadoFinalExecutado: true
resultadoFinalOk: true
quantidadeFinal: 4

resumo:
  totalRecebidos: 172
  totalElegiveis: 64
  totalRecortados: 4
  normaisRecortados: 3        ✅
  especiaisRecortados: 1      ✅
  premiumsRecortados: 0       ✅
  horaMarcadaRecortados: 0    ✅
  maxNormaisAplicado: 3       ✅

validacaoLimites:
  normaisOk: true
  especiaisOk: true
  premiumsOk: true
  horaMarcadaOk: true
  semDatasDuplicadas: true    ✅
  datasDuplicadas: []

candidatosFinais:
  rank=1  2026-07-02  EQUIPE 1  NORMAL
  rank=2  2026-07-03  EQUIPE 1  ESPECIAL
  rank=3  2026-07-10  EQUIPE 1  NORMAL
  rank=4  2026-07-11  EQUIPE 1  NORMAL
```

### Notas sobre o K12.1

**comparadorOk=false**: O comparador divergiu porque o payload legado controlado ainda continha o histórico anterior (08/07, 11/07, 13/07). Isso não é falha do recorte — é diferença de agenda:
- `08/07` estava no legado histórico, mas foi preenchido na agenda atual de `22/06/2026`. Ausência de `08/07` no resultado v2 atual é compatível com a agenda real.
- A validação do recorte (limites, datas únicas, estrutura) foi aprovada independentemente do comparador.

**Decisão de produto registrada**: v2 usa `maxNormais=3`; legado literal usa `MAX_NORMAIS_RETORNO=5`. Divergência intencional aprovada em `22/06/2026`. Não deve ser reaberta como bug de equivalência.

---

## Análise K11 - Validação Frente 2

Contexto validado K9/K10:
- 03/07::EQUIPE 1: delta v2 = 7158m, delta legado = 7169m
- LimiteBaseM = 5000m (config-slot-pontos), LimiteEspecialM = 10000m, LimitePremiumM = 15000m
- Classificação: 7158m > 5000m (base) e <= 10000m (especial) → **ESPECIAL** ✅

Resultado esperado K11:
| Data | Tipo Esperado | Elegível | Hora Marcada | kmAdicional |
|------|---------------|----------|--------------|-------------|
| 03/07 | especial | true | false | ~7158m |
| 08/07 | normal | true | false | <=5000m |
| 11/07 | normal | true | false | <=5000m |
| 13/07 | normal | true | false | <=5000m |

Investigar `divergenciasOrdem=3`:
- Se a ordem for diferente mas o ranking final (ordenacao cronologica) for equivalente, trata-se de divergencia informativa
- O legado ordena candidatos finais cronologicamente por data
- A v2 diagnostica ordena por elegibilidade > tipo > indice > equipe (preliminar)
- O recorte final do legado aplica: 3 normais + 1 especial opcional + 1 premium opcional + 1 hora marcada opcional

