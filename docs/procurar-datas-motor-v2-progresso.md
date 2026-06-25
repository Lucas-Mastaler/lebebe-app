## 2026-06-25 - Codex - Migracao inicial das rotas auxiliares da tela principal

Status: parcial implementado. Nao altera motor v2, ranking, classificacao, recorte, OSRM/Haversine do motor de datas, frete final, pre-agendamento, schema, migrations, Apps Script ou UI.

### O que mudou
- `/api/procurar-datas/opcoes` deixou de chamar `GetFrontOptionLists` e `GetTempoMap`.
- Criado `src/lib/procurar-datas/opcoes-locais.ts` com listas locais equivalentes as opcoes usadas por `tempo-servico.ts`.
- `tempoMap` continua no contrato, mas retorna `{}` porque a tela principal calcula `tempoNecessario` localmente.
- `/api/procurar-datas/validar-endereco` agora consulta `public.geo_cache` antes do Apps Script.
- Cache hit retorna no contrato existente com `provider: "supabase"` e nao chama `LookupCompletoPorEndereco`.
- Cache miss preserva fallback temporario para `LookupCompletoPorEndereco`.
- `/api/procurar-datas/valor-inicial` agora calcula localmente quando ja recebe `lat/lng` ou `destLat/destLng`, usando config Supabase, OSRM route e helper puro `frete.ts`.
- Sem coordenadas ou falha local, a rota preserva fallback temporario para `calcularValorInicialModal`.

### Logs adicionados
- `/opcoes`: `origem=local` e `duracaoMs`.
- `/validar-endereco`: `cache_hit`, `cache_miss`, `provider`, `fallback` e `duracaoMs`.
- `/valor-inicial`: `origem`, `fallback` e `duracaoMs`.

### Validacoes
- MCP Supabase confirmou estrutura real de `public.geo_cache`.
- MCP Supabase confirmou hit para Marechal Floriano Peixoto/Hauer/Curitiba/PR.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint` nas rotas/helpers/testes alterados: passou.
- `npx vitest run src/lib/procurar-datas/endereco-cache.test.ts src/lib/procurar-datas/opcoes-locais.test.ts --silent`: passou fora do sandbox apos `spawn EPERM` no sandbox.

### Pendencias
- Validacao manual autenticada em `/procurar-datas`.
- Implementar fallback Next.js direto para provider externo de geocoding somente apos confirmar helper/env/payload local; por enquanto nao confirmado no codigo.
- Avaliar em tarefa separada RLS desabilitado em `public.geo_cache` e outras tabelas apontadas pelo MCP.

---

## 2026-06-25 - Cascade - Frente 3/direita: mascaras, validacao visual e ajustes finos de UI/UX

Status: implementado no frontend. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte, banco ou `/procurar-datas/dev-v2`.

### O que foi implementado
- Criado `src/lib/procurar-datas/form-helpers.ts` com normalizacao de logradouro, bairro, cidade, numero e UF, validacao de campos de endereco e mensagem de erro para tempo invalido.
- Criado `src/lib/procurar-datas/form-helpers.test.ts` com 7 testes unitarios passando.
- Atualizado `src/app/procurar-datas/page.tsx`:
  - Normalizacao automatica nos campos de endereco.
  - Feedback visual em vermelho para campos obrigatorios/invalidos.
  - `Validar endereco` valida campos antes de chamar API e exibe erros.
  - `Pesquisar datas` valida endereco confirmado, data inicial e tempo valido, exibindo erros visuais.
  - Botao `Pesquisar datas` reduz disabled para estados de loading; validacao interna garante seguranca.

### O que nao foi alterado
- Backend, rotas API, Apps Script, banco, motor v2, ranking, classificacao, frete, OSRM, Haversine, limites, recorte.
- `/procurar-datas/dev-v2`.
- Pré-visualizacao progressiva, mapa, cache de valor inicial, aviso de divergencia de bairro/cidade.

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/app/procurar-datas/page.tsx src/lib/procurar-datas/form-helpers.ts src/lib/procurar-datas/form-helpers.test.ts --quiet`: passou.
- `npx vitest run src/lib/procurar-datas/form-helpers.test.ts --silent`: passou, 7 testes.

### Pendencias
- Validacao manual autenticada do fluxo completo.
- Tarefas futuras para melhorias de media/baixa prioridade.

### Riscos
- Normalizacao pode remover caracteres especiais raros de enderecos. Ajustar regex se necessario.
- Botao `Pesquisar datas` habilitado visualmente com dados incompletos pode exigir adaptacao operacional.

---

## 2026-06-25 - Cascade - Frente 3/direita: gate de confirmacao, avisos fixos e mascaras na tela principal

Status: implementado no frontend. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte, banco ou `/procurar-datas/dev-v2`.

### O que foi implementado
- `src/app/procurar-datas/page.tsx`:
  - Avisos fixos no topo do formulario (encomenda D+42 e showroom pos-venda).
  - Estado `addressConfirmed` / `addressConfirmedResult` para confirmacao explicita de endereco.
  - Botao `Confirmar este local` apos validacao.
  - Reset de confirmacao e resultados ao editar `logradouro`, `numero`, `bairro`, `cidade` ou `uf`.
  - `serviceLocked` agora depende de `addressConfirmed` (gate equivalente ao legado).
  - Botao `Pesquisar datas` so habilita com endereco confirmado, data inicial preenchida, tempo necessario > 00:00 e <= 06:30.
  - Aviso visual quando tempo > 06:30.
  - Mascaras: numero apenas digitos; UF apenas 2 letras maiusculas.
  - Foco automatico no campo `dataInicial` apos confirmacao.

### O que nao foi alterado
- Backend, rotas API, Apps Script, banco, motor v2, ranking, classificacao, frete, OSRM, Haversine, limites, recorte.
- `/procurar-datas/dev-v2`.
- Pré-visualizacao progressiva, botao Selecionar no Mapa, cache de valor inicial, aviso de divergencia de bairro/cidade.

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/app/procurar-datas/page.tsx --quiet`: passou.

### Pendencias
- Validacao manual autenticada do fluxo completo.
- Tarefas futuras para melhorias de media/baixa prioridade.

### Riscos
- Gate de confirmacao muda a UX operacional. Validar com usuarios reais antes de considerar definitivo.

---

## 2026-06-25 - Cascade - Frente 3/direita + Frente 0/Controle: auditoria UI/UX do modal legado

Status: auditoria concluida. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### O que foi auditado
- Modal legado de entrada `appscript/procurar_modal.html` (formulario de "Procurar Datas").
- Comportamentos de mascaras, campos obrigatorios, bloqueio/desbloqueio, limpeza, foco, mensagens, botoes, valor inicial, resultados progressivos e selecao no mapa.

### Fontes consultadas
- `appscript/procurar_modal.html`
- `appscript/CEP-APIBACK.gs` (funcoes de modal/resultados)
- `appscript/CEP-CONFIG.gs` (constantes de backend modal)
- `src/app/procurar-datas/page.tsx` (tela nova)

### Comportamentos do legado encontrados
1. **Gate visual**: parte inferior do form bloqueada por overlay "PREENCHER CEP ACIMA ANTES" ate confirmar endereco.
2. **Confirmacao explicita**: apos validar, usuario deve clicar "Confirmar este local" para liberar o resto do form.
3. **Campos obrigatorios**: logradouro, bairro, cidade, UF, data inicial.
4. **Avisos fixos**: encomenda D+42 e showroom pos-venda.
5. **Aviso de divergencia**: compara bairro/cidade digitado com encontrado (ignorando acentos) e alerta se diferente.
6. **Link Google Maps**: oferece comparar endereco validado no Google Maps.
7. **Selecao no mapa**: botao "Selecionar no Mapa" aparece quando endereco nao e localizado.
8. **Limpeza ao editar endereco**: reseta confirmacao, fecha gate, limpa resultados.
9. **Foco automatico**: apos confirmar, foco vai para data inicial; ao editar, foco vai para logradouro.
10. **Valor inicial**: calculado pelo backend com distancia real; fallback local (base semana + rural + condominio + 20%, arredondado para multiplos de 5); cache por coordenadas.
11. **Resultados progressivos**: polling dentro do modal, delay de 30s, contador, timer, destaque no primeiro resultado, badge Normal/Extra, frete, equipe, delta km, dias faltantes.
12. **Bloqueio do submit**: so habilita "Pesquisar datas" quando endereco confirmado, tempo calculado, tempo > 00:00 e <= 06:30.

### Diferencas para a tela nova
- Tela nova nao tem gate visual nem confirmacao explicita de endereco.
- Tela nova nao exibe avisos fixos de encomenda/showroom.
- Tela nova nao tem aviso de divergencia de bairro/cidade nem link Google Maps.
- Tela nova nao tem botao "Selecionar no Mapa".
- Tela nova nao tem pre-visualizacao progressiva de resultados.
- Tela nova mostra resultados em secao separada, sem destaque no primeiro resultado.
- Tela nova nao arredonda valor inicial para multiplos de 5 (escopo de tarefas anteriores).

### Melhorias recomendadas
- **Alta:**
  - Adicionar confirmacao explicita de endereco (gate/confirmar) antes de liberar pesquisa.
  - Bloquear/desabilitar "Pesquisar datas" ate endereco confirmado e tempo valido.
- **Media:**
  - Adicionar avisos fixos de encomenda D+42 e showroom pos-venda.
  - Aviso de divergencia de bairro/cidade e link Google Maps.
  - Cache local de valor inicial por coordenadas.
- **Baixa:**
  - Destacar primeiro resultado.
  - Pre-visualizacao progressiva de candidatos.
  - Botao "Selecionar no Mapa".

### Pendencias
- Implementar melhorias priorizadas em tarefas futuras.
- Validar com usuario quais comportamentos do legado devem ser replicados na tela nova.

### Riscos
- Replicar todos os comportamentos de uma vez pode gerar refactor grande na tela. Recomendado fazer por partes.
- Gate de confirmacao de endereco pode mudar perceptivelmente a UX; validar com operacao antes de implementar.

---

# Motor v2 da tela `/procurar-datas` — Progresso Técnico

> **Data:** 12 de junho de 2026  
> **Status:** Diagnóstico isolado, sem produção  
> **Propósito:** Log técnico do progresso do motor v2. Não substitui leitura de código.

---

## 2026-06-24 - Codex - Frente 1/esquerda: tempo de servico em helper TS puro

Status: implementado no codigo e validado por teste unitario, typecheck e lint. Validacao manual autenticada da tela principal nao confirmada nesta execucao porque `GET /procurar-datas` local renderizou login.

### O que mudou
- Criado `src/lib/procurar-datas/tempo-servico.ts` com helper puro TypeScript para calcular `tempoNecessario` a partir de berco/cama, comoda, roupeiro, poltrona e painel.
- O helper replica a regra efetiva do Apps Script `gerarTempoServiCalcula()` que materializava a aba `TEMPO SERVICOS`.
- A divergencia do legado foi preservada como equivalencia: o comentario do Apps Script fala `+15`, mas o codigo real faz `rouMin += 30`; a v2 replica `+30` e documenta isso no helper/teste.
- A tela principal `src/app/procurar-datas/page.tsx` deixou de chamar `POST /api/procurar-datas/calcular-tempo` para calcular o campo "Tempo necessario".
- O adicional de condominio `+10` foi preservado na tela, fora do helper, porque ele existia no caminho antigo `GetTempoNecessario`.

### O que nao mudou
- Nenhuma regra de datas, ranking, classificacao, OSRM, Haversine, frete, banco, Apps Script, limites, recorte, pre-agendamento ou rotas v2 de pesquisa foi alterada.
- A rota antiga `/api/procurar-datas/calcular-tempo` nao foi removida; apenas deixou de ser usada pela tela principal para esse calculo.
- `/procurar-datas/dev-v2` nao foi alterada.

### Validacoes
- `npx vitest run src/lib/procurar-datas/tempo-servico.test.ts --silent`: passou, 1 arquivo, 9 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/lib/procurar-datas/tempo-servico.ts src/lib/procurar-datas/tempo-servico.test.ts src/app/procurar-datas/page.tsx --quiet`: passou.
- `GET http://localhost:3000/procurar-datas`: HTTP 200, mas conteudo local era login; validacao manual autenticada dos selects e busca real nao confirmada.

### Pendencias
- Validar manualmente autenticado em `/procurar-datas`:
  1. selecionar apenas `4 PTS (DIVERSOS)` e confirmar `02:00`;
  2. selecionar `MAXX`, `SIM` em comoda e um roupeiro e confirmar calculo coerente;
  3. limpar selecoes e confirmar comportamento seguro;
  4. executar busca real simples e confirmar que o tempo enviado e o exibido.
- Auditoria UI/UX do legado permanece pendencia futura separada.

---

## 2026-06-24 - Codex - Frente 3/direita + Frente 2/meio: v2 como padrao em `/procurar-datas`

Status: implementado na tela principal. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking ou recorte.

### O que mudou
- A tela principal `src/app/procurar-datas/page.tsx` passou a usar por padrao:
  - `POST /api/procurar-datas/v2/pesquisar-compat-async`
  - `GET /api/procurar-datas/v2/progresso-compat`
- A query `?motor=v2` deixou de ser necessaria para a tela principal usar a v2.
- Nao foi criado fallback interno para o legado na tela principal.
- O legado operacional continua disponivel fora do app pela planilha antiga, conforme decisao de controle.
- `/procurar-datas/dev-v2` permanece separado para diagnostico interno.

### UI de resultados
- A tabela/lista principal passou a exibir `daysLeftTxt` na coluna "Faltam".
- A tabela/lista principal passou a exibir `encomenda` na coluna "Encomenda".
- Quando o campo nao vier no candidato, a tela mostra fallback visual `-`.
- O texto tecnico "Modo interno v2 ativo" foi removido da tela principal.
- O texto que indicava Apps Script como motor atual foi substituido por texto operacional neutro.

### Auditoria/logs
- Ja existe log da rota v2 com marcador `[PROCURAR_DATAS][v2/pesquisar-compat-async]`.
- Nao foi criado sistema novo de auditoria/provider nesta tarefa.

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/app/procurar-datas/page.tsx --quiet`: passou.
- HTTP local:
  - `GET /procurar-datas`: respondeu 200, mas sem sessao autenticada redirecionou/renderizou `/login` no Chrome headless.
  - `GET /procurar-datas?motor=v2`: respondeu 200, mas sem sessao autenticada redirecionou/renderizou `/login` no Chrome headless.
  - `GET /procurar-datas/dev-v2`: respondeu 200, mas sem sessao autenticada redirecionou/renderizou `/login` no Chrome headless.

### Pendencias
- Validacao manual autenticada ainda pendente:
  - abrir `/procurar-datas`;
  - executar busca real simples;
  - confirmar que nao precisa de `?motor=v2`;
  - confirmar exibicao de dias faltantes e encomenda;
  - abrir `/procurar-datas/dev-v2` autenticado e confirmar funcionamento visual.

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

## 2026-06-24 - Frente 0 / Controle: Santo Amaro validado apos correcao de coordenada do deposito

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

### Payload/entrada validada
- endereco: `Rua Santo Amaro, Água Verde, Curitiba, Paraná, 80620-220, Brasil`
- logradouro: `r. santo amaro`
- numero: `300`
- bairro: `agua verde`
- cidade: `curitiba`
- UF: `PR`
- coordenadas destino: `lat -25.4574104`, `lng -49.2753292`
- data inicial: `26/06/2026`
- tempo necessario: `2:05`
- condominio: `true`
- encomenda: `false`
- rural: `false`
- berco/cama: `DIVERSOS`
- comoda: `2 COMODAS`

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

### Conclusao
- A divergencia Santo Amaro foi causada por coordenada incorreta do deposito no banco/configuracao da v2.
- Apos corrigir `LAT DEPOSITO` e `LNG DEPOSITO` para a coordenada usada pelo legado, a v2 passou a retornar resultado funcionalmente equivalente ao legado nesse cenário.
- Nao houve alteracao de regra de negocio.
- O ajuste foi em configuracao operacional no banco.

---
## 2026-06-24 - Frente 1 / esquerda: comparacao logs legado vs v2 no delta 16/07 Santo Amaro

Status: diagnostico por leitura de codigo e logs existentes. Nao altera resultado final, classificacao, recorte, frontend, Apps Script, banco, schema ou migrations.

### Comparacao com logs legado atuais
- Logs legado mostram origem em `16/07` como `-25.493498, -49.276551` para `R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450`.
- Diagnostico v2 informado usa deposito `-25.4876648, -49.2692262`.
- Portanto, a diferenca de coordenada de origem e real nos dados comparados.
- A diferenca `/table` vs `/route` medida no diagnostico v2 informado e pequena: `9437m` vs `9458m`, diferenca de `21m`; nao explica a divergencia de aproximadamente `1km`.

### O que o legado chama de delta
- No codigo legado, `[CANDIDATO-BRUTO].delta` vem de `cand.delta`.
- `cand.delta` recebe `bestKm`.
- `bestKm` e calculado como menor `incKm` entre as posicoes de insercao.
- Para posicao final da rota, quando `next=null`, o calculo fica `incKm = prevNovoKm`, ou seja, `ultimo ponto -> destino`.
- Nos logs do 16/07, `NEARCHK` da Rua Nicanor mostra `10465m`, praticamente igual ao `delta=10.46km` do candidato bruto.
- Hipotese principal: o legado escolheu como melhor insercao a posicao final, usando `Rua Nicanor -> destino`; a v2 escolheu a insercao no inicio (`deposito -> destino -> agenda_89`) com `~9437m`.

### Origem legado vs origem v2
- A origem diferente pode alterar o delta da insercao no inicio da rota, porque muda os trechos `origem -> destino` e `origem -> agenda_89`.
- Mas, se o `delta=10.46km` legado for a insercao no fim (`Rua Nicanor -> destino`), a origem nao explica diretamente esse valor, pois a posicao final nao usa origem.
- Assim, origem diferente e fator relevante a quantificar, mas a coincidencia `delta=10.46km` com `NEARCHK` de Rua Nicanor e a evidencia mais forte.

### Diagnostico v2 ampliado
- A flag `diagnosticoDeltaSantoAmaro16Jul=true` passa a expor:
  - comparacao de delta da insercao inicial usando origem v2 e origem legado informada pelos logs;
  - `agenda_90`/Rua Nicanor, quando presente;
  - distancia OSRM `agenda_90 -> destino` e `destino -> agenda_90`;
  - diferenca de `agenda_90 -> destino` contra `10460m`.
- Essa ampliacao e somente diagnostica e nao alimenta a regra oficial.

### Pendencia restante
- Executar novamente o diagnostico real Santo Amaro com a flag para confirmar numericamente:
  - se `agenda90.routeAgenda90DestinoM` bate com `10465m`;
  - quanto a origem legado informada muda a insercao inicial;
  - qual candidato de insercao v2 fica mais proximo do legado.

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/lib/procurar-datas/motor/pesquisar-datas-v2.ts src/lib/procurar-datas/motor/diagnostico-delta-santo-amaro-16-jul.ts src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts --quiet`: passou.
- `npm run test -- src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts --silent`: passou, 1 arquivo, 4 testes.

---
## 2026-06-24 - Frente 1 / esquerda: diagnostico delta 16/07 ampliado com route vs table

Status: diagnostico ampliado. Nao altera resultado final, classificacao, recorte, frontend, Apps Script, frete, banco, schema ou migrations.

### O que mudou
- A flag `diagnosticoDeltaSantoAmaro16Jul=true` agora tambem ativa `incluirDetalhesInsercao`, para expor pontos da rota base v2 no diagnostico especifico.
- O diagnostico do 16/07 passa a expor:
  - pontos da rota base v2 com id/label, endereco e lat/lng;
  - `agenda_89` detalhado;
  - melhor insercao com ponto anterior, destino e proximo ponto detalhados;
  - comparativo diagnostico entre delta via OSRM `/table` e delta via OSRM `/route` por pares, quando a melhor insercao tem ponto anterior e proximo.
- O comparativo `/route` executa somente atras da flag diagnostica do 16/07 e nao alimenta o calculo oficial do v2.

### Contrato legado confirmado por leitura
- `CEP-CONFIG.gs:getDrivingKm` usa OSRM `/route/v1/driving` por par, com fallback para OSRM publico e depois Haversine.
- `CEP-CONFIG.gs:getDrivingKmBatch` tambem monta chamadas `/route/v1/driving` por par, em batch, e usa cache por coordenadas arredondadas a 4 casas.
- `CEP-APIBACK.gs` calcula `bestKm` somando `prev -> novo`, `novo -> next` e subtraindo `prev -> next`; insercao no fim usa apenas `prev -> novo`.
- Origem operacional no legado e deposito em dias de semana e casa da equipe aos sabados.

### Causa ainda nao identificada
- A causa da diferenca `9437m` vs `10460m` ainda nao foi confirmada sem a execucao real do payload Santo Amaro com a flag.
- Possiveis causas restantes: diferenca `/table` vs `/route`, cache/arredondamento 4 casas no legado, coordenadas diferentes, origem diferente, ordem diferente ou ponto de agenda diferente.

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/lib/procurar-datas/motor/pesquisar-datas-v2.ts src/lib/procurar-datas/motor/diagnostico-delta-santo-amaro-16-jul.ts src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts --quiet`: passou.
- Vitest especifico nao executou nesta sessao por `spawn EPERM` no sandbox; nao confirmado.

### Proximo passo
- Executar chamada real Santo Amaro com `diagnosticoDeltaSantoAmaro16Jul=true` e comparar `comparativoOsrmRouteTable.route.deltaM`, `comparativoOsrmRouteTable.table.deltaM` e `10460m`.

---

## 2026-06-24 - Frente 0 / Controle: tela de configuracao mostra banco como valor principal

Status: ajuste de UI concluido. Banco/Supabase e valor principal na tela `/configuracoes/procurar-datas`. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### O que mudou na tela
- O componente `ValorItem` agora aceita uma prop `valorAtivo` para renderizar o valor do banco como principal.
- `LinhaConfig` calcula `valorAtivo = item.valor_supabase ?? item.valor` e passa para `ValorItem`.
- Subtexto que mostrava `banco: X` foi removido.
- Quando banco e planilha divergem, a planilha aparece como referencia secundaria: `Planilha: X`.
- Inicio da edicao usa sempre o valor ativo do banco (`valorDbParaInput(valorAtivo, ...)`).
- Apos salvar, a tela ja reflete o valor do banco via atualizacao local de `valor_supabase` (`handleSalvo`) e recarrega configs/snapshot em `executarImportacao`.

### Critério visual atingido
- Se banco esta `9`, renderiza `9 km` como valor principal.
- Se planilha esta `8` e banco `9`, renderiza `9 km` + `Planilha: 8 km` em cinza.
- Badge `editado no banco` aparece apenas para chaves editaveis e divergentes.

### Arquivos alterados
- `src/app/configuracoes/procurar-datas/page.tsx` (apenas textos/logica de renderizacao, sem mudar salvamento/persistencia).

### Validacoes
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/app/configuracoes/procurar-datas/page.tsx --quiet`: passou.

---

## 2026-06-24 - Frente 1 / esquerda: diagnostico enxuto do delta 16/07 Santo Amaro

Status: diagnostico especifico criado e exposto via flag. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### Motivacao
- Ainda ha divergencia no `16/07`: v2 classifica como especial com delta `9437m`, legado espera premium com delta proximo de `10460m`.
- Diferenca aproximada: `1023m`.
- Diagnostico anterior (`diagnosticoResultadoTelaV2SantoAmaro`) e util, mas abrangente demais para isolar a causa exata do delta.

### Novo helper
- `src/lib/procurar-datas/motor/diagnostico-delta-santo-amaro-16-jul.ts`
- Retorna objeto pequeno com:
  - identificacao (data, equipe, destino, tempo)
  - config usada (kmMaxEntrePontosKm, limites, origem banco/Supabase)
  - rota base v2 (pontos, ordem original, ordem otimizada, criterio)
  - melhor insercao v2 (antes, depois, custos, delta, trechos)
  - todos os candidatos de insercao em tabela curta
  - filtro early legado aplicado
  - comparativo com delta legado esperado (`10460m`) e diferenca
  - classificacao v2 e recorte
  - hipoteses automáticas ordenadas
  - instrucoes de trechos do Apps Script para consultar
  - mini bloco do `24/07` (tipo especial, delta, motivo de exclusao, dependencia do 16/07 virar premium)

### Como ativar
- Rota: `POST /api/procurar-datas/v2/pesquisar-compat-async?diagnosticoDeltaSantoAmaro16Jul=true`
- Ou body: `{ ..., "diagnosticoDeltaSantoAmaro16Jul": true }`
- Tambem disponivel no progresso Redis salvo pelo `clientToken`.

### Integracao
- `PesquisarDatasV2Output` ganhou campo `diagnosticoDeltaSantoAmaro16Jul`.
- `pesquisarDatasV2` chama o helper quando a flag esta ativa.
- `orquestrarPesquisaV2ComPayloadLegado` repassa a flag.
- `progresso-compat-store.ts` aceita e persiste o diagnostico.
- `contratos.ts` incluiu `diagnosticoDeltaSantoAmaro16Jul` em `ProgressoPesquisa`.

### O que nao altera
- Nao muda resultado final da busca.
- Nao muda classificacao.
- Nao muda recorte.
- Nao muda OSRM/Haversine.
- Nao muda frete.
- Nao cria migration/schema.
- Nao altera banco.

### Pendencia
- Causa exata da diferenca de ~1km ainda nao confirmada. Proximo passo: comparar pontos/ordem/trechos OSRM reais do legado com o diagnostico v2.

---

## 2026-06-24 - Frente 0 / Controle: decisao de fonte oficial das configuracoes do motor

Status: decisao documentada e ajustes textuais leves na tela de configuracoes. Nao altera motor, regra de negocio, schema, migrations, Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte ou banco.

### Decisao operacional
- A fonte oficial operacional das configuracoes do motor `/procurar-datas` e o banco/Supabase (`procurar_datas_config`).
- A tela `/configuracoes/procurar-datas` deve refletir o valor efetivamente salvo e usado no banco.
- A planilha Google Sheets e fonte de importacao e referencia historica, nao fonte ativa do motor v2.
- Snapshots importados da planilha continuam uteis como historico e ponto de comparacao.

### Contexto que motivou a decisao
- Durante a investigacao Santo Amaro, o parametro `KM MAX ENTRE PONTOS` estava causando divergencia no filtro early Haversine.
- O banco tinha `7` (editado manualmente via tela apos importacao), enquanto a planilha tinha `8`.
- O legado le a planilha diretamente, entao usava `8`.
- A v2 prioriza o banco, entao usava `7`.
- Isso gerou descarte indevido de `25/07` pelo filtro early (10.99km > 10.5km).
- Apos corrigir o banco para `8`, o filtro passou a usar `limiteHaversineKm = 12`, e `25/07` voltou a ser elegivel.

### Ajuste de dados (ja realizado em tarefa anterior)
- UPDATE em `procurar_datas_config` para `KM MAX ENTRE PONTOS = '8'`.
- Auditoria registrada em `procurar_datas_config_auditoria`.
- Nenhuma alteracao de codigo, schema ou migration.

### Ajustes textuais na tela `/configuracoes/procurar-datas` (pequenos e seguros)
- Cabecalho: "Banco de dados (fonte oficial) com planilha como referencia.".
- Origem: "banco de dados interno (fonte oficial)".
- Resumo de comparacao: "Banco vs planilha".
- Badge: "editado no banco" (em vez de "editado no app").
- Loading: "Lendo configuracoes...".
- Importacao: textos reforcam que os valores sao importados para o banco.
- Nenhuma logica de salvamento, persistencia, schema ou importacao foi alterada.

### Pendencia de UX/UI futura
- Embora os textos agora deixem claro que o banco e a fonte oficial, a tela ainda exibe o valor da planilha como principal e o valor do banco como subtexto em caso de divergencia.
- Futuramente, recomenda-se inverter a hierarquia visual:
  - Valor principal: valor ativo do banco (usado pelo motor).
  - Valor secundario: valor da planilha (referencia).
  - Quando banco e planilha estiverem iguais: status "sincronizado".
  - Quando divergirem: status "divergente da planilha" com destaque para o valor do banco.
- Exemplo recomendado:
  - "Valor ativo / banco: 8 km"
  - "Planilha: 8 km"
  - status: "sincronizado"
- Em divergencia:
  - "Valor ativo / banco: 8 km"
  - "Planilha: 7 km"
  - status: "divergente da planilha"

### O que nao foi alterado
- Nenhuma regra de negocio.
- Nenhum codigo funcional do motor de busca.
- Nenhuma migration/schema.
- Nenhum dado do banco alterado nesta tarefa.
- Frontend: apenas textos/labels ajustados; logica de salvamento intacta.
- Apps Script, OSRM, Haversine, frete, classificacao, ranking, recorte: intactos.

### Investigacao Santo Amaro
- Continua pendente no ponto `16/07` premium, cuja causa de divergencia ainda nao foi confirmada como erro de implementacao.
- Nao marcar Santo Amaro como resolvido.

---

## 2026-06-24 - Frente 1 esquerda: filtro early legado no caminho real v2 Santo Amaro

Status: correcao parcial aplicada no motor v2 real. Nao altera frontend, Apps Script, rotas legado, banco, migrations, frete, ranking ou recorte.

### Diagnostico confirmado
- No Apps Script, o loop principal de `CEP-APIBACK.gs` aplica dois filtros antes do calculo de melhor insercao:
  - Haversine direto entre destino novo e pontos do slot; descarta quando a menor distancia reta excede `MAX_POINT_KM * 1.5`.
  - Ancora por menor distancia OSRM ponto -> destino; quando ha CEP da ancora e a distancia excede `MAX_POINT_KM + (MAX_EXTRA_PREMIUM / 1000)`, descarta o slot antes do delta.
- O caminho real v2 lido ainda calculava matriz/delta por slot sem esse descarte previo.

### Mudanca aplicada
- `calcularKmAdicionalRealControladoV2` passou a avaliar o filtro early legado em slots com pontos, usando `kmMaxEntrePontosKm` e `kmAdicionalMaxNaRotaPremiumM` vindos da config real.
- Quando o filtro descarta o slot, o mapa retorna `kmAdicionalNaRotaM: null` com origem `filtrado-early-legado-diagnostico`, evitando gerar candidato elegivel para aquela data/equipe.
- O detalhe por slot agora expoe `filtroEarlyLegado` com motivo, distancia reta, limite Haversine, distancia da ancora, limite premium da ancora e dados da ancora quando disponiveis.
- O diagnostico Santo Amaro passou a exibir o filtro real por data, em vez de marcar fixamente `aplicadoNaV2=false`.

### Santo Amaro
- `02/07`: causa confirmada no codigo como filtro early legado ausente no caminho v2. Com a correcao, slots que excedem o limite early deixam de alimentar candidato final.
- `16/07`: divergencia de delta/classificacao ainda nao foi confirmada como erro de implementacao por leitura local. O v2 classifica como premium se receber delta acima do limite especial; a causa do delta `9437m` vs legado informado `10.46km` segue pendente de comparacao com pontos/ordem/matriz reais.
- `24/07`: deve continuar especial se gerado antes do recorte; sua entrada final depende de `02/07` deixar de competir e de `16/07` nao ocupar o limite de especial.

### Validacoes
- `npm run test -- src/lib/procurar-datas/motor/calcular-km-adicional-real-controlado.test.ts src/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot.test.ts`: passou, 2 arquivos, 27 testes.
- `npm run test -- src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts src/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado.test.ts src/app/api/procurar-datas/v2/pesquisar-compat-async/route.test.ts`: passou, 3 arquivos, 17 testes.
- `npx tsc --noEmit --pretty false`: passou.

### Pendencias
- Executar o payload real autenticado Santo Amaro para confirmar o resultado final de tela apos o filtro.
- Comparar `16/07` com detalhes reais: pontos da rota base, ordem, melhor insercao, trechos OSRM e se o valor legado `10.46km` e delta de insercao ou distancia da ancora.

---

## 2026-06-23 - Frente 3 direita: modo interno v2 na tela real

### Resultado
- A tela real `/procurar-datas` ganhou modo interno controlado por query param + superadmin.
- `?motor=v2` sozinho nao ativa v2 para usuario normal.
- Superadmin sem query continua no legado.
- Superadmin com `/procurar-datas?motor=v2` usa as rotas v2 async simuladas ja existentes.

### Implementacao
- Arquivo alterado: `src/app/procurar-datas/page.tsx`.
- Query param lido no client: `motor=v2`.
- Superadmin identificado pelo mesmo padrao existente do projeto: Supabase Auth + `usuarios_permitidos.role === 'superadmin'`.
- Endpoints escolhidos no momento da busca:
  - legado: `/api/procurar-datas/pesquisar` + `/api/procurar-datas/progresso`;
  - v2 interno: `/api/procurar-datas/v2/pesquisar-compat-async` + `/api/procurar-datas/v2/progresso-compat`.
- Badge discreto exibido somente quando o modo interno v2 esta ativo.

### Validacoes
- MCP Supabase read-only confirmou `email`, `role` e `ativo` em `public.usuarios_permitidos`.
- `npx tsc --noEmit`: passou.
- `npx eslint src/app/procurar-datas/page.tsx`: passou.

### Limites
- Sem progresso parcial real; o modo v2 segue polling compativel simulado.
- Rotas v2 nao foram alteradas nem restringidas adicionalmente nesta tarefa.

### Validacao manual K13/K14/K15 na tela real (modo interno v2 ativo)
- Parametros usados: Berco/cama DIVERSOS, Comoda/Roupeiro/Poltrona/Painel Selecione, Encomenda nao, Area rural nao, Condominio nao, Tempo 00:40.
- K13 (Cornelius): 3 recomendadas (14/08 R$ 110, 15/08 R$ 170, 17/08 R$ 110), 0 outras opcoes. Passou.
- K14 (Sitio Cercado): 3 recomendadas (11/07 R$ 170, 13/07 R$ 110, 16/07 R$ 110), 1 outra opcao (02/07 R$ 210 especial). Passou.
- K15 (Mandirituba): 3 recomendadas (08/08 R$ 320, 15/08 R$ 320, 17/08 R$ 200), 1 outra opcao (14/07 R$ 400 premium). Passou.
- Nota: Validacoes anteriores podem ter assumido condominio=true; na tela real o teste correto foi condominio=false, o que explica divergencia de frete (R$ 60 a menos).
- Conclusao: K13/K14/K15 passaram na tela real em modo interno v2. A divergencia anterior de frete era explicada pelo parametro condominio=false, nao por bug.

---

## 2026-06-23 - Frente 3: rota paralela `pesquisar-compat`

### Resultado
- Criada rota manual `POST /api/procurar-datas/v2/pesquisar-compat`.
- A rota chama o orquestrador v2 -> PayloadCompacto legado com dependencias reais.
- Nao integra frontend, nao altera producao, nao altera Apps Script e nao substitui o legado.

### Protecao e runtime
- Protecao por `validarAcessoProcurarDatas`, mesmo padrao das rotas existentes.
- `runtime = nodejs`.
- `maxDuration = 60`, alinhado a `/api/procurar-datas/v2/pesquisar`.

### Validacoes
- `npx tsc --noEmit`: passou.
- `npx vitest run src/app/api/procurar-datas/v2/pesquisar-compat/route.test.ts`: passou, 2 testes.
- Testes obrigatorios de orquestrador, adaptador, frete por distKm e distKm deposito -> destino passaram.

### Validacao manual K13/K14/K15
- K13 (Cornelius): HTTP 200, 3 candidates, fretes preenchidos, OSRM oficial sem fallback.
- K14 (Sitio Cercado): HTTP 200, 4 candidates, distKm 9.776, fretes preenchidos, OSRM oficial sem fallback.
- K15 (Mandirituba): HTTP 200, 4 candidates, distKm 33.217, fretes preenchidos, OSRM oficial sem fallback.
- Rota pesquisar-compat validada como ferramenta paralela/manual.

### Pendencias
- Planejar preservacao do polling/progresso parcial do legado na v2 (Frente 4 futura).
- Resolver dupla leitura de config (otimizacao futura).
- Plug fallback OSRM publico/Haversine no caminho do orquestrador (pendencia conhecida).
- K14/K15 comparacao no comparador pendente por timeout do legado.

---

## 2026-06-23 - Frente 3 direita: polling compativel simulado (pesquisar-compat-async / progresso-compat)

### Resultado
- Criadas e validadas duas rotas v2 paralelas de polling compativel SIMULADO.
- `POST /api/procurar-datas/v2/pesquisar-compat-async`: inicia busca, executa orquestrador completo, salva estado no Redis, retorna clientToken.
- `GET /api/procurar-datas/v2/progresso-compat`: le estado do Redis por clientToken, retorna progresso.
- Nao integra frontend, nao altera producao, nao altera Apps Script, nao substitui legado.
- Polling SIMULADO: POST ja salva done antes de responder. Sem candidatos parciais.

### Protecao e runtime
- Ambas protegidas por `validarAcessoProcurarDatas`.
- POST: `runtime = nodejs`, `maxDuration = 60`.
- GET: `runtime = nodejs`.

### Redis
- Chave: `procurar-datas:v2:progress:{clientToken}`. TTL: 600s.
- Helper: `src/lib/procurar-datas/v2/progresso-compat-store.ts`.
- Falha graciosamente sem credenciais (no-op silencioso).

### Validacoes automatizadas
- `npx tsc --noEmit`: passou.
- `progresso-compat-store.test.ts`: 13 testes.
- `pesquisar-compat-async/route.test.ts`: 7 testes.
- `progresso-compat/route.test.ts`: 6 testes.
- Regressao: orquestrador (5) + adaptador (11) passaram.

### Validacao manual K13/K14/K15 (DevTools)
- K13 (Cornelius): POST 200 done, GET 200 done, 3 normais, 0 extras, fretes preenchidos, Redis real confirmado, durationMs ~13661.
- K14 (Sitio Cercado): POST 200 done, GET 200 done, 3 normais, 1 extra (especial), 4 candidates, Redis real confirmado, durationMs ~9972.
- K15 (Mandirituba): POST 200 done, GET 200 done, 3 normais, 1 extra (premium), 4 candidates, Redis real confirmado, durationMs ~7383.
- Rotas validadas como ferramentas paralelas/manuais.

### Pendencias
- Progresso parcial real e fase futura — nao implementado.
- Fallback OSRM configurado -> publico -> Haversine nao plugado neste caminho.
- Config duplicada entre pesquisarDatasV2 e orquestrador (otimizacao futura).
- maxDuration = 60 pode ser insuficiente em cenarios mais pesados.
- Redis/TTL precisa ser monitorado em usos mais longos.

---

## 2026-06-23 - Frente 2: orquestrador puro para PayloadCompacto legado

### Resultado
- Criado `orquestrarPesquisaV2ComPayloadLegado` em `src/lib/procurar-datas/motor`.
- O helper une busca v2 injetada, config injetada, `distKm` deposito -> destino, fretes por `distKm` e adaptador v2 -> legado.
- Nao cria rota, nao integra frontend e nao altera producao.

### Contrato
- Entrada: `PesquisarDatasRequest` e dependencias injetaveis (`pesquisarDatas`, `buscarConfig`, `buscarRota`, clock opcional).
- Saida: `ok`, `payload`, `avisos`, `diagnosticoMinimo`, `diagnosticoPayloadLegado` e `saidaV2`.
- `diagnosticoPayloadLegado` expoe origem de frete, quantidade de fretes montados e resultado de `distKm`.

### Validacoes
- `npx tsc --noEmit`: passou.
- `npx vitest run src/lib/procurar-datas/motor/orquestrar-pesquisa-v2-com-payload-legado.test.ts`: passou, 5 testes.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts`: passou, 11 testes.
- `npx vitest run src/lib/procurar-datas/motor/montar-fretes-legado-por-dist-km.test.ts`: passou, 3 testes.
- `npx vitest run src/lib/procurar-datas/motor/calcular-dist-km-deposito-destino.test.ts`: passou, 6 testes.

### Nao alterado
- Frontend, rotas, Apps Script, motor v2 de busca/candidatos, recorte, ranking, classificacao, OSRM produtivo, fallback Haversine, cache/geocoding, Supabase, banco e migrations.

### Pendencias
- Risco conhecido de dupla leitura de config: `pesquisarDatasV2` busca config internamente e o orquestrador recebe config para frete.
- Fallback completo do legado para distancia/frete ainda nao foi implementado.
- Integracao em rota paralela ou fluxo compat segue pendente.

---

## 2026-06-23 - Frente 2: fretes legados a partir de `distKm`

### Resultado
- Criado helper puro `montarFretesLegadoPorDistKm`.
- O helper consome `distKm` deposito -> destino ja calculado e monta `FreteCandidatoLegadoInput[]` para o adaptador v2 -> legado.
- O helper reutiliza `calcularFrete` real, incluindo sabado por data do candidato, flags rural/condominio e adicionais por tipo.

### Validacao no adaptador
- K13, K14 e K15 no teste do adaptador agora usam fretes gerados a partir de `distKmDepositoDestino`, nao valores soltos.
- Cenario sem frete/distKm continua retornando `frete: ''` e aviso.
- `kmAdicionalNaRotaM` segue sem influencia no frete.

### Validacoes realizadas
- `npx tsc --noEmit`: passou.
- `npx vitest run src/lib/procurar-datas/motor/montar-fretes-legado-por-dist-km.test.ts`: passou, 3 testes.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts`: passou, 11 testes.

### Nao alterado
- Nenhuma rota, frontend, Apps Script, OSRM, Haversine, cache/geocoding, Supabase, banco, motor de busca/candidatos, ranking, classificacao ou recorte final.

### Pendencia
- Ainda falta uma orquestracao futura que una o calculo de `distKm` deposito -> destino ao helper de frete antes de chamar o adaptador.

---

## 2026-06-23 - Frente 1: helper isolado para `distKm` de frete legado

### Resultado
- Definido e testado, sem integracao produtiva, o caminho para obter `distKm` deposito -> destino a partir de OSRM `/route`.
- O helper novo reaproveita o contrato do cliente OSRM existente via funcao injetada, mantendo os testes sem rede.
- Unidade confirmada: OSRM retorna metros; frete legado espera km.

### Arquivos criados
- `src/lib/procurar-datas/motor/calcular-dist-km-deposito-destino.ts`
- `src/lib/procurar-datas/motor/calcular-dist-km-deposito-destino.test.ts`

### Contrato do helper
- Entrada: `latDeposito/lngDeposito`, coordenada de destino e `buscarRota`.
- Saida de sucesso: `distM`, `distKm`, origem deposito, destino e `origemDistancia = osrm-route-deposito-destino`.
- Saida de erro: `distKm: null`, `distM: null` e lista de erros.

### Validacoes realizadas
- `npx tsc --noEmit`: passou.
- `npx vitest run src/lib/procurar-datas/motor/calcular-dist-km-deposito-destino.test.ts`: passou, 6 testes.
- `npx vitest run src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts`: passou, 12 testes.

### Nao alterado
- Adaptador v2 -> legado, frontend, rotas `/api/procurar-datas/*`, Apps Script, motor de candidatos, ranking, classificacao, recorte, cache/geocoding, Supabase, banco e migrations.

### Pendencias
- Integrar futuramente o helper ao ponto que calcula/injeta frete no payload compat legado.
- Decidir se a camada de uso deve reproduzir o fallback completo do Apps Script (`OSRM configurado -> OSRM publico -> Haversine`) ou tratar falha explicitamente antes de expor frete.

## 2026-06-23 - Validacao offline do adaptador v2 para legado

Status: validado com fixtures offline K13/K14/K15. Nao integrado a frontend, rotas ou motor v2.

### O que foi confirmado
- O adaptador converte fixtures fieis da v2 para `PayloadCompactoCompatLegado`.
- K13: 3 normais adaptados.
- K14: especial anterior as 3 normais adaptado.
- K15: premium anterior a ultima normal adaptado.
- Campos obrigatorios consumidos pelo frontend (`candidates`, datas, equipe, tipo, frete, params e metadados) ficaram cobertos em teste.
- Dados suficientes para montar `cand/meta` do pre-agendamento foram validados em teste.

### Frete/distKm
- Confirmado no codigo legado que `distKm` vem de `getDrivingKm(depositoLoc, locNovo)`.
- Confirmado no codigo v2 que `PesquisarDatasV2Output` nao expoe `distKm` deposito -> destino.
- O adaptador continua sem calcular frete por `kmAdicionalNaRotaM`; quando frete nao e fornecido, retorna string vazia e aviso.

### Ajuste aplicado
- O adaptador passou a preservar `rank` da v2 quando valido, usando a posicao apenas como fallback.
- Testes do adaptador foram ampliados de 6 para 10 cenarios.

### Validacoes
- `npx tsc --noEmit` passou sem erros.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts` passou: 1 arquivo, 10 testes.

### Pendencia
- Frete real ainda precisa de um caminho seguro para fornecer `distKm` deposito -> destino ao adaptador.

---

## 2026-06-23 - Adaptador isolado v2 para contrato legado

Status: implementado como helper puro. Nao integrado a frontend, rotas de producao ou rota v2.

### Arquivos criados
- `src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.ts`
- `src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts`

### O que o helper faz
- Recebe `PesquisarDatasV2Output` e o request original.
- Monta `PayloadCompactoCompatLegado` com campos compativeis com `PayloadCompacto`.
- Converte candidatos v2 finais para candidatos legados com `dateISO` no formato `legado-gmt3` por padrao, `date`, `dateDM`, `weekday`, `daysLeftTxt`, `team`, `tipo`, `isExtra`, `rank`, `frete` e `avisoHoraMarcada`.
- Monta metadados de payload com dados disponiveis do request e metadados opcionais: `cep`, `tempo`, `label`, `address`, `addressShort`, `startFromISO`, `startFromDM`, `params` e `searchTime`.

### Decisao sobre frete
- O helper nao calcula frete a partir de `kmAdicionalNaRotaM`.
- Frete no legado usa `distKm` deposito -> destino e parametros de frete; `kmAdicionalNaRotaM` e outra metrica.
- O helper aceita fretes pre-calculados/injetados por candidato. Se ausentes, retorna `frete: ''` e registra aviso.

### Validacoes
- `npx tsc --noEmit` passou sem erros.
- `npx vitest run src/lib/procurar-datas/motor/adaptar-saida-v2-para-legado.test.ts` passou: 1 arquivo, 6 testes.

### Nao alterado
- Frontend, Apps Script, rotas legadas, rota `/api/procurar-datas/v2/pesquisar`, comparador, motor de busca, classificacao, ranking, recorte final, OSRM, Haversine, Supabase, banco e migrations.

### Pendencias
- Integracao do helper em rota compat ou fluxo controlado ainda nao feita.
- Frete real ainda precisa ser fornecido por caminho seguro com `distKm` correto.
- Polling/progresso legado ainda nao foi simulado na v2.

---

## 2026-06-23 - Typecheck dos testes do motor procurar-datas corrigido

Status: concluido. Nao altera producao.

### Problema
`npx tsc --noEmit` falhava com 4 erros pre-existentes em testes:
- `adaptador-candidato-legado.test.ts`
- `adaptar-candidatos-reais-legado.test.ts`
- `ordenacao-candidatos.test.ts`
- `osrm-route-client-diagnostico.test.ts`

### Diagnostico
- Tres erros eram fixtures sinteticas de `CandidatoPreliminarV2` sem o campo obrigatorio `limites`.
- Um erro era mock parcial de `Response` convertido diretamente para `Response`.
- Nao foi confirmado bug real no motor.

### Correcao
- Fixtures dos testes passaram a preencher `limites` com valores default.
- Fixtures passaram a manter `diagnostico.classificacaoTipo` e `diagnostico.classificacaoElegivel` coerentes com overrides.
- Mock parcial de `Response` passou a usar cast via `unknown`.

### Validacoes
- `npx tsc --noEmit` passou sem erros.
- `adaptador-candidato-legado.test.ts`: 45 testes passaram.
- `adaptar-candidatos-reais-legado.test.ts`: 30 testes passaram.
- `ordenacao-candidatos.test.ts`: 25 testes passaram.
- `osrm-route-client-diagnostico.test.ts`: 12 testes passaram.

### Nao alterado
Nao houve alteracao em regra de negocio, helpers de producao, Apps Script, frontend, rotas, comparador, timeout, OSRM, Haversine, cache/geocodificacao, Supabase, classificacao, ranking ou recorte final.

---

## 1. Objetivo do documento

Este documento registra o estado atual do motor v2 da tela `/procurar-datas`, incluindo:

- Helpers puros criados
- Cadeia diagnóstica implementada
- Validações manuais realizadas
- Pontos ainda sintéticos
- Próximos passos recomendados

**Não é** documentação de API, nem substitui a leitura direta do código-fonte.

---

## 2. Escopo atual do motor v2

O motor v2 atual é **apenas diagnóstico** e **não está em produção**.

- Rota: `POST /api/procurar-datas/v2/diagnostico`
- Modo: isolado, sem afetar produção
- Fonte de dados: sintética (não consulta agenda real)
- Objetivo: demonstrar a cadeia de cálculos futura de forma segura

**Não substitui** o Apps Script legado nem a rota `/api/procurar-datas/pesquisar`.

---

## 3. Arquivos principais

### Helpers puros (motor v2)

| Arquivo | Função principal | Responsabilidade |
|---------|------------------|------------------|
| `src/lib/procurar-datas/motor/entrada.ts` | `normalizarEntradaPesquisaV2()` | Normaliza payload da pesquisa para estrutura limpa |
| `src/lib/procurar-datas/motor/tempo.ts` | `parseMinutos()`, `formatarMinutos()` | Conversões de tempo (HH:MM ↔ minutos) |
| `src/lib/procurar-datas/motor/equipe.ts` | `normalizarEquipe()` | Normaliza strings de equipe (EQUIPE 1, EQUIPE 2) |
| `src/lib/procurar-datas/motor/distancia.ts` | `haversine()`, `haversineKm()` | Cálculo de distância geodésica (Haversine) |
| `src/lib/procurar-datas/motor/frete.ts` | `calcularFreteBase()` | Cálculo de frete baseado em distância e flags |
| `src/lib/procurar-datas/motor/datas.ts` | `diffDias()`, `adicionarDias()` | Operações puras de data |
| `src/lib/procurar-datas/motor/janela-datas.ts` | `gerarJanelaDatasPesquisaV2()` | Gera janela cronológica de datas com flags |
| `src/lib/procurar-datas/motor/disponibilidade.ts` | `filtrarDisponibilidadePorJanelaV2()` | Filtra/enriquece disponibilidade por equipe/data |
| `src/lib/procurar-datas/motor/classificacao-candidato.ts` | `classificarCandidatoOperacionalV2()` | Classifica cenário em normal/especial/premium/hora-marcada/indisponivel |
| `src/lib/procurar-datas/motor/candidato.ts` | `montarCandidatoPreliminarV2()` | Monta candidato preliminar v2 a partir de classificação |
| `src/lib/procurar-datas/motor/ordenacao-candidatos.ts` | `ordenarCandidatosDiagnosticosV2()` | Ordena candidatos preliminares por prioridade diagnóstica |
| `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts` | `adaptarCandidatoV2ParaContratoLegadoDiagnostico()` | Adapta CandidatoPreliminarV2 para o formato do contrato legado (diagnóstico) |
| `src/lib/procurar-datas/motor/parse-disponibilidade-tempo-disponivel.ts` | `parsearDisponibilidadeTempoDisponivelV2()` | Parser puro de linhas brutas da planilha TEMPO DISPONIVEL → DisponibilidadeEquipeDataV2[]. Aceita `DD/MM/YYYY`, `DD/MM` e `DD/MM (dia-da-semana)`. Para datas sem ano, infere o ano a partir de `dataInicialISO` com virada automática. |
| `src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.ts` | `gerarCandidatosComDisponibilidadeRealV2()` | Orquestra a cadeia de helpers puros: filtro de disponibilidade → classificação → montagem → ordenação. Recebe `DisponibilidadeEquipeDataV2[]` já parseada e retorna `CandidatoPreliminarV2[]` ordenados. Diagnóstico. Não lê planilha, não chama OSRM, Apps Script, Supabase ou Google Calendar. Integrado à rota `/v2/diagnostico` apenas no bloco opcional `diagnosticoCandidatosDisponibilidadeReal`. |
| `src/lib/procurar-datas/motor/aplicar-mapa-km-adicional-por-slot-em-candidatos.ts` | `aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2()` | **Diagnóstico / Frente 2.** Recebe lista de candidatos diagnósticos e `mapaKmAdicionalPorSlot`. Para cada candidato, resolve `dataISO` + `equipe`, normaliza equipe (strip de sufixo `(sintético)` antes de `normalizarEquipe`), monta `slotKey = ${dataISO}::${equipeNormalizada}`. Se `mapa[slotKey]` for número finito: aplica `kmAdicionalNaRotaM`, marca `kmAdicionalAplicadoPorMapaSlot: true`, `origemKmAdicionalNaRotaM: 'mapa-slot-diagnostico'`. Se não houver chave ou valor for null: mantém original, `'sem-chave-no-mapa'`. Se sem data/equipe válida: mantém original, `'sem-data-equipe'`. Preserva todos os demais campos. `kmAdicionalNaRotaDiagnosticoM` nunca é parâmetro — isolamento garantido por interface. 18 testes unitários. |
| `src/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot.ts` | `calcularMapaKmAdicionalPorSlotControladoV2()` | **Diagnóstico / Frente 2.** Recebe lista de slots `{dataISO, equipe, linhasAgenda?, cache?}`, destino e configOrigem. Para cada slot chama `calcularKmAdicionalRealControladoV2` (origem operacional + agenda + OSRM /table + fallback Haversine P3 + descarte silencioso P4). Retorna `mapa: Record<string, number | null>` com chave `${dataISO}::${equipeNormalizada}`, `detalhesPorSlot`, `contadores` e logs auditáveis. Slots com dataISO vazia ou equipe inválida descartados explicitamente. `kmAdicionalNaRotaDiagnosticoM` nunca é parâmetro — isolamento garantido por interface. 16 testes unitários. |
| `src/lib/procurar-datas/motor/adaptar-candidatos-reais-legado.ts` | `adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2()` | Transforma `CandidatoPreliminarV2[]` ordenados em amostra compatível com o contrato legado diagnóstico. Usa `legado-gmt3` por padrão. Delega integralmente ao adapter existente. Respeita `limiteAmostra`. Inclui candidatos indisponíveis. Diagnóstico. Não integrado a nenhuma rota. |
| `src/lib/procurar-datas/motor/parse-agenda-shag.ts` | `parsearPontosAgendaDoDiaV2()` | Parser puro de linhas brutas da planilha AGENDA (shAg) → `PontoAgendaV2[]`. Reproduz fielmente `coletarPontosDoDia()` do CEP-CONFIG.gs: filtra por data e equipe normalizada, extrai endereço da coluna 6 ou fallback regex em coluna 5, extrai CEP. Coordenadas injetadas via `cacheCoordenadasPorEndereco` (sem geocoding). Retorna pontos válidos, descartados com motivo claro, avisos e resumo. Não faz I/O. Não integrado a rota. Preparatório para futuro cálculo de `kmAdicionalNaRotaM`. |
| `src/lib/procurar-datas/motor/calcular-delta-insercao-rota.ts` | `calcularDeltaInsercaoRotaDiagnosticoV2()` | **Diagnóstico / aproximação.** Calcula o melhor ponto de inserção de um novo destino em uma rota existente, usando Haversine como aproximação. Não usa OSRM. Não deve ser usado em produção. Recebe origem, destino e pontos da agenda filtrados. Retorna `kmAdicionalNaRotaM` em metros, detalhes da melhor inserção, resumo e avisos. Pontos sem coordenada são descartados explicitamente. Se agenda vazia, considera rota simples origem → destino. Inserção no fim aberto (sem retorno ao depósito). Contrato preparatório para estruturar `kmAdicionalNaRotaM`. Não integrado a rota. |
| `src/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda.ts` | `diagnosticarKmAdicionalAgendaV2()` | **Diagnóstico / orquestrador.** Compõe `parsearPontosAgendaDoDiaV2` + `calcularDeltaInsercaoRotaDiagnosticoV2` em um único pipeline puro. Recebe linhas brutas da agenda (shAg mockada/por input), data, equipe, origem, destino e cache de coordenadas. Normaliza equipe internamente. Retorna `kmAdicionalNaRotaM` em metros, `origemKmAdicionalNaRotaM` (`'agenda-shag-haversine-diagnostico'` ou `null`), resumos auditáveis do parse e do delta, avisos consolidados com prefixo de origem, e descartes diferenciados (`parse-agenda` vs `delta-insercao`). Não usa OSRM. Não deve ser usado em produção. Integrado apenas na rota diagnostica `/v2/diagnostico` com fixture/controlado e flag `usarKmAdicionalAgendaDiagnostico`. |
| `src/lib/procurar-datas/motor/calcular-delta-insercao-matriz.ts` | `calcularDeltaInsercaoRotaComMatrizDiagnosticoV2()` | **Diagnóstico / injeção de distância.** Calcula o melhor ponto de inserção de um destino em uma rota usando **função de distância injetada** (`calcularDistanciaM: (de, para) => number \| null`). Lógica de inserção idêntica ao helper Haversine (início, meio, fim aberto). **Não usa Haversine internamente.** Não chama OSRM real. Trata distâncias inválidas (null, negativo, NaN, Infinity) por inserção — insercão ignorada, não quebra o cálculo. Se todas as inserções forem inválidas: `ok=false`, `kmAdicionalNaRotaM=null`. Agenda vazia com função válida retorna `ok=true` (rota simples). Agenda vazia com função inválida retorna `ok=false`. Output inclui campo `erros` e `resumo` estendido com `quantidadeDistanciasCalculadas`/`Invalidas`. Prepara contrato para OSRM controlado futuro. Não deve ser usado em produção. Não integrado a nenhuma rota. **Decisão P2 CONCLUÍDA (2026-06-17):** v2 usará OSRM `/table` para matriz em lote na Frente 2. Equivalência `/route` vs `/table` validada em P1 (delta 1m/0.01%). Fallback em falha segue P3 (Haversine silencioso). |
| `src/lib/procurar-datas/motor/resolver-origem-operacional.ts` | `resolverOrigemOperacionalV2()` | **Frente 1 / base de origem.** Resolve a origem operacional (coordenadas) para uma data e equipe. Regras do legado: dias úteis → depósito; sábado → casa da equipe correspondente. Retorna `{ok: true, origem: {lat, lng}, tipo: 'deposito'|'casa-e1'|'casa-e2'}` ou `{ok: false, erro, origem: null}`. Sem fallback silencioso — erro explícito se coordenada ausente ou inválida. 25 testes unitários. Não integrado a candidatos/classificação ainda. **Validado (2026-06-17):** testes passaram, typecheck sem erros novos. **Validação MCP Supabase concluída:** 6 chaves de coordenadas OK, 6 chaves P11 OK. **Auditoria P3 CONCLUÍDA (2026-06-17) — OPÇÃO A APROVADA:** legado usa Haversine silencioso como fallback OSRM em `getDrivingKm` e `getDrivingKmBatch`; `bestKm` de classificação pode ser Haversine; nunca retorna null; sem flag de fallback. **Decisão aprovada: Opção A — replicar o legado.** v2 deve usar OSRM oficial quando disponível; Haversine fallback silencioso quando OSRM falha. Fallback pode alimentar `kmAdicionalNaRotaM` real e afetar classificação, como no legado. Não retornar `null` nem descartar candidato por falha OSRM. Logs/diagnóstico de fallback permitidos como melhoria sem alterar regra de negócio. O helper `calcularDeltaInsercaoRotaComMatrizDiagnosticoV2` atual retorna `ok:false` explícito — comportamento diferente do legado; deve ser ajustado na Frente 2 para replicar legado.

**Auditoria P4 CONCLUÍDA (2026-06-17):** legado confirma tratamento de pontos sem coordenada em `coletarPontosDoDia` (CEP-CONFIG.gs:1596). Pontos que falham geocoding (`ResolverEnderecoComCache_` retorna `{ok: false}`) são **descartados silenciosamente** — não entram no array `pts`. Rota calculada apenas com pontos que têm coordenadas. Não tenta geocodificar novamente, não usa última coordenada conhecida, não substitui por depósito/casa. Log de erro registrado (`[PTS][ERRO] geocode falhou`). Comportamento igual para todos os tipos. v2 deve replicar: descartar silenciosamente pontos sem coordenada na montagem da matriz OSRM.

**Implementação 2026-06-18 — Leitura automática da AGENDA (shAg):** Criado helper `buscarAgendaRealDiagnosticaComDados` (`src/lib/procurar-datas/motor/agenda-real-helper.ts`) para leitura da planilha AGENDA do Google Sheets (gid 1324794210, mesma aba do legado). Nova flag `usarAgendaRealDiagnostica` adicionada à rota `/api/procurar-datas/v2/diagnostico`. Quando ativa junto com `usarDisponibilidadeRealDiagnostica` e `usarKmAdicionalRealControladoDiagnostico`, a rota lê a agenda real automaticamente e a utiliza para calcular `kmAdicionalNaRotaM` via OSRM `/table` + fallback Haversine, sem exigir `linhasAgendaDiagnostica` manual. Testes da rota: 82 passaram.

**Implementação 2026-06-19 — Ajuste de classificação para equivalência legado:** Ajustado `classificarCandidatoOperacionalV2` para não bloquear classificação normal/especial/premium por `distanciaKm` ausente quando `kmAdicionalNaRotaM` é válido. O legado Apps Script usa apenas `bestKm` (equivalente a `kmAdicionalNaRotaM`) para classificar, sem validar `distanciaKm` antes. A v2 agora:
- Torna `distanciaKm` opcional (avisa mas não bloqueia)
- Remove validação de limite máximo semana/sábado baseada em `distanciaKm` quando ausente
- Preserva validação de `kmAdicionalNaRotaM` (obrigatório)
- Preserva limites base/especial/premium
- Testes: 71 passaram (incluindo 5 novos testes de equivalência legado)

**Implementação 2026-06-19 — Mapa por slot automático para candidatos reais:** Implementado cálculo automático de mapa de `kmAdicionalNaRotaM` por slot (dataISO::equipe) quando `usarAgendaRealDiagnostica` está ativo. A v2 agora:
- Gera slots automaticamente a partir da disponibilidade real
- Calcula mapa por slot usando `calcularMapaKmAdicionalPorSlotControladoV2`
- Aplica km específico de cada slot aos candidatos reais via `gerarCandidatosComDisponibilidadeRealV2`
- Equivalência com legado: cada candidato recebe `bestKm` específico do seu slot, não um valor global
- Testes: 34 passaram (gerar-candidatos-disponibilidade-real.test.ts), 82 passaram (route.test.ts)

### Rota diagnóstica

| Arquivo | Rota | Responsabilidade |
|---------|------|------------------|
| `src/app/api/procurar-datas/v2/diagnostico/route.ts` | `POST /api/procurar-datas/v2/diagnostico` | Orquestra cadeia diagnóstica completa. Aceita `usarDisponibilidadeRealDiagnostica` para incluir bloco de disponibilidade real. |

### Serviço de configuração

| Arquivo | Função principal | Responsabilidade |
|---------|------------------|------------------|
| `src/lib/procurar-datas/config-service.ts` | `carregarConfigProcurarDatas()` | Carrega config com fallback para planilha |

### Contratos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/procurar-datas/contratos.ts` | Tipos de entrada/saída das rotas |

---

## 4. Cadeia diagnóstica atual

```
entrada (PesquisarDatasRequest)
  ↓
normalizarEntradaPesquisaV2()
  ↓
config (config-service)
  ↓
distância/frete diagnóstico (Haversine + calcularFreteBase)
  ↓
gerarJanelaDatasPesquisaV2()
  ↓
filtrarDisponibilidadePorJanelaV2() [sintético]
  ↓
classificarCandidatoOperacionalV2() [sintético]
  ↓
montarCandidatoPreliminarV2() [com frete vinculado]
  ↓
ordenarCandidatosDiagnosticosV2()
  ↓
diagnóstico JSON completo
```

---

## 5. Helpers criados

### 5.1 `entrada.ts` — `normalizarEntradaPesquisaV2()`

- **Responsabilidade:** Transforma `PesquisarDatasRequest` em `EntradaPesquisaV2` normalizada
- **O que não faz:** Não consulta planilha, Supabase, Apps Script, OSRM, Google Calendar
- **Testes:** 19 testes em `entrada.test.ts`

### 5.2 `tempo.ts` — `parseMinutos()`, `formatarMinutos()`

- **Responsabilidade:** Converte HH:MM ↔ minutos (porta fiel do Apps Script)
- **O que não faz:** Não depende de Utilities.formatDate ou Apps Script
- **Testes:** 31 testes em `tempo.test.ts`

### 5.3 `equipe.ts` — `normalizarEquipe()`

- **Responsabilidade:** Normaliza strings de equipe (EQUIPE 1, EQUIPE 2)
- **O que não faz:** Não consulta planilha ou Supabase
- **Testes:** 26 testes em `equipe.test.ts`

### 5.4 `distancia.ts` — `haversine()`, `haversineKm()`

- **Responsabilidade:** Cálculo de distância geodésica (Haversine)
- **O que não faz:** Não substitui OSRM do legado
- **Testes:** 14 testes em `distancia.test.ts`

### 5.5 `frete.ts` — `calcularFreteBase()`

- **Responsabilidade:** Cálculo de frete baseado em distância e flags (rural, sábado, condomínio)
- **O que não faz:** Não consulta planilha, não aplica ajuste +20% (isso é feito na rota)
- **Testes:** 51 testes em `frete.test.ts`

### 5.6 `datas.ts` — `diffDias()`, `adicionarDias()`

- **Responsabilidade:** Operações puras de data (diferença em dias, adicionar dias)
- **O que não faz:** Não depende de Utilities.formatDate ou Apps Script
- **Testes:** 13 testes em `datas.test.ts`

### 5.7 `janela-datas.ts` — `gerarJanelaDatasPesquisaV2()`

- **Responsabilidade:** Gera janela cronológica de datas com flags de sábado/domingo
- **O que não faz:** Não consulta agenda, disponibilidade, ranking, OSRM, Supabase, Apps Script
- **Testes:** 16 testes em `janela-datas.test.ts`

### 5.8 `disponibilidade.ts` — `filtrarDisponibilidadePorJanelaV2()`

- **Responsabilidade:** Filtra/enriquece disponibilidade por equipe/data dentro da janela
- **O que não faz:** Não consulta agenda real (usa dados sintéticos)
- **Testes:** 19 testes em `disponibilidade.test.ts`

### 5.9 `classificacao-candidato.ts` — `classificarCandidatoOperacionalV2()`

- **Responsabilidade:** Classifica cenário em normal/especial/premium/hora-marcada/indisponivel
- **O que não faz:** Não consulta agenda real, não gera candidatos finais
- **Testes:** 35 testes em `classificacao-candidato.test.ts`

### 5.10 `candidato.ts` — `montarCandidatoPreliminarV2()`

- **Responsabilidade:** Monta candidato preliminar v2 a partir de classificação
- **O que não faz:** Não gera candidatos finais, não aplica ranking, não calcula score
- **Testes:** 22 testes em `candidato.test.ts`

### 5.11 `ordenacao-candidatos.ts` — `ordenarCandidatosDiagnosticosV2()`

- **Responsabilidade:** Ordena candidatos preliminares por prioridade diagnóstica
- **O que não faz:** Não é ranking final de produção, não cria score numérico
- **Testes:** 26 testes em `ordenacao-candidatos.test.ts`

### 5.13 `parse-disponibilidade-tempo-disponivel.ts` — `parsearDisponibilidadeTempoDisponivelV2()`

- **Responsabilidade:** Converte linhas brutas da planilha TEMPO DISPONIVEL para `DisponibilidadeEquipeDataV2[]`
- **Formato confirmado de entrada:** `DATA = DD/MM/YYYY | DD/MM | DD/MM (dia-da-semana)`, `EQUIPE = Equipe 1/Equipe 2`, `TEMPO DISPONÍVEL = HH:MM`, `STATUS = disponível/agenda fechada/excedeu`. Para `DD/MM` e `DD/MM (texto)`, o ano é inferido via `dataInicialISO` (YYYY-MM-DD); se a data candidata ficar anterior à referência, avança automaticamente para o próximo ano.
- **O que não faz:** Não lê planilha, não chama Apps Script, Supabase, OSRM, Google Calendar ou banco; não cria rota
- **Testes:** 54 testes em `parse-disponibilidade-tempo-disponivel.test.ts`

### 5.12 `adaptador-candidato-legado.ts` — `adaptarCandidatoV2ParaContratoLegadoDiagnostico()`

- **Responsabilidade:** Converte `CandidatoPreliminarV2` para o formato `CandidatoLegadoDiagnosticoV2` (compatível estruturalmente com `CandidatoFinal` do legado), com campo extra `diagnosticoV2` para rastreabilidade
- **Escopo:** Exclusivamente diagnóstico — não integrado em produção
- **O que não faz:** Não consulta Apps Script, OSRM, Supabase, Google Calendar, agenda, planilha; não calcula ranking; não recalcula frete; não muta input
- **Mapeamento implementado:** `dateISO`, `dateDM`, `weekday`, `tipo`, `isExtra`, `frete`, `rank`, `team`, `daysLeftTxt`, `encomenda`, `avisoHoraMarcada`, `diagnosticoV2`
- **Formato de `dateISO`:** por padrão continua `v2` (`YYYY-MM-DD`). Opcionalmente aceita `formatoDateISO: "legado-gmt3"` para emitir `YYYY-MM-DDT03:00:00.000Z`, padrão observado nas fixtures reais capturadas. A montagem é determinística por string, sem depender de timezone do runtime.
- **Diferenças documentadas:** `dateISO` pode usar YYYY-MM-DD (v2) ou ISO completo com T03:00:00.000Z (legado-gmt3); `encomenda` fixo em "Não" até v2 modelar encomenda; `isExtra` para `hora-marcada` inferido (não confirmado em fixture)
- **Testes:** 45 testes em `adaptador-candidato-legado.test.ts` — incluem cobertura baseada nas fixtures reais capturadas e formato legado-gmt3

---

## 6. Blocos do response da rota diagnóstica v2

### 6.1 `entradaNormalizada`

- **Finalidade:** Mostra entrada normalizada pelo motor v2
- **Status:** ✅ Funcional
- **Campos:** cep, temEnderecoCompleto, dataInicialISO, tempoNecessarioTexto, tempoNecessarioMin, temEnderecoMinimo, temCoordenadasOrigemInformada, isRural, isCondominio, avisos

### 6.2 `diagnosticoFrete`

- **Finalidade:** Diagnóstico de distância e frete usando Haversine
- **Status:** ✅ Funcional
- **Campos:** executado, tipoDistancia, distanciaKm, frete (valor, valorFormatado, faixaAplicada), avisos
- **Nota:** Não substitui OSRM do legado

### 6.3 `diagnosticoJanelaDatas`

- **Finalidade:** Gera janela cronológica de datas
- **Status:** ✅ Funcional
- **Campos:** executado, diasSolicitados, quantidadeGerada, primeiraDataISO, ultimaDataISO, avisos, amostra

### 6.4 `diagnosticoDisponibilidade`

- **Finalidade:** Filtra/enriquece disponibilidade por equipe/data (sintético)
- **Status:** ✅ Funcional
- **Campos:** executado, quantidadeDatas, quantidadeDatasComEquipe, quantidadeEquipesComRegistro, quantidadeEquipesAtivas, quantidadeEquipesSuficientes, quantidadeEquipesInativas, quantidadeEquipesInsuficientes, tempoNecessarioMin, resultado, avisos, amostra
- **Nota:** Dados sintéticos, não refletem agenda real

### 6.5 `diagnosticoClassificacao`

- **Finalidade:** Classifica cenários operacionais (sintético)
- **Status:** ✅ Funcional
- **Campos:** executado, quantidadeCenariosClassificados, quantidadeElegiveis, quantidadeIndisponiveis, quantidadeNormal, quantidadeEspecial, quantidadePremium, quantidadeHoraMarcada, quantidadeComMotivos, quantidadeComAvisos, avisos, amostra
- **Nota:** Usa kmAdicionalNaRotaM sintético, não reflete cenário real

### 6.6 `diagnosticoCandidatos`

- **Finalidade:** Monta candidatos preliminares v2 a partir de classificações
- **Status:** ✅ Funcional
- **Campos:** executado, freteVinculado, quantidadeCandidatosMontados, quantidadeElegiveis, quantidadeIndisponiveis, quantidadeNormal, quantidadeEspecial, quantidadePremium, quantidadeHoraMarcada, quantidadeComMotivos, quantidadeComAvisos, avisos, amostra
- **Nota:** Frete vinculado do diagnóstico, não recalculado

### 6.7 `diagnosticoOrdenacao`

- **Finalidade:** Ordena candidatos preliminares por prioridade diagnóstica
- **Status:** ✅ Funcional
- **Campos:** executado, resumo (total, elegiveis, indisponiveis, primeiroElegivelId), avisos, amostra (com posicao)
- **Nota:** Não é ranking final de produção

### 6.8 `diagnosticoCandidatosDisponibilidadeReal`

- **Finalidade:** Gera candidatos diagnósticos v2 usando a disponibilidade real já lida/parseada no bloco opcional `diagnosticoDisponibilidadeReal`.
- **Status:** ✅ Funcional apenas quando `usarDisponibilidadeRealDiagnostica: true`
- **Campos:** executado, ok, modo, parametros, resumo, resumoOrdenacao, candidatosOrdenadosAmostra, avisos
- **Nota:** Não substitui `diagnosticoDisponibilidade`, `diagnosticoClassificacao`, `diagnosticoCandidatos`, `diagnosticoOrdenacao`, o fluxo legado ou o frontend.
- **Distância diagnóstica:** usa `distanciaDiagnosticaKm` do body quando for número válido maior que zero. Se ausente ou inválido, passa `distanciaKm: null` ao helper e retorna `origemDistanciaKm: "ausente"`; não calcula distância real e não chama OSRM.
- **Distância adicional:** usa `kmAdicionalNaRotaDiagnosticoM` ou `kmAdicionalNaRotaM` do body quando informado. Se ausente, passa `null` ao helper; não usa fallback `0`, para evitar classificar candidatos como normais de forma artificial.
- **Response:** o array completo de disponibilidades é usado internamente pela rota, mas não é exposto no JSON público; o response retorna apenas resumo e amostra de candidatos ordenados.

### 6.9 `diagnosticoCandidatosReaisAdaptados`

- **Finalidade:** Adapta candidatos reais diagnósticos (`CandidatoPreliminarV2[]`) para o formato legado diagnóstico, facilitando comparação com fixtures/contrato legado.
- **Status:** ✅ Funcional apenas quando `diagnosticoCandidatosDisponibilidadeReal` executa com sucesso
- **Campos:** executado, ok, modo, formatoDateISO, quantidadeRecebida, quantidadeAdaptada, amostra, avisos
- **Nota:** Não substitui nenhum bloco sintético (`diagnosticoDisponibilidade`, `diagnosticoClassificacao`, `diagnosticoCandidatos`, `diagnosticoOrdenacao`), nem o fluxo legado ou frontend.
- **Formato:** Usa `formatoDateISO: 'legado-gmt3'` por padrão, emitindo `dateISO` no formato `YYYY-MM-DDT03:00:00.000Z` observado nas fixtures reais do legado.
- **Limite:** Usa `limiteAmostra: 20` para controlar o tamanho do response.
- **Integração:** Chama `adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2()` com candidatos ordenados do bloco `diagnosticoCandidatosDisponibilidadeReal`.
- **Execução:** Apenas executa quando `usarDisponibilidadeRealDiagnostica: true` e a geração de candidatos reais foi bem-sucedida (`diagnosticoCandidatosDisponibilidadeReal.ok === true`).

### 6.10 `diagnosticoComparacaoHaversineOsrm`

- **Finalidade:** Comparar, em bloco isolado e opcional, o `kmAdicionalNaRotaM` calculado por Haversine contra o calculado por OSRM Table API.
- **Status:** Funcional apenas quando `usarComparacaoHaversineOsrmDiagnostico: true`.
- **Contrato/body:** aceita `usarComparacaoHaversineOsrmDiagnostico`, `osrmBaseUrlDiagnostico`, `osrmTimeoutMsDiagnostico`, `linhasAgendaDiagnostica`, `cacheCoordenadasAgendaDiagnostico`, `origemAgendaDiagnostica`, `equipeAgendaDiagnostica`, `destLat`, `destLng` e `dataInicial`.
- **Exigencia OSRM:** `osrmBaseUrlDiagnostico` e obrigatorio para executar a comparacao. Sem ele, retorna `executado: true`, `ok: false`, erro claro e nao cria o cliente OSRM.
- **Timeout:** usa `osrmTimeoutMsDiagnostico` quando numerico e maior que zero; caso contrario usa default seguro de 5000ms.
- **Response:** sem a flag retorna `null`; com flag retorna bloco com `executado`, `ok`, `modo`, `avisoDiagnostico`, `osrmBaseUrlUsada`, `osrmTimeoutMs`, `parametros`, `parseAgenda`, `resultado`, `erros` e `avisos`.
- **Limites:** bloco exclusivamente diagnostico. Nao altera frontend, producao, rotas legadas, `diagnosticoKmAdicionalAgenda`, candidatos, classificacao ou adaptacao legado. Nao substitui `kmAdicionalNaRotaDiagnosticoM`.
- **Sem fallback 0:** falhas, `null` do OSRM ou dado critico ausente retornam erro/`ok:false`; nao ha conversao silenciosa para zero.
- **Testes:** a suite da rota mocka/stuba cliente OSRM e helper comparativo; nao chama OSRM real em testes automatizados.

---

## 7. O que já foi validado manualmente

### 7.1 Janela de datas

```ts
diagnosticoJanelaDatas: {
  executado: true,
  diasSolicitados: 100,
  quantidadeGerada: 100,
  primeiraDataISO: "2026-06-13",
  ultimaDataISO: "2026-09-20",
  amostra: [5 datas]
}
```

### 7.2 Disponibilidade

```ts
diagnosticoDisponibilidade: {
  executado: true,
  quantidadeDatas: 100,
  quantidadeDatasComEquipe: 4,
  quantidadeEquipesComRegistro: 8,
  quantidadeEquipesAtivas: 7,
  quantidadeEquipesSuficientes: 6,
  quantidadeEquipesInativas: 1,
  quantidadeEquipesInsuficientes: 1,
  tempoNecessarioMin: 40,
  resultado: { ok: true }
}
```

### 7.3 Classificação operacional

```ts
diagnosticoClassificacao: {
  executado: true,
  quantidadeCenariosClassificados: 12,
  quantidadeElegiveis: 8,
  quantidadeIndisponiveis: 4,
  quantidadeNormal: 6,
  quantidadeEspecial: 0,
  quantidadePremium: 1,
  quantidadeHoraMarcada: 1,
  avisos: ["Config não permite cenário especial distinto do normal."]
}
```

### 7.4 Candidatos preliminares com frete

```ts
diagnosticoCandidatos: {
  executado: true,
  freteVinculado: true,
  quantidadeCandidatosMontados: 12,
  quantidadeElegiveis: 8,
  quantidadeIndisponiveis: 4,
  quantidadeNormal: 6,
  quantidadeEspecial: 0,
  quantidadePremium: 1,
  quantidadeHoraMarcada: 1,
  quantidadeComMotivos: 5,
  quantidadeComAvisos: 0
}
```

**Frete validado:**
- `valorFrete: 110`
- `tipoFrete: "fixo"`

**Batimento:**
```ts
cenariosClassificados: 12
candidatosMontados: 12
classificacaoElegiveis: 8
candidatosElegiveis: 8
classificacaoIndisponiveis: 4
candidatosIndisponiveis: 4
freteVinculado: true
```

### 7.5 Ordenação diagnóstica

```ts
diagnosticoOrdenacao: {
  executado: true,
  resumo: {
    total: 12,
    elegiveis: 8,
    indisponiveis: 4,
    primeiroElegivelId: "v2-2026-06-13-equipe-1-sintetico-hora-marcada-10"
  }
}
```

**Batimento:**
```ts
candidatosMontados: 12
ordenacaoTotal: 12
candidatosElegiveis: 8
ordenacaoElegiveis: 8
candidatosIndisponiveis: 4
ordenacaoIndisponiveis: 4
```

**Amostra ordenada:**
- `hora-marcada` aparece antes de `premium`
- `premium` aparece antes de `normal`
- Indisponíveis aparecem depois dos elegíveis

### 7.6 Comparação Haversine vs OSRM (diagnóstico)

**Data da validação:** 2026-06-17  
**Método:** DevTools Console com usuário autenticado (script Node.js recebeu HTTP 401 por falta de autenticação via `validateComercialUser`)

**Payload usado:**
```json
{
  "usarComparacaoHaversineOsrmDiagnostico": true,
  "osrmBaseUrlDiagnostico": "https://router.project-osrm.org",
  "osrmTimeoutMsDiagnostico": 7000,
  "linhasAgendaDiagnostica": [
    ["2026-06-16", "", "ENTREGA CLIENTE FIXTURE", "", "", "Rua Exemplo 100, Curitiba - PR, 80000-000", "EQUIPE 1"]
  ],
  "cacheCoordenadasAgendaDiagnostico": {
    "rua exemplo 100, curitiba - pr, 80000-000": { "lat": -25.442, "lng": -49.2407 }
  },
  "origemAgendaDiagnostica": { "lat": -25.4284, "lng": -49.2733 },
  "equipeAgendaDiagnostica": "EQUIPE 1",
  "destLat": -25.4235,
  "destLng": -49.3076,
  "dataInicial": "2026-06-16"
}
```

**Resultado do bloco:**
```ts
diagnosticoComparacaoHaversineOsrm: {
  executado: true,
  ok: true,
  modo: "comparacao-haversine-osrm-diagnostico",
  osrmBaseUrlUsada: "https://router.project-osrm.org",
  osrmTimeoutMs: 7000,
  erros: [],
  parseAgenda: { ok: true },
  resultado: {
    comparacao: {
      kmHaversineM: 6907,
      kmOsrmM: 8214,
      diferencaAbsolutaM: 1307,
      diferencaPercentual: 18.92,
      osrmMaiorQueHaversine: true
    }
  }
}
```

**Observações:**
- Status HTTP: 200
- Bloco executou com OSRM real (`https://router.project-osrm.org`)
- Haversine subestimou o km adicional em 18.92% frente ao OSRM (6907m vs 8214m)
- Sem erros no bloco
- Candidatos/classificação/adaptação legado não foram alterados
- `kmAdicionalNaRotaDiagnosticoM` não foi substituído
- Produção/frontend/rotas legadas não foram alterados
- Aviso de diagnóstico confirmado: bloco é apenas diagnóstico, sem impacto em produção

---

## 8. O que ainda é sintético

- **Disponibilidade por equipe/data:** Dados sintéticos, não refletem agenda real
- **Cenários de classificação:** Usam kmAdicionalNaRotaM sintético, não reflete cenário real
- **Candidatos preliminares:** Derivados de cenários sintéticos
- **Ordenação diagnóstica:** Baseada em candidatos sintéticos
- **Distância Haversine:** Apenas diagnóstico, não substitui OSRM do legado

---

## 9. O que ainda não existe / não foi feito

- ❌ Não há uso no frontend
- ❌ Não há uso na rota `/api/procurar-datas/pesquisar`
- ❌ Não há substituição do Apps Script
- ❌ Não há consulta real de agenda
- ✅ Parser puro de linhas da planilha TEMPO DISPONIVEL criado (helper isolado, sem I/O)
- ❌ Não há leitura real da planilha Google Sheets no Next.js
- ❌ Não há Supabase no motor v2
- ❌ Não há Google Calendar
- ❌ Não há OSRM real no v2
- ❌ Não há pré-agendamento
- ❌ Não há comparação legado vs v2
- ❌ Não há ranking final de produção
- ✅ Adapter diagnóstico `CandidatoPreliminarV2` → `CandidatoLegadoDiagnosticoV2` criado (helper puro, não em produção)

---

## 10. Regras de segurança mantidas

- ✅ Produção não alterada
- ✅ Frontend não alterado
- ✅ Rota legado preservada
- ✅ Helpers puros (sem I/O)
- ✅ Testes unitários (352 testes)
- ✅ Integração apenas diagnóstica
- ✅ Sem chamadas externas nos helpers
- ✅ Typecheck sem erros

**Nota adicional — validação de entrada:**
- A rota legado `POST /api/procurar-datas/pesquisar` foi reforçada com validação backend de `tempoNecessario` (função `isTempoNecessarioValido`)
- Caso de entrada inválida sem tempo foi identificado como bug e corrigido — agora retorna HTTP 400 com erro específico
- O motor v2 deve continuar rejeitando entrada sem tempo válido como comportamento esperado
- Esse caso não deve ser reproduzido no v2 como comportamento aceito do legado

---

## 11. Próximos passos recomendados

1. **Criar fixtures de caracterização do legado** ✅ CONCLUÍDO
   - `docs/fixtures/procurar-datas/legado/caso-normal-simples-2026-06-12.json`
   - `docs/fixtures/procurar-datas/legado/caso-premium-ou-especial-2026-06-12.json`

2. **Criar rota de comparação legado vs v2 em modo diagnóstico** ✅ CONCLUÍDO
   - `src/lib/procurar-datas/motor/comparacao-legado-v2.ts` — helper puro
   - `src/app/api/procurar-datas/v2/comparar/route.ts` — rota GET diagnóstica
   - Compara estrutura das fixtures reais/controladas — não chama Apps Script
   - 26 testes unitários passando

3. **Iniciar leitura real de disponibilidade em modo diagnóstico** ✅ CONCLUÍDO (camada pura)
   - `src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.ts` — helper puro
   - Recebe `DisponibilidadeEquipeDataV2[]` já parseada e gera `CandidatoPreliminarV2[]` ordenados
   - 40 testes unitários do helper passando
   - Integrado à rota `/v2/diagnostico` como bloco opcional `diagnosticoCandidatosDisponibilidadeReal`, sem substituir blocos sintéticos

4. **Aproximar candidato v2 do contrato esperado pelo frontend** ✅ CONCLUÍDO (diagnóstico)
   - `src/lib/procurar-datas/motor/adaptador-candidato-legado.ts` — adapter puro diagnóstico
   - Mapeia todos os campos de `CandidatoFinal` legado a partir de `CandidatoPreliminarV2`
   - 40 testes unitários passando, incluindo verificações baseadas em fixtures reais

5. **Só depois discutir integração gradual no frontend**
   - Feature flags
   - Rollback seguro
   - Monitoramento

---

## 12. Como validar manualmente hoje

```js
fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cep: '01310-100',
    enderecoCompleto: 'Av. Paulista, 1000, São Paulo, SP',
    lat: -23.5631,
    lng: -46.6544,
    destLat: -23.5505,
    destLng: -46.6333,
    tempoNecessario: '01:00',
    dataInicial: '2026-06-13',
    isRural: false,
    isCondominio: false,
  }),
})
  .then((r) => r.json())
  .then((json) => {
    console.log('FRETE:', json.diagnosticoFrete)
    console.log('JANELA:', json.diagnosticoJanelaDatas)
    console.log('DISPONIBILIDADE:', json.diagnosticoDisponibilidade)
    console.log('CLASSIFICAÇÃO:', json.diagnosticoClassificacao)
    console.log('CANDIDATOS:', json.diagnosticoCandidatos)
    console.log('ORDENAÇÃO:', json.diagnosticoOrdenacao)

    console.log('BATIMENTO:', {
      cenariosClassificados: json.diagnosticoClassificacao?.quantidadeCenariosClassificados,
      candidatosMontados: json.diagnosticoCandidatos?.quantidadeCandidatosMontados,
      classificacaoElegiveis: json.diagnosticoClassificacao?.quantidadeElegiveis,
      candidatosElegiveis: json.diagnosticoCandidatos?.quantidadeElegiveis,
      classificacaoIndisponiveis: json.diagnosticoClassificacao?.quantidadeIndisponiveis,
      candidatosIndisponiveis: json.diagnosticoCandidatos?.quantidadeIndisponiveis,
      freteVinculado: json.diagnosticoCandidatos?.freteVinculado,
      ordenacaoTotal: json.diagnosticoOrdenacao?.resumo?.total,
      ordenacaoElegiveis: json.diagnosticoOrdenacao?.resumo?.elegiveis,
      ordenacaoIndisponiveis: json.diagnosticoOrdenacao?.resumo?.indisponiveis,
      primeiroElegivelId: json.diagnosticoOrdenacao?.resumo?.primeiroElegivelId,
    })

    console.table(json.diagnosticoOrdenacao?.amostra?.map((c) => ({
      posicao: c.posicao,
      id: c.id,
      dataISO: c.dataISO,
      equipe: c.equipe,
      tipo: c.tipo,
      elegivel: c.elegivel,
      indice: c.indice,
      valorFrete: c.frete?.valorFrete,
      tipoFrete: c.frete?.tipoFrete,
      motivos: c.motivos?.join(' | '),
    })))
  })
```

---

## 13. Estado atual dos testes

- **Total de testes:** 625 (motor) / 678 total
- **Status:** Todos passando
- **Typecheck:** 0 erros
- **Arquivos de teste:**
  - `entrada.test.ts` (19 testes)
  - `tempo.test.ts` (31 testes)
  - `equipe.test.ts` (26 testes)
  - `distancia.test.ts` (14 testes)
  - `frete.test.ts` (51 testes)
  - `datas.test.ts` (13 testes)
  - `janela-datas.test.ts` (16 testes)
  - `disponibilidade.test.ts` (19 testes)
  - `classificacao-candidato.test.ts` (35 testes)
  - `candidato.test.ts` (22 testes)
  - `ordenacao-candidatos.test.ts` (26 testes)
  - `comparacao-legado-v2.test.ts` (26 testes)
  - `adaptador-candidato-legado.test.ts` (45 testes)
  - `v2/comparar/route.test.ts` (4 testes)
  - `v2/diagnostico/route.test.ts` (29 testes)
  - `parse-disponibilidade-tempo-disponivel.test.ts` (54 testes)
  - `gerar-candidatos-disponibilidade-real.test.ts` (40 testes)
  - `adaptar-candidatos-reais-legado.test.ts` (27 testes)
  - `calcular-delta-insercao-matriz.test.ts` (20 testes)
  - `calcular-delta-insercao-equivalencia.test.ts` (11 testes) — prova equivalencia Haversine vs Matriz
  - `preparar-matriz-osrm-diagnostico.test.ts` (16 testes) — adaptador OSRM mockavel
  - `osrm-table-client-diagnostico.test.ts` (19 testes) — cliente HTTP OSRM Table API
  - `comparar-km-adicional-haversine-osrm.test.ts` (18 testes) — compara Haversine vs OSRM

---

## 14. Adaptador HTTP OSRM Table API (diagnostico)

Arquivo: `src/lib/procurar-datas/motor/osrm-table-client-diagnostico.ts`

Funcao principal: `criarBuscarMatrizOSRMTableDiagnosticoV2(config)` — retorna funcao compativel com o contrato `BuscarMatrizOSRM`.

Fluxo:
```
coordenadasLat/Lng
  -> montarUrlOSRMTable()  (converte para lng,lat — OSRM usa lng primeiro)
  -> GET {baseUrl}/table/v1/driving/{lng,lat;...}?annotations=distance
  -> AbortController (timeout configuravel, default 5s)
  -> valida HTTP status, JSON, code='Ok', distances[]
  -> sanitiza: NaN/Infinity/negativo -> null com log
  -> ResultadoMatrizOSRM { distances[][] } em metros
```

Regras obrigatorias:
- NAO usa process.env: baseUrl recebido por config.
- NAO faz retry: apenas timeout e erro explicito.
- fetchImpl e injetado: nos testes, sempre vi.fn() — nunca chama OSRM real.
- Erros controlados: HTTP !2xx, JSON invalido, code!='Ok', distances ausente/malformado.
- null da OSRM preservado como null. Valores invalidos (NaN/Infinity/negativo) -> null com aviso via log.
- Integrado na rota /api/procurar-datas/v2/diagnostico somente como bloco opcional `diagnosticoComparacaoHaversineOsrm`, condicionado a `usarComparacaoHaversineOsrmDiagnostico: true`.
- NAO substitui legado nem producao.

---

## 15. Script diagnóstico manual OSRM Table API

Arquivo: `scripts/diagnostico-osrm-table.ts`

Objetivo: testar conectividade real com OSRM (ex: router.project-osrm.org) de forma manual e controlada.

**NÃO é produção. NÃO roda automaticamente. NÃO é chamado por testes.**

### Comando manual

```bash
npx tsx scripts/diagnostico-osrm-table.ts --baseUrl=https://router.project-osrm.org --timeoutMs=7000
```

Argumentos opcionais:
- `--baseUrl`: URL base do OSRM (default: https://router.project-osrm.org)
- `--timeoutMs`: timeout em ms (default: 7000)

### Coordenadas usadas (pontos públicos de Curitiba)

- Praça Tiradentes: lat -25.4284, lng -49.2733
- Jardim Botanico:   lat -25.4420, lng -49.2407
- Parque Barigui:    lat -25.4235, lng -49.3076

### Campos impressos no log

- `[OSRM] OSRM Table API: GET {url}` — URL chamada
- `[OSRM] OSRM resposta` — code recebido
- `Latencia total` — duração em ms
- `✅ SUCESSO` ou `❌ ERRO` — resultado
- `Estatisticas da matriz` — dimensão, válidos, nulos, soma, média, min, max
- `Matriz de distancias (metros)` — matriz completa distances[][]
- `✅ Formato da matriz valido` ou `⚠️ ALERTAS DE VALIDACAO`

### Regras

- NÃO usa process.env como única fonte.
- NÃO escreve em banco, Sheets, Supabase, Apps Script.
- NÃO faz geocoding.
- NÃO altera frontend, rota, produção, candidatos, classificação.
- NÃO substitui kmAdicionalNaRotaDiagnosticoM.
- Pode falhar se OSRM estiver indisponível ou bloquear requisições.

### Resultado do primeiro teste real (manual)

**Data/hora:** 2026-06-15 ~21:01 UTC-3

**Comando executado:**
```bash
npx tsx scripts/diagnostico-osrm-table.ts --baseUrl=https://router.project-osrm.org --timeoutMs=7000
```

**Resultado:**
- ✅ SUCESSO
- `code: Ok`
- Latência total: 1061ms
- Matriz: 3x3
- Células totais: 9
- Válidos: 9
- Nulos: 0
- Soma metros: 37615.2
- Média metros: 4179
- Mínimo metros: 0
- Máximo metros: 9291.3

**Endpoint chamado:**
```
https://router.project-osrm.org/table/v1/driving/-49.2733,-25.4284;-49.2407,-25.442;-49.3076,-25.4235?annotations=distance
```

**Matriz distances recebida (metros):**
```
[
  [0, 4912.3, 4301.7],
  [5525.8, 0, 9291.3],
  [4760.3, 8823.8, 0]
]
```

**Observação sobre assimetria:**
A matriz é assimétrica, o que é esperado para rotas de carro. Exemplo:
- Praça Tiradentes → Jardim Botânico: 4912.3m
- Jardim Botânico → Praça Tiradentes: 5525.8m

Isso reforça que Haversine é apenas aproximação diagnóstica e não substitui OSRM.

**Escopo:**
- Teste foi manual, não integrado à rota.
- Produção continua intacta.
- Nenhuma alteração em código, testes, frontend, produção, legado, candidatos, classificação.

---

## 15.5 Helper comparativo Haversine vs OSRM (diagnostico)

Arquivo: `src/lib/procurar-datas/motor/comparar-km-adicional-haversine-osrm.ts`
Testes: `src/lib/procurar-datas/motor/comparar-km-adicional-haversine-osrm.test.ts` (18 testes)

Função principal: `compararKmAdicionalHaversineVsOSRMDiagnosticoV2(input)` — compara lado a lado o cálculo de `kmAdicionalNaRotaM` entre Haversine e OSRM.

**Propósito:**
Diagnosticar a diferença entre aproximação Haversine e OSRM Table API de forma isolada, controlada e auditável.

**Fluxo:**
```
origem, destino, pontosAgenda, buscarMatrizOSRM
  -> 1. calcularDeltaInsercaoRotaDiagnosticoV2 (Haversine, sincrono)
  -> 2. prepararMatrizOSRMDiagnosticoV2 (busca matriz via OSRM injetado, assincrono)
  -> 3. criarCalculadorDistanciaPorCoordenadas (constrói lookup lat,lng -> id)
  -> 4. calcularDeltaInsercaoRotaComMatrizDiagnosticoV2 (delta por matriz, sincrono)
  -> 5. calcularComparacao (diferenca absoluta, percentual, qual e maior)
  -> { ok, haversine, osrm, matrizOSRM, comparacao, avisos, erros }
```

**Output da comparacao:**
```ts
comparacao: {
  kmHaversineM: number | null;
  kmOsrmM: number | null;
  diferencaAbsolutaM: number | null;    // |OSRM - Haversine|
  diferencaPercentual: number | null;   // (OSRM - H) / H * 100
  osrmMaiorQueHaversine: boolean | null;
}
```

**Regras obrigatorias:**
- NAO chama OSRM real diretamente: usa `buscarMatrizOSRM` injetado.
- NAO usa `fetch` diretamente.
- NAO usa `process.env`.
- NAO faz geocoding.
- Integrado na rota `/api/procurar-datas/v2/diagnostico` somente como bloco opcional `diagnosticoComparacaoHaversineOsrm`, condicionado a `usarComparacaoHaversineOsrmDiagnostico: true`.
- NAO altera frontend, producao, candidatos, classificacao.
- NAO substitui `kmAdicionalNaRotaDiagnosticoM`.
- Se Haversine falha ou OSRM falha: `ok: false` (comparacao incompleta).
- Se ambos funcionam: `ok: true`.
- Nunca usa fallback silencioso `0`.
- Diferenca percentual evita divisao por zero (retorna `null` quando Haversine = 0).
- Matriz OSRM assimétrica é respeitada (OSRM carro eh assimétrico).
- OSRM ja teve conectividade manual validada (secao 15), mas este helper continua mockado nos testes.

**Testes cobertos:**
1. Comparacao feliz retorna `ok: true`.
2. Retorna `kmHaversineM` e `kmOsrmM`.
3. Calcula diferenca absoluta.
4. Calcula diferenca percentual.
5. Detecta quando OSRM eh maior que Haversine.
6. Matriz assimétrica eh respeitada.
7. Falha do OSRM retorna `ok: false`.
8. Origem invalida retorna comparacao incompleta.
9. OSRM com distancia `null` nao vira `0`.
10. Agenda vazia funciona (origem -> destino).
11. Ponto invalido eh descartado nos dois caminhos.
12. NAO chama OSRM real.
13. NAO usa `fetch`.
14. NAO usa `process.env`.
15. NAO muta input.
16. Mantem modo `comparacao-haversine-osrm-diagnostico`.
17. Diferenca percentual evita divisao por zero.
18. Comparacao com agenda multi-pontos funciona.

---

## 16. Rota /api/procurar-datas/v2/comparar

A rota diagnostica `GET /api/procurar-datas/v2/comparar` agora tem dois niveis:

1. Comparacao estrutural das fixtures reais/controladas do legado:
   - `caso-normal-simples-2026-06-12`
   - `caso-premium-ou-especial-2026-06-12`
   - Continua baseada em arquivos locais de fixtures.
   - Nao chama Apps Script, OSRM, Supabase, banco, planilha ou frontend.

2. Demonstracao sintetica do adapter v2 para contrato legado:
   - Campo de resposta: `diagnosticoAdapterV2`
   - Modo: `sintetico`
   - Usa candidatos `CandidatoPreliminarV2` sinteticos para demonstrar `normal`, `premium`, `especial` e `hora-marcada`.
   - Usa `dataReferenciaISO: "2026-06-12"` fixa para determinismo.
   - Usa ranks controlados `1`, `2`, `3`, `4`.
   - **Formato `dateISO`:** a rota diagnostica usa `formatoDateISO: "legado-gmt3"`, emitindo `YYYY-MM-DDT03:00:00.000Z` — padrao observado nas fixtures reais/controladas do legado. O campo `formatoDateISO: "legado-gmt3"` e exposto explicitamente no bloco `diagnosticoAdapterV2`.
   - O adapter continua tendo padrao `v2` (`YYYY-MM-DD`). A rota `/v2/comparar` passa `legado-gmt3` propositalmente por ser rota diagnostica de comparacao.
   - Nao compara datas reais nem equivalencia operacional final.
   - Ainda nao representa equivalencia operacional real.

Limites mantidos:

- v2 ainda nao usa disponibilidade real neste bloco.
- v2 ainda nao usa OSRM real neste bloco.
- Hora marcada ainda nao foi verificada por fixture real.
- O adapter e diagnostico/estrutural e nao substitui o contrato de producao.

---

## 17. Helper puro adaptarCandidatosDisponibilidadeRealParaLegadoDiagnosticoV2

Criado em `src/lib/procurar-datas/motor/adaptar-candidatos-reais-legado.ts`.

### Responsabilidade

Transforma candidatos v2 reais já ordenados (saída de `gerarCandidatosComDisponibilidadeRealV2`) em uma amostra compatível com o contrato legado diagnóstico, usando o adapter existente `adaptarCandidatoV2ParaContratoLegadoDiagnostico` com `formatoDateISO: 'legado-gmt3'` por padrão.

Não duplica nenhuma lógica de conversão de campos — delega integralmente ao adapter.

### Entrada principal

- `candidatosOrdenados: CandidatoPreliminarV2[]` — já ordenados por `gerarCandidatosComDisponibilidadeRealV2()`
- `formatoDateISO?: 'v2' | 'legado-gmt3'` — padrão `'legado-gmt3'` (emite `T03:00:00.000Z`)
- `limiteAmostra?: number` — 0 ou omitido = todos; caso contrário, corta a lista
- `dataReferenciaISO?: string | null` — para cálculo de `daysLeftTxt`

### Saída principal

- `ok: boolean` — false apenas se `candidatosOrdenados` não for array
- `formatoDateISO` — formato efetivamente usado
- `quantidadeRecebida` / `quantidadeAdaptada`
- `amostra: CandidatoLegadoDiagnosticoV2[]` — candidatos adaptados com rank sequencial (1, 2, 3…)
- `avisos: string[]`

### Regras implementadas

- Rank atribuído sequencialmente pela posição na amostra (não calculado externamente)
- Candidatos indisponíveis são incluídos (o adapter os aceita)
- `limiteAmostra: 0` ou omitido = sem limite
- Lista vazia retorna `ok: true` com aviso
- Não muta entrada
- Não faz I/O
- Não está integrado a nenhuma rota

---

## 16. Helper puro gerarCandidatosComDisponibilidadeRealV2

Criado em `src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.ts`.

### Responsabilidade

Orquestra a cadeia de helpers puros existentes para transformar disponibilidade real já parseada em candidatos diagnósticos v2 ordenados.

### Pipeline interno

1. `filtrarDisponibilidadePorJanelaV2` → `DataDisponivelV2[]` com equipes enriquecidas
2. Para cada data × equipe:
   - `classificarCandidatoOperacionalV2` → `ClassificacaoCandidatoOperacionalV2`
   - `montarCandidatoPreliminarV2` → `CandidatoPreliminarV2`
3. `ordenarCandidatosDiagnosticosV2` → lista ordenada por elegibilidade e tipo

### Entrada principal

- `janelaDatas: DataJanelaPesquisaV2[]` — janela já gerada por `gerarJanelaDatasPesquisaV2()`
- `disponibilidades: DisponibilidadeEquipeDataV2[]` — já parseada pelo parser da planilha
- `tempoNecessarioMin: number | null`
- `distanciaKm?: number | null` — diagnóstico (Haversine ou OSRM quando disponível)
- `kmAdicionalNaRotaM?: number | null` — diagnóstico
- `valorFrete?: number | null` — pré-calculado ou null
- `tipoFrete?: string | null`
- `configOperacional: ConfigClassificacaoV2` — 5 limites obrigatórios

### Saída principal

- `ok: boolean` — false apenas se janela vazia
- `resumo: ResumoGeracaoCandidatosV2` — contagens de candidatos por tipo/elegibilidade
- `disponibilidadePorJanela: DisponibilidadeJanelaV2`
- `classificacoes: ClassificacaoCandidatoOperacionalV2[]`
- `candidatos: CandidatoPreliminarV2[]`
- `candidatosOrdenados: CandidatoPreliminarV2[]`
- `resumoOrdenacao` — total/elegiveis/indisponiveis/primeiroElegivelId
- `avisos: string[]`

### Limitações conhecidas e documentadas

- `distanciaKm` e `kmAdicionalNaRotaM` são diagnósticos — OSRM real não está integrado.
  Quando `null`, candidatos classificam como `indisponivel` com motivo específico.
- `kmAdicionalNaRotaM` no legado é calculado como delta de inserção do destino na rota existente.
  No v2 diagnóstico, esse valor precisa ser passado externamente.
- Está integrado à rota `/v2/diagnostico` somente quando `usarDisponibilidadeRealDiagnostica: true`, no bloco separado `diagnosticoCandidatosDisponibilidadeReal`.
- A rota passa `distanciaKm` a partir de `distanciaDiagnosticaKm` somente quando o body traz número válido maior que zero. Caso contrário, retorna `distanciaKm: null` e `origemDistanciaKm: "ausente"`.
- A rota passa `kmAdicionalNaRotaM: null` quando o body não traz `kmAdicionalNaRotaDiagnosticoM` ou `kmAdicionalNaRotaM`; não usa `0` como fallback silencioso.
- A lista completa de disponibilidades parseadas é consumida internamente pela rota para gerar candidatos, mas o response público retorna apenas resumo e amostra ordenada.

---

## 18. Integracao diagnostica de km adicional por agenda

### Bloco `diagnosticoKmAdicionalAgenda`

- **Finalidade:** Executa `diagnosticarKmAdicionalAgendaV2()` dentro da rota diagnostica `POST /api/procurar-datas/v2/diagnostico`, usando somente fixture/dados controlados enviados no body.
- **Flag:** `usarKmAdicionalAgendaDiagnostico: true`.
- **Entrada controlada:** `linhasAgendaDiagnostica`, `cacheCoordenadasAgendaDiagnostico`, `origemAgendaDiagnostica`, `equipeAgendaDiagnostica`, `destLat`, `destLng` e `dataInicial`.
- **Response:** `executado`, `ok`, `modo`, `parametros`, `kmAdicionalNaRotaM`, `origemKmAdicionalNaRotaM`, `parseAgenda`, `deltaInsercao`, `avisos`, `descartados`.
- **Limites:** usa Haversine diagnostico; nao usa OSRM; nao le Google Sheets real; nao chama Apps Script; nao chama Supabase; nao faz geocoding real; nao altera frontend, producao ou rotas legadas.
- **Compatibilidade:** sem a flag, o bloco retorna `null`. O valor calculado nao substitui `kmAdicionalNaRotaDiagnosticoM` atual e nao altera classificacao/candidatos.
- **Seguranca:** se faltar dado critico, retorna `ok: false`, `kmAdicionalNaRotaM: null` e avisos claros. Nao usa fallback silencioso `0`.

### Fixtures internas

Arquivo criado para testes controlados:

- `src/lib/procurar-datas/motor/fixtures/km-adicional-agenda-diagnostico.ts`

Cenarios disponiveis:

- `cenarioAgendaUmPonto`: uma linha valida, coordenada em cache, origem/destino validos.
- `cenarioAgendaMultipontos`: tres pontos validos da mesma data/equipe, com `melhorInsercao` esperado.
- `cenarioAgendaSemCache`: linha valida sem coordenada no cache, com descarte auditavel e rota simples origem -> destino.
- `cenarioAgendaVazia`: sem linhas de agenda, com aviso de rota simples origem -> destino.
- `cenarioEquipeDiferente`: linha de outra equipe; nao cria ponto valido para a equipe solicitada.
- `cenarioOrigemInvalida`: origem ausente; espera `ok: false` e `kmAdicionalNaRotaM: null`.
- `cenarioDestinoInvalido`: destino ausente/invalido; espera `ok: false` e `kmAdicionalNaRotaM: null`.

Uso nos testes:

```ts
import {
  cenarioAgendaUmPonto,
  montarBodyDiagnosticoKmAdicionalAgenda,
} from '@/lib/procurar-datas/motor/fixtures/km-adicional-agenda-diagnostico'

const body = montarBodyDiagnosticoKmAdicionalAgenda(cenarioAgendaUmPonto)
```

Observacoes:

- As fixtures sao deterministicas, nao dependem de data atual e usam apenas enderecos genericos `Rua Fixture`.
- As fixtures nao chamam OSRM, Supabase, Google Sheets real, Apps Script, geocoding ou `fetch`.
- O calculo continua sendo Haversine diagnostico, sem uso em producao e sem substituicao do legado.
- No DevTools do navegador, o arquivo TS nao e importado diretamente; para teste manual, manter o snippet abaixo com payload inline equivalente.

### Snippet manual

> **Importante:** Este snippet usa formato de linhas brutas `shAg` (array de arrays).  
> Colunas usadas: `r[0]` (data), `r[2]` (título/evento), `r[4]` (observações), `r[5]` (endereço/lugar), `r[6]` (equipe).  
> Cache deve usar `cacheCoordenadasAgendaDiagnostico` (não `cacheCoordenadasAgenda`).  
> Este é um teste diagnóstico usando Haversine — não chama OSRM/produção.

```js
fetch('/api/procurar-datas/v2/diagnostico', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cep: '80000-000',
    dataInicial: '2026-06-15',
    tempoNecessario: '00:40',
    destLat: -25.42,
    destLng: -49.27,
    usarKmAdicionalAgendaDiagnostico: true,
    equipeAgendaDiagnostica: 'EQUIPE 1',
    origemAgendaDiagnostica: {
      lat: -25.45,
      lng: -49.29,
      descricao: 'Origem fixture',
    },
    // Formato shAg: array de arrays (linhas brutas da planilha AGENDA)
    linhasAgendaDiagnostica: [
      ['2026-06-15', '', 'ENTREGA CLIENTE FIXTURE', '', '', 'Rua Exemplo 100, Curitiba - PR, 80000-000', 'EQUIPE 1'],
    ],
    // Cache de coordenadas por endereço (chave normalizada pelo parser)
    cacheCoordenadasAgendaDiagnostico: {
      'rua exemplo 100, curitiba - pr, 80000-000': {
        lat: -25.43,
        lng: -49.28,
      },
    },
  }),
})
  .then((r) => r.json())
  .then((d) => {
    console.log('OK:', d.ok)
    console.log('KM AGENDA:', d.diagnosticoKmAdicionalAgenda)
    console.log('KM:', d.diagnosticoKmAdicionalAgenda?.kmAdicionalNaRotaM)
    console.log('ORIGEM KM:', d.diagnosticoKmAdicionalAgenda?.origemKmAdicionalNaRotaM)
    console.table(d.diagnosticoKmAdicionalAgenda?.descartados || [])
  })
```

---

## 15. Resolução P7 — Coordenadas do depósito e casas das equipes (2026-06-17)

**Bloqueio resolvido:** P7 — `LAT DEPOSITO` / `LNG DEPOSITO` = NULL no Supabase.

**Ações realizadas via MCP Supabase:**
- `UPDATE procurar_datas_config`: `LAT DEPOSITO` = "-25.4876648" (era NULL)
- `UPDATE procurar_datas_config`: `LNG DEPOSITO` = "-49.2692262" (era NULL)
- `INSERT procurar_datas_config`: `LAT CASA E1` = "-25.494297" (ordem 93)
- `INSERT procurar_datas_config`: `LNG CASA E1` = "-49.277091" (ordem 94)
- `INSERT procurar_datas_config`: `LAT CASA E2` = "-25.494297" (ordem 95)
- `INSERT procurar_datas_config`: `LNG CASA E2` = "-49.277091" (ordem 96)

**Dados informados pelo usuário:**
- Depósito: R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450 → lat: -25.4876648, lng: -49.2692262
- Casa Equipe 1/2: Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470 → lat: -25.494297, lng: -49.277091

**Status após resolução:**
- Coordenadas do depósito disponíveis para cálculo de distância Haversine/OSRM.
- Coordenadas das casas das equipes disponíveis para implementação de origem alternativa de sábado.
- Configurações de endereço (`ENDEREÇO DO DEPÓSITO`, `ENDEREÇO DA CASA EQP 1/2`) já existiam e estão preenchidas.

**Próximo passo técnico:**
- Quando implementar cálculo de distância no v2, adicionar `LAT DEPOSITO`, `LNG DEPOSITO`, `LAT CASA E1`, `LNG CASA E1`, `LAT CASA E2`, `LNG CASA E2` ao `CHAVES_NORMALIZADAS` em `config-service.ts`.
- Implementar lógica de origem de sábado usando casa da equipe em vez de depósito (quando a data for sábado).

---

## 16. Diagnóstico de equivalência OSRM /route vs /table (2026-06-17)

**Objetivo:** Validar se o cálculo de distância via OSRM `/table` (v2) produz resultado equivalente ao cálculo via OSRM `/route` por pares (legado).

**Contexto:**
- Legado Apps Script usa `getDrivingKm()` que chama OSRM `/route/v1/driving` para cada par de coordenadas.
- V2 usa `prepararMatrizOSRMDiagnosticoV2()` que chama OSRM `/table/v1/driving` para obter matriz completa.
- Diferença conceitual: `/route` calcula rota otimizada para cada par isoladamente; `/table` calcula rotas considerando todos os pontos juntos.

**Implementação:**

1. **Helper puro:** `src/lib/procurar-datas/motor/comparar-equivalencia-osrm-route-table.ts`
   - Função: `compararEquivalenciaOsrmRouteTableDiagnosticoV2(input)`
   - Executa ambos os métodos para os mesmos 3 pontos (prev, novo, next)
   - Calcula: prev→novo, novo→next, prev→next por ambos os métodos
   - Delta de inserção: prevNovo + novoNext - prevNext
   - Comparação: diferença absoluta, percentual, equivalente (dentro da tolerância)
   - Tolerância padrão: 10 metros

2. **Cliente OSRM /route:** `src/lib/procurar-datas/motor/osrm-route-client-diagnostico.ts`
   - Função: `criarBuscarRotaOSRMRouteDiagnosticoV2(config)`
   - Endpoint: `{baseUrl}/route/v1/driving/{lng1},{lat1};{lng2},{lat2}`
   - Parâmetros: `overview=false&alternatives=false&steps=false`
   - Retorna: distância em metros (routes[0].distance)

3. **Integração na rota:** `/api/procurar-datas/v2/diagnostico`
   - Flag: `usarEquivalenciaOsrmRouteVsTableDiagnostico: true`
   - Cenário controlado: `cenarioEquivalenciaOsrm: { prev, novo, next }`
   - Parâmetros: `osrmBaseUrlDiagnostico`, `osrmTimeoutMsDiagnostico`
   - Bloco de resposta: `diagnosticoEquivalenciaOsrmRouteVsTable`

**Testes:**
- `comparar-equivalencia-osrm-route-table.test.ts` — 10 testes cobrindo:
  - Equivalência perfeita (dentro da tolerância)
  - Diferença acima da tolerância
  - Falha completa do método route
  - Falha completa do método table
  - Coordenadas inválidas (NaN)
  - Cálculo correto do delta
  - Diferença percentual nula quando deltaRoute = 0
  - Tolerância padrão de 10m
  - Report tableMaiorQueRoute

- `osrm-route-client-diagnostico.test.ts` — 12 testes cobrindo:
  - Sucesso com distância válida
  - Erro HTTP
  - Code != Ok
  - JSON inválido
  - Routes ausente/vazio
  - Distância inválida (NaN, negativa)
  - Coordenadas inválidas

**Validação real executada (2026-06-17):**

Cenário via DevTools:
- `prev`: Praça Tiradentes (lat: -25.4295963, lng: -49.2712724)
- `novo`: Jardim Botânico (lat: -25.4420558, lng: -49.2394013)
- `next`: Parque Barigui (lat: -25.4239406, lng: -49.3071896)
- Base OSRM: `https://router.project-osrm.org`
- Timeout: 10000ms
- Latência total: 1374ms

Resultados:
| Método | prev→novo | novo→next | prev→next | **Delta** |
|--------|-----------|-----------|-----------|-----------|
| Route (legado) | 5016m | 9202m | 4540m | **9678m** |
| Table (v2) | 5015.7m | 9201.8m | 4540.4m | **9677m** |

Comparação:
- Diferença absoluta: **1m**
- Diferença percentual: **-0.01%**
- Dentro da tolerância de 10m: ✅ **SIM**
- `equivalente`: **true**

Decisão do usuário:
✅ **P1 aprovada como concluída.** A diferença de 1m é aceitável. P2 pode ser decidida.

**Próximo passo:**
- Abrir tarefa específica para decidir P2 (usar `/table` em produção ou manter `/route` por compatibilidade).
- Frente 2 só deve ser reaberta com tarefa específica posterior.

---

## 18. Auditoria Frente 2 — `kmAdicionalNaRotaM` e integração OSRM (2026-06-17)

> Status: auditoria concluída. Nenhum código alterado.

### Onde nasce `kmAdicionalNaRotaM` no v2 hoje

Campo injetado como parâmetro externo em `gerar-candidatos-disponibilidade-real.ts`.
Não calculado internamente. Um único valor passado para **todos os candidatos** (todas as datas × equipes).

### Onde é consumido

Em `classificacao-candidato.ts:150-159` — validação e comparação com limites de config para classificar normal / especial / premium / indisponivel.

### Helpers de cálculo disponíveis (não integrados à cadeia de candidatos)

- `calcular-delta-insercao-rota.ts` — Haversine diagnóstico
- `calcular-delta-insercao-matriz.ts` — função injetada (preparado para OSRM)
- `diagnosticar-km-adicional-agenda.ts` — orquestrador diagnóstico (parse agenda + delta Haversine)

### Divergências críticas confirmadas no legado

| # | Divergência | Trecho legado |
|---|---|---|
| A | `kmAdicionalNaRotaM` único para todos vs por-slot individual | `CEP-APIBACK.gs:882-1068` |
| B | Limite KmBase muda se slot tem pontos (com pontos → `MAX_EXTRA_METERS`; sem pontos → `MAX_WEEKDAY`/`MAX_SATURDAY`) | `CEP-APIBACK.gs:903-905` |
| C | Hora marcada exige `bestKm <= limiteKmBase` + `HORA_MARCADA_HORAS_A_MAIS > 0` | `CEP-APIBACK.gs:1143` |
| D | Especial/premium condicionais a `MAX_EXTRA_DYNAMIC > 0` e `MAX_EXTRA_PREMIUM > 0` | `CEP-APIBACK.gs:1125,1132` |
| E | Limites especial/premium são relativos ao base (+5km, +10km) | `CEP-APIBACK.gs:908-909` |
| F | Haversine como fallback silencioso do OSRM | `CEP-CONFIG.gs:824,846` |
| G | Filtro de região operacional (normais) não implementado | `CEP-APIBACK.gs:1263` |
| H | Busca progressiva 45→60→90 dias não implementada | `CEP-APIBACK.gs:1274` |

### Próximas etapas (plano completo em seção 15 do escopo-equivalencia)

1. Confirmar valores de config no Supabase via MCP (P11)
2. Helper de origem por dia/equipe (puro)
3. Helper de delta por slot com OSRM table injetado
4. Mudar interface de `gerarCandidatosComDisponibilidadeRealV2` para km por slot
5. Corrigir limite KmBase por pontos
6. Corrigir critério de hora marcada
7. Adicionar condicional de especial/premium
8. Testes unitários
9. Integração na rota diagnóstica com nova flag
10. Validação manual contra legado

---

## 17. Documentação relacionada

- `docs/procurar-datas-fixtures.md` — Fixtures de teste
- `docs/procurar-datas-contratos-payloads.md` — Contratos de payload
- `docs/procurar-datas-codemap.md` — Mapeamento de código legado
- `docs/procurar-datas-estrutura-candidato.md` — Estrutura de candidato legado
- `docs/procurar-datas-v2-plano-comparacao-operacional.md` — Plano técnico detalhado para a futura comparação operacional legado × v2 (entradas, lacunas, algoritmo, critérios de aprovação, sequência segura)
- `docs/procurar-datas-v2-plano-distancia-osrm.md` — Plano técnico de análise sobre integração de distância/OSRM/encaixe na rota: gargalo `kmAdicionalNaRotaM`, diferença entre Haversine/OSRM/delta de inserção, perigo do fallback `0`, estratégia de três estados, critérios de aprovação
- `docs/procurar-datas-v2-mapeamento-agenda-shag.md` — Mapeamento da agenda real (`shAg`): colunas, índices, extração de endereço/CEP, geocoding, estrutura `pontos[]`, pipeline `coletarPontosDoDia` → `rotaOtimizada` → cálculo de delta, riscos, fixtures adicionais necessárias, sequência segura de implementação
- `docs/procurar-datas-escopo-equivalencia-legado-v2.md` — **Contrato de migração (Frente 0 / Controle).** Documento criado em 2026-06-17. Define escopo, fonte de verdade, o que pode melhorar, o que não pode mudar, frentes de trabalho, mapa legado × v2 com status por área, papel do OSRM e Haversine, critérios de aceite, riscos, decisões tomadas e pendentes, e regra obrigatória de consulta ao legado. A migração passa a ter **checklist formal legado × v2** rastreável. Deve ser lido no início de qualquer tarefa sobre `/procurar-datas`.


---

## 19. Frente 2 / meio - km adicional real controlado (2026-06-17)

Criado o helper calcularKmAdicionalRealControladoV2 e integrado o bloco opcional diagnosticoKmAdicionalRealControlado na rota POST /api/procurar-datas/v2/diagnostico.

Flag: usarKmAdicionalRealControladoDiagnostico: true.

Fluxo controlado:
1. resolve origem operacional com resolverOrigemOperacionalV2;
2. parseia pontos de agenda enviados no body diagnostico;
3. descarta pontos sem coordenada conforme P4;
4. calcula matriz OSRM /table via cliente injetado;
5. calcula delta prev -> novo + novo -> next - prev -> next;
6. se OSRM falhar ou retornar distancia invalida, usa fallback Haversine conforme P3.

Contencao:
- Nao altera frontend.
- Nao altera /api/procurar-datas/pesquisar.
- Nao altera ranking final de producao.
- Nao altera banco.
- kmAdicionalNaRotaDiagnosticoM do body foi isolado e nao alimenta candidatos reais. No modo controlado, candidatos reais diagnosticos recebem apenas o km calculado pelo novo bloco.

Testes:
- calcular-km-adicional-real-controlado.test.ts cobre delta simples, melhor insercao, origem deposito/casa, descarte de ponto sem coordenada, fallback OSRM/Haversine e retorno em metros.
- route.test.ts cobre isolamento do valor manual e uso do valor calculado no modo controlado.

---

## 22. Frente 3 / direita — validação manual DevTools de diagnosticoMapaKmAdicionalPorSlot (2026-06-17 → 2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

#### Histórico

1. **Primeira rodada** (snippets com payload incorreto): HTTP 200, ok:true, mas `diagnosticoMapaKmAdicionalPorSlot: null`. Causa: campos enviados dentro de objeto `diagnostico` aninhado; a rota lê `bodyDiagnostico` como cast do próprio body — campos devem estar no root.
2. **Probe corrigido**: campos no root do body → HTTP 200, bloco presente, `mapa: { "2026-06-29::EQUIPE 1": 4481 }`, delta positivo.
3. **Snippets corrigidos S1–S5 executados**: todos aprovados.

#### Payload correto

Campos no root do body (NÃO dentro de um objeto `diagnostico`):

```js
const body = {
  dataInicial: '2026-06-29',
  destLat: -25.4747897,
  destLng: -49.2367902,
  destDisplay: '...',
  usarMapaKmAdicionalPorSlotDiagnostico: true,
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 8000,
  slotsAgendaDiagnostica: [...],
  kmAdicionalNaRotaDiagnosticoM: 999999, // quando usado
}
```

#### Resultados S1–S5

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| S1 — Principal | 3 slots (2 datas × 2 equipes), OSRM real | 3 chaves distintas, 4481m cada, `osrm-table-diagnostico`, contadores 3/3/3 | Múltiplos slots ✅ |
| S2 — Delta positivo | Ponto de agenda fora do corredor depósito→destino | 5997m em ambos os slots, `osrm-table-diagnostico` | Delta > 0 ✅ |
| S3 — P4 por slot | Slot com ponto sem coord no cache | `descartados=1` (motivo `sem_coordenadas_cache`), `ok:true`, slots independentes | P4 por slot ✅ |
| S4 — P3 por slot | OSRM URL inválida | `haversine-fallback-legado-diagnostico`, 3557m, `ok:true`, 860ms | P3 por slot ✅ |
| S5 — Isolamento | `kmAdicionalNaRotaDiagnosticoM: 999999` | Mapa: 4481m, contaminado: false | Isolamento ✅ |

**Observação S3:** O primeiro slot também apresentou `descartados=1`, embora o snippet pretendesse ter cache para ele. Observação de fixture/cache do snippet, não falha da regra P4.

#### Conclusão geral

- `diagnosticoMapaKmAdicionalPorSlot` validado manualmente.
- Múltiplos slots, delta positivo, P4, P3 e isolamento — todos validados.
- Produção, frontend, ranking final e `/api/procurar-datas/pesquisar` não afetados.
- Próxima etapa permanece diagnóstica/controlada.

Produção, frontend, banco e ranking final não alterados. Sem commit.

---

## 23. Frente 3 / direita — validação manual DevTools de diagnosticoAplicacaoMapaKmPorSlotEmCandidatos (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

### Flag e bloco

- **Flag:** `usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico`
- **Bloco JSON:** `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos`
- **Modo:** `aplicacao-mapa-km-por-slot-em-candidatos-diagnostico`
- **Helper:** `aplicarMapaKmAdicionalPorSlotEmCandidatosDiagnosticoV2`
- **Campo de amostra:** `amostraCandidatosDepois`

### Payload correto

Campos no **root do body** (não dentro de `diagnostico`):

```js
const body = {
  dataInicial: '2026-06-15',
  tempoNecessario: '00:40',
  destLat: -25.42,
  destLng: -49.27,
  // flag do mapa
  usarMapaKmAdicionalPorSlotDiagnostico: true,
  osrmBaseUrlDiagnostico: 'https://osrm.lebebe.cloud',
  osrmTimeoutMsDiagnostico: 8000,
  slotsAgendaDiagnostica: [...],
  // flag de aplicacao
  usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico: true,
  kmAdicionalNaRotaDiagnosticoM: 999999, // quando usado (isolamento)
}
```

### Resultados A–E

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| A — Caminho feliz | Ambas flags ativas, slots batem com candidatos | HTTP 200, mapa ok, aplicação ok, 3/8 candidatos com km aplicado (4481m), 5/8 sem chave, `amostraCandidatosDepois` confirmado | Aplicação ok ✅ |
| B — Aplicação sem mapa | Aplicação ligada, mapa desligado | HTTP 200, `executado: false`, motivo claro de mapa ausente, resposta não quebra | Motivo claro ✅ |
| C — Isolamento km manual | `kmAdicionalNaRotaDiagnosticoM: 999999` | HTTP 200, mapa ok, aplicação ok, contaminado: false, nenhum candidato com 999999 | Isolamento ✅ |
| D — Flag de aplicação off | Mapa ligado, aplicação off | HTTP 200, bloco aplicação `null`, candidatos originais preservados | Comportamento anterior ✅ |
| E — Slot sem correspondência | Slots que não batem com candidatos | HTTP 200, 10/10 sem chave, `origem: sem-chave-no-mapa`, nenhum valor global aplicado | Sem valor global ✅ |

### Detalhes dos resultados

**A — Caminho feliz:**
- Mapa: `2026-06-29::EQUIPE 1: 4481m`, `2026-06-29::EQUIPE 2: 4481m`, `2026-06-30::EQUIPE 1: 4481m`
- Contadores: `candidatosRecebidos: 8, candidatosComSlotKey: 8, candidatosComKmAplicado: 3, candidatosSemChaveNoMapa: 5`
- Candidatos com chave: `kmAdicionalNaRotaM: 4481`, `origem: mapa-slot-diagnostico`, `kmAdicionalAplicadoPorMapaSlot: true`
- Candidatos sem chave: `kmAdicionalNaRotaM: null`, `origem: sem-chave-no-mapa`, `kmAdicionalAplicadoPorMapaSlot: false`

**B — Aplicação sem mapa:**
- Motivo: `Mapa de kmAdicionalNaRotaM por slot nao disponivel. Ative usarMapaKmAdicionalPorSlotDiagnostico para calcular o mapa antes.`

**C — Isolamento:**
- Mapa: `2026-06-15::EQUIPE 1: 9597m`, `2026-06-16::EQUIPE 1: 9597m`
- Contadores: `candidatosRecebidos: 10, candidatosComSlotKey: 10, candidatosComKmAplicado: 4, candidatosSemChaveNoMapa: 6`
- `kmAdicionalNaRotaDiagnosticoM` enviado: 999999
- Contaminado por 999999: **false**

**D — Flag off:**
- Bloco aplicação: `null`
- Candidatos originais permanecem sem aplicação do mapa.

**E — Sem correspondência:**
- Mapa: `{}`
- Contadores: `candidatosRecebidos: 10, candidatosComSlotKey: 10, candidatosComKmAplicado: 0, candidatosSemChaveNoMapa: 10`
- Origem nos candidatos: `sem-chave-no-mapa`
- Aplicou valor global absurdo: **false**

### Conclusão geral

- `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` validado manualmente.
- `usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico` executa corretamente.
- Bloco é apenas diagnóstico; `producaoAfetada` permaneceu false.
- Mapa aplicado aos candidatos somente quando há `slotKey` correspondente.
- Candidatos sem chave não recebem valor global.
- `kmAdicionalNaRotaDiagnosticoM` global/manual não contamina a aplicação.
- Flag off mantém comportamento anterior.
- Aplicação ligada sem mapa retorna motivo claro.
- Produção, frontend, ranking final e `/api/procurar-datas/pesquisar` não afetados.

### Observação importante

Os candidatos continuam com `tipo`/`elegivel` da classificação anterior. Esta etapa apenas aplica o `kmAdicionalNaRotaM` nos candidatos diagnósticos. A próxima etapa da Frente 2 será reclassificar candidatos usando o `kmAdicionalNaRotaM` aplicado pelo mapa e comparar o efeito com o legado Apps Script.

---

## 21. Frente 3 / direita — validação manual DevTools de diagnosticoKmAdicionalRealControlado (2026-06-17)

> ✅ Validação executada e aprovada pelo usuário via DevTools.

Flag: `usarKmAdicionalRealControladoDiagnostico: true`  
Bloco no JSON: `diagnosticoKmAdicionalRealControlado`

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| 1 — Normal | dia útil, 3 pontos, OSRM real | ok:true, `osrm-table-diagnostico`, 0m | P2 ✅ |
| 2 — Sem coord | 3 pontos, 1 sem cache | ok:true, 1 descartado, pontosValidos:2 | P4 ✅ |
| 3 — Isolamento | `kmAdicionalNaRotaDiagnosticoM: 999999` | bloco retornou 0m ≠ 999999 | isolamento ✅ |
| 4 — Fallback | OSRM URL inválido | ok:true, `haversine-fallback-legado-diagnostico` | P3 ✅ |

**Observação obrigatória — delta 0m:** todos os cenários retornaram `kmAdicionalNaRotaM = 0m`. Isso valida o plumbing mas **não é suficiente para produção**. Antes de conectar à cadeia de candidatos real, é necessário validar pelo menos um cenário com delta positivo/não-zero e comparar com o legado. Essa pendência **não bloqueia** a próxima etapa diagnóstica (mapa por slot `(dataISO, equipe)`).

Produção, frontend, banco e ranking final não alterados. Sem commit.

---

## 20. Checkpoint Frente 0 — Nota de liberação (2026-06-17)

> Frente 1 consolidada. Frente 2 liberada para primeira implementação controlada. Frente 3 será usada para validação diagnóstica.

**Frente 1 / esquerda — consolidada:**
- P1 (equivalência OSRM), P2 (decisão `/table`), P3 (fallback Opção A), P4 (ponto sem coordenada), P7 (coords depósito/casas), P8 (hora marcada), P9 (limite sábado), P10 (quantidade resultados), P11 (limites km no Supabase) — todos resolvidos.
- Helper `resolverOrigemOperacionalV2` implementado e testado (25 testes).
- Base de origem/configuração validada no Supabase (12 chaves confirmadas).

**Frente 2 / meio — avancando em modo controlado:**
- Bloco `diagnosticoKmAdicionalRealControlado` implementado (valor unico por slot).
- Mapa por slot `(dataISO, equipe) -> kmAdicionalNaRotaM` implementado em `calcular-mapa-km-adicional-por-slot.ts`. Validado via DevTools S1-S5: delta positivo confirmado (5997m), P3/P4 validadas, isolamento confirmado.
- Bloco `diagnosticoMapaKmAdicionalPorSlot` integrado na rota `/v2/diagnostico` com flag `usarMapaKmAdicionalPorSlotDiagnostico`.
- Aplicacao do mapa em candidatos diagnosticos implementada em `aplicar-mapa-km-adicional-por-slot-em-candidatos.ts`.
- Bloco `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` integrado na rota com flag `usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico`.
- 16 testes no helper mapa + 18 testes no helper aplicacao + 10 testes de rota (48-57). Total rota: 57 testes passando.
- Typecheck: 1 erro preexistente em `osrm-route-client-diagnostico.test.ts:95` (TS2352, fora do escopo). Nenhum erro novo.
- Proximo passo: reclassificar candidatos com `kmAdicionalNaRotaM` do mapa e comparar tipos/elegibilidade com legado.
- Producao, frontend e ranking final permanecem inalterados.

**Frente 3 / direita — ativa como apoio:**
- Rota `/api/procurar-datas/v2/diagnostico` continua como plataforma de validação.
- Flags disponíveis: `usarKmAdicionalRealControladoDiagnostico`, `usarEquivalenciaOsrmRouteVsTableDiagnostico`, `usarMapaKmAdicionalPorSlotDiagnostico`, `usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico`.
- DevTools e comparação com legado serão usados para validar cada etapa da Frente 2.

**Documentação atualizada:**
- `docs/procurar-datas-escopo-equivalencia-legado-v2.md` — secao 19 (aplicacao do mapa em candidatos) adicionada.
- `docs/procurar-datas-motor-v2-progresso.md` — tabela de helpers e secao 20 atualizadas.

---

## 24. Reclassificacao de candidatos com kmAdicionalNaRotaM do mapa por slot (2026-06-18)

### O que foi feito

- Criado helper `reclassificarCandidatosComKmMapaSlotDiagnosticoV2` em `src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.ts`.
- Helper puro: recebe candidatos com km aplicado, config e tempoNecessarioMin. Reclassifica apenas candidatos com `kmAdicionalAplicadoPorMapaSlot: true` usando `classificarCandidatoOperacionalV2`. Compara tipo/elegivel antes x depois.
- Bloco `diagnosticoReclassificacaoComKmMapaSlot` integrado na rota `POST /v2/diagnostico`.
- Flag: `usarReclassificacaoComKmMapaSlotDiagnostico`.
- Dependencia: requer `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` executado e ok.
- `kmAdicionalNaRotaDiagnosticoM` nao contamina (isolamento por interface).
- Contadores: candidatosRecebidos, candidatosComKmAplicado, candidatosSemKmAplicado, candidatosReclassificados, candidatosComTipoAlterado, candidatosComElegibilidadeAlterada, candidatosComErro, candidatosSemChaveNoMapa.
- Amostra comparativa: ate 10 candidatos com tipoAntes/tipoDepois, elegivelAntes/elegivelDepois, mudouTipo, mudouElegibilidade, motivosAntes, motivosDepois.

### Testes

- 16 testes unitarios em `reclassificar-candidatos-com-km-mapa-slot.test.ts`.
- 10 testes de rota (58-67) em `route.test.ts`. Total rota: 67 testes passando.
- Typecheck: 1 erro preexistente fora do escopo. Nenhum erro novo.

### Arquivos criados/alterados

| Arquivo | Acao |
|---------|------|
| `src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.ts` | Criado |
| `src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.test.ts` | Criado |
| `src/app/api/procurar-datas/v2/diagnostico/route.ts` | Alterado (import, flag, bloco, resposta, aviso) |
| `src/app/api/procurar-datas/v2/diagnostico/route.test.ts` | Alterado (mock, testes 58-67) |

### Flags disponiveis na rota diagnostica

| Flag | Funcao |
|------|--------|
| `usarDisponibilidadeRealDiagnostica` | Disponibilidade real |
| `usarKmAdicionalAgendaDiagnostico` | Km adicional por agenda |
| `usarKmAdicionalRealControladoDiagnostico` | Km real controlado |
| `usarComparacaoHaversineOsrmDiagnostico` | Comparacao Haversine vs OSRM |
| `usarEquivalenciaOsrmRouteVsTableDiagnostico` | Equivalencia OSRM route vs table |
| `usarMapaKmAdicionalPorSlotDiagnostico` | Mapa km por slot |
| `usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico` | Aplicacao mapa em candidatos |
| `usarReclassificacaoComKmMapaSlotDiagnostico` | **Reclassificacao com km do mapa** |

### Proximo passo

- Validacao manual via DevTools (snippets R1-R5) com dados reais.
- Comparar resultados de reclassificacao com legado Apps Script.
- Producao, frontend e ranking final permanecem inalterados.

---

## 25. Frente 3 / direita — validação manual DevTools de diagnosticoReclassificacaoComKmMapaSlot (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

### Flag e bloco

- **Flag:** `usarReclassificacaoComKmMapaSlotDiagnostico`
- **Bloco JSON:** `diagnosticoReclassificacaoComKmMapaSlot`
- **Modo:** `reclassificacao-com-km-mapa-slot-diagnostico`
- **Helper:** `reclassificarCandidatosComKmMapaSlotDiagnosticoV2`
- **Campo de amostra:** `amostraComparativa`
- **Dependência:** requer `diagnosticoAplicacaoMapaKmPorSlotEmCandidatos` executado e ok

### Resultados R1–R5

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| R1 — Caminho feliz | Ambas flags ativas, slots batem com candidatos | HTTP 200, mapa ok, aplicação ok, reclassificação ok, 5/10 candidatos reclassificados, 1 alteração de tipo, `amostraComparativa` com 10 itens | Reclassificação ok ✅ |
| R2 — Flag off | Reclassificação desligada | HTTP 200, bloco reclassificação `null` | Isolamento por flag ✅ |
| R3 — Sem aplicação | Reclassificação ligada sem aplicação do mapa | HTTP 200, `executado: false`, motivo claro de aplicação ausente | Motivo claro ✅ |
| R4 — Isolamento km manual | `kmAdicionalNaRotaDiagnosticoM: 999999` | HTTP 200, contaminado na aplicação: false, contaminado na reclassificação: false | Isolamento ✅ |
| R5 — Sem correspondência | Slots sem correspondência no mapa | HTTP 200, 10/10 sem chave, 0 reclassificados, 0 alterações de tipo/elegibilidade, tipoAntes=tipoDepois | Sem valor global ✅ |

### Detalhes dos resultados

**R1 — Caminho feliz:**
- Mapa: `2026-06-29::EQUIPE 1: 3557m`, `2026-06-29::EQUIPE 2: 4481m`, `2026-06-30::EQUIPE 1: 4481m`
- Contadores aplicação: `candidatosRecebidos: 10, candidatosComKmAplicado: 5, candidatosSemChaveNoMapa: 5`
- Contadores reclassificação: `candidatosRecebidos: 10, candidatosComKmAplicado: 5, candidatosReclassificados: 5, candidatosComTipoAlterado: 1, candidatosComElegibilidadeAlterada: 0`
- `amostraComparativa`: 10 itens com tipoAntes/tipoDepois, elegivelAntes/elegivelDepois, mudouTipo, mudouElegibilidade

**R2 — Flag off:**
- Bloco reclassificação: `null`

**R3 — Sem aplicação:**
- Motivo: `Mapa de kmAdicionalNaRotaM por slot nao aplicado em candidatos. Ative usarMapaKmAdicionalPorSlotNaClassificacaoDiagnostico e usarMapaKmAdicionalPorSlotDiagnostico antes.`

**R4 — Isolamento:**
- Mapa: `2026-06-29::EQUIPE 1: 4481m`, `2026-06-30::EQUIPE 1: 4481m`
- Contadores aplicação: `candidatosRecebidos: 10, candidatosComKmAplicado: 4, candidatosSemChaveNoMapa: 6`
- Contadores reclassificação: `candidatosRecebidos: 10, candidatosComKmAplicado: 4, candidatosReclassificados: 4, candidatosComTipoAlterado: 1`
- Contaminado na aplicação por 999999: **false**
- Contaminado na reclassificação por 999999: **false**

**R5 — Sem correspondência:**
- Mapa: `{}`
- Contadores aplicação: `candidatosRecebidos: 10, candidatosComKmAplicado: 0, candidatosSemChaveNoMapa: 10`
- Contadores reclassificação: `candidatosRecebidos: 10, candidatosComKmAplicado: 0, candidatosReclassificados: 0, candidatosComTipoAlterado: 0`
- Aplicou km em algum candidato: **false**
- Alguem mudou tipo/elegibilidade: **false**
- Amostra aplicação: `kmAdicionalNaRotaM: null, origem: sem-chave-no-mapa, kmAdicionalAplicadoPorMapaSlot: false`
- Amostra reclassificação: `tipoAntes=tipoDepois, elegivelAntes=elegivelDepois, mudouTipo: false, mudouElegibilidade: false`

### Conclusão geral

- `diagnosticoReclassificacaoComKmMapaSlot` validado manualmente.
- `usarReclassificacaoComKmMapaSlotDiagnostico` validada.
- A reclassificação usa o `kmAdicionalNaRotaM` aplicado pelo mapa por slot somente em diagnóstico.
- O bloco compara antes/depois por candidato.
- O bloco registra alteração de tipo/elegibilidade por candidato.
- O bloco respeita a flag off.
- O bloco retorna motivo claro se a aplicação do mapa não foi executada.
- O bloco não usa `kmAdicionalNaRotaDiagnosticoM` global/manual quando há mapa por slot.
- Candidatos sem chave no mapa não recebem km inventado.
- Candidatos sem km aplicado não são reclassificados.
- `producaoAfetada` permaneceu false em todos os cenários.
- Produção, frontend, ranking final e `/api/procurar-datas/pesquisar` não afetados.

### Observação importante

Esta etapa ainda é diagnóstica/controlada. Ela valida a reclassificação dentro da rota `/api/procurar-datas/v2/diagnostico`, mas ainda não libera uso em produção, frontend, ranking final ou `/api/procurar-datas/pesquisar`.

---

## 26. Frente 2 / Meio - equivalencia de classificacao operacional (2026-06-18)

Status: implementado em modo diagnostico/testado. Sem producao.

O helper classificarCandidatoOperacionalV2 foi ajustado para usar limite base equivalente ao legado:
- slot com pontos: kmAdicionalMaxNaRotaM
- slot vazio em dia util: kmMaximoNaSemanaM
- slot vazio em sabado: kmMaximoNoSabadoM

Especial e premium agora sao calculados como limiteBaseM + 5000 e limiteBaseM + 10000. As configs especiais/premium funcionam como guardas de ativacao (> 0).

Propagacao diagnostica:
- gerarCandidatosComDisponibilidadeRealV2 aceita slotTemPontosPorDataEquipe e preserva default true quando o dado nao existe.
- A rota /api/procurar-datas/v2/diagnostico deriva slotTemPontos de slotsAgendaDiagnostica[].linhasAgenda.length > 0.
- reclassificarCandidatosComKmMapaSlotDiagnosticoV2 recebe slotTemPontos e retorna limiteBaseM, limiteEspecialM e limitePremiumM por candidato.

Testes:
- classificacao-candidato.test.ts cobre slot com pontos, slot vazio dia util, slot vazio sabado e guardas zeradas.
- reclassificar-candidatos-com-km-mapa-slot.test.ts cobre base curta, semana e sabado.
- route.test.ts cobre propagacao slotTemPontos=false do body para a aplicacao do mapa.

Validacoes:
- npm run test -- src/lib/procurar-datas/motor/classificacao-candidato.test.ts src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts -> 4 arquivos, 175 testes passando.
- npx tsc --noEmit --pretty -> falha somente em erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95.

Nao alterado:
- frontend
- /api/procurar-datas/pesquisar
- ranking final
- Apps Script
- Supabase/banco
- hora marcada
- commit

---

## 27. Frente 3 / direita — validação manual DevTools de equivalência de classificação operacional (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

### O que foi validado

Correção da classificação operacional v2 para equivalência com legado Apps Script em:
- Limites dinâmicos de normal/especial/premium (base + 5000m / base + 10000m)
- Comportamento de slot vazio (dia útil: 150000m, sábado: 45000m)
- Propagação de `slotTemPontos` nos blocos diagnósticos
- Guardas de ativação especial/premium (> 0)

### Resultados L1–L3

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| L1 — Classificação sintética / slot com pontos | Slot com pontos, classificação sintética | HTTP 200, slotTemPontos: true, limiteBaseM: 5000, limiteEspecialM: 10000, limitePremiumM: 15000, km=2500→normal, km=7500→especial | Limites ok ✅ |
| L2 — Slot vazio em dia útil | Slot vazio dia útil com reclassificação | HTTP 200, slotTemPontos: false, limiteBaseM: 150000, limiteEspecialM: 155000, limitePremiumM: 160000, km=9597→normal, validação base semana 150000: true | Base semana ok ✅ |
| L3 — Slot vazio no sábado | Slot vazio sábado com reclassificação | HTTP 200, slotTemPontos: false, limiteBaseM: 45000, limiteEspecialM: 50000, limitePremiumM: 55000, km=10445→normal, validação base sábado 45000: true | Base sábado ok ✅ |

### Detalhes dos resultados

**L1 — Classificação sintética / slot com pontos:**
- HTTP 200, ok: true, producaoAfetada: false
- Amostra confirmou para slot com pontos:
  - slotTemPontos: true
  - limiteBaseM: 5000
  - limiteEspecialM: 10000
  - limitePremiumM: 15000
- Candidato com km=2500 ficou normal
- Candidato com km=7500 ficou especial
- Conclusão: A v2 passou a calcular especial/premium como derivados do limiteBaseM. Para slot com pontos, os limites ficaram equivalentes ao legado (normal até 5000m, especial até 10000m, premium até 15000m).

**L2 — Slot vazio em dia útil:**
- Reclassificação executada: true, ok: true
- Contadores: candidatosRecebidos: 10, candidatosComKmAplicado: 3, candidatosReclassificados: 3, candidatosComTipoAlterado: 1
- Candidato validado (2026-06-15, EQUIPE 1):
  - slotTemPontos: false
  - kmAdicionalNaRotaM: 9597
  - limiteBaseM: 150000
  - limiteEspecialM: 155000
  - limitePremiumM: 160000
  - tipoAntes: normal, tipoDepois: normal, mudouTipo: false
  - elegivelAntes: true, elegivelDepois: true, mudouElegibilidade: false
- Validação final: base semana 150000: true
- Conclusão: Para slot vazio em dia útil, a v2 agora usa KM MAXIMO NA SEMANA como limite base, igual ao legado. Corrige divergência bloqueante.

**L3 — Slot vazio no sábado:**
- Aplicação: candidatosRecebidos: 10, candidatosComKmAplicado: 3
- Reclassificação executada: true, ok: true
- Contadores: candidatosRecebidos: 10, candidatosComKmAplicado: 3, candidatosReclassificados: 3, candidatosComTipoAlterado: 1
- Candidato validado (2026-06-20, EQUIPE 1):
  - slotTemPontos: false
  - kmAdicionalNaRotaM: 10445
  - limiteBaseM: 45000
  - limiteEspecialM: 50000
  - limitePremiumM: 55000
  - tipoAntes: normal, tipoDepois: normal, mudouTipo: false
  - elegivelAntes: true, elegivelDepois: true, mudouElegibilidade: false
- Validação final: base sábado 45000: true
- Conclusão: Para slot vazio no sábado, a v2 agora usa KM MAXIMO NO SÁBADO como limite base, igual ao legado.

### Observação sobre alteração de tipoAntes para tipoDepois

Nos testes L2/L3 houve casos sintéticos em que tipoAntes era especial e tipoDepois virou normal. Isso é esperado e confirma a correção: antes a classificação usava limite base errado; depois, com base correta de 150000m ou 45000m, o candidato passou a ser normal, alinhando com o legado.

### Conclusão geral

- L1, L2 e L3 aprovados em DevTools.
- A correção de limites dinâmicos foi validada manualmente.
- slotTemPontos foi propagado e observado nos blocos diagnósticos.
- Slot com pontos usa base 5000m.
- Slot vazio dia útil usa base 150000m.
- Slot vazio sábado usa base 45000m.
- Especial = base + 5000m.
- Premium = base + 10000m.
- kmAdicionalMaxNaRotaEspecialM e kmAdicionalMaxNaRotaPremiumM agora funcionam como guardas de ativação.
- producaoAfetada permaneceu false.
- Produção, frontend, ranking final e /api/procurar-datas/pesquisar não foram afetados.
- Hora marcada segue fora desta fatia e permanece como próxima pendência.

### Testes executados

- npm run test -- src/lib/procurar-datas/motor/classificacao-candidato.test.ts src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts → 4 arquivos, 175 testes passando.
- npx tsc --noEmit --pretty → falha somente em erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352).

---

## 28. Frente 2 / Meio - hora marcada nao exclusiva (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

Resumo:
- Confirmado no legado Apps Script que hora marcada usa `HORA_MARCADA_HORAS_A_MAIS > 0`.
- Confirmado calculo legado: `slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)`.
- Confirmado comportamento nao exclusivo: hora marcada fica em lista propria (`porDiaHoraMarcada`) sem substituir a classificacao primaria normal/especial/premium.
- Implementado no v2 como flag diagnostica `horaMarcada/elegivelHoraMarcada`, preservando `tipo`.

Campos adicionados/propagados:
- Classificacao: `horaMarcada`, `elegivelHoraMarcada`, `motivoHoraMarcada`, `slotAvailMin`, `serviceMin`, `horaMarcadaHorasAMais`, `limiteMinimoHoraMarcadaMin`.
- Candidato preliminar: campos de hora marcada em `diagnostico` e valores de tempo em `operacional`.
- Geracao com disponibilidade real: contador `candidatosHoraMarcada` agora usa a flag nao exclusiva.
- Reclassificacao com km do mapa por slot: `horaMarcadaAntes`, `horaMarcadaDepois`, `mudouHoraMarcada`, `slotAvailMin`, `serviceMin`, `horaMarcadaHorasAMais`, `limiteMinimoHoraMarcadaMin`.
- Rota diagnostica: config `horaMarcadaHorasAMais` passada para classificacao, reclassificacao e disponibilidade real; amostras expoem `diagnosticoHoraMarcada`.

Validacoes:
- `npm run test -- src/lib/procurar-datas/motor/classificacao-candidato.test.ts src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts src/lib/procurar-datas/motor/reclassificar-candidatos-com-km-mapa-slot.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 4 arquivos, 183 testes passando.
- `npx tsc --noEmit --pretty` -> falha somente em erro preexistente fora do escopo: `src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95` (TS2352).

Isolamento:
- Sem alteracao em frontend.
- Sem alteracao em `/api/procurar-datas/pesquisar`.
- Sem alteracao em ranking final.
- Sem alteracao em Apps Script legado.
- Sem alteracao em Supabase/banco.

Pendencias:
- Validacao manual DevTools H1-H5.
- Comparacao ampla legado x v2.


## 29. Frente 2 / Meio - hora marcada bloqueio em indisponiveis (2026-06-18)
Status: implementado em modo diagnostico/testado. Nao libera producao.
Resumo:
- Corrigida regra de hora marcada: candidatos classificados como indisponivel nunca terao horaMarcada true ou elegivelHoraMarcada true, mesmo que tenham tempo suficiente.
- O calculo bruto de tempo (horaMarcadaCalculadaPorTempo) e preservado separadamente para diagnostico.
- A elegibilidade final de hora marcada depende de: tipo !== 'indisponivel' AND elegivel === true, alem do calculo de tempo (slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)).
- A flag hora marcada continua nao-exclusiva (candidatos normal/especial/premium podem ter horaMarcada true).

Campos adicionados/propagados:
- Classificacao: horaMarcadaCalculadaPorTempo em detalhes (boolean, indica se o calculo bruto de tempo indica janela suficiente)
- Candidato preliminar: horaMarcadaCalculadaPorTempo em diagnostico
- Reclassificacao: horaMarcadaCalculadaPorTempo em CandidatoReclassificado
- Rota diagnostica: horaMarcadaCalculadaPorTempo em diagnosticoHoraMarcada da amostra

Mudanca de logica:
- calcularHoraMarcadaDiagnostico agora recebe 	ipo e elegivel como parametros
- Apos calcular se o tempo e suficiente, a funcao bloqueia hora marcada se 	ipo === 'indisponivel' ou !elegivel`n- Motivo de bloqueio: 'Candidato indisponivel; hora marcada final bloqueada.'

Validacoes:
- npm test -- classificacao-candidato.test.ts -> 66 testes passaram (incluindo 6 novos testes especificos para hora marcada em indisponiveis)
- npm test -- reclassificar-candidatos-com-km-mapa-slot.test.ts -> 21 testes passaram
- npm test -- route.test.ts -> 112 testes passaram
- npx tsc --noEmit --pretty -> falha somente em erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352)

Isolamento:
- Sem alteracao em frontend.
- Sem alteracao em /api/procurar-datas/pesquisar.
- Sem alteracao em ranking final.
- Sem alteracao em Apps Script legado.
- Sem alteracao em Supabase/banco.

Pendencias:
- Validacao manual DevTools usando snippets fornecidos (verificar que nenhum indisponivel tem horaMarcada true).
- Comparacao ampla legado x v2.

---

## 30. Frente 3 / direita — validação manual DevTools H6/H7 de hora marcada (2026-06-18)

> ✅ Validação manual final executada e aprovada pelo usuário via DevTools (2026-06-18).

### O que foi validado

Correção da regra de hora marcada para equivalência com legado Apps Script em:
- Bloqueio de hora marcada final/ofertável em candidatos indisponíveis
- Bloqueio de hora marcada em candidatos fora do limite normal
- Preservação da não exclusividade (tipo principal não é alterado para hora-marcada)
- Fórmula de tempo: `slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60)`

### Resultados H6–H7

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| H6 — Bloqueio em indisponíveis | Verificar que nenhum candidato indisponível ficou com horaMarcada/elegivelHoraMarcada true | HTTP 200, ok: true, producaoAfetada: false, Total candidatos: 20, Indisponíveis com horaMarcada/elegivelHoraMarcada true: 0 (esperado: 0) | Bloqueio ok ✅ |
| H7 — Não exclusividade | Verificar que candidatos podem ter tipo principal normal e horaMarcada true, sem tipo === "hora-marcada" | HTTP 200, ok: true, producaoAfetada: false, Ofertáveis com hora marcada: 14, Candidatos com tipo === "hora-marcada": 0 (esperado: 0) | Não exclusividade ok ✅ |

### Detalhes dos resultados

**H6 — Bloqueio em indisponíveis:**
- HTTP 200, ok: true, producaoAfetada: false
- Total candidatos inspecionados: 20
- Indisponíveis com horaMarcada/elegivelHoraMarcada true: 0 (esperado: 0)
- Amostras relevantes confirmadas:
  1. Indisponível por tempo insuficiente:
     - tipo: indisponivel, elegivel: false
     - horaMarcada: false, elegivelHoraMarcada: false
     - slotAvailMin: 30, serviceMin: 40, limiteMinimoHoraMarcadaMin: 160
     - motivoHoraMarcada: Tempo disponivel insuficiente para hora marcada.
     - motivos: Tempo disponível insuficiente para o serviço.
  2. Indisponível por equipe inativa/férias:
     - tipo: indisponivel, elegivel: false
     - horaMarcada: false, elegivelHoraMarcada: false
     - slotAvailMin: 240, serviceMin: 40, limiteMinimoHoraMarcadaMin: 160
     - motivoHoraMarcada: Candidato indisponivel; hora marcada final bloqueada.
     - motivos: Equipe inativa. | Motivo: Férias.
  3. Especial fora do limite normal:
     - tipo: especial, elegivel: true
     - horaMarcada: false, elegivelHoraMarcada: false
     - km: 7500, limiteBaseM: 5000
     - slotAvailMin: 240, serviceMin: 40, limiteMinimoHoraMarcadaMin: 160
     - motivoHoraMarcada: Km adicional fora do limite normal para hora marcada.
- Conclusão: A correção passou. Hora marcada final/ofertável não é mais true para candidatos indisponíveis. Também foi confirmado que candidatos fora do limite normal não entram em hora marcada.

**H7 — Não exclusividade:**
- HTTP 200, ok: true, producaoAfetada: false
- Ofertáveis com hora marcada: 14
- Candidatos com tipo === "hora-marcada": 0 (esperado: 0)
- Conclusão: A não exclusividade foi preservada. Candidatos podem continuar com tipo principal normal e, ao mesmo tempo, ter horaMarcada: true. Nenhum candidato teve tipo principal alterado para hora-marcada.

### Conclusão geral

- H6 e H7 aprovados em DevTools.
- A regra de hora marcada está validada em diagnóstico/testes.
- Fórmula de tempo validada: slotAvailMin >= serviceMin + (HORA_MARCADA_HORAS_A_MAIS * 60).
- Indisponível não fica mais com horaMarcada: true ou elegivelHoraMarcada: true.
- Candidato fora do limite normal não entra em hora marcada.
- Não exclusividade preservada.
- Tipo principal nunca vira hora-marcada.
- producaoAfetada permaneceu false.
- Frontend, produção, ranking final e /api/procurar-datas/pesquisar não foram afetados.

### Testes executados

- npm test -- classificacao-candidato.test.ts → 66 testes passaram (incluindo 6 novos testes específicos para hora marcada em indisponíveis)
- npm test -- reclassificar-candidatos-com-km-mapa-slot.test.ts → 21 testes passaram
- npm test -- route.test.ts → 112 testes passaram
- npx tsc --noEmit --pretty → falha somente em erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352).

### Próximo passo recomendado

Comparação ampla legado x v2 para validar equivalência em produção real.

---

## 31. Frente 2 / Meio - comparacao ampla legado x v2 diagnostica (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que foi feito:
- Criado comparador amplo `compararPayloadLegadoComV2Diagnostico` em `src/lib/procurar-datas/motor/comparacao-legado-v2.ts`.
- Integrado bloco opcional `diagnosticoComparacaoLegadoV2` em `src/app/api/procurar-datas/v2/diagnostico/route.ts`.
- Adicionados testes unitarios para 10 cenarios do comparador.
- Adicionados testes da rota para flag ausente/false retornando `null` e flag true retornando resumo.

Contrato do bloco:
- Flag: `usarComparacaoLegadoV2Diagnostico: true`.
- Payload controlado: `legadoComparacaoDiagnostico.candidatos`.
- Tolerancia opcional: `toleranciaKmAdicionalMComparacaoDiagnostico`; padrao 2m.
- Saida: `diagnosticoComparacaoLegadoV2` com `executado`, `ok`, `producaoAfetada`, `modo`, `toleranciaKmAdicionalM`, `resumo`, `divergencias`, `amostras`, `avisos`.
- Sem flag: `diagnosticoComparacaoLegadoV2: null`.

Campos comparados:
- Presenca por `dataISO` + equipe normalizada.
- `tipo`, `elegivel`, `horaMarcada`/`elegivelHoraMarcada`.
- `kmAdicionalNaRotaM`.
- `slotTemPontos`.
- `limiteBaseM`, `limiteEspecialM`, `limitePremiumM`.
- `motivo`/`motivos`.
- `ordem`/`rank` apenas informativo.

Isolamento:
- Nao chama Apps Script real.
- Nao chama `/api/procurar-datas/pesquisar`.
- Nao toca frontend, ranking final, producao, banco ou Supabase.

Validacoes:
- `npm run test -- src/lib/procurar-datas/motor/comparacao-legado-v2.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 2 arquivos, 106 testes passando.
- `npx tsc --noEmit --pretty false` -> falha somente em erro preexistente fora do escopo: `src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95` (TS2352 cast mock -> Response).

Proximo passo recomendado:
- Rodar snippets DevTools C1-C6 com payloads legados controlados reais/representativos antes de qualquer uso em fluxo produtivo.

---

## 32. Frente 3 / direita — validação manual DevTools C0/C1/C2 corrigida de comparação legado × v2 (2026-06-18)

> ✅ Validação manual executada e aprovada pelo usuário via DevTools (2026-06-18).

### O que foi validado

Primeira versão diagnóstica do comparador legado × v2 em modo controlado:
- Baseline espelhado (C0): payload legado espelhando a própria v2 retorna sem divergências
- Divergência de tipo controlada (C1 corrigido): alteração de tipo é detectada corretamente como bloqueante
- Candidato ausente na v2 (C2 corrigido): candidato presente no legado e ausente na v2 é detectado corretamente como bloqueante

### Resultados C0–C2

| Snippet | Cenário | Resultado | Valida |
|---|---|---|---|
| C0 — Baseline espelhado | Payload legado espelhando a própria v2 | HTTP 200, ok: true, divergencias: 0, candidatosLegado: 10, candidatosV2: 13, chavesComparadas: 8, presentesNosDois: 8, apenasNoLegado: 0 | Baseline ok ✅ |
| C1 corrigido — Divergência de tipo | Alterar tipo de 1 candidato no payload legado | HTTP 200, ok: false, divergenciasTipo: 1, chave: 2026-06-15::EQUIPE 1, campo: tipo, legado: premium, v2: normal, severidade: bloqueante | Detecção de tipo ok ✅ |
| C2 corrigido — Candidato ausente na v2 | Adicionar candidato impossível em 2099-01-01 no payload legado | HTTP 200, ok: false, apenasNoLegado: 1, chave: 2099-01-01::EQUIPE 1, campo: presenca, severidade: bloqueante | Detecção de ausência ok ✅ |

### Detalhes dos resultados

**C0 — Baseline espelhado:**
- HTTP 200, ok: true, divergencias: 0
- Resumo retornado: candidatosLegado: 10, candidatosV2: 13, chavesComparadas: 8, presentesNosDois: 8, apenasNoLegado: 0
- Avisos observados (confirmam limitação da chave atual):
  - legado[8] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
  - legado[9] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
  - v2[8] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
  - v2[9] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
  - v2[10] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
  - v2[11] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
  - v2[12] duplicado para chave 2026-06-15::EQUIPE 1; preservado primeiro candidato.
- Conclusão: O comparador consegue receber payload legado equivalente à própria v2 e retornar sem divergências. A validação passou, mas os avisos confirmam uma limitação da primeira versão: a chave dataISO + equipe ainda é simplificada e pode colapsar candidatos duplicados.

**C1 corrigido — Divergência de tipo:**
- HTTP 200, ok: false, divergenciasTipo: 1
- Divergência retornada:
  - chave: 2026-06-15::EQUIPE 1
  - campo: tipo
  - legado: premium
  - v2: normal
  - tipoDivergencia: tipo
  - severidade: bloqueante
  - observacao: Tipo operacional diferente.
- Conclusão: O comparador detecta corretamente divergência de tipo como bloqueante.

**C2 corrigido — Candidato ausente na v2:**
- HTTP 200, ok: false, apenasNoLegado: 1
- Divergência retornada:
  - chave: 2099-01-01::EQUIPE 1
  - campo: presenca
  - v2: null
  - tipoDivergencia: ausente-na-v2
  - severidade: bloqueante
  - observacao: Candidato existe no legado e nao existe na v2 diagnostica.
- Conclusão: O comparador detecta corretamente candidato presente no legado e ausente na v2 como divergência bloqueante.

### Conclusão geral

- C0, C1 corrigido e C2 corrigido aprovados em DevTools.
- O comparador legado × v2 está validado como primeira ferramenta diagnóstica controlada.
- Baseline espelhado sem divergência retorna ok: true.
- Divergência de tipo é detectada corretamente.
- Candidato ausente na v2 é detectado corretamente.
- producaoAfetada permaneceu false.
- O comparador não chama Apps Script real.
- O comparador não altera frontend, produção, ranking final ou /api/procurar-datas/pesquisar.

### Limitação conhecida

A chave atual dataISO + equipe é simplificada e gera avisos de duplicidade quando há múltiplos candidatos na mesma data/equipe. Nesta primeira versão, o comparador preserva o primeiro candidato e registra avisos. Antes de usar o comparador para comparação real ampla, é recomendado melhorar a chave/fonte v2 oficial para reduzir ou eliminar duplicidades.

### Testes executados

- npm run test -- src/lib/procurar-datas/motor/comparacao-legado-v2.test.ts src/app/api/procurar-datas/v2/diagnostico/route.test.ts → 2 arquivos, 106 testes passando.
- npx tsc --noEmit --pretty false → falha somente em erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352).

### Próximo passo recomendado

Melhorar chave/fonte do comparador antes de usar payload legado real amplo.


---

## 33. Frente 2 / Meio - melhoria chave/fonte comparador legado x v2 (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que foi feito:
- Adicionado campo opcional comparacaoKey em CandidatoComparacaoLegadoV2.
- Refatorada indexarCandidatosComparacao para rastrear colisoes por chave, retornar estrategias usadas e registrar duplicidades explicitamente.
- Adicionados tipos EstrategiaChaveComparacaoLegadoV2 e DuplicidadeChaveComparacao.
- ComparacaoAmplaLegadoV2Output: adicionado estrategiaChave, duplicidades, chavesDuplicadasLegado/V2 no resumo.
- Semantica de ok alterada: ok=false apenas para divergencia bloqueante OU comparacaoKey duplicada (divergencia avaliar nao bloqueia mais).
- Rota: adicionado fonteV2ComparacaoDiagnostico com validacao; fonte invalida retorna executado:false/ok:false com motivo claro.
- Rota: bloco expoe estrategiaChave, duplicidades e fonteV2ComparacaoDiagnostico no resultado.

Estrategia de chave:
- Se comparacaoKey presente: usa comparacaoKey (deve ser unica; duplicidade invalida entrada com ok:false).
- Se comparacaoKey ausente: usa fallback dataISO normalizado + equipe normalizada.
- estrategiaChave: "comparacaoKey" | "dataISO-equipe-fallback" | "mista".

Tratamento de duplicidades:
- Duplicidade com comparacaoKey: [ERRO-ENTRADA] no aviso, ok:false, duplicidades.{legado|v2} populados.
- Duplicidade por fallback dataISO+equipe: [AVISO] no aviso, nao invalida sozinha, duplicidades populados.
- Em ambos os casos: chave, origem, quantidade, indices e observacao expostos.

Fontes v2 suportadas (contrato):
- diagnostico-candidatos (default, candidatos sinteticos)
- disponibilidade-real (contrato valido, usa mesmos candidatos sinteticos nesta versao)
- reclassificacao-com-km-mapa-slot (contrato valido, usa mesmos candidatos sinteticos nesta versao)

Validacoes:
- npx vitest run comparacao-legado-v2.test.ts route.test.ts -> 2 arquivos, 124 testes passando
- npx tsc --noEmit --pretty false -> falhou apenas no erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352)

Isolamento:
- Sem alteracao em frontend.
- Sem alteracao em /api/procurar-datas/pesquisar.
- Sem alteracao em ranking final.
- Sem alteracao em Apps Script legado.
- Sem alteracao em Supabase/banco.

Pendencias:
- Validacao manual DevTools A1-A5.
- Payload legado real pequeno ainda nao enviado.
- Fontes disponibilidade-real e reclassificacao-com-km-mapa-slot ainda usam candidatos sinteticos (mesmos que diagnostico-candidatos).


---

## 34. Frente 2 / Meio - geracao de comparacaoKey no lado v2 (2026-06-18)

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que foi feito:
- Adicionado helper gerarComparacaoKeyV2Diagnostico em comparacao-legado-v2.ts.
- Formato da chave: dataISO::equipeNormalizada::fonteV2::ordemLocal.
- ordemLocal e um contador dentro do grupo (dataISO, equipeNormalizada).
- Normaliza equipe (trim, uppercase, espacos unicos).
- Nao usa tipo na chave para preservar deteccao de divergencia de tipo.
- Chama helper na rota apos montar candidatosComparacaoV2Diagnostico.
- Expos comparacaoKey em amostras.v2 (automatico pelo comparador).
- Adicionados 7 testes unitarios para gerarComparacaoKeyV2Diagnostico.
- Adicionados 7 testes de rota para validar comportamento.

Como a chave e gerada:
- Formato: dataISO::equipeNormalizada::fonteV2::ordemLocal
- Exemplo: 2026-06-15::EQUIPE 1::diagnostico-candidatos::1
- ordemLocal reinicia para cada grupo (dataISO, equipeNormalizada)
- Se dataISO ou equipe ausentes: comparacaoKey: null

Estrategia de chave:
- Se legado e v2 ambos usam comparacaoKey: estrategiaChave = comparacaoKey
- Se legado usa comparacaoKey e v2 usa fallback: estrategiaChave = mista
- Se ambos usam fallback: estrategiaChave = dataISO-equipe-fallback
- Duplicidades por dataISO+equipe foram eliminadas na v2 (ordemLocal garante unicidade)

Validacoes:
- npx vitest run comparacao-legado-v2.test.ts route.test.ts -> 2 arquivos, 138 testes passando
- npx tsc --noEmit --pretty false -> falhou apenas no erro preexistente fora do escopo: src/lib/procurar-datas/motor/osrm-route-client-diagnostico.test.ts:95 (TS2352)

Isolamento:
- Sem alteracao em frontend.
- Sem alteracao em /api/procurar-datas/pesquisar.
- Sem alteracao em ranking final.
- Sem alteracao em Apps Script legado.
- Sem alteracao em Supabase/banco.

Pendencias:
- Validacao manual DevTools K0-K3.
- Payload legado real pequeno ainda nao enviado.
- Para payload legado real, o lado legado deve usar a mesma logica de geracao de comparacaoKey para casar corretamente.

Limitacoes restantes:
- A chave gerada e diagnostica (ordemLocal). Para payload legado real, o lado legado deve usar a mesma logica.
- Se legado nao gerar comparacaoKey com o mesmo formato, a comparacao pode cair em estrategia mista.

Proximo passo recomendado: Executar snippets DevTools K0-K3 para validar comparacaoKey v2, estrategiaChave, duplicidades e divergencia de tipo. Depois disso, enviar payload legado real pequeno.

---

## 35. Frente 3 / direita: validação manual K0–K3 de comparacaoKey v2 (2026-06-18)

> ✅ Validação manual executada e aprovada pelo usuário via DevTools (2026-06-18).

### 35.1 K0 — inspeção da comparacaoKey

Resultado:
- `K0 comparacaoKey preenchido: true`
- `K0 primeira key: 2026-06-15::EQUIPE 1::diagnostico-candidatos::1`

Conclusão:
- A v2 está gerando `comparacaoKey` preenchida nas amostras.
- O formato observado está correto: `dataISO::equipeNormalizada::fonteV2::ordemLocal`

### 35.2 K1 — baseline espelhado com comparacaoKey

Resultado:
- `K1 estrategiaChave: comparacaoKey`
- `K1 chavesDuplicadasLegado: 0`
- `K1 chavesDuplicadasV2: 0`

Conclusão:
- Quando legado e v2 usam `comparacaoKey`, o comparador usa a estratégia `comparacaoKey`.
- Não houve duplicidade no legado.
- Não houve duplicidade na v2.

### 35.3 K2 — divergência de tipo com comparacaoKey

Resultado:
- `K2 divergenciasTipo: 10`
- `K2 divergencia tipo campo: tipo`

Conclusão:
- A divergência de tipo foi detectada corretamente como divergência de `tipo`.
- O comparador não tratou o candidato como ausente na v2.
- Isso confirma que a `comparacaoKey` está servindo corretamente para parear candidatos.

### 35.4 K3 — duplicidade de comparacaoKey no legado

Resultado:
- `K3 ok: false`
- `K3 chavesDuplicadasLegado: 1`
- `K3 duplicidades.legado` preenchido com:
  - `chave: slot-dup`
  - `origem: legado`
  - `quantidade: 2`
  - observação: `Chave comparacaoKey duplicada em legado; comparacaoKey deve ser unica.`

Conclusão:
- O comparador detecta duplicidade de `comparacaoKey` no legado.
- Entrada inválida do legado é bloqueada corretamente com `ok: false`.
- A duplicidade é reportada de forma clara em `duplicidades.legado`.

### 35.5 Conclusão geral

- K0 aprovado.
- K1 aprovado.
- K2 aprovado.
- K3 aprovado.
- `comparacaoKey` v2 implementada e validada manualmente.
- Estratégia `comparacaoKey` validada.
- Duplicidade no legado detectada corretamente.
- Divergência de tipo detectada como `tipo`, não como ausência.
- Produção não afetada.
- Frontend segue bloqueado.
- Ranking final segue bloqueado.
- `/api/procurar-datas/pesquisar` usando v2 segue bloqueado.

Status da pendência:
- A pendência de validação manual K0–K3 da `comparacaoKey` v2 está resolvida.

Próximo passo recomendado:
Frente 2 / meio — Opção B:
- usar 1 payload legado real pequeno;
- converter para `legadoComparacaoDiagnostico.candidatos`;
- gerar `comparacaoKey` no mesmo formato da v2;
- comparar contra v2;
- listar divergências;
- não corrigir divergências automaticamente sem análise.
## 2026-06-18 — Correção Opção B: fonte comparacaoKey unificada

**Frente:** Frente 2 / meio — candidatos, classificação, adaptação legado e comparação diagnóstica

**Objetivo:** Corrigir pareamento da comparacaoKey na Opção B para evitar ausências falsas entre legado e v2.

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

**Impactos:**
- Positivo: Pareamento correto de candidatos entre legado e v2
- Positivo: Eliminação de ausências falsas
- Nenhum impacto em produção, frontend, ranking ou rota /pesquisar

**Status:** Opção B PREPARADA (não concluída ainda)
- Aguarda validação manual B0–B4 corrigidos no DevTools
- Após validação manual, Opção B pode ser considerada CONCLUÍDA

**Próximo passo recomendado:**
- Usuário executar snippets B0–B4 corrigidos no DevTools para validação manual
## 2026-06-18 — Correção Opção B: fonte comparacaoKey ajustada para diagnostico-candidatos

**Frente:** Frente 2 / meio — candidatos, classificação, adaptação legado e comparação diagnóstica

**Objetivo:** Corrigir fonte da comparacaoKey na Opção B para usar uma fonte válida na rota diagnóstica.

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

**Impactos:**
- Positivo: Fonte agora é válida na rota diagnóstica
- Positivo: Pareamento correto de candidatos entre legado e v2
- Positivo: Comparador deve executar corretamente na validação manual
- Nenhum impacto em produção, frontend, ranking ou rota /pesquisar

**Status:** Opção B PREPARADA (não concluída ainda)
- Aguarda nova validação manual B1–B4 com fonte corrigida
- Após validação manual, Opção B pode ser considerada CONCLUÍDA

**Próximo passo recomendado:**
- Usuário executar snippets B1–B4 corrigidos no DevTools para validação manual

---

## Refactor OSRM base URL — default oficial osrm.lebebe.cloud (2026-06-17)

### O que mudou
- **Default oficial da v2:** `https://osrm.lebebe.cloud` (igual ao legado)
- **Fallback explicito:** `https://router.project-osrm.org` — nunca primario automatico
- **Helper `resolverOsrmBaseUrlV2`** integrado em 5 pontos da rota diagnostica
- **Bloco `diagnosticoOsrm`** na resposta principal com:
  - `osrmPrimario`: sempre `https://osrm.lebebe.cloud`
  - `osrmFallback`: sempre `https://router.project-osrm.org`
  - `osrmBaseUrlUsado`: URL efetivamente usada (payload > config > default-v2)
  - `osrmFallbackUsado`: true se URL usada for o fallback publico
  - `origemConfig`: 'payload' | 'config' | 'default-v2'
- **Snippets DevTools** atualizados para `osrm.lebebe.cloud`

### O que NAO mudou
- Regra de classificacao normal/especial/premium
- Regra de hora marcada
- Ranking
- Recorte/lista final
- Frontend
- Producao
- Rota /api/procurar-datas/pesquisar

### Testes
- 212 testes passaram (5 arquivos)
- Testes 83-85 adicionados para validar diagnosticoOsrm
- Teste 33 ajustado (sem osrmBaseUrlDiagnostico agora usa default-v2)

### Pendencia
- Validar no DevTools com OSRM dedicado se 2026-07-03::EQUIPE 1 delta > 5000m

---

## 2026-06-19 — Diagnostico de Insercao por Slot (diagnosticoInsercaoPorSlot)

### Contexto
Apos o refactor do OSRM base URL, a divergencia persiste: v2 calcula 4017m enquanto o legado calcula 5430m para `2026-07-03::EQUIPE 1`. Para investigar, foi instrumentada a rota diagnostica com uma nova flag `usarInsercaoPorSlotDiagnostico` que expoe o calculo completo de insercao por slot.

### O que foi feito
- **Helpers de delta** (`calcular-delta-insercao-rota.ts`, `calcular-delta-insercao-matriz.ts`): adicionada flag `incluirDetalhes` que retorna `candidatosInsercao[]` (todos os candidatos testados com trechos individuais) e `pontosRotaBase[]` (origem + pontos validos da agenda)
- **Orquestrador** (`calcular-km-adicional-real-controlado.ts`): adicionada flag `incluirDetalhesInsercao` passada para ambas chamadas de delta (matriz OSRM e fallback Haversine)
- **Mapa por slot** (`calcular-mapa-km-adicional-por-slot.ts`): adicionada flag `incluirDetalhesInsercao` passada para o orquestrador; `DetalheSlotMapaKmAdicional` agora inclui `deltaInsercao` e `origemOperacional`
- **Rota diagnostica** (`route.ts`): novo bloco 9.7.a.5 `diagnosticoInsercaoPorSlot` que chama `calcularMapaKmAdicionalPorSlotControladoV2` com `incluirDetalhesInsercao: true` e monta resposta por slot com: `osrmBaseUrlUsado`, `origemCalculo`, `destinoNovo`, `origemOperacional`, `pontosRotaBase`, `candidatosInsercao`, `melhorInsercao`, `kmAdicionalNaRotaMFinal`
- **Snippet K3** adicionado em `docs/snippets-devtools-opcao-b-comparacao.md`

### Testes
- 88 testes da rota diagnostica passaram (testes 86-88 adicionados)
- 35 testes dos helpers de delta passaram
- 55 testes de diagnosticar-km-adicional-agenda + gerar-candidatos-disponibilidade-real passaram
- TypeScript: sem erros novos

### Nao alterado
- Classificacao, ranking, recorte/lista final, frontend, producao, rota principal de pesquisa
- Regra de hora marcada
- Integracao v2 em `/api/procurar-datas/pesquisar`

### Pendencia
- Executar snippet K3 no DevTools com dados reais da agenda para 2026-07-03::EQUIPE 1
- Comparar pontosRotaBase e candidatosInsercao com o legado
- Identificar causa da divergencia (4017m vs 5430m)

---

## 2026-06-19 - Correcao de conexao do diagnosticoInsercaoPorSlot com slots reais

### Contexto
O bloco `diagnosticoInsercaoPorSlot` existia, mas quando o payload usava agenda real ele continuava dependendo de `slotsAgendaDiagnostica` manual. Com isso, no DevTools o bloco retornava `slotsRecebidos: 0`, mesmo quando os candidatos reais ja tinham `origemKmAdicional: "slot"` e `chaveSlotKm` preenchida.

### Causa no codigo
- O bloco `diagnosticoInsercaoPorSlot` montava seus slots apenas a partir de `bodyDiagnostico.slotsAgendaDiagnostica`.
- O mapa real usado pelos candidatos reais era montado em outro trecho, a partir de `janelaResult.datas` + `agendaRealComDados.linhasAgenda` + `equipeAgendaDiagnostica`.
- Resultado: o calculo real por slot existia, mas a instrumentacao detalhada rodava desconectada.

### Mudanca aplicada
- Criado montador local `montarSlotsKmAdicionalDiagnostico` em `src/app/api/procurar-datas/v2/diagnostico/route.ts`.
- Esse montador preserva `slotsAgendaDiagnostica` manual para cenario controlado.
- Quando nao ha slots manuais e `usarAgendaRealDiagnostica: true`, ele monta os slots reais pela mesma base do mapa automatico: janela de datas + linhas da AGENDA real + equipe diagnostica.
- `diagnosticoInsercaoPorSlot` agora usa esse montador e expoe `parametros.fonteSlots`.
- O mapa automatico dos candidatos reais tambem usa o mesmo montador, evitando segunda logica paralela.

### Resultado esperado no DevTools
- `diagnosticoInsercaoPorSlot.parametros.slotsRecebidos > 0`
- `diagnosticoInsercaoPorSlot.parametros.fonteSlots === "agenda-real-janela"`
- `diagnosticoInsercaoPorSlot.slots["2026-07-03::EQUIPE 1"]` preenchido
- `pontosRotaBase`, `candidatosInsercao`, `melhorInsercao` e `kmAdicionalNaRotaMFinal` preenchidos para o slot critico quando o helper de mapa retorna detalhe para esse slot.

### Validacoes
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 89 testes passando.
- `npx vitest run diagnostico-km-adicional-agenda.test.ts gerar-candidatos-disponibilidade-real.test.ts` -> encontrou e executou somente `gerar-candidatos-disponibilidade-real.test.ts`, 37 testes passando.
- `npx vitest run src/lib/procurar-datas/motor/diagnosticar-km-adicional-agenda.test.ts` -> 18 testes passando.
- `npx tsc --noEmit` -> falhou somente em erros preexistentes fora do escopo: `src/app/api/procurar-datas/v2/comparar/route.ts`, mocks/testes sem `limites` em `CandidatoPreliminarV2`, e cast `Response` em `osrm-route-client-diagnostico.test.ts`.

### Nao alterado
- Classificacao normal/especial/premium.
- Regra de hora marcada.
- Ranking.
- Recorte/lista final.
- Frontend.
- Producao.
- `/api/procurar-datas/pesquisar`.

---

## 2026-06-19 - Complemento K3: parse da AGENDA com horario

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que mudou:
- `parsearPontosAgendaDoDiaV2` passou a aceitar data da AGENDA em `DD/MM/YYYY HH:mm` e `DD/MM/YYYY HH:mm:ss`.
- O parser continua usando somente `linha[0]` como fonte de data do slot.
- Datas que aparecem em `observacoes` nao sao usadas para decidir o dia do ponto.
- `diagnosticoInsercaoPorSlot` agora inclui `parseAgenda` por slot para expor resumo, pontos, descartados, avisos e erros do parse que alimenta `pontosRotaBase`.

Regra validada no legado:
- `coletarPontosDoDia` usa `r[0]` da AGENDA como `Date` e compara com `slot.date`.
- `observacoes` e usada como fallback de endereco/descricao, nao como fonte de data.
- `normTeam` aceita equipe com prefixo numerico, como `4- EQUIPE 01`, normalizando para `EQUIPE 1`.

Nao mudou:
- Classificacao, ranking, hora marcada, recorte/lista final, frontend, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.

Validacoes:
- `parse-agenda-shag.test.ts` -> 38 testes passando.
- `calcular-mapa-km-adicional-por-slot.test.ts` -> 16 testes passando.
- `calcular-km-adicional-real-controlado.test.ts` -> 6 testes passando.
- `route.test.ts` da rota diagnostica -> 89 testes passando.
- `diagnosticar-km-adicional-agenda.test.ts` -> 18 testes passando.
- `gerar-candidatos-disponibilidade-real.test.ts` -> 37 testes passando.

---

## 2026-06-19 - Complemento K7: cache de coordenadas em slots reais

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que mudou:
- `montarSlotsKmAdicionalDiagnostico` passou a propagar `cacheCoordenadasAgendaDiagnostico` para os slots montados via `agenda-real-janela`.
- O mesmo cache e usado pelo bloco `diagnosticoInsercaoPorSlot` e pelo mapa automatico dos candidatos reais.
- Se o cache vier vazio, o diagnostico avisa explicitamente que pontos da agenda real sem coordenada serao descartados como `sem_coordenadas_cache`.
- `parsearPontosAgendaDoDiaV2` passou a aceitar datas sem zero a esquerda, como `3/7/2026 00:00:00`, pois o legado compara `Date` real da planilha.

Nao mudou:
- Geocoding real, consulta Supabase nova, classificacao, ranking, hora marcada, frontend, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.

Validacoes:
- `parse-agenda-shag.test.ts` -> 39 testes passando.
- `calcular-km-adicional-real-controlado.test.ts` -> 7 testes passando.
- `calcular-mapa-km-adicional-por-slot.test.ts` -> 16 testes passando.
- `route.test.ts` da rota diagnostica -> 89 testes passando.
- `diagnosticar-km-adicional-agenda.test.ts` + `gerar-candidatos-disponibilidade-real.test.ts` -> 55 testes passando.

---

## 2026-06-19 - Complemento K8: ordem otimizada da rota base

Status: implementado em modo diagnostico/testado. Nao libera producao.

O que mudou:
- Criado `otimizarRotaBaseLegado`, equivalente ao `rotaOtimizada` do legado para a ordem da rota base.
- `calcularKmAdicionalRealControladoV2` passou a calcular o delta de insercao usando os pontos da agenda na ordem otimizada, nao na ordem crua.
- Para 2 pontos, a ordem usa greedy por Haversine a partir da origem; para mais de 3 pontos, o helper executa `twoOpt` como no legado.
- `diagnosticoInsercaoPorSlot.slots[...].ordenacaoRotaBase` expoe ordem original, ordem otimizada, criterio e flags de `twoOpt`.

Nao mudou:
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine como criterio inicial de greedy, producao e `/api/procurar-datas/pesquisar`.

Validacoes:
- `otimizar-rota-base-legado.test.ts` + `calcular-km-adicional-real-controlado.test.ts` + `calcular-mapa-km-adicional-por-slot.test.ts` -> 25 testes passando.
- `route.test.ts` da rota diagnostica -> 89 testes passando.
- `diagnosticar-km-adicional-agenda.test.ts` + `gerar-candidatos-disponibilidade-real.test.ts` -> 55 testes passando.

---

## 2026-06-19 - Complemento K9: trechos OSRM route vs table

Status: investigado em modo diagnostico. Nao altera producao.

O que foi confirmado:
- Com as coordenadas atuais do K9, o OSRM dedicado atual retorna delta perto de 7.16km tanto em `/route` quanto em `/table`.
- `/route`: `4023m + 12017m - 8871m = 7169m`.
- `/table`: `4017m + 11995m - 8854m = 7158m`.
- A diferenca entre `/route` e `/table` no endpoint dedicado e de 11m no delta.

Conclusao:
- A divergencia `5430m` legado antigo vs `7158m` v2 atual nao e explicada por `/route` vs `/table` usando as coordenadas atuais.
- O trecho responsavel continua sendo `DEPOSITO -> Avenida Sao Jose`; para fechar `5430m`, esse trecho teria que estar perto de `10582m`.
- Pendencia restante: rodar snippet Apps Script apenas de log para saber se o legado atual usa cache antigo/coordenadas diferentes ou se tambem retorna aproximadamente 7.16km com `getDrivingKm`.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.

Validacoes:
- Consulta externa somente ao OSRM dedicado `https://osrm.lebebe.cloud`.
- Consulta ao OSRM publico nao executada; foi bloqueada por risco de envio de coordenadas para terceiro.
- Nenhum teste automatizado rodado, pois nao houve alteracao de codigo.

---

## 2026-06-19 - Complemento K10: validacao do legado atual

Status: validado em modo diagnostico. Nao altera producao.

O que foi confirmado:
- K10 Apps Script legado executado em 19/06/2026 às 14:12, sem limpar cache.
- OSRM_BASE ativo: https://osrm.lebebe.cloud
- DEPÓSITO -> Cornelius: OSRM direto sem cache = 4023m, getDrivingKm legado = 4023m
- Cornelius -> Avenida São José: cache antes = 12.0168, OSRM direto sem cache = 12017m, getDrivingKm legado = 12017m
- DEPÓSITO -> Avenida São José: cache antes = null, OSRM direto sem cache = 8871m, getDrivingKm legado = 8871m
- Delta OSRM direto sem cache = 7169m
- Delta getDrivingKm legado = 7169m

Comparacao v2 vs legado atual:
- K9 v2 = 7158m
- K10 legado atual = 7169m
- Diferença = 11m

Conclusao:
- A v2 retornou 7.158km. O legado atual retornou 7.169km. A diferenca de 11m e aceitavel para equivalencia de motor nesse cenário e nao altera a classificacao operacional.
- Ambos classificaram como ESPECIAL, ambos com horaMarcada = false, ambos com ordem = 1.
- O valor historico anterior `03/07 | EQUIPE 1 | ESPECIAL | Δ=5.43km` nao foi reproduzido no legado atual com as coordenadas atuais e OSRM dedicado. Portanto, nao deve mais ser usado como alvo de correcao funcional. Deve ser registrado como valor historico provavelmente originado por cache antigo, coordenadas antigas, provider anterior, OSRM anterior ou execucao em contexto diferente.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.

Validacoes:
- Execucao de snippet Apps Script legado apenas de log (DIAG_K10_TrechosMelhorInsercao_0307).
- Nenhum teste automatizado rodado, pois nao houve alteracao de codigo.

---

## 2026-06-19 - Decisão de controle: desbloqueio condicional da Frente 2

Status: decisao registrada. Nao altera producao.

Decisao tomada:
- A Frente 1 está validada para o cenário real `2026-07-03::EQUIPE 1` com OSRM atual.
- A Frente 2 pode avançar de forma controlada para validação de candidatos/classificação/adaptação legado.

Base da decisao:
- K9 v2 = 7158m
- K10 legado atual = 7169m
- Diferença = 11m (aceitável para equivalência da Frente 1)
- Classificação equivalente = especial
- Hora marcada equivalente = false
- Ordem equivalente = 1
- Divergências do comparador para 03/07 = []

Status do valor histórico 5.43km:
- O valor histórico anterior `03/07 | EQUIPE 1 | ESPECIAL | Δ=5.43km` não foi reproduzido no legado atual com as coordenadas atuais e OSRM dedicado.
- Deve ser tratado como valor histórico provavelmente originado por cache antigo, coordenadas antigas, provider anterior, OSRM anterior ou execução em contexto diferente.
- Não bloqueia mais o avanço da Frente 2.

Validacoes adicionais recomendadas:
- Ainda ficam recomendadas validações adicionais de amostragem OSRM para:
  - um cenário normal com pontos na agenda;
  - um cenário sábado, se houver origem operacional diferente;
  - um cenário sem pontos na agenda.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.

Validacoes:
- Nenhum teste automatizado rodado, pois nao houve alteracao de codigo.

---

## 2026-06-22 - Validacao K13: rota simples origem -> destino e recorte final v2

Status: validado em modo diagnostico. Nao altera producao.

O que foi validado:
- Cenario futuro com dataInicial=2026-08-14, cep=81830-020, tempoNecessario=00:40, destino=Rua Cornelius Pries, 669, Xaxim, Curitiba - PR, equipeAgendaDiagnostica=EQUIPE 1.
- Recorte final: 3 normais, 0 especiais, 0 premiums, 0 hora marcada, maxNormaisAplicado=3.
- Sem datas duplicadas.
- Rota simples origem -> destino quando nao ha pontos validos na agenda.
- Origem operacional de sabado para EQUIPE 1 usando casa-e1 (lat=-25.494297, lng=-49.277091).
- Slots dos candidatos finais confirmaram "Nenhum ponto valido na agenda. Considerando rota simples origem -> destino." e temMelhorInsercao=false.

Candidatos finais K13:
- 2026-08-14 | EQUIPE 1 | NORMAL | 4017m | horaMarcada=true | origemOperacional.tipo=deposito
- 2026-08-15 | EQUIPE 1 | NORMAL | 3158m | horaMarcada=true | origemOperacional.tipo=casa-e1 (sabado)
- 2026-08-17 | EQUIPE 1 | NORMAL | 4017m | horaMarcada=true | origemOperacional.tipo=deposito

Validacao de limites:
- normaisOk = true
- especiaisOk = true
- premiumsOk = true
- horaMarcadaOk = true
- maxNormaisAplicadoOk = true
- semDatasDuplicadas = true

Conclusao:
- O K13 validou um cenario em que nao havia pontos validos de agenda para os candidatos finais, entao o motor caiu corretamente em rota simples origem -> destino, mantendo classificacao normal e respeitando o recorte final v2.
- A origem operacional de sabado para EQUIPE 1 foi validada parcialmente no diagnostico usando casa-e1.
- O recorte final v2 com maxNormaisAplicado=3 continua validado em cenario futuro.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.
- Recorte ainda restrito a rota diagnostica, sem afetar producao.

---

## 2026-06-22 - K14 27-06: Sao Lourenco existe no geo_cache e bug era merge de cache no diagnostico

### Conclusao

O ponto real de Sao Lourenco do slot `2026-06-27::EQUIPE 1` nao deveria ser descartado por ausencia real no Supabase. Consulta read-only confirmou `public.geo_cache` com `chave_endereco = 41dc44699f62c91f1c153512bb8d35a859db6d1d` para Rua Gregorio de Matos/Sao Lourenco, com coordenadas `-25.3953811,-49.2684535`.

### Causa tecnica corrigida

Na rota diagnostica, quando `slotsAgendaDiagnostica` trazia `cacheCoordenadasPorEndereco: {}`, o slot podia usar esse cache vazio em vez de herdar o cache de agenda resolvido automaticamente via Supabase. O merge foi ajustado nos consumidores diagnosticos de slots em `src/app/api/procurar-datas/v2/diagnostico/route.ts` para preservar o cache resolvido e permitir override pontual pelo slot.

### Resultado esperado para 27-06

Com OSRM dedicado:
- casa-e1 -> destino: `8903m`
- casa-e1 -> Sao Lourenco: `14623m`
- destino -> Sao Lourenco: `21317m`
- Sao Lourenco -> destino: `20585m`

Melhor insercao: antes do ponto Sao Lourenco, delta aproximado `15597m`. Portanto 27-06 nao permanece normal quando Sao Lourenco entra na rota base; com limite premium padrao de base + 10000m, tende a indisponivel nesse calculo.

### Controle 02-07

O slot `2026-07-02::EQUIPE 1` permanece coerente como controle: origem deposito, dois pontos validos em Araucaria, melhor insercao posicao 0, delta `7650m`, tipo especial. Nao foi tratado como bug.

### Validacoes

- Supabase MCP read-only em `public.geo_cache`.
- OSRM `/table` dedicado em `https://osrm.lebebe.cloud`.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts`: passou.
- `npx vitest run src/app/api/procurar-datas/v2/pesquisar/route.test.ts src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts`: passou.

---

## 2026-06-22 - K14 K18.3: correcao runtime no helper central de cache por hash compartilhado

### Conclusao revisada

A correcao anterior era insuficiente para o runtime porque tratava `slotsAgendaDiagnostica` na rota diagnostica, mas `/api/procurar-datas/v2/pesquisar` monta os slots a partir de `pesquisarDatasV2` usando o cache global retornado por `resolverCacheCoordenadasAgendaDiagnostico`.

O bug real estava no helper central: a consulta ao Supabase usa hash legado sem numero, enquanto o parser da agenda consome cache por chave textual completa. Quando mais de uma linha da agenda compartilha o mesmo hash legado, o helper guardava apenas uma chave textual para aquele hash. Assim, um hit do Supabase podia preencher uma linha da mesma rua e deixar outra sem coordenada.

### Correcao

`src/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico.ts` agora usa `hashLegado -> EnderecoParaCache[]`. Um hit de `geo_cache` preenche todas as chaves textuais associadas ao hash. Isso atinge:
- `/api/procurar-datas/v2/pesquisar`, via `pesquisarDatasV2`;
- `/api/procurar-datas/v2/comparar`, porque o lado v2 chama `pesquisarDatasV2`;
- rota diagnostica, quando usa o mesmo helper de cache.

### Validacoes

- MCP Supabase read-only confirmou o hash `41dc44699f62c91f1c153512bb8d35a859db6d1d` com coordenadas `-25.3953811,-49.2684535`.
- Teste novo do helper cobre duas chaves textuais de Rua Gregorio de Matos compartilhando o mesmo hash e valida `pontosValidos=1` no slot 27/06.
- Teste novo de `pesquisarDatasV2` valida que 27/06 nao permanece normal quando o mapa por slot recebe Sao Lourenco com delta `15597m`.
- Rotas diagnostica, `/v2/pesquisar` e comparador passaram nos testes relacionados.

### Risco registrado

O hash legado sem numero aplica a mesma coordenada a enderecos da mesma rua/bairro/cidade/UF. Esse comportamento ja fazia parte da estrategia de lookup herdada; a correcao apenas garante que todas as chaves textuais associadas ao hash recebam o hit retornado.

---

## 2026-06-22 - Investigacao K14 no comparador legado vivo x v2

Status: investigado por leitura de codigo. Nao houve alteracao funcional.

### Conclusao
K14 nao esta explicado por erro de payload no comparador. O comparador chama `ApiPesquisarDatasApp` e `pesquisarDatasV2` com o mesmo body. No legado, `ApiPesquisarDatasApp` forca `resultMode='app-3-com-extras'`, `limitResultsNormal=3`, `returnOnly=true` e `useModalDestOnly=true`.

A divergencia mais provavel vem da diferenca de estrategia operacional:
- legado `app-3-com-extras`: processa `slotsComPontos` antes de `slotsVazios` e faz early stop quando o conjunto acumulado ja tem 3 normais;
- v2 paralela: calcula mapa de km por slot para a janela, gera candidatos para a janela e so depois aplica o recorte final.

### Respostas objetivas para K14
- Legado retorna 2026-07-11, 2026-07-13 e 2026-07-16 porque essas datas completam os 3 normais obrigatorios no conjunto acumulado antes de o legado continuar processando toda a janela.
- V2 retorna 2026-06-27 normal, 2026-07-02 especial, 2026-07-11 normal, 2026-07-13 normal e 2026-07-23 premium porque avalia a janela completa antes de recortar.
- A divergencia nao vem do comparador chamando outra v2: K18.1 ja confirmou mesmo resultado em `/v2/pesquisar` e dentro de `/v2/comparar`.
- Payload legado lido no codigo esta compativel: `destLat/destLng`, `tempoNecessario='00:40'` e `dataInicial='2026-06-25'` sao campos aceitos pelo legado.
- `ApiPesquisarDatasApp` e adequado para comparador do motor final, porque o fluxo assincrono `ApiIniciarPesquisaDatasApp` chama `ApiPesquisarDatasApp(job.form)`; a diferenca do assincrono e fila/progresso/polling.

### K13 e K15
- K13 extra 2026-08-21 deve permanecer como aviso/pendencia de equivalencia, nao info, enquanto o early stop do legado nao estiver reproduzido ou deliberadamente dispensado na v2.
- K15 permanece como equivalencia forte ja validada no comparador; esta investigacao nao muda esse status.

### Risco registrado
Promover a v2 sem decidir sobre o early stop pode mudar a experiencia: a v2 pode mostrar extras ou datas mais cedo que o legado vivo, mesmo usando a mesma agenda/cache/OSRM.

### Proximo passo
Criar teste controlado do comparador/motor com mocks que reproduza a diferenca entre:
1. recorte apos janela completa;
2. early stop `app-3-com-extras` apos 3 normais acumulados.

Nao mudou:
- Codigo, regra de negocio, Apps Script, frontend, Supabase, OSRM, Haversine, `/api/procurar-datas/pesquisar`.

---

## 2026-06-22 - Implementacao da rota v2 paralela `/api/procurar-datas/v2/pesquisar`

### Status
Implementada a primeira rota real paralela do motor v2 para pesquisa de datas, sem conectar frontend, sem alterar `/api/procurar-datas/pesquisar` e sem chamar Apps Script.

### Arquitetura implementada
- Nova rota `POST /api/procurar-datas/v2/pesquisar`.
- Novo orquestrador puro `pesquisarDatasV2`.
- Reuso dos helpers ja validados:
  - normalizacao de entrada;
  - janela de datas;
  - disponibilidade real;
  - agenda real;
  - cache Supabase/geo_cache;
  - OSRM table dedicado;
  - mapa de km adicional por slot;
  - geracao/classificacao de candidatos;
  - recorte final legado-equivalente.
- Contrato de resposta reduzido e estavel:
  - `ok`;
  - `modo`;
  - `entradaNormalizada`;
  - `resultadoFinal.candidatosFinais`;
  - `resultadoFinal.resumo`;
  - `resultadoFinal.diasUsados`;
  - `diagnosticoMinimo`;
  - `erros`.

### Confirmacoes
- `maxNormaisAplicado=3` aplicado no recorte final.
- Cache de coordenadas da agenda lido automaticamente via helper existente de Supabase/geo_cache.
- `slotTemPontosPorSlotKey` derivado de `parseAgenda.resumo.pontosValidos`.
- OSRM configurado para usar `https://osrm.lebebe.cloud`.
- Nenhum import/uso de Apps Script encontrado na rota nova ou no novo orquestrador.
- `/api/procurar-datas/pesquisar` nao foi alterada.
- Frontend nao foi alterado.
- Banco, migrations, policies e schema nao foram alterados.

### Validacoes
- `npx vitest run src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts` passou: 1 arquivo, 1 teste.
- `npx vitest run src/app/api/procurar-datas/v2/pesquisar/route.test.ts` passou: 1 arquivo, 2 testes.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` passou: 1 arquivo, 91 testes.
- `npx vitest run src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts` passou: 1 arquivo, 38 testes.
- `rg` confirmou ausencia de Apps Script nos arquivos novos.
- MCP Supabase confirmou `public.geo_cache` com colunas `chave_endereco`, `lat` e `lng`.
- `npx tsc --noEmit --pretty false` falhou apenas em erros ja existentes fora dos arquivos novos: `src/app/api/procurar-datas/v2/comparar/route.ts`, testes de adaptador/ordenacao de candidatos e `osrm-route-client-diagnostico.test.ts`.

### Pendencias
- Validacao manual K17 via DevTools contra a nova rota.
- Comparar K17 com rota diagnostica e legado atual.
- Decisao futura explicita sobre ativacao no frontend ou flag.

Validacoes:
- Execucao de snippet DevTools K13 (rota diagnostica).
- Nenhum teste automatizado rodado, pois nao houve alteracao de codigo.

---

## 2026-06-22 - Limpeza de avisos intermediarios em diagnosticoMinimo.avisos

Status: ajuste de contrato da rota v2 paralela. Nao altera regra de negocio.

O que mudou:
- `src/lib/procurar-datas/motor/pesquisar-datas-v2.ts` adicionou filtro de avisos intermediarios (linhas 330-336, 369).
- Avisos "distanciaKm não fornecida" e "kmAdicionalNaRotaM não fornecida" sao filtrados do retorno da rota nova.

Origem dos avisos:
- Helper `gerarCandidatosComDisponibilidadeRealV2` (linhas 166-175) gera esses avisos quando recebe distanciaKm e kmAdicionalNaRotaM globais como null.
- Na rota v2 paralela, esses valores sao intencionalmente null porque o km real vem do mapaKmAdicionalPorSlot calculado via OSRM.
- Portanto, sao ruido intermediario e nao representam falha funcional.

Contrato apos ajuste:
- `diagnosticoMinimo.avisos` contem apenas avisos uteis para auditoria:
  - rota paralela nao afeta producao;
  - cache Supabase/geo_cache hits/misses;
  - OSRM fallback usado, se ocorrer;
  - fallback Haversine, se ocorrer;
  - erros ou avisos que afetem o resultado final.

Limites:
- Nao altera classificacao, recorte, OSRM, Haversine, Supabase/geo_cache, frontend ou `/api/procurar-datas/pesquisar`.
- Nao altera resultado funcional da rota v2 paralela.

Validacoes:
- `npx vitest run src/lib/procurar-datas/motor/pesquisar-datas-v2.test.ts` passou: 1 arquivo, 1 teste.
- `npx vitest run src/app/api/procurar-datas/v2/pesquisar/route.test.ts` passou: 1 arquivo, 2 testes.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` passou: 1 arquivo, 91 testes.

---

## 2026-06-22 - Validacao K17: Mandirituba na rota v2 paralela

Status: validado na rota real paralela. Nao altera producao.

O que foi validado:
- Cenario Mandirituba com dataInicial=2026-07-10, destino=R. José Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR, 83800-000, coordenadas lat=-25.769705, lng=-49.325586.
- Rota `POST /api/procurar-datas/v2/pesquisar` executada manualmente via DevTools.
- Reproducao do cenario forte K15 na rota nova: 3 normais + 1 premium.
- OSRM dedicado usado (https://osrm.lebebe.cloud).
- Fallback publico nao usado.
- Cache Supabase/geo_cache automatico: 110/127 hits.
- maxNormaisAplicado=3.
- Sem datas duplicadas.
- origemKmAdicional=slot em todos os candidatos finais.

Resultado K17:
- status=200, ok=true, modo=v2-pesquisar-paralelo.
- totalRecebidos=168, totalElegiveis=42, totalRecortados=4.
- normaisRecortados=3, especiaisRecortados=0, premiumsRecortados=1, horaMarcadaRecortados=0.
- slotsComKm=100, slotsComFallbackHaversine=0.

Candidatos finais K17:
- 2026-07-14 | EQUIPE 1 | premium | 11.533 km | origemKmAdicional=slot
- 2026-08-08 | EQUIPE 1 | normal  | 32.241 km | origemKmAdicional=slot
- 2026-08-15 | EQUIPE 1 | normal  | 32.241 km | origemKmAdicional=slot
- 2026-08-17 | EQUIPE 1 | normal  | 33.100 km | origemKmAdicional=slot

Confirmacao K15 reproduzido:
- 2026-07-14 | EQUIPE 1 | PREMIUM | 11.533 km
- encontrouDataAlvo=true, tipoAlvoOk=true, kmAdicionalNaRotaM=11533.

Conclusao:
- A nova rota v2 paralela reproduziu o cenario forte de Mandirituba/K15.
- Validou 3 normais + 1 premium, OSRM dedicado, Supabase/geo_cache, recorte maxNormais=3 e ausencia de datas duplicadas.
- Rota segue paralela e nao afeta producao.

---

## 2026-06-22 - Validacao K17.2: K13 e K14 na rota v2 paralela

Status: validado na rota real paralela. Nao altera producao.

O que foi validado:
- Rota `POST /api/procurar-datas/v2/pesquisar` executada manualmente via DevTools.
- Cenarios K13 (Cornelius) e K14 (Sitio Cercado) reproduzidos na rota nova.
- OSRM dedicado usado nos 2 cenarios (https://osrm.lebebe.cloud).
- Fallback publico nao usado nos 2 cenarios.
- maxNormaisAplicado=3 nos 2 cenarios.
- Sem datas duplicadas nos 2 cenarios.
- Limites de normais/especiais/premiums/hora marcada respeitados nos 2 cenarios.

K13 — Cornelius:
- Payload: cep=81830-020, dataInicial=2026-08-14, tempoNecessario=00:40, destLat=-25.5091859, destLng=-49.2671477, endereco=rua cornelius pries, 669, xaxim, Curitiba - PR, Brasil.
- status=200, ok=true, modo=v2-pesquisar-paralelo.
- totalRecortados=4, normaisRecortados=3, especiaisRecortados=1, premiumsRecortados=0, horaMarcadaRecortados=0.
- Candidatos finais:
  - 2026-08-14 | EQUIPE 1 | normal   | 1.430 km | origemKmAdicional=slot
  - 2026-08-15 | EQUIPE 1 | normal   | 3.158 km | origemKmAdicional=slot
  - 2026-08-17 | EQUIPE 1 | normal   | 4.017 km | origemKmAdicional=slot
  - 2026-08-21 | EQUIPE 1 | especial | 7.158 km | origemKmAdicional=slot

K14 — Sitio Cercado:
- Payload: cep=81925-370, dataInicial=2026-06-25, tempoNecessario=00:40, destLat=-25.545418, destLng=-49.261836, endereco=Rua Attílio Silva Fonseca, 149-1 - Sítio Cercado, Curitiba - PR, 81925-370.
- status=200, ok=true, modo=v2-pesquisar-paralelo.
- totalRecortados=5, normaisRecortados=3, especiaisRecortados=1, premiumsRecortados=1, horaMarcadaRecortados=0.
- Candidatos finais:
  - 2026-06-27 | EQUIPE 1 | normal   | 8.903 km  | origemKmAdicional=slot
  - 2026-07-02 | EQUIPE 1 | especial | 7.650 km  | origemKmAdicional=slot
  - 2026-07-11 | EQUIPE 1 | normal   | 4.657 km  | origemKmAdicional=slot
  - 2026-07-13 | EQUIPE 1 | normal   | 4.019 km  | origemKmAdicional=slot
  - 2026-07-23 | EQUIPE 1 | premium  | 10.845 km | origemKmAdicional=slot

Conclusao:
- A nova rota v2 paralela validou K13 e K14 com sucesso.
- Preservou os resultados esperados da rota diagnostica.
- Rota segue paralela e nao afeta producao.

---

## 2026-06-22 - K15: cache Supabase da agenda real no diagnostico

Status: implementado na rota diagnostica. Nao altera producao.

O que mudou:
- `src/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico.ts` criado para consultar `SUPABASE_TABLE`/`geo_cache` em modo read-only usando hashes legados de endereco.
- `src/lib/procurar-datas/motor/parse-agenda-shag.ts` passou a exportar o extrator de endereco e o normalizador de chave do parser, para evitar formato paralelo de `cacheCoordenadasPorEndereco`.
- `src/app/api/procurar-datas/v2/diagnostico/route.ts` passou a enriquecer `cacheCoordenadasAgendaDiagnostico` depois da leitura real da AGENDA e antes de montar slots `agenda-real-janela`.
- `src/app/api/procurar-datas/v2/diagnostico/route.test.ts` ganhou cobertura para cache vazio enriquecido por mock Supabase.

Limites:
- Nao faz geocoding externo.
- Nao escreve cache.
- Nao muda `/api/procurar-datas/pesquisar`.
- Se o endereco nao existir no cache Supabase ou nao puder gerar hash minimo, o ponto continua sendo descartado pelo parser como antes.

Validacoes:
- MCP Supabase read-only confirmou tabela `public.geo_cache` e registros relevantes para K15.
- `npx vitest run src/app/api/procurar-datas/v2/diagnostico/route.test.ts` -> 1 arquivo, 91 testes passando.
- `npx tsc --noEmit --pretty false` ainda falha por pendencias fora desta mudanca em `comparar/route.ts`, testes de candidatos/ordenacao e mock de `Response`.

---

## 2026-06-22 - Validacao K15: premium por insercao real com pontos da agenda recuperados via Supabase/geo_cache

Status: validado em modo diagnostico. Nao altera producao.

O que foi validado:
- Cenario Mandirituba com dataInicial=2026-07-10, destino=R. José Schueda Sobrinho, 63-47 - Conj. Barcelona, Mandirituba - PR, 83800-000, coordenadas lat=-25.769705, lng=-49.325586.
- Agenda real com 2 pontos validos em Fazenda Rio Grande no slot 2026-07-14::EQUIPE 1.
- Coordenadas recuperadas via Supabase/geo_cache, sem depender de cache injetado.
- Slot 2026-07-14::EQUIPE 1 com pontosRotaBase=3, candidatosInsercao=3, temMelhorInsercao=true.
- Delta de melhor insercao = 11533m (11.533 km).
- Classificacao como premium (acima do limite de especial, dentro do limite premium).
- Recorte final: 3 normais, 0 especiais, 1 premium, 0 hora marcada, maxNormaisAplicado=3.
- Sem datas duplicadas.
- OSRM dedicado usado (https://osrm.lebebe.cloud).

Pontos da rota base do slot 2026-07-14::EQUIPE 1:
- origem/deposito: lat=-25.4876648, lng=-49.2692262
- agenda: Avenida Mato Grosso, 2464, Estados, Fazenda Rio Grande - PR, 83830-481, lat=-25.6705907, lng=-49.3320594
- agenda: Rua Maria Zanão Machado, 219, Gralha Azul, Fazenda Rio Grande - PR, 83824-543, lat=-25.6841821, lng=-49.3046792

Candidatos finais K15:
- 2026-07-14 | EQUIPE 1 | PREMIUM | 11.533 km | horaMarcada=false
- 2026-08-08 | EQUIPE 1 | NORMAL | 32.241 km | horaMarcada=true
- 2026-08-13 | EQUIPE 1 | NORMAL | 33.100 km | horaMarcada=true
- 2026-08-15 | EQUIPE 1 | NORMAL | 32.241 km | horaMarcada=true

Validacao de limites:
- normaisOk = true
- especiaisOk = true
- premiumsOk = true
- horaMarcadaOk = true
- maxNormaisAplicadoOk = true
- semDatasDuplicadas = true

Conclusao:
- O K15 validou que, apos a correcao do cache de coordenadas, a rota diagnostica recuperou automaticamente os dois pontos reais de Fazenda Rio Grande via Supabase/geo_cache, montou rota base com pontos validos, calculou candidatos de insercao e classificou corretamente o novo endereço de Mandirituba como premium por delta de insercao de 11.533 km.
- Quando ha pontos validos na agenda, a v2 aplica regra de insercao real na rota. Nesse cenário, 11.533 km ficou acima do limite de especial e dentro do limite premium, portanto entrou como premium.
- Os normais distantes de agosto ficaram normais porque sao slots sem pontos validos e, conforme regra ja confirmada no legado, slots sem pontos usam limite de dia/sábado/semana, nao o limite curto de insercao.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.
- Recorte ainda restrito a rota diagnostica, sem afetar producao.

Validacoes:
- Execucao de snippet DevTools K15 (rota diagnostica).
- Nenhum teste automatizado rodado nesta tarefa, pois nao houve alteracao de codigo.

---

## 2026-06-22 - Validacao K16: smoke pos-correcoes (K13, K14, K15)

Status: validado em modo diagnostico. Nao altera producao.

O que foi validado:
- Smoke pos-correcoes executado com K13 (Cornelius, dataInicial=2026-08-14), K14 (Sitio Cercado, dataInicial=2026-06-25) e K15 (Mandirituba, dataInicial=2026-07-10).
- status 200, rotaOk=true e resultadoFinalOk=true nos 3 cenários.
- OSRM dedicado usado nos 3 cenários (https://osrm.lebebe.cloud).
- Fallback publico nao usado nos 3 cenários.
- maxNormaisAplicado=3 nos 3 cenários.
- limites de normais/especiais/premiums/hora marcada respeitados.

Recortes finais validados:
- K13: 3 normais + 1 especial (2026-08-21 | EQUIPE 1 | ESPECIAL | 7.158 km)
- K14: 3 normais + 1 especial + 1 premium (2026-07-02 | ESPECIAL | 7.650 km, 2026-07-23 | PREMIUM | 10.845 km)
- K15: 3 normais + 1 premium (2026-07-14 | PREMIUM | 11.533 km)

K15 slot alvo validado:
- slot = 2026-07-14::EQUIPE 1
- pontosRotaBase = 3
- candidatosInsercao = 3
- temMelhorInsercao = true
- delta de melhor insercao = 11533m (11.533 km)
- parseAgendaPontosValidos = 2
- parseAgendaPontosDescartados = 0
- parseAgendaSemCoordenadas = 0

Ressalva sobre okGeral=false:
- O campo okGeral do snippet K16 retornou false porque a validacao automatica esperava que K13 e K14 fossem cenarios puros de "normal sem pontos" e "sem extras".
- Essa expectativa ficou desatualizada depois da correcao de Supabase/geo_cache, porque a agenda real passou a recuperar mais pontos e gerar extras reais.
- okGeral=false nao representa falha funcional da rota. Representa criterio automatico desatualizado para K13/K14 apos a correcao de coordenadas via Supabase/geo_cache.

Conclusao:
- O smoke pos-correcoes validou que a rota diagnostica segue funcionando com OSRM dedicado, recorte final maxNormaisAplicado=3, limites de extras respeitados e agenda real com coordenadas recuperadas via Supabase/geo_cache.
- K13/K14 passaram a validar extras reais apos a correcao de coordenadas.
- K15 segue validando premium com pontos reais e insercao real.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.
- Recorte ainda restrito a rota diagnostica, sem afetar producao.

Validacoes:
- Execucao de snippet DevTools K16 (rota diagnostica).
- Nenhum teste automatizado rodado nesta tarefa, pois nao houve alteracao de codigo.

---

## 2026-06-22 - Plano de promocao controlada do recorte final v2

Status: planejamento. Nao altera producao. Nao altera codigo.

### Estado atual da migracao

Validado na rota diagnostica (`/api/procurar-datas/v2/diagnostico`):
- Helpers puros: classificacao, recorte, geracao de candidatos, mapa km por slot, origem operacional, OSRM table, cache Supabase/geo_cache.
- Recorte final legado-equivalente com maxNormaisAplicado=3.
- Insercao real com pontos da agenda recuperados via Supabase/geo_cache.
- Rota simples origem -> destino quando nao ha pontos validos.
- Origem operacional de sabado casa-e1.
- K13: 3 normais + 1 especial.
- K14: 3 normais + 1 especial + 1 premium.
- K15: 3 normais + 1 premium com slot real, pontos reais, insercao real.
- K16: smoke pos-correcoes aprovado nos 3 cenários.

Nao afeta producao:
- `/api/procurar-datas/pesquisar` segue como proxy para Apps Script (`chamarAppsScriptProcurarDatas('ApiIniciarPesquisaDatasApp')`).
- Frontend continua consumindo legado via polling `/api/procurar-datas/progresso`.
- Nenhuma rota v2 real (fora da diagnostica) existe ainda.

### Arquivos/rotas candidatos a promocao

Helpers puros ja validados (prontos para reuso):
- `src/lib/procurar-datas/motor/recortar-candidatos-legado-equivalente.ts` — recorte final.
- `src/lib/procurar-datas/motor/classificacao-candidato.ts` — classificacao.
- `src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.ts` — geracao de candidatos.
- `src/lib/procurar-datas/motor/calcular-mapa-km-adicional-por-slot.ts` — mapa km por slot.
- `src/lib/procurar-datas/motor/calcular-km-adicional-real-controlado.ts` — km adicional com OSRM.
- `src/lib/procurar-datas/motor/resolver-origem-operacional.ts` — origem operacional.
- `src/lib/procurar-datas/motor/parse-agenda-shag.ts` — parse de agenda.
- `src/lib/procurar-datas/motor/cache-coordenadas-agenda-diagnostico.ts` — cache Supabase read-only.
- `src/lib/procurar-datas/motor/osrm-table-client-diagnostico.ts` — cliente OSRM table.

Arquivos que NAO devem ir direto para producao:
- `src/app/api/procurar-datas/v2/diagnostico/route.ts` — rota diagnostica com 2957 linhas, mistura diagnostico puro com fluxo real. Nao e reutilizavel como rota de producao.
- Helpers com sufixo `diagnostico` no nome — podem ter dependencias de campos diagnosticos.

Rota de producao atual:
- `src/app/api/procurar-datas/pesquisar/route.ts` — proxy para Apps Script.
- `src/lib/procurar-datas/apps-script.ts` — chamada ao Apps Script.
- Frontend consome via polling `GET /api/procurar-datas/progresso`.

### O que significa "promover o recorte final v2"

Significa criar uma rota v2 real (paralela ou substituta de `/pesquisar`) que:
1. Recebe o mesmo payload do frontend (`PesquisarDatasRequest`).
2. Executa a cadeia v2 completa: normalizar entrada, carregar config, gerar janela, ler disponibilidade real, ler agenda real, calcular mapa km por slot com OSRM, gerar candidatos, classificar, recortar.
3. Retorna candidatos no formato esperado pelo frontend (ou compativel).
4. Nao chama Apps Script.

### Estrategia recomendada: rota v2 real paralela

Etapa 1 — Planejamento (esta tarefa):
- Documentar plano, riscos, criterios de aceite.
- Sem codigo.

Etapa 2 — Implementacao (proxima tarefa):
- Criar `src/app/api/procurar-datas/v2/pesquisar/route.ts` como rota real paralela.
- Reutilizar helpers puros ja validados.
- Nao alterar `/api/procurar-datas/pesquisar`.
- Nao alterar frontend.
- Nao alterar Apps Script.
- Extrair logica reutilizavel da rota diagnostica para um orquestrador puro (sem campos diagnosticos).
- Garantir que `cacheCoordenadasAgendaDiagnostico` seja substituido por leitura automatica de Supabase/geo_cache no fluxo real.
- Garantir que `slotTemPontosPorSlotKey` seja derivado de `pontosValidos` reais.

Etapa 3 — Validacao manual:
- Snippet DevTools K17: chamar `/api/procurar-datas/v2/pesquisar` com mesmo payload de K13/K14/K15.
- Comparar recorte final com resultado da rota diagnostica.
- Comparar com resultado do legado atual (`/api/procurar-datas/pesquisar`).

Etapa 4 — Documentacao:
- Registrar K17 como validado ou divergente.
- Atualizar escopo-equivalencia e progresso.

Etapa 5 — Ativacao (futura, com decisao explicita):
- Frontend passa a chamar `/api/procurar-datas/v2/pesquisar` em vez de `/pesquisar`.
- Ou: `/pesquisar` ganha flag para delegar para v2.
- Rollback: voltar flag para legado ou reverter deploy do frontend.

### Criterios de aceite para Etapa 2

1. Rota `/api/procurar-datas/v2/pesquisar` responde 200 com payload valido.
2. Recorte final retorna maxNormaisAplicado=3.
3. Sem datas duplicadas.
4. Limites de especiais/premiums/hora marcada respeitados.
5. Rota simples origem -> destino quando nao ha pontos validos.
6. Insercao real quando ha pontos validos.
7. Origem operacional de sabado casa-e1.
8. OSRM dedicado usado.
9. Cache Supabase/geo_cache lido automaticamente (sem cache injetado).
10. Nao chama Apps Script.
11. Nao altera `/api/procurar-datas/pesquisar`.
12. Nao altera frontend.
13. Nao altera banco, migrations ou policies.

### Testes obrigatorios

Antes da implementacao:
- `npx vitest run src/lib/procurar-datas/motor/recortar-candidatos-legado-equivalente.test.ts`
- `npx vitest run src/lib/procurar-datas/motor/classificacao-candidato.test.ts`
- `npx vitest run src/lib/procurar-datas/motor/gerar-candidatos-disponibilidade-real.test.ts`

Depois da implementacao:
- `npx vitest run src/app/api/procurar-datas/v2/pesquisar/route.test.ts` (a criar)
- `npx tsc --noEmit --pretty false`

### Riscos

1. Extracao de logica da rota diagnostica pode introduzir regressao se campos diagnosticos forem copiados por engano.
2. Rota v2 real pode ter latencia diferente do Apps Script (mais rapida ou mais lenta).
3. Frontend pode depender de campos especificos do payload do Apps Script que a v2 nao reproduz.
4. Cache Supabase/geo_cache pode nao ter todos os enderecos necessarios em producao.
5. OSRM dedicado pode ter indisponibilidade em producao (fallback Haversine replica legado).

### Rollback

- Rota v2 real paralela: basta nao chamar a rota nova. Frontend continua no legado.
- Se integrada com flag em `/pesquisar`: voltar flag para `legado`.
- Se frontend alterado: reverter deploy do frontend.
- Nenhuma mudanca de banco ou migration envolvida.

### Decisoes pendentes do usuario

1. A rota v2 real deve ser sincrona (como a diagnostica) ou assincrona com polling (como o legado atual)?
2. O frontend deve ser alterado para chamar a rota v2, ou a troca deve ser transparente via `/pesquisar` com flag?
3. Aceitar latencia diferente em relacao ao Apps Script?
4. Validar mais um cenario especifico de 3 normais + 1 especial com pontos validos, ou K13/K14/K15/K16 sao suficientes?

### Resposta aos pontos obrigatorios

1. Menor proxima implementacao segura: criar rota `/api/procurar-datas/v2/pesquisar` paralela, reutilizando helpers puros.
2. Deve ficar paralela, nao mexer em producao.
3. Arquivos provavelmente alterados: novo `src/app/api/procurar-datas/v2/pesquisar/route.ts`, possivel extracao de orquestrador puro de `route.ts` diagnostica.
4. Testes: vitest nos helpers puros + novo teste de rota v2 + tsc.
5. Snippets DevTools: K17 com mesmo payload de K13/K14/K15.
6. Rollback: nao chamar rota nova ou voltar flag.
7. Decisoes pendentes: sincrona vs assincrona, alteracao de frontend, latencia, cenario extra.

Nao mudou:
- Regra de negocio.
- Classificacao, ranking, hora marcada, frontend, geocoding/cache, OSRM, Haversine, producao e `/api/procurar-datas/pesquisar`.
- Recorte ainda restrito a rota diagnostica, sem afetar producao.


## 2026-06-22 - Decisao aprovada: full-window controlado para extras uteis (antecipacao)

Status: decisao documentada. Nao altera codigo nesta tarefa.

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

### Causa da divergencia
O legado usa earlyStop em app-3-com-extras: processa slots com pontos primeiro, depois slots vazios, e encerra quando encontra 3 normais. A v2 avalia a janela completa antes do recorte final. Por isso a v2 encontra extras que o legado nao encontra.

### Decisao aprovada
A v2 pode usar busca full-window controlada para encontrar extras uteis, mas extras so devem aparecer se forem anteriores a ultima data normal selecionada.

### Definicao de "extra util"
Extra (especial/premium/hora marcada) cuja data é anterior a ultima data normal selecionada no recorte final.

### Regra de filtragem de extras
1. Selecionar as datas normais conforme a regra v2/legado-equivalente.
2. Identificar a ultima data normal selecionada.
3. Permitir extras especial/premium/hora marcada somente se a data do extra for menor que a ultima data normal.
4. Remover extras em data igual ou posterior a ultima normal.
5. Ordenar o resultado final cronologicamente.

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
- O legado tem earlyStop apos encontrar 3 normais.
- A v2 nao precisa reproduzir exatamente o earlyStop se isso impedir encontrar extras que antecipam a entrega.
- Porém a v2 tambem nao deve trazer extras posteriores a ultima normal.
- Decisao aprovada: full-window controlado para antecipacao, nao full-window livre.

### Status de implementacao
- Esta decisao ainda NAO foi implementada no codigo nesta tarefa.
- A proxima tarefa da Frente 2 / meio implementara a regra no recorte final.

### Risco conhecido
- Apos implementar, sera necessario revalidar K13, K14 e K15 no comparador ao vivo.

### Nao alterado
Nao houve alteracao de codigo, testes, frontend, Apps Script, rotas, banco, migrations, policies, OSRM, Haversine, classificacao, ranking, recorte ou regra de negocio nesta tarefa. Somente documentacao.

---

## K18.5 — Validacao da regra full-window controlado para extras uteis (2026-06-23)

### Resultado
- K13: passou completo (normais + extras corretos).
- K14: v2Ok=true. Comparacao completa nao realizada — legado estourou timeout (~170s).
- K15: v2Ok=true. Comparacao completa nao realizada — legado estourou timeout (~170s).
- cenariosComExtraInvalido = [] (nenhum extra invalido detectado na v2).
- Conclusao: a regra de recorte de extras uteis esta funcional na v2.

### Implementacao validada
- Helper `recortarCandidatosLegadoEquivalente` com regra full-window controlado.
- 25/25 testes unitarios + integracao passando.
- Nenhum extra posterior a ultima normal chega ao resultado final.

### Ajuste operacional do comparador (2026-06-23)
- Frente 3 / direita: timeout do legado no comparador ajustado de 170s para 300s.
- maxDuration da rota ajustado de 180 para 310 (margem sobre o timeout interno).
- Mensagem de erro de timeout atualizada para refletir o novo limite.
- Arquivo alterado: `src/app/api/procurar-datas/v2/comparar/route.ts` (linhas 45, 519, 569).
- Nao e correcao de regra de negocio. Nao altera motor v2, recorte, OSRM, cache, geocodificacao ou frontend.
- Rerrodar K18.5 com o novo timeout e validacao manual opcional.

### Pendencia remanescente
- K14 e K15: comparacao legado x v2 ainda nao validada por causa do timeout do legado. Com timeout de 300s, nova execucao pode permitir comparacao completa.
- Caso o legado continue estourando em 300s em casos complexos, pode indicar que Apps Script precisa de otimizacao — fora do escopo desta migracao.

---

## 2026-06-24 - Frente 0 / Controle: registro de melhorias futuras (backlog)

Status: documentacao apenas. Nao altera codigo nesta tarefa.

### Melhoria futura 1 — calculo instantaneo do tempo necessario dos itens

**Contexto:**
- Hoje o fluxo de calculo de `tempoNecessario` depende de uma tabela grande (mais de 5 mil linhas).
- A tela recalcula o tempo a cada mudanca/intervalo, deixando a experiencia lenta.
- O usuario informou que possui o Apps Script que gerou essa tabela.

**Objetivo futuro:**
- Migrar a logica que gerou a tabela para helper TypeScript puro.
- Calcular `tempoNecessario` quase instantaneamente a partir dos itens selecionados.
- Fonte provavel: Apps Script original que gerou a tabela.

**Cuidado:**
- Validar equivalencia contra a tabela atual antes de substituir.

**Escopo futuro:**
- Performance/usabilidade do calculo do tempo dos itens.

**Fora de escopo agora:**
- Nao misturar com investigacao Santo Amaro.
- Nao misturar com equivalencia OSRM/agenda/recorte.

---

### Melhoria futura 2 — exibir "dias restantes" e "encomenda" nos resultados

**Contexto:**
- No legado, os resultados mostram quantos dias faltam para a data (ex: `14 d`).
- Legado tambem indica se e encomenda.
- Na v2, esses dados ja vêm na resposta de `/api/procurar-datas/v2/progresso-compat`.

**Campos ja presentes no payload v2:**
- `daysLeftTxt`: `"14 d"`
- `encomenda`: `"Não"`

**Objetivo futuro:**
- Exibir nos resultados as informacoes `daysLeftTxt` e `encomenda`.
- Aproximar visualizacao da v2 do legado.

**Possivel UI:**
- Adicionar coluna "Faltam" ou "Prazo" usando `daysLeftTxt`.
- Adicionar coluna "Encomenda" usando `encomenda`.

**Escopo futuro:**
- Apresentacao/frontend apenas.

**Nao exige:**
- Alteracao no motor (campos ja vêm no payload v2).

**Fora de escopo agora:**
- Nao misturar com investigacao Santo Amaro.

---

### Melhoria futura 3 — observabilidade e estatisticas de desempenho por provedor

**Contexto:**
- No legado, dados de desempenho por provedor ja sao registrados em tabelas do Supabase.
- O usuario quer garantir que o fluxo v2 tambem registre esses dados corretamente.
- E necessario diferenciar nos registros historicos: execucoes do legado vs execucoes da v2.

**Objetivo futuro:**
- Validar se estatisticas de desempenho por provedor, hoje registradas pelo legado em tabelas do Supabase, tambem serao registradas pelo fluxo v2.
- Auditar as tabelas existentes e definir um campo de origem/motor para diferenciar execucoes do legado e da v2.
- Permitir comparacao historica antes/depois da migracao.

**Ideia de campo de identificacao (nome a definir apos auditoria):**
- Possiveis nomes: `motor_origem`, `origem_motor`, `versao_motor`, `procurar_datas_motor`, `legado_ou_v2`.
- Valores possiveis: `legado_apps_script`, `v2_nextjs`.
- Avaliar se precisa registrar versao do motor: `v2`, `v2-diagnostico`, `v2-compat`.

**Analises futuras permitidas:**
- Desempenho por provedor no legado vs v2.
- Comparacao antes/depois da migracao.
- Taxa de sucesso/falha por provedor.
- Latencia por provedor.
- Fallback usado ou nao.
- Volume por motor.
- Qualidade dos resultados por motor.
- Separar estatisticas antigas do legado das novas da v2.

**Pontos pendentes futuros:**
1. Auditar quais tabelas Supabase recebem estatisticas de provedor no legado.
2. Verificar se o v2 ja grava nessas tabelas.
3. Verificar se o v2 grava com os mesmos campos minimos do legado.
4. Definir campo para identificar motor/origem da execucao.
5. Definir valores possiveis do campo.
6. Avaliar se precisa registrar versao do motor.
7. Avaliar como manter comparacao historica sem quebrar relatorios existentes.
8. Garantir que logs/estatisticas nao registrem dados sensiveis desnecessarios.

**Cuidados:**
- Nao criar migration agora.
- Nao criar campo agora.
- Nao alterar schema agora.
- Nao alterar codigo de gravacao agora.
- Nao assumir nome da tabela sem auditar.
- Nao assumir nome final do campo sem checar estrutura existente.
- Nao registrar como requisito bloqueante da equivalencia atual.

**Escopo futuro:**
- Observabilidade e analise de desempenho/qualidade por motor/provedor.

**Fora de escopo agora:**
- Nao misturar com investigacao Santo Amaro.
- Nao misturar com correcao de filtro early, delta ou recorte.

---

### Nao alterado nesta tarefa
- Nenhuma regra de negocio foi alterada.
- Nenhum codigo funcional foi alterado.
- Frontend nao foi alterado.
- Motor v2 nao foi alterado.
- Apps Script nao foi alterado.
- Investigacao Santo Amaro continua pendente/separada.

---

## 2026-06-24 — Correcao fonte KM MAX ENTRE PONTOS (banco divergia da planilha)

### Contexto
No diagnostico Santo Amaro, o v2 descartava 25/07 incorretamente pelo filtro early Haversine (10.99km > 10.5km). O limite 10.5km vinha de `KM MAX ENTRE PONTOS = 7` (7 * 1.5 = 10.5). Porem a planilha (fonte do legado) tem `8`, e o app exibe `8`.

### Investigacao
- **Cadeia de leitura da v2:** `pesquisar-datas-v2.ts` -> `buscarConfiguracoesProcurarDatas()` -> `resolverValor()` prioriza Supabase sobre planilha -> banco tinha `valor = "7"` -> `kmMaxEntrePontosKm = 7` -> `limiteHaversineKm = 10.5`
- **Legado:** `CEP-APIBACK.gs:366` -> `getConfig('KM MAX ENTRE PONTOS', cfgSheet)` -> le planilha diretamente -> `MAX_POINT_KM = 8` -> filtro early: `8 * 1.5 = 12km`
- **Frontend:** `route.ts` le planilha (`item.valor = "8"`) e mostra banco (`valor_supabase = "7"`) como comparacao
- **Auditoria MCP:** importacao da planilha gravou `"8"` em 2026-06-10 18:49; edicao manual via tela alterou para `"7"` em 2026-06-10 19:30

### Causa raiz
Edicao manual no banco alterou `KM MAX ENTRE PONTOS` de `"8"` para `"7"` apos importacao da planilha. A v2 prioriza banco sobre planilha, por isso usava `7`. O legado le planilha diretamente, por isso usava `8`.

### Valor usado antes
- Banco: `7`
- v2: `kmMaxEntrePontosKm = 7`, `limiteHaversineKm = 10.5`

### Valor correto confirmado
- Planilha: `8`
- Legado: `MAX_POINT_KM = 8`
- Usuario confirmou que o valor correto/ativo e `8`

### Correcao aplicada
- UPDATE no banco `procurar_datas_config` SET `valor = '8'` WHERE `chave_upper = 'KM MAX ENTRE PONTOS'`
- Auditoria registrada em `procurar_datas_config_auditoria` (origem=api, alterado_por=cascade@lebebe.com.br)
- **Nenhuma alteracao de codigo**

### Impacto em 02/07 e 25/07
- `02/07` (18.20km): continua descartado (18.20 > 12)
- `25/07` (10.99km): nao sera mais descartado pelo filtro early (10.99 < 12) — deve aparecer como normal
- `limiteHaversineKm`: 10.5 -> 12

### Testes
- npx tsc --noEmit: sem erros
- npx vitest run calcular-km-adicional-real-controlado.test.ts route.test.ts: 102 passed

### Nao alterado
- Codigo do config-service.ts (prioridade banco > planilha esta correta)
- Codigo do filtro early
- Frontend, Apps Script, rotas legado, recorte/ranking, regra de negocio

### Pendencias
- Executar diagnostico Santo Amaro com payload real para validar 02/07, 25/07, 16/07, 24/07
- 16/07 (premium) pode ter outra causa de divergencia
- Verificar se outras chaves do banco divergem da planilha

---
