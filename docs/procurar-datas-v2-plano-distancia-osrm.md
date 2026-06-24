# Plano de Integração de Distância / OSRM / Encaixe na Rota — Motor v2

> **Data:** 15 de junho de 2026 | **Agente:** Cascade | **Status:** Planejamento — sem implementação
> **Não altera código. Não altera produção.**

---

## 1. O que já existe hoje no v2 para distância

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Haversine pura | `motor/distancia.ts` | ✅ Porta fiel do legado |
| Cálculo de frete | `motor/frete.ts` | ✅ Porta fiel do legado |
| Classificação | `motor/classificacao-candidato.ts` | ✅ Recebe `distanciaKm` + `kmAdicionalNaRotaM` |
| Geração de candidatos | `motor/gerar-candidatos-disponibilidade-real.ts` | ⚠️ Não calcula distância — recebe externamente |
| Rota diagnóstica | `api/procurar-datas/v2/diagnostico/route.ts` | ⚠️ Usa `kmAdicionalNaRotaM` sintético (`base * 0.5`) |
| OSRM real | — | ❌ Não integrado |

---

## 2. O que o legado faz para calcular encaixe na rota

Pipeline confirmado no `CEP-APIBACK.gs` (linhas 689–1145):

```
Para cada slot (data × equipe):
  1. coletarPontosDoDia(slot, agVals, agDisp) → pontos[] com coordenadas
  2. originLoc = DEPÓSITO (semana) ou HOME_SAT_E1/E2 (sábado)
  3. baseRoute = rotaOtimizada(originLoc, pontos) → nearest-neighbor + 2-opt
  4. Para cada posição de inserção do destino na rota:
       incKm = OSRM(prev→novo) + OSRM(novo→next) - OSRM(prev→next)
  5. bestKm = menor incKm entre todas as posições
  6. Candidato: delta = bestKm (km adicional por inserção na rota)
```

Funções legado envolvidas: `getDrivingKm()` (OSRM, l.706), `getDrivingKmBatch()` (l.738), `coletarPontosDoDia()` (l.1596), `rotaOtimizada()` (l.1767), `twoOptSwap()` (l.1783).

O legado usa Haversine como **pré-filtro** (`nearestStraight > MAX_POINT_KM * 1.5` → descarta sem OSRM) e para fast-pass (`roughKm = minDist * 1.3`, critério relaxado). O loop principal usa OSRM para o delta real.

---

## 3. Campos necessários para calcular `kmAdicionalNaRotaM`

**Dados da agenda real (`shAg`):** `pontos[].loc` (coordenadas), `pontos[].addr` (endereço), `pontos[].eventTitle`, `pontos[].cep` — todos vêm da planilha AGENDA + geocoding.

**Dados do destino:** `locNovo` (lat/lng do request), `cepFmt`.

**Dados do depósito/origem:** `DEPOSIT_ADDRESS` (config), `depositoLoc` (geocoding), `HOME_SAT_E1/E2` (sábado), `FIXED_LOCS` (cache).

**Config:** `MAX_EXTRA_METERS`, `MAX_EXTRA_DYNAMIC`, `MAX_EXTRA_PREMIUM`, `MAX_POINT_KM`.

---

## 4. Quais dados vêm da agenda real

O legado lê `shAg.getRange(2,1,rowsAg,7).getValues()` (CEP-APIBACK.gs:690). `coletarPontosDoDia()` filtra por data do slot e equipe, extrai endereço (coluna 6 ou regex em observações), geocodifica via cache Supabase.

Equivalente v2: parser de agenda + geocoding de endereços. **Não existe ainda no v2.**

---

## 5. Quais dados vêm do destino do cliente

| Dado | Legado | v2 | Status |
|------|--------|----|--------|
| CEP, Coordenadas, isRural, isCondominio | `form.*` | `body.*` | ✅ Mesmo contrato |
| Provider | `form.destProvider` | Não usado | ⚠️ Não confirmado |

---

## 6. Quais dados vêm do depósito/origem

| Campo legado | Supabase v2 config | Status |
|---------------|-------------------|--------|
| `ENDEREÇO DO DEPÓSITO` | `ENDERECO DEPOSITO` | ✅ Confirmado |
| Coordenadas (geocodificado em runtime) | `LAT DEPOSITO` / `LNG DEPOSITO` | ⚠️ **`valor = NULL`** — **bloqueante** |
| `ENDEREÇO DA CASA EQP 1/2` | `ENDERECO CASA EQP 1/2` | Não confirmado |

**Ação obrigatória antes de qualquer integração:** preencher `LAT DEPOSITO` e `LNG DEPOSITO` no Supabase com coordenadas reais.

---

## 7. Diferença entre os quatro conceitos de distância

| Conceito | O que mede | Uso | Quando usar |
|----------|-----------|-----|-------------|
| **Haversine** | Linha reta entre 2 pontos (km) | Pré-filtro, diagnóstico, fallback | Rápido, sem API externa |
| **OSRM origem-destino** | Por estradas depósito → destino (km) | Cálculo de frete | Frete real |
| **Delta de inserção (`kmAdicionalNaRotaM`)** | Quanto a rota aumenta ao inserir destino (m) | Classificação normal/especial/premium | Com agenda real |
| **Distância entre pontos da agenda** | Por estradas entre pontos existentes (km) | Construção da rota otimizada | `rotaOtimizada()` |

**Pontos críticos:**
- Haversine ≠ OSRM (20–50% de diferença possível)
- OSRM origem-destino ≠ delta de inserção (um destino a 30km do depósito pode inserir com delta de apenas 2km)
- Delta de inserção ≠ distância entre pontos (delta é custo marginal, não absoluto)

Exemplo: rota `DEPÓSITO → A → B → C`, novo destino `X`. Inserir `X` entre `A` e `B`: delta = OSRM(A→X) + OSRM(X→B) - OSRM(A→B). O menor delta entre todas as posições vira `bestKm`. Se `bestKm = 2 km` e limite base = 3 km → `normal`. Se `bestKm = 7 km` e limite especial = 8 km → `especial`. A distância depósito→X (30 km) serve só para frete, **não** para classificação.

---

## 8. Por que `kmAdicionalNaRotaM: 0` é perigoso

Em `classificacao-candidato.ts:213`: `if (kmAdicionalM <= limiteBaseM) return resultado('normal', ...)`.

Com `0`: `0 <= limiteBaseM` é sempre verdadeiro → **todos os candidatos elegíveis viram `normal`**. Candidatos que deveriam ser `especial` (R$ 220) ou `premium` (R$ 320) aparecem como `normal` (R$ 110–180). Diferença de até R$ 210 por candidato. No frontend, todos caem na aba "Datas disponíveis" (`isExtra: false`), escondendo que deveriam ser extras.

---

## 9. Quando `kmAdicionalNaRotaM: null` é mais seguro

Em `classificacao-candidato.ts:150–158`: quando `null`, candidato é classificado como `indisponivel`, `elegivel: false`, com motivo explícito "Distância adicional na rota ausente ou inválida". **Não aparece para o usuário.**

| Critério | `0` | `null` |
|----------|-----|--------|
| Classificação | `normal` (incorreto) | `indisponivel` |
| Elegível | Sim (perigoso) | Não (seguro) |
| Risco financeiro | Alto (até R$ 210) | Zero |
| Auditabilidade | Ruim | Excelente — sinaliza lacuna |

Usar `null` quando: agenda não integrada, OSRM indisponível, pontos do dia não coletados, qualquer modo não-produção.

---

## 10. Como o v2 deve representar "distância não calculada"

**Três estados obrigatórios para `kmAdicionalNaRotaM`:**

| Estado | Valor | Comportamento |
|--------|-------|---------------|
| **Calculado** | `number >= 0` | Classifica normalmente |
| **Ausente** | `null` | `indisponivel` |
| **Diagnóstico** | `number` + `modoDiagnostico: true` | Classifica, mas sinaliza que não é real |

**Regra:** Nenhum código de produção aceita `kmAdicionalNaRotaM` sem uma das três formas acima.

---

## 11. Como classificar candidatos sem OSRM real

| Opção | Recomendação |
|-------|-------------|
| **A. `kmAdicionalNaRotaM: null`** | ✅ **Recomendado para produção** — seguro, auditável |
| **B. Haversine depósito→destino como proxy** | ❌ Não usar — não é delta de inserção |
| **C. `0` com flag** | ⚠️ Somente testes unitários |
| **D. Aproximação Haversine ao ponto mais próximo** | ⚠️ Diagnóstico apenas |

**Fases:**
- **Fase 1 (atual):** `null` → `indisponivel`; testar pipeline com disponibilidade real
- **Fase 2:** Integrar agenda mínima; calcular delta OSRM para 1–2 casos; comparar com legado
- **Fase 3:** Agenda + OSRM reais; comparação operacional completa

---

## 12. Como preparar futura integração sem afetar produção

1. **Documentar contrato da agenda** — mapear colunas AGENDA, parser `coletarPontosDoDia`, criar `docs/procurar-datas-v2-mapeamento-agenda-shag.md`
2. **Confirmar coordenadas do depósito** — validar/preencher `LAT DEPOSITO` / `LNG DEPOSITO` no Supabase
3. **Testar OSRM do Next.js** — verificar `router.project-osrm.org`; documentar latência; se inacessível, planejar proxy
4. **Criar helper puro de delta** — recebe `originLoc`, `pontos[]`, `novoDestino`; retorna `bestKm`; usa OSRM batch; testes com dados sintéticos
5. **Integrar na rota diagnóstica** — flags `usarAgendaRealDiagnostica` + `usarOsrmReal`; blocos separados; não afeta comportamento padrão
6. **Capturar fixture `caso-sabado`** — validar origem alternativa (`HOME_SAT_E1/E2`) e frete de sábado

**O que NÃO fazer antes da Fase 3:** usar `0` sem flag; integrar ao frontend; remover rota legado; expor candidatos sintéticos como reais; usar Haversine como substituto de OSRM para classificação.

---

## 13. Testes necessários futuramente

- **Helper delta:** 1 ponto → 2 posições; 3 pontos → 4 posições; 0 pontos → delta = OSRM(origem, destino); pontos em linha reta → delta ≈ 0 no meio
- **OSRM:** Curto (<5km), médio (5–25km), longo (>25km) comparados com Google Maps; inacessível → fallback Haversine
- **Comparação legado × v2:** contagem de normais/extras, tipos, frete (±R$ 10), datas (±7 dias)
- **Regressão:** `null` → `indisponivel`; `0` sem flag → erro; `0` com flag → diagnóstico; depósito NULL → erro

---

## 14. Critérios de aprovação antes de usar no frontend

### Bloqueantes

| Critério | Verificação |
|----------|-------------|
| `LAT/LNG DEPOSITO` ≠ NULL no Supabase | Confirmado |
| OSRM acessível do Next.js | Teste `/route/v1/driving` |
| Agenda (`shAg`) lida corretamente | Parser retorna pontos com coords |
| Delta OSRM ≈ delta legado (±20%) | 3 fixtures |
| `null` → 0 elegíveis | Com agenda ausente |
| `0` sem flag → erro | Validação explícita |
| Frete v2 ≈ frete legado (±R$ 10) | Fixtures conhecidas |
| Tipos batem (normal/especial/premium) | Fixture 1 e 2 |

### Não-bloqueantes

| Critério | Tolerância |
|----------|-----------|
| Delta v2 vs legado | ≤ 20% |
| Latência OSRM | ≤ 5s adicional |
| Caso sábado, hora-marcada, sem disponibilidade | Capturar fixtures separadas |

---

## 15. Riscos confirmados

| Risco | Confirmação | Impacto | Mitigação |
|-------|------------|---------|-----------|
| `kmAdicionalNaRotaM: 0` sem flag → tudo `normal` | `classificacao-candidato.ts:213` | Crítico — erro frete até R$ 210 | Exigir `modoDiagnostico: true` ou rejeitar |
| `LAT/LNG DEPOSITO` = NULL | Supabase | Alto — impede cálculo | Preencher antes de integrar |
| OSRM inacessível do Next.js | Não testado | Alto — impede delta real | Testar conectividade antes |
| Agenda (`shAg`) não mapeada no v2 | Não há parser | Alto — impede delta real | Criar `coletarPontosDoDia` equivalente |
| Haversine como substituto de OSRM | Código existe | Médio — classificação errada | Documentar: Haversine = só fallback |
| Fast-pass usa Haversine×1.3 | CEP-APIBACK.gs:767 | Baixo | Não replicar como real |

---

## 16. Documentação relacionada

- `docs/procurar-datas-motor-v2-progresso.md`
- `docs/procurar-datas-v2-plano-comparacao-operacional.md`
- `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md`
- `appscript/CEP-CONFIG.gs` (config, rota, distância, OSRM)
- `appscript/CEP-APIBACK.gs` (pesquisa principal, loop de simulação)
- `src/lib/procurar-datas/motor/distancia.ts`
- `src/lib/procurar-datas/motor/frete.ts`
- `src/lib/procurar-datas/motor/classificacao-candidato.ts`
- `src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.ts`
- `src/app/api/procurar-datas/v2/diagnostico/route.ts`
