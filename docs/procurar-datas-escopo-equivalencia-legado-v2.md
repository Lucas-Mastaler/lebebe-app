# Escopo e equivalência — motor `/procurar-datas` legado x v2

> **Data de criação:** 2026-06-17  
> **Frente:** Frente 0 / Controle  
> **Status:** Ativo — documento vivo  
> **Propósito:** Contrato de migração do motor `/procurar-datas`. Controla escopo, equivalência, riscos e critérios de aceite.  
> **Não substitui leitura do código.** Não altera produção, frontend, rotas legadas nem código funcional.

---

## 2026-06-26 - Frente 1/esquerda - Fallback Google Geocoding restrito para endereços difíceis

Status: implementado em `src/lib/procurar-datas/google-geocoding.ts` e `src/app/api/procurar-datas/validar-endereco/route.ts`. Nao altera motor v2, OSRM, Haversine, ranking, classificacao, frete, UI, banco, migrations, RLS, Apps Script, MAPS.CO, Nominatim, buscar-cep, valor-inicial, OSRM.

### Regra nova
- Google Geocoding e usado somente como fallback excepcional na rota `POST /api/procurar-datas/validar-endereco`.
- Ativado apenas quando todas as condicoes abaixo sao verdadeiras:
  1. `geo_cache` seguro nao encontrou resultado.
  2. LocationIQ principal falhou ou rejeitou todos os candidatos.
  3. LocationIQ reserva (se existir) falhou ou rejeitou todos os candidatos.
  4. O endereco parece ser "dificil": contem `BR`, `Rodovia`, `Estrada`, `KM`, `Zona Rural`, `quilometro` ou padroes rurais claros.
- Para enderecos urbanos comuns (Rua, Avenida, Alameda, Travessa, etc.), o fluxo continua igual: cache -> LocationIQ -> Apps Script.
- Google e o ultimo fallback direto antes de devolver erro para enderecos dificeis; Apps Script continua como fallback geral para enderecos nao dificeis.

### Deteccao
- Funcao `ehEnderecoDificilRodoviaOuRural(form)` analisa campos estruturados: `logradouro`, `numero`, `bairro`, `cidade`, `uf`, `cep`.
- Padroes que ativam: `BR-116`, `BR 116`, `BR116`, `Rodovia`, `Estrada`, `KM 102`, `Zona Rural`, `quilometro`.
- Padroes que NAO ativam: `Rua`, `Avenida`, `Alameda`, `Travessa`, `Praca`, `Largo`.

### Aceite/rejeicao do Google
- Rejeita coordenadas invalidas, pais diferente do Brasil, resultado generico (estado/pais/cidade pura), UF incompativel, cidade incompativel, logradouro incompativel.
- Aceita resultados aproximados para enderecos rurais/rodovia sem numero exato quando houver indicacao de KM ou compatibilidade textual.
- Provider registrado como `google_geocoding`.
- Resultados rejeitados nao sao salvos no cache.

### Cache
- Se aceito, o resultado e salvo no `geo_cache` via `salvarEnderecoNoGeoCache` com `provider=google_geocoding`.
- Nao foi criada coluna nova, migration, trigger ou schema.

### Logs
- `google_fallback_start`, `google_fallback_success`, `google_fallback_rejected`, `google_fallback_error`, `google_fallback_missing_key`, `google_fallback_skip_not_difficult`, `google_fallback_failed`.
- Nenhum log expoe chave, token ou URL com secret.

### Variavel de ambiente
- `GOOGLE_GEOCODING_API_KEY` (backend only).
- Se ausente, o fallback e ignorado e o fluxo continua para o proximo fallback disponivel.

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint google-geocoding.ts google-geocoding.test.ts route.ts --quiet`: passou.
- `npm run test -- google-geocoding.test.ts`: 9/9 passou.

### Pendencias
- Validacao manual autenticada em `/procurar-datas` com endereco BR/Rodovia/KM.
- Configurar `GOOGLE_GEOCODING_API_KEY` no ambiente backend quando desejar usar o fallback.

---

## 2026-06-24 - Codex - Frente 1/esquerda: tempo de servico migrado para helper TS

Status: calculo de `tempoNecessario` da tela principal migrado para helper puro TypeScript, sem alterar motor de datas.

### Escopo aplicado
- Criado `src/lib/procurar-datas/tempo-servico.ts` como equivalente ao Apps Script `gerarTempoServiCalcula()`.
- `src/app/procurar-datas/page.tsx` passou a calcular o campo "Tempo necessario" localmente e nao chama mais `/api/procurar-datas/calcular-tempo` para esse calculo.
- A regra real de quarto completo preserva `rouMin += 30`, apesar do comentario legado mencionar `+15`.
- O adicional de condominio `+10` foi mantido na tela, fora do helper da tabela, para preservar o comportamento do caminho antigo `GetTempoNecessario`.

### Limites preservados
- Nao altera ranking, classificacao, OSRM, Haversine, frete, banco, Apps Script, limites, recorte, disponibilidade, agenda, pre-agendamento ou rotas v2 de pesquisa.
- Nao remove a rota legada `/api/procurar-datas/calcular-tempo`; apenas remove a dependencia da tela principal para o calculo automatico.

### Validacao
- Teste unitario do helper: 9 testes passando.
- Typecheck e lint dos arquivos alterados passaram.
- Validacao manual autenticada em `/procurar-datas` ficou pendente nesta execucao porque o HTML local renderizou login.

### Pendencia futura
- Auditoria UI/UX do legado continua fora deste escopo e deve ser tratada em tarefa separada.

---

## 2026-06-24 - Codex - Virada controlada: v2 padrao na tela principal

Status: v2 habilitada por padrao em `/procurar-datas`. Nao altera regra de negocio, ranking, classificacao, OSRM, Haversine, banco, Apps Script, frete, limites ou recorte.

### Decisao aplicada
- `/procurar-datas` passa a chamar a rota v2 compat:
  - `POST /api/procurar-datas/v2/pesquisar-compat-async`
  - `GET /api/procurar-datas/v2/progresso-compat`
- `?motor=v2` nao e mais necessario para ativar v2 na tela principal.
- Nao ha fallback interno no app para o legado.
- O fallback operacional segue externo: planilha antiga/legado manual, fora do app.
- `/procurar-datas/dev-v2` permanece como ferramenta interna de diagnostico.

### Limites preservados
- Nenhuma regra de negocio foi alterada.
- Nenhuma logica de selecao de normais, especial, premium ou hora marcada foi alterada.
- Nenhum calculo de frete, OSRM, Haversine, origem/casa/equipe, ranking ou recorte foi alterado.
- Nenhum schema, query, migration, policy ou dado de banco foi alterado.

### UI operacional
- A tela principal exibe `daysLeftTxt` como "Faltam" quando o campo vem no payload.
- A tela principal exibe `encomenda` quando o campo vem no payload.
- Campos ausentes usam fallback visual `-`.
- Textos tecnicos de modo interno/dev foram removidos da tela principal.

### Riscos e pendencias
- Validacao manual autenticada de busca real ainda pendente nesta execucao por falta de sessao no Chrome headless.
- Auditoria/provider formal para distinguir `v2_nextjs` em tabelas historicas continua pendencia futura; nao confirmado no codigo nesta tarefa alem dos logs existentes da rota v2.

---

## 2026-06-24 - Frente 0 / Controle: checkpoint de equivalência e divergência explicada nos testes v2

Status: checkpoint de documentação. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### 1. Validação das faixas de limite

Foi validado na tela `/procurar-datas/dev-v2` que os valores do banco são adicionais/acumulados:

- `KM ADICIONAL MAX NA ROTA = 5000m`
- `KM ADICIONAL MAX NA ROTA ESPECIAL = 5000m`
- `KM ADICIONAL MAX NA ROTA PREMIUM = 10000m`

Interpretação efetiva da v2:

- Normal/Base: `0 até 5000m`
- Especial: `5001 até 10000m`
- Premium: `10001 até 15000m`
- Fora-limite: `acima de 15000m`

Isso converge com o legado, que nos logs mostra:

- `base=5000m`
- `especial=10000m`
- `premium=15000m`

Conclusão:
A divergência observada nos testes não é causada por limite/faixa de classificação. As faixas da v2 batem com o legado.

### 2. Cenário Rua Major Francisco Hardy, 70 — Campo Comprido

Entrada:

- Endereço: `Rua Major Francisco Hardy, 70, Campo Comprido, Curitiba - PR`
- CEP: `81230-174`
- Coordenadas: `lat -25.45244`, `lng -49.33070`
- Data inicial: `2026-06-26`
- Tempo necessário: `02:45`
- Resultado v2: `31/07` entrou como `Especial`
- Resultado legado: `31/07` foi descartado como `FORA-LIMITE`; `05/08` entrou como `Especial`

Achado do diagnóstico:

- Legado em `31/07` considerou `1` ponto de agenda:
  - `DEPÓSITO → UBERABA`
- V2 em `31/07` considerou `2` pontos de agenda:
  - `DEPÓSITO → UBERABA → BIGORRILHO`
- Ponto adicional v2:
  - `(00:40) BIGORRILHO 28793 (BIGORRILHO) (FRETE ESPECIAL MANTER DATA)`
  - `Alameda Júlia da Costa, 1181, Bigorrilho, Curitiba - PR`
- Isso reduziu o delta da v2 e fez `31/07` entrar como especial.
- Como `31/07` entrou como especial na v2, `05/08` acabou removido no recorte por `limite-especiais-atingido`.

Conclusão:
Divergência explicada por composição diferente da rota base. A v2 leu um ponto adicional real da agenda que o legado aparentemente não considerou. Não foi identificado erro de limite/classificação na v2 neste caso.

### 3. Cenário Rua Henrique Correia, 1320 — Bairro Alto

Entrada:

- Endereço: `Rua Henrique Correia, 1320, Bairro Alto, Curitiba - PR`
- CEP: `82240-290`
- Coordenadas: `lat -25.40795`, `lng -49.20650`
- Data inicial: `2026-06-26`
- Tempo necessário: `02:00`
- Roupeiro: `4 PTS (DIVERSOS)`

Resultado legado:

- `31/07` — Premium — R$ 320
- Delta legado: `10.36km`
- Rota base legado:
  - `DEPÓSITO → Rua Professora Maria da Glória Saldanha Loyola, Uberaba`
- Pontos agenda legado: `1`
- Faixa: Premium

Resultado v2:

- `31/07` — Especial — R$ 220
- Delta v2: `9.61km`
- Rota base v2:
  - `DEPÓSITO → UBERABA → BIGORRILHO`
- Pontos agenda v2: `2`
- Faixa: Especial

Ponto adicional v2:

- `(00:40) BIGORRILHO 28793 (BIGORRILHO) (FRETE ESPECIAL MANTER DATA)`
- `Alameda Júlia da Costa, 1181, Bigorrilho, Curitiba - PR`
- CEP: `80730-070`

Conclusão:
A divergência de `31/07` entre Premium no legado e Especial na v2 foi explicada por diferença no delta calculado:

- legado: `10.36km`, usando só Uberaba;
- v2: `9.61km`, usando Uberaba + Bigorrilho.

A diferença de aproximadamente `750m` atravessou a fronteira entre Especial e Premium. As faixas estão corretas; a diferença veio da composição da rota base.

### 4. Interpretação de controle

Registrar que os dois cenários apontam o mesmo padrão:

- O legado considerou apenas `1` ponto de agenda em `31/07`.
- A v2 considerou `2` pontos de agenda em `31/07`.
- O ponto adicional foi o Bigorrilho `28793`.
- Não há evidência de que o legado filtre esse ponto por texto do título.
- Hipótese mais provável: o legado não leu ou não carregou esse ponto da planilha/agenda naquele processamento.
- A v2 parece estar lendo a agenda de forma mais completa para esse dia.

Importante:
Não registrar isso como mudança de regra. Registrar como divergência explicada e risco conhecido: a v2 pode divergir do legado quando o legado não carregar todos os pontos da agenda.

### 5. Status recomendado

- V2 está muito promissora para uso controlado.
- Testes reais mostraram performance muito superior:
  - legado: aproximadamente `125s–141s`;
  - v2: aproximadamente `8s–9s`.
- Não foi identificado erro nas faixas de limite.
- Divergências recentes foram explicadas por composição da rota base, não por erro óbvio de cálculo da v2.
- Recomendação: realizar mais um teste real comparativo. Se bater ou se a divergência também for explicável, considerar v2 aprovada para iniciar uso controlado na tela principal.

### 6. Pendências a registrar

- Fazer mais um teste real comparativo legado × v2.
- Se nova divergência ocorrer, primeiro verificar:
  - pontos da rota base;
  - delta OSRM;
  - origem;
  - classificação/faixa;
  - recorte final.
- Corrigir na tela dev a exibição dos limites para evitar confusão:
  - mostrar claramente valores brutos do banco;
  - mostrar faixas efetivas acumuladas.
- Futuramente melhorar tela principal:
  - mostrar `daysLeftTxt`;
  - indicar encomenda;
  - melhorar UI dos resultados;
  - registrar auditoria/provider v2;
  - proteger/documentar coordenadas oficiais;
  - otimizar cálculo de `tempoNecessario`.

---

## 2026-06-24 - Frente 0 / Controle: Santo Amaro validado - coordenadas operacionais alinhadas ao legado

Status: cenário Santo Amaro validado. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou frontend.

### Causa validada da divergencia
- A divergencia principal no cenario Santo Amaro foi causada por coordenada incorreta do deposito na configuracao Supabase usada pela v2.
- A v2 estava usando no banco:
  - `LAT DEPOSITO = -25.4876648`
  - `LNG DEPOSITO = -49.2692262`
- O legado usava, e o usuario confirmou como coordenada correta:
  - `LAT DEPOSITO = -25.493498`
  - `LNG DEPOSITO = -49.276551`
- A configuracao foi corrigida diretamente no Supabase, por solicitacao do usuario, para a coordenada correta.

### Resultado final v2 validado
Normais:
- `10/07` — Sexta — EQUIPE 1 — Normal — R$ 170
- `25/07` — Sábado — EQUIPE 1 — Normal — R$ 230
- `31/07` — Sexta — EQUIPE 1 — Normal — R$ 170

Outras opções:
- `16/07` — Quinta — EQUIPE 1 — Premium — R$ 370
- `24/07` — Sexta — EQUIPE 1 — Especial — R$ 270

Tempo total da v2: `00:09`

### Diagnostico tecnico apos correcao
- Melhor insercao v2 para `16/07`: fim da rota
- Antes: `agenda_90` (Rua Nicanor do Rosário, 96, Pinheirinho, Curitiba - PR, 81870-620)
- Depois: `null`
- Delta v2: `10438m`
- Delta legado esperado/logado: aproximadamente `10460m`
- Diferenca: `22m`, aproximadamente `0,2%`
- Classificacao v2: `premium`

### Decisao/criterio operacional
- Coordenadas operacionais oficiais de deposito/casas devem estar alinhadas ao legado.
- A fonte oficial operacional e o banco/Supabase (`procurar_datas_config`).
- Divergencia de coordenada operacional pode alterar delta, classificacao e recorte.
- Nao houve alteracao de regra de negocio.
- O ajuste foi em configuracao operacional no banco.

---

## 2026-06-24 - Frente 0 / Controle: tela de configuracao mostra banco como valor principal

Status: ajuste de UI concluido. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### O que mudou
- A tela `/configuracoes/procurar-datas` agora renderiza o valor ativo do banco/Supabase como valor principal.
- A planilha aparece como referencia secundaria (`Planilha: X`) quando diverge.
- Removida a linha auxiliar `banco: X` que criava ambiguidade.
- Edicao inline inicia com o valor do banco.
- Salvamento continua identico; apenas a renderizacao mudou.

### Causa da ambiguidade anterior
- A API retorna `item.valor` com o valor da planilha e `valor_supabase` com o valor do banco.
- A UI antiga exibia `item.valor` como principal e `valor_supabase` como subtexto.
- Resultado: planilha `8 km` aparecia em destaque e banco `9` aparecia como linha auxiliar.

---

## 2026-06-24 - Frente 1 / esquerda: diagnostico enxuto do delta 16/07 Santo Amaro

Status: diagnostico especifico criado. Nao altera regra de negocio, classificacao, recorte, OSRM, Haversine, frete, banco ou migrations.

### Objetivo
- Isolar a causa da diferenca de ~1km no delta do `16/07`:
  - v2: `9437m` (especial)
  - legado esperado: `10460m` (premium)
  - diferenca: `~1023m`

### Novo artefato
- `src/lib/procurar-datas/motor/diagnostico-delta-santo-amaro-16-jul.ts`
- Retorna estrutura pequena com identificacao, config, rota base, melhor insercao, candidatos de insercao, comparativo legado, hipoteses e trechos do Apps Script para consultar.
- Inclui mini bloco do `24/07` para confirmar dependencia do `16/07` virar premium.

### Ativacao
- Flag na rota `POST /api/procurar-datas/v2/pesquisar-compat-async`:
  - query: `?diagnosticoDeltaSantoAmaro16Jul=true`
  - body: `"diagnosticoDeltaSantoAmaro16Jul": true`

### Pendencia
- Causa raiz da diferenca de delta ainda nao confirmada. Requer comparacao com pontos/ordem/trechos OSRM reais do legado.

---

## 2026-06-24 - Frente 0 / Controle: decisao de fonte oficial das configuracoes do motor v2

Status: decisao de escopo documentada. Ajustes textuais leves na tela de configuracoes. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### Decisao operacional
- A fonte oficial operacional das configuracoes do motor `/procurar-datas` v2 e o banco/Supabase (`procurar_datas_config`).
- A tela `/configuracoes/procurar-datas` deve refletir o valor efetivamente salvo e usado no banco.
- A planilha Google Sheets e fonte de importacao e referencia historica, nao fonte ativa do motor v2.
- Snapshots importados da planilha continuam uteis como historico e ponto de comparacao.

### Contexto
- Durante a investigacao Santo Amaro, o parametro `KM MAX ENTRE PONTOS` estava causando divergencia no filtro early Haversine.
- O banco tinha `7` (editado manualmente via tela apos importacao), enquanto a planilha tinha `8`.
- O legado le a planilha diretamente, entao usava `8`.
- A v2 prioriza o banco, entao usava `7`.
- Isso gerou descarte indevido de `25/07` pelo filtro early (10.99km > 10.5km).
- Apos corrigir o banco para `8`, o filtro passou a usar `limiteHaversineKm = 12`, e `25/07` voltou a ser elegivel.

### Ajustes textuais na tela `/configuracoes/procurar-datas`
- Cabecalho: "Banco de dados (fonte oficial) com planilha como referencia.".
- Origem: "banco de dados interno (fonte oficial)".
- Resumo de comparacao: "Banco vs planilha".
- Badge: "editado no banco" (em vez de "editado no app").
- Loading: "Lendo configuracoes...".
- Importacao: textos reforcam que os valores sao importados para o banco.
- Nenhuma logica de salvamento, persistencia, schema ou importacao foi alterada.

### Pendencia de UX/UI futura
- Inverter hierarquia visual para deixar claro qual valor e usado pelo motor:
  - Valor principal: valor ativo do banco.
  - Valor secundario: valor da planilha (referencia).
  - Status: "sincronizado" ou "divergente da planilha".

### O que nao foi alterado
- Nenhuma regra de negocio.
- Nenhum codigo funcional do motor de busca.
- Nenhuma migration/schema.
- Nenhum dado do banco alterado nesta tarefa.
- Frontend: apenas textos/labels ajustados; logica de salvamento intacta.
- Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte: intactos.
- Investigacao Santo Amaro: continua pendente no ponto `16/07` premium.

---

## 2026-06-24 - Frente 1 esquerda: regra validada de filtro early Haversine/ancora

### Regra legado confirmada no codigo
- Em `appscript/CEP-APIBACK.gs`, antes do calculo de melhor insercao por OSRM, slots com pontos passam por filtro early:
  - menor Haversine ponto -> destino deve ser menor ou igual a `MAX_POINT_KM * 1.5`;
  - depois, a ancora por menor OSRM ponto -> destino e comparada ao limite premium `MAX_POINT_KM + (MAX_EXTRA_PREMIUM / 1000)`.
- Se o filtro descarta, o slot nao chega a gerar candidato normal/especial/premium.

### Equivalencia v2
- O caminho real v2 passou a aplicar filtro equivalente em `calcularKmAdicionalRealControladoV2`, com limites vindos da config real (`kmMaxEntrePontosKm` e `kmAdicionalMaxNaRotaPremiumM`).
- A correcao e anterior a classificacao e ao recorte, preservando a fronteira da Frente 1.
- O diagnostico por slot expoe `filtroEarlyLegado` para auditar motivo e valores usados.

### Limite da validacao
- A divergencia de `16/07` no cenario Santo Amaro ainda nao foi confirmada como erro de delta por leitura local; requer execucao/diagnostico real com pontos, ordem e trechos OSRM da data.
- Nao houve decisao nova de produto e nao houve alteracao de recorte/ranking.

---

## 2026-06-23 - Frente 3 direita: modo interno v2 na tela real `/procurar-datas`

### Status
- Implementado modo interno controlado na tela real `/procurar-datas`.
- Ativacao somente quando `motor=v2` esta presente na URL e o usuario atual tem `role = superadmin` em `usuarios_permitidos`.
- Sem query, ou sem superadmin, a tela continua usando o legado.

### Endpoints
- Legado preservado: `POST /api/procurar-datas/pesquisar` e `GET /api/procurar-datas/progresso`.
- Modo interno v2: `POST /api/procurar-datas/v2/pesquisar-compat-async` e `GET /api/procurar-datas/v2/progresso-compat`.

### Escopo preservado
- Nao altera Apps Script, rotas legado, rotas v2, motor v2, orquestrador, adaptador, ranking, classificacao, recorte, OSRM, Haversine, banco, migrations ou pre-agendamento.
- Nao troca o padrao da tela para v2.
- Nao implementa progresso parcial real.

### Validacoes
- MCP Supabase confirmou colunas `email`, `role` e `ativo` em `public.usuarios_permitidos`.
- `npx tsc --noEmit`: passou.
- `npx eslint src/app/procurar-datas/page.tsx`: passou.

### Pendencias
- Validacao manual de `/procurar-datas` sem query para confirmar legado.
- Validacao manual de usuario nao-superadmin com `?motor=v2`.

### Validacao manual K13/K14/K15 na tela real (modo interno v2 ativo)
- Parametros usados: Berco/cama DIVERSOS, Comoda/Roupeiro/Poltrona/Painel Selecione, Encomenda nao, Area rural nao, Condominio nao, Tempo 00:40.
- K13 (Cornelius): 3 recomendadas (14/08 R$ 110, 15/08 R$ 170, 17/08 R$ 110), 0 outras opcoes. Passou.
- K14 (Sitio Cercado): 3 recomendadas (11/07 R$ 170, 13/07 R$ 110, 16/07 R$ 110), 1 outra opcao (02/07 R$ 210 especial). Passou.
- K15 (Mandirituba): 3 recomendadas (08/08 R$ 320, 15/08 R$ 320, 17/08 R$ 200), 1 outra opcao (14/07 R$ 400 premium). Passou.
- Nota: Validacoes anteriores podem ter assumido condominio=true; na tela real o teste correto foi condominio=false, o que explica divergencia de frete (R$ 60 a menos).
- Conclusao: K13/K14/K15 passaram na tela real em modo interno v2. A divergencia anterior de frete era explicada pelo parametro condominio=false, nao por bug.

---

## 2026-06-23 - Frente 3: `POST /api/procurar-datas/v2/pesquisar-compat`

### Status
- Rota paralela/manual implementada para validar `PayloadCompacto` legado gerado pela v2.
- Usa o orquestrador isolado com `pesquisarDatasV2`, config real e OSRM `/route` real para `distKm` deposito -> destino.
- Nao altera frontend, producao, Apps Script, `/api/procurar-datas/pesquisar`, polling/progresso ou comparador.

### Retorno
- `ok`, `modo`, `payload`, `avisos`, `diagnosticoMinimo`, `diagnosticoPayloadLegado`, `metadadosValidacao` e `saidaV2`.

### Validacoes
- Typecheck passou.
- Teste da rota `pesquisar-compat` passou.
- Testes de orquestrador, adaptador, frete por `distKm` e `distKm` deposito -> destino passaram.

### Validacao manual K13/K14/K15
- K13 (Cornelius): HTTP 200, 3 candidates, fretes preenchidos, OSRM oficial sem fallback.
- K14 (Sitio Cercado): HTTP 200, 4 candidates, distKm 9.776, fretes preenchidos, OSRM oficial sem fallback.
- K15 (Mandirituba): HTTP 200, 4 candidates, distKm 33.217, fretes preenchidos, OSRM oficial sem fallback.
- Frete veio de distKm deposito -> destino em todos os cenarios. Nao usou kmAdicionalNaRotaM.
- Rota validada como ferramenta paralela/manual.

### Pendencias
- Planejar preservacao do polling/progresso parcial do legado na v2 (Frente 4 futura).
- Resolver dupla leitura de config (otimizacao futura).
- Plug fallback OSRM publico/Haversine no caminho do orquestrador (pendencia conhecida).
- K14/K15 comparacao no comparador pendente por timeout do legado.

---

## 2026-06-23 - Frente 2: orquestrador isolado v2 -> PayloadCompacto legado

### Status
- Implementado orquestrador puro e testado para gerar `PayloadCompacto` legado a partir da busca v2.
- A cadeia isolada agora cobre: busca v2 -> `distKm` deposito -> destino -> fretes por `distKm` -> adaptador v2 -> legado.
- Nao houve criacao de rota, integracao com frontend ou mudanca de producao.

### Garantias preservadas
- `kmAdicionalNaRotaM` nao e usado como `distKm` nem como frete.
- Falha de distancia/config/frete nao derruba a execucao; o payload sai com frete vazio e avisos.
- O fallback publico/Haversine do legado segue pendente e nao foi implementado nesta frente.

### Validacoes
- `npx tsc --noEmit`: passou.
- `npx vitest run src/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado.test.ts`: passou, 5 testes.
- Testes de adaptador, frete por `distKm` e `distKm` deposito -> destino tambem passaram.

### Pendencia
- Integracao futura em rota paralela/compat controlada ainda precisa de decisao e implementacao propria.

---

## 2026-06-23 - Frente 2: frete do PayloadCompacto por `distKm` fornecido

### Status
- Implementada camada isolada para montar fretes legados a partir de `distKm` deposito -> destino ja calculado.
- O adaptador v2 -> legado continua recebendo `fretes` pre-calculados; a diferenca e que agora ha helper testado para montar esses fretes com a regra real.

### Contrato preservado
- `PayloadCompacto.candidates[].frete` permanece string formatada.
- `kmAdicionalNaRotaM` nao e usado como distancia, frete ou fallback.
- Sem chamada OSRM, sem calculo de distancia e sem integracao com frontend/producao.

### Validacoes
- `npx tsc --noEmit`: passou.
- `npx vitest run src/lib/procurar-datas/motor/montar-fretes-legado-por-dist-km.test.ts`: passou, 3 testes.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts`: passou, 11 testes.

### Pendencia
- A orquestracao que calcula `distKm` e chama o helper de frete antes do adaptador ainda nao foi integrada.

---

## 2026-06-23 - Frente 1: distKm deposito -> destino isolado para frete legado

### Diagnostico confirmado
- No Apps Script, `CEP-APIBACK.gs` calcula `distKm` como `getDrivingKm(depositoLoc, locNovo)` antes de montar os candidatos.
- O frete legado usa esse mesmo `distKm` em km em `calcularFrete(distKm, isSat, isRural, isCondominio, freightParams)`.
- `getDrivingKm` tenta OSRM configurado, depois OSRM publico e, se ambos falharem, usa Haversine.
- No Next/v2 ja existia cliente OSRM `/route` reutilizavel: `criarBuscarRotaOSRMRouteDiagnosticoV2`, retornando `distanciaM` em metros, com `fetchImpl` injetavel.
- Nao havia helper especifico para o contrato de frete legado `deposito oficial -> destino` em km.

### Implementacao isolada
- Criado `calcularDistKmDepositoDestino` em `src/lib/procurar-datas/motor/calcular-dist-km-deposito-destino.ts`.
- O helper recebe `latDeposito/lngDeposito`, destino e uma funcao `buscarRota` injetada.
- Converte explicitamente OSRM metros para km: `distKm = Math.round(distanciaM) / 1000`.
- A origem usada e sempre o deposito oficial da config, nao casa de equipe.
- Falha OSRM retorna erro e `distKm: null`; nao fabrica frete nem usa `kmAdicionalNaRotaM`.

### Escopo preservado
- Sem integracao com adaptador, frontend, rotas v2 reais, comparador, Apps Script, banco, Supabase, cache, geocoding, ranking, classificacao ou recorte.
- Sem chamadas reais de OSRM nos testes.

### Validacoes
- `npx tsc --noEmit`: passou.
- `npx vitest run src/lib/procurar-datas/motor/calcular-dist-km-deposito-destino.test.ts`: 6 testes passaram.
- `npx vitest run src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts`: 12 testes passaram.

### Pendencia
- O fallback completo do legado (`OSRM configurado -> OSRM publico -> Haversine`) foi confirmado no Apps Script, mas nao foi integrado a fluxo produtivo nesta tarefa. A decisao de quando plugar esse helper no calculo/injecao de frete segue pendente.

## 2026-06-23 - Validacao offline do adaptador v2 para legado

### Status
Validado o adaptador isolado com fixtures offline K13/K14/K15. Nao integrado a frontend, rotas de producao, rota v2 ou motor.

### O que foi validado
- K13: payload v2 com 3 normais convertido para candidatos legados.
- K14: payload v2 com especial anterior as 3 normais convertido preservando ordem e `isExtra`.
- K15: payload v2 com premium anterior a ultima normal convertido preservando frete injetado.
- Campos obrigatorios de `PayloadCompacto` consumidos pelo frontend.
- Dados suficientes para montar `cand/meta` do pre-agendamento.
- Frete ausente gera `frete: ''` e aviso.
- `kmAdicionalNaRotaM` nao e usado como frete.

### Diagnostico de frete/distKm
- No legado, `distKm` e calculado como `getDrivingKm(depositoLoc, locNovo)` e usado no calculo de frete final.
- A saida v2 atual nao expoe `distKm` deposito -> destino.
- Portanto, ainda nao existe dado confiavel na saida v2 para o adaptador calcular frete real sozinho.

### Ajuste aplicado
- O adaptador passou a preservar `rank` da v2 quando valido, usando posicao apenas como fallback.

### Validacoes
- `npx tsc --noEmit` passou sem erros.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts` passou: 10 testes.

### Pendencias remanescentes
- Definir caminho seguro para fornecer `distKm` deposito -> destino ao adaptador.
- Nao usar `kmAdicionalNaRotaM` para frete.
- Integracao com rota compat/frontend segue fora do escopo.

---

## 2026-06-23 - Adaptador isolado v2 para PayloadCompacto legado

### Status
Implementado helper puro de adaptacao de contrato v2 -> legado. Nao integrado a frontend, rotas de producao ou rota v2.

### Escopo da implementacao
- Criado `src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.ts`.
- Criado teste unitario `src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts`.
- O helper recebe `PesquisarDatasV2Output`, request original, metadados opcionais e fretes opcionais pre-calculados.
- O helper monta `PayloadCompactoCompatLegado` com candidatos em formato compativel com `CandidatoFinal`.

### Decisao sobre frete
- Frete nao e calculado a partir de `kmAdicionalNaRotaM`.
- O legado calcula frete com `distKm` deposito -> destino e parametros de frete; portanto `kmAdicionalNaRotaM` nao e fonte suficiente.
- Quando frete nao e fornecido ao helper, o campo fica `''` e um aviso explicito e retornado.

### Validacoes
- `npx tsc --noEmit` passou sem erros.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts` passou: 6 testes.

### Nao alterado
Nao houve alteracao de Apps Script, frontend, rotas legadas, rota v2, comparador, motor de busca, regra full-window, classificacao, ranking, recorte final, OSRM, Haversine, cache/geocodificacao, Supabase, banco ou migrations.

### Pendencias remanescentes
- Integracao do adaptador em rota compat ou fluxo controlado.
- Fornecer/calcular frete real por caminho seguro com `distKm` correto.
- Simulacao do fluxo de polling/progresso legado, se a promocao futura precisar ser transparente para o frontend.

---

## 2026-06-23 - Pendencia de typecheck dos testes do motor resolvida

### Status
Resolvida a pendencia dos 4 erros pre-existentes em testes do motor `/procurar-datas`.

### Escopo da correcao
- Ajuste restrito a fixtures/testes desatualizados em relacao ao contrato atual de `CandidatoPreliminarV2`.
- Ajuste de cast em mock parcial de `Response` no teste do cliente OSRM /route.
- Nenhum codigo de producao alterado.

### Validacoes
- `npx tsc --noEmit` passou sem erros.
- Testes especificos passando:
  - `adaptador-candidato-legado.test.ts`: 45 testes.
  - `adaptar-candidatos-reais-legado.test.ts`: 30 testes.
  - `ordenacao-candidatos.test.ts`: 25 testes.
  - `osrm-route-client-diagnostico.test.ts`: 12 testes.

### Nao alterado
Nao houve alteracao de regra de negocio, Apps Script, frontend, rotas de producao, rota comparadora, timeout, OSRM, Haversine, cache/geocodificacao, Supabase, classificacao, ranking ou recorte final.

### Pendencias remanescentes
- K14 e K15 seguem com comparacao legado x v2 pendente por timeout do legado.
- Decisao futura sobre ativacao no frontend ou flag segue pendente.

---

## 2026-06-23 - Frente 3 direita: polling compativel simulado v2 (pesquisar-compat-async / progresso-compat)

### Status
- Implementadas e validadas duas rotas v2 paralelas de polling compativel SIMULADO.
- `POST /api/procurar-datas/v2/pesquisar-compat-async`: inicia busca, executa orquestrador completo na propria chamada, salva estado no Redis (Upstash) com TTL 600s, retorna `{ ok, clientToken, status, modo }`.
- `GET /api/procurar-datas/v2/progresso-compat?clientToken=...`: le estado do Redis, retorna `{ ok, progress }` com `status`, `normais`, `extras`, `payload`, `durationMs`, `error` conforme o caso.
- Polling SIMULADO: POST ja salva `done` antes de responder. Nao emite candidatos parciais durante a busca.
- Nao altera frontend, producao, Apps Script, rotas legado, motor v2, orquestrador, OSRM, Haversine, ranking, classificacao ou recorte.

### Arquivos criados
- `src/lib/procurar-datas/v2/progresso-compat-store.ts` — helper Redis (salvar, buscar, separar normais/extras, montar done/error/waiting)
- `src/lib/procurar-datas/v2/progresso-compat-store.test.ts` — 13 testes
- `src/app/api/procurar-datas/v2/pesquisar-compat-async/route.ts` — POST route
- `src/app/api/procurar-datas/v2/pesquisar-compat-async/route.test.ts` — 7 testes
- `src/app/api/procurar-datas/v2/progresso-compat/route.ts` — GET route
- `src/app/api/procurar-datas/v2/progresso-compat/route.test.ts` — 6 testes

### Contrato Redis
- Chave: `procurar-datas:v2:progress:{clientToken}`
- TTL: 600 segundos (10 minutos)
- Credenciais: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- Falha graciosamente sem credenciais (no-op silencioso)

### Validacao automatizada
- `npx tsc --noEmit`: passou sem erros.
- `progresso-compat-store.test.ts`: 13/13.
- `pesquisar-compat-async/route.test.ts`: 7/7.
- `progresso-compat/route.test.ts`: 6/6.
- `orquestrar-pesquisa-v2-com-payload-legado.test.ts`: 5/5 (regressao).
- `adaptar-saida-v2-para-legado.test.ts`: 11/11 (regressao).

### Validacao manual K13/K14/K15 (DevTools)

**K13 — Cornelius (Curitiba/PR):**
- POST HTTP 200, ok true, modo `v2-pesquisar-compat-async`, status `done`.
- GET HTTP 200, ok true, progress status `done`.
- normais 3, extras 0, payload candidates 3.
- Candidates: 2026-08-14 Sexta normal R$ 170 EQUIPE 1 rank 1 / 2026-08-15 Sabado normal R$ 230 EQUIPE 1 rank 2 / 2026-08-17 Segunda normal R$ 170 EQUIPE 1 rank 3.
- Redis real confirmado. clientToken recuperado no GET. durationMs ~13661.

**K14 — Sitio Cercado (Curitiba/PR):**
- POST HTTP 200, ok true, modo `v2-pesquisar-compat-async`, status `done`.
- GET HTTP 200, ok true, progress status `done`.
- normais 3, extras 1, payload candidates 4.
- Candidates: 2026-07-02 Quinta especial R$ 270 EQUIPE 1 rank 1 / 2026-07-11 Sabado normal R$ 230 EQUIPE 1 rank 2 / 2026-07-13 Segunda normal R$ 170 EQUIPE 1 rank 3 / 2026-07-16 Quinta normal R$ 170 EQUIPE 1 rank 4.
- Redis real confirmado. clientToken recuperado no GET. durationMs ~9972.

**K15 — Mandirituba (PR):**
- POST HTTP 200, ok true, modo `v2-pesquisar-compat-async`, status `done`.
- GET HTTP 200, ok true, progress status `done`.
- normais 3, extras 1, payload candidates 4.
- Candidates: 2026-07-14 Terca premium R$ 460 EQUIPE 1 rank 1 / 2026-08-08 Sabado normal R$ 380 EQUIPE 1 rank 2 / 2026-08-15 Sabado normal R$ 380 EQUIPE 1 rank 3 / 2026-08-17 Segunda normal R$ 260 EQUIPE 1 rank 4.
- Redis real confirmado. clientToken recuperado no GET. durationMs ~7383.

### Confirmado
- Rotas `pesquisar-compat-async` e `progresso-compat` validadas como ferramentas paralelas/manuais.
- Contrato de polling compativel simulado funcional: POST -> clientToken -> GET -> done + payload.
- Redis real funcionando no ambiente.
- Payload final vem com candidates, normais, extras, frete, rank, team, datas.
- Frontend, producao legado e Apps Script seguem intocados.
- Nao ha progresso parcial real.

### Pendencias
- Progresso parcial real (emissao incremental de candidatos durante a busca) e fase futura.
- Fallback completo OSRM configurado -> publico -> Haversine nao plugado neste caminho.
- Config duplicada entre `pesquisarDatasV2` e orquestrador (otimizacao futura).
- `maxDuration = 60` pode ser insuficiente em cenarios mais pesados — observar.
- Redis/TTL precisa ser monitorado em usos mais longos.

---

## 1. Objetivo do documento

Este documento é o **contrato de migração** do motor `/procurar-datas`.

Ele define:

- O que a v2 deve reproduzir do legado Apps Script (equivalência funcional).
- O que pode ser melhorado sem decisão adicional.
- O que não pode mudar sem decisão explícita.
- Os critérios que precisam ser atendidos antes de avançar para cada frente ou para produção.
- Os riscos conhecidos e as decisões pendentes.
- A regra obrigatória de consulta ao legado em caso de dúvida.

Deve ser lido **no início de qualquer tarefa sobre `/procurar-datas`** e atualizado quando uma regra for validada ou uma decisão for tomada.

---

## 2. Objetivo da migração

Criar uma v2 interna em Next.js/TypeScript que seja uma **cópia funcional do legado Apps Script nas regras de negócio**, preservando comportamento operacional e permitindo melhorias apenas em:

- velocidade de resposta;
- organização do código;
- tipagem;
- diagnóstico;
- logs;
- testes automatizados;
- isolamento de erros;
- design/frontend somente quando solicitado explicitamente.

A v2 **não substitui o legado** até que a equivalência funcional seja validada explicitamente.

O fluxo de produção atual permanece intacto:

```
Frontend → POST /api/procurar-datas/pesquisar
  → chamarAppsScriptProcurarDatas('ApiIniciarPesquisaDatasApp')
  → polling via GET /api/procurar-datas/progresso
  → Apps Script: planilha de agenda → OSRM → cálculo de frete → candidatos
  → retorno ao frontend
```

---

## 3. Fonte de verdade

### 3.1 Legado Apps Script é a fonte de verdade para regras de negócio

Os arquivos de referência do legado disponíveis no repositório:

- `appscript/CEP-APIBACK.gs` — motor principal de pesquisa: loop de slots, coleta de pontos, OSRM, candidatos, classificação
- `appscript/CEP-CONFIG.gs` — configurações, helpers (`getSlots`, `coletarPontosDoDia`, `normTeam`, `parseMinutes`, `getDrivingKm`, `calcularFrete`)

### 3.2 Documentação ajuda, mas não substitui o legado

Os documentos em `docs/` resumem análises já realizadas, mas:

- Podem estar desatualizados se o legado foi alterado.
- Não cobrem todos os edge cases.
- Qualquer divergência entre documento e código legado: o código legado prevalece.

### 3.3 Regra obrigatória

Em caso de dúvida sobre comportamento, regra, cálculo, ranking, classificação, fallback ou fonte de dados: **consultar o código legado antes de alterar ou propor alteração**. Ver seção 13.

---

## 4. O que pode melhorar sem decisão adicional

| Área | O que pode melhorar |
|------|---------------------|
| Velocidade | Paralelismo, cache, resposta mais rápida que Apps Script |
| Organização | Separação em helpers puros com responsabilidade única |
| Tipagem | TypeScript estrito, interfaces explícitas |
| Testes | Testes unitários cobrindo helpers puros |
| Diagnóstico | Rota diagnóstica isolada, flags de diagnóstico |
| Logs | Logs estruturados, rastreabilidade por bloco |
| Isolamento de erro | Erro em um bloco não quebra o response completo |
| Observabilidade | Estatísticas de desempenho por provedor, campo de origem/motor para diferenciar legado vs v2 (melhoria futura, não critério de equivalência imediata) |
| Frontend/design | **Somente com pedido explícito do usuário** |

---

## 5. O que não pode mudar sem decisão explícita

| Área | Regra protegida |
|------|-----------------|
| Cálculo de `kmAdicionalNaRotaM` | Fórmula de delta de inserção: `OSRM(prev→novo) + OSRM(novo→next) - OSRM(prev→next)` |
| Uso oficial de OSRM | OSRM é o cálculo de distância/rota oficial no legado |
| Papel do Haversine | Apenas pré-filtro, fast-pass, fallback e diagnóstico — não substituto do OSRM |
| Classificação normal | Limite e critério definidos no legado |
| Classificação especial | Limite e critério definidos no legado |
| Classificação premium | Limite e critério definidos no legado |
| Hora marcada | Critério de classificação definido no legado |
| Ranking final | Ordem de prioridade dos candidatos definida no legado |
| Quantidade de resultados | Número de candidatos retornados ao frontend |
| Limites de semana | `MAX_EXTRA_METERS`, `MAX_EXTRA_DYNAMIC` — confirmados no legado |
| Limites de sábado | Limite específico de sábado — confirmar no legado |
| Fonte da agenda | Planilha AGENDA (shAg) — não Google Calendar |
| Google Calendar | Usado apenas para pré-agendamento |
| Fallback de erro | Comportamento quando OSRM falha ou ponto sem coordenada |
| Comportamento de produção | Qualquer mudança na rota `/pesquisar` ou no fluxo legado |

---

## 6. Frentes de trabalho

### Frente 0 / Controle

**Escopo:** documentação de migração, checklist de equivalência, critérios de aceite, mapeamento legado × v2, riscos, decisões, regras obrigatórias.

**Responsabilidade:** garantir que as demais frentes trabalhem dentro do escopo correto.

**Ativo:** este documento.

---

### Frente 1 / Esquerda

**Escopo:** distância, agenda, geocodificação, OSRM, Haversine, delta de inserção, helpers puros.

**Objetivo:** implementar no v2 os helpers equivalentes ao legado para:
- Leitura e parse da planilha AGENDA (shAg / `coletarPontosDoDia`)
- Geocodificação e cache de coordenadas
- Normalização de equipe e origem/depósito
- OSRM real: `getDrivingKm` / `getDrivingKmBatch`
- Delta de inserção real: `prev→novo + novo→next - prev→next` por OSRM
- Regra de sábado: origem `HOME_SAT_E1/E2` em vez de depósito

**Dependências bloqueantes confirmadas:**
- `LAT DEPOSITO` / `LNG DEPOSITO` = NULL no Supabase (confirmado via MCP)
- Parse da planilha AGENDA não integrado ainda na rota

**Status atual:** parcialmente iniciado (ver seção 7).

---

### Frente 2 / Meio

**Escopo:** candidatos, classificação, adaptação legado, ranking.

**Objetivo:** garantir que o v2 produza candidatos equivalentes ao legado para os mesmos inputs.

**Regra crítica:** **Frente 2 não deve avançar enquanto equivalência OSRM legado × v2 não estiver validada.**

Sem OSRM real, o `kmAdicionalNaRotaM` é incorreto, e a classificação normal/especial/premium ficará errada, produzindo candidatos com frete divergente.

**Status atual:** helpers de classificação, candidatos, ordenação e adapter implementados com dados sintéticos. Não em produção.

---

### Frente 3 / Direita

**Escopo:** rota diagnóstica `/api/procurar-datas/v2/diagnostico`, flags de diagnóstico, validações manuais, DevTools.

**Objetivo:** manter a rota diagnóstica funcional e expandível para testes controlados sem afetar produção.

**Status atual:** rota funcional com cadeia completa (sintética + blocos opcionais reais). Ver `docs/procurar-datas-motor-v2-progresso.md`.

---

## 7. Mapa legado × v2

> **Legenda de status:**
> - ✅ Implementado e testado no v2
> - ⚠️ Parcial / diagnóstico apenas
> - ❌ Não implementado no v2
> - 🚫 Bloqueado (dependência não resolvida)
> - — Não aplicável

| Área / Regra | Legado Apps Script | V2 atual | Status | Evidência | Risco | Próximo passo |
|---|---|---|---|---|---|---|
| **Fonte da agenda** | Planilha AGENDA (shAg) via `getRange(2,1,rowsAg,7).getValues()` — confirmado em `CEP-APIBACK.gs:690` | Helper `parse-agenda-shag.ts` criado (helper puro, sem I/O) | ⚠️ Parcial | `motor/parse-agenda-shag.ts` | V2 não lê planilha real ainda | Integrar leitura real da planilha AGENDA |
| **Google Calendar** | Não usado para agenda principal. Usado para pré-agendamento | Não integrado | ❌ | `CEP-APIBACK.gs` (confirmado) | Nenhum enquanto não for frente ativa | Integrar somente quando chegar em pré-agendamento |
| **Geocodificação** | Cache Supabase + geocoding on-demand. Usado em `coletarPontosDoDia()` | Não integrado no v2 | ❌ | `CEP-CONFIG.gs` (confirmado) | Pontos sem coordenada descartados silenciosamente no legado | Integrar cache de coords com mesmo comportamento |
| **Cache de coordenadas** | Cache interno (Supabase ou objeto em memória no legado) | `cacheCoordenadasPorEndereco` aceito como input nos helpers puros | ⚠️ Parcial | `motor/parse-agenda-shag.ts`, `motor/diagnosticarKmAdicional*` | Cache real do legado não mapeado em detalhe | Confirmar estrutura real do cache no legado |
| **Normalização de equipe** | `normTeam()` em `CEP-CONFIG.gs` — confirma "EQUIPE 1"/"EQUIPE 2" | `normalizarEquipe()` em `motor/equipe.ts` — porta fiel confirmada | ✅ | `motor/equipe.ts`, 26 testes passando | Divergência se legado aceitar outras grafias não mapeadas | Nenhum por ora |
| **Origem / depósito (semana)** | `DEPOSIT_ADDRESS` + `depositoLoc` (geocodificado em runtime) — `CEP-APIBACK.gs` | `ENDERECO DEPOSITO`, `LAT DEPOSITO`, `LNG DEPOSITO` preenchidos no Supabase | ⚠️ Parcial | MCP Supabase: valores preenchidos 2026-06-17; v2 ainda não lê LAT/LNG | V2 lê apenas endereço, não coordenadas | Adicionar LAT/LNG DEPOSITO ao config-service.ts quando implementar distância |
| **Origem sábado** | `HOME_SAT_E1` / `HOME_SAT_E2` — origem alternativa para sábado, não o depósito | `LAT CASA E1`/`LNG CASA E1` e `LAT CASA E2`/`LNG CASA E2` criados no Supabase; helper `resolverOrigemOperacionalV2` implementado | ⚠️ Parcial | `CEP-APIBACK.gs` (confirmado), `resolverOrigemOperacionalV2` (25 testes) | V2 usaria depósito no sábado → origem errada se não usar helper | Integrar helper à cadeia de candidatos na Frente 2 |
| **Coleta de pontos da agenda** | `coletarPontosDoDia(slot, agVals, agDisp)` — filtra por data/equipe, extrai endereço (coluna 6 ou regex coluna 5), extrai CEP, geocodifica | `parsearPontosAgendaDoDiaV2()` criado como helper puro (sem I/O, sem geocoding) | ⚠️ Parcial | `motor/parse-agenda-shag.ts`, `docs/procurar-datas-v2-mapeamento-agenda-shag.md` | Geocoding não integrado — coordenadas injetadas manualmente | Integrar geocoding/cache na coleta de pontos |
| **Haversine** | Usado como: (1) pré-filtro `nearestStraight > MAX_POINT_KM * 1.5` → descarta sem OSRM; (2) fast-pass `roughKm = minDist * 1.3`. Confirmado em `CEP-APIBACK.gs` | `haversine()` / `haversineKm()` em `motor/distancia.ts` | ✅ (helper puro) | `motor/distancia.ts`, 14 testes passando | **Risco alto:** usar Haversine como cálculo oficial em vez de apoio/filtro — ver seção 8 | Garantir que Haversine seja usado apenas onde o legado usa |
| **OSRM /route (legado)** | `getDrivingKm(p1, p2)` — HTTP para OSRM `/route/v1/driving`. Principal cálculo de distância por estrada. Confirmado em `CEP-CONFIG.gs` | Não integrado na cadeia principal. Cliente diagnóstico `osrm-table-client-diagnostico.ts` (usa `/table`, não `/route`) | ⚠️ Parcial (diagnóstico) | `motor/osrm-table-client-diagnostico.ts`, `docs/procurar-datas-v2-plano-distancia-osrm.md` | **Risco alto:** v2 usa `/table`, legado usa `/route` — diferença de endpoint — ver seção 8 | Validar equivalência `/route` legado vs `/table` v2 antes de avançar |
| **OSRM /table (v2)** | Não usado no legado | `criarBuscarMatrizOSRMTableDiagnosticoV2()` — cliente HTTP para OSRM `/table/v1/driving` | ⚠️ Diagnóstico | `motor/osrm-table-client-diagnostico.ts`, 19 testes passando | Endpoint diferente do legado — pode produzir distâncias ligeiramente diferentes | Comparar resultado `/route` vs `/table` para mesmo par de coordenadas |
| **Cálculo de delta de inserção** | `prev → novo + novo → next - prev → next` (OSRM para cada par). Confirmado em `CEP-APIBACK.gs:689–1145` | `calcularDeltaInsercaoRotaDiagnosticoV2()` (Haversine, diagnóstico) e `calcularDeltaInsercaoRotaComMatrizDiagnosticoV2()` (função injetada, diagnóstico) | ⚠️ Diagnóstico | `motor/calcular-delta-insercao-rota.ts`, `motor/calcular-delta-insercao-matriz.ts` | Haversine ≠ OSRM — diferença confirmada de ~19% (6907m vs 8214m) | Integrar OSRM real como função injetada no helper de matriz |
| **km adicional na rota** | `bestKm` = menor delta OSRM entre todas as posições de inserção | `kmAdicionalNaRotaM` sintético (`base * 0.5`) na rota diagnóstica | ⚠️ Sintético | `v2/diagnostico/route.ts` | Classificação incorreta com valor sintético | Integrar agenda real + OSRM real |
| **Falha OSRM** | `getDrivingKm`/`getDrivingKmBatch` tentam OSRM próprio → OSRM público → Haversine silencioso. Nunca retornam null. Confirmado em `CEP-CONFIG.gs:706-852` | `ok: false` explícito no helper diagnóstico; comportamento real da Frente 2 ainda não implementado | ⚠️ Parcial | `motor/calcular-delta-insercao-matriz.ts` (diagnóstico); P3 concluída: Opção A aprovada | Fallback silencioso pode classificar candidatos com distância subestimada (~19%) | Implementar fallback Haversine silencioso na Frente 2 conforme P3 |
| **Fallback** | Haversine silencioso quando OSRM falha (getDrivingKm/getDrivingKmBatch). Nunca null. Confirmado em `CEP-CONFIG.gs:706-852` | `null` → candidato `indisponivel` (comportamento seguro do v2 atual, não do legado) | ⚠️ Parcial | `motor/classificacao-candidato.ts:150–158`; P3 concluída: Opção A aprovada | Fallback diferente do legado pode alterar resultados | Implementar fallback Haversine silencioso na Frente 2 conforme P3 |
| **Classificação normal** | Limite `MAX_EXTRA_METERS` — confirmado no legado | `classificarCandidatoOperacionalV2()` — recebe limite via config | ✅ (helper puro) | `motor/classificacao-candidato.ts`, 35 testes passando | Diverge se `kmAdicionalNaRotaM` for sintético | Depende de OSRM real |
| **Classificação especial** | Limite `MAX_EXTRA_DYNAMIC` — confirmado no legado | Implementado | ✅ (helper puro) | `motor/classificacao-candidato.ts` | Idem normal | Idem |
| **Classificação premium** | Limite `MAX_EXTRA_PREMIUM` — confirmado no legado | Implementado | ✅ (helper puro) | `motor/classificacao-candidato.ts` | Idem normal | Idem |
| **Hora marcada** | `HORA_MARCADA_HORAS_A_MAIS > 0 && bestKm <= limiteKmBase && slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)`. Confirmado em `CEP-APIBACK.gs:1143` | Implementado com base em análise | ⚠️ Parcial | `motor/classificacao-candidato.ts`; P8 confirmada 2026-06-17 | Regra exata pode divergir se critério de tempo não for replicado | Ajustar critério de tempo na Frente 2 |
| **Limite semana** | `MAX_EXTRA_METERS`, `MAX_EXTRA_DYNAMIC`, `MAX_EXTRA_PREMIUM` — confirmados em `CEP-CONFIG.gs` | Config carregada via `config-service.ts` | ✅ (via config) | `config-service.ts`, `chaves-editaveis.ts` | Depende de config estar correta no Supabase | Validar valores no Supabase |
| **Limite sábado** | `MAX_SATURDAY_METERS` quando slot sem pontos; `MAX_EXTRA_METERS` quando slot tem pontos. Confirmado em `CEP-APIBACK.gs:903-905` | Não implementado no v2 | ❌ | P9 confirmada 2026-06-17; P11 validada no Supabase | v2 usa `MAX_EXTRA_METERS` para todos os slots | Implementar limite condicional por pontos na Frente 2 |
| **Ranking final** | Ordem definida no legado (`hora-marcada` > `premium` > `especial` > `normal`) — **ordem exata não confirmada via código em detalhe** | `ordenarCandidatosDiagnosticosV2()` | ✅ (diagnóstico) | `motor/ordenacao-candidatos.ts`, 26 testes passando | Ordem pode divergir do legado | Comparar com fixture real |
| **Quantidade de resultados** | Normais: até 5 por dia único; Especial: 1; Premium: 1; Hora marcada: 1. Dias únicos mutuamente exclusivos entre tipos extras. Confirmado em `CEP-APIBACK.gs` | Não implementado no v2 | ❌ | P10 confirmada 2026-06-17 | v2 pode retornar candidatos extras além do limite legado | Implementar limites por tipo e dia único na Frente 2 |
| **Pré-agendamento** | Google Calendar para marcar slots reservados | Não integrado | ❌ | `docs/procurar-datas-pre-agendamento.md` | Nenhum enquanto não for frente ativa | Etapa futura separada |

---

## 8. Papel correto do OSRM e Haversine

### 8.1 OSRM no legado — cálculo oficial

Confirmado em `CEP-APIBACK.gs` e `CEP-CONFIG.gs`:

- `getDrivingKm(p1, p2)` — chamada HTTP para OSRM `/route/v1/driving/{lng1,lat1};{lng2,lat2}` — retorna distância por estrada em km.
- `getDrivingKmBatch(pairs)` — versão batch.
- O loop principal de delta de inserção (`CEP-APIBACK.gs:689–1145`) usa OSRM para cada par `(prev→novo)`, `(novo→next)`, `(prev→next)`.
- **OSRM é o cálculo oficial de rota/distância quando disponível.**

### 8.2 Haversine no legado — apoio/filtro/fallback

Confirmado em `CEP-APIBACK.gs`:

- Pré-filtro: `nearestStraight > MAX_POINT_KM * 1.5` → ponto descartado sem chamar OSRM.
- Fast-pass: `roughKm = minDist * 1.3` → critério relaxado para evitar OSRM desnecessário.
- **Haversine NÃO é o cálculo principal de delta de inserção no legado.**

### 8.3 Diferença confirmada em diagnóstico

Validação manual em 2026-06-17 (DevTools, OSRM real `router.project-osrm.org`):

| Método | Valor | Diferença |
|--------|-------|-----------|
| Haversine | 6.907 m | — |
| OSRM (real) | 8.214 m | +1.307 m (+18,92%) |

Haversine subestimou o km adicional em ~19% frente ao OSRM real. **Este é o risco de usar Haversine como resultado oficial.**

### 8.4 Regras obrigatórias no v2

1. **Haversine é permitido apenas onde o legado usa como apoio/filtro/fallback.** Usar Haversine para calcular `kmAdicionalNaRotaM` como resultado final é **risco alto**.
2. Qualquer uso de Haversine como resultado final de `kmAdicionalNaRotaM` deve ser tratado como diagnóstico e sinalizado como tal (campo `origemKmAdicionalNaRotaM` com sufixo `-haversine-diagnostico`).
3. OSRM deve ser integrado antes de qualquer uso em candidatos de produção.
4. Diferença de endpoint (`/route` no legado vs `/table` no v2) deve ser validada antes de usar OSRM v2 como equivalente ao legado.
5. Em caso de dúvida sobre onde o legado usa Haversine ou OSRM: consultar legado antes de implementar.

---

## 9. Critérios de aceite

> **Legenda:** `[ ]` pendente | `[x]` validado | `[~]` parcialmente validado | `[!]` bloqueado

### 9.1 Equivalência de dados de entrada

- [ ] Agenda vem da planilha AGENDA (shAg), não do Google Calendar.
- [ ] Google Calendar usado apenas para pré-agendamento.
- [ ] Formato de leitura da planilha AGENDA equivalente ao legado (`getRange(2,1,rowsAg,7).getValues()`).
- [~] Parse de pontos da agenda equivalente a `coletarPontosDoDia()` — helper puro criado, sem leitura real integrada.
- [ ] Geocodificação/cache de coordenadas equivalente ou melhor documentado.

### 9.2 Equivalência de origem

- [x] Coordenadas do depósito (`LAT DEPOSITO`/`LNG DEPOSITO`) preenchidas no Supabase — **resolvido 2026-06-17**.
- [ ] Origem para dias de semana = depósito — equivalente ao legado.
- [~] Origem para sábado = `HOME_SAT_E1`/`HOME_SAT_E2` — helper `resolverOrigemOperacionalV2` implementado e testado (25 testes). Ainda não integrado à cadeia de candidatos.
- [~] Normalização de equipe equivalente — `normalizarEquipe()` implementado e testado (26 testes).

### 9.3 Equivalência de distância

- [ ] OSRM usado como cálculo oficial de rota/distância.
- [ ] Haversine usado só onde o legado usa como apoio/filtro/fallback.
- [ ] Delta de inserção usa fórmula `prev → novo + novo → next - prev → next`.
- [x] OSRM v2 `/table` validado contra OSRM legado `/route` para mesmo par de coordenadas — **P1 concluída 2026-06-17** (diferença 1m/0.01%, tolerância 10m).
- [ ] Falha OSRM não cria candidato válido silenciosamente.
- [ ] Sem fallback silencioso para `0`.
- [ ] Sem fallback silencioso para Haversine como cálculo oficial.

### 9.4 Equivalência de disponibilidade

- [~] Parser de linhas da planilha TEMPO DISPONIVEL equivalente ao legado — `parsearDisponibilidadeTempoDisponivelV2()` implementado e testado (54 testes).
- [ ] Leitura real integrada no motor (não apenas na rota diagnóstica).

### 9.5 Equivalência de classificação

- [~] Classificação normal implementada — helper puro testado; depende de `kmAdicionalNaRotaM` real.
- [~] Classificação especial implementada — idem.
- [~] Classificação premium implementada — idem.
- [~] Hora marcada equivalente ao legado — critério confirmado em P8 (2026-06-17): `bestKm <= limiteKmBase` + tempo mínimo. Ainda não integrado à cadeia de candidatos.
- [ ] Limite de semana preservado — valores no Supabase devem ser validados.
- [~] Limite de sábado preservado — confirmado em P9 (2026-06-17): `MAX_SATURDAY_METERS` quando slot sem pontos. Ainda não implementado no v2.

### 9.6 Equivalência de candidatos e ranking

- [~] Ranking implementado diagnosticamente — `ordenarCandidatosDiagnosticosV2()`.
- [ ] Ranking final comparado com fixture real do legado.
- [~] Quantidade de resultados preservada — confirmado em P10 (2026-06-17): normais até 5, especial 1, premium 1, hora marcada 1 por dia único. Ainda não implementado no v2.

### 9.7 Controle de qualidade

- [x] Frente 2 só avança após equivalência OSRM validada — **P1 concluída 2026-06-17**. Frente 2 liberada para implementação controlada.
- [ ] Produção só muda após validação explícita.
- [ ] Comparação operacional legado × v2 executada para pelo menos 3 fixtures.

---

## 10. Riscos conhecidos

| Risco | Confirmação | Impacto | Mitigação |
|-------|------------|---------|-----------|
| V2 usa Haversine onde o legado usa OSRM | Confirmado: diferença de ~19% (6907m vs 8214m) | **Alto** — classificação incorreta, frete divergente até R$ 210 | Usar Haversine apenas como diagnóstico; integrar OSRM antes de classificar |
| `kmAdicionalNaRotaDiagnosticoM` do body alimentar candidatos reais de forma indevida | Risco documentado; campo diagnóstico explícito | **Alto** — candidatos com distância diagnóstica não são candidatos reais | Campo `origemDistanciaKm: "body-diagnostico"` exposto no response |
| Diferença entre OSRM `/route` (legado) e OSRM `/table` (v2) | **✅ VALIDADO 2026-06-17** — Diferença de apenas 1m (0.01%) em cenário real Curitiba, dentro da tolerância de 10m | **Baixo** — diferença é mínima e aceitável | **P2 CONCLUÍDA 2026-06-17** — v2 usará `/table` para matriz em lote; equivalência com `/route` confirmada. |
| ~~`LAT DEPOSITO`/`LNG DEPOSITO` = NULL no Supabase~~ | ~~Confirmado via MCP~~ | ~~**Alto** — impede cálculo correto com coordenadas reais~~ | **RESOLVIDO 2026-06-17** — valores preenchidos; coordenadas das casas das equipes também criadas |
| Fallback Haversine silencioso mascarar falha OSRM | **CONFIRMADO 2026-06-17** — legado usa Haversine silencioso em `getDrivingKm` e `getDrivingKmBatch`; `bestKm` pode ser Haversine sem aviso | **Médio** — candidato classificado com distância Haversine (subestimada ~19%) pode ter tipo errado; risco real mas aceito pelo legado | **P3 CONCLUÍDA 2026-06-17** — Opção A aprovada: replicar legado. Logs/diagnóstico de fallback permitidos como melhoria sem alterar regra de negócio. |
| Ponto sem coordenada alterar decisão | Legado descarta silenciosamente pontos sem coord | **Médio** — rota calculada sem esse ponto, delta subestimado | V2 deve registrar explicitamente os descartes |
| Origem de sábado divergente | V2 não tem `HOME_SAT_E1`/`HOME_SAT_E2` integrado na cadeia de candidatos | **Alto** — delta incorreto para candidatos de sábado se usar depósito | Integrar `resolverOrigemOperacionalV2` à cadeia de candidatos na Frente 2 |
| Agenda/planilha interpretada de forma diferente | Parser v2 criado, mas leitura real não integrada | **Alto** — pontos do dia incorretos | Validar parser contra dados reais da planilha |
| Classificação errada por unidade (metro/km) ou arredondamento | Não confirmado | **Médio** — candidatos na faixa limite podem mudar de tipo | Validar unidades em todos os helpers |
| Hora marcada com critério diferente do legado | **CONFIRMADO 2026-06-17** — `bestKm <= limiteKmBase` + tempo mínimo (`HORA_MARCADA_HORAS_A_MAIS > 0`) | **Médio** — candidatos hora marcada podem estar incorretos se critério de tempo não for replicado | Ajustar critério de tempo na Frente 2 (divergência C) |
| Quantidade de resultados diferente do legado | **CONFIRMADO 2026-06-17** — normais até 5, especial 1, premium 1, hora marcada 1 por dia único | **Baixo** — pode exibir mais candidatos que o legado permitiria | Implementar limites por tipo e dia único na Frente 2 |

---

## 11. Decisões já tomadas

| # | Decisão | Data | Motivo |
|---|---------|------|--------|
| D1 | Não alterar produção sem validação explícita | — | Estabilidade |
| D2 | Não alterar frontend sem pedido explícito | — | Escopo |
| D3 | Não reabrir Frente 2 antes de validar equivalência OSRM | — | Classificação incorreta sem OSRM real |
| D4 | Não substituir regra do legado por melhoria sem decisão explícita | — | Fidelidade funcional |
| D5 | Usuário faz commit/push manualmente | — | Controle do usuário |
| D6 | Testes manuais autenticados entregues como snippet DevTools | — | Rota requer autenticação |
| D7 | `kmAdicionalNaRotaM: null` → candidato `indisponivel` (seguro) | 2026-06-15 | Evitar classificação incorreta sem dado real |
| D8 | `kmAdicionalNaRotaM: 0` sem flag diagnóstica → não usar em produção | 2026-06-15 | `0 <= limiteBaseM` sempre verdadeiro → todos `normal` |
| D9 | Haversine é auxiliar/diagnóstico; OSRM é cálculo oficial | — | Confirmado no código legado |
| D10 | Rota legada `/api/procurar-datas/pesquisar` preservada sem alteração | — | Produção |
| D11 | Preencher `LAT DEPOSITO`/`LNG DEPOSITO` e criar `LAT CASA E1`/`LNG CASA E1`/`LAT CASA E2`/`LNG CASA E2` no Supabase | 2026-06-17 | Desbloquear cálculo de distância e origem de sábado no v2 |

---

## 12. Decisões pendentes

| # | Decisão | Bloqueante para | Por quê pendente |
|---|---------|----------------|-----------------|
| ~~P1~~ | ~~Validar equivalência OSRM legado `/route` vs v2 `/table`~~ | ~~Frente 2 e produção~~ | **✅ CONCLUÍDA 2026-06-17** — Validado via DevTools com cenário real (Praça Tiradentes → Jardim Botânico → Parque Barigui). Resultado: delta route 9678m, delta table 9677m, diferença 1m (0.01%), dentro da tolerância de 10m. Usuário aprovou. P2 pode ser decidida. Não altera produção automaticamente. |
| ~~P2~~ | ~~Definir se v2 usará `/table` em produção ou manterá `/route` por compatibilidade~~ | ~~Frente 2~~ | **✅ CONCLUÍDA 2026-06-17** — Decisão: v2 usará OSRM `/table` para cálculo em lote/matriz na Frente 2. Equivalência com legado `/route` validada em P1 (diferença de 1m/0.01% em cenário real Curitiba, dentro da tolerância de 10m). Regra de negócio preservada: delta = `prev → novo + novo → next − prev → next`. `/table` é melhoria de eficiência/organização, não mudança de regra de negócio. Fallback em falha segue P3 (Haversine silencioso). |
| ~~P3~~ | ~~Definir política de fallback quando OSRM falhar~~ | ~~Frente 2 e produção~~ | **✅ CONCLUÍDA 2026-06-17 — OPÇÃO A APROVADA** — Decisão: replicar o legado. OSRM oficial quando disponível; Haversine como fallback silencioso quando OSRM falha. `getDrivingKm` e `getDrivingKmBatch` nunca retornam null. Fallback Haversine alimenta `kmAdicionalNaRota` real e pode afetar classificação/ranking, como ocorre no legado. Não marcar candidato como indisponível nem descartar candidato por falha de OSRM. Logs/diagnóstico de fallback são permitidos como melhoria sem alterar regra de negócio. Risco conhecido: Haversine pode subestimar distância (~19%) e classificar mais permissivamente. |
| ~~P4~~ | ~~Definir como tratar ponto sem coordenada (descartar? usar última conhecida?)~~ | ~~Frente 1~~ | **✅ CONCLUÍDA 2026-06-17 — AUDITADA** — Legado confirmado: `coletarPontosDoDia` (CEP-CONFIG.gs:1596) chama `ResolverEnderecoComCache_` (CEP-APIBACK.gs:3188). Se falha (retorna `{ok: false}`), ponto é **descartado silenciosamente** — não entra no array `pts`. Rota calculada apenas com pontos que têm coordenadas. Não tenta geocodificar novamente, não usa última coordenada conhecida, não substitui por depósito/casa. Log de erro registrado (`[PTS][ERRO] geocode falhou`). Comportamento igual para todos os tipos (normal/especial/premium/hora-marcada). Impacto: rota pode ter menos pontos, afetando `bestKm` indiretamente. v2 deve replicar: descartar silenciosamente pontos sem coordenada na montagem da matriz OSRM. |
| ~~P5~~ | ~~Definir quando reabrir Frente 2~~ | — | **REABERTA 2026-06-17 para auditoria/plano** — equivalência OSRM validada (P1 concluída). Ver seção 15. |
| P6 | Definir critérios mínimos de comparação com legado antes de produção | Produção | Nenhum critério formal definido ainda |
| P12 | Confirmar se legado responde em <170s via `ApiPesquisarDatasApp` nos cenários K13/K14/K15 | Comparador ao vivo | K18 rodou com timeout=30s (muito baixo). Corrigido para 170s e maxDuration=180. K18 deve ser rerodado. Se legado ainda der timeout (>170s), precisaria de comparador assíncrono. |
| ~~P7~~ | ~~Preencher `LAT DEPOSITO`/`LNG DEPOSITO` no Supabase~~ | ~~Frente 1 e 2~~ | **RESOLVIDO 2026-06-17** — LAT/LNG DEPOSITO preenchidos; LAT/LNG CASA E1/E2 criados para origem de sábado |
| ~~P8~~ | ~~Confirmar critério exato de hora marcada no legado~~ | ~~Frente 2~~ | **CONFIRMADO 2026-06-17** — `HORA_MARCADA_HORAS_A_MAIS > 0 && bestKm <= limiteKmBase && slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)`. Hora marcada só para candidatos dentro do limite normal. |
| ~~P9~~ | ~~Confirmar limite de sábado no legado~~ | ~~Frente 2~~ | **CONFIRMADO 2026-06-17** — `MAX_SATURDAY_METERS` (`KM MAXIMO NO SÁBADO` na config) usado quando o slot não tem pontos. Quando há pontos, usa `MAX_EXTRA_METERS` mesmo no sábado. |
| ~~P10~~ | ~~Confirmar quantidade máxima de resultados no legado~~ | ~~Frente 2~~ | **CONFIRMADO 2026-06-17** — Normais: até 5 por dia único; Especial: 1; Premium: 1; Hora marcada: 1. Dias únicos são mutuamente exclusivos entre tipos extras. |
| ~~P11~~ | ~~Confirmar valores reais de `MAX_EXTRA_METERS`, `MAX_EXTRA_DYNAMIC`, `MAX_EXTRA_PREMIUM`, `MAX_WEEKDAY_METERS`, `MAX_SATURDAY_METERS`, `HORA_MARCADA_HORAS_A_MAIS` no Supabase via MCP~~ | ~~Frente 2 implementação~~ | **RESOLVIDO 2026-06-17** — Todos os 6 limites confirmados via Supabase: `KM ADICIONAL MAX NA ROTA`=5000m, `KM MAXIMO NA SEMANA`=150000m, `KM MAXIMO NO SÁBADO`=45000m, `KM MAX ENTRE PONTOS`=7km, `KM ADICIONAL MAX NA ROTA ESPECIAL`=5000m, `KM ADICIONAL MAX NA ROTA PREMIUM`=10000m. Todos ativos. |
| — | Leitura automática de AGENDA (shAg) no modo diagnóstico | Opção B | **✅ IMPLEMENTADO 2026-06-18** — Criado helper `buscarAgendaRealDiagnosticaComDados` que lê a planilha AGENDA do Google Sheets (gid 1324794210, mesma aba do legado). Nova flag `usarAgendaRealDiagnostica` na rota `/api/procurar-datas/v2/diagnostico`. Quando ativa junto com `usarDisponibilidadeRealDiagnostica` e `usarKmAdicionalRealControladoDiagnostico`, a rota lê a agenda real automaticamente para calcular `kmAdicionalNaRotaM`, sem exigir `linhasAgendaDiagnostica` manual. |

---

## 13. Regra de consulta obrigatória ao legado

### Regra

**Sempre que houver dúvida sobre comportamento, regra, cálculo, ranking, classificação, fallback ou fonte de dados, o agente deve consultar o código legado Apps Script antes de alterar ou propor alteração.**

Arquivos legado disponíveis:

- `appscript/CEP-APIBACK.gs` — motor principal
- `appscript/CEP-CONFIG.gs` — configurações e helpers

### Se o legado não estiver disponível ou o trecho não for encontrado

- Marcar como pendência explícita.
- **Não inventar comportamento.**
- **Não implementar por suposição.**
- Indicar quais trechos do legado são necessários para resolver a dúvida.
- Registrar como "hipótese" qualquer conclusão não confirmada no código.

### Exemplos de quando consultar obrigatoriamente

- Antes de implementar qualquer regra de classificação.
- Antes de definir limites de `kmAdicionalNaRotaM`.
- Antes de implementar fallback de OSRM.
- Antes de definir qual origem usar em sábados.
- Antes de implementar hora marcada.
- Antes de definir quantidade de resultados.
- Antes de qualquer alteração no ranking.

---

## 14. Como usar este documento

### Ao iniciar uma tarefa sobre `/procurar-datas`

1. Ler este documento antes de iniciar.
2. Identificar em qual frente a tarefa se encaixa.
3. Verificar se a tarefa depende de alguma decisão pendente (seção 12).
4. Se houver dúvida sobre regra, consultar o legado antes de qualquer alteração (seção 13).

### Ao finalizar uma tarefa

1. Atualizar o status na tabela da seção 7 se alguma área foi implementada ou validada.
2. Mover decisões de "pendentes" para "tomadas" (seção 11/12) se foram resolvidas.
3. Atualizar critérios de aceite (seção 9) para `[x]` quando validados.
4. Atualizar `docs/ia/log_progress.md` com resumo da tarefa.

### Este documento não substitui

- A leitura do código real (legado ou v2).
- O MCP Supabase para validação de banco.
- As fixtures reais capturadas em `docs/fixtures/procurar-datas/legado/`.
- Os documentos técnicos de detalhe em `docs/`.

### Documentos relacionados

- `docs/procurar-datas-motor-v2-progresso.md` — progresso técnico detalhado do v2
- `docs/procurar-datas-v2-plano-distancia-osrm.md` — plano de integração OSRM/distância
- `docs/procurar-datas-v2-plano-comparacao-operacional.md` — plano de comparação operacional
- `docs/procurar-datas-v2-mapeamento-disponibilidade-legado.md` — mapeamento da planilha TEMPO DISPONIVEL
- `docs/procurar-datas-v2-mapeamento-agenda-shag.md` — mapeamento da planilha AGENDA
- `docs/procurar-datas-v2-proximas-etapas-operacionais.md` — próximas etapas
- `docs/fixtures/procurar-datas/legado/` — fixtures reais capturadas do legado
- `appscript/CEP-APIBACK.gs` — motor legado principal (fonte de verdade)
- `appscript/CEP-CONFIG.gs` — configuração e helpers legado (fonte de verdade)

---

## 15. Auditoria Frente 2 — Plano de Integração OSRM (2026-06-17)

> **Status:** Auditoria concluída. Nenhum código alterado. Plano para implementação futura.

### 15.1 Onde `kmAdicionalNaRotaM` nasce no v2 hoje

O campo é **injetado como parâmetro externo** em `gerar-candidatos-disponibilidade-real.ts` (`GerarCandidatosComDisponibilidadeRealV2Input.kmAdicionalNaRotaM`). Não é calculado internamente pela cadeia de candidatos.

O mesmo valor único é repassado para **todos os candidatos** (todas as datas × equipes) no loop. No legado, `bestKm` é calculado por slot individual (data × equipe × pontos da agenda daquele dia). **Esta é a divergência estrutural mais crítica.**

Helpers de cálculo disponíveis mas **não integrados à cadeia de candidatos**:
- `calcular-delta-insercao-rota.ts` → Haversine diagnóstico
- `calcular-delta-insercao-matriz.ts` → função injetada (pronto para OSRM)
- `diagnosticar-km-adicional-agenda.ts` → orquestrador diagnóstico (parse agenda + delta Haversine)

### 15.2 Onde `kmAdicionalNaRotaM` é consumido no v2

Em `classificacao-candidato.ts:150-159` — validação e comparação com limites de config:
- `null` / não-finito → candidato `indisponivel` com motivo explícito
- `<= limiteBaseM` → normal
- `<= limiteEspecialM` → especial
- `<= limitePremiumM` → premium

Em `candidato.ts:186` — armazenado em `distancia.kmAdicionalNaRotaM` para auditoria.

### 15.3 Divergências confirmadas entre legado e v2 (por prioridade)

| Divergência | Nível | Trecho legado confirmado |
|---|---|---|
| **A** — `kmAdicionalNaRotaM` único para todos os candidatos vs por-slot | 🔴 Bloqueador | `CEP-APIBACK.gs:882-1068` |
| **B** — Limite KmBase muda se slot tem pontos: com pontos usa `MAX_EXTRA_METERS`; sem pontos usa `MAX_WEEKDAY_METERS` ou `MAX_SATURDAY_METERS` | 🔴 Alto | `CEP-APIBACK.gs:903-905` |
| **C** — Hora marcada: legado exige `bestKm <= limiteKmBase` + `HORA_MARCADA_HORAS_A_MAIS > 0` | 🔴 Alto | `CEP-APIBACK.gs:1143` |
| **D** — Especial/premium condicionais: `MAX_EXTRA_DYNAMIC > 0` e `MAX_EXTRA_PREMIUM > 0` | 🟡 Médio | `CEP-APIBACK.gs:1125,1132` |
| **E** — Limites especial/premium são relativos ao base (+5km, +10km) no legado | 🟡 Médio | `CEP-APIBACK.gs:908-909` |
| **F** — Haversine como fallback silencioso do OSRM no legado | 🟡 Médio | `CEP-CONFIG.gs:824,846` |
| **G** — Filtro de região operacional (apenas normais) não implementado no v2 | 🟡 Médio | `CEP-APIBACK.gs:1263` |
| **H** — Busca progressiva 45→60→90 dias não implementada no v2 | 🟡 Médio | `CEP-APIBACK.gs:1274` |
| **I** — Unidade: legado usa km em `bestKm`; v2 usa metros em `kmAdicionalNaRotaM` | ℹ️ Não é risco se conversão for feita na integração | `CEP-CONFIG.gs:835`, `classificacao-candidato.ts:100-104` |

### 15.4 Itens confirmados do legado nesta auditoria

| Item | Valor confirmado |
|---|---|
| Origem sábado EQUIPE 1 | `HOME_SAT_E1` (config) |
| Origem sábado EQUIPE 2 | `HOME_SAT_E2` (config) |
| Origem semana | `DEPOSIT_ADDRESS` (config) |
| Endpoint OSRM | `/route/v1/driving/{lng},{lat};{lng},{lat}` |
| Fórmula delta | `prev→novo + novo→next - prev→next` |
| Fallback OSRM | Haversine silencioso (`getDrivingKm` e `getDrivingKmBatch`) |
| Hora marcada critério km | `bestKm <= limiteKmBase` |
| Hora marcada critério tempo | `slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS × 60)` |
| Resultados normais | Até 5 por dia único |
| Resultados especial | 1 por dia único (diferente dos normais) |
| Resultados premium | 1 por dia único (diferente dos normais e especial) |
| Resultados hora marcada | 1 por dia único |
| Frete usa | `distKm` (depósito→destino), não `bestKm` |

### 15.4.1 Status Frente 1 — Base de origem/configuração (2026-06-17)

**Implementado:**
- `config-service.ts` atualizado para carregar coordenadas de origem:
  - `LAT DEPOSITO`, `LNG DEPOSITO` (depósito)
  - `LAT CASA E1`, `LNG CASA E1` (casa equipe 1)
  - `LAT CASA E2`, `LNG CASA E2` (casa equipe 2)
- Helper `resolverOrigemOperacionalV2` criado e testado:
  - Recebe dataISO + equipe + config
  - Retorna origem correta: depósito (dias úteis) ou casa da equipe (sábados)
  - Sem fallback silencioso — erro explícito se coordenada ausente
  - 25 testes unitários cobrindo todos os cenários
- **Não altera:** candidatos, classificação, ranking, produção

**Validado (2026-06-17):**
- Testes unitários: 25 passed
- Typecheck: sem erros nos novos arquivos
- Erro preexistente não relacionado: `osrm-route-client-diagnostico.test.ts:95` (conversão de tipo mock Response)
- **Validação MCP Supabase (coordenadas): [CONCLUÍDA]** Todas as 6 chaves existem, estão ativas e possuem valores válidos no Supabase:
  - `LAT DEPOSITO`: `-25.4876648` (decimal, grupo equipes, ativo)
  - `LNG DEPOSITO`: `-49.2692262` (decimal, grupo equipes, ativo)
  - `LAT CASA E1`: `-25.494297` (decimal, grupo equipes, ativo)
  - `LNG CASA E1`: `-49.277091` (decimal, grupo equipes, ativo)
  - `LAT CASA E2`: `-25.494297` (decimal, grupo equipes, ativo)
  - `LNG CASA E2`: `-49.277091` (decimal, grupo equipes, ativo)
- **Validação MCP Supabase (P11): [CONCLUÍDA]** Todas as 6 chaves existem, estão ativas e possuem valores válidos:
  - `KM ADICIONAL MAX NA ROTA`: `5000` (distance_m, grupo rota, ativo)
  - `KM MAXIMO NA SEMANA`: `150000` (distance_m, grupo rota, ativo)
  - `KM MAXIMO NO SÁBADO`: `45000` (distance_m, grupo rota, ativo)
  - `KM MAX ENTRE PONTOS`: `7` (distance_km, grupo rota, ativo)
  - `KM ADICIONAL MAX NA ROTA ESPECIAL`: `5000` (distance_m, grupo rota, ativo)
  - `KM ADICIONAL MAX NA ROTA PREMIUM`: `10000` (distance_m, grupo rota, ativo)

### 15.5 Pendências bloqueantes antes de implementar

1. **[RESOLVIDO] Confirmar valores de config no Supabase via MCP** (P11):
   - Validado em 2026-06-17 por consulta direta ao Supabase.
   - Todas as 6 chaves existem, estão ativas e possuem valores válidos.
   - Ver detalhes na seção 15.4.1 acima.

2. **[RESOLVIDO] Confirmar valores das coordenadas de origem** — todas validadas no Supabase (LAT/LNG DEPOSITO, CASA E1/E2) e carregadas pelo `config-service.ts` no helper `resolverOrigemOperacionalV2`.

3. **[CONCLUÍDO] Decidir P3** — política de fallback quando OSRM falhar. **Decisão 2026-06-17: Opção A aprovada** — replicar o legado. OSRM oficial quando disponível; Haversine fallback silencioso quando OSRM falha. `getDrivingKm` e `getDrivingKmBatch` nunca retornam null. Ver seção 15.5.1 para análise completa.

### 15.5.1 Auditoria P3 — Política de fallback OSRM (2026-06-17)

**Resultado da auditoria:** comportamento do legado confirmado nos arquivos `appscript/CEP-APIBACK.gs` e `appscript/CEP-CONFIG.gs`.

**Fluxo quando OSRM funciona:**
1. `getDrivingKmBatch` chama OSRM para cada par (origem→destino, destino→próximo, etc.)
2. Resultado é armazenado no cache e usado como `bestKm` (delta de inserção)
3. `bestKm` classifica candidato em normal / especial / premium / hora marcada

**Fluxo quando OSRM falha (`getDrivingKm`):**
1. Tenta OSRM próprio (`OSRM_BASE`) → se falha:
2. Tenta OSRM público (`router.project-osrm.org`) → se também falha:
3. Retorna `haversine(a, b)` **sem nenhum log diferenciado, sem retorno null, sem flag**
4. Cache recebe o valor Haversine como se fosse OSRM
5. Candidato continua sendo classificado com esse valor Haversine

**Fluxo quando OSRM falha (`getDrivingKmBatch`):**
- Se `fetchAll` lança exceção no chunk: `haversineKm` silencioso para cada par afetado
- Se HTTP != 200 ou parse falha: `haversineKm` silencioso
- Retorno do array nunca tem `null` — sempre tem um número (OSRM ou Haversine)
- Sem log diferenciado entre "esse km veio de OSRM" e "esse km veio de Haversine"

**Impacto na classificação:**
- `bestKm` usado em `bestKm <= limiteKmBase` / `limiteKmEspecial` / `limiteKmPremium` pode ser Haversine
- Haversine subestima ~19% em relação a OSRM em cenário real Curitiba
- Um candidato que seria `FORA-LIMITE` com OSRM pode aparecer como `NORMAL` com Haversine
- O legado aceita esse risco silenciosamente — não existe modo degradado explícito

**Diferença de uso de Haversine:**
- Como **filtro rápido** (linha 920-928): `haversineKm` descarta slot se `nearestStraight > MAX_POINT_KM * 1.5` → OSRM não é chamado → candidato descartado. Isso é pré-filtro, não fallback.
- Como **fallback de distância** (linhas 727-729 e 824-848): Haversine substitui OSRM silenciosamente quando OSRM falha → candidato classificado com distância subestimada.

**Opcoes de decisão para P3:**
- **Opção A (replicar legado):** v2 usa Haversine silencioso quando OSRM falha, sem marcar o candidato. Comportamento idêntico ao legado. Risco: candidatos com distância subestimada passam filtro.
- **Opção B (v2 mais conservador):** v2 retorna `ok: false` ou marca `origemDistancia: 'haversine-fallback'` quando Haversine foi usado. Candidato pode ser marcado como indisponível ou ter flag de baixa confiança. Risco: menos candidatos retornados quando OSRM está instável.
- **Opção C (meio-termo):** v2 usa Haversine como fallback mas registra em log/campo diagnóstico qual distância veio de fallback, sem descartar candidato.

**Decisão:** pendente do usuário. Auditoria concluída. A v2 atual usa `ok: false` explícito no helper `calcularDeltaInsercaoRotaComMatrizDiagnosticoV2` — esse comportamento difere do legado e precisa decisão antes de integrar em classificação real.

### 15.6 Plano mínimo de implementação futura (9 etapas)

> **Regra:** Nenhuma etapa altera produção. Cada etapa é diagnóstica e isolada.

**Etapa 1 — Helper de origem por dia/equipe (puro, testado)**
Criar `escolherOrigemV2(ehSabado, equipe, configCoords)` → retorna coordenadas corretas.
Depende de: leitura do `config-service.ts` existente.

**Etapa 2 — Calcular `kmAdicionalNaRotaM` por slot via OSRM table (diagnóstico)**
Adaptar `calcular-delta-insercao-matriz.ts` para receber função de distância OSRM table.
Helper resultante: puro, testado, não integrado a rota.

**Etapa 3 — Mudar interface de `gerarCandidatosComDisponibilidadeRealV2` para receber km por slot**
Interface atual: único `kmAdicionalNaRotaM` para todos.
Interface futura: mapa `(dataISO, equipe) → kmAdicionalNaRotaM | null`.
**Impacto:** quebra os testes atuais do helper — devem ser atualizados junto.

**Etapa 4 — Corrigir limite KmBase por pontos (divergência B)**
Slot sem pontos: usar `MAX_WEEKDAY_METERS` ou `MAX_SATURDAY_METERS` como limite.
Ajuste em `classificacao-candidato.ts` ou na config passada por slot.

**Etapa 5 — Corrigir critério de hora marcada (divergência C)**
Hora marcada apenas para `kmAdicionalNaRotaM <= limiteBaseM`.
Ajuste em `classificacao-candidato.ts`.

**Etapa 6 — Adicionar condicional de especial/premium (divergência D)**
Verificar `MAX_EXTRA_DYNAMIC > 0` antes de classificar como especial. Idem premium.
Confirmar valores no Supabase via MCP antes de implementar.

**Etapa 7 — Testes unitários para cada helper novo/alterado**
Cobrir: origem correta, delta por slot, slot sem pontos, fallback explícito, hora marcada com km.

**Etapa 8 — Integração na rota diagnóstica com nova flag**
Flag `usarOSRMRealPorSlotDiagnostico` na rota `POST /v2/diagnostico`.
Não alterar comportamento do bloco sem flag.

**Etapa 9 — Validação manual contra legado**
Comparar resultado da rota diagnóstica v2 com `/pesquisar` legado para ao menos 3 fixtures.
Critério: mesmos candidatos eleitos (tipo, data, equipe) ± tolerância definida em P6.


---

### 15.7 Frente 2 / meio - primeira fatia real controlada (2026-06-17)

> **Status:** Implementada em modo diagnostico/controlado. Producao e frontend nao alterados.

**Implementado:**
- Helper calcularKmAdicionalRealControladoV2.
- Calculo de kmAdicionalNaRotaM por data/equipe usando resolverOrigemOperacionalV2, pontos da agenda controlada, OSRM /table e fallback Haversine conforme P3.
- Descarte de pontos sem coordenada conforme P4.
- Bloco opcional diagnosticoKmAdicionalRealControlado na rota diagnostica, ativado por usarKmAdicionalRealControladoDiagnostico: true.
- Isolamento do valor manual kmAdicionalNaRotaDiagnosticoM: ele nao alimenta candidatos reais; no modo controlado, candidatos usam apenas o km calculado pelo novo bloco.

**Nao alterado:**
- /api/procurar-datas/pesquisar.
- Frontend.
- Ranking final de producao.
- Banco/Supabase.
- Motor legado Apps Script.

**Riscos/pendencias:**
- AGENDA real e geocoding real ainda nao foram integrados; as linhas da agenda continuam controladas pelo body diagnostico.
- Fallback Haversine pode subestimar distancia, risco aceito por equivalencia com o legado na decisao P3.
- Proximo passo: evoluir de valor calculado por um unico data/equipe diagnostico para mapa por slot antes de qualquer decisao de ranking/producao.

---

## 16. Checkpoint Frente 0 — Liberação controlada da Frente 2 (2026-06-17)

> **Data do checkpoint:** 2026-06-17  
> **Frente:** Frente 0 / Controle  
> **Status:** Frente 1 base consolidada. Frente 2 liberada para implementação controlada.  
> **Nenhum código de produção alterado nesta tarefa.**

### 16.1 Status consolidado das frentes

| Frente | Status | O que está feito | O que falta |
|--------|--------|------------------|-------------|
| **Frente 0 / Controle** | ✅ Ativa | Documentação de escopo criada; regras always on em `.devin/rules/gerais.md`; log_progress.md em uso; contrato de migração estabelecido | Manter documentação atualizada à medida que frentes avançam |
| **Frente 1 / Esquerda** | ✅ Consolidada | P1, P2, P3, P4, P7, P8, P9, P10, P11 resolvidas; helper `resolverOrigemOperacionalV2` implementado e testado (25 testes); coords depósito e casas validadas no Supabase; limites de km validados no Supabase; OSRM `/table` aprovado; fallback Haversine aprovado (Opção A); pontos sem coordenada auditados | Integrar agenda real e geocoding na cadeia de candidatos (etapas futuras) |
| **Frente 2 / Meio** | 🟡 Liberada para implementação controlada | Helpers de classificação, candidatos e ordenação implementados (sintéticos/diagnóstico); 8 divergências críticas mapeadas; plano de 9 etapas documentado; bloco diagnóstico `kmAdicionalRealControlado` implementado | Implementar cálculo real de `kmAdicionalNaRotaM` por slot; corrigir divergências A-I; testes unitários; validação manual contra legado |
| **Frente 3 / Direita** | ✅ Ativa | Rota `/api/procurar-datas/v2/diagnostico` funcional; flags de diagnóstico operacionais; comparação OSRM `/route` vs `/table` integrada; snippets DevTools disponíveis | Expandir diagnósticos conforme Frente 2 avança |

### 16.2 Decisões confirmadas como fechadas

| # | Decisão | Data | Status |
|---|---------|------|--------|
| P1 | Equivalência OSRM `/route` vs `/table` | 2026-06-17 | ✅ Concluída — delta 1m/0.01%, tolerância 10m |
| P2 | v2 usará OSRM `/table` para matriz em lote | 2026-06-17 | ✅ Concluída — melhoria de eficiência, regra preservada |
| P3 | Fallback OSRM: Opção A (replicar legado) | 2026-06-17 | ✅ Concluída — Haversine silencioso, nunca null |
| P4 | Ponto sem coordenada: descartar silenciosamente | 2026-06-17 | ✅ Concluída — replica legado |
| P7 | Coordenadas depósito e casas preenchidas | 2026-06-17 | ✅ Resolvida — validadas no Supabase |
| P8 | Critério hora marcada confirmado | 2026-06-17 | ✅ Confirmada — `bestKm <= limiteKmBase` + tempo |
| P9 | Limite sábado confirmado | 2026-06-17 | ✅ Confirmada — `MAX_SATURDAY_METERS` sem pontos |
| P10 | Quantidade de resultados confirmada | 2026-06-17 | ✅ Confirmada — 5/1/1/1 por dia único |
| P11 | Limites de km validados no Supabase | 2026-06-17 | ✅ Resolvida — 6 chaves validadas |
| P5 | Reabertura da Frente 2 | 2026-06-17 | ✅ Reaberta para auditoria/plano |

### 16.3 Pendências restantes (não bloqueantes para primeira fatia da Frente 2)

| # | Pendência | Por que não bloqueia |
|---|-----------|---------------------|
| P6 | Critérios mínimos de comparação com legado antes de produção | Produção ainda não está no escopo da Frente 2 |
| — | Integrar agenda real (shAg) na cadeia de candidatos | Primeira fatia pode usar dados controlados/diagnóstico |
| — | Geocodificação real dos pontos da agenda | Primeira fatia pode usar coordenadas injetadas |
| — | Integrar `resolverOrigemOperacionalV2` à cadeia de candidatos | Etapa 1 do plano de 9 etapas; pode ser feita incrementalmente |

### 16.4 Riscos aceitos

| Risco | Por que aceito |
|-------|----------------|
| Haversine pode subestimar distância (~19%) como fallback | É o comportamento funcional do legado (P3, Opção A aprovada) |
| Ponto sem coordenada pode deixar rota incompleta | É o comportamento funcional do legado (P4 aprovada) |
| `/table` pode ter diferença pequena vs `/route` | P1 validou equivalência dentro da tolerância de 10m |
| Frente 2 altera candidatos/classificação se conectada ao fluxo final | Primeira implementação será isolada na rota diagnóstica, não em produção |
| Ainda será necessário comparar saída v2 com legado antes de produção | P6 será tratada antes de qualquer decisão de produção |

### 16.5 Critérios para liberar Frente 2 (todos atendidos)

- [x] P1 fechada — equivalência OSRM validada.
- [x] P2 fechada — decisão `/table` aprovada.
- [x] P3 fechada — fallback Haversine aprovado (Opção A).
- [x] P4 fechada — pontos sem coordenada auditados.
- [x] P7 resolvida — coordenadas preenchidas e validadas.
- [x] P11 validada — limites de km confirmados no Supabase.
- [x] Nenhum conflito documental bloqueante — inconsistências corrigidas neste checkpoint.
- [x] Produção/frontend ainda fora do escopo — confirmado nas regras always on.
- [x] Primeira implementação da Frente 2 será diagnóstica/controlada — plano de 9 etapas documentado.

### 16.6 Próximo passo recomendado

1. Implementar **Etapa 1** do plano de 9 etapas (seção 15.6): integrar `resolverOrigemOperacionalV2` ao fluxo de cálculo de delta.
2. Implementar **Etapa 2**: adaptar `calcular-delta-insercao-matriz.ts` para receber função OSRM `/table` real.
3. Manter tudo na rota diagnóstica `/v2/diagnostico` com flag isolada.
4. Não conectar ao fluxo de produção `/pesquisar` até validação manual contra legado (Etapa 9).
5. Atualizar este documento quando cada etapa for concluída.

---

## 17. Validação manual DevTools — bloco `diagnosticoKmAdicionalRealControlado` (2026-06-17)

> **Frente:** Frente 3 / direita  
> **Status:** ✅ Validado manualmente pelo usuário  
> **Produção/frontend/ranking final:** não alterados.

### 17.1 Contexto

Após implementação da primeira fatia real/controlada da Frente 2, o usuário executou 4 snippets DevTools na rota `POST /api/procurar-datas/v2/diagnostico` para validar o bloco `diagnosticoKmAdicionalRealControlado`.

Flag utilizada: `usarKmAdicionalRealControladoDiagnostico: true`

### 17.2 Resultados por snippet

**Snippet 1 — Cenário normal (dia útil, 3 pontos com coordenada)**

| Campo | Resultado |
|-------|-----------|
| STATUS HTTP | 200 |
| ok bloco | true |
| executado | true |
| modo | `km-adicional-real-controlado-diagnostico` |
| kmAdicionalNaRotaM | 0m |
| origemKmAdicionalNaRotaM | `osrm-table-diagnostico` |
| origemOperacional.tipo | `deposito` |
| origemOperacional.ok | true |
| matrizOSRM.ok | true |
| pontosValidos | 3 |
| semCoordenadas | 0 |
| descartados | 0 |
| erros | [] |
| latência | 6572ms |

Aviso relevante: `Melhor insercao encontrada: posicao 1, delta 0m (funcao de distancia injetada).`

Conclusão: bloco executa, origem operacional correta (depósito em dia útil), OSRM `/table` funcionou, sem descartes, sem erros. Valida P2.

---

**Snippet 2 — Ponto sem coordenada (P4)**

| Campo | Resultado |
|-------|-----------|
| STATUS HTTP | 200 |
| ok bloco | true |
| kmAdicionalNaRotaM | 0m |
| origemKmAdicionalNaRotaM | `osrm-table-diagnostico` |
| linhasRecebidas | 3 |
| linhasDaEquipe | 3 |
| pontosValidos | 2 |
| semCoordenadas | 1 |
| descartados | 1 item |
| erros | [] |
| latência | 1546ms |

Aviso relevante: `1 ponto(s) descartado(s) por falta de coordenadas no cache injetado`

Conclusão: ponto sem coordenada descartado, bloco continuou ok:true, candidato/dia não ficou indisponível por isso. **P4 validada na rota diagnóstica.**

---

**Snippet 3 — Isolamento de `kmAdicionalNaRotaDiagnosticoM`**

| Campo | Resultado |
|-------|-----------|
| STATUS HTTP | 200 |
| ok bloco | true |
| kmAdicionalNaRotaM DO BLOCO | 0m |
| km absurdo enviado no body | 999999 |
| bloco usou km absurdo? | ✅ isolado |
| origemKmAdicionalNaRotaM | `osrm-table-diagnostico` |
| candidatos: kmAdicionalNaRotaM | undefined |
| candidatos: origemKm | undefined |
| erros | [] |
| latência | 2207ms |

Conclusão: valor manual `kmAdicionalNaRotaDiagnosticoM: 999999` não contaminou o cálculo real controlado nem os candidatos reais. **Isolamento validado.**

---

**Snippet 4 — Fallback Haversine / OSRM inválido (P3)**

| Campo | Resultado |
|-------|-----------|
| STATUS HTTP | 200 |
| ok bloco | true |
| kmAdicionalNaRotaM | 0m |
| origemKmAdicionalNaRotaM | `haversine-fallback-legado-diagnostico` |
| matrizOSRM.ok | false |
| avisos mencionam fallback | true |
| erros | [] |
| latência | 902ms |

Avisos relevantes:
- `Matriz OSRM falhou. Usando fallback Haversine para o calculo completo conforme legado.`
- `Melhor insercao encontrada: posicao 1, delta 0m (aproximacao Haversine).`

Conclusão: falha de OSRM aplicou Haversine silenciosamente, ok:true, sem descarte de candidato. **P3 validada na rota diagnóstica.**

### 17.3 Conclusão geral

- ✅ Bloco diagnóstico executa corretamente.
- ✅ OSRM `/table` funciona (P2 validada em ambiente real).
- ✅ Origem operacional correta: depósito em dia útil.
- ✅ Ponto sem coordenada descartado silenciosamente (P4 validada).
- ✅ Fallback Haversine ativo quando OSRM falha (P3 validada).
- ✅ Isolamento do valor manual confirmado.
- ✅ Produção/frontend/ranking final não afetados.

### 17.4 Observação obrigatória — delta 0m

**Todos os cenários retornaram `kmAdicionalNaRotaM = 0m`.** Isso valida o fluxo e o plumbing, mas **não é suficiente para confirmar o cálculo em produção.** Antes de avançar para produção ou para conexão com a cadeia de candidatos real, será necessário:

1. Validar pelo menos um cenário com **delta positivo/não-zero** (destino realmente fora da rota existente).
2. Comparar esse delta com o resultado equivalente do legado Apps Script para confirmar equivalência numérica.

Essa pendência **não bloqueia** a próxima etapa diagnóstica/controlada (mapa por slot `(dataISO, equipe)`), mas deve ser coberta antes de qualquer decisão de produção.

---

## 18. Frente 2 / meio — mapa de kmAdicionalNaRotaM por slot (2026-06-17)

> **Status:** Implementado em modo diagnostico/controlado. Producao e frontend nao alterados.

### 18.1 O que foi implementado

- Helper `calcularMapaKmAdicionalPorSlotControladoV2` em `calcular-mapa-km-adicional-por-slot.ts`.
- Recebe lista de slots `{dataISO, equipe, linhasAgenda?, cacheCoordenadasPorEndereco?}`, destino e configOrigem.
- Para cada slot chama `calcularKmAdicionalRealControladoV2` (origem operacional + agenda + OSRM /table + fallback Haversine conforme P3 + descarte silencioso P4).
- Retorna `mapa: Record<string, number | null>` com chave `${dataISO}::${equipeNormalizada}`.
- Slots com dataISO vazia ou equipe inválida são descartados e registrados em `erros`.
- Output auditável: `mapa`, `detalhesPorSlot`, `contadores`, `avisos`, `erros`.
- Valor manual `kmAdicionalNaRotaDiagnosticoM` do body não é parâmetro nem exposto — isolamento garantido por interface.
- Bloco `diagnosticoMapaKmAdicionalPorSlot` integrado na rota `POST /v2/diagnostico`, ativado por `usarMapaKmAdicionalPorSlotDiagnostico: true`.

### 18.2 Decisões aplicadas

| Decisão | Como aplicada |
|---------|--------------|
| P3 — Haversine silencioso | `calcularKmAdicionalRealControladoV2` já implementa; o mapa herda o comportamento |
| P4 — Descartar pontos sem coordenada | Idem — descarte ocorre no helper filho |
| P2 — OSRM /table | Idem — `prepararMatrizOSRMDiagnosticoV2` usa /table |
| Isolamento manual | Interface do helper não recebe `kmAdicionalNaRotaDiagnosticoM`; flag do body não é passada para o helper |

### 18.3 O que NÃO foi alterado

- `/api/procurar-datas/pesquisar` (produção).
- Frontend.
- Ranking final de produção.
- Banco/Supabase.
- Motor legado Apps Script.
- `calcularKmAdicionalRealControladoV2`.
- Cadeia de candidatos/classificação.

### 18.4 Riscos/pendências

- Delta positivo validado em teste unitário (teste 4: `kmAdicionalNaRotaM = 7842m`). Validação manual com cenário real (destino fora da rota existente) ainda pendente antes de produção.
- Agenda real e geocoding real ainda não integrados; linhas da agenda continuam controladas pelo body diagnóstico.
- Próximo passo sugerido: validar mapa com fixture real via DevTools antes de conectar à cadeia de candidatos.

### 18.5 Testes

- 16 testes unitários em `calcular-mapa-km-adicional-por-slot.test.ts` — todos passando.
- 9 testes de rota (testes 39–47) em `route.test.ts` — todos passando (total: 47 testes na rota).

---

## 19. Frente 2 / meio — aplicação do mapa por slot em candidatos/classificação diagnóstica (2026-06-18)

> **Status:** Implementado em modo diagnostico/controlado. Producao e frontend nao alterados.

### 19.1 O que foi implementado

- Helper `aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2` em `aplicar-mapa-km-adicional-por-slot-em-candidatos.ts`.
- Recebe lista de candidatos diagnósticos e `mapaKmAdicionalPorSlot: Record<string, number | null>`.
- Para cada candidato, resolve `dataISO` e `equipe`, normaliza equipe (via `normalizarEquipe`), monta `slotKey = ${dataISO}::${equipeNormalizada}`.
- Equipes com sufixo `(sintético)` são normalizadas antes da busca para garantir chave idêntica à do mapa.
- Se `mapa[slotKey]` for número finito: aplica `kmAdicionalNaRotaM` e marca `kmAdicionalAplicadoPorMapaSlot: true`, `origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico'`.
- Se não houver chave no mapa ou valor for null: mantém `kmAdicionalNaRotaM` original, `origemKmAdicionalNaRotaM: 'sem-chave-no-mapa'`.
- Se candidato não tiver `dataISO` ou equipe válida: mantém original, `origemKmAdicionalNaRotaM: 'sem-data-equipe'`.
- Preserva todos os demais campos do candidato.
- `kmAdicionalNaRotaDiagnosticoM` nunca é parâmetro — isolamento garantido por interface.
- Bloco `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` integrado na rota `POST /v2/diagnostico`, ativado por `usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true`.
- Se o mapa não estiver disponível (flag do mapa desligada), retorna `executado: false` com motivo claro.

### 19.2 Decisões aplicadas

| Decisão | Como aplicada |
|---------|--------------|
| Isolamento manual | Interface não recebe `kmAdicionalNaRotaDiagnosticoM`; mapa vem apenas do bloco `diagnosticoMapaKmAdicionalPorSlot` |
| Normalização de equipe | Mesma `normalizarEquipe()` usada no helper de cálculo — chave idêntica garantida |
| Sufixo sintético | Strip de `(sintético)` antes de normalizar para compatibilidade com candidatos do loop sintético |
| Chave null no mapa | Não aplica, registra aviso — não usa valor global |
| Sem chave | Mantém valor original do candidato — não usa valor global |
| Blocos anteriores | Não são alterados nem dependem desta flag |

### 19.3 O que NÃO foi alterado

- `/api/procurar-datas/pesquisar` (produção).
- Frontend.
- Ranking final de produção.
- Banco/Supabase.
- Motor legado Apps Script.
- `calcularKmAdicionalRealControladoV2`.
- `calcularMapaKmAdicionalPorSlotControladoV2`.
- Loop de classificação sintética (seção 9.4 da rota) — permanece com valor padrão `Math.floor(base * 0.5)`.
- Cadeia de candidatos/classificação de produção.

### 19.4 Riscos/pendências

- O bloco aplica o mapa nos candidatos da `amostra` do bloco `diagnosticoCandidatos` (máx. 10). Candidatos além da amostra não são incluídos nesta fatia diagnóstica.
- Classificação diagnóstica existente (seção 9.4) continua usando `Math.floor(base * 0.5)` — o bloco de aplicação não reclassifica, apenas injeta o valor no campo `kmAdicionalNaRotaM`.
- Próximo passo sugerido: evoluir para reclassificar candidatos com o `kmAdicionalNaRotaM` do mapa e comparar tipos/elegibilidade resultantes com o legado.

### 19.5 Testes

- 18 testes unitários em `aplicar-mapa-km-adicional-por-slot-em-candidatos.test.ts` — todos passando.
- 10 testes de rota (testes 48–57) em `route.test.ts` — todos passando (total: 57 testes na rota).
- Typecheck: 1 erro preexistente em `osrm-route-client-diagnostico.test.ts:95` (TS2352, fora do escopo). Nenhum erro novo introduzido.

### 19.6 Snippets DevTools para validação manual (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

Detalhes completos dos resultados em `docs/procurar-datas-motor-v2-progresso.md` — seção 23.

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| A | Ambas flags ativas, slots batem com candidatos | HTTP 200, 3/8 candidatos com km aplicado (4481m), 5/8 sem chave, `amostraCandidatosDepois` confirmado | Aplicação ok ✅ |
| B | Aplicação ligada sem mapa | HTTP 200, `executado: false`, motivo claro de mapa ausente | Motivo claro ✅ |
| C | `kmAdicionalNaRotaDiagnosticoM: 999999` | HTTP 200, contaminado: false, nenhum candidato com 999999 | Isolamento ✅ |
| D | Flag de aplicação off | HTTP 200, bloco aplicação `null`, candidatos originais preservados | Comportamento anterior ✅ |
| E | Slots sem correspondência | HTTP 200, 10/10 sem chave, `origem: sem-chave-no-mapa`, nenhum valor global aplicado | Sem valor global ✅ |

Payload: campos no root do body (não dentro de `diagnostico`).

**Conclusão geral:** `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` validado manualmente. Mapa aplicado aos candidatos somente quando há `slotKey` correspondente. Candidatos sem chave não recebem valor global. `kmAdicionalNaRotaDiagnosticoM` global não contamina. Produção/frontend/ranking não afetados. Próxima etapa: reclassificar candidatos com km do mapa e comparar com legado.

---

### 18.6 Snippets DevTools para validação manual de diagnosticoMapaKmAdicionalPorSlot (2026-06-17 → 2026-06-18)

> **Status:** ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

#### Falha da primeira rodada

Os snippets S1–S5 preparados inicialmente enviaram os campos dentro de um objeto `diagnostico` aninhado no body. A rota, porém, lê `bodyDiagnostico` como um cast de tipo do próprio body (`body as PesquisarDatasRequest & {...}`) — portanto os campos devem estar no **root do body**, não aninhados em `diagnostico`.

Resultado da primeira rodada: HTTP 200, ok:true, mas `diagnosticoMapaKmAdicionalPorSlot: null` em todos os cenários.

#### Probe corrigido — validado com sucesso

Usuário executou probe com campos no root do body. Resultado:

- `STATUS`: 200 | `OK GERAL`: true
- `BLOCO PRESENTE`: true | `executado`: true | `ok`: true
- `modo`: `mapa-km-adicional-por-slot-diagnostico`
- `mapa`: `{ "2026-06-29::EQUIPE 1": 4481 }`
- `contadores`: `{ slotsRecebidos: 1, slotsProcessados: 1, slotsComKm: 1, slotsComFallbackHaversine: 0, slotsComErro: 0 }`
- `erros`: `[]`
- **Delta positivo/não-zero validado: 4481m**

#### Campos que devem estar no root do body (payload correto)

```js
const body = {
  dataInicial: '2026-06-29',
  destLat: -25.4747897,
  destLng: -49.2367902,
  destDisplay: '...',
  // CAMpos diagnosticos NO ROOT, NAO dentro de um objeto "diagnostico"
  usarMapaKmAdicionalPorSlotDiagnostico: true,
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 8000,
  slotsAgendaDiagnostica: [
    {
      dataISO: '2026-06-29',
      equipe: 'EQUIPE 1',
      linhasAgenda: [/* 7 colunas */],
      cacheCoordenadasPorEndereco: { /* ... */ },
    },
  ],
  // kmAdicionalNaRotaDiagnosticoM tambem no root (quando usado)
  kmAdicionalNaRotaDiagnosticoM: 999999,
}
```

#### Snippets corrigidos (S1–S5)

**S1 — Principal (múltiplos slots):** 3 slots (2 datas × 2 equipes), OSRM real. Valida bloco presente, chaves distintas, contadores.

**S2 — Delta positivo:** Ponto de agenda fora do corredor depósito→destino. Valida `kmAdicionalNaRotaM > 0`.

**S3 — P4 por slot:** Slot com ponto sem coordenada. Valida descarte silencioso por slot, independência dos outros.

**S4 — P3 por slot:** OSRM URL inválida. Valida `haversine-fallback-legado-diagnostico` por slot, `ok:true`.

**S5 — Isolamento:** `kmAdicionalNaRotaDiagnosticoM: 999999`. Valida que nenhum slot do mapa recebe 999999.

**Typecheck preexistente não relacionado:** `npx tsc --noEmit` falha em `osrm-route-client-diagnostico.test.ts:95` (erro `TS2352` — cast de mock para `Response`). Erro preexistente, não relacionado ao mapa por slot.

Produção, frontend, banco e ranking final não alterados. Sem commit.

### 18.7 Validação manual final S1–S5 — resultados (2026-06-18)

> ✅ Todos os 5 snippets corrigidos executados e aprovados pelo usuário via DevTools.

#### S1 — Múltiplos slots

- HTTP 200, bloco presente, `executado: true`, `ok: true`
- `modo`: `mapa-km-adicional-por-slot-diagnostico`
- Chaves: `2026-06-29::EQUIPE 1`, `2026-06-29::EQUIPE 2`, `2026-06-30::EQUIPE 1`
- Valores: 4481m, 4481m, 4481m
- Contadores: `slotsRecebidos: 3, slotsProcessados: 3, slotsComKm: 3, slotsComFallbackHaversine: 0, slotsComErro: 0, slotsDescartados: 0`
- Origem por slot: `osrm-table-diagnostico`
- Erros: `[]`

#### S2 — Delta positivo/não-zero

- HTTP 200, `ok: true`
- Mapa: `2026-07-01::EQUIPE 1: 5997m`, `2026-07-02::EQUIPE 1: 5997m`
- `slotsPositivos.length > 0` ✅
- Contadores: `slotsRecebidos: 2, slotsProcessados: 2, slotsComKm: 2, slotsComFallbackHaversine: 0, slotsComErro: 0`
- Origem: `osrm-table-diagnostico`

#### S3 — P4 por slot (ponto sem coordenada)

- HTTP 200, `ok: true`
- Mapa: `2026-07-07::EQUIPE 1: 4481m`, `2026-07-08::EQUIPE 1: 4481m`
- Cada slot registrou `descartados=1` com motivo `sem_coordenadas_cache`
- Contadores: `slotsRecebidos: 2, slotsProcessados: 2, slotsComKm: 2, slotsComErro: 0`
- Erros globais: `[]`
- **Observação:** O primeiro slot também apresentou `descartados=1`, embora o snippet pretendesse ter cache para ele. Isso é observação de fixture/cache do snippet, não falha da regra P4 — o comportamento de descarte sem erro foi confirmado.

#### S4 — P3 fallback Haversine por slot

- HTTP 200, latência 860ms, `ok: true`
- `slotsComFallbackHaversine: 2`
- `2026-07-14::EQUIPE 1: 3557m`, origem `haversine-fallback-legado-diagnostico`, ok true
- `2026-07-14::EQUIPE 2: 3557m`, origem `haversine-fallback-legado-diagnostico`, ok true
- Aviso por slot: `Matriz OSRM falhou. Usando fallback Haversine para o calculo completo conforme legado.`
- Erros: `[]`

#### S5 — Isolamento do km manual

- HTTP 200, `ok: true`
- `kmAdicionalNaRotaDiagnosticoM` enviado: 999999
- Mapa: `2026-07-21::EQUIPE 1: 4481m`
- Contaminado por 999999: **false** ✅

#### Conclusão geral

- `diagnosticoMapaKmAdicionalPorSlot` validado manualmente.
- `usarMapaKmAdicionalPorSlotDiagnostico` executa corretamente com campos no root do body.
- Múltiplos slots com chaves distintas: ✅
- Delta positivo/não-zero: ✅ (4481m, 5997m)
- P4 descarte silencioso por slot: ✅
- P3 fallback Haversine por slot: ✅
- Isolamento de `kmAdicionalNaRotaDiagnosticoM`: ✅
- Produção, frontend, ranking final e `/api/procurar-datas/pesquisar` não afetados.
- Próxima etapa permanece diagnóstica/controlada.

---

## 20. Frente 2 / meio — reclassificacao de candidatos com kmAdicionalNaRotaM do mapa por slot (2026-06-18)

> **Status:** Implementado em modo diagnostico/controlado. Producao e frontend nao alterados.

### 20.1 O que foi implementado

- Helper `reclassificarCandidatosComKmMapaSlotDiagnosticoV2` em `reclassificar-candidatos-com-km-mapa-slot.ts`.
- Recebe candidatos ja com kmAdicionalNaRotaM aplicado pelo mapa (bloco anterior) e config de classificacao.
- Reclassifica somente candidatos com `kmAdicionalAplicadoPorMapaSlot: true`, chamando `classificarCandidatoOperacionalV2`.
- Candidatos sem km aplicado sao preservados sem reclassificacao.
- Compara tipo/elegivel antes x depois e registra `mudouTipo`, `mudouElegibilidade`, `motivosAntes`, `motivosDepois`.
- Bloco `diagnosticoReclassificacaoComKmMapaSlot` integrado na rota `POST /v2/diagnostico`.
- Ativado por `usarReclassificacaoComKmMapaSlotDiagnostico: true`.
- Requer `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` executado e ok.
- `kmAdicionalNaRotaDiagnosticoM` nunca e parametro — isolamento garantido por interface.

### 20.2 Decisoes aplicadas

| Decisao | Como aplicada |
|---------|--------------|
| Isolamento manual | Interface nao recebe `kmAdicionalNaRotaDiagnosticoM` |
| Apenas candidatos com km do mapa | `kmAdicionalAplicadoPorMapaSlot === true` |
| Dados operacionais | Enriquecidos a partir de `diagnosticoClassificacao.amostra` para dados como diaSemana, ehSabado, ativa, disponivelMin |
| Classificacao real | Usa `classificarCandidatoOperacionalV2` — mesma funcao da classificacao sintetica |
| Flag off | Bloco `null` |
| Sem aplicacao | `executado: false` com motivo claro |

### 20.3 O que NAO foi alterado

- `/api/procurar-datas/pesquisar` (producao).
- Frontend.
- Ranking final de producao.
- Banco/Supabase.
- Motor legado Apps Script.
- Loop de classificacao sintetica (secao 9.4 da rota).
- Blocos anteriores (mapa por slot, aplicacao em candidatos).
- `classificarCandidatoOperacionalV2` — apenas chamada, nao modificada.

### 20.4 Riscos/pendencias

- Bloco trabalha sobre `amostraCandidatosDepois` (max 10 candidatos). Candidatos alem da amostra nao sao reclassificados.
- Dados operacionais (diaSemana, ehSabado, ativa, disponivelMin, suficienteParaServico, distanciaKm) vem da classificacao original — se candidato nao for encontrado na amostra original, usa defaults seguros.
- Proxima etapa: validar manualmente via DevTools e comparar com legado Apps Script.

### 20.5 Testes

- 16 testes unitarios em `reclassificar-candidatos-com-km-mapa-slot.test.ts` — todos passando.
- 10 testes de rota (testes 58-67) em `route.test.ts` — todos passando (total: 67 testes na rota).
- Typecheck: 1 erro preexistente em `osrm-route-client-diagnostico.test.ts:95` (TS2352, fora do escopo). Nenhum erro novo introduzido.

### 20.6 Validação manual DevTools (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

Detalhes completos dos resultados em `docs/procurar-datas-motor-v2-progresso.md` — seção 25.

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| R1 — Caminho feliz | Ambas flags ativas, slots batem com candidatos | HTTP 200, mapa ok, aplicação ok, reclassificação ok, 5/10 candidatos reclassificados, 1 alteração de tipo, `amostraComparativa` com 10 itens | Reclassificação ok ✅ |
| R2 — Flag off | Reclassificação desligada | HTTP 200, bloco reclassificação `null` | Isolamento por flag ✅ |
| R3 — Sem aplicação | Reclassificação ligada sem aplicação do mapa | HTTP 200, `executado: false`, motivo claro de aplicação ausente | Motivo claro ✅ |
| R4 — Isolamento km manual | `kmAdicionalNaRotaDiagnosticoM: 999999` | HTTP 200, contaminado na aplicação: false, contaminado na reclassificação: false | Isolamento ✅ |
| R5 — Sem correspondência | Slots sem correspondência no mapa | HTTP 200, 10/10 sem chave, 0 reclassificados, 0 alterações de tipo/elegibilidade, tipoAntes=tipoDepois | Sem valor global ✅ |

**Conclusão geral:** `diagnosticoReclassificacaoComKmMapaSlot` validado manualmente. A reclassificação usa o `kmAdicionalNaRotaM` aplicado pelo mapa por slot somente em diagnóstico. O bloco compara antes/depois por candidato e registra alterações de tipo/elegibilidade. `kmAdicionalNaRotaDiagnosticoM` global não contamina. Candidatos sem chave no mapa não recebem km inventado. Candidatos sem km aplicado não são reclassificados. Produção/frontend/ranking/pesquisar não afetados. Etapa ainda diagnóstica/controlada.

---

## 21. Frente 0 / Controle — mapeamento da regra de classificação legado e critério de aceite da próxima etapa (2026-06-18)

> **Status:** Análise concluída. Regras do legado mapeadas. Divergências documentadas. Critério de aceite proposto.

### 21.1 Regra de classificação do legado Apps Script (confirmada no código)

**Arquivo:** `appscript/CEP-APIBACK.gs`  
**Função principal:** `pesquisarRotaToTargetWithParams` (linha ~882–1228)

#### 21.1.1 Grandeza usada para classificar: `delta` (= `bestKm`)

O legado classifica candidatos pelo `bestKm`, que é o **km adicional inserido na rota** (inserção ótima entre pontos existentes do slot). Em slots vazios, é a distância direta depósito→destino. A unidade é **km** internamente no legado.

#### 21.1.2 Como `limiteKmBase` é calculado

```js
var limiteKmBase = slot.pontos.length
  ? (MAX_EXTRA_METERS / 1000)          // slot com pontos: usa KM ADICIONAL MAX NA ROTA
  : (slot.date.getDay() === 6
      ? (MAX_SATURDAY_METERS / 1000)   // slot vazio + sábado: usa KM MAXIMO NO SÁBADO
      : (MAX_WEEKDAY_METERS / 1000));  // slot vazio + semana: usa KM MAXIMO NA SEMANA
```

Ou seja: quando o slot tem pontos, usa `KM ADICIONAL MAX NA ROTA` como base. Quando o slot está vazio, usa `KM MAXIMO NA SEMANA` ou `KM MAXIMO NO SÁBADO`.

#### 21.1.3 Limites de especial e premium

```js
var limiteKmEspecial = limiteKmBase + 5;  // +5 km fixo
var limiteKmPremium  = limiteKmBase + 10; // +10 km fixo
```

Os valores `KM ADICIONAL MAX NA ROTA ESPECIAL` e `KM ADICIONAL MAX NA ROTA PREMIUM` da config são carregados mas **não são usados no cálculo do limite**. O legado soma diretamente +5 e +10 km fixos sobre o `limiteKmBase`. Os params de config controlam apenas a ativação (especial só ocorre se `MAX_EXTRA_DYNAMIC > 0`, premium só ocorre se `MAX_EXTRA_PREMIUM > 0`).

#### 21.1.4 Regra de classificação por tipo

```
NORMAL:     bestKm <= limiteKmBase
ESPECIAL:   bestKm <= limiteKmBase + 5   AND MAX_EXTRA_DYNAMIC > 0
PREMIUM:    bestKm <= limiteKmBase + 10  AND MAX_EXTRA_PREMIUM > 0
HORA MARCADA: bestKm <= limiteKmBase AND slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)
DESCARTADO: bestKm > limiteKmBase + 10
```

Hora marcada **não é exclusiva**: um candidato pode ser normal E hora marcada simultaneamente (vai para porDiaBestNormal e porDiaHoraMarcada).

#### 21.1.5 Origem no sábado

```js
var originLoc = (slot.date.getDay() === 6)
  ? (slot.team === 'EQUIPE 1'
      ? FIXED_LOCS.homeE1   // casa da Equipe 1
      : FIXED_LOCS.homeE2)  // casa da Equipe 2
  : FIXED_LOCS.deposit;     // depósito (dias úteis)
```

#### 21.1.6 Distância calculada via OSRM (com fallback Haversine)

```js
function getDrivingKm(a, b) {
  // 1. cache
  // 2. OSRM próprio (osrm.lebebe.cloud)
  // 3. OSRM público (router.project-osrm.org) — somente se base própria falhar
  // 4. Haversine — fallback se ambos OSRM falharem
}
```

#### 21.1.7 Filtro anterior à classificação

Antes de classificar, o legado descarta slots por:
- Slot sem pontos com distância reta (Haversine) > `MAX_POINT_KM * 1.5` (fast filter).
- Âncora mais próxima com distância OSRM > `MAX_POINT_KM + (MAX_EXTRA_PREMIUM / 1000)` (limite máximo possível).

#### 21.1.8 Motivos de indisponibilidade no legado

O legado não produz string de motivo; candidatos que excedem todos os limites são simplesmente descartados (não aparecem no resultado). Equipes inativas são filtradas por `carregarEquipesAtivas_`.

### 21.2 Comparação legado × v2 (classificarCandidatoOperacionalV2)

**Arquivo v2:** `src/lib/procurar-datas/motor/classificacao-candidato.ts`

| Aspecto | Legado Apps Script | v2 classificarCandidatoOperacionalV2 | Status |
|---|---|---|---|
| Grandeza de classificação | `bestKm` (km adicional inserção ótima) | `kmAdicionalNaRotaM` (metros) | Unidade diferente, valor equivalente — confirmado |
| Limite base (slot com pontos) | `MAX_EXTRA_METERS / 1000` (km) | `kmAdicionalMaxNaRotaM` (metros) | Equivalente se mesmo valor na config |
| Limite base (slot vazio, semana) | `MAX_WEEKDAY_METERS / 1000` | Não implementado — v2 não distingue slot vazio | **Divergência confirmada** |
| Limite base (slot vazio, sábado) | `MAX_SATURDAY_METERS / 1000` | Não implementado — v2 não distingue slot vazio | **Divergência confirmada** |
| Limite especial | `limiteKmBase + 5` (fixo) | `kmAdicionalMaxNaRotaEspecialM` (da config) | **Divergência confirmada** — v2 usa valor absoluto da config; legado soma +5 fixo |
| Limite premium | `limiteKmBase + 10` (fixo) | `kmAdicionalMaxNaRotaPremiumM` (da config) | **Divergência confirmada** — v2 usa valor absoluto da config; legado soma +10 fixo |
| Guarda especial (`> 0`) | Só classifica especial se `MAX_EXTRA_DYNAMIC > 0` | Não implementado — v2 classifica especial se kmAdicional <= limiteEspecialM | **Divergência confirmada** |
| Guarda premium (`> 0`) | Só classifica premium se `MAX_EXTRA_PREMIUM > 0` | Não implementado | **Divergência confirmada** |
| Hora marcada | `bestKm <= limiteKmBase AND slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)` | Recebe `horaMarcada: boolean` externamente | Não confirmado como equivalente — v2 recebe flag, legado calcula internamente |
| Origem no sábado | Casa da equipe | Não é responsabilidade da classificação (ok) | Fora do escopo da função de classificação |
| Distância máxima semana/sábado | Não há verificação na classificação — filtro é feito antes | v2 verifica `distanciaKm vs maxSemanaM/maxSabadoM` | **Divergência de responsabilidade** — v2 verifica dentro da classificação, legado filtra antes |
| Motivo de indisponibilidade | Não produz string de motivo — descarta silenciosamente | Produz `motivos: string[]` | Melhoria aceitável (não altera regra) |
| Domingo bloqueado | Não implementado explicitamente no legado (não há domingo nos slots de agenda) | v2 bloqueia domingo explicitamente | Melhoria defensiva aceitável |

### 21.3 Divergências confirmadas

1. **Limites de especial/premium:** Legado usa `limiteKmBase + 5` e `limiteKmBase + 10` (km fixo). V2 usa valores absolutos da config (`kmAdicionalMaxNaRotaEspecialM`, `kmAdicionalMaxNaRotaPremiumM`). Se os valores na config já forem `limiteBase + 5000` e `limiteBase + 10000`, o resultado seria equivalente — mas isso depende de como a config foi populada. **Não confirmado como equivalente numericamente.**

2. **Guarda de ativação (especial/premium):** Legado só classifica especial se `MAX_EXTRA_DYNAMIC > 0` e premium se `MAX_EXTRA_PREMIUM > 0`. V2 não tem essa guarda.

3. **Slot vazio:** Legado muda o `limiteKmBase` quando o slot está vazio (usa KM MAXIMO DA SEMANA/SÁBADO). V2 sempre usa `kmAdicionalMaxNaRotaM`. Impacto: candidatos de slots vazios podem ter classificação diferente.

### 21.4 Pontos não confirmados

- Como a config foi populada no Supabase: se `kmAdicionalMaxNaRotaEspecialM` = `kmAdicionalMaxNaRotaM + 5000` e `kmAdicionalMaxNaRotaPremiumM` = `kmAdicionalMaxNaRotaM + 10000`, os limites seriam numericamente equivalentes ao legado para slots com pontos.
- O cálculo de `horaMarcada` na v2: quem passa `horaMarcada: true` ao chamar `classificarCandidatoOperacionalV2`? Não confirmado no código da rota diagnóstica.
- Qual é o comportamento real quando `HORA_MARCADA_HORAS_A_MAIS = 0` no legado (guarda ausente ou verificação implícita).

### 21.5 Critério de aceite proposto para a próxima etapa

**Campos mínimos a comparar por candidato:**

| Campo | Origem legado | Origem v2 |
|---|---|---|
| `dataISO` | `cand.date.toISOString()` | `dataISO` |
| `diaSemana` | `slot.date.getDay()` | `diaSemana` |
| `ehSabado` | `slot.date.getDay() === 6` | `ehSabado` |
| `equipe` | `slot.team` | `equipe` |
| `slotKeyKmAdicional` | `slot.date.toDateString() + '::' + slot.team` | `slotKeyKmAdicional` |
| `kmAdicionalNaRotaM` | `bestKm * 1000` (converter km→m) | `kmAdicionalNaRotaM` |
| `tipoLegado` | `'NORMAL'/'ESPECIAL'/'PREMIUM'/'HORA-MARCADA'` | — |
| `tipoV2` | — | `tipo` |
| `elegivelLegado` | `true` (candidato no mapa) / `false` (descartado) | — |
| `elegivelV2` | — | `elegivel` |
| `divergiuTipo` | — | comparação `tipoLegado !== tipoV2` |
| `divergiuElegibilidade` | — | comparação `elegivelLegado !== elegivelV2` |

**Cenários mínimos a cobrir:**

1. Dia útil, slot com pontos, `bestKm <= limiteKmBase` → deve ser NORMAL em ambos.
2. Dia útil, slot com pontos, `limiteKmBase < bestKm <= limiteKmBase + 5` com `MAX_EXTRA_DYNAMIC > 0` → deve ser ESPECIAL em ambos.
3. Dia útil, slot com pontos, `limiteKmBase + 5 < bestKm <= limiteKmBase + 10` com `MAX_EXTRA_PREMIUM > 0` → deve ser PREMIUM em ambos.
4. Sábado, slot com pontos, `bestKm <= limiteKmBase` → deve ser NORMAL em ambos.
5. Sábado, slot vazio, `bestKm <= MAX_SATURDAY_METERS/1000` → verificar se v2 classifica igual.
6. Candidato sem km adicional → deve ser indisponível em ambos.
7. `bestKm > limiteKmBase + 10` → deve ser descartado/indisponível em ambos.
8. Slot com hora marcada (`slotAvailMin >= serviceMin + HORA_MARCADA_HORAS_A_MAIS * 60`) → deve aparecer em hora marcada no legado.

**O que deve bloquear avanço para produção:**

- **Qualquer divergência de regra de negócio** bloqueia avanço para produção, salvo decisão explícita registrada.
- Divergência em candidato NORMAL vs INDISPONIVEL é bloqueante imediato (impacto direto ao cliente).
- Divergência de elegibilidade em qualquer candidato NORMAL é bloqueante imediato.
- Divergência em ESPECIAL/PREMIUM deve ser registrada como pendência conhecida — não como equivalência validada. Pode continuar em modo diagnóstico, mas **não** pode ser marcada como resolvida sem decisão explícita sobre se a diferença é intencional.

**O que NÃO é tolerância aceitável:**

- Percentual de candidatos divergentes não é critério de aceite. Qualquer divergência de regra é divergência.
- Motivos de indisponibilidade com string diferente são aceitáveis (v2 produz texto; legado descarta silenciosamente). Isso **não** é divergência de regra.

### 21.6 O que NÃO foi alterado

- Nenhum código alterado.
- Motor legado Apps Script não alterado.
- Rota diagnóstica não alterada.
- Frontend não alterado.
- Banco/Supabase não alterado.
- Nenhum commit.

---

## 22. Frente 0 / Controle — fechamento de pendências legado × v2: configs Supabase, guarda especial/premium, slot vazio, hora marcada (2026-06-18)

> **Status:** Investigação concluída. Divergências confirmadas e detalhadas com valores reais. Nenhum código alterado.

### 22.1 Valores reais das configs no Supabase (consultados via MCP)

| Chave | Valor no Supabase | Tipo | Unidade |
|---|---|---|---|
| `KM ADICIONAL MAX NA ROTA` | 5000 | distance_m | m |
| `KM MAXIMO NA SEMANA` | 150000 | distance_m | m |
| `KM MAXIMO NO SÁBADO` | 45000 | distance_m | m |
| `KM ADICIONAL MAX NA ROTA ESPECIAL` | 5000 | distance_m | m |
| `KM ADICIONAL MAX NA ROTA PREMIUM` | 10000 | distance_m | m |
| `VALOR ADICIONAL NA ROTA ESPECIAL` | 100 | currency | BRL |
| `VALOR ADICIONAL NA ROTA PREMIUM` | 200 | currency | BRL |
| `HORA MARCADA HORAS A MAIS` | 2 | number | — |
| `HORA MARCADA VALOR ADICIONAL` | 400 | currency | BRL |

### 22.2 Divergência especial/premium: confirmada como real

**Cálculo dos limites esperados pelo legado (com base nos valores reais):**

- `limiteKmBase` (slot com pontos) = `KM ADICIONAL MAX NA ROTA` = 5000 m = 5 km
- `limiteKmEspecial` (legado) = `limiteKmBase + 5 km` = **10000 m = 10 km**
- `limiteKmPremium` (legado) = `limiteKmBase + 10 km` = **15000 m = 15 km**

**Valores absolutos que a v2 usa (da config no Supabase):**

- `kmAdicionalMaxNaRotaEspecialM` = **5000 m = 5 km**
- `kmAdicionalMaxNaRotaPremiumM` = **10000 m = 10 km**

**Conclusão:**

| Limite | Legado (correto) | V2 (atual) | Divergência |
|---|---|---|---|
| Normal | 5000 m (5 km) | 5000 m (5 km) | ❌ Sem divergência |
| Especial | 10000 m (10 km) | 5000 m (5 km) | ✅ **DIVERGÊNCIA REAL** |
| Premium | 15000 m (15 km) | 10000 m (10 km) | ✅ **DIVERGÊNCIA REAL** |

Na prática: a v2 classifica como ESPECIAL candidatos que o legado ainda classifica como NORMAL (de 5001 m a 5000 m pela v2 = o mesmo limite, portanto o especial v2 nunca é atingível). E candidatos que o legado classificaria como ESPECIAL (5001–10000 m) a v2 pode classificar como NORMAL ou INDISPONÍVEL dependendo da comparação com `kmAdicionalMaxNaRotaEspecialM`.

Mais precisamente: como `kmAdicionalMaxNaRotaEspecialM = 5000 m = kmAdicionalMaxNaRotaM`, a v2 **nunca classifica ninguém como ESPECIAL** com os valores atuais. Qualquer candidato que exceda 5000 m vai direto para PREMIUM ou INDISPONÍVEL na v2.

Esta é uma **divergência real e bloqueante para produção**.

### 22.3 Guarda de ativação especial/premium: divergência confirmada

**No legado** (confirmado em `CEP-APIBACK.gs` linha 1125 e 1132):

```js
// Especial só ocorre se MAX_EXTRA_DYNAMIC > 0
else if (bestKm <= limiteKmEspecial && MAX_EXTRA_DYNAMIC > 0) { ... }

// Premium só ocorre se MAX_EXTRA_PREMIUM > 0
else if (bestKm <= limiteKmPremium && MAX_EXTRA_PREMIUM > 0) { ... }
```

`MAX_EXTRA_DYNAMIC` = valor carregado de `KM ADICIONAL MAX NA ROTA ESPECIAL` = 5000. Como 5000 > 0, a guarda especial está **habilitada** com os dados atuais do Supabase.  
`MAX_EXTRA_PREMIUM` = valor carregado de `KM ADICIONAL MAX NA ROTA PREMIUM` = 10000. Como 10000 > 0, a guarda premium está **habilitada** com os dados atuais.

**Na v2** (`classificarCandidatoOperacionalV2`): **não existe guarda equivalente**. A função classifica como especial se `kmAdicionalM <= limiteEspecialM`, sem verificar se o parâmetro de limite especial tem valor "ativo". Como `limiteEspecialM = 5000 = limiteBaseM`, na prática a v2 nunca chega à branch especial (o candidato já teria sido classificado como normal ou indisponível antes).

**Conclusão:** Guarda de ativação não tem impacto prático com os valores atuais, porque a divergência nos limites (22.2) já impede que qualquer candidato seja classificado como especial na v2. Mas como regra de negócio, a guarda está ausente e deve ser registrada como pendência.

### 22.4 Slot vazio: divergência confirmada, sem campo equivalente na v2

**No legado** (confirmado em `CEP-APIBACK.gs` linha 903–909):

```js
var limiteKmBase = slot.pontos.length
  ? (MAX_EXTRA_METERS / 1000)          // slot com pontos → 5 km
  : (slot.date.getDay() === 6
      ? (MAX_SATURDAY_METERS / 1000)   // slot vazio + sábado → 45 km
      : (MAX_WEEKDAY_METERS / 1000));  // slot vazio + semana → 150 km
```

Portanto:
- Slot com pontos (dia aberto): limiteKmBase = 5 km
- Slot vazio + semana: limiteKmBase = 150 km
- Slot vazio + sábado: limiteKmBase = 45 km

**Na v2** (`classificarCandidatoOperacionalV2` e `gerarCandidatosComDisponibilidadeRealV2`):

A interface de entrada de `classificarCandidatoOperacionalV2` **não possui nenhum campo** como `slotTemPontos`, `quantidadePontosAgenda`, `ehSlotVazio` ou equivalente. A função recebe apenas `kmAdicionalNaRotaM` e usa sempre `kmAdicionalMaxNaRotaM` como limite base (5000 m), independente de o slot ser vazio ou não.

Verificado em `gerar-candidatos-disponibilidade-real.ts` linha 217–238: o loop que chama `classificarCandidatoOperacionalV2` não passa nenhuma informação sobre se o slot tem pontos na agenda. A função sempre usa o mesmo `limiteKmBase`.

**Impacto prático com valores reais:**
- Slot vazio + semana: legado usa 150 km como base; v2 usa 5 km. Candidato com `bestKm = 10 km` seria NORMAL no legado, INDISPONÍVEL na v2.
- Slot vazio + sábado: legado usa 45 km como base; v2 usa 5 km. Mesmo impacto.

Esta é uma **divergência real e bloqueante para produção** nos cenários de slot vazio.

**Lacuna de interface confirmada:** a v2 precisaria receber `slotTemPontos: boolean` (ou `quantidadePontosAgenda: number`) para replicar essa regra. Esse campo não existe na interface atual.

### 22.5 Hora marcada: não calculada internamente na v2 — lacuna confirmada

**No legado** (confirmado em `CEP-APIBACK.gs` linha 1141–1155):

```js
// Hora marcada: mesma distância dos normais, mas com tempo adicional
if (HORA_MARCADA_HORAS_A_MAIS > 0 && bestKm <= limiteKmBase) {
  var tempoNecessarioComAdicional = serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60);
  var slotAvailMin = parseMinutes(slot.availStr);
  if (slotAvailMin >= tempoNecessarioComAdicional) {
    porDiaHoraMarcada[k] = cand; // não exclusivo: candidato vai para normais E hora marcada
  }
}
```

Regras confirmadas no legado:
- Critério de distância: `bestKm <= limiteKmBase` (mesmo que NORMAL — não exclusivo).
- Critério de tempo: `slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)`.
- Com `HORA_MARCADA_HORAS_A_MAIS = 2` (Supabase confirmado), equivale a `slotAvailMin >= serviceMin + 120 min`.
- Guarda: só avalia hora marcada se `HORA_MARCADA_HORAS_A_MAIS > 0` (aqui 2 > 0, portanto ativa).
- **Não exclusivo:** um candidato pode ser NORMAL e HORA MARCADA simultaneamente no legado.

**Na v2** (`classificarCandidatoOperacionalV2`, linha 206):

```ts
if (input.horaMarcada) {
  return resultado('hora-marcada', true, motivos, avisos, input)
}
```

A v2 recebe `horaMarcada: boolean` como **parâmetro externo**. Ela não calcula internamente. Quem decide se é hora marcada é o chamador.

**Em `gerarCandidatosComDisponibilidadeRealV2`** (linha 217–238): o campo `horaMarcada` **não é passado** ao chamar `classificarCandidatoOperacionalV2`. O parâmetro simplesmente não existe na chamada. Portanto a v2 **nunca classifica candidatos como hora-marcada** nesse fluxo real.

**Na rota diagnóstica sintética** (linha 553): `criarCenario(Math.floor(base * 0.5), true)` — hora marcada aparece apenas em cenário sintético com boolean hardcoded, não com cálculo real.

**Na reclassificação diagnóstica** (`reclassificar-candidatos-com-km-mapa-slot.ts` linha 175): `horaMarcada: typeof c.horaMarcada === 'boolean' ? c.horaMarcada : false` — usa o campo do candidato, mas como o candidato veio de `gerarCandidatosComDisponibilidadeRealV2` sem o cálculo de hora marcada, o campo sempre será `false`.

**Conclusão:**
- A v2 é **estruturalmente incapaz** de classificar candidatos reais como hora-marcada sem receber o cálculo externo.
- O cálculo real do legado (`slotAvailMin >= serviceMin + HORA_MARCADA_HORAS_A_MAIS * 60`) **não existe em nenhum lugar na v2**.
- Lacuna de interface: `gerarCandidatosComDisponibilidadeRealV2` precisaria receber `horasMarcadasAMais` e `tempoNecessarioMin` para calcular internamente e passar `horaMarcada: true` quando aplicável.
- Esta é uma **divergência real e bloqueante para produção** no que diz respeito à categoria hora-marcada.
- Como a categoria hora-marcada não afeta o NORMAL (não exclusivo no legado), isso não impacta a elegibilidade de candidatos normais — mas impacta a entrega completa de tipos ao frontend.

### 22.6 Resumo das divergências (confirmadas com valores reais)

| # | Divergência | Confirmada | Bloqueante para produção |
|---|---|---|---|
| 1 | Limite especial: legado = 10 km, v2 = 5 km (v2 nunca classifica como especial com config atual) | Sim | Sim |
| 2 | Limite premium: legado = 15 km, v2 = 10 km | Sim | Sim |
| 3 | Guarda de ativação especial/premium (`> 0`): ausente na v2 | Sim | Pendência conhecida (sem impacto prático com valores atuais por causa de 1/2) |
| 4 | Slot vazio: legado usa 150 km (semana) ou 45 km (sábado); v2 usa sempre 5 km | Sim | Sim |
| 5 | Hora marcada: legado calcula internamente; v2 não calcula — campo sempre `false` nos fluxos reais | Sim | Sim (para a categoria hora-marcada) |
| 6 | Verificação de distância máx. semana/sábado: legado filtra antes; v2 filtra dentro da classificação | Sim | Não (resultado equivalente, responsabilidade diferente) |

### 22.7 O que NÃO foi alterado

- Nenhum código alterado.
- Motor legado Apps Script não alterado.
- Rota diagnóstica não alterada.
- Frontend não alterado.
- Banco/Supabase não alterado.
- Nenhum commit.

### 22.8 Próxima etapa segura

Antes de implementar qualquer comparação lado a lado ou corrigir divergências, é necessária **decisão explícita** sobre cada item bloqueante:

1. **Divergências 1 e 2 (limites especial/premium):** Opções: (a) corrigir os valores no Supabase para `10000` e `15000`; ou (b) corrigir a lógica da v2 para somar +5 km e +10 km sobre o limite base. Requer decisão.
2. **Divergência 4 (slot vazio):** Adicionar campo `slotTemPontos: boolean` na interface de `classificarCandidatoOperacionalV2` e em `gerarCandidatosComDisponibilidadeRealV2`. Requer implementação nova.
3. **Divergência 5 (hora marcada):** Adicionar cálculo interno de hora marcada em `gerarCandidatosComDisponibilidadeRealV2` usando `disponivelMin`, `tempoNecessarioMin` e o parâmetro `horasMarcadasAMais`. Requer implementação nova.

Próximo prompt recomendado (Frente 2 / meio): implementar as correções das divergências 1/2 (após decisão de qual abordagem), depois slot vazio, depois hora marcada — em ordem de impacto ao cliente (normal primeiro).

---

## 23. Frente 2 / Meio - equivalencia de limites normal/especial/premium e slot vazio (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

Regra corrigida:
- slotTemPontos=true: limiteBaseM = kmAdicionalMaxNaRotaM
- slotTemPontos=false e sabado: limiteBaseM = kmMaximoNoSabadoM
- slotTemPontos=false e dia util: limiteBaseM = kmMaximoNaSemanaM
- limiteEspecialM = limiteBaseM + 5000
- limitePremiumM = limiteBaseM + 10000

As configs kmAdicionalMaxNaRotaEspecialM e kmAdicionalMaxNaRotaPremiumM agora funcionam como guardas de ativacao (> 0), nao como limites absolutos.

Propagacao de slot vazio:
- A interface da classificacao aceita slotTemPontos.
- O candidato preliminar pode carregar slotTemPontos.
- A rota diagnostica deriva slotTemPontos de slotsAgendaDiagnostica[].linhasAgenda.length > 0 quando esse payload existe.
- A aplicacao/reclassificacao com mapa por slot recebe esse campo e expoe limiteBaseM, limiteEspecialM e limitePremiumM na amostra comparativa.
- Quando nao ha dado real de agenda/pontos no fluxo, o default permanece slotTemPontos=true para preservar o comportamento anterior e evitar inventar slot vazio.

Isolamento:
- Frontend nao alterado.
- /api/procurar-datas/pesquisar nao alterada.
- Ranking final nao alterado.
- Apps Script legado nao alterado.
- Supabase/banco nao alterado.
- Mudanca permanece restrita a helpers e rota diagnostica/testes.

Validacoes:
- npm run test -- src/lib/procurar-datas/motor/classificacao-candidato.test.ts src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts -> 4 arquivos, 175 testes passando.
- npx tsc --noEmit --pretty -> falha apenas em erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352 cast mock -> Response).

Pendencias:
- Hora marcada nao implementada nesta fatia.
- Hora marcada no legado calcula slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60) e nao e exclusiva.
- Comparacao ampla legado x v2 ainda pendente.
- Uso em producao, frontend, ranking final e /api/procurar-datas/pesquisar continua bloqueado ate validacao explicita.

### 23.6 Validação manual DevTools (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

Detalhes completos dos resultados em `docs/procurar-datas-motor-v2-progresso.md` — seção 27.

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| L1 — Classificação sintética / slot com pontos | Slot com pontos, classificação sintética | HTTP 200, slotTemPontos: true, limiteBaseM: 5000, limiteEspecialM: 10000, limitePremiumM: 15000, km=2500→normal, km=7500→especial | Limites ok ✅ |
| L2 — Slot vazio em dia útil | Slot vazio dia útil com reclassificação | HTTP 200, slotTemPontos: false, limiteBaseM: 150000, limiteEspecialM: 155000, limitePremiumM: 160000, km=9597→normal, validação base semana 150000: true | Base semana ok ✅ |
| L3 — Slot vazio no sábado | Slot vazio sábado com reclassificação | HTTP 200, slotTemPontos: false, limiteBaseM: 45000, limiteEspecialM: 50000, limitePremiumM: 55000, km=10445→normal, validação base sábado 45000: true | Base sábado ok ✅ |

**Conclusão geral:** L1, L2 e L3 aprovados em DevTools. A correção de limites dinâmicos foi validada manualmente. slotTemPontos foi propagado e observado nos blocos diagnósticos. Slot com pontos usa base 5000m. Slot vazio dia útil usa base 150000m. Slot vazio sábado usa base 45000m. Especial = base + 5000m. Premium = base + 10000m. kmAdicionalMaxNaRotaEspecialM e kmAdicionalMaxNaRotaPremiumM agora funcionam como guardas de ativação. producaoAfetada permaneceu false. Produção/frontend/ranking/pesquisar não afetados. Hora marcada segue como pendência.

**Status das divergências da seção 22:**
- Divergência 1 (limite especial): **CORRIGIDA** em diagnóstico/testes — agora usa limiteBaseM + 5000m
- Divergência 2 (limite premium): **CORRIGIDA** em diagnóstico/testes — agora usa limiteBaseM + 10000m
- Divergência 3 (guarda de ativação): **CORRIGIDA** em diagnóstico/testes — configs funcionam como guardas > 0
- Divergência 4 (slot vazio): **CORRIGIDA** em diagnóstico/testes — slotTemPontos propagado, base dinâmica implementada
- Divergência 5 (hora marcada): **CORRIGIDA** em diagnóstico/testes — regra calculada internamente, não exclusiva, com guarda `horaMarcadaHorasAMais > 0`, bloqueio em indisponíveis confirmado via DevTools H6/H7.
- Divergência 6 (verificação distância máx.): não bloqueante — resultado equivalente
- Comparacao ampla legado x v2: pendente.
- Validacao manual DevTools H6/H7: aprovada.

---

## 24. Frente 2 / Meio - equivalencia de hora marcada (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

Regra confirmada no legado Apps Script:
- `HORA_MARCADA_HORAS_A_MAIS` vem de config e so ativa quando `> 0`.
- `serviceMin` vem do tempo necessario do formulario.
- `slotAvailMin` vem de `parseMinutes(slot.availStr)`.
- A elegibilidade de hora marcada usa `slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)`.
- A distancia precisa continuar dentro do limite normal (`bestKm <= limiteKmBase`).
- A regra nao e exclusiva: o candidato pode continuar classificado como normal no fluxo primario e tambem ser elegivel a hora marcada em lista/flag propria.

Regra implementada no v2 diagnostico:
- `limiteMinimoHoraMarcadaMin = tempoNecessarioMin + (horaMarcadaHorasAMais * 60)`.
- `elegivelHoraMarcada = horaMarcadaHorasAMais > 0 && kmAdicionalNaRotaM <= limiteBaseM && disponivelMin >= limiteMinimoHoraMarcadaMin`.
- `tipo` principal nao e alterado para `hora-marcada`; a informacao fica em `horaMarcada/elegivelHoraMarcada` e nos detalhes diagnosticos.
- Se `horaMarcadaHorasAMais = 0`, a v2 nao ativa hora marcada, alinhado ao guarda `> 0` do legado.

Campos diagnosticos expostos:
- `horaMarcada`
- `elegivelHoraMarcada`
- `motivoHoraMarcada`
- `slotAvailMin`
- `serviceMin`
- `horaMarcadaHorasAMais`
- `limiteMinimoHoraMarcadaMin`
- na reclassificacao: `horaMarcadaAntes`, `horaMarcadaDepois`, `mudouHoraMarcada`

Isolamento:
- Frontend nao alterado.
- `/api/procurar-datas/pesquisar` nao alterada.
- Ranking final nao alterado.
- Apps Script legado nao alterado.
- Supabase/banco nao alterado.
- Mudanca permanece restrita a helpers, rota diagnostica e testes.

Validacoes:
- `npm run test -- src/lib/procurar-datas/motor/classificacao-candidato.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 4 arquivos, 183 testes passando.
- `npx tsc --noEmit --pretty` -> falha apenas em erro preexistente fora do escopo: `src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95` (TS2352 cast mock -> Response).

Pendencias:
- Comparacao ampla legado x v2 ainda pendente.
- Uso em producao, frontend, ranking final e `/api/procurar-datas/pesquisar` continua bloqueado ate validacao explicita.

### 24.6 Validação manual DevTools (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

Detalhes completos dos resultados em `docs/procurar-datas-motor-v2-progresso.md` — seção 30.

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| H6 — Bloqueio em indisponíveis | Verificar que nenhum candidato indisponível ficou com horaMarcada/elegivelHoraMarcada true | HTTP 200, ok: true, producaoAfetada: false, Total candidatos: 20, Indisponíveis com horaMarcada/elegivelHoraMarcada true: 0 (esperado: 0) | Bloqueio ok ✅ |
| H7 — Não exclusividade | Verificar que candidatos podem ter tipo principal normal e horaMarcada true, sem tipo === "hora-marcada" | HTTP 200, ok: true, producaoAfetada: false, Ofertáveis com hora marcada: 14, Candidatos com tipo === "hora-marcada": 0 (esperado: 0) | Não exclusividade ok ✅ |

**Conclusão geral:** H6 e H7 aprovados em DevTools. A regra de hora marcada está validada em diagnóstico/testes. Fórmula de tempo validada: slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60). Indisponível não fica mais com horaMarcada: true ou elegivelHoraMarcada: true. Candidato fora do limite normal não entra em hora marcada. Não exclusividade preservada. Tipo principal nunca vira hora-marcada. producaoAfetada permaneceu false. Frontend, produção, ranking final e /api/procurar-datas/pesquisar não foram afetados.

---

## 25. Frente 2 / Meio - comparacao ampla legado x v2 diagnostica (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

Escopo implementado:
- Novo bloco opcional `diagnosticoComparacaoLegadoV2` em `POST /api/procurar-datas/v2/diagnostico`.
- O bloco permanece `null` quando `usarComparacaoLegadoV2Diagnostico` nao e `true`.
- Quando ativado, usa apenas `legadoComparacaoDiagnostico.candidatos` como payload legado controlado.
- Nao chama Apps Script real.
- Nao chama `/api/procurar-datas/pesquisar`.
- Nao altera frontend, ranking final, producao ou banco/Supabase.

Chave de comparacao:
- `dataISO` normalizada para `YYYY-MM-DD`.
- Equipe normalizada localmente com suporte a variacoes como `Equipe 1`, `EQUIPE 1` e `equipe_1`.
- Ordem/rank nao e chave primaria; fica somente como divergencia informativa.

Campos comparados:
- Presenca por chave.
- `tipo`.
- `elegivel`.
- `horaMarcada` / `elegivelHoraMarcada`.
- `kmAdicionalNaRotaM`, com tolerancia padrao de 2m.
- `slotTemPontos`.
- `limiteBaseM`, `limiteEspecialM`, `limitePremiumM`.
- `motivo` / `motivos`.
- `ordem` / `rank` como informativo.

Severidade:
- Presenca, tipo, elegibilidade e hora marcada: `bloqueante`.
- Km acima da tolerancia: `avaliar`, ou `bloqueante` quando tambem impacta tipo.
- Slot, limites e motivos: `avaliar`.
- Ordem/rank: `informativo`.

Validacoes:
- `npm run test -- src/lib/procurar-datas/motor/comparacao-legado-v2.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 2 arquivos, 106 testes passando.
- `npx tsc --noEmit --pretty false` -> falha somente em erro preexistente fora do escopo: `src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95` (TS2352 cast mock -> Response).

Pendencias:
- A comparacao ainda depende de payload legado controlado enviado no body.
- Nao foi feita chamada real ao legado nem validacao com agenda real.
- Validacao manual K0-K3 da comparacaoKey v2 foi aprovada (2026-06-18).
- Proximo passo recomendado: Frente 2 / meio — Opção B: usar 1 payload legado real pequeno, converter para legadoComparacaoDiagnostico.candidatos, gerar comparacaoKey no mesmo formato da v2, comparar contra v2, listar divergências.

### 25.6 Validação manual DevTools (2026-06-18)

> ✅ Validação manual executada e aprovada pelo usuário via DevTools (2026-06-18).

Detalhes completos dos resultados em `docs/procurar-datas-motor-v2-progresso.md` — seção 32.

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| C0 — Baseline espelhado | Payload legado espelhando a própria v2 | HTTP 200, ok: true, divergencias: 0, candidatosLegado: 10, candidatosV2: 13, chavesComparadas: 8, presentesNosDois: 8, apenasNoLegado: 0 | Baseline ok ✅ |
| C1 corrigido — Divergência de tipo | Alterar tipo de 1 candidato no payload legado | HTTP 200, ok: false, divergenciasTipo: 1, chave: 2026-06-15::EQUIPE 1, campo: tipo, legado: premium, v2: normal, severidade: bloqueante | Detecção de tipo ok ✅ |
| C2 corrigido — Candidato ausente na v2 | Adicionar candidato impossível em 2099-01-01 no payload legado | HTTP 200, ok: false, apenasNoLegado: 1, chave: 2099-01-01::EQUIPE 1, campo: presenca, severidade: bloqueante | Detecção de ausência ok ✅ |

**Conclusão geral:** C0, C1 corrigido e C2 corrigido aprovados em DevTools. O comparador legado × v2 está validado como primeira ferramenta diagnóstica controlada. Baseline espelhado sem divergência retorna ok: true. Divergência de tipo é detectada corretamente. Candidato ausente na v2 é detectado corretamente. producaoAfetada permaneceu false. O comparador não chama Apps Script real. O comparador não altera frontend, produção, ranking final ou /api/procurar-datas/pesquisar.

**Limitação conhecida:** A chave atual dataISO + equipe é simplificada e gera avisos de duplicidade quando há múltiplos candidatos na mesma data/equipe. Nesta primeira versão, o comparador preserva o primeiro candidato e registra avisos. Antes de usar o comparador para comparação real ampla, é recomendado melhorar a chave/fonte v2 oficial para reduzir ou eliminar duplicidades.
### 2026-06-18 — Correção Opção B: fonte comparacaoKey unificada

**Problema identificado:**
- Adaptador legado gerava chave com fonte 'legado-real'
- V2 usava fonte diferente ('diagnostico-candidatos' ou 'v2-sintetico')
- Comparador usa comparacaoKey literalmente, gerando ausências falsas

**Correção aplicada:**
- Fonte default do adaptador mudada de 'legado-real' para 'comparacao' (neutra)
- Script de integração ajustado para usar 'comparacao' em ambos os lados
- Snippets DevTools B0-B4 ajustados para usar 'comparacao'
- Testes do adaptador atualizados (18 testes: 17 originais + 1 novo para fonte customizada)

**Arquivos alterados:**
- src/lib/procurar-datas/motor/adaptar-payload-legado-real-para-comparacao.ts
- scripts/testar-comparacao-legado-real-v2.ts
- docs/snippets-devtools-opcao-b-comparacao.md
- src/lib/procurar-datas/motor/adaptar-payload-legado-real-para-comparacao.test.ts

**Exemplo de comparacaoKey após correção:**
- Legado: 2026-06-23::EQUIPE 1::comparacao::1
- V2: 2026-06-23::EQUIPE 1::comparacao::1
- Chaves agora casam corretamente para pareamento

**Testes rodados:**
- npx vitest run adaptar-payload-legado-real-para-comparacao.test.ts: 18/18 passando
- npx vitest run comparacao-legado-v2.test.ts: 56/56 passando
- Total: 74 testes passando

**Status:** Opção B PREPARADA (não concluída ainda)
- Aguarda validação manual B0–B4 corrigidos no DevTools
- Após validação manual, Opção B pode ser considerada CONCLUÍDA

**Próximo passo recomendado:**
- Usuário executar snippets B0–B4 corrigidos no DevTools para validação manual
### 2026-06-18 — Correção Opção B: fonte comparacaoKey ajustada para diagnostico-candidatos

**Problema identificado:**
- Correção anterior usou fonte 'comparacao' (neutra)
- Rota diagnóstica não aceita 'comparacao' em fonteV2ComparacaoDiagnostico
- Validação manual retornou: fonteV2ComparacaoDiagnostico invalida: "comparacao"
- Comparador não executou, gerando keysEmComum: 0 (falso negativo)

**Fontes válidas na rota (confirmadas no código):**
- 'diagnostico-candidatos' (default)
- 'disponibilidade-real'
- 'reclassificacao-com-km-mapa-slot'

**Correção aplicada:**
- Fonte default do adaptador mudada de 'comparacao' para 'diagnostico-candidatos'
- Script de integração ajustado para usar 'diagnostico-candidatos' em ambos os lados
- Snippets DevTools B0-B4 ajustados para usar 'diagnostico-candidatos'
- Testes do adaptador atualizados (18 testes: default diagnostico-candidatos, customizado disponibilidade-real)

**Arquivos alterados:**
- src/lib/procurar-datas/motor/adaptar-payload-legado-real-para-comparacao.ts
- scripts/testar-comparacao-legado-real-v2.ts
- docs/snippets-devtools-opcao-b-comparacao.md
- src/lib/procurar-datas/motor/adaptar-payload-legado-real-para-comparacao.test.ts

**Exemplo de comparacaoKey após correção:**
- Legado: 2026-07-03::EQUIPE 1::diagnostico-candidatos::1
- V2: 2026-07-03::EQUIPE 1::diagnostico-candidatos::1
- Chaves agora usam a mesma fonte válida na rota

**Testes rodados:**
- npx vitest run adaptar-payload-legado-real-para-comparacao.test.ts: 18/18 passando
- npx vitest run comparacao-legado-v2.test.ts: 56/56 passando
- Total: 74 testes passando

**Status:** Opção B PREPARADA (não concluída ainda)
- Aguarda nova validação manual B1–B4 com fonte corrigida
- Após validação manual, Opção B pode ser considerada CONCLUÍDA

**Próximo passo recomendado:**
- Usuário executar snippets B1–B4 corrigidos no DevTools para validação manual

---

## Refactor OSRM base URL — default oficial osrm.lebebe.cloud (2026-06-17)

### Contexto
O legado usa OSRM dedicado da empresa: `https://osrm.lebebe.cloud`. A v2 estava usando `https://router.project-osrm.org` (publico) como default em snippets e config, causando divergencia no calculo de `kmAdicionalNaRotaM`.

### Mudanca aplicada
- Default oficial da v2: `https://osrm.lebebe.cloud`
- `router.project-osrm.org` tratado apenas como fallback explicito
- Helper `resolverOsrmBaseUrlV2` prioriza: payload > config > default-v2
- Bloco `diagnosticoOsrm` na resposta expoe URL usada, origem e fallback
- Snippets DevTools atualizados

### Pendencia de validacao
- Executar snippet K2 no DevTools com `osrm.lebebe.cloud`
- Verificar se 2026-07-03::EQUIPE 1 delta > 5000m (legado: 5.43km)
- Se delta continuar < 5000m, diagnosticar rota base vs legado

---

## 2026-06-19 — Diagnostico de Insercao por Slot (visibilidade completa)

### Contexto
Divergencia persiste: v2 = 4017m, legado = 5430m para `2026-07-03::EQUIPE 1`. Instrumentada a rota diagnostica para expor o calculo completo de insercao.

### Novo bloco: diagnosticoInsercaoPorSlot
- Flag: `usarInsercaoPorSlotDiagnostico: true` no payload
- Reusa `calcularMapaKmAdicionalPorSlotControladoV2` com `incluirDetalhesInsercao: true`
- Para cada slot, expoe:
  - `pontosRotaBase`: origem + pontos validos da agenda (com indice, tipo, label, lat, lng, endereco)
  - `candidatosInsercao`: todos os candidatos testados (com trechos anterior→novo, novo→proximo, anterior→proximo)
  - `melhorInsercao`: candidato vencedor
  - `kmAdicionalNaRotaMFinal`: delta final
  - `origemOperacional`: tipo (deposito/casa-e1/casa-e2), coordenadas e contexto
  - `osrmBaseUrlUsado`, `osrmFallbackUsado`, `origemCalculo`

### Snippet K3
Adicionado em `docs/snippets-devtools-opcao-b-comparacao.md` com payload de exemplo para os 4 slots criticos.

### Nao alterado
- Classificacao, ranking, recorte, frontend, producao, rota principal

---

## 2026-06-19 - Complemento: diagnosticoInsercaoPorSlot conectado aos slots reais

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que mudou:
- `diagnosticoInsercaoPorSlot` deixou de depender exclusivamente de `slotsAgendaDiagnostica` manual quando a agenda real esta ativa.
- Sem slots manuais, a rota usa a mesma base do mapa automatico aplicado aos candidatos reais: `janelaResult.datas` + `agendaRealComDados.linhasAgenda` + `equipeAgendaDiagnostica`.
- A montagem ficou centralizada em `montarSlotsKmAdicionalDiagnostico`, usada tanto pelo bloco de insercao quanto pelo mapa automatico dos candidatos reais.
- O response expoe `diagnosticoInsercaoPorSlot.parametros.fonteSlots`, esperado como `agenda-real-janela` no fluxo real.

Nao mudou:
- Classificacao normal/especial/premium.
- Hora marcada.
- Ranking.
- Recorte/lista final.
- Frontend.
- Producao.
- `/api/procurar-datas/pesquisar`.

Validacoes:
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 89 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda.test.ts` -> 18 testes passando.
- `npx vitest run diagnostico-km-adicional-agenda.test.ts gerar-candidatos-disponibilidade-real.test.ts` -> executou apenas `gerar-candidatos-disponibilidade-real.test.ts`, 37 testes passando.
- `npx tsc --noEmit` -> falhou apenas em erros preexistentes fora deste escopo.

---

## 2026-06-19 - Complemento: parse de data da AGENDA SHAG no diagnostico

### Contexto
O DevTools K3 retornou `slot0307Encontrado: true` e `fonteSlots: "agenda-real-janela"`, mas o slot `2026-07-03::EQUIPE 1` ficou sem `pontosRotaBase`, `candidatosInsercao` e `melhorInsercao`. O detalhe do parse mostrava descarte por `data_invalida` para linhas da AGENDA com `dadosBrutos.data` no formato `DD/MM/YYYY 00:00:00`, por exemplo `15/06/2026 00:00:00`.

### Regra confirmada no legado
- `getSlots` usa a data da disponibilidade como `Date` real da planilha.
- `coletarPontosDoDia(slot, agVals, agDisp)` compara `r[0]` da AGENDA via `Date.getTime()` contra `slot.date.getTime()`.
- O legado nao usa datas dentro de `observacoes` para decidir o dia do ponto da agenda.
- `observacoes` entra apenas no fallback de endereco/descricao quando a coluna de endereco esta vazia.
- A equipe vem da coluna de equipe exibida e passa por `normTeam`, que aceita formatos como `4- EQUIPE 01` e normaliza para `EQUIPE 1`.

### Mudanca aplicada
- O parser v2 de AGENDA agora aceita `DD/MM/YYYY HH:mm` e `DD/MM/YYYY HH:mm:ss` na coluna de data (`linha[0]`).
- A decisao de data continua usando somente a coluna de data da AGENDA; datas em `observacoes` continuam ignoradas para filtro de slot.
- O diagnostico por slot agora expoe `parseAgenda` dentro de `diagnosticoInsercaoPorSlot.slots[...]`, para permitir ver `resumo`, `pontos`, `descartados`, `avisos` e `erros` do parse que montou a rota base.

### Nao alterado
- Ranking, classificacao, hora marcada, recorte/lista final, frontend, OSRM, Haversine e rota principal de pesquisa.
- Nenhuma migration, banco, policy ou integracao externa foi alterada.

### Validacoes
- `npx vitest run src/lib/procurar-datas/motor/parse-agenda-shag.test.ts` -> 38 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot.test.ts` -> 16 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/calcular-km-adicional-real-controlado.test.ts` -> 6 testes passando.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 89 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda.test.ts` -> 18 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts` -> 37 testes passando.

---

## 2026-06-19 - Complemento: cache de coordenadas da AGENDA no diagnostico por slot

### Contexto
O K7 confirmou que o slot `2026-07-03::EQUIPE 1` ja encontra as linhas corretas da AGENDA real, mas os dois enderecos esperados foram descartados como `sem_coordenadas_cache` porque o payload estava com `cacheCoordenadasAgendaDiagnostico: {}`.

### Regra confirmada no legado
- `coletarPontosDoDia` extrai os enderecos da AGENDA e monta um `mockForm`.
- Antes de resolver cada ponto, o legado pre-carrega hashes com `ConsultarCacheSupabaseBatch_`.
- `ResolverEnderecoComCache_` tenta L1 (`CacheService`), Supabase L2 e, em miss, providers externos; quando falha, o ponto nao entra em `pts`.

### Mudanca aplicada
- O diagnostico v2 continua sem geocoding real e sem consulta Supabase para pontos da AGENDA.
- O fluxo `agenda-real-janela` agora repassa o `cacheCoordenadasAgendaDiagnostico` global do payload para cada slot real montado.
- Quando esse cache vier ausente ou vazio, o diagnostico adiciona aviso explicito e os pontos encontrados continuam sendo descartados como `sem_coordenadas_cache`.
- O parser tambem passou a aceitar datas da AGENDA sem zero a esquerda (`D/M/YYYY`, `DD/M/YYYY`, `D/MM/YYYY`) com horario, equivalente ao legado que usa `Date` real da planilha.

### Nao alterado
- Nao houve geocoding on-demand na v2, consulta Supabase nova, ranking, classificacao, hora marcada, frontend, OSRM, Haversine ou `/api/procurar-datas/pesquisar`.

### Validacoes
- `npx vitest run src/lib/procurar-datas/motor/parse-agenda-shag.test.ts` -> 39 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/calcular-km-adicional-real-controlado.test.ts` -> 7 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot.test.ts` -> 16 testes passando.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 89 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts` -> 55 testes passando.

---

## 2026-06-19 - Complemento: ordem da rota base antes da insercao

### Contexto
O K8 confirmou que o slot `2026-07-03::EQUIPE 1` ja monta os dois pontos da agenda, mas a v2 calculava a insercao sobre a ordem crua da AGENDA (`Rua Rio Ivai` antes de `Avenida Sao Jose`). O legado calcula a insercao depois de `rotaOtimizada(originLoc, slot.pontos)`.

### Regra confirmada no legado
- `baseRoute = rotaOtimizada(originLoc, slot.pontos)` e executado antes do calculo de `bestKm`.
- Para 0 pontos, a rota base e somente `DEPOSITO`.
- Para 1 ponto, a rota base e `DEPOSITO -> ponto`.
- Para 2 ou mais pontos, o legado escolhe o proximo ponto por menor Haversine a partir da origem atual.
- `twoOptSwap` so roda quando `ord.length > 3`.
- O calculo de insercao usa `baseRoute.order.slice(1)` para reconstruir a ordem de pontos usada no delta.

### Mudanca aplicada
- Criado helper puro `otimizarRotaBaseLegado`.
- `calcularKmAdicionalRealControladoV2` agora ordena os pontos validos da agenda antes de chamar o delta de insercao.
- O diagnostico por slot expoe `ordenacaoRotaBase` com `ordemOriginal`, `ordemOtimizada`, `criterioOrdenacao`, `twoOptExecutado` e `twoOptAplicado`.
- O caso 03/07 foi coberto com entrada crua `Rua Rio Ivai -> Avenida Sao Jose` e saida otimizada `Avenida Sao Jose -> Rua Rio Ivai`.

### Nao alterado
- Nao houve mudanca em classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine como criterio de greedy, ou `/api/procurar-datas/pesquisar`.

### Validacoes
- `npx vitest run src/lib/procurar-datas/motor/otimizar-rota-base-legado.test.ts src/lib/procurar-datas/motor/calcular-km-adicional-real-controlado.test.ts src/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot.test.ts` -> 3 arquivos, 25 testes passando.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 1 arquivo, 89 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts` -> 2 arquivos, 55 testes passando.

---

## 2026-06-19 - Complemento: divergencia K9 nos trechos OSRM

### Contexto
Depois da correcao da ordem da rota base, o K9 confirmou a ordem correta do
slot `2026-07-03::EQUIPE 1`, mas a v2 ainda retornou delta `7158m` enquanto o
valor legado observado anteriormente era `5430m`.

### Evidencia atual
Consulta direta ao OSRM dedicado `https://osrm.lebebe.cloud` com as coordenadas
atuais usadas pela v2 retornou:

- `/route`: `DEPOSITO -> Cornelius = 4023m`
- `/route`: `Cornelius -> Avenida Sao Jose = 12017m`
- `/route`: `DEPOSITO -> Avenida Sao Jose = 8871m`
- Delta `/route`: `7169m`
- `/table`: `DEPOSITO -> Cornelius = 4017m`
- `/table`: `Cornelius -> Avenida Sao Jose = 11995m`
- `/table`: `DEPOSITO -> Avenida Sao Jose = 8854m`
- Delta `/table`: `7158m`

### Conclusao de escopo
Com as coordenadas atuais, a diferenca `/route` vs `/table` no OSRM dedicado e
de apenas `11m` no delta. Portanto, o valor antigo `5430m` nao e explicado por
endpoint `/route` vs `/table`.

A divergencia restante fica concentrada no trecho base
`DEPOSITO -> Avenida Sao Jose`: mantendo os dois primeiros trechos do K9, o
legado teria que ter usado aproximadamente `10582m` nesse trecho para chegar a
`5430m`.

### Pendencia restante
Confirmar no Apps Script legado, sem limpar cache, quais valores `getDrivingKm`
retorna hoje para os tres trechos e qual `cacheKeyCoords` foi usada. Se o
legado atual tambem retornar aproximadamente `7169m`, o valor `5430m` deve ser
tratado como resultado antigo de cache/coordenadas/provider anterior. Se o
legado atual ainda retornar `5430m`, investigar cache `CacheService` ou
coordenadas efetivas usadas pelo legado para `DEPOSITO` e `Avenida Sao Jose`.

---

## 2026-06-19 - Complemento: validacao K10 do legado atual

### Contexto
O K10 Apps Script legado foi executado em 19/06/2026 às 14:12, sem limpar cache, para confirmar se o legado atual retorna aproximadamente `7.16km` ou ainda `5.43km` para o slot `2026-07-03::EQUIPE 1`.

### Coordenadas usadas
- DEPÓSITO: lat = -25.4876648, lng = -49.2692262
- Avenida São José, 814, Cristo Rei: lat = -25.4352613, lng = -49.2415798
- Rua Rio Ivaí, 269, Weissópolis: lat = -25.4665832, lng = -49.1853016
- Destino novo: Rua Cornelius Pries, 669, Xaxim: lat = -25.5091859, lng = -49.2671477

### Resultado K10 legado atual
- OSRM_BASE ativo: https://osrm.lebebe.cloud
- DEPÓSITO -> Cornelius: OSRM direto sem cache = 4023m, getDrivingKm legado = 4023m
- Cornelius -> Avenida São José: cache antes = 12.0168, OSRM direto sem cache = 12017m, getDrivingKm legado = 12017m
- DEPÓSITO -> Avenida São José: cache antes = null, OSRM direto sem cache = 8871m, getDrivingKm legado = 8871m
- Delta OSRM direto sem cache = 7169m
- Delta getDrivingKm legado = 7169m

### Comparacao v2 vs legado atual
- K9 v2 = 7158m
- K10 legado atual = 7169m
- Diferença = 11m

### Conclusao validada
A v2 retornou 7.158km. O legado atual retornou 7.169km. A diferença de 11m e aceitavel para equivalencia de motor nesse cenário e nao altera a classificacao operacional. Ambos classificaram como ESPECIAL, ambos com horaMarcada = false, ambos com ordem = 1.

### Status do valor historico 5.43km
O valor historico anterior `03/07 | EQUIPE 1 | ESPECIAL | Δ=5.43km` nao foi reproduzido no legado atual com as coordenadas atuais e OSRM dedicado. Portanto, nao deve mais ser usado como alvo de correcao funcional. Deve ser registrado como valor historico provavelmente originado por cache antigo, coordenadas antigas, provider anterior, OSRM anterior ou execucao em contexto diferente.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou `/api/procurar-datas/pesquisar`.

---

## 2026-06-19 - Decisão de controle: desbloqueio condicional da Frente 2

### Decisão tomada
A Frente 1 está validada para o cenário real `2026-07-03::EQUIPE 1` com OSRM atual. A Frente 2 pode avançar de forma controlada para validação de candidatos/classificação/adaptação legado.

### Base da decisão
- K9 v2 = 7158m
- K10 legado atual = 7169m
- Diferença = 11m (aceitável para equivalência da Frente 1)
- Classificação equivalente = especial
- Hora marcada equivalente = false
- Ordem equivalente = 1
- Divergências do comparador para 03/07 = []

### Status do valor histórico 5.43km
O valor histórico anterior `03/07 | EQUIPE 1 | ESPECIAL | Δ=5.43km` não foi reproduzido no legado atual com as coordenadas atuais e OSRM dedicado. Deve ser tratado como valor histórico provavelmente originado por cache antigo, coordenadas antigas, provider anterior, OSRM anterior ou execução em contexto diferente. Não bloqueia mais o avanço da Frente 2.

### Validacoes adicionais recomendadas
Ainda ficam recomendadas validações adicionais de amostragem OSRM para:
- um cenário normal com pontos na agenda;
- um cenário sábado, se houver origem operacional diferente;
- um cenário sem pontos na agenda.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou `/api/procurar-datas/pesquisar`.

---

## 2026-06-22 - Validacao K13: rota simples origem -> destino e recorte final v2

### Contexto
O K13 validou um cenário futuro iniciado em 2026-08-14, com agenda sem pontos válidos para os candidatos finais, usando rota simples origem -> destino, respeitando maxNormaisAplicado=3.

### O que foi validado
- Cenario futuro com dataInicial=2026-08-14, cep=81830-020, tempoNecessario=00:40, destino=Rua Cornelius Pries, 669, Xaxim, Curitiba - PR, equipeAgendaDiagnostica=EQUIPE 1.
- Recorte final: 3 normais, 0 especiais, 0 premiums, 0 hora marcada, maxNormaisAplicado=3.
- Sem datas duplicadas.
- Rota simples origem -> destino quando nao ha pontos validos na agenda.
- Origem operacional de sabado para EQUIPE 1 usando casa-e1 (lat=-25.494297, lng=-49.277091).
- Slots dos candidatos finais confirmaram "Nenhum ponto valido na agenda. Considerando rota simples origem -> destino." e temMelhorInsercao=false.

### Candidatos finais K13
- 2026-08-14 | EQUIPE 1 | NORMAL | 4017m | horaMarcada=true | origemOperacional.tipo=deposito
- 2026-08-15 | EQUIPE 1 | NORMAL | 3158m | horaMarcada=true | origemOperacional.tipo=casa-e1 (sabado)
- 2026-08-17 | EQUIPE 1 | NORMAL | 4017m | horaMarcada=true | origemOperacional.tipo=deposito

### Validacao de limites
- normaisOk = true
- especiaisOk = true
- premiumsOk = true
- horaMarcadaOk = true
- maxNormaisAplicadoOk = true
- semDatasDuplicadas = true

### Conclusao
- O K13 validou um cenario em que nao havia pontos validos de agenda para os candidatos finais, entao o motor caiu corretamente em rota simples origem -> destino, mantendo classificacao normal e respeitando o recorte final v2.
- A origem operacional de sabado para EQUIPE 1 foi validada parcialmente no diagnostico usando casa-e1.
- O recorte final v2 com maxNormaisAplicado=3 continua validado em cenario futuro.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou `/api/procurar-datas/pesquisar`. Recorte ainda restrito a rota diagnostica, sem afetar producao.

---

## 2026-06-22 - Rota v2 paralela implementada

### Escopo confirmado
Foi criada a rota paralela `POST /api/procurar-datas/v2/pesquisar` como primeiro ponto real do motor v2 fora da rota diagnostica.

### Limites preservados
- Nao alterou `/api/procurar-datas/pesquisar`.
- Nao alterou frontend.
- Nao alterou Apps Script.
- Nao alterou banco, migrations, policies ou schema.
- Nao mudou regras de classificacao, ranking, hora marcada, OSRM, Haversine ou geocoding.

### Contrato v2 paralelo
A rota retorna contrato reduzido para validacao controlada:
- `resultadoFinal.candidatosFinais`;
- `resultadoFinal.resumo.maxNormaisAplicado`;
- `resultadoFinal.diasUsados`;
- `diagnosticoMinimo.osrmBaseUrlUsado`;
- `diagnosticoMinimo.cacheAgenda`;
- `diagnosticoMinimo.quantidadeSlotsComPontos`;
- `diagnosticoMinimo.quantidadeSlotsSemPontos`.

### Criterios atendidos
- Recorte final com `maxNormais=3`.
- Cache Supabase/geo_cache automatico via helper existente.
- OSRM dedicado `https://osrm.lebebe.cloud`.
- Sem chamada a Apps Script nos arquivos novos.
- Testes novos e regressivos focados passaram.

### Proxima validacao
Executar K17 manual via DevTools com payloads K13/K14/K15 contra `/api/procurar-datas/v2/pesquisar`, comparando resultado final com a rota diagnostica e com o legado.

---

## 2026-06-22 - Decisao de produto: limite de normais v2 = 3 (divergencia intencional)

### Decisao tomada
O legado Apps Script usa `MAX_NORMAIS_RETORNO = 5` na funcao `selecionarConjuntoApp3ComExtras_` (CEP-APIBACK.gs, linha 831). A v2 foi aprovada para retornar ate 3 normais, nao 5.

### Regra v2 aprovada
- Normais: ate 3 (default do helper `recortarCandidatosLegadoEquivalente`)
- Especiais: ate 1 (igual ao legado)
- Premiums: ate 1 (igual ao legado)
- Hora marcada: ate 1 (igual ao legado)
- Estrutura de selecao, `chosenDays` compartilhado, deduplicacao por data/tipo: identicos ao legado

### Status desta divergencia
Esta diferenca e intencional e NAO deve ser reaberta como bug de equivalencia. O parametro `maxNormais` permanece flexivel no helper para compatibilidade e testes com `maxNormais: 5`.

### Implementacao
- Helper `recortar-candidatos-legado-equivalente.ts`: default alterado de 5 para 3
- JSDoc do helper atualizado com nota de divergencia intencional
- Testes atualizados: 16/16 passando (inclui teste especifico para default v2=3 com lista ampla)

### Nao alterado
Nao houve alteracao de classificacao, OSRM, geocoding, cache, hora marcada, frontend, producao ou `/api/procurar-datas/pesquisar`.

---

## 2026-06-22 - K14: regra legado para agenda sem pontos validos

### Regra confirmada no legado
Quando a agenda do dia/equipe nao tem pontos validos (`slot.pontos.length === 0`), o legado nao usa `KM ADICIONAL MAX NA ROTA` como limite base. O limite base passa a ser:
- sabado: `KM MAXIMO NO SABADO`;
- dia util: `KM MAXIMO NA SEMANA`.

Com pontos validos na agenda, o limite base continua sendo `KM ADICIONAL MAX NA ROTA`.

### Evidencia no legado
- `appscript/CEP-APIBACK.gs:362-364`: carrega `KM ADICIONAL MAX NA ROTA`, `KM MAXIMO NA SEMANA` e `KM MAXIMO NO SABADO`.
- `appscript/CEP-APIBACK.gs:889-896`: sabado usa origem da casa da equipe; dia util usa deposito.
- `appscript/CEP-APIBACK.gs:900-905`: `limiteKmBase` e condicional por `slot.pontos.length`; sem pontos usa limite de sabado/semana.
- `appscript/CEP-APIBACK.gs:1023-1068`: com rota simples, `bestKm` e calculado por `originLoc -> destino`, sem trecho anterior/proximo.
- `appscript/CEP-APIBACK.gs:1096-1138`: normal/especial/premium sao decididos comparando `bestKm` com base, base+5km e base+10km.
- `appscript/CEP-CONFIG.gs:1767-1769`: `rotaOtimizada(origin, pontos)` retorna apenas `['DEPOSITO']` quando nao ha pontos.

### Impacto no K14
O resultado K14 (`2026-07-25 | EQUIPE 1 | ESPECIAL | 8903m`, sabado, `casa-e1`, sem melhor insercao) indica divergencia se a v2 tiver marcado o slot como sem pontos validos. Pelo legado, 8903m em sabado sem pontos fica abaixo de `KM MAXIMO NO SABADO` quando essa config e 45000m, portanto deve ser NORMAL, nao ESPECIAL.

### Diagnostico v2
O helper `classificarCandidatoOperacionalV2` ja implementa a regra condicional quando recebe `slotTemPontos=false`. A pendencia esta na propagacao do dado em `src/app/api/procurar-datas/v2/diagnostico/route.ts`: no caminho automatico `agenda-real-janela`, `slotTemPontosPorSlotKey` nao e preenchido por pontos validos parseados; com isso `gerarCandidatosComDisponibilidadeRealV2` usa default `true` e aplica o limite curto de `KM ADICIONAL MAX NA ROTA`.

### Pendencia bloqueante
Antes de promover esse caminho, corrigir a rota diagnostica para derivar `slotTemPontos` de `parseAgenda.resumo.pontosValidos > 0`/detalhes do mapa por slot, nao de linhas brutas da agenda nem do default `true`. Cobrir com teste de sabado sem pontos validos: `kmAdicionalNaRotaM=8903`, `slotTemPontos=false`, esperado `normal`.

### Nao alterado
Nao houve alteracao de codigo, frontend, `/api/procurar-datas/pesquisar`, OSRM, geocoding/cache, recorte final ou Supabase.

---

## 2026-06-22 - K14: correcao da propagacao de slotTemPontos na rota diagnostica

### Mudanca aplicada
O caminho diagnostico `agenda-real-janela` passou a atualizar `slotTemPontosPorSlotKey` depois do calculo do mapa por slot, usando `detalhesPorSlot[].parseAgenda.resumo.pontosValidos`.

Regra aplicada:
- `pontosValidos > 0` -> `slotTemPontosPorSlotKey[chave] = true`;
- `pontosValidos === 0` -> `slotTemPontosPorSlotKey[chave] = false`.

Com isso, linha bruta da AGENDA que foi descartada por falta de coordenada/cache/endereco invalido nao conta como ponto valido para classificar normal/especial/premium.

### Impacto esperado no K14
Para `2026-07-25::EQUIPE 1`, com `kmAdicionalNaRotaM=8903`, sabado, origem `casa-e1` e sem pontos validos:
- antes: podia cair no default `slotTemPontos=true` e usar limite curto de 5000m -> `ESPECIAL`;
- depois: `slotTemPontos=false`, usa limite de sabado (`KM MAXIMO NO SABADO`) -> `NORMAL`.

### Validacoes
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 1 arquivo, 90 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts` -> 1 arquivo, 38 testes passando.

### Nao alterado
Nao houve alteracao de frontend, `/api/procurar-datas/pesquisar`, OSRM, Haversine, geocoding/cache, parse de data, ranking, recorte final ou hora marcada.

---

## 2026-06-22 - K15: cache Supabase read-only para agenda-real-janela diagnostica

### Diagnostico confirmado
No caminho diagnostico `agenda-real-janela`, a v2 montava slots reais com `cacheCoordenadasAgendaDiagnostico ?? {}`. Quando o payload vinha com `{}`, `parsearPontosAgendaDoDiaV2()` descartava pontos reais por `sem_coordenadas_cache`, mesmo quando o legado teria tentado resolver via cache Supabase antes de calcular a rota.

### Regra confirmada no legado
`coletarPontosDoDia()` calcula hashes dos enderecos da AGENDA com `NormalizarEnderecoParaCache_` + SHA-1, chama `ConsultarCacheSupabaseBatch_()` e passa o resultado para `ResolverEnderecoComCache_()`. Pontos sem coordenada continuam descartados, mas primeiro ha tentativa de cache Supabase.

### Mudanca aplicada
A rota diagnostica v2 agora enriquece o cache de coordenadas da agenda real antes de montar slots por janela:
- preserva coordenadas injetadas no payload;
- consulta somente o cache Supabase configurado em `SUPABASE_TABLE`;
- nao chama providers externos;
- nao escreve no banco;
- entrega o cache no formato ja esperado pelo parser (`cacheCoordenadasPorEndereco`).

### Impacto esperado no K15
Para `2026-07-14::EQUIPE 1`, os pontos reais de Fazenda Rio Grande deixam de ser descartados quando existirem no cache Supabase. O diagnostico de insercao por slot deve voltar a expor `pontosRotaBase`, `candidatosInsercao` e `melhorInsercao`, em vez de cair diretamente em rota simples `deposito -> destino` por cache vazio.

### Validacoes
- MCP Supabase read-only confirmou tabela `public.geo_cache` e hits de cache para os enderecos reais investigados.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 1 arquivo, 91 testes passando.

### Nao alterado
Nao houve alteracao de frontend, `/api/procurar-datas/pesquisar`, OSRM, Haversine, classificacao, recorte final, hora marcada, parse de data, migrations, policies ou dados do banco.

---

## 2026-06-22 - Validacao K15: premium por insercao real com pontos da agenda recuperados via Supabase/geo_cache

### Contexto
O K15 validou cenário composto com 3 normais + 1 premium, usando agenda real, coordenadas recuperadas via Supabase/geo_cache, rota base com pontos válidos e inserção real via OSRM.

### O que foi validado
- Cenario Mandirituba com dataInicial=2026-07-10, destino=R. José Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR, 83800-000, coordenadas lat=-25.769705, lng=-49.325586.
- Agenda real com 2 pontos validos em Fazenda Rio Grande no slot 2026-07-14::EQUIPE 1.
- Coordenadas recuperadas via Supabase/geo_cache, sem depender de cache injetado.
- Slot 2026-07-14::EQUIPE 1 com pontosRotaBase=3, candidatosInsercao=3, temMelhorInsercao=true.
- Delta de melhor insercao = 11533m (11.533 km).
- Classificacao como premium (acima do limite de especial, dentro do limite premium).
- Recorte final: 3 normais, 0 especiais, 1 premium, 0 hora marcada, maxNormaisAplicado=3.
- Sem datas duplicadas.
- OSRM dedicado usado (https://osrm.lebebe.cloud).

### Pontos da rota base do slot 2026-07-14::EQUIPE 1
- origem/deposito: lat=-25.4876648, lng=-49.2692262
- agenda: Avenida Mato Grosso, 2464, Estados, Fazenda Rio Grande - PR, 83830-481, lat=-25.6705907, lng=-49.3320594
- agenda: Rua Maria Zanão Machado, 219, Gralha Azul, Fazenda Rio Grande - PR, 83824-543, lat=-25.6841821, lng=-49.3046792

### Candidatos finais K15
- 2026-07-14 | EQUIPE 1 | PREMIUM | 11.533 km | horaMarcada=false
- 2026-08-08 | EQUIPE 1 | NORMAL | 32.241 km | horaMarcada=true
- 2026-08-13 | EQUIPE 1 | NORMAL | 33.100 km | horaMarcada=true
- 2026-08-15 | EQUIPE 1 | NORMAL | 32.241 km | horaMarcada=true

### Validacao de limites
- normaisOk = true
- especiaisOk = true
- premiumsOk = true
- horaMarcadaOk = true
- maxNormaisAplicadoOk = true
- semDatasDuplicadas = true

### Conclusao
- O K15 validou que, apos a correcao do cache de coordenadas, a rota diagnostica recuperou automaticamente os dois pontos reais de Fazenda Rio Grande via Supabase/geo_cache, montou rota base com pontos validos, calculou candidatos de insercao e classificou corretamente o novo endereço de Mandirituba como premium por delta de insercao de 11.533 km.
- Quando ha pontos validos na agenda, a v2 aplica regra de insercao real na rota. Nesse cenário, 11.533 km ficou acima do limite de especial e dentro do limite premium, portanto entrou como premium.
- Os normais distantes de agosto ficaram normais porque sao slots sem pontos validos e, conforme regra ja confirmada no legado, slots sem pontos usam limite de dia/sábado/semana, nao o limite curto de insercao.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou `/api/procurar-datas/pesquisar`. Recorte ainda restrito a rota diagnostica, sem afetar producao.

---

## 2026-06-22 - Validacao K16: smoke pos-correcoes (K13, K14, K15)

### Contexto
O K16 foi executado como smoke pos-correcoes apos as mudancas de propagacao de slotTemPontos e cache Supabase/geo_cache na rota diagnostica. O smoke executou tres cenarios: K13 (Cornelius, dataInicial=2026-08-14), K14 (Sitio Cercado, dataInicial=2026-06-25) e K15 (Mandirituba, dataInicial=2026-07-10).

### O que foi validado
- Smoke pos-correcoes executado com K13, K14 e K15.
- status 200, rotaOk=true e resultadoFinalOk=true nos 3 cenários.
- OSRM dedicado usado nos 3 cenários (https://osrm.lebebe.cloud).
- Fallback publico nao usado nos 3 cenários.
- maxNormaisAplicado=3 nos 3 cenários.
- limites de normais/especiais/premiums/hora marcada respeitados.

### Recortes finais validados
- K13: 3 normais + 1 especial (2026-08-21 | EQUIPE 1 | ESPECIAL | 7.158 km)
- K14: 3 normais + 1 especial + 1 premium (2026-07-02 | ESPECIAL | 7.650 km, 2026-07-23 | PREMIUM | 10.845 km)
- K15: 3 normais + 1 premium (2026-07-14 | PREMIUM | 11.533 km)

### K15 slot alvo validado
- slot = 2026-07-14::EQUIPE 1
- pontosRotaBase = 3
- candidatosInsercao = 3
- temMelhorInsercao = true
- delta de melhor insercao = 11533m (11.533 km)
- parseAgendaPontosValidos = 2
- parseAgendaPontosDescartados = 0
- parseAgendaSemCoordenadas = 0

### Ressalva sobre okGeral=false
- O campo okGeral do snippet K16 retornou false porque a validacao automatica esperava que K13 e K14 fossem cenarios puros de "normal sem pontos" e "sem extras".
- Essa expectativa ficou desatualizada depois da correcao de Supabase/geo_cache, porque a agenda real passou a recuperar mais pontos e gerar extras reais.
- okGeral=false nao representa falha funcional da rota. Representa criterio automatico desatualizado para K13/K14 apos a correcao de coordenadas via Supabase/geo_cache.

### Conclusao
- O smoke pos-correcoes validou que a rota diagnostica segue funcionando com OSRM dedicado, recorte final maxNormaisAplicado=3, limites de extras respeitados e agenda real com coordenadas recuperadas via Supabase/geo_cache.
- K13/K14 passaram a validar extras reais apos a correcao de coordenadas.
- K15 segue validando premium com pontos reais e insercao real.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou `/api/procurar-datas/pesquisar`. Recorte ainda restrito a rota diagnostica, sem afetar producao.

---

## 2026-06-22 - Plano de promocao controlada do recorte final v2

### Decisao de planejamento
Planejada a promocao controlada do recorte final v2 para fora da rota diagnostica. Estrategia aprovada: criar rota v2 real paralela (`/api/procurar-datas/v2/pesquisar`), sem alterar producao, frontend ou `/api/procurar-datas/pesquisar`.

### Estado atual
- Helpers puros validados na rota diagnostica: classificacao, recorte, geracao de candidatos, mapa km por slot, origem operacional, OSRM table, cache Supabase/geo_cache.
- K13/K14/K15/K16 validados com recorte final maxNormaisAplicado=3.
- Producao segue 100% via Apps Script.
- Nenhuma rota v2 real existe ainda.

### Estrategia em 5 etapas
1. Planejamento (concluido nesta tarefa).
2. Implementacao: criar `/api/procurar-datas/v2/pesquisar` reutilizando helpers puros.
3. Validacao manual: K17 com mesmo payload de K13/K14/K15.
4. Documentacao: registrar K17.
5. Ativacao: decisao explicita futura sobre troca de frontend ou flag.

### Riscos registrados
1. Extracao de logica da rota diagnostica pode copiar campos diagnosticos por engano.
2. Latencia diferente do Apps Script.
3. Frontend pode depender de campos especificos do payload do Apps Script.
4. Cache Supabase/geo_cache pode nao ter todos os enderecos em producao.
5. OSRM dedicado pode ter indisponibilidade (fallback Haversine replica legado).

### Rollback
- Rota paralela: nao chamar rota nova. Frontend continua no legado.
- Flag em `/pesquisar`: voltar flag para `legado`.
- Frontend alterado: reverter deploy.
- Sem mudanca de banco ou migration.

### Decisoes pendentes do usuario
1. Rota v2 sincrona ou assincrona com polling?
2. Frontend alterado ou troca transparente via flag em `/pesquisar`?
3. Aceitar latencia diferente?
4. Validar cenario extra 3 normais + 1 especial com pontos validos, ou K13/K14/K15/K16 sao suficientes?

### Criterios de aceite para Etapa 2 (implementacao)
1. Rota `/api/procurar-datas/v2/pesquisar` responde 200.
2. Recorte final maxNormaisAplicado=3.
3. Sem datas duplicadas.
4. Limites de extras respeitados.
5. Rota simples quando sem pontos validos.
6. Insercao real quando com pontos validos.
7. Origem sabado casa-e1.
8. OSRM dedicado.
9. Cache Supabase/geo_cache automatico.
10. Nao chama Apps Script.
11. Nao altera `/pesquisar`, frontend, banco, migrations ou policies.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou `/api/procurar-datas/pesquisar`. Recorte ainda restrito a rota diagnostica, sem afetar producao.


## 2026-06-22 - Validacoes K17 e K17.2 na rota v2 paralela

### Status
Validacoes manuais via DevTools na rota real paralela POST /api/procurar-datas/v2/pesquisar. Nao alteram producao.

### O que foi validado
- K17: Mandirituba/K15 reproduzido na rota nova (3 normais + 1 premium).
- K17.2: K13 (Cornelius) e K14 (Sitio Cercado) reproduzidos na rota nova.
- OSRM dedicado usado em todos os cenarios (https://osrm.lebebe.cloud).
- Fallback publico nao usado em nenhum cenario.
- maxNormaisAplicado=3 em todos os cenarios.
- Sem datas duplicadas em nenhum cenario.
- Limites de normais/especiais/premiums/hora marcada respeitados em todos os cenarios.
- Cache Supabase/geo_cache automatico funcionando (K17: 110/127 hits).

### K17 — Mandirituba
- status=200, ok=true, modo=v2-pesquisar-paralelo.
- totalRecortados=4 (3 normais, 0 especiais, 1 premium, 0 hora marcada).
- Candidatos finais: 2026-07-14 | EQUIPE 1 | premium | 11.533 km + 3 normais.
- Reproducao confirmada do cenario forte K15.

### K17.2 — K13 e K14
- K13 (Cornelius): totalRecortados=4 (3 normais, 1 especial).
- K14 (Sitio Cercado): totalRecortados=5 (3 normais, 1 especial, 1 premium).
- Ambos com status=200, ok=true, modo=v2-pesquisar-paralelo.

### Confirmacoes
- Rota v2 paralela segue funcionando sem afetar producao.
- /api/procurar-datas/pesquisar segue intacta como proxy legado.
- Frontend segue inalterado.
- Apps Script nao e chamado pela rota nova.
- Limpeza de avisos intermediarios em diagnosticoMinimo.avisos validada como ajuste de contrato, sem mudanca de regra de negocio.

### Nao alterado
Nao houve alteracao de codigo, testes, classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao ou /api/procurar-datas/pesquisar. Recorte ainda restrito a rota diagnostica e rota paralela, sem afetar producao.

---

## 2026-06-22 - Decisao pendente: K14 e early stop do legado vivo

### Risco novo confirmado por leitura de codigo
O cenario K14 do comparador vivo expôs uma diferenca de equivalencia entre legado e v2:
- Legado direto (`ApiPesquisarDatasApp`) roda em `app-3-com-extras`, processa primeiro slots com pontos, depois slots vazios, e pode encerrar cedo quando ja encontrou 3 normais.
- V2 paralela avalia a janela completa antes de aplicar o recorte final.

### Status
Nao e seguro classificar automaticamente as datas extras da v2 como diferenca esperada/info. Enquanto essa decisao nao for tomada, `data-apenas-na-v2` em K13/K14 deve continuar como aviso/pendencia de equivalencia.

### O que foi descartado em K14
- Bug do comparador chamando outra v2: descartado por K18.1.
- Payload legado incompatível: descartado por leitura de `ApiPesquisarDatasApp` e `CEP-APIBACK.gs`.
- `destLat/destLng` ignorados: descartado; legado prioriza coordenadas recebidas quando presentes.
- `tempoNecessario='00:40'` ignorado: descartado; legado usa `parseMinutes`.
- `dataInicial='2026-06-25'` ignorada: descartado; legado prioriza `dataInicial`.
- Diferenca relevante entre `ApiPesquisarDatasApp` e fluxo assincrono como motor final: descartada em codigo, pois o worker assincrono chama `ApiPesquisarDatasApp(job.form)`.

### Decisao necessaria antes de promocao
Escolher uma das opcoes:
1. Reproduzir na v2 o early stop operacional do legado `app-3-com-extras`.
2. Manter a v2 com avaliacao global da janela e documentar a divergencia como decisao de produto.

Sem essa decisao, K14 permanece pendencia de equivalencia, apesar de K15 permanecer validado como equivalencia forte.

---

## 2026-06-22 - K14 27-06: correcao tecnica no cache de slots diagnosticos

### Fato confirmado
O endereco `Rua Gregorio de Matos, 708, Sao Lourenco, Curitiba - PR, 82200-110` existe em `public.geo_cache`. A chave gerada pelo caminho v2/legado sem numero e `41dc44699f62c91f1c153512bb8d35a859db6d1d`, com coordenadas `-25.3953811,-49.2684535`.

### Decisao de escopo
A correcao aplicada e tecnica e limitada a rota diagnostica: `slotsAgendaDiagnostica` com cache vazio nao deve apagar o cache de agenda recuperado via Supabase nos consumidores diagnosticos de slots. Nao houve mudanca de regra de negocio, dados Supabase, Apps Script, OSRM, frontend, `/api/procurar-datas/pesquisar` ou `/api/procurar-datas/v2/pesquisar`.

### Impacto em K14
Com Sao Lourenco considerado na rota base, o melhor delta OSRM para inserir Sitio Cercado em 27-06 e aproximadamente `15597m`. Portanto o slot `2026-06-27::EQUIPE 1` nao deve ser `normal` nesse diagnostico; com os limites atuais, fica acima do premium padrao e tende a `indisponivel`.

### Controle
O slot `2026-07-02::EQUIPE 1` continua coerente: dois pontos validos em Araucaria, melhor insercao na posicao 0, delta `7650m`, classificacao especial.

### Risco ainda separado
A decisao sobre reproduzir early stop do legado `app-3-com-extras` ou manter avaliacao global da janela permanece pendente e nao foi alterada por esta correcao.

---

## 2026-06-22 - K14 K18.3: runtime corrigido no cache central por hash legado

### Decisao revisada
A correcao apenas na rota diagnostica nao era suficiente para o runtime. O caminho real `/api/procurar-datas/v2/pesquisar` usa `pesquisarDatasV2`, que monta slots com o cache global de `resolverCacheCoordenadasAgendaDiagnostico`.

### Causa confirmada
O helper de cache consultava `geo_cache` por hash legado sem numero, mas armazenava o resultado em apenas uma chave textual do parser. Como o hash legado ignora numero, mais de uma linha da agenda pode compartilhar o mesmo hash. Quando isso acontecia, um hit do Supabase nao alimentava todas as chaves textuais equivalentes, e o parser podia descartar Sao Lourenco como `sem_coordenadas_cache`.

### Correcao aplicada
`resolverCacheCoordenadasAgendaDiagnostico` agora mapeia `hashLegado -> EnderecoParaCache[]` e aplica a coordenada retornada pelo Supabase a todas as chaves textuais associadas. A correcao e central e vale para `/v2/pesquisar`, para o lado v2 de `/v2/comparar` e para os diagnosticos que usam o mesmo helper.

### Impacto esperado
- `2026-06-27::EQUIPE 1` deve usar a coordenada existente de Sao Lourenco.
- Sao Lourenco nao deve mais ser descartado por `sem_coordenadas_cache`.
- O delta esperado permanece proximo de `15597m`.
- 27/06 nao deve permanecer como normal.
- `2026-07-02::EQUIPE 1` permanece controle coerente como especial com delta `7650m`.

### Risco separado
A decisao sobre early stop legado versus avaliacao global da janela continua pendente e nao foi alterada por esta correcao.


## 2026-06-22 - Decisao aprovada: full-window controlado para extras uteis (antecipacao)

### Contexto
Apos a correcao tecnica do cache/geo_cache do Sao Lourenco, o cenario K14 ficou assim:

Legado vivo:
- 2026-07-11 | EQUIPE 1 | normal
- 2026-07-13 | EQUIPE 1 | normal
- 2026-07-16 | EQUIPE 1 | normal

V2 atual:
- 2026-07-02 | EQUIPE 1 | especial | 7.650 km
- 2026-07-11 | EQUIPE 1 | normal   | 4.657 km
- 2026-07-13 | EQUIPE 1 | normal   | 4.019 km
- 2026-07-16 | EQUIPE 1 | normal   | 3.491 km
- 2026-07-23 | EQUIPE 1 | premium  | 10.845 km

O problema tecnico do 2026-06-27 ja foi corrigido: Sao Lourenco entra na rota base, delta 15.597 km, 27/06 saiu do resultado final.

### Causa da divergencia K14 apos correcao tecnica
O legado usa earlyStop em `app-3-com-extras`: processa slots com pontos primeiro, depois slots vazios, e encerra quando encontra 3 normais. A v2 avalia a janela completa antes do recorte final. Por isso a v2 encontra extras que o legado nao encontra.

### Decisao aprovada
A v2 pode usar busca full-window controlada para encontrar extras uteis, mas extras so devem aparecer se forem **anteriores a ultima data normal selecionada**.

### Definicao de "extra util"
Extra (especial/premium/hora marcada) cuja data é anterior a ultima data normal selecionada no recorte final.

### Regra de filtragem de extras
1. Selecionar as datas normais conforme a regra v2/legado-equivalente.
2. Identificar a ultima data normal selecionada.
3. Permitir extras especial/premium/hora marcada somente se a data do extra for menor que a ultima data normal.
4. Remover extras em data igual ou posterior a ultima normal.
5. Ordenar o resultado final cronologicamente.

### Racional
- Extra so tem valor se adiantar a entrega.
- Se o cliente vai pagar mais, precisa ser para receber antes.
- Extra depois da ultima data normal nao ajuda, polui o resultado e consome tempo de analise.
- Se o usuario quiser datas mais longas, ele pode mudar a data inicial da pesquisa.

### Aplicacao no K14
Normais selecionadas: 2026-07-11, 2026-07-13, 2026-07-16.
Ultima normal: 2026-07-16.
Extras avaliados:
- 2026-07-02 | especial | anterior a ultima normal | deve entrar.
- 2026-07-23 | premium  | posterior a ultima normal | deve sair.

Resultado desejado para K14 apos implementar a regra:
- 2026-07-02 | EQUIPE 1 | especial
- 2026-07-11 | EQUIPE 1 | normal
- 2026-07-13 | EQUIPE 1 | normal
- 2026-07-16 | EQUIPE 1 | normal

### Excecao intencional em relacao ao legado estrito
- O legado tem comportamento de earlyStop apos encontrar 3 normais.
- A v2 nao precisa reproduzir exatamente o earlyStop se isso impedir encontrar extras que antecipam a entrega.
- Porém a v2 tambem nao deve trazer extras posteriores a ultima normal.
- Portanto, a decisao aprovada é: **full-window controlado para antecipacao**, nao full-window livre.

### Status de implementacao
- Regra IMPLEMENTADA e validada (K18.5, 2026-06-23).
- Helper `recortarCandidatosLegadoEquivalente` aplica a regra no recorte final.
- 25/25 testes unitarios + integracao passando.
- K13 passou completo. K14 e K15 tiveram v2Ok=true; comparacao legado x v2 ainda pendente por timeout do legado.
- A regra central de equivalencia com legado continua valida com excecao aprovada de extras uteis para antecipacao.

### Risco conhecido
- K14 e K15: comparacao legado x v2 ainda nao concluida por timeout do legado (~170s no K18.5).
- Timeout do comparador ajustado para 300s (K18.5, Frente 3). Nova execucao e validacao manual opcional.
- Caso legado continue estourando em 300s, pode indicar necessidade de otimizacao do Apps Script — fora do escopo desta migracao.

---

## 27. Decisao — Geocoding LocationIQ v2: numero obrigatorio e rejeicao de centroide (2026-06-26)

### Decisao tomada
A v2 e intencionalmente mais rigida que o legado na aceitacao de resultados de geocoding direto (LocationIQ):

1. **`numero` e obrigatorio no payload** — ja implementado em `validar-endereco-payload.ts`.
2. **LocationIQ sem comprovacao de numero nao e aceito** — centroide sem `house_number` no `address` e sem o numero no `display_name` e rejeitado.
3. **Logradouro deve ser comprovado** — ao menos 1 token forte do logradouro (4+ chars, sem prefixo de tipo) deve aparecer no `display_name` ou `address.road`.
4. **`house_number` nunca e preenchido com `form.numero`** — o campo reflete apenas o que o provider retornou.
5. **Candidato rejeitado nao e salvo no `geo_cache`**.
6. **Quando LocationIQ rejeita todos os candidatos, o fluxo cai para fallback Apps Script** (ja existente em `route.ts`).

### Base da decisao
- Auditoria confirmou que legado (`ValidarRetornoGeocode_`) rejeitaria o caso real "Rua Nicola Pelanda, 100, Umbara, Curitiba, PR" com score ~0.50 (abaixo do threshold 0.65) por `LOGRADOURO_MISS=-0.30`.
- v2 anterior aceitava o centroide porque validava apenas cidade e UF.
- v2 agora cobre as mesmas protecoes do legado com regras booleanas mais diretas, sendo mais rigida no ponto do numero porque o payload ja exige numero.

### Equivalencia com legado
- `LOGRADOURO_MISS=-0.30` → rejeicao booleana por logradouro ausente no display.
- `CEP_REGION_DIFF=-0.25` → rejeicao por CEP divergente nos primeiros 5 digitos.
- Threshold 0.65 → coberto pelas regras booleanas combinadas.

---

## 26. Frente 1 — Correcao fonte KM MAX ENTRE PONTOS (2026-06-24)

Status: corrigido no banco. Nenhuma alteracao de codigo.

### Problema
O filtro early Haversine da v2 descartava 25/07 incorretamente (10.99km > 10.5km) porque o banco tinha `KM MAX ENTRE PONTOS = 7` enquanto a planilha (fonte do legado) tem `8`.

### Diagnostico
- **v2:** `config-service.ts` -> `resolverValor()` prioriza Supabase -> banco tinha `7` -> `kmMaxEntrePontosKm = 7` -> `limiteHaversineKm = 10.5`
- **Legado:** `CEP-APIBACK.gs:366` -> `getConfig('KM MAX ENTRE PONTOS', cfgSheet)` -> le planilha -> `8` -> `8 * 1.5 = 12km`
- **Auditoria MCP:** importacao gravou `8`; edicao manual via tela alterou para `7` em 2026-06-10

### Correcao
- UPDATE no banco: `procurar_datas_config` SET `valor = '8'` WHERE `chave_upper = 'KM MAX ENTRE PONTOS'`
- Auditoria registrada
- Nenhuma alteracao de codigo, frontend, Apps Script ou regra de negocio

### Impacto
- `limiteHaversineKm`: 10.5 -> 12
- `25/07` (10.99km): nao sera mais descartado (10.99 < 12)
- `02/07` (18.20km): continua descartado (18.20 > 12)

### Pendencia
- Executar diagnostico Santo Amaro para validar 02/07, 25/07, 16/07, 24/07
- 16/07 (premium) pode ter outra causa de divergencia
- Verificar se outras chaves do banco divergem da planilha

---
