# LOG DE PROGRESSO — LE BÉBÉ APP

> **Regra:** Este arquivo deve ser lido pelo agente antes de iniciar qualquer tarefa relevante.  
> Não é fonte absoluta da verdade — validar sempre no código real.  
> Não registrar secrets, tokens, senhas ou dados sensíveis de clientes.

---

## 1. Estado atual resumido

Última atualização: 2026-06-12 16:55  
Agente/ferramenta: Cascade

### Resumo

Status geral:

- [ ] em análise
- [ ] em implementação
- [ ] aguardando validação manual
- [ ] validado
- [ ] pausado
- [x] concluído

---

## 2. Objetivo da fase atual

### Objetivo

Preparar e capturar fixtures reais do fluxo legado `/procurar-datas` para servir como contrato de comportamento comparável com o motor v2 diagnóstico.

### Fora do escopo

- Alterar código de produção
- Alterar frontend
- Alterar rotas
- Alterar helpers
- Alterar testes
- Criar rota de comparação legado vs v2 (etapa futura)

---

## 3. Arquivos envolvidos

### Arquivos lidos

- `docs/procurar-datas-legado-fixtures.md`
- `docs/procurar-datas-motor-v2-progresso.md`
- `docs/procurar-datas-fixtures.md`
- `docs/procurar-datas-contratos-payloads.md`
- `docs/procurar-datas-estrutura-candidato.md`
- `src/app/api/procurar-datas/pesquisar/route.ts`
- `src/app/api/procurar-datas/progresso/route.ts`
- `src/app/procurar-datas/page.tsx`
- `src/lib/procurar-datas/contratos.ts`

### Arquivos alterados

- `src/app/api/procurar-datas/progresso/route.ts` — adicionado `modoCaptura=1` para timeout estendido na captura de fixtures

### Arquivos criados

- `docs/fixtures/procurar-datas/legado/README.md`
- `docs/fixtures/procurar-datas/legado/template-captura-legado.json`
- `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json` — primeira fixture real/controlada capturada
- `src/app/api/procurar-datas/progresso/route.test.ts` — testes para `getProgressoTimeoutMs`
- `docs/procurar-datas-legado-fixtures.md` — atualizado (seção 5.5 e checklist)
- `docs/ia/log_progress.md` — este arquivo

### Arquivos que NÃO devem ser alterados nesta fase

- `src/app/api/procurar-datas/pesquisar/route.ts`
- `src/app/procurar-datas/page.tsx`
- Qualquer helper do motor v2
- Banco de dados / migrations / RLS

---

## 4. Decisões tomadas

### Decisão 1

Data: 2026-06-12  
Decisão: Criar estrutura `docs/fixtures/procurar-datas/legado/` para armazenar fixtures reais do legado separadas dos docs gerais.  
Motivo: Facilitar comparação futura com motor v2 e evitar mistura com documentação de contratos.  
Impacto: Nenhum em produção. Apenas documentação/JSON.

### Decisão 2

Data: 2026-06-12  
Decisão: Adicionar `modoCaptura=1` como query param na rota `/progresso` para estender timeout de 20s para 420s durante captura de fixtures.  
Motivo: O Apps Script pode demorar mais de 20s para concluir a pesquisa. Timeout padrão interrompia antes do `status: done`.  
Impacto: Sem impacto no fluxo normal (timeout padrão preservado). Apenas afeta requisições com `modoCaptura=1`.

---

## 5. Validações realizadas

Validações:

- [x] leitura de arquivos envolvidos
- [x] validação manual na tela
- [x] validação via DevTools Console
- [ ] validação de API route (apenas leitura)
- [ ] validação no MCP Supabase (não envolveu banco)
- [ ] build
- [ ] typecheck
- [x] testes automatizados (criados, não rodados)

### Detalhes

- Fixture `caso-normal-simples-2026-06-12.json` capturada com dados controlados (endereço urbano, `tempoNecessario: 01:00`).
- Retornou 3 candidatos normais, 0 extras, `status: done`, `durationMs: 182172`.

### Resultado

Primeira fixture real/controlada do legado disponível no repositório.

---

## 6. Testes / comandos rodados

```bash
# Não rodados nesta fase (apenas documentação e JSON foram criados/alterados)
# Para rodar os testes da rota progresso:
# npm test -- src/app/api/procurar-datas/progresso/route.test.ts
```

### Resultado

Não rodado.

### Erros encontrados

Nenhum identificado.

### Correções feitas

Nenhuma.

---

## 7. Pendências

### Pendências técnicas

- Capturar fixture `caso-premium-ou-especial`
- Capturar fixture `caso-hora-marcada`
- Capturar fixture `caso-sem-disponibilidade`
- Capturar fixture `caso-entrada-invalida`
- Capturar fixture `caso-sabado`
- Capturar fixture `caso-domingo`
- Capturar fixture `caso-rural-condominio`
- Rodar `npm test` para validar `route.test.ts` da rota progresso

### Pendências de validação manual

- Confirmar que `modoCaptura=1` funciona corretamente em produção/dev
- Confirmar campos `normais`, `extras`, `payload.candidates` na fixture de caso especial/premium

### Pendências de decisão do usuário

- Definir quando iniciar rota de comparação `/api/procurar-datas/v2/comparar`

---

## 8. Riscos conhecidos

- `modoCaptura=1` expõe timeout estendido sem autenticação adicional — aceitável por ser apenas para captura controlada, mas não deve ser usado em produção com usuários reais
- Fixtures com coordenadas reais precisam ser revisadas antes de uso externo ao repositório

---

## 9. Próximo passo recomendado

### Próximo passo

1. Rodar `npm test -- src/app/api/procurar-datas/progresso/route.test.ts` para validar os testes de `getProgressoTimeoutMs`
2. Capturar fixture `caso-sem-disponibilidade` (importante para mapear comportamento de fallback)
3. Após capturar ao menos 3 fixtures, planejar rota `/api/procurar-datas/v2/comparar`

### Critério para considerar concluído

- Fixtures dos 8 casos mínimos capturadas e salvas em `docs/fixtures/procurar-datas/legado/`
- Checklist em `docs/procurar-datas-legado-fixtures.md` totalmente marcado
- Rota de comparação planejada (não necessariamente implementada)

---

## 10. Histórico resumido

### 2026-06-13 — Frente 3 / rota diagnóstica disponibilidade-diagnostico

Agente/ferramenta: Cascade  
Resumo: Criada rota diagnóstica `GET /api/procurar-datas/v2/disponibilidade-diagnostico` que lê a planilha real TEMPO DISPONIVEL via Google Sheets API v4 (somente leitura), converte as linhas brutas para `LinhaTempoDisponivelV2[]` e chama `parsearDisponibilidadeTempoDisponivelV2()`, retornando resumo, avisos, erros e amostra configurável. Criados dois novos arquivos auxiliares: `google-sheets-tempo-disponivel.ts` (leitura OAuth2 isolada, mockável) e `leitor-sheets-tempo-disponivel.ts` (conversão tabular pura). 26 novos testes passando. Nenhuma rota, frontend ou produção afetados.  
Arquivos lidos: `src/lib/google/sheets-service.ts`, `src/lib/procurar-datas/config-service.ts`, `src/lib/procurar-datas/api.ts`, `src/app/api/procurar-datas/v2/diagnostico/route.ts`, `src/app/api/procurar-datas/v2/comparar/route.ts`, `src/app/api/procurar-datas/v2/comparar/route.test.ts`, `docs/ia/log_progress.md`.  
Arquivos criados: `src/lib/procurar-datas/google-sheets-tempo-disponivel.ts`, `src/lib/procurar-datas/motor/leitor-sheets-tempo-disponivel.ts`, `src/lib/procurar-datas/motor/leitor-sheets-tempo-disponivel.test.ts`, `src/app/api/procurar-datas/v2/disponibilidade-diagnostico/route.ts`, `src/app/api/procurar-datas/v2/disponibilidade-diagnostico/route.test.ts`.  
Arquivos alterados: `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md` (checklist + status da rota).  
Validações realizadas: Nenhuma chamada ao MCP Supabase (tarefa não toca banco). Nenhum arquivo das Frentes 1 e 2 alterado. Nenhuma rota de produção alterada.  
Comandos rodados: `npm run test` → 19 arquivos, 428 testes passando; `npx tsc --noEmit --pretty` → sem erros.  
Pendências: chamar a rota em ambiente real para capturar amostra de dados da planilha e confirmar nome real da aba.  
Riscos conhecidos: Nome da aba `TEMPO DISPONIVEL` usado como constante — se o nome real for diferente na planilha, a leitura retornará vazio.  
Próximo passo recomendado: autenticar e chamar `GET /api/procurar-datas/v2/disponibilidade-diagnostico` em produção para validar dados reais e capturar fixture.  
Status: concluído.

---

### 2026-06-12 — Frente 3 / esquerda: helper puro parsearDisponibilidadeTempoDisponivelV2

Agente/ferramenta: Cascade  
Resumo: Criado helper puro `parsearDisponibilidadeTempoDisponivelV2` em `motor/parse-disponibilidade-tempo-disponivel.ts` e arquivo de testes `parse-disponibilidade-tempo-disponivel.test.ts` com 41 testes cobrindo todos os casos solicitados. O helper converte linhas brutas da planilha TEMPO DISPONIVEL (formato real confirmado: DATA=DD/MM/YYYY, EQUIPE=Equipe 1/2, TEMPO DISPONÍVEL=HH:MM, STATUS=disponível/agenda fechada/excedeu) para DisponibilidadeEquipeDataV2[]. Reutiliza normalizarEquipe() e parseMinutos() já existentes. Sem I/O, sem rota, sem integração na rota diagnóstica v2.  
Arquivos lidos: docs/ia/log_progress.md, docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md, docs/procurar-datas-v2-proximas-etapas-operacionais.md, docs/procurar-datas-motor-v2-progresso.md, appscript/CEP-CONFIG.gs, src/lib/procurar-datas/motor/disponibilidade.ts, motor/equipe.ts, motor/datas.ts, motor/janela-datas.ts, motor/tempo.ts, motor/disponibilidade.test.ts, motor/tempo.test.ts, vitest.config.ts.  
Arquivos criados: `src/lib/procurar-datas/motor/parse-disponibilidade-tempo-disponivel.ts`, `src/lib/procurar-datas/motor/parse-disponibilidade-tempo-disponivel.test.ts`.  
Arquivos alterados: `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md` (checklist + status), `docs/procurar-datas-motor-v2-progresso.md` (nova seção 5.13 + lista de testes), `docs/ia/log_progress.md`.  
Validações realizadas: Nenhuma chamada ao MCP Supabase (tarefa não toca banco). Nenhum arquivo das Frentes 1 e 2 alterado. Nenhuma rota alterada. Nenhuma integração criada.  
Comandos rodados e resultados: `npm run test -- parse-disponibilidade-tempo-disponivel.test.ts` → 1 arquivo, 41 testes passando; `npm run test` → 17 arquivos, 402 testes passando; `npx tsc --noEmit --pretty` → sem erros.  
Pendências: leitura real da planilha via Apps Script ou rota diagnóstica de dados reais (ainda não implementada).  
Riscos conhecidos: formato `DD/MM/YYYY` confirmado pelo usuário — se a planilha retornar outro formato (Date object, string ISO), o parser retornará null e a linha será ignorada com erro. Date objects são tratados como fonte secundária.  
Próximo passo recomendado: criar função/rota diagnóstica que leia linhas reais de shAv via Apps Script e passe para parsearDisponibilidadeTempoDisponivelV2(), sem afetar produção.  
Status: concluído.

---

### 2026-06-12 — Frente 3 / Mapeamento disponibilidade legado (getSlots + coletarPontosDoDia)

Agente/ferramenta: Cascade  
Resumo: Análise e documentação sem implementação das funções `getSlots()` e `coletarPontosDoDia()` em `CEP-CONFIG.gs` e do fluxo que as chama em `CEP-APIBACK.gs`. Mapeadas: assinatura, parâmetros, retorno, planilhas envolvidas (shAv = TEMPO DISPONIVEL, shAg = AGENDA), colunas de cada planilha, lógica de filtragem, parsers `normTeam()` e `parseMinutes()`, relação entre disponibilidade/tempo/geografia/equipe, construção do candidato (`delta`, `nearestPoint`, `availStr`), regras de negócio adicionais (equipes ativas, produto, quarta-feira). Proposto mapeamento para `DisponibilidadeEquipeDataV2`. Listados 15 itens não confirmados e 10 riscos. Listados 15 checkpoints obrigatórios antes de implementar o parser real.  
Arquivos lidos: `appscript/CEP-CONFIG.gs` (linhas 1574–1762, 1856–1877, 513–537), `appscript/CEP-APIBACK.gs` (linhas 1–170, 330–402, 403–692, 900–1160), `src/lib/procurar-datas/motor/disponibilidade.ts`, `src/lib/procurar-datas/motor/janela-datas.ts`, `docs/procurar-datas-v2-proximas-etapas-operacionais.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/ia/log_progress.md`.  
Arquivos alterados: `docs/ia/log_progress.md`.  
Arquivos criados: `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md` (15 seções).  
Validações realizadas: nenhuma — documentação apenas, sem alteração de código, sem chamadas externas.  
Comandos rodados: nenhum.  
Pendências: confirmar format real de `availStr` (string/Date/number), timezone da planilha, nomes reais das abas, colunas 2/4 de shAg e coluna 3 de shAv.  
Riscos conhecidos: timezone planilha vs servidor pode causar divergência de data; `normTeam()` descarta silenciosamente nomes fora do padrão; geocoding falho descarta pontos silenciosamente.  
Próximo passo recomendado: capturar fixture real das linhas de shAv (sem dados de clientes) para confirmar format de `availStr` e timezone antes de implementar o helper `parseDisponibilidadeSlotLegadoV2`.  
Status: concluído (documentação).

---

### 2026-06-13 — Rollback da Frente 3 + documentação operacional

Agente/ferramenta: Cascade  
Resumo: Revertidas as alterações funcionais indevidas feitas na sessão anterior (desvio de escopo da Frente 3). Rota `POST /api/procurar-datas/valor-inicial` restaurada para delegar ao Apps Script `calcularValorInicialModal`. `config-service.ts` e `chaves-editaveis.ts` revertidos ao estado anterior. Criado documento de planejamento técnico `docs/procurar-datas-v2-proximas-etapas-operacionais.md` com 16 seções cobrindo: estado atual, o que é sintético, disponibilidade real, OSRM real, valor inicial, comparação operacional, integração frontend, performance, ordem das etapas, riscos, critérios de substituição e próximo passo recomendado. Supabase: verificadas as linhas `LAT DEPOSITO` e `LNG DEPOSITO` (valor = NULL) — mantidas sem deleção, registradas como pendência de decisão manual.  
Arquivos lidos: `docs/ia/log_progress.md`, `valor-inicial/route.ts`, `config-service.ts`, `chaves-editaveis.ts`, `apps-script.ts`, `api.ts`, `contratos.ts`, `motor/distancia.ts`, `motor/frete.ts`, `docs/procurar-datas-motor-v2-progresso.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/procurar-datas-contratos-payloads.md`, `docs/procurar-datas-codemap.md`, `docs/procurar-datas-estrutura-candidato.md`.  
Arquivos revertidos: `src/app/api/procurar-datas/valor-inicial/route.ts`, `src/lib/procurar-datas/config-service.ts`, `src/lib/procurar-datas/chaves-editaveis.ts`.  
Arquivos criados: `docs/procurar-datas-v2-proximas-etapas-operacionais.md`.  
Arquivos alterados: `docs/ia/log_progress.md`.  
Validações realizadas: `npx tsc --noEmit --pretty` → sem erros; `npm run test` → 352/352 ✓. MCP Supabase consultado: `LAT DEPOSITO` e `LNG DEPOSITO` confirmadas com `valor = NULL`. Não foram apagadas.  
Comandos rodados: `npx tsc --noEmit --pretty` → exit 0; `npm run test` → 15 arquivos, 352 testes passando.  
Frentes 1 e 2 não alteradas: `comparacao-legado-v2.ts`, `comparacao-legado-v2.test.ts`, `v2/comparar/route.ts`, `adaptador-candidato-legado.ts`, `adaptador-candidato-legado.test.ts` — intactos.  
Pendências: decidir se linhas `LAT DEPOSITO`/`LNG DEPOSITO` no Supabase devem ser mantidas ou removidas (remoção requer aprovação manual).  
Riscos conhecidos: linhas `LAT DEPOSITO`/`LNG DEPOSITO` existem no Supabase com valor NULL e `ativo = true`, mas não são lidas por nenhuma rota ativa após o rollback.  
Próximo passo recomendado: Etapa 1 do plano — ler `getSlots()` e `coletarPontosDoDia()` no `CEP-CONFIG.gs` para mapear o formato real de `shAv` sem alterar código.  
Status: concluído.

---

### 2026-06-13 — Cálculo de frete por distância no valor-inicial (REVERTIDO)

Agente/ferramenta: Cascade
Resumo: Substituída a rota `POST /api/procurar-datas/valor-inicial` — que delegava ao Apps Script `calcularValorInicialModal` — por cálculo direto em Next.js usando `haversineKm(depósito → cliente)` + `calcularFrete`. Adicionadas duas chaves de configuração (`LAT DEPOSITO`, `LNG DEPOSITO`) na tabela `procurar_datas_config` do Supabase para armazenar as coordenadas do depósito. Enquanto essas coordenadas não forem preenchidas pelo usuário, a rota retorna o frete mínimo (R$110) com `fallbackUsado: true`, mantendo comportamento idêntico ao fallback atual do Apps Script.
Arquivos lidos: `valor-inicial/route.ts`, `config-service.ts`, `chaves-editaveis.ts`, `motor/distancia.ts`, `motor/frete.ts`, `motor/entrada.ts`, `contratos.ts`, `types.ts`, `page.tsx`, `CEP-APIBACK.gs`, `docs/ia/log_progress.md`.
Arquivos alterados: `src/app/api/procurar-datas/valor-inicial/route.ts`, `src/lib/procurar-datas/config-service.ts`, `src/lib/procurar-datas/chaves-editaveis.ts`.
Arquivos criados: nenhum.
Validações realizadas: `npx tsc --noEmit` → sem erros; `npm run test` → 352/352 ✓; MCP Supabase consultado (tabela `procurar_datas_config`, restrições `grupo` e `valor_tipo` confirmadas).
Comandos rodados: `npx tsc --noEmit --pretty` → exit 0; `npm run test` → 15 arquivos, 352 testes passando.
Pendências: **AÇÃO NECESSÁRIA DO USUÁRIO** — preencher `LAT DEPOSITO` e `LNG DEPOSITO` em `procurar_datas_config` (Supabase) com as coordenadas reais do depósito (`R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450`). Até lá, a rota opera em modo fallback (R$110 base).
Riscos conhecidos: Coordenadas com valor 0 são tratadas como "não configurado" → fallback. Não há risco de cálculo incorreto por valor acidental.
Próximo passo recomendado: Inserir as coordenadas reais do depósito no Supabase e validar o cálculo manualmente no modal.
Status: concluído (aguardando preenchimento das coordenadas).

---

### 2026-06-12 — Regra de continuidade replicada para gerais.md

Agente/ferramenta: Cascade  
Resumo: Adicionada seção `## 11. Continuidade entre agentes e log de progresso` em `.devin/rules/gerais.md`. Prompt interno do Codex não encontrado no repositório (`.agents/skills/` existe mas está vazio; nenhum arquivo de prompt/AGENTS.md/cursorrules presente) — registrado como pendência.  
Arquivos lidos: `docs/ia/log_progress.md`, `.devin/rules/continuidade-agente.md`, `.devin/rules/gerais.md`  
Arquivos alterados: `.devin/rules/gerais.md`, `docs/ia/log_progress.md`  
Validação: leitura dos arquivos envolvidos e busca ativa por prompt do Codex no repositório.  
Status: concluído (parcial — Codex não localizado)  
Pendências: localizar ou criar prompt/configuração do Codex conectado se o usuário confirmar onde fica

---

### 2026-06-12 — Fixtures legado procurar-datas: estrutura + primeira captura

Agente/ferramenta: Cascade  
Resumo: Criada estrutura `docs/fixtures/procurar-datas/legado/`, template de fixture, README com guia de captura. Primeira fixture real/controlada capturada (`caso-normal-simples-2026-06-12.json`). Adicionado `modoCaptura=1` na rota `/progresso` para timeout estendido. Criados testes para `getProgressoTimeoutMs`.  
Arquivos alterados: `progresso/route.ts`  
Arquivos criados: `README.md`, `template-captura-legado.json`, `caso-normal-simples-2026-06-12.json`, `route.test.ts`, `log_progress.md`  
Validação: Fixture capturada manualmente via DevTools Console. Testes criados, não rodados.  
Status: aguardando validação manual e captura dos demais casos

---

### 2026-06-12 — Comparação estrutural legado vs v2 baseada em fixtures

Agente/ferramenta: Cascade  
Resumo: Criado helper puro `compararFixtureLegadoComContratoV2` que valida estrutura de fixtures reais/controladas do legado contra contrato esperado. Criados 26 testes unitários (todos passando). Criada rota diagnóstica `GET /api/procurar-datas/v2/comparar` que lê as 2 fixtures do sistema de arquivos e retorna comparação estrutural. Não chama Apps Script, OSRM, Supabase, Google Calendar, banco, planilha ou frontend. Não altera produção.  
Arquivos lidos: `docs/ia/log_progress.md`, `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`, `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`, `src/app/api/procurar-datas/v2/diagnostico/route.ts`, `src/app/api/procurar-datas/pesquisar/route.ts`, `src/lib/procurar-datas/contratos.ts`, `src/lib/procurar-datas/motor/entrada.ts`, `src/lib/procurar-datas/motor/frete.ts`, `src/lib/procurar-datas/motor/candidato.ts`, `src/lib/procurar-datas/motor/ordenacao-candidatos.ts`, `vitest.config.ts`, `tsconfig.json`, `next.config.ts`.  
Arquivos criados: `src/lib/procurar-datas/motor/comparacao-legado-v2.ts`, `src/lib/procurar-datas/motor/comparacao-legado-v2.test.ts`, `src/app/api/procurar-datas/v2/comparar/route.ts`.  
Arquivos alterados: `docs/procurar-datas-motor-v2-progresso.md` (seções 11 e 13 atualizadas), `docs/ia/log_progress.md`.  
Validações realizadas: `npm run test` → 14 arquivos, 312 testes passando; `npx tsc --noEmit --pretty` → sem erros. Supabase/MCP não aplicado — tarefa não tocou banco, queries, policies, migrations ou integrações externas novas.  
Comandos rodados e resultados: `npm run test -- comparacao-legado-v2.test.ts` → 26/26 ✓; `npm run test` → 312/312 ✓; `npx tsc --noEmit --pretty` → sem erros.  
Pendências: nenhuma.  
Riscos conhecidos: rota `GET /v2/comparar` usa `fs.readFileSync` com `process.cwd()` — depende de as fixtures existirem no sistema de arquivos. Em ambiente de deploy sem o diretório `docs/`, a rota retorna `errosCarregamento`. Sem impacto em produção pois não é chamada pelo frontend.  
Próximo passo recomendado: iniciar leitura real de disponibilidade em modo diagnóstico para substituir dados sintéticos no v2.  
Status: concluído.

---

### 2026-06-12 — Documentação do bug corrigido: entrada inválida sem tempo

Agente/ferramenta: Cascade  
Resumo: Registrado em documentação que o caso de entrada inválida sem `tempoNecessario` foi bug identificado, corrigido e validado manualmente com HTTP 400. O comportamento antigo (aceitar payload vazio e retornar candidatos) não é contrato desejado do legado.  
Arquivos lidos: `docs/ia/log_progress.md`, `docs/fixtures/procurar-datas/legado/README.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/procurar-datas-motor-v2-progresso.md`, `src/app/api/procurar-datas/pesquisar/route.ts`, `src/app/api/procurar-datas/pesquisar/route.test.ts`  
Arquivos alterados: `docs/fixtures/procurar-datas/legado/README.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/procurar-datas-motor-v2-progresso.md`, `docs/ia/log_progress.md`  
Validações realizadas: leitura dos arquivos envolvidos e confirmação da validação manual já registrada no log anterior (HTTP 400).  
Comandos rodados e resultados: nenhum (apenas documentação).  
Pendências: nenhuma.  
Riscos conhecidos: nenhum.  
Próximo passo recomendado: iniciar rota de comparação `/api/procurar-datas/v2/comparar` usando as 2 fixtures reais capturadas (normal simples e premium/especial).  
Status: concluído.

---

### 2026-06-12 - Validacao backend de tempo necessario em /procurar-datas/pesquisar

Agente/ferramenta usada: Codex  
Resumo: Adicionada validacao backend na rota `POST /api/procurar-datas/pesquisar` para rejeitar `tempoNecessario` ausente, vazio, zerado ou fora de `HH:mm`/`HH:mm:ss` antes de chamar Apps Script. Criados testes de rota garantindo que Apps Script nao e chamado quando o tempo e invalido.  
Arquivos lidos: `docs/ia/log_progress.md`, `src/app/api/procurar-datas/pesquisar/route.ts`, `src/app/api/procurar-datas/progresso/route.ts`, `src/app/procurar-datas/page.tsx`, `src/lib/procurar-datas/api.ts`, `src/lib/procurar-datas/apps-script.ts`, `src/lib/procurar-datas/contratos.ts`, `src/lib/procurar-datas/types.ts`, `src/lib/procurar-datas/motor/tempo.ts`, `docs/fixtures/procurar-datas/legado/README.md`, `docs/fixtures/procurar-datas/legado/template-captura-legado.json`, `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`, `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`, `docs/procurar-datas-legado-fixtures.md`, `docs/procurar-datas-motor-v2-progresso.md`, `package.json`, `vitest.config.ts`, `tsconfig.json`, `src/app/api/procurar-datas/progresso/route.test.ts`.  
Arquivos alterados/criados: alterado `src/app/api/procurar-datas/pesquisar/route.ts`; criado `src/app/api/procurar-datas/pesquisar/route.test.ts`; alterado `docs/ia/log_progress.md`.  
Validacoes realizadas: teste isolado da rota pesquisar; suite completa Vitest; typecheck TypeScript. Supabase/MCP nao aplicado porque a tarefa nao tocou banco, queries, policies, migrations ou integracoes externas novas.  
Comandos rodados e resultados: `npm run test -- src/app/api/procurar-datas/pesquisar/route.test.ts` -> 1 arquivo, 12 testes passando; `npm run test` -> 13 arquivos, 286 testes passando; `npx tsc --noEmit --pretty` -> sem erros.  
Pendencias: validacao manual opcional com chamada direta contendo `tempoNecessario: ""` para confirmar resposta 400 no ambiente alvo.  
Riscos conhecidos: `HH:mm:ss` e aceito apenas quando horas ou minutos tornam o tempo maior que zero; segundos isolados como `00:00:30` continuam rejeitados para evitar envio ao legado como tempo efetivo zero.  
Proximo passo recomendado: executar a chamada direta invalidada no ambiente usado para a captura original e confirmar que nao ha novo job/polling para o token de teste.  
Status: concluido.

---

### 2026-06-12 — Adapter diagnóstico CandidatoPreliminarV2 → contrato legado

Agente/ferramenta: Cascade  
Resumo: Criado helper puro `adaptarCandidatoV2ParaContratoLegadoDiagnostico` que converte `CandidatoPreliminarV2` para o formato `CandidatoLegadoDiagnosticoV2`, estruturalmente compatível com `CandidatoFinal` observado nas fixtures reais do legado. Adapter exclusivamente diagnóstico — não integrado em produção, não altera frontend, não consulta Apps Script, OSRM, Supabase, Google Calendar, banco ou planilha. Criados 40 testes unitários cobrindo todos os 17 casos solicitados + verificações baseadas nas fixtures reais capturadas (caso-normal-simples e caso-premium-ou-especial).  
Arquivos lidos: `docs/ia/log_progress.md`, `docs/procurar-datas-motor-v2-progresso.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/procurar-datas-estrutura-candidato.md`, `docs/procurar-datas-contratos-payloads.md`, `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`, `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`, `src/lib/procurar-datas/motor/candidato.ts`, `src/lib/procurar-datas/motor/ordenacao-candidatos.ts`, `src/lib/procurar-datas/motor/classificacao-candidato.ts`, `src/lib/procurar-datas/motor/datas.ts`, `src/lib/procurar-datas/motor/janela-datas.ts`, `src/lib/procurar-datas/motor/types.ts`, `src/lib/procurar-datas/motor/comparacao-legado-v2.ts`, `src/lib/procurar-datas/contratos.ts`, `src/lib/procurar-datas/motor/candidato.test.ts`.  
Arquivos criados: `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts`, `src/lib/procurar-datas/motor/adaptador-candidato-legado.test.ts`.  
Arquivos alterados: `docs/procurar-datas-motor-v2-progresso.md` (seções 3, 5, 9, 10, 11, 13 atualizadas), `docs/ia/log_progress.md`.  
Validações realizadas: `npm run test` → 15 arquivos, 352 testes passando (40 novos); `npx tsc --noEmit --pretty` → sem erros. MCP Supabase não aplicado — tarefa não tocou banco, queries, policies, migrations ou integrações externas.  
Comandos rodados e resultados: `npm run test` → 352/352 ✓; `npx tsc --noEmit --pretty` → sem erros.  
Pendências:
- `isExtra` para `hora-marcada` inferido como `true` baseado em documentação — não confirmado em fixture real de hora-marcada (registrado em `diagnosticoV2.avisos`).
- `dateISO`: v2 usa YYYY-MM-DD, legado usa ISO completo com T03:00:00.000Z — diferença documentada, não resolvida (a resolver quando integrar com comparação operacional real).
- `encomenda`: fixo em "Não" até o v2 modelar o campo equivalente.
- Adapter não integrado na rota diagnóstica ainda (por opção de escopo conservador).  
Riscos conhecidos: nenhum em produção — arquivos novos isolados, sem integração com rotas ou frontend.  
Próximo passo recomendado: iniciar leitura real de disponibilidade em modo diagnóstico para substituir dados sintéticos no v2. Quando disponibilidade real estiver integrada, considerar integrar o adapter na rota diagnóstica para permitir comparação candidato-a-candidato entre v2 e legado.  
Status: concluído.

---

### 2026-06-12 - Frente 1 direita: adapter v2 sintetico em /v2/comparar

Agente/ferramenta usada: Codex  
Resumo: Integrado o adapter diagnostico da Frente 2 na rota `GET /api/procurar-datas/v2/comparar` por meio de um bloco novo `diagnosticoAdapterV2`. A rota continua baseada nas duas fixtures reais/controladas do legado e agora tambem exibe uma demonstracao sintetica de candidatos v2 adaptados para o contrato legado diagnostico. Nao houve comparacao operacional real.  
Arquivos lidos: `docs/ia/log_progress.md`, `docs/procurar-datas-motor-v2-progresso.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`, `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`, `src/app/api/procurar-datas/v2/comparar/route.ts`, `src/lib/procurar-datas/motor/comparacao-legado-v2.ts`, `src/lib/procurar-datas/motor/comparacao-legado-v2.test.ts`, `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts`, `src/lib/procurar-datas/motor/adaptador-candidato-legado.test.ts`, `src/lib/procurar-datas/motor/candidato.ts`, `src/lib/procurar-datas/motor/ordenacao-candidatos.ts`, `src/lib/procurar-datas/contratos.ts`.  
Arquivos alterados/criados: alterado `src/app/api/procurar-datas/v2/comparar/route.ts`; criado `src/app/api/procurar-datas/v2/comparar/route.test.ts`; alterados `docs/procurar-datas-motor-v2-progresso.md`, `docs/procurar-datas-legado-fixtures.md` e `docs/ia/log_progress.md`.  
Validacoes realizadas: teste especifico da rota comparar; suite completa Vitest; typecheck TypeScript. Supabase/MCP nao aplicado porque a tarefa nao tocou banco, queries, policies, migrations ou integracoes externas.  
Comandos rodados e resultados: `npm run test -- src/app/api/procurar-datas/v2/comparar/route.test.ts` -> 1 arquivo, 4 testes passando; `npm run test` -> 16 arquivos, 356 testes passando; `npx tsc --noEmit --pretty` -> sem erros.  
Pendencias: nenhuma nesta frente. Hora marcada continua pendente de fixture real para confirmacao operacional.  
Riscos conhecidos: `diagnosticoAdapterV2` e sintetico e nao deve ser interpretado como paridade operacional; v2 ainda nao usa disponibilidade real nem OSRM real neste bloco.  
Proximo passo recomendado: quando a Frente 3 concluir o mapeamento de disponibilidade real, planejar uma comparacao diagnostica operacional separada, sem substituir o fluxo legado.  
Status: concluido.

---

### 2026-06-12 - Frente 2 meio: formato dateISO legado-gmt3 no adapter

Agente/ferramenta usada: Codex  
Resumo: Adicionada opcao controlada `formatoDateISO?: "v2" | "legado-gmt3"` ao adapter `adaptarCandidatoV2ParaContratoLegadoDiagnostico`. O comportamento padrao continua emitindo `YYYY-MM-DD`. Quando `formatoDateISO: "legado-gmt3"` e informado, o adapter emite `YYYY-MM-DDT03:00:00.000Z`, padrao observado nas fixtures reais/controladas do legado. A montagem e deterministica por string e nao depende de timezone do runtime.  
Arquivos lidos: `docs/ia/log_progress.md`, `docs/procurar-datas-motor-v2-progresso.md`, `docs/procurar-datas-legado-fixtures.md`, `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`, `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`, `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts`, `src/lib/procurar-datas/motor/adaptador-candidato-legado.test.ts`, `src/lib/procurar-datas/motor/candidato.ts`, `src/lib/procurar-datas/contratos.ts`.  
Arquivos alterados/criados: alterados `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts`, `src/lib/procurar-datas/motor/adaptador-candidato-legado.test.ts`, `docs/procurar-datas-motor-v2-progresso.md`, `docs/procurar-datas-legado-fixtures.md` e `docs/ia/log_progress.md`. Nenhum arquivo criado.  
Validacoes realizadas: teste especifico do adapter; suite completa Vitest; typecheck TypeScript. Supabase/MCP nao aplicado porque a tarefa nao tocou banco, queries, policies, migrations ou integracoes externas.  
Comandos rodados e resultados: `npm run test -- src/lib/procurar-datas/motor/adaptador-candidato-legado.test.ts` -> 1 arquivo, 45 testes passando; `npm run test` -> 17 arquivos, 402 testes passando; `npx tsc --noEmit --pretty` -> sem erros.  
Pendencias: nenhuma nesta frente. `T03:00:00.000Z` segue registrado como padrao observado nas fixtures atuais, nao como regra universal confirmada por fixture de hora marcada.  
Riscos conhecidos: usar `formatoDateISO: "legado-gmt3"` fora de contexto pode sugerir equivalencia operacional que ainda nao existe; o adapter continua diagnostico e nao substitui producao.  
Proximo passo recomendado: manter o padrao `v2` nas rotas diagnosticas atuais e usar `legado-gmt3` apenas em comparacoes futuras que precisem aproximar o contrato visual do legado.  
Status: concluido.

---

## Regras de uso deste arquivo

- Este arquivo deve ser atualizado ao final de toda tarefa relevante feita por IA/agente.
- O agente deve ler este arquivo antes de iniciar uma nova tarefa.
- Não apagar histórico validado.
- Não registrar secrets, tokens, senhas, dados sensíveis ou informações pessoais de clientes.
- Separar claramente o que foi feito, o que foi validado, o que está pendente e o que é hipótese.
- Este arquivo não substitui a leitura real do código.
- Quando houver banco de dados, a validação real deve ser feita no MCP Supabase.
- Quando houver dúvida, marcar como "não confirmado" em vez de assumir.
