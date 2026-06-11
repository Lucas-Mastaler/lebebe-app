# Codemap do motor `/procurar-datas`

> Criado em: junho/2026
> Fontes auditadas: `PublicAPI.gs`, `CEP-APIBACK.gs`, `CEP-CONFIG.gs`, APIs Next.js, `apps-script.ts`, `types.ts`, `config-service.ts`, `config-db.ts`, motor TypeScript.

---

## 1. Objetivo

Este documento mapeia o fluxo atual do motor legado de `/procurar-datas` e registra o estado da migração gradual para TypeScript.

O objetivo é fornecer uma visão ponta a ponta para orientar futuras microetapas de migração, sem substituir a leitura real do código.

---

## 2. Escopo

- Este documento é **apenas documentação**.
- **Não altera código**.
- **Não altera produção**.
- **Não substitui leitura real do código** — cada função citada deve ser relida antes de qualquer alteração.
- Serve como referência para futura migração do motor v2.

---

## 3. Resumo executivo

1. O frontend (`/procurar-datas`) chama APIs Next.js em `/api/procurar-datas/**`.
2. Cada API Next.js delega ao Apps Script via `chamarAppsScriptProcurarDatas()`.
3. O motor principal ainda roda inteiramente no Apps Script (`pesquisarRotaToTargetWithParams`).
4. O TypeScript atual contém **apenas helpers puros isolados** (frete, tempo, equipe, distância, datas) — nenhum deles é chamado pelo motor em produção ainda.
5. A planilha `shAg` (AGENDA) é a fonte de pontos de entrega do dia.
6. A planilha `shAv` (TEMPO DISPONIVEL) é a fonte de slots disponíveis.
7. A config principal ainda é lida da planilha (`cfgSheet`) pelo Apps Script; o espelho no Supabase (`procurar_datas_config`) é usado apenas pela tela de configuração Next.js.
8. **Google Calendar não participa do motor de busca de datas** — é usado exclusivamente no pré-agendamento (`preAgendarDireto`), após o usuário escolher uma data.

---

## 4. Fluxo ponta a ponta atual

```
Usuário preenche /procurar-datas
  ↓
Frontend chama POST /api/procurar-datas/pesquisar
  ↓
API Next.js chama chamarAppsScriptProcurarDatas('ApiIniciarPesquisaDatasApp', [form])
  ↓
ApiIniciarPesquisaDatasApp (PublicAPI.gs:88)
  - Valida/cria clientToken
  - Grava job em PropertiesService ('PROCURAR_DATAS_JOB_{token}')
  - Enfileira clientToken em 'PROCURAR_DATAS_QUEUE'
  - Cria trigger de tempo (_procurarDatasEnsureWorkerTrigger_)
  - Retorna { ok: true, clientToken, status: 'started' }
  ↓
Frontend recebe clientToken e começa polling em GET /api/procurar-datas/progresso?clientToken=...
  ↓
API Next.js chama chamarAppsScriptProcurarDatas('GetProgressUpdate', [clientToken])
  ↓
GetProgressUpdate (PublicAPI.gs:919) → getProgressUpdate (CEP-APIBACK.gs:251)
  - Lê 'PROGRESS_{clientToken}' do PropertiesService
  - Retorna { status: 'queued'|'running'|'done'|'error', normais: [], extras: [] }
  ↓ (enquanto isso, trigger de tempo dispara)
ApiExecutarPesquisaDatasWorker (PublicAPI.gs:168)
  - Adquire LockService
  - Lê fila, pega clientToken
  - Marca job como 'running' em PropertiesService
  - Chama ApiPesquisarDatasApp(job.form)
  ↓
ApiPesquisarDatasApp (PublicAPI.gs:45)
  - Chama pesquisarRotaToTargetWithParams(FRONT_ID, TARGET_TAB, form)
  ↓
pesquisarRotaToTargetWithParams (CEP-APIBACK.gs:299) — MOTOR PRINCIPAL
  - Abre planilha fonte (abrirPlanilhaFonte_)
  - Lê cfgSheet (config por ID de aba)
  - Carrega todos os parâmetros de config (km, frete, endereços, equipes...)
  - Abre shAv (TEMPO DISPONIVEL) e shAg (AGENDA)
  - Geocodifica destino (ResolverEnderecoComCache_ ou por CEP)
  - Chama getSlots(shAv, minMin, lookDays, ...) → lista de slots candidatos
  - Para cada slot: s.pontos = coletarPontosDoDia(s, agVals, agDisp)
    - Lê agVals e agDisp da planilha shAg
    - Geocodifica cada endereço via ResolverEnderecoComCache_
    - Monta array de ponto { addr, loc, eventTitle, cep, cepSource }
  - Filtra slots por regras (quarta/EQUIPE 2, horário, tipo de berço)
  - Para cada slot com pontos: calcula nearestPoint e delta via getDrivingKm/OSRM
  - Monta candidatos { date, team, delta, nearestPoint, ... }
  - Calcula frete de cada candidato (calcularFrete + aplicarAjusteFrete)
  - Classifica candidatos em: normais, especiais, premium, hora-marcada
  - Executa filtrarPorRegiaoOperacional_ e selecionarConjuntoApp3ComExtras_
  - Salva progresso incremental em PropertiesService (throttle 1s)
  - Retorna payload { candidates: [...], address, ... }
  ↓
Worker salva resultado final em PropertiesService (status: 'done')
  ↓
Próximo polling do frontend recebe status: 'done' com normais + extras
  ↓ (usuário escolhe uma data)
Frontend chama POST /api/procurar-datas/pre-agendar { cand, meta }
  ↓
API Next.js chama chamarAppsScriptProcurarDatas('ApiPreAgendarDireto', [cand, meta])
  ↓
ApiPreAgendarDireto (PublicAPI.gs:362) → preAgendarDireto(cand, meta)
  - USA CalendarApp.getCalendarById(PRE_CALENDAR_ID) para criar evento
  - Grava auditoria na planilha
  - Retorna { ok: true, eventLink, ... }
```

---

## 5. Mapa de arquivos

| Arquivo | Papel no fluxo | Tipo | Pode mexer agora? | Observações |
|---------|----------------|------|-------------------|-------------|
| `src/app/procurar-datas/page.tsx` | Interface do usuário | Frontend | ❌ Não | Fora do escopo desta migração |
| `src/app/api/procurar-datas/pesquisar/route.ts` | Inicia pesquisa assíncrona | API Next.js | ❌ Não | Chama `ApiIniciarPesquisaDatasApp` |
| `src/app/api/procurar-datas/progresso/route.ts` | Polling de progresso | API Next.js | ❌ Não | Chama `GetProgressUpdate` |
| `src/app/api/procurar-datas/pre-agendar/route.ts` | Pré-agendamento | API Next.js | ❌ Não | Chama `ApiPreAgendarDireto` |
| `src/app/api/procurar-datas/calcular-tempo/route.ts` | Calcula tempo necessário | API Next.js | ❌ Não | Chama `GetTempoNecessario` |
| `src/app/api/procurar-datas/opcoes/route.ts` | Listas de opções do formulário | API Next.js | ❌ Não | Chama `GetFrontOptionLists` + `GetTempoMap` |
| `src/app/api/procurar-datas/validar-endereco/route.ts` | Validação/geocoding de endereço | API Next.js | ❌ Não | Chama `LookupCompletoPorEndereco` |
| `src/app/api/procurar-datas/valor-inicial/route.ts` | Calcula valor inicial do modal | API Next.js | ❌ Não | Chama `calcularValorInicialModal` |
| `src/lib/procurar-datas/apps-script.ts` | Bridge Next.js → Apps Script | Bridge Apps Script | ❌ Não | `chamarAppsScriptProcurarDatas()` com timeout e log |
| `src/lib/procurar-datas/types.ts` | Tipos TypeScript do módulo | Tipos TypeScript | ⚠️ Com cuidado | Define `AppsScriptProcurarDatasFunction`, formulários, candidato |
| `src/lib/procurar-datas/config-service.ts` | Leitura/normalização de config | Banco/config | ⚠️ Com cuidado | Supabase + fallback planilha; usado pela tela de config |
| `src/lib/procurar-datas/config-db.ts` | CRUD Supabase de config | Banco/config | ⚠️ Com cuidado | Importação manual, diff, auditoria — não usado pelo motor |
| `src/lib/procurar-datas/sheets-config.ts` | Leitura de config da planilha | Banco/config | ❌ Não | Fallback usado por `config-service.ts` |
| `src/lib/procurar-datas/api.ts` | Helpers de auth/erro para rotas | Helper Next.js | ❌ Não | `validarAcessoProcurarDatas`, `respostaErroProcurarDatas` |
| `src/lib/procurar-datas/motor/frete.ts` | Cálculo de frete puro | Helper TypeScript puro | ✅ Somente com testes e sem integrar em produção | Portado. Não chamado em produção ainda |
| `src/lib/procurar-datas/motor/tempo.ts` | Conversões de tempo puro | Helper TypeScript puro | ✅ Somente com testes e sem integrar em produção | Portado. Não chamado em produção ainda |
| `src/lib/procurar-datas/motor/equipe.ts` | Normalização de equipe puro | Helper TypeScript puro | ✅ Somente com testes e sem integrar em produção | Portado. Não chamado em produção ainda |
| `src/lib/procurar-datas/motor/distancia.ts` | Haversine puro | Helper TypeScript puro | ✅ Somente com testes e sem integrar em produção | Portado. Não chamado em produção ainda |
| `src/lib/procurar-datas/motor/datas.ts` | Helpers de data puro | Helper TypeScript puro | ✅ Somente com testes e sem integrar em produção | Portado. Não chamado em produção ainda |
| `src/lib/procurar-datas/motor/types.ts` | Tipos internos do motor TS | Tipos TypeScript | ✅ Sim | Tipos de `FreteParams`, `FreteInput`, etc. |
| `appscript/PublicAPI.gs` | Pontos de entrada expostos | Apps Script motor | ❌ Não | Todos os endpoints públicos estão aqui |
| `appscript/CEP-APIBACK.gs` | Motor principal de pesquisa | Apps Script motor | ❌ Não | `pesquisarRotaToTargetWithParams`, candidatos, ranking |
| `appscript/CEP-CONFIG.gs` | Helpers, config, geocoding | Apps Script config | ❌ Não | `getSlots`, `coletarPontosDoDia`, frete, haversine, OSRM |

---

## 6. Pontos de entrada

### `POST /api/procurar-datas/pesquisar` → `ApiIniciarPesquisaDatasApp`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend após submissão do formulário |
| **Recebe** | `ProcurarDatasServicoForm` (cep, tipoBerco, tempoNecessario, isRural, isCondominio, clientToken, ...) |
| **Retorna** | `{ ok, clientToken, status: 'started' }` |
| **Síncrono?** | Assíncrono — enfileira job, dispara trigger de tempo |
| **Papel** | Ponto de entrada principal da pesquisa |

### `GET /api/procurar-datas/progresso` → `GetProgressUpdate`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend em polling (intervalo regular) |
| **Recebe** | `?clientToken=...` (query string) |
| **Retorna** | `{ ok, progress: { status, normais, extras } }` |
| **Síncrono?** | Síncrono — lê `PropertiesService` |
| **Papel** | Acompanhamento do progresso da pesquisa |

### `POST /api/procurar-datas/pre-agendar` → `ApiPreAgendarDireto`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend após usuário escolher candidato |
| **Recebe** | `{ cand: ProcurarDatasCandidate, meta: ProcurarDatasPreAgendamentoMeta }` |
| **Retorna** | `{ ok, eventLink, ... }` |
| **Síncrono?** | Síncrono (timeout 60s) |
| **Papel** | Cria evento no Google Calendar — ÚNICO uso de CalendarApp |

### `POST /api/procurar-datas/calcular-tempo` → `GetTempoNecessario`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend ao montar o formulário |
| **Recebe** | `ProcurarDatasServicoForm` |
| **Retorna** | `{ ok, tempoNecessario: string }` (formato `"HH:MM"`) |
| **Síncrono?** | Síncrono |
| **Papel** | Suporte — calcula tempo necessário de serviço com base nos itens |

### `GET /api/procurar-datas/opcoes` → `GetFrontOptionLists` + `GetTempoMap`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend na inicialização da página |
| **Recebe** | Nenhum parâmetro |
| **Retorna** | `{ ok, opcoes, tempoMap }` |
| **Síncrono?** | Síncrono (paralelo interno) |
| **Papel** | Suporte — popula dropdowns de berço, cômoda, roupeiro, etc. |

### `POST /api/procurar-datas/validar-endereco` → `LookupCompletoPorEndereco`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend ao validar endereço digitado |
| **Recebe** | `ProcurarDatasEnderecoForm` |
| **Retorna** | `{ ok, resultado }` (coordenadas + endereço normalizado) |
| **Síncrono?** | Síncrono |
| **Papel** | Suporte — geocodifica endereço antes da pesquisa |

### `POST /api/procurar-datas/valor-inicial` → `calcularValorInicialModal`

| Campo | Valor |
|-------|-------|
| **Quem chama** | Frontend ao exibir valor estimado no modal |
| **Recebe** | `ProcurarDatasServicoForm` |
| **Retorna** | `{ ok, resultado: { valor, valorFormatado, distanciaKm, fallbackUsado } }` |
| **Síncrono?** | Síncrono (timeout 60s) |
| **Papel** | Suporte — calcula valor inicial estimado com distância real via OSRM |

### `ApiExecutarPesquisaDatasWorker` (interno — via trigger de tempo)

| Campo | Valor |
|-------|-------|
| **Quem chama** | Trigger de tempo do Apps Script (criado por `ApiIniciarPesquisaDatasApp`) |
| **Recebe** | Nenhum parâmetro direto — lê fila do PropertiesService |
| **Retorna** | Nada (resultado salvo em PropertiesService) |
| **Síncrono?** | Assíncrono — executa em background |
| **Papel** | Worker que executa a pesquisa real chamando `ApiPesquisarDatasApp` |

---

## 7. Funções principais do Apps Script

### `getSlots` (`CEP-CONFIG.gs`, linhas ~1574–1594)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Lê planilha `shAv` (TEMPO DISPONIVEL) e monta lista de slots disponíveis |
| **Entradas** | `sh` (aba), `minMin` (minutos mínimos), `lookDays`, `startDate`, `endDate` |
| **Saídas** | `Array<{ date, team, availStr }>` |
| **Dependências** | SpreadsheetApp (shAv), `normTeam()`, `parseMinutes()` |
| **I/O** | ✅ Sim — lê planilha |
| **Candidata migração** | Não — depende de I/O de planilha |
| **Risco** | Alto — qualquer alteração quebra a leitura de disponibilidade |

### `coletarPontosDoDia` (`CEP-CONFIG.gs`, linhas ~1596–1762)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Para cada slot, lê as linhas da planilha `shAg` (AGENDA) correspondentes ao dia/equipe e geocodifica cada endereço |
| **Entradas** | `slot`, `vals` (agVals), `disp` (agDisp) — dados da planilha AGENDA |
| **Saídas** | `Array<{ addr, loc, eventTitle, cep, cepSource }>` |
| **Dependências** | `ResolverEnderecoComCache_`, `ConsultarCacheSupabaseBatch_`, geocoding providers, `normTeam()` |
| **I/O** | ✅ Sim — lê planilha (via parâmetro), chama geocoding e Supabase |
| **Candidata migração** | Não — acoplada a I/O de planilha e geocoding |
| **Risco** | Alto — envolve geocoding, cache Supabase, parsing de endereço |

> **Nota confirmada:** `eventTitle` = `disp[i][2]` (coluna 3 da planilha AGENDA). **Não vem do Google Calendar.**

### `getDrivingKm` (`CEP-CONFIG.gs`, linhas ~706–730)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Calcula distância em km entre dois pontos via OSRM, com fallback para Haversine e cache L1 (`CacheService`) |
| **Entradas** | `a: { lat, lng }`, `b: { lat, lng }` |
| **Saídas** | `number` (km) |
| **Dependências** | OSRM REST, CacheService, `haversine()` |
| **I/O** | ✅ Sim — HTTP OSRM + CacheService |
| **Candidata migração** | Não — depende de OSRM e CacheService |
| **Risco** | Alto — usado em toda a lógica de delta e nearestPoint |

### `getDrivingKmBatch` (`CEP-CONFIG.gs`, linhas ~738–)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Versão batch de `getDrivingKm` — calcula múltiplas rotas com 1 ou N chamadas OSRM |
| **Entradas** | `Array<{ from: { lat, lng }, to: { lat, lng } }>` |
| **Saídas** | `Array<number>` (km, mesma ordem) |
| **Dependências** | OSRM REST, CacheService |
| **I/O** | ✅ Sim |
| **Candidata migração** | Não |
| **Risco** | Alto — usado para nearestPoint em lote |

### `haversine` (`CEP-CONFIG.gs`, linhas ~1863–1867)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Distância geodésica (km) entre dois pontos via fórmula de Haversine |
| **Entradas** | `lat1, lon1, lat2, lon2` |
| **Saídas** | `number` (km) |
| **Dependências** | Nenhuma |
| **I/O** | ❌ Não |
| **Candidata migração** | ✅ **Já portada** — `distancia.ts:haversine()` |
| **Risco** | Baixo |

### `calcularFrete` (`CEP-CONFIG.gs`, linhas ~1813–1851)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Calcula frete bruto a partir de distância, dia, rural, condomínio e parâmetros de config |
| **Entradas** | `distKm, isSat, isRural, isCondominio, p` (parâmetros de frete) |
| **Saídas** | `number` ou `'Não fazemos'` |
| **Dependências** | Parâmetros lidos da config (planilha) |
| **I/O** | ❌ Não (parâmetros são passados como argumento) |
| **Candidata migração** | ✅ **Já portada** — `frete.ts:calcularFreteBase()` + `aplicarAjusteGlobal()` |
| **Risco** | Baixo |

### `parseMinutes` (`CEP-CONFIG.gs`, linhas ~1856–1862)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Converte vários formatos de tempo para minutos inteiros |
| **Entradas** | `string "HH:MM"` | `Date` | `number` |
| **Saídas** | `number` (minutos) |
| **I/O** | ❌ Não |
| **Candidata migração** | ✅ **Já portada** — `tempo.ts:parseMinutos()` |
| **Risco** | Baixo |

### `normTeam` (`CEP-CONFIG.gs`, linhas ~1868–1873)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Normaliza string de equipe para `'EQUIPE 1'` ou `'EQUIPE 2'` |
| **Entradas** | `string` |
| **Saídas** | `'EQUIPE 1' | 'EQUIPE 2' | null` |
| **I/O** | ❌ Não |
| **Candidata migração** | ✅ **Já portada** — `equipe.ts:normalizarEquipe()` |
| **Risco** | Baixo |

### `formatDatePt` (`CEP-CONFIG.gs`, linhas ~1874–1877)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Formata `Date` para `"dd/MM (dia-semana)"` |
| **Entradas** | `Date` |
| **Saídas** | `string` |
| **Dependências** | `Utilities.formatDate` (Apps Script), timezone `GMT-3` |
| **I/O** | ❌ Não (mas dependente do runtime Apps Script) |
| **Candidata migração** | ⚠️ Pendente — timezone `GMT-3` precisa de decisão explícita |
| **Risco** | Médio — usado em logs e exibição. Qualquer erro de timezone gera divergência |

### `saoMesmaRegiaoOperacional` (`CEP-CONFIG.gs`, linhas ~1936–)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Determina se dois candidatos pertencem à mesma região operacional |
| **Entradas** | `cand1`, `cand2` (com `nearestPoint`) |
| **Saídas** | `boolean` |
| **Dependências** | `haversine()` |
| **I/O** | ❌ Não |
| **Candidata migração** | ⚠️ Parcialmente pura — mas faz parte do ranking acoplado |
| **Risco** | Médio — parte do critério de seleção de candidatos |

### `melhorCandidatoRegiao_` (`CEP-CONFIG.gs`, linhas ~2073–)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Compara dois candidatos e decide qual é melhor com base em região operacional |
| **Entradas** | `cand1`, `cand2`, `limiteRegiaoKm` |
| **Saídas** | `Object | null` |
| **Dependências** | `saoMesmaRegiaoOperacional`, `haversine` |
| **I/O** | ❌ Não |
| **Candidata migração** | ⚠️ Parcialmente pura — depende de nearestPoint |
| **Risco** | Alto — critério de ranking; erro muda os resultados para o usuário |

### `filtrarPorRegiaoOperacional_` (`CEP-CONFIG.gs`, linhas ~2278–)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Filtra candidatos normais por região operacional, usando janela de 3 dias (`JANELA_DIAS = 3`) |
| **Entradas** | `normais`, `minResultados`, `limiteRegiaoKm` |
| **Saídas** | `Array` (candidatos filtrados) |
| **Dependências** | `melhorCandidatoRegiao_`, `saoMesmaRegiaoOperacional` |
| **I/O** | ❌ Não |
| **Candidata migração** | ⚠️ Não ainda — parte do pipeline de ranking |
| **Risco** | Alto |

### `selecionarConjuntoApp3ComExtras_` (`CEP-APIBACK.gs`, linha ~836)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Seleciona conjunto final de candidatos (normais + especiais + premium + hora-marcada), aplica limites de quantidade e ordena |
| **Entradas** | `normalsIn, especiaisIn, premiumsIn, horaMarcadasIn` |
| **Saídas** | `Array` de candidatos finais |
| **Dependências** | Funções de comparação (`byDate`, janelas locais) |
| **I/O** | ❌ Não |
| **Candidata migração** | ⚠️ Não ainda — precisa de mapeamento completo dos critérios |
| **Risco** | Alto — determina quais datas o usuário vê |

### `ResolverEnderecoComCache_` (`CEP-APIBACK.gs`, linhas ~3188–)

| Item | Detalhes |
|------|---------|
| **Responsabilidade** | Geocodifica um endereço com pipeline L1 (CacheService) → L2 (Supabase `geo_cache_addresses`) → providers externos |
| **Entradas** | `form` (endereço estruturado), `origin`, `preloadedCache` (opcional) |
| **Saídas** | `{ ok, lat, lng, enderecoCompleto, cep, provider, confidence }` |
| **Dependências** | CacheService, Supabase REST, LocationIQ, Maps.co, Photon |
| **I/O** | ✅ Sim — CacheService + HTTP Supabase + HTTP geocoding providers |
| **Candidata migração** | Não |
| **Risco** | Alto — usado em `coletarPontosDoDia` e no geocoding do destino |

---

## 8. Dados principais do fluxo

| Objeto | Descrição resumida | Referência detalhada |
|--------|--------------------|----------------------|
| **Formulário de entrada** | `ProcurarDatasServicoForm` — cep, tipoBerco, tempoNecessario, isRural, isCondominio, clientToken, lat/lng | `types.ts` |
| **Config normalizada** | `ConfigNormalizada` — todos os parâmetros de frete, km, equipes, endereços | `config-service.ts` + endpoint `GET /api/configuracoes/procurar-datas/config-normalizada` |
| **slot** | `{ date, team, availStr, pontos?, nearestPoint?, delta?, loc? }` | `docs/procurar-datas-estrutura-candidato.md` seção 5 |
| **ponto** | `{ addr, loc, eventTitle, cep, cepSource }` — vem da planilha AGENDA | `docs/procurar-datas-estrutura-candidato.md` seção 8 |
| **candidato** | slot enriquecido com `delta`, `nearestPoint`, `frete`, `tipo`, `date` | `docs/procurar-datas-estrutura-candidato.md` seção 6 |
| **nearestPoint** | `{ distancia, addr, eventTitle, loc }` — ponto mais próximo do novo destino | `docs/procurar-datas-estrutura-candidato.md` seção 7 |
| **Listas por tipo** | `normais`, `especiais`, `premiums`, `horaMarcadas` | `docs/procurar-datas-ranking-criterios.md` |
| **Progresso** | `{ status, normais, extras, clientToken, timestamp }` — salvo em PropertiesService | `getProgressUpdate` (`CEP-APIBACK.gs:251`) |
| **Payload final** | `{ candidates, address, addressShort, ... }` — retornado pelo motor | `ApiPesquisarDatasApp` (`PublicAPI.gs:45`) |
| **Retorno ao frontend** | `{ dateISO, team, frete, tipo, isExtra, avisoHoraMarcada }` | `ProcurarDatasCandidate` em `types.ts` |

---

## 9. Fontes de dados e I/O

### Planilha de agenda (`shAg`)

- **Onde:** lida em `pesquisarRotaToTargetWithParams` (`CEP-APIBACK.gs:688–692`)
- **Para quê:** fonte dos pontos de entrega do dia — `agVals = shAg.getRange(...).getValues()`, `agDisp = shAg.getRange(...).getDisplayValues()`
- **Quem usa:** `coletarPontosDoDia(slot, agVals, agDisp)` — processa linha a linha filtrando por data e equipe
- **Colunas relevantes confirmadas:** `disp[i][2]` = eventTitle, `disp[i][4]` = observações (fallback addr), `disp[i][5]` = LUGAR (endereço), `disp[i][6]` = equipe
- **Nome da aba:** lido da config (`getConfig('PLANILHA DA AGENDA', cfgSheet)`)

### Planilha de disponibilidade (`shAv`)

- **Onde:** lida em `pesquisarRotaToTargetWithParams` (`CEP-APIBACK.gs:399–401`)
- **Para quê:** fonte dos slots disponíveis das equipes por dia/horário
- **Quem usa:** `getSlots(shAv, minMin, lookDays, ...)` — retorna `Array<{ date, team, availStr }>`
- **Nome da aba:** lido da config (`getConfig('PLANILHA DE TEMPO DISPONIVEL', cfgSheet)`)

### Planilha de configuração (`cfgSheet`)

- **Onde:** `pesquisarRotaToTargetWithParams` abre `ssSrc` e localiza `cfgSheet` por `getSheetId() === 718532388`
- **O que vem dela:** todos os parâmetros operacionais — km máximos, frete, endereços de depósito/casa, equipes ativas, OSRM URL, chaves de geocoding
- **Secrets:** `API_KEY`, `MAPSCO_API_KEY`, `LOCATIONIQ_API_KEY` lidos exclusivamente pelo Apps Script (nunca chegam ao Next.js)
- **O que já foi migrado para Supabase:** espelho não-secret em `procurar_datas_config` (usado apenas pela tela de configuração, **não pelo motor**)

### Supabase

Usos confirmados no código:

| Tabela | Usado por | Para quê |
|--------|-----------|----------|
| `procurar_datas_config` | `config-db.ts`, `config-service.ts` | Espelho de config — tela de configuração Next.js |
| `procurar_datas_config_snapshots` | `config-db.ts` | Histórico de importações manuais |
| `procurar_datas_config_auditoria` | `config-db.ts` | Audit log de alterações de config |
| `geo_cache_addresses`¹ | Apps Script `ResolverEnderecoComCache_` (L2) | Cache geocoding (endereço → lat/lng) — lido e escrito pelo Apps Script via REST |

> **Nota:** o nome `geo_cache_addresses` é o identificado no código do Apps Script. Antes de qualquer alteração em cache geográfico no Supabase, validar o nome real da tabela, colunas e policies via MCP Supabase.
>
> O motor Next.js **não** acessa essa tabela diretamente. Acesso é feito pelo Apps Script via chamadas REST ao Supabase.

### OSRM

- **Onde entra:** `getDrivingKm` e `getDrivingKmBatch` (`CEP-CONFIG.gs`)
- **O que calcula:** distância viária real em km entre dois pontos
- **Fallback:** `haversine()` (distância geodésica) se OSRM falhar
- **Endpoint:** configurável em `OSRM BASE URL` (config) — default `https://router.project-osrm.org`
- **Cachê:** `CacheService.getScriptCache()` (TTL 72h, confirmado em `DIST_TTL_S`)

### Geocoding

- **Função principal:** `ResolverEnderecoComCache_` (`CEP-APIBACK.gs:3188`)
- **Pipeline:** L1 (CacheService, 6h) → L2 (Supabase `geo_cache_addresses`) → providers externos
- **Providers externos confirmados:** LocationIQ, Maps.co, Photon (OpenStreetMap)
- **Chaves:** `LOCATIONIQ_API_KEY`, `MAPSCO_API_KEY` — lidos da planilha config pelo Apps Script
- **Batch preload:** `ConsultarCacheSupabaseBatch_` — pré-carrega múltiplos endereços em 1 query Supabase antes do loop

### Google Calendar

- **Não é fonte de agenda ou disponibilidade** — confirmado no código.
- **Não participa do motor de busca de datas** — confirmado no código.
- **Único uso:** `preAgendarDireto` (chamado por `ApiPreAgendarDireto`) — cria evento de pré-agendamento em `PRE_CALENDAR_ID` após o usuário escolher uma data.
- **Constante:** `PRE_CALENDAR_ID = 'lebebe.com.br_ot8qr0qu24r0a5sni3rc97ero8@group.calendar.google.com'` (`CEP-CONFIG.gs:74`)

---

## 10. Helpers já migrados para TypeScript

| Helper TypeScript | Arquivo | Origem no Apps Script | Testes | Status |
|-------------------|---------|-----------------------|--------|--------|
| `calcularFreteBase()`, `aplicarAjusteGlobal()`, `calcularFrete()` | `motor/frete.ts` | `calcularFrete()` + `aplicarAjusteFrete()` — `CEP-CONFIG.gs:1813`, `CEP-APIBACK.gs:377` | 51 | ✅ Portado — não chamado em produção |
| `parseMinutos()`, `formatarMinutos()`, `adicionarMinutosHHMM()` | `motor/tempo.ts` | `parseMinutes()`, `_fmtHHMMFromAny_()`, `_addMinHHMM_()` — `CEP-CONFIG.gs:1856`, `CEP-APIBACK.gs:2000-2037` | 31 | ✅ Portado — não chamado em produção |
| `normalizarEquipe()` | `motor/equipe.ts` | `normTeam()` — `CEP-CONFIG.gs:1868` | 26 | ✅ Portado — não chamado em produção |
| `haversine()`, `haversineKm()` | `motor/distancia.ts` | `haversine()` — `CEP-CONFIG.gs:1863` | 14 | ✅ Portado — não chamado em produção |
| `diffDias()`, `adicionarDias()` | `motor/datas.ts` | Operações nativas JS no motor — `CEP-CONFIG.gs` | 13 | ✅ Portado — não chamado em produção |

**Total: 135 testes passando. Build passando.**

---

## 11. Partes ainda não migradas

| Parte | Localização | Pura? | I/O? | Sensível? |
|-------|-------------|-------|------|-----------|
| Leitura de agenda (`shAg`) | `CEP-APIBACK.gs:688` | ❌ Acoplada | ✅ Sim | Alto |
| Leitura de disponibilidade (`shAv`) | `getSlots` — `CEP-CONFIG.gs:1574` | ❌ Acoplada | ✅ Sim | Alto |
| Geocoding de pontos | `coletarPontosDoDia` — `CEP-CONFIG.gs:1596` | ❌ Acoplada | ✅ Sim | Alto |
| Geocoding do destino | `pesquisarRotaToTargetWithParams` — `CEP-APIBACK.gs` | ❌ Acoplada | ✅ Sim | Alto |
| Distância viária (OSRM) | `getDrivingKm` — `CEP-CONFIG.gs:706` | ❌ Acoplada | ✅ Sim | Alto |
| Seleção de candidatos | `selecionarConjuntoApp3ComExtras_` — `CEP-APIBACK.gs:836` | ⚠️ Parcialmente | ❌ Não | Alto |
| Ranking por região | `filtrarPorRegiaoOperacional_` — `CEP-CONFIG.gs:2278` | ⚠️ Parcialmente | ❌ Não | Alto |
| Comparação de candidatos | `melhorCandidatoRegiao_` — `CEP-CONFIG.gs:2073` | ⚠️ Parcialmente | ❌ Não | Alto |
| Progresso/worker assíncrono | `ApiIniciarPesquisaDatasApp`, `ApiExecutarPesquisaDatasWorker` — `PublicAPI.gs` | ❌ Acoplada | ✅ Sim | Alto |
| Pré-agendamento | `preAgendarDireto` — `PublicAPI.gs:362` | ❌ Acoplada | ✅ Sim (CalendarApp) | Alto |
| Leitura de config pelo motor | `getConfig(cfgSheet)` — `CEP-APIBACK.gs:350–396` | ❌ Acoplada | ✅ Sim (planilha) | Médio |
| Formatação de data (`formatDatePt`) | `CEP-CONFIG.gs:1874` | ⚠️ Dependente de runtime | ❌ Não | Médio (timezone GMT-3) |
| Logs de auditoria | `logAuditRow`, `RegistrarExecucaoPesquisaAudit_` | ❌ Acoplada | ✅ Sim | Médio |
| Cache geocoding (Supabase L2) | `ConsultarCacheSupabase_`, `SalvarCacheSupabase_` | ❌ Acoplada | ✅ Sim | Médio |

---

## 12. Partes sensíveis

As seguintes partes **não devem ser alteradas sem nova aprovação e mapeamento completo**:

- **Ranking/comparação de candidatos** — `selecionarConjuntoApp3ComExtras_`, `filtrarPorRegiaoOperacional_`, `melhorCandidatoRegiao_`: qualquer erro muda as datas ofertadas ao usuário.
- **`coletarPontosDoDia`** — processo de leitura, parsing e geocoding de endereços da agenda. Erro aqui elimina pontos válidos ou geocodifica incorretamente.
- **Leitura das planilhas `shAg` e `shAv`** — fonte única de agenda e disponibilidade. Qualquer alteração de índice de coluna ou filtro quebra o fluxo inteiro.
- **`formatDatePt`** — timezone fixo em `GMT-3` via `Utilities.formatDate`. Migração exige decisão explícita de timezone.
- **OSRM/geocoding/cache** — pipeline multicamadas (CacheService → Supabase → providers). Alteração pode gerar falsos cache miss, custo de API ou resultado incorreto.
- **Progresso/worker assíncrono** — `PropertiesService` e triggers de tempo. Erro pode deixar pesquisa presa em `queued`.
- **Pré-agendamento** — usa CalendarApp e grava auditoria. Qualquer alteração pode criar eventos duplicados ou perder rastreabilidade.
- **Troca de produção para motor v2** — somente após motor TypeScript completo, com testes de caracterização e validação paralela.

---

## 13. Oportunidades futuras seguras

- **Criar `docs/procurar-datas-fixtures.md`** — documentar exemplos reais de payloads de entrada e saída para servir como contrato de comportamento na migração.
- **Mapear payload de progresso** — documentar o formato exato de `{ status, normais, extras, ... }` retornado por `GetProgressUpdate`, pois será necessário para futura integração.
- **Mapear payload de entrada/saída das APIs Next.js** — completar `types.ts` com tipos de resposta reais (não apenas os de entrada).
- **Criar testes de caracterização sem alterar produção** — validar que os helpers TypeScript já portados produzem os mesmos resultados que os equivalentes Apps Script para entradas reais.
- **Extrair comparador simples por data** — apenas após confirmar que `a.date - b.date` é o único critério de `byDate`, com testes cobrindo os casos-limite.
- **Extrair comparador simples por delta** — apenas após confirmar que `a.delta - b.delta` é o único critério dessa ordenação.

---

## 14. Perguntas em aberto

- ❓ **Valor de `JANELA_DIAS`:** confirmado em `filtrarPorRegiaoOperacional_` como `var JANELA_DIAS = 3` — mas pode haver outro uso com valor diferente? Não verificado em todos os arquivos.
- ❓ **Formato exato do payload de progresso:** `{ status, normais, extras, clientToken, timestamp, startedAt, finishedAt }` — campos exatos não documentados formalmente. Precisam ser mapeados.
- ❓ **Campo `rank`** no payload final: no código `PublicAPI.gs` linha 867 aparece `c.rank || 0` — indica que não é calculado, mas origem não confirmada.
- ❓ **Campo `label`** no payload: vem de `meta.label` ou `payload.label` — origem exata não confirmada para todos os fluxos.
- ❓ **Formato de `availStr`:** tratado como string opaca no código TypeScript. Formato exato da planilha não foi mapeado.
- ❓ **Índice correto das colunas de `shAg`:** confirmados `disp[i][2]`, `disp[i][4]`, `disp[i][5]`, `disp[i][6]`. O total de colunas e seus nomes completos não foram lidos da planilha real.
- ❓ **Trigger de tempo:** `_procurarDatasEnsureWorkerTrigger_` cria um trigger com qual intervalo? Não lido completamente.

---

## 15. Próxima etapa recomendada

**Criar `docs/procurar-datas-fixtures.md`** — documentar exemplos reais (ou sintéticos representativos) de:

1. Payload de entrada da pesquisa (`ProcurarDatasServicoForm`)
2. Payload de progresso (`GetProgressUpdate` response)
3. Payload de resposta final (candidatos retornados)
4. Estrutura real de um candidato normal, um especial e um premium

Essa documentação permitirá criar testes de caracterização no futuro sem alterar produção, e servirá como contrato para validar paridade entre motor legado e motor v2.

**Não implementar código nesta próxima etapa.**
