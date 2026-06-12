# Motor v2 — Próximas Etapas Operacionais

> **Data:** 12 de junho de 2026  
> **Status:** Planejamento — sem implementação  
> **Propósito:** Mapear as próximas etapas operacionais para evoluir o motor v2 de diagnóstico até teste controlado e eventual substituição do legado.  
> **Não altera código. Não altera produção. Não substitui leitura real do código.**

---

## 1. Objetivo

Este documento define:

- O estado atual do motor v2 (o que está pronto, o que é sintético)
- O plano para integrar dados reais (disponibilidade, OSRM, configuração)
- A estratégia segura para comparação operacional e integração futura com o frontend
- Os critérios claros para considerar o v2 pronto para teste controlado e, depois, para substituição do legado

Não é um plano de sprint. É um mapa de riscos e dependências para orientar decisões futuras.

---

## 2. Estado atual

### 2.1 Motor v2 é exclusivamente diagnóstico

- Rota: `POST /api/procurar-datas/v2/diagnostico`
- Modo: isolado, sem impacto em produção
- Nenhuma rota do frontend aponta para o v2
- Nenhum dado real de agenda ou disponibilidade é lido
- Não chama Apps Script, OSRM, Google Calendar, Supabase (exceto config) nem planilha de agenda

### 2.2 Motor legado continua sendo a única fonte de produção

O fluxo de produção completo é:

```
Frontend → POST /api/procurar-datas/pesquisar
  → chamarAppsScriptProcurarDatas('ApiIniciarPesquisaDatasApp')
  → polling via GET /api/procurar-datas/progresso
  → Apps Script: planilha de agenda → OSRM → cálculo de frete → candidatos
  → retorno ao frontend
```

Qualquer alteração nesse fluxo afeta diretamente o usuário final.

### 2.3 Rota `/api/procurar-datas/valor-inicial`

- Comportamento atual (restaurado): delega ao Apps Script `calcularValorInicialModal`
- Apps Script: geocodifica depósito em runtime → OSRM → `calcularFrete` → `+20%`
- **Não foi alterada pela implementação anterior (rollback executado)**

---

## 3. O que já está pronto

### 3.1 Helpers puros (todos com testes)

| Helper | Função | Testes |
|--------|--------|--------|
| `entrada.ts` | Normalização de entrada | 19 |
| `tempo.ts` | Conversão HH:MM ↔ minutos | 31 |
| `equipe.ts` | Normalização de string de equipe | 26 |
| `distancia.ts` | Haversine (distância geodésica) | 14 |
| `frete.ts` | Cálculo de frete por distância e flags | 51 |
| `datas.ts` | Operações puras de data | 13 |
| `janela-datas.ts` | Janela cronológica de pesquisa | 16 |
| `disponibilidade.ts` | Filtro/enriquecimento de disponibilidade | 19 |
| `classificacao-candidato.ts` | Classificação de cenário operacional | 35 |
| `candidato.ts` | Montagem de candidato preliminar | 22 |
| `ordenacao-candidatos.ts` | Ordenação diagnóstica de candidatos | 25 |
| `adaptador-candidato-legado.ts` | Adapter v2 → formato contrato legado | 40 |

Total: **352 testes passando** em `npm run test`.

### 3.2 Rota diagnóstica

`POST /api/procurar-datas/v2/diagnostico` funcional com cadeia completa:
entrada → config → frete(Haversine) → janela → disponibilidade(sintético) → classificação(sintético) → candidatos → ordenação → JSON

### 3.3 Comparação estrutural legado × v2

- `comparacao-legado-v2.ts` + testes (26)
- `GET /api/procurar-datas/v2/comparar` (lê fixtures do sistema de arquivos, sem I/O externo)
- Fixtures reais capturadas: `caso-normal-simples-2026-06-12.json`, `caso-premium-ou-especial-2026-06-12.json`

### 3.4 Adapter de candidato

`adaptarCandidatoV2ParaContratoLegadoDiagnostico()` — converte `CandidatoPreliminarV2` para estrutura compatível com `CandidatoFinal` do legado, com campo `diagnosticoV2` extra para rastreabilidade.

### 3.5 Config service

`buscarConfiguracoesProcurarDatas()` — lê `procurar_datas_config` do Supabase com fallback para planilha. Usado pela rota diagnóstica.

---

## 4. O que ainda é sintético

### 4.1 Disponibilidade

O `filtrarDisponibilidadePorJanelaV2()` recebe um array de disponibilidade sintético (hardcoded na rota diagnóstica). Ele não lê a planilha `shAv` (TEMPO DISPONIVEL) nem o Supabase.

**Impacto:** Nenhum candidato do v2 diagnóstico reflete capacidade de equipe real.

### 4.2 Pontos de entrega do dia (agenda)

O motor v2 não lê a planilha `shAg` (AGENDA). Não há pontos geográficos reais para calcular `delta` (km adicional na rota).

**Impacto:** `kmAdicionalNaRotaM` usado na classificação é sintético (fixo em 0). Tipos especial/premium não são classificados corretamente.

### 4.3 Distância por OSRM

O v2 usa Haversine. O legado usa OSRM (distância real por estradas).

**Impacto:** Frete calculado pelo v2 pode divergir do legado, especialmente em endereços com geometria irregular (zonas industriais, rurais, ilhas).

### 4.4 Coordenadas do depósito

O Apps Script geocodifica o depósito em runtime via Google Maps/OSRM. O v2 não tem essa origem configurada de forma validada.

**Impacto:** Sem origem, `haversineKm` não pode ser calculado com ponto de partida real.

---

## 5. Disponibilidade real

### 5.1 Origem

A fonte real é a planilha `shAv` (TEMPO DISPONIVEL), lida pelo Apps Script na função `getSlots()` (`CEP-CONFIG.gs`).

### 5.2 Campos necessários

Por data e equipe, o motor precisa de:

| Campo | Origem | Status |
|-------|--------|--------|
| `date` | Planilha shAv | Não acessado pelo Next.js |
| `team` | Planilha shAv | Não acessado pelo Next.js |
| `availStr` | Planilha shAv | Não acessado pelo Next.js |
| `disponivelMin` | Calculado a partir de `availStr` | Não acessado pelo Next.js |

### 5.3 Riscos

- Planilha pode ter formato não documentado completamente
- Alterações na planilha não refletem em tipos TypeScript automaticamente
- `shAv` pode ter linhas extras, mesclagens ou formatação variável
- Acesso direto ao Sheets pelo Next.js requer autenticação Google (Service Account)

### 5.4 Plano

1. Confirmar o formato exato de `shAv` lendo `getSlots()` em `CEP-CONFIG.gs`
2. Mapear os campos retornados por `getSlots()` em fixture real (ainda não capturado)
3. Avaliar se o acesso deve ser via Apps Script (chamada dedicada) ou diretamente via Google Sheets API no Next.js
4. Criar helper `lerDisponibilidadeReal()` como camada de isolamento
5. Substituir o array sintético da rota diagnóstica apenas quando a leitura real estiver validada

---

## 6. OSRM real

### 6.1 Origem

O legado chama `getDrivingKm(origem, destino)` em `CEP-APIBACK.gs`, que faz requisição HTTP ao OSRM (`OSRM BASE URL` da config).

### 6.2 Campos necessários

| Campo | Origem | Status |
|-------|--------|--------|
| `OSRM BASE URL` | `procurar_datas_config` | Presente no Supabase (valor não exposto ao Next.js atualmente) |
| `origem` (depósito) | Geocodificado em runtime pelo Apps Script | Não disponível no Next.js |
| `destino` (cliente) | Fornecido pelo frontend | Disponível no body do request |

### 6.3 Riscos

- `OSRM BASE URL` é lida pelo Apps Script via `getConfig()`, não pelo Next.js diretamente
- O OSRM pode ser instância própria ou serviço externo — não confirmado qual
- Latência do OSRM desconhecida a partir do Next.js
- Haversine e OSRM podem divergir significativamente para endereços específicos (estradas, bairros fragmentados)

### 6.4 Diferença Haversine × OSRM

- Haversine: distância em linha reta, rápida, sem acesso externo
- OSRM: distância real por estradas, mais precisa, depende de disponibilidade do serviço
- Para faixas de até 10km: diferença pequena, mas pode impactar frete em endereços limítrofes
- Para faixas maiores: diferença pode ser relevante

### 6.5 Plano

1. Confirmar a URL do OSRM e se é acessível a partir do Next.js
2. Criar helper `calcularDistanciaOsrm(origem, destino)` isolado com fallback para Haversine
3. Integrar no v2 diagnóstico apenas, com flag `tipoDistancia: 'osrm' | 'haversine_fallback'`
4. Comparar resultados OSRM × Haversine para os casos de fixture capturados
5. Só considerar substituição quando a diferença for mapeada e aceita

---

## 7. Valor inicial / frete inicial

### 7.1 Estado atual da rota

`POST /api/procurar-datas/valor-inicial` **continua delegando ao Apps Script `calcularValorInicialModal`**.

Fluxo no Apps Script:
1. Lê `ENDEREÇO DO DEPÓSITO` da planilha de config
2. Geocodifica o depósito (cache ou `geocodeAddressFree`)
3. Recebe destino do cliente no body
4. Chama `getDrivingKm(depositoLoc, locNovo)` → OSRM com fallback Haversine
5. Calcula frete com `calcularFrete(distKm, isSabado, isRural, isCondo)` + `aplicarAjusteFrete(+20%, ceil, min=110)`

### 7.2 Tentativa anterior (revertida)

Na sessão anterior, a rota foi substituída por uma implementação direta em Next.js usando:
- `haversineKm(depósito, cliente)` com coordenadas do depósito buscadas no Supabase
- `calcularFrete()` do motor v2

**Por que foi revertida:**
- A rota é usada pelo frontend atual em produção
- O legado usa OSRM — substituir por Haversine sem comparação prévia pode alterar valores exibidos no modal
- As coordenadas do depósito não estavam validadas (linhas `LAT DEPOSITO` e `LNG DEPOSITO` criadas no Supabase com `valor = NULL`)
- Não havia critério de paridade estabelecido antes da substituição
- A mudança não estava no escopo autorizado da Frente 3

### 7.3 Situação das linhas Supabase

As linhas `LAT DEPOSITO` e `LNG DEPOSITO` foram criadas na tentativa anterior e permanecem na tabela `procurar_datas_config` com `valor = NULL`. Não são lidas por nenhuma rota ativa. **Não foram apagadas** — remoção deve ser decidida manualmente.

### 7.4 Por que não substituir produção ainda

- Haversine não substitui OSRM para decisão final de valor exibido ao usuário
- Não há comparação sistemática entre o valor retornado pelo Apps Script e o valor que seria retornado pela versão Next.js
- Coordenadas do depósito precisam ser validadas antes de qualquer uso em cálculo real
- O modal exibe o valor inicial ao usuário antes de pesquisar — um valor incorreto pode gerar expectativa errada

### 7.5 Pré-requisito para considerar a substituição

- [ ] Capturar ao menos 10 respostas reais do Apps Script `calcularValorInicialModal` com valores de frete e distância
- [ ] Implementar versão Next.js em rota paralela (ex: `/api/procurar-datas/valor-inicial/v2`) sem afetar a produção
- [ ] Comparar os valores lado a lado para os mesmos endereços
- [ ] Confirmar coordenadas reais do depósito
- [ ] Aceitar e documentar diferença máxima tolerável (ex: ≤ R$10)
- [ ] Apenas então, com aprovação explícita, substituir a rota de produção

---

## 8. Comparação operacional real

### 8.1 O que comparar agora (possível)

- Estrutura dos candidatos legado × v2 (já implementado em `comparacao-legado-v2.ts`)
- Campos presentes/ausentes por tipo de candidato (normal, especial, premium, hora-marcada)
- Formato de `dateISO`, `frete`, `tipo`, `rank`, `isExtra`

### 8.2 O que NÃO comparar ainda

- Valor de frete: distância legado (OSRM) ≠ distância v2 (Haversine)
- Ordenação final: pontos de âncora e delta são sintéticos no v2
- Disponibilidade: dados sintéticos no v2, reais no legado
- Número de candidatos: v2 não lê agenda real

### 8.3 Quando comparar resultados operacionais completos

Somente quando o v2 tiver:
1. Disponibilidade real integrada
2. OSRM real (ou comparação documentada com Haversine)
3. Pontos de entrega reais do dia

---

## 9. Integração frontend futura

### 9.1 Estratégia segura

**Não substituir o fluxo principal antes de todos os pré-requisitos estarem atendidos.**

Estratégia recomendada:

1. **Modo shadow (paralelo silencioso):** O frontend continua chamando o legado. Em paralelo, o backend chama o v2 e registra a comparação em log. Nenhuma resposta do v2 chega ao usuário.
2. **Modo A/B controlado:** Após validação do shadow mode com N pesquisas, habilitar v2 para um subconjunto de usuários internos.
3. **Substituição gradual:** Só após modo A/B validado e aceito.

### 9.2 Riscos de integração prematura

- Usuário pode ver candidatos diferentes ou valor de frete diferente sem explicação
- Datas indisponíveis podem aparecer como disponíveis (ou vice-versa) se disponibilidade for sintética
- Pré-agendamento pode ser feito com dados inconsistentes

### 9.3 O que NÃO fazer

- Não integrar o v2 na rota de produção enquanto usar dados sintéticos
- Não expor `POST /api/procurar-datas/v2/diagnostico` ao frontend sem feature flag
- Não substituir `POST /api/procurar-datas/pesquisar` sem comparação completa validada

---

## 10. Performance, timeout e worker

### 10.1 Legado

- O Apps Script é assíncrono por polling
- Timeout atual: 20s (padrão), 420s (modo captura com `modoCaptura=1`)
- Latência observada em fixture: ~182s para pesquisa completa

### 10.2 v2 (quando tiver dados reais)

- O v2 atual responde em < 500ms (dados sintéticos)
- Com OSRM real: adiciona latência de rede (desconhecida)
- Com leitura de planilha: adiciona latência da Google Sheets API (1–5s típico)
- Com agenda real: adicionar latência de leitura e processamento de N pontos

### 10.3 Considerações

- O v2 pode ser síncrono se a latência total for aceitável (< 10s)
- Se OSRM ou planilha for lento, considerar cache via Supabase ou Redis
- O modelo de polling do legado pode ser mantido como camada de compatibilidade mesmo com motor v2 interno
- Definir timeout máximo antes de iniciar qualquer integração de I/O real

---

## 11. Ordem recomendada das próximas etapas

```
Etapa 1 — [Documentação] Confirmar formato de shAv e pontos de shAg
  → Ler getSlots() e coletarPontosDoDia() no CEP-CONFIG.gs
  → Capturar fixture intermediária com dados de slot/ponto
  → Sem alteração de código

Etapa 2 — [Backend isolado] Leitura real de disponibilidade
  → Criar helper lerDisponibilidadeReal() via Apps Script ou Sheets API
  → Integrar na rota diagnóstica com flag opcional
  → Sem afetar produção

Etapa 3 — [Backend isolado] OSRM real ou comparação documentada
  → Confirmar URL e acessibilidade do OSRM
  → Criar helper calcularDistanciaOsrm() com fallback Haversine
  → Comparar distâncias para os casos de fixture capturados

Etapa 4 — [Documentação] Comparação operacional completa
  → Comparar candidatos legado × v2 para mesmos inputs
  → Documentar diferenças e causas

Etapa 5 — [Análise] Valor inicial / frete
  → Capturar N respostas do Apps Script calcularValorInicialModal
  → Criar rota v2 paralela (não de produção)
  → Comparar valores lado a lado
  → Só então propor substituição

Etapa 6 — [Shadow mode] Integração silenciosa
  → Frontend continua no legado
  → v2 roda em paralelo, resultado logado, não exibido

Etapa 7 — [A/B controlado] Usuários internos
  → Somente após Etapa 6 validada

Etapa 8 — [Substituição] Gradual
  → Somente após Etapa 7 validada com aprovação explícita
```

---

## 12. Riscos conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Haversine diverge do OSRM para endereços específicos | Alta | Médio | Nunca usar Haversine como frete final sem comparação |
| Disponibilidade sintética gera candidatos errados | Certa | Alto | Não integrar no frontend antes de dados reais |
| Coordenadas do depósito incorretas ou desatualizadas | Média | Alto | Validar antes de qualquer uso em cálculo |
| Planilha shAv muda formato sem aviso | Média | Alto | Criar camada de isolamento com testes de contrato |
| OSRM indisponível em produção Next.js | Desconhecida | Alto | Validar acesso antes de integrar |
| Linhas `LAT DEPOSITO`/`LNG DEPOSITO` no Supabase com valor NULL sendo lidas acidentalmente | Baixa | Médio | Linhas ativas, mas não lidas por nenhuma rota atual |
| Substituição prematura altera valores exibidos no modal | Média | Alto | Seguir pré-requisitos do item 7.5 estritamente |

---

## 13. Critérios para considerar o v2 pronto para teste controlado

- [ ] Disponibilidade real integrada na rota diagnóstica (não sintética)
- [ ] Pontos de entrega reais do dia integrados
- [ ] OSRM real integrado ou divergência com Haversine documentada e aceita
- [ ] Comparação estrutural e operacional entre legado e v2 para os 8 casos de fixture
- [ ] Rota diagnóstica responde em < 10s para caso típico
- [ ] Nenhum dado sintético em produção

---

## 14. Critérios para substituir o legado

- [ ] Todos os critérios do item 13 atendidos
- [ ] Shadow mode executado por ao menos 2 semanas com divergências documentadas
- [ ] Aprovação explícita do responsável pelo produto
- [ ] Rollback planejado e documentado (como reverter se algo falhar)
- [ ] Modo A/B validado com usuários internos
- [ ] Sem regressão nos 8 casos de fixture
- [ ] Pré-agendamento testado e validado com dados do v2

---

## 15. Pendências

### Pendências técnicas

- Confirmar formato real de `shAv` (planilha TEMPO DISPONIVEL) — não mapeado ainda
- Confirmar URL e acessibilidade do OSRM a partir do Next.js
- Confirmar coordenadas reais do depósito (`R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450`)
- Capturar fixture de `caso-sem-disponibilidade`, `caso-sabado`, `caso-rural-condominio`, `caso-hora-marcada`
- Decidir se linhas `LAT DEPOSITO`/`LNG DEPOSITO` no Supabase (valor NULL) devem ser mantidas para uso futuro ou removidas

### Pendências de decisão

- Definir se a leitura de disponibilidade real será via Apps Script dedicado ou Sheets API no Next.js
- Definir timeout máximo aceitável para a rota v2 em produção
- Definir critério de divergência tolerável entre frete legado e frete v2 (ex: ≤ R$10)

---

## 16. Próximo passo recomendado

**Etapa 1 — Documentação/análise de `shAv` e pontos do dia**

Sem alterar código, ler `getSlots()` e `coletarPontosDoDia()` em `CEP-CONFIG.gs` para:
- Confirmar o formato das linhas da planilha de disponibilidade
- Confirmar o formato dos pontos de entrega do dia
- Documentar os campos necessários para substituir os dados sintéticos

Isso desbloqueia a Etapa 2 sem risco de produção.
