
via modal ele conseguiu ler a data inicial e começou a pesquisa corretamente a partir da data selecionada, veja abaixo.

Teste	ExecutarPesquisaViaModalAndShow	Status desconhecido	13 de mar. de 2026, 15:56:09	4.186 s	
Em execução
Registros do Cloud
13 de mar. de 2026, 15:56:19	Informação	[OSRM] endpoint ativo: https://osrm.lebebe.cloud
13 de mar. de 2026, 15:56:20	Informação	[OSRM] /health https://osrm.lebebe.cloud → 400.0
13 de mar. de 2026, 15:56:24	Informação	[PARAMS] KM Especial=5000m | KM Premium=10000m
13 de mar. de 2026, 15:56:24	Informação	[PARAMS] Valor Especial=R$100 | Valor Premium=R$200
13 de mar. de 2026, 15:56:24	Informação	[PARAMS] Hora Marcada: +2h | Valor=R$400
13 de mar. de 2026, 15:56:26	Informação	[MODAL-COORDS] ✅ Usando coordenadas validadas do modal: lat=-25.503425 lng=-49.272548 provider=locationiq
13 de mar. de 2026, 15:56:26	Informação	[DEST] CEP="" | provider=locationiq | display="Rua Narciso Mendes, Casa, Xaxim, Curitiba, Região Geográfica Imediata de Curitiba, Região Metropolitana de Curitiba, Região Geográfica Intermediária de Curitiba, Paraná, Região Sul, 81810-520, Brasil" | lat=-25.503425 lng=-49.272548
13 de mar. de 2026, 15:56:26	Informação	[ORIGEM] depósito="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 15:56:26	Informação	[OSRM] base=https://osrm.lebebe.cloud → OK em 719ms
13 de mar. de 2026, 15:56:26	Informação	📏 Depósito → destino: 1991 m (1.99 km)
13 de mar. de 2026, 15:56:26	Informação	[DATE] Usando dataInicial: 2026-03-23 (2026-03-23T03:00:00.000Z)
13 de mar. de 2026, 15:56:29	Informação	[RULE] Bloqueio NÃO aplicado: BERÇO/CAMA="DIVERSOS", ROUPEIRO="NÃO" → EQUIPE 2 permitida
13 de mar. de 2026, 15:56:29	Informação	[OTIMIZAÇÃO] Limitado a 45 dias: 129 → 57 slots (−72)
13 de mar. de 2026, 15:56:29	Informação	[OTIMIZAÇÃO] Total=57 → processando 0 com pontos (−57 vazios, −0 adiados)
13 de mar. de 2026, 15:56:32	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 209ms (2 hits)
13 de mar. de 2026, 15:56:32	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 15:56:32	Informação	[PARSE-ADDR] logr="Rua Engenheiros Rebouças" num="1769" bairro="Rebouças" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T18:56:32.039Z
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP] addr_display="Rua Engenheiros Rebouças, 1769, Rebouças, Curitiba - PR, Brasil"
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP] addr_norm="RUA ENGENHEIROS REBOUCAS, REBOUCAS, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 15:56:32	Informação	[LOOKUP] hash_key=1b70a732b5ed2b11e9a6294384d71f6ed184c674
13 de mar. de 2026, 15:56:32	Informação	[GEO-CACHE] op=READ | status=HIT | key=1b70a732b5ed2b11e9a6294384d71f6ed184c674 | origin=AGENDA | provider=l1 (33ms)
13 de mar. de 2026, 15:56:33	Informação	[AUDIT] ✅ Registrado em 142ms: cache_hit=true provider=l1
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP-FIM] total=53ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 15:56:33	Informação	[PTS] 23/03 (segunda) | EQUIPE 1 | "(03:10) REBOUÇAS 27131 (REBOUÇAS)" | fonte=LUGAR | norm="Rua Engenheiros Rebouças, 1769, Rebouças, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 15:56:33	Informação	[PARSE-ADDR] logr="Rua Hermínio Cardoso" num="444" bairro="Tingui" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T18:56:33.092Z
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP] addr_display="Rua Hermínio Cardoso, 444, Tingui, Curitiba - PR, Brasil"
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP] addr_norm="RUA HERMINIO CARDOSO, TINGUI, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP] hash_key=62ea103488c9ad3872fc97c29b9ddcba485f6825
13 de mar. de 2026, 15:56:33	Informação	[GEO-CACHE] op=READ | status=HIT | key=62ea103488c9ad3872fc97c29b9ddcba485f6825 | origin=AGENDA | provider=l1 (27ms)
13 de mar. de 2026, 15:56:33	Informação	[AUDIT] ✅ Registrado em 183ms: cache_hit=true provider=l1
13 de mar. de 2026, 15:56:33	Informação	[LOOKUP-FIM] total=41ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 15:56:33	Informação	[PTS] 23/03 (segunda) | EQUIPE 1 | "(02:15) TINGUI 62790 (TINGUI)" | fonte=LUGAR | norm="Rua Hermínio Cardoso, 444, Tingui, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 15:56:35	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 120ms (0 hits)
13 de mar. de 2026, 15:56:35	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 15:56:35	Informação	[PARSE-ADDR] logr="Rua Doutor Francisco Soares" num="860" bairro="DEPOSITO" cidade="Novo Mundo" uf="PR"
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T18:56:35.069Z
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP] addr_display="Rua Doutor Francisco Soares, 860, DEPOSITO, Novo Mundo - PR, Brasil"
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP] addr_norm="RUA DOUTOR FRANCISCO SOARES, DEPOSITO, NOVO MUNDO - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP] hash_key=cf668933545e4749dedc23f6fb7d67fd57f98da6
13 de mar. de 2026, 15:56:35	Informação	[GEO-CACHE] op=READ | status=MISS | key=cf668933545e4749dedc23f6fb7d67fd57f98da6 | origin=AGENDA | provider=l1 (36ms)
13 de mar. de 2026, 15:56:35	Informação	[GEO-CACHE] addr_norm="RUA DOUTOR FRANCISCO SOARES, DEPOSITO, NOVO MUNDO - PR, BRASIL"
13 de mar. de 2026, 15:56:35	Informação	[GEO-CACHE] op=READ | status=MISS | key=cf668933545e4749dedc23f6fb7d67fd57f98da6 | origin=AGENDA | provider=supabase
13 de mar. de 2026, 15:56:35	Informação	[GEO-CACHE] addr_norm="RUA DOUTOR FRANCISCO SOARES, DEPOSITO, NOVO MUNDO - PR, BRASIL"
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP] Cache MISS → Buscando providers externos...
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP-CONTEXTO] func=geocodeAddressGratisStrict_ | timestamp=2026-03-13T18:56:35.133Z
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 15:56:35	Informação	[LOOKUP-PARAMS] {"addrFull":"Rua Doutor Francisco Soares, 860, DEPOSITO, Novo Mundo - PR, Brasil","uf":"PR","city":"Novo Mundo"}
13 de mar. de 2026, 15:56:35	Informação	[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====
13 de mar. de 2026, 15:56:35	Informação	[GEO-PROVIDER] addr="Rua Doutor Francisco Soares, 860, DEPOSITO, Novo Mundo - PR, Brasil" | uf=PR | city=Novo Mundo
13 de mar. de 2026, 15:56:35	Informação	[GEO-KEYS] Chaves carregadas da planilha backend em 666ms
13 de mar. de 2026, 15:56:36	Informação	[GEO-KEYS] USER LocationIQ=MISSING | SCRIPT LocationIQ=MISSING | GLOBAL LocationIQ=CONFIGURED(***08bd)
13 de mar. de 2026, 15:56:36	Informação	[GEO-KEYS] USER maps.co=MISSING | SCRIPT maps.co=MISSING | GLOBAL maps.co=CONFIGURED(***39b9)
13 de mar. de 2026, 15:56:36	Informação	[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.
13 de mar. de 2026, 15:56:36	Informação	[GEO-PROVIDER] provider=locationiq | status=TRYING
13 de mar. de 2026, 15:56:36	Informação	[LocationIQ] Buscando estruturado: street=Rua%20Doutor%20Francisco%20Soares%20860&city=Novo%20Mundo&state=PR&country=Brazil
13 de mar. de 2026, 15:56:36	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="NOVO MUNDO", recebido="CURITIBA")
13 de mar. de 2026, 15:56:36	Informação	[GEO-PROVIDER] provider=locationiq | status=SUCCESS (405ms) | confidence=0.10 | display="860, Rua Doutor Francisco Soares, Novo Mundo, Curitiba, Região Geográfica Imedia" | coords=(-25.493498,-49.276551)
13 de mar. de 2026, 15:56:36	Informação	[GEO-PROVIDER] provider=mapsco | status=TRYING
13 de mar. de 2026, 15:56:37	Informação	[GEO-PROVIDER] provider=mapsco | status=FAILED (591ms) | error=Sem re


via api ele nao considerou a data inicial e começou a partir de d+2 apenas. Preciso que ajuste.


Versão 9	apiProcurarDatasPorEndereco	Execution API	13 de mar. de 2026, 16:04:11	5.215 s	
Em execução
Registros do Cloud
13 de mar. de 2026, 16:05:05	Informação	[GEO-CACHE] op=READ | status=HIT | key=29654a5885461441c472a8cce85140b2b5ea75ab | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:06	Informação	[AUDIT] ✅ Registrado em 156ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:06	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:06	Informação	[PTS] 01/04 (quarta) | EQUIPE 1 | "(01:15) PINHEIRINHO 63586 (PINHEIRINHO)" | fonte=LUGAR | norm="Rua Lothario Boutin, 220, Pinheirinho, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:07	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 140ms (2 hits)
13 de mar. de 2026, 16:05:07	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:05:07	Informação	[PARSE-ADDR] logr="Rua Coronel Ottoni Maciel" num="740" bairro="Vila Izabel" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:07.732Z
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP] addr_display="Rua Coronel Ottoni Maciel, 740, Vila Izabel, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP] addr_norm="RUA CORONEL OTTONI MACIEL, VILA IZABEL, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:07	Informação	[LOOKUP] hash_key=53ade356b17cdbcaf150a0abfb4dac15862ec8c0
13 de mar. de 2026, 16:05:07	Informação	[GEO-CACHE] op=READ | status=HIT | key=53ade356b17cdbcaf150a0abfb4dac15862ec8c0 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:08	Informação	[AUDIT] ✅ Registrado em 126ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP-FIM] total=13ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:08	Informação	[PTS] 02/04 (quinta) | EQUIPE 1 | "(00:30) VILA IZABEL OS 4500 (VILA IZABEL)" | fonte=LUGAR | norm="Rua Coronel Ottoni Maciel, 740, Vila Izabel, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:08	Informação	[PARSE-ADDR] logr="Rua Monsenhor Celso" num="243" bairro="Centro" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:08.709Z
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP] addr_display="Rua Monsenhor Celso, 243, Centro, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP] addr_norm="RUA MONSENHOR CELSO, CENTRO, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:08	Informação	[LOOKUP] hash_key=49eabbd33075d5efe9e3e45deee6cf6d740a73b9
13 de mar. de 2026, 16:05:08	Informação	[GEO-CACHE] op=READ | status=HIT | key=49eabbd33075d5efe9e3e45deee6cf6d740a73b9 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:09	Informação	[AUDIT] ✅ Registrado em 169ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:09	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:09	Informação	[PTS] 02/04 (quinta) | EQUIPE 1 | "(02:00) CENTRO 25504 (CENTRO)" | fonte=LUGAR | norm="Rua Monsenhor Celso, 243, Centro, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:10	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 130ms (1 hits)
13 de mar. de 2026, 16:05:10	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:10	Informação	[PARSE-ADDR] logr="Rua Henrique Dyck" num="207" bairro="Boqueirão" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:10.525Z
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP] addr_display="Rua Henrique Dyck, 207, Boqueirão, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP] addr_norm="RUA HENRIQUE DYCK, BOQUEIRAO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:10	Informação	[LOOKUP] hash_key=801132ef99f9a226ab9c0756c395d784546b56cf
13 de mar. de 2026, 16:05:10	Informação	[GEO-CACHE] op=READ | status=HIT | key=801132ef99f9a226ab9c0756c395d784546b56cf | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:12	Informação	[AUDIT] ✅ Registrado em 1088ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:12	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:12	Informação	[PTS] 06/04 (segunda) | EQUIPE 2 | "(00:40) BOQUEIRÃO 54268 (BOQUEIRÃO)" | fonte=LUGAR | norm="Rua Henrique Dyck, 207, Boqueirão, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:13	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 150ms (1 hits)
13 de mar. de 2026, 16:05:13	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:05:13	Informação	[PARSE-ADDR] logr="Rua Florindo Lindes" num="290" bairro="Jardim Amélia" cidade="Pinhais" uf="PR"
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:13.347Z
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP] addr_display="Rua Florindo Lindes, 290, Jardim Amélia, Pinhais - PR, Brasil"
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP] addr_norm="RUA FLORINDO LINDES, JARDIM AMELIA, PINHAIS - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:13	Informação	[LOOKUP] hash_key=8f4b5a5d40379d1d6ae229f72b7d5d0482ca7e38
13 de mar. de 2026, 16:05:13	Informação	[GEO-CACHE] op=READ | status=HIT | key=8f4b5a5d40379d1d6ae229f72b7d5d0482ca7e38 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:14	Informação	[AUDIT] ✅ Registrado em 139ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:14	Informação	[PTS] 07/04 (terça) | EQUIPE 1 | "1.1 (00:00) PINHAIS 27482 (PINHAIS)" | fonte=LUGAR | norm="Rua Florindo Lindes, 290, Jardim Amélia, Pinhais - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:14	Informação	[PARSE-ADDR] logr="Rua Florindo Lindes" num="290" bairro="Jardim Amélia" cidade="Pinhais" uf="PR"
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:14.096Z
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP] addr_display="Rua Florindo Lindes, 290, Jardim Amélia, Pinhais - PR, Brasil"
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP] addr_norm="RUA FLORINDO LINDES, JARDIM AMELIA, PINHAIS - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP] hash_key=8f4b5a5d40379d1d6ae229f72b7d5d0482ca7e38
13 de mar. de 2026, 16:05:14	Informação	[GEO-CACHE] op=READ | status=HIT | key=8f4b5a5d40379d1d6ae229f72b7d5d0482ca7e38 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:14	Informação	[AUDIT] ✅ Registrado em 156ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:14	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:14	Informação	[PTS] 07/04 (terça) | EQUIPE 1 | "1 (03:25) PINHAIS 27212 (PINHAIS)" | fonte=LUGAR | norm="Rua Florindo Lindes, 290, Jardim Amélia, Pinhais - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:16	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 127ms (0 hits)
13 de mar. de 2026, 16:05:16	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:16	Informação	[PARSE-ADDR] logr="Rua Angélica Maria Taborda Santos" num="147" bairro="sobrado 5 portão branco" cidade="Boqueirão" uf="PR"
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:16.095Z
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP] addr_display="Rua Angélica Maria Taborda Santos, 147, sobrado 5 portão branco, Boqueirão - PR, Brasil"
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP] addr_norm="RUA ANGELICA MARIA TABORDA SANTOS, SOBRADO 5 PORTAO BRANCO, BOQUEIRAO - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP] hash_key=8814087f5d957a5a9917ea441c5808705682d233
13 de mar. de 2026, 16:05:16	Informação	[GEO-CACHE] op=READ | status=MISS | key=8814087f5d957a5a9917ea441c5808705682d233 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:16	Informação	[GEO-CACHE] addr_norm="RUA ANGELICA MARIA TABORDA SANTOS, SOBRADO 5 PORTAO BRANCO, BOQUEIRAO - PR, BRASIL"
13 de mar. de 2026, 16:05:16	Informação	[GEO-CACHE] op=READ | status=MISS | key=8814087f5d957a5a9917ea441c5808705682d233 | origin=AGENDA | provider=supabase
13 de mar. de 2026, 16:05:16	Informação	[GEO-CACHE] addr_norm="RUA ANGELICA MARIA TABORDA SANTOS, SOBRADO 5 PORTAO BRANCO, BOQUEIRAO - PR, BRASIL"
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP] Cache MISS → Buscando providers externos...
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP-CONTEXTO] func=geocodeAddressGratisStrict_ | timestamp=2026-03-13T19:05:16.106Z
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:16	Informação	[LOOKUP-PARAMS] {"addrFull":"Rua Angélica Maria Taborda Santos, 147, sobrado 5 portão branco, Boqueirão - PR, Brasil","uf":"PR","city":"Boqueirão"}
13 de mar. de 2026, 16:05:16	Informação	[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====
13 de mar. de 2026, 16:05:16	Informação	[GEO-PROVIDER] addr="Rua Angélica Maria Taborda Santos, 147, sobrado 5 portão branco, Boqueirão - PR, Brasil" | uf=PR | city=Boqueirão
13 de mar. de 2026, 16:05:17	Informação	[GEO-KEYS] Chaves carregadas da planilha backend em 952ms
13 de mar. de 2026, 16:05:17	Informação	[GEO-KEYS] USER LocationIQ=MISSING | SCRIPT LocationIQ=MISSING | GLOBAL LocationIQ=CONFIGURED(***08bd)
13 de mar. de 2026, 16:05:17	Informação	[GEO-KEYS] USER maps.co=MISSING | SCRIPT maps.co=MISSING | GLOBAL maps.co=CONFIGURED(***39b9)
13 de mar. de 2026, 16:05:17	Informação	[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.
13 de mar. de 2026, 16:05:17	Informação	[GEO-PROVIDER] provider=locationiq | status=TRYING
13 de mar. de 2026, 16:05:17	Informação	[LocationIQ] Buscando estruturado: street=Rua%20Ang%C3%A9lica%20Maria%20Taborda%20Santos%20147&city=Boqueir%C3%A3o&state=PR&country=Brazil
13 de mar. de 2026, 16:05:17	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="BOQUEIRAO", recebido="CURITIBA")
13 de mar. de 2026, 16:05:17	Informação	[GEO-PROVIDER] provider=locationiq | status=SUCCESS (370ms) | confidence=0.10 | display="147, Rua Angélica Maria Taborda Santos, Boqueirão, Curitiba, Região Geográfica I" | coords=(-25.511138,-49.242374)
13 de mar. de 2026, 16:05:17	Informação	[GEO-PROVIDER] provider=mapsco | status=TRYING
13 de mar. de 2026, 16:05:17	Informação	[GEO-PROVIDER] provider=mapsco | status=FAILED (337ms) | error=Sem resultado válido
13 de mar. de 2026, 16:05:17	Informação	[GEO-PROVIDER] provider=photon | status=TRYING
13 de mar. de 2026, 16:05:18	Informação	[GEO-PROVIDER] provider=photon | status=FAILED (508ms) | error=Sem resultado válido
13 de mar. de 2026, 16:05:18	Informação	[GEO-PROVIDER] provider=locationiq | status=REJECTED | confidence=0.10
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO] type=VALIDATION | msg=Melhor resultado rejeitado por baixa confiança
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO]   Motivo: Confidence 0.10 < 0.65
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO] context={"provider":"locationiq","confidence":0.1,"threshold":0.65,"reason":"Confidence 0.10 < 0.65"}
13 de mar. de 2026, 16:05:18	Informação	[LOOKUP-FIM] total=2209ms | result=FAILED
13 de mar. de 2026, 16:05:18	Informação	[LOOKUP] Providers executados em 2210ms
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO] type=VALIDATION | msg=Geocoding rejeitado
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO]   Motivo: N/A
13 de mar. de 2026, 16:05:18	Informação	[GEO-ERRO] context={"error":"Nenhum provedor retornou resultado com precisão suficiente (min 0.65)."}
13 de mar. de 2026, 16:05:18	Informação	[LOOKUP-FIM] total=2226ms | result=FAILED (no valid provider)
13 de mar. de 2026, 16:05:18	Informação	[PTS][ERRO] geocode falhou | "(00:45) BOQUEIRÃO 54140 (BOQUEIRÃO)" | raw_addr="Rua Angélica Maria Taborda Santos, 147, sobrado 5 portão branco , Boqueirão, Curitiba - PR, 81750- 230" | erro=Nenhum provedor retornou resultado com precisão suficiente (min 0.65).
13 de mar. de 2026, 16:05:19	Informação	[SUPABASE-BATCH] ✅ 4 hashes consultados em 136ms (4 hits)
13 de mar. de 2026, 16:05:19	Informação	[BATCH-PRELOAD] ✅ 4 endereços pré-carregados
13 de mar. de 2026, 16:05:19	Informação	[PARSE-ADDR] logr="Rua Vítor Stec" num="104" bairro="Xaxim" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:19.356Z
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP] addr_display="Rua Vítor Stec, 104, Xaxim, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP] addr_norm="RUA VITOR STEC, XAXIM, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:19	Informação	[LOOKUP] hash_key=5844987914c23a912114b43cc47f89af6667f732
13 de mar. de 2026, 16:05:19	Informação	[GEO-CACHE] op=READ | status=HIT | key=5844987914c23a912114b43cc47f89af6667f732 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:20	Informação	[AUDIT] ✅ Registrado em 119ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:20	Informação	[PTS] 08/04 (quarta) | EQUIPE 2 | "(01:15) XAXIM 54131 (XAXIM)" | fonte=LUGAR | norm="Rua Vítor Stec, 104, Xaxim, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:20	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:20.237Z
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:20	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:05:20	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:21	Informação	[AUDIT] ✅ Registrado em 138ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:21	Informação	[PTS] 08/04 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:21	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:21.067Z
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:21	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:05:21	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:22	Informação	[AUDIT] ✅ Registrado em 153ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:22	Informação	[PTS] 08/04 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:22	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:22.328Z
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:22	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:05:22	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:23	Informação	[AUDIT] ✅ Registrado em 429ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:23	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:23	Informação	[PTS] 08/04 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:24	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 157ms (1 hits)
13 de mar. de 2026, 16:05:24	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:05:24	Informação	[PARSE-ADDR] logr="Rua Visconde do Serro Frio" num="46" bairro="AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085" cidade="Novo Mundo" uf="PR"
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:24.384Z
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP] addr_display="Rua Visconde do Serro Frio, 46, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, Novo Mundo - PR, Brasil"
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP] addr_norm="RUA VISCONDE DO SERRO FRIO, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, NOVO MUNDO - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP] hash_key=8d877e85c671f6337e8445794e35f10c7fc6ed6a
13 de mar. de 2026, 16:05:24	Informação	[GEO-CACHE] op=READ | status=MISS | key=8d877e85c671f6337e8445794e35f10c7fc6ed6a | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:24	Informação	[GEO-CACHE] addr_norm="RUA VISCONDE DO SERRO FRIO, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, NOVO MUNDO - PR, BRASIL"
13 de mar. de 2026, 16:05:24	Informação	[GEO-CACHE] op=READ | status=MISS | key=8d877e85c671f6337e8445794e35f10c7fc6ed6a | origin=AGENDA | provider=supabase
13 de mar. de 2026, 16:05:24	Informação	[GEO-CACHE] addr_norm="RUA VISCONDE DO SERRO FRIO, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, NOVO MUNDO - PR, BRASIL"
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP] Cache MISS → Buscando providers externos...
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP-CONTEXTO] func=geocodeAddressGratisStrict_ | timestamp=2026-03-13T19:05:24.395Z
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:24	Informação	[LOOKUP-PARAMS] {"addrFull":"Rua Visconde do Serro Frio, 46, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, Novo Mundo - PR, Brasil","uf":"PR","city":"Novo Mundo"}
13 de mar. de 2026, 16:05:24	Informação	[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====
13 de mar. de 2026, 16:05:24	Informação	[GEO-PROVIDER] addr="Rua Visconde do Serro Frio, 46, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, Novo Mundo - PR, B" | uf=PR | city=Novo Mundo
13 de mar. de 2026, 16:05:25	Informação	[GEO-KEYS] Chaves carregadas da planilha backend em 666ms
13 de mar. de 2026, 16:05:25	Informação	[GEO-KEYS] USER LocationIQ=MISSING | SCRIPT LocationIQ=MISSING | GLOBAL LocationIQ=CONFIGURED(***08bd)
13 de mar. de 2026, 16:05:25	Informação	[GEO-KEYS] USER maps.co=MISSING | SCRIPT maps.co=MISSING | GLOBAL maps.co=CONFIGURED(***39b9)
13 de mar. de 2026, 16:05:25	Informação	[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.
13 de mar. de 2026, 16:05:25	Informação	[GEO-PROVIDER] provider=locationiq | status=TRYING
13 de mar. de 2026, 16:05:25	Informação	[LocationIQ] Buscando estruturado: street=Rua%20Visconde%20do%20Serro%20Frio%2046&city=Novo%20Mundo&state=PR&country=Brazil
13 de mar. de 2026, 16:05:25	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="NOVO MUNDO", recebido="CURITIBA")
13 de mar. de 2026, 16:05:25	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="NOVO MUNDO", recebido="CURITIBA")
13 de mar. de 2026, 16:05:25	Informação	[GEO-PROVIDER] provider=locationiq | status=SUCCESS (435ms) | confidence=0.10 | display="Rua Visconde do Serro Frio, Novo Mundo, Curitiba, Região Geográfica Imediata de " | coords=(-25.486284,-49.299656)
13 de mar. de 2026, 16:05:25	Informação	[GEO-PROVIDER] provider=mapsco | status=TRYING
13 de mar. de 2026, 16:05:25	Informação	[GEO-PROVIDER] provider=mapsco | status=FAILED (353ms) | error=Sem resultado válido
13 de mar. de 2026, 16:05:25	Informação	[GEO-PROVIDER] provider=photon | status=TRYING
13 de mar. de 2026, 16:05:26	Informação	[GEO-PROVIDER] provider=photon | status=FAILED (528ms) | error=Sem resultado válido
13 de mar. de 2026, 16:05:26	Informação	[GEO-PROVIDER] provider=locationiq | status=REJECTED | confidence=0.10
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO] type=VALIDATION | msg=Melhor resultado rejeitado por baixa confiança
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO]   Motivo: Confidence 0.10 < 0.65
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO] context={"provider":"locationiq","confidence":0.1,"threshold":0.65,"reason":"Confidence 0.10 < 0.65"}
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP-FIM] total=2019ms | result=FAILED
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP] Providers executados em 2020ms
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO] type=VALIDATION | msg=Geocoding rejeitado
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO]   Motivo: N/A
13 de mar. de 2026, 16:05:26	Informação	[GEO-ERRO] context={"error":"Nenhum provedor retornou resultado com precisão suficiente (min 0.65)."}
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP-FIM] total=2033ms | result=FAILED (no valid provider)
13 de mar. de 2026, 16:05:26	Informação	[PTS][ERRO] geocode falhou | "(00:45) NOVO MUNDO 27491 (NOVO MUNDO)" | raw_addr="Rua Visconde do Serro Frio, 46, AO LADO DO CONDOR DO NOVO MUNDO APARTAMENTO 1085, Novo Mundo, Curitiba - PR, 81050- 080" | erro=Nenhum provedor retornou resultado com precisão suficiente (min 0.65).
13 de mar. de 2026, 16:05:26	Informação	[PARSE-ADDR] logr="Rua Carolina Castelli" num="800" bairro="Novo Mundo" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:26.419Z
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP] addr_display="Rua Carolina Castelli, 800, Novo Mundo, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP] addr_norm="RUA CAROLINA CASTELLI, NOVO MUNDO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:26	Informação	[LOOKUP] hash_key=7ffb7ee31bddc35e66e7434e89a4df7ce6c7c189
13 de mar. de 2026, 16:05:26	Informação	[GEO-CACHE] op=READ | status=HIT | key=7ffb7ee31bddc35e66e7434e89a4df7ce6c7c189 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:27	Informação	[AUDIT] ✅ Registrado em 267ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:27	Informação	[LOOKUP-FIM] total=8ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:27	Informação	[PTS] 09/04 (quinta) | EQUIPE 1 | "(02:30) NOVO MUNDO 63745 (NOVO MUNDO)" | fonte=LUGAR | norm="Rua Carolina Castelli, 800, Novo Mundo, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:29	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 169ms (1 hits)
13 de mar. de 2026, 16:05:29	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:29	Informação	[PARSE-ADDR] logr="Rua Alferes Ângelo Sampaio" num="2692" bairro="Bigorrilho" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:29.188Z
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP] addr_display="Rua Alferes Ângelo Sampaio, 2692, Bigorrilho, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP] addr_norm="RUA ALFERES ANGELO SAMPAIO, BIGORRILHO, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:29	Informação	[LOOKUP] hash_key=aa7cce71206016f30da29654f1a9ec796a7a199e
13 de mar. de 2026, 16:05:29	Informação	[GEO-CACHE] op=READ | status=HIT | key=aa7cce71206016f30da29654f1a9ec796a7a199e | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:30	Informação	[AUDIT] ✅ Registrado em 624ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:30	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:30	Informação	[PTS] 09/04 (quinta) | EQUIPE 2 | "(00:45) BIGORRILHO OS 4509 (BIGORRILHO)" | fonte=LUGAR | norm="Rua Alferes Ângelo Sampaio, 2692, Bigorrilho, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:31	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 160ms (1 hits)
13 de mar. de 2026, 16:05:31	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:05:31	Informação	[PARSE-ADDR] logr="Rua Francisco Lourenço Johnscher" num="610" bairro="Boqueirão" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:31.929Z
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP] addr_display="Rua Francisco Lourenço Johnscher, 610, Boqueirão, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP] addr_norm="RUA FRANCISCO LOURENCO JOHNSCHER, BOQUEIRAO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:31	Informação	[LOOKUP] hash_key=8cf02d090f8df0c995d381ced96d5a8ade61f2a7
13 de mar. de 2026, 16:05:31	Informação	[GEO-CACHE] op=READ | status=HIT | key=8cf02d090f8df0c995d381ced96d5a8ade61f2a7 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:32	Informação	[AUDIT] ✅ Registrado em 123ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:32	Informação	[PTS] 10/04 (sexta) | EQUIPE 1 | "(00:00) BOQUEIRÃO ENTREGAR JUNTO 63733+63792 (BOQUEIRÃO)" | fonte=LUGAR | norm="Rua Francisco Lourenço Johnscher, 610, Boqueirão, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:32	Informação	[PARSE-ADDR] logr="Rua Francisco Lourenço Johnscher" num="610" bairro="Boqueirão" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:32.669Z
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP] addr_display="Rua Francisco Lourenço Johnscher, 610, Boqueirão, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP] addr_norm="RUA FRANCISCO LOURENCO JOHNSCHER, BOQUEIRAO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:32	Informação	[LOOKUP] hash_key=8cf02d090f8df0c995d381ced96d5a8ade61f2a7
13 de mar. de 2026, 16:05:32	Informação	[GEO-CACHE] op=READ | status=HIT | key=8cf02d090f8df0c995d381ced96d5a8ade61f2a7 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:33	Informação	[AUDIT] ✅ Registrado em 141ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:33	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:33	Informação	[PTS] 10/04 (sexta) | EQUIPE 1 | "(00:45) BOQUEIRÃO 63733 (BOQUEIRÃO)" | fonte=LUGAR | norm="Rua Francisco Lourenço Johnscher, 610, Boqueirão, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:34	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 110ms (0 hits)
13 de mar. de 2026, 16:05:34	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:34	Informação	[PARSE-ADDR] logr="Rua Adjalme Garcia da Silva" num="84" bairro="Jardim Giannini" cidade="Almirante Tamandaré" uf="PR"
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:34.448Z
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP] addr_display="Rua Adjalme Garcia da Silva, 84, Jardim Giannini, Almirante Tamandaré - PR, Brasil"
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP] addr_norm="RUA ADJALME GARCIA DA SILVA, JARDIM GIANNINI, ALMIRANTE TAMANDARE - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP] hash_key=2ce57660681945ee4b83f3100757ebd2d03b6afb
13 de mar. de 2026, 16:05:34	Informação	[GEO-CACHE] op=READ | status=MISS | key=2ce57660681945ee4b83f3100757ebd2d03b6afb | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:34	Informação	[GEO-CACHE] addr_norm="RUA ADJALME GARCIA DA SILVA, JARDIM GIANNINI, ALMIRANTE TAMANDARE - PR, BRASIL"
13 de mar. de 2026, 16:05:34	Informação	[GEO-CACHE] op=READ | status=MISS | key=2ce57660681945ee4b83f3100757ebd2d03b6afb | origin=AGENDA | provider=supabase
13 de mar. de 2026, 16:05:34	Informação	[GEO-CACHE] addr_norm="RUA ADJALME GARCIA DA SILVA, JARDIM GIANNINI, ALMIRANTE TAMANDARE - PR, BRASIL"
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP] Cache MISS → Buscando providers externos...
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP-CONTEXTO] func=geocodeAddressGratisStrict_ | timestamp=2026-03-13T19:05:34.459Z
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:34	Informação	[LOOKUP-PARAMS] {"addrFull":"Rua Adjalme Garcia da Silva, 84, Jardim Giannini, Almirante Tamandaré - PR, Brasil","uf":"PR","city":"Almirante Tamandaré"}
13 de mar. de 2026, 16:05:34	Informação	[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====
13 de mar. de 2026, 16:05:34	Informação	[GEO-PROVIDER] addr="Rua Adjalme Garcia da Silva, 84, Jardim Giannini, Almirante Tamandaré - PR, Brasil" | uf=PR | city=Almirante Tamandaré
13 de mar. de 2026, 16:05:35	Informação	[GEO-KEYS] Chaves carregadas da planilha backend em 631ms
13 de mar. de 2026, 16:05:35	Informação	[GEO-KEYS] USER LocationIQ=MISSING | SCRIPT LocationIQ=MISSING | GLOBAL LocationIQ=CONFIGURED(***08bd)
13 de mar. de 2026, 16:05:35	Informação	[GEO-KEYS] USER maps.co=MISSING | SCRIPT maps.co=MISSING | GLOBAL maps.co=CONFIGURED(***39b9)
13 de mar. de 2026, 16:05:35	Informação	[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.
13 de mar. de 2026, 16:05:35	Informação	[GEO-PROVIDER] provider=locationiq | status=TRYING
13 de mar. de 2026, 16:05:35	Informação	[LocationIQ] Buscando estruturado: street=Rua%20Adjalme%20Garcia%20da%20Silva%2084&city=Almirante%20Tamandar%C3%A9&state=PR&country=Brazil
13 de mar. de 2026, 16:05:35	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="ALMIRANTE TAMANDARE", recebido="CURITIBA")
13 de mar. de 2026, 16:05:35	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="ALMIRANTE TAMANDARE", recebido="CURITIBA")
13 de mar. de 2026, 16:05:35	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="ALMIRANTE TAMANDARE", recebido="PINHAIS")
13 de mar. de 2026, 16:05:35	Informação	[GEO-PROVIDER] provider=locationiq | status=SUCCESS (353ms) | confidence=0.10 | display="84, Rua Araguaia, Capão Da Imbuia, Curitiba, Curitiba, Paraná, 82810-460, Brasil" | coords=(-25.442388,-49.209910)
13 de mar. de 2026, 16:05:35	Informação	[GEO-PROVIDER] provider=mapsco | status=TRYING
13 de mar. de 2026, 16:05:35	Informação	[GEO-PROVIDER] provider=mapsco | status=FAILED (329ms) | error=Sem resultado válido
13 de mar. de 2026, 16:05:35	Informação	[GEO-PROVIDER] provider=photon | status=TRYING
13 de mar. de 2026, 16:05:36	Informação	[GEO-PROVIDER] provider=photon | status=FAILED (485ms) | error=Sem resultado válido
13 de mar. de 2026, 16:05:36	Informação	[GEO-PROVIDER] provider=locationiq | status=REJECTED | confidence=0.10
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO] type=VALIDATION | msg=Melhor resultado rejeitado por baixa confiança
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO]   Motivo: Confidence 0.10 < 0.65
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO] context={"provider":"locationiq","confidence":0.1,"threshold":0.65,"reason":"Confidence 0.10 < 0.65"}
13 de mar. de 2026, 16:05:36	Informação	[LOOKUP-FIM] total=1836ms | result=FAILED
13 de mar. de 2026, 16:05:36	Informação	[LOOKUP] Providers executados em 1836ms
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO] type=VALIDATION | msg=Geocoding rejeitado
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO]   Motivo: N/A
13 de mar. de 2026, 16:05:36	Informação	[GEO-ERRO] context={"error":"Nenhum provedor retornou resultado com precisão suficiente (min 0.65)."}
13 de mar. de 2026, 16:05:36	Informação	[LOOKUP-FIM] total=1850ms | result=FAILED (no valid provider)
13 de mar. de 2026, 16:05:36	Informação	[PTS][ERRO] geocode falhou | "(03:15) ALM. TAMANDARÉ 63823 (ALMIRANTE TAMANDARÉ)" | raw_addr="Rua Adjalme Garcia da Silva, 84, Jardim Giannini, Almirante Tamandaré - PR" | erro=Nenhum provedor retornou resultado com precisão suficiente (min 0.65).
13 de mar. de 2026, 16:05:37	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 146ms (2 hits)
13 de mar. de 2026, 16:05:37	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:05:37	Informação	[PARSE-ADDR] logr="Rua Schiller" num="1140" bairro="Alto da Rua XV" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:37.375Z
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP] addr_display="Rua Schiller, 1140, Alto da Rua XV, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP] addr_norm="RUA SCHILLER, ALTO DA RUA XV, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:37	Informação	[LOOKUP] hash_key=be3588f4b3d5d2792439c0898424435bbf859707
13 de mar. de 2026, 16:05:37	Informação	[GEO-CACHE] op=READ | status=HIT | key=be3588f4b3d5d2792439c0898424435bbf859707 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:38	Informação	[AUDIT] ✅ Registrado em 167ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP-FIM] total=8ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:38	Informação	[PTS] 13/04 (segunda) | EQUIPE 1 | "(00:45) ALTO DA RUA XV OS 4517 (ALTO DA RUA XV)" | fonte=LUGAR | norm="Rua Schiller, 1140, Alto da Rua XV, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:38	Informação	[PARSE-ADDR] logr="Rua Gilberto Squena" num="153" bairro="Mauá" cidade="Colombo" uf="PR"
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:38.212Z
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP] addr_display="Rua Gilberto Squena, 153, Mauá, Colombo - PR, Brasil"
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP] addr_norm="RUA GILBERTO SQUENA, MAUA, COLOMBO - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP] hash_key=39f4a3bb8b9d87ff2672758aa12795666c3d711b
13 de mar. de 2026, 16:05:38	Informação	[GEO-CACHE] op=READ | status=HIT | key=39f4a3bb8b9d87ff2672758aa12795666c3d711b | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:38	Informação	[AUDIT] ✅ Registrado em 113ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:38	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:38	Informação	[PTS] 13/04 (segunda) | EQUIPE 1 | "(03:15) COLOMBO 64057 (COLOMBO)" | fonte=LUGAR | norm="Rua Gilberto Squena, 153, Mauá, Colombo - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:40	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 144ms (1 hits)
13 de mar. de 2026, 16:05:40	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:40	Informação	[PARSE-ADDR] logr="Rua Paulo de Frontin" num="277" bairro="Cajuru" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:40.359Z
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP] addr_display="Rua Paulo de Frontin, 277, Cajuru, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP] addr_norm="RUA PAULO DE FRONTIN, CAJURU, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:40	Informação	[LOOKUP] hash_key=b193e39f143c859958f148bae43ddb79473d533b
13 de mar. de 2026, 16:05:40	Informação	[GEO-CACHE] op=READ | status=HIT | key=b193e39f143c859958f148bae43ddb79473d533b | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:41	Informação	[AUDIT] ✅ Registrado em 273ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:41	Informação	[LOOKUP-FIM] total=8ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:41	Informação	[PTS] 14/04 (terça) | EQUIPE 1 | "(03:30) CAJURU 54217 (CAJURU)" | fonte=LUGAR | norm="Rua Paulo de Frontin, 277, Cajuru, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:42	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 190ms (1 hits)
13 de mar. de 2026, 16:05:42	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:42	Informação	[PARSE-ADDR] logr="Rua Epaminondas Santos" num="2000" bairro="Bairro Alto" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:42.310Z
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP] addr_display="Rua Epaminondas Santos, 2000, Bairro Alto, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP] addr_norm="RUA EPAMINONDAS SANTOS, BAIRRO ALTO, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:42	Informação	[LOOKUP] hash_key=b98221376a7b37886156a3d625676394577df773
13 de mar. de 2026, 16:05:42	Informação	[GEO-CACHE] op=READ | status=HIT | key=b98221376a7b37886156a3d625676394577df773 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:43	Informação	[AUDIT] ✅ Registrado em 184ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:43	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:43	Informação	[PTS] 14/04 (terça) | EQUIPE 2 | "(02:25) BAIRRO ALTO 54243 (BAIRRO ALTO)" | fonte=LUGAR | norm="Rua Epaminondas Santos, 2000, Bairro Alto, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:44	Informação	[SUPABASE-BATCH] ✅ 4 hashes consultados em 136ms (4 hits)
13 de mar. de 2026, 16:05:44	Informação	[BATCH-PRELOAD] ✅ 4 endereços pré-carregados
13 de mar. de 2026, 16:05:44	Informação	[PARSE-ADDR] logr="Rua Engenheiro Arthur Bettes" num="75" bairro="Portão" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:44.715Z
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP] addr_display="Rua Engenheiro Arthur Bettes, 75, Portão, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP] addr_norm="RUA ENGENHEIRO ARTHUR BETTES, PORTAO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:44	Informação	[LOOKUP] hash_key=e7718c7163c10d4b0d1f228e6edcb63641533d97
13 de mar. de 2026, 16:05:44	Informação	[GEO-CACHE] op=READ | status=HIT | key=e7718c7163c10d4b0d1f228e6edcb63641533d97 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:45	Informação	[AUDIT] ✅ Registrado em 115ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:45	Informação	[PTS] 15/04 (quarta) | EQUIPE 2 | "(01:30) PORTÃO 63970 (PORTÃO)" | fonte=LUGAR | norm="Rua Engenheiro Arthur Bettes, 75, Portão, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:45	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:45.834Z
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:45	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:05:45	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:46	Informação	[AUDIT] ✅ Registrado em 155ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:46	Informação	[PTS] 15/04 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:46	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:46.595Z
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:46	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:05:46	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:47	Informação	[AUDIT] ✅ Registrado em 148ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:47	Informação	[PTS] 15/04 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:47	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:47.441Z
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:47	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:05:47	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:48	Informação	[AUDIT] ✅ Registrado em 154ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:48	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:48	Informação	[PTS] 15/04 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:49	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 142ms (1 hits)
13 de mar. de 2026, 16:05:49	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:05:49	Informação	[PARSE-ADDR] logr="Rua João Pontoni" num="149" bairro="Cristo Rei" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:49.326Z
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP] addr_display="Rua João Pontoni, 149, Cristo Rei, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP] addr_norm="RUA JOAO PONTONI, CRISTO REI, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:49	Informação	[LOOKUP] hash_key=66de64f639572eaf8bf36b51c0b1a5e77c8edbcc
13 de mar. de 2026, 16:05:49	Informação	[GEO-CACHE] op=READ | status=HIT | key=66de64f639572eaf8bf36b51c0b1a5e77c8edbcc | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:50	Informação	[AUDIT] ✅ Registrado em 128ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:50	Informação	[PTS] 17/04 (sexta) | EQUIPE 1 | "1.1 (00:00) CRISTO REI 54283 (CRISTO REI)" | fonte=LUGAR | norm="Rua João Pontoni, 149, Cristo Rei, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:50	Informação	[PARSE-ADDR] logr="Rua João Pontoni" num="149" bairro="Cristo Rei" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:50.098Z
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] addr_display="Rua João Pontoni, 149, Cristo Rei, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] addr_norm="RUA JOAO PONTONI, CRISTO REI, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] hash_key=66de64f639572eaf8bf36b51c0b1a5e77c8edbcc
13 de mar. de 2026, 16:05:50	Informação	[GEO-CACHE] op=READ | status=HIT | key=66de64f639572eaf8bf36b51c0b1a5e77c8edbcc | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:50	Informação	[AUDIT] ✅ Registrado em 161ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-FIM] total=8ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:50	Informação	[PTS] 17/04 (sexta) | EQUIPE 1 | "1.1 (00:00) CRISTO REI 54159 (CRISTO REI)" | fonte=LUGAR | norm="Rua João Pontoni, 149, Cristo Rei, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:50	Informação	[PARSE-ADDR] logr="Rua João Pontoni" num="149" bairro="Cristo Rei" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:50.889Z
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] addr_display="Rua João Pontoni, 149, Cristo Rei, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] addr_norm="RUA JOAO PONTONI, CRISTO REI, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:50	Informação	[LOOKUP] hash_key=66de64f639572eaf8bf36b51c0b1a5e77c8edbcc
13 de mar. de 2026, 16:05:50	Informação	[GEO-CACHE] op=READ | status=HIT | key=66de64f639572eaf8bf36b51c0b1a5e77c8edbcc | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:51	Informação	[AUDIT] ✅ Registrado em 115ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:51	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:51	Informação	[PTS] 17/04 (sexta) | EQUIPE 1 | "1 (00:45) CRISTO REI 54154 (CRISTO REI)" | fonte=LUGAR | norm="Rua João Pontoni, 149, Cristo Rei, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:53	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 183ms (1 hits)
13 de mar. de 2026, 16:05:53	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:53	Informação	[PARSE-ADDR] logr="Rua Coronel Cypriano Gomes da Silveira" num="321" bairro="Xaxim" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:53.053Z
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP] addr_display="Rua Coronel Cypriano Gomes da Silveira, 321, Xaxim, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP] addr_norm="RUA CORONEL CYPRIANO GOMES DA SILVEIRA, XAXIM, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP] hash_key=80489ffde828e5902fc8d0c18a0a7ecc3c3db8cc
13 de mar. de 2026, 16:05:53	Informação	[GEO-CACHE] op=READ | status=HIT | key=80489ffde828e5902fc8d0c18a0a7ecc3c3db8cc | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:53	Informação	[AUDIT] ✅ Registrado em 140ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:53	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:53	Informação	[PTS] 20/04 (segunda) | EQUIPE 2 | "1 (02:00) XAXIM 49323 (XAXIM)" | fonte=LUGAR | norm="Rua Coronel Cypriano Gomes da Silveira, 321, Xaxim, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:55	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 151ms (1 hits)
13 de mar. de 2026, 16:05:55	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:05:55	Informação	[PARSE-ADDR] logr="Rua Lima" num="324" bairro="Parque Agari" cidade="Paranaguá" uf="PR"
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:55.028Z
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP] addr_display="Rua Lima, 324, Parque Agari, Paranaguá - PR, Brasil"
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP] addr_norm="RUA LIMA, PARQUE AGARI, PARANAGUA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:55	Informação	[LOOKUP] hash_key=9d8d509df021717250c5654fd40fae10731d5106
13 de mar. de 2026, 16:05:55	Informação	[GEO-CACHE] op=READ | status=HIT | key=9d8d509df021717250c5654fd40fae10731d5106 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:05:56	Informação	[AUDIT] ✅ Registrado em 171ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:56	Informação	[LOOKUP-FIM] total=13ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:56	Informação	[PTS] 23/04 (quinta) | EQUIPE 1 | "(03:15) PARANAGUÁ 64036 (PARANAGUÁ)" | fonte=LUGAR | norm="Rua Lima, 324, Parque Agari, Paranaguá - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:57	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 118ms (3 hits)
13 de mar. de 2026, 16:05:57	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:05:57	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:57.261Z
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:57	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:05:57	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:05:59	Informação	[AUDIT] ✅ Registrado em 162ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:05:59	Informação	[PTS] 23/04 (quinta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:05:59	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:05:59.241Z
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:05:59	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:05:59	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:00	Informação	[AUDIT] ✅ Registrado em 435ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:00	Informação	[PTS] 23/04 (quinta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:00	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:00.359Z
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:00	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:06:00	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:01	Informação	[AUDIT] ✅ Registrado em 121ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:01	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:01	Informação	[PTS] 23/04 (quinta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:02	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 122ms (3 hits)
13 de mar. de 2026, 16:06:02	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:06:02	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:02.246Z
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:02	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:06:02	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:03	Informação	[AUDIT] ✅ Registrado em 140ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:03	Informação	[PTS] 29/04 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:03	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:03.111Z
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:03	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:06:03	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:04	Informação	[AUDIT] ✅ Registrado em 155ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP-FIM] total=18ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:04	Informação	[PTS] 29/04 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:04	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:04.171Z
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:04	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:06:04	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:05	Informação	[AUDIT] ✅ Registrado em 174ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:05	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:05	Informação	[PTS] 29/04 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:07	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 152ms (1 hits)
13 de mar. de 2026, 16:06:07	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:06:07	Informação	[PARSE-ADDR] logr="Rua Biguá" num="141" bairro="Gralha Azul" cidade="Fazenda Rio Grande" uf="PR"
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:07.173Z
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP] addr_display="Rua Biguá, 141, Gralha Azul, Fazenda Rio Grande - PR, Brasil"
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP] addr_norm="RUA BIGUA, GRALHA AZUL, FAZENDA RIO GRANDE - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:07	Informação	[LOOKUP] hash_key=4f4633661aef8e5f77330fe4c124db19c9616940
13 de mar. de 2026, 16:06:07	Informação	[GEO-CACHE] op=READ | status=HIT | key=4f4633661aef8e5f77330fe4c124db19c9616940 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:08	Informação	[AUDIT] ✅ Registrado em 162ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-FIM] total=14ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:08	Informação	[PTS] 04/05 (segunda) | EQUIPE 1 | "(01:45) FAZENDA RIO GRANDE 63920 (FAZENDA RIO GRANDE)" | fonte=LUGAR | norm="Rua Biguá, 141, Gralha Azul, Fazenda Rio Grande - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:08	Informação	[PARSE-ADDR] logr="Rua Reinaldo Stocco" num="274" bairro="ap 1105 torre 4 horário bdas 09h às 18h" cidade="Pinheirinho" uf="PR"
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:08.169Z
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP] addr_display="Rua Reinaldo Stocco, 274, ap 1105 torre 4 horário bdas 09h às 18h, Pinheirinho - PR, Brasil"
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP] addr_norm="RUA REINALDO STOCCO, AP 1105 TORRE 4 HORARIO BDAS 09H AS 18H, PINHEIRINHO - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP] hash_key=56c69f7ed2d336934fe849c52ea6bc51f6ca4681
13 de mar. de 2026, 16:06:08	Informação	[GEO-CACHE] op=READ | status=MISS | key=56c69f7ed2d336934fe849c52ea6bc51f6ca4681 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:08	Informação	[GEO-CACHE] addr_norm="RUA REINALDO STOCCO, AP 1105 TORRE 4 HORARIO BDAS 09H AS 18H, PINHEIRINHO - PR, BRASIL"
13 de mar. de 2026, 16:06:08	Informação	[GEO-CACHE] op=READ | status=MISS | key=56c69f7ed2d336934fe849c52ea6bc51f6ca4681 | origin=AGENDA | provider=supabase
13 de mar. de 2026, 16:06:08	Informação	[GEO-CACHE] addr_norm="RUA REINALDO STOCCO, AP 1105 TORRE 4 HORARIO BDAS 09H AS 18H, PINHEIRINHO - PR, BRASIL"
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP] Cache MISS → Buscando providers externos...
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-CONTEXTO] func=geocodeAddressGratisStrict_ | timestamp=2026-03-13T19:06:08.181Z
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:08	Informação	[LOOKUP-PARAMS] {"addrFull":"Rua Reinaldo Stocco, 274, ap 1105 torre 4 horário bdas 09h às 18h, Pinheirinho - PR, Brasil","uf":"PR","city":"Pinheirinho"}
13 de mar. de 2026, 16:06:08	Informação	[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====
13 de mar. de 2026, 16:06:08	Informação	[GEO-PROVIDER] addr="Rua Reinaldo Stocco, 274, ap 1105 torre 4 horário bdas 09h às 18h, Pinheirinho - PR, Brasil" | uf=PR | city=Pinheirinho
13 de mar. de 2026, 16:06:08	Informação	[GEO-KEYS] Chaves carregadas da planilha backend em 696ms
13 de mar. de 2026, 16:06:08	Informação	[GEO-KEYS] USER LocationIQ=MISSING | SCRIPT LocationIQ=MISSING | GLOBAL LocationIQ=CONFIGURED(***08bd)
13 de mar. de 2026, 16:06:08	Informação	[GEO-KEYS] USER maps.co=MISSING | SCRIPT maps.co=MISSING | GLOBAL maps.co=CONFIGURED(***39b9)
13 de mar. de 2026, 16:06:08	Informação	[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.
13 de mar. de 2026, 16:06:08	Informação	[GEO-PROVIDER] provider=locationiq | status=TRYING
13 de mar. de 2026, 16:06:08	Informação	[LocationIQ] Buscando estruturado: street=Rua%20Reinaldo%20Stocco%20274&city=Pinheirinho&state=PR&country=Brazil
13 de mar. de 2026, 16:06:09	Informação	[VALIDAÇÃO] ❌ CIDADE INCORRETA | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_DIFF=REJEITADO (esperado="PINHEIRINHO", recebido="CURITIBA")
13 de mar. de 2026, 16:06:09	Informação	[GEO-PROVIDER] provider=locationiq | status=SUCCESS (348ms) | confidence=0.10 | display="Rua Reinaldo Stocco, Vila das Indústrias, Pinheirinho, Curitiba, Região Geográfi" | coords=(-25.516453,-49.287269)
13 de mar. de 2026, 16:06:09	Informação	[GEO-PROVIDER] provider=mapsco | status=TRYING
13 de mar. de 2026, 16:06:09	Informação	[GEO-PROVIDER] provider=mapsco | status=FAILED (305ms) | error=Sem resultado válido
13 de mar. de 2026, 16:06:09	Informação	[GEO-PROVIDER] provider=photon | status=TRYING
13 de mar. de 2026, 16:06:10	Informação	[GEO-PROVIDER] provider=photon | status=FAILED (472ms) | error=Sem resultado válido
13 de mar. de 2026, 16:06:10	Informação	[GEO-PROVIDER] provider=locationiq | status=REJECTED | confidence=0.10
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO] type=VALIDATION | msg=Melhor resultado rejeitado por baixa confiança
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO]   Motivo: Confidence 0.10 < 0.65
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO] context={"provider":"locationiq","confidence":0.1,"threshold":0.65,"reason":"Confidence 0.10 < 0.65"}
13 de mar. de 2026, 16:06:10	Informação	[LOOKUP-FIM] total=1875ms | result=FAILED
13 de mar. de 2026, 16:06:10	Informação	[LOOKUP] Providers executados em 1875ms
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO] type=VALIDATION | msg=Geocoding rejeitado
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO] ❌ DIAGNÓSTICO: Validação falhou - resultado não atende critérios mínimos
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO]   Motivo: N/A
13 de mar. de 2026, 16:06:10	Informação	[GEO-ERRO] context={"error":"Nenhum provedor retornou resultado com precisão suficiente (min 0.65)."}
13 de mar. de 2026, 16:06:10	Informação	[LOOKUP-FIM] total=1891ms | result=FAILED (no valid provider)
13 de mar. de 2026, 16:06:10	Informação	[PTS][ERRO] geocode falhou | "(01:25) PINHEIRINHO 63911 (PINHEIRINHO)" | raw_addr="Rua Reinaldo Stocco, 274, ap 1105 torre 4 horário bdas 09h às 18h, Pinheirinho, Curitiba - PR, 81820- 020" | erro=Nenhum provedor retornou resultado com precisão suficiente (min 0.65).
13 de mar. de 2026, 16:06:11	Informação	[SUPABASE-BATCH] ✅ 2 hashes consultados em 132ms (2 hits)
13 de mar. de 2026, 16:06:11	Informação	[BATCH-PRELOAD] ✅ 2 endereços pré-carregados
13 de mar. de 2026, 16:06:11	Informação	[PARSE-ADDR] logr="Rua Costa Rica" num="365" bairro="Bacacheri" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:11.410Z
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP] addr_display="Rua Costa Rica, 365, Bacacheri, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP] addr_norm="RUA COSTA RICA, BACACHERI, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:11	Informação	[LOOKUP] hash_key=3ed79492e1de8d31906a826104876667ee84eaae
13 de mar. de 2026, 16:06:11	Informação	[GEO-CACHE] op=READ | status=HIT | key=3ed79492e1de8d31906a826104876667ee84eaae | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:12	Informação	[AUDIT] ✅ Registrado em 130ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP-FIM] total=15ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:12	Informação	[PTS] 04/05 (segunda) | EQUIPE 2 | "(00:40) BACACHERI 64146 (BACACHERI)" | fonte=LUGAR | norm="Rua Costa Rica, 365, Bacacheri, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:12	Informação	[PARSE-ADDR] logr="Rua Luiz Barreto Murat" num="802" bairro="Bairro Alto" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:12.225Z
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP] addr_display="Rua Luiz Barreto Murat, 802, Bairro Alto, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP] addr_norm="RUA LUIZ BARRETO MURAT, BAIRRO ALTO, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:12	Informação	[LOOKUP] hash_key=dddf7665dde0d59c49126d103d869de898933d9d
13 de mar. de 2026, 16:06:12	Informação	[GEO-CACHE] op=READ | status=HIT | key=dddf7665dde0d59c49126d103d869de898933d9d | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:13	Informação	[AUDIT] ✅ Registrado em 196ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:13	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:13	Informação	[PTS] 04/05 (segunda) | EQUIPE 2 | "(00:40) BAIRRO ALTO 64136 (BAIRRO ALTO)" | fonte=LUGAR | norm="Rua Luiz Barreto Murat, 802, Bairro Alto, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:14	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 171ms (1 hits)
13 de mar. de 2026, 16:06:14	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:14	Informação	[PARSE-ADDR] logr="Rua Severino Vieira da Silva" num="143" bairro="Guarituba" cidade="Piraquara" uf="PR"
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:14.638Z
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP] addr_display="Rua Severino Vieira da Silva, 143, Guarituba, Piraquara - PR, Brasil"
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP] addr_norm="RUA SEVERINO VIEIRA DA SILVA, GUARITUBA, PIRAQUARA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:14	Informação	[LOOKUP] hash_key=deab369b1d8e84b29431ea984f71581f25208acb
13 de mar. de 2026, 16:06:14	Informação	[GEO-CACHE] op=READ | status=HIT | key=deab369b1d8e84b29431ea984f71581f25208acb | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:15	Informação	[AUDIT] ✅ Registrado em 153ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:15	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:15	Informação	[PTS] 05/05 (terça) | EQUIPE 1 | "(02:45) PIRAQUARA 62571 (PIRAQUARA)" | fonte=LUGAR | norm="Rua Severino Vieira da Silva, 143, Guarituba, Piraquara - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:16	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 154ms (1 hits)
13 de mar. de 2026, 16:06:16	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:16	Informação	[PARSE-ADDR] logr="Rua João Bettega" num="644" bairro="Portão" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:16.878Z
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP] addr_display="Rua João Bettega, 644, Portão, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP] addr_norm="RUA JOAO BETTEGA, PORTAO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:16	Informação	[LOOKUP] hash_key=2c9a75db9c7ee14f3d182923151478b9d58809a2
13 de mar. de 2026, 16:06:16	Informação	[GEO-CACHE] op=READ | status=HIT | key=2c9a75db9c7ee14f3d182923151478b9d58809a2 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:18	Informação	[AUDIT] ✅ Registrado em 133ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:18	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:18	Informação	[PTS] 05/05 (terça) | EQUIPE 2 | "(02:45) PORTÃO 64005 (PORTÃO)" | fonte=LUGAR | norm="Rua João Bettega, 644, Portão, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:20	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 150ms (1 hits)
13 de mar. de 2026, 16:06:20	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:20	Informação	[PARSE-ADDR] logr="Rua René Descartes" num="909" bairro="Barreirinha" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:20.225Z
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP] addr_display="Rua René Descartes, 909, Barreirinha, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP] addr_norm="RUA RENE DESCARTES, BARREIRINHA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP] hash_key=533782e5a993cf2ee884feb35339ba5f7b981dd3
13 de mar. de 2026, 16:06:20	Informação	[GEO-CACHE] op=READ | status=HIT | key=533782e5a993cf2ee884feb35339ba5f7b981dd3 | origin=AGENDA | provider=l1 (6ms)
13 de mar. de 2026, 16:06:20	Informação	[AUDIT] ✅ Registrado em 128ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:20	Informação	[LOOKUP-FIM] total=14ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:20	Informação	[PTS] 06/05 (quarta) | EQUIPE 1 | "(03:30) BARREIRINHA 27587 (BARREIRINHA)" | fonte=LUGAR | norm="Rua René Descartes, 909, Barreirinha, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:21	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 127ms (3 hits)
13 de mar. de 2026, 16:06:21	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:06:21	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:21.956Z
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:21	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:06:21	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:22	Informação	[AUDIT] ✅ Registrado em 127ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP-FIM] total=15ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:22	Informação	[PTS] 06/05 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:22	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:22.787Z
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:22	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:06:22	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:23	Informação	[AUDIT] ✅ Registrado em 143ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:23	Informação	[PTS] 06/05 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:23	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:23.682Z
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:23	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:06:23	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:25	Informação	[AUDIT] ✅ Registrado em 140ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:25	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:25	Informação	[PTS] 06/05 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:26	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 131ms (1 hits)
13 de mar. de 2026, 16:06:26	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:26	Informação	[PARSE-ADDR] logr="Rua Minas Gerais" num="806" bairro="Costeira" cidade="Araucária" uf="PR"
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:26.750Z
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP] addr_display="Rua Minas Gerais, 806, Costeira, Araucária - PR, Brasil"
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP] addr_norm="RUA MINAS GERAIS, COSTEIRA, ARAUCARIA - PR, BRASIL" (normalized in 2ms)
13 de mar. de 2026, 16:06:26	Informação	[LOOKUP] hash_key=5845ecaa9f14692ed363b3c48e62715414960dcb
13 de mar. de 2026, 16:06:26	Informação	[GEO-CACHE] op=READ | status=HIT | key=5845ecaa9f14692ed363b3c48e62715414960dcb | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:27	Informação	[AUDIT] ✅ Registrado em 132ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:27	Informação	[LOOKUP-FIM] total=14ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:27	Informação	[PTS] 08/05 (sexta) | EQUIPE 1 | "(00:50) ARAUCÁRIA 27612 (ARAUCÁRIA)" | fonte=LUGAR | norm="Rua Minas Gerais, 806, Costeira, Araucária - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:29	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 135ms (1 hits)
13 de mar. de 2026, 16:06:29	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:29	Informação	[PARSE-ADDR] logr="Rua da Bandeira" num="842" bairro="Cabral" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:29.663Z
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP] addr_display="Rua da Bandeira, 842, Cabral, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP] addr_norm="RUA DA BANDEIRA, CABRAL, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:29	Informação	[LOOKUP] hash_key=036ddaec9c5bb90fb89fb385c8b53aee07985cc4
13 de mar. de 2026, 16:06:29	Informação	[GEO-CACHE] op=READ | status=HIT | key=036ddaec9c5bb90fb89fb385c8b53aee07985cc4 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:30	Informação	[AUDIT] ✅ Registrado em 172ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:30	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:30	Informação	[PTS] 08/05 (sexta) | EQUIPE 2 | "(02:35) CABRAL 27472 (CABRAL)" | fonte=LUGAR | norm="Rua da Bandeira, 842, Cabral, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:31	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 122ms (1 hits)
13 de mar. de 2026, 16:06:31	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:31	Informação	[PARSE-ADDR] logr="Rua São Jerônimo da Serra" num="144" bairro="Santa Cândida" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:31.423Z
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP] addr_display="Rua São Jerônimo da Serra, 144, Santa Cândida, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP] addr_norm="RUA SAO JERONIMO DA SERRA, SANTA CANDIDA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:31	Informação	[LOOKUP] hash_key=00741cced27b04ce86b9c7140e7a99e0f3f14cab
13 de mar. de 2026, 16:06:31	Informação	[GEO-CACHE] op=READ | status=HIT | key=00741cced27b04ce86b9c7140e7a99e0f3f14cab | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:32	Informação	[AUDIT] ✅ Registrado em 157ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:32	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:32	Informação	[PTS] 09/05 (sábado) | EQUIPE 1 | "(02:20) SANTA CÂNDIDA 27582 (SANTA CÂNDIDA)" | fonte=LUGAR | norm="Rua São Jerônimo da Serra, 144, Santa Cândida, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:33	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 171ms (1 hits)
13 de mar. de 2026, 16:06:33	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:33	Informação	[PARSE-ADDR] logr="Rua Rafael Puchetti" num="330" bairro="Itália" cidade="São José dos Pinhais" uf="PR"
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:33.372Z
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP] addr_display="Rua Rafael Puchetti, 330, Itália, São José dos Pinhais - PR, Brasil"
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP] addr_norm="RUA RAFAEL PUCHETTI, ITALIA, SAO JOSE DOS PINHAIS - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:33	Informação	[LOOKUP] hash_key=163d9261f4078722c4b0c16e6e1b8cfe0e95f264
13 de mar. de 2026, 16:06:33	Informação	[GEO-CACHE] op=READ | status=HIT | key=163d9261f4078722c4b0c16e6e1b8cfe0e95f264 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:34	Informação	[AUDIT] ✅ Registrado em 170ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:34	Informação	[LOOKUP-FIM] total=8ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:34	Informação	[PTS] 11/05 (segunda) | EQUIPE 2 | "(01:30) SÃO JOSÉ DOS PINHAIS 64020 (SÃO JOSÉ DOS PINHAIS)" | fonte=LUGAR | norm="Rua Rafael Puchetti, 330, Itália, São José dos Pinhais - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:35	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 141ms (3 hits)
13 de mar. de 2026, 16:06:35	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:06:35	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:35.733Z
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:35	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:06:35	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:36	Informação	[AUDIT] ✅ Registrado em 191ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:36	Informação	[PTS] 13/05 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:36	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:36.561Z
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:36	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:06:36	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:37	Informação	[AUDIT] ✅ Registrado em 248ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:37	Informação	[PTS] 13/05 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:37	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:37.482Z
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:37	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:06:37	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:38	Informação	[AUDIT] ✅ Registrado em 258ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:38	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:38	Informação	[PTS] 13/05 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:39	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 189ms (1 hits)
13 de mar. de 2026, 16:06:39	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:39	Informação	[PARSE-ADDR] logr="Rua das Araras" num="25" bairro="Novo Mundo" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:39.467Z
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP] addr_display="Rua das Araras, 25, Novo Mundo, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP] addr_norm="RUA DAS ARARAS, NOVO MUNDO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:39	Informação	[LOOKUP] hash_key=31b46b3ab9645fb1fdcaf3283e09b78a7dd8b008
13 de mar. de 2026, 16:06:39	Informação	[GEO-CACHE] op=READ | status=HIT | key=31b46b3ab9645fb1fdcaf3283e09b78a7dd8b008 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:40	Informação	[AUDIT] ✅ Registrado em 119ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:40	Informação	[LOOKUP-FIM] total=15ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:40	Informação	[PTS] 18/05 (segunda) | EQUIPE 1 | "(01:00) NOVO MUNDO 27555 (NOVO MUNDO)" | fonte=LUGAR | norm="Rua das Araras, 25, Novo Mundo, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:41	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 133ms (1 hits)
13 de mar. de 2026, 16:06:41	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:41	Informação	[PARSE-ADDR] logr="Rua Canadá" num="2268" bairro="Bacacheri" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:41.854Z
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP] addr_display="Rua Canadá, 2268, Bacacheri, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP] addr_norm="RUA CANADA, BACACHERI, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:41	Informação	[LOOKUP] hash_key=9fa0ad55213acd4962ab89aa70b22dfef9e58ff1
13 de mar. de 2026, 16:06:41	Informação	[GEO-CACHE] op=READ | status=HIT | key=9fa0ad55213acd4962ab89aa70b22dfef9e58ff1 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:43	Informação	[AUDIT] ✅ Registrado em 123ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:43	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:43	Informação	[PTS] 19/05 (terça) | EQUIPE 1 | "4 (03:00) BACACHERI 52263 (BACACHERI)" | fonte=LUGAR | norm="Rua Canadá, 2268, Bacacheri, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:44	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 141ms (3 hits)
13 de mar. de 2026, 16:06:44	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:06:44	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:44.339Z
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:44	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:06:44	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:46	Informação	[AUDIT] ✅ Registrado em 139ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:46	Informação	[PTS] 20/05 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:46	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:46.007Z
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:06:46	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (5ms)
13 de mar. de 2026, 16:06:46	Informação	[AUDIT] ✅ Registrado em 121ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-FIM] total=17ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:46	Informação	[PTS] 20/05 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:46	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:46.782Z
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:06:46	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:06:46	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:47	Informação	[AUDIT] ✅ Registrado em 125ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:47	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:47	Informação	[PTS] 20/05 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:49	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 192ms (1 hits)
13 de mar. de 2026, 16:06:49	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:49	Informação	[PARSE-ADDR] logr="Rua Saldanha Marinho" num="1501" bairro="Bigorrilho" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:49.641Z
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP] addr_display="Rua Saldanha Marinho, 1501, Bigorrilho, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP] addr_norm="RUA SALDANHA MARINHO, BIGORRILHO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:49	Informação	[LOOKUP] hash_key=6fd4aa25a1ff87c0b2146e75706a5ff57a84bc63
13 de mar. de 2026, 16:06:49	Informação	[GEO-CACHE] op=READ | status=HIT | key=6fd4aa25a1ff87c0b2146e75706a5ff57a84bc63 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:50	Informação	[AUDIT] ✅ Registrado em 182ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:50	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:50	Informação	[PTS] 25/05 (segunda) | EQUIPE 1 | "(01:15) BIGORRILHO 17650 (BIGORRILHO)( BERCO FEIRA)" | fonte=LUGAR | norm="Rua Saldanha Marinho, 1501, Bigorrilho, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:51	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 173ms (3 hits)
13 de mar. de 2026, 16:06:51	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:06:51	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:51.729Z
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:51	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:06:51	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:52	Informação	[AUDIT] ✅ Registrado em 142ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP-FIM] total=41ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:52	Informação	[PTS] 27/05 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:52	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:52.549Z
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:52	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:06:52	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:53	Informação	[AUDIT] ✅ Registrado em 111ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:53	Informação	[PTS] 27/05 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:53	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:53.289Z
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:53	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:06:53	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:54	Informação	[AUDIT] ✅ Registrado em 109ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:54	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:54	Informação	[PTS] 27/05 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:55	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 154ms (1 hits)
13 de mar. de 2026, 16:06:55	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:55	Informação	[PARSE-ADDR] logr="Rua Deputado Ulisses Guimarães" num="281" bairro="Pinheirinho" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:55.235Z
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP] addr_display="Rua Deputado Ulisses Guimarães, 281, Pinheirinho, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP] addr_norm="RUA DEPUTADO ULISSES GUIMARAES, PINHEIRINHO, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:55	Informação	[LOOKUP] hash_key=3d7e317d041248708cdc198c4e00d3874c0e6e0e
13 de mar. de 2026, 16:06:55	Informação	[GEO-CACHE] op=READ | status=HIT | key=3d7e317d041248708cdc198c4e00d3874c0e6e0e | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:06:56	Informação	[AUDIT] ✅ Registrado em 134ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:56	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:56	Informação	[PTS] 30/05 (sábado) | EQUIPE 1 | "(03:00) PINHEIRINHO 53268 (PINHEIRINHO)" | fonte=LUGAR | norm="Rua Deputado Ulisses Guimarães, 281, Pinheirinho, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:06:57	Informação	[SUPABASE-BATCH] ✅ 1 hashes consultados em 146ms (1 hits)
13 de mar. de 2026, 16:06:57	Informação	[BATCH-PRELOAD] ✅ 1 endereços pré-carregados
13 de mar. de 2026, 16:06:57	Informação	[PARSE-ADDR] logr="Rua Melânia Zeni Visinoni" num="150" bairro="Campo de Santana" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:06:57.882Z
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP] addr_display="Rua Melânia Zeni Visinoni, 150, Campo de Santana, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP] addr_norm="RUA MELANIA ZENI VISINONI, CAMPO DE SANTANA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:06:57	Informação	[LOOKUP] hash_key=e53864f716c4d99e020ba96b1f5c3ddfb9ff89d5
13 de mar. de 2026, 16:06:57	Informação	[GEO-CACHE] op=READ | status=HIT | key=e53864f716c4d99e020ba96b1f5c3ddfb9ff89d5 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:06:59	Informação	[AUDIT] ✅ Registrado em 206ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:06:59	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:06:59	Informação	[PTS] 03/06 (quarta) | EQUIPE 1 | "(03:10) CAMPO DO SANTANA 61578 (CAMPO DE SANTANA)" | fonte=LUGAR | norm="Rua Melânia Zeni Visinoni, 150, Campo de Santana, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:00	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 261ms (3 hits)
13 de mar. de 2026, 16:07:00	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:07:00	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:00.232Z
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:07:00	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:07:00	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:07:01	Informação	[AUDIT] ✅ Registrado em 144ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-FIM] total=12ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:01	Informação	[PTS] 03/06 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:01	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:01.114Z
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 2ms)
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:07:01	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:07:01	Informação	[AUDIT] ✅ Registrado em 119ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-FIM] total=14ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:01	Informação	[PTS] 03/06 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:01	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:01.974Z
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:07:01	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:07:01	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:07:03	Informação	[AUDIT] ✅ Registrado em 148ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:03	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:03	Informação	[PTS] 03/06 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:04	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 133ms (3 hits)
13 de mar. de 2026, 16:07:04	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:07:04	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:04.356Z
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:07:04	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:07:04	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:07:05	Informação	[AUDIT] ✅ Registrado em 149ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:05	Informação	[PTS] 10/06 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:05	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:05.107Z
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:07:05	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:07:05	Informação	[AUDIT] ✅ Registrado em 148ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:05	Informação	[PTS] 10/06 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:05	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:05.873Z
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:07:05	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:07:05	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:07:07	Informação	[AUDIT] ✅ Registrado em 143ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:07	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:07	Informação	[PTS] 10/06 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:08	Informação	[SUPABASE-BATCH] ✅ 3 hashes consultados em 119ms (3 hits)
13 de mar. de 2026, 16:07:08	Informação	[BATCH-PRELOAD] ✅ 3 endereços pré-carregados
13 de mar. de 2026, 16:07:08	Informação	[PARSE-ADDR] logr="Av. Mal. Floriano Peixoto" num="5636 - Hauer" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:08.735Z
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP] addr_display="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP] addr_norm="AV MAL FLORIANO PEIXOTO, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:07:08	Informação	[LOOKUP] hash_key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd
13 de mar. de 2026, 16:07:08	Informação	[GEO-CACHE] op=READ | status=HIT | key=5e44571038f1d6472a7d4bbdbf1c047ae60912cd | origin=AGENDA | provider=l1 (4ms)
13 de mar. de 2026, 16:07:09	Informação	[AUDIT] ✅ Registrado em 135ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP-FIM] total=11ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:09	Informação	[PTS] 17/06 (quarta) | EQUIPE 2 | "1 (01:00) TRANSF. MARECHAL" | fonte=LUGAR | norm="Av. Mal. Floriano Peixoto, 5636 - Hauer, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:09	Informação	[PARSE-ADDR] logr="Av. Cândido Hartmann" num="456" bairro="" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:09.675Z
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP] addr_display="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP] addr_norm="AV CANDIDO HARTMANN, CURITIBA - PR, BRASIL" (normalized in 0ms)
13 de mar. de 2026, 16:07:09	Informação	[LOOKUP] hash_key=79b94af4a667926d65f756be8637dce8f9aa9b45
13 de mar. de 2026, 16:07:09	Informação	[GEO-CACHE] op=READ | status=HIT | key=79b94af4a667926d65f756be8637dce8f9aa9b45 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:07:10	Informação	[AUDIT] ✅ Registrado em 148ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP-FIM] total=9ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:10	Informação	[PTS] 17/06 (quarta) | EQUIPE 2 | "3 (01:00) TRANSF. BIGORRILHO" | fonte=LUGAR | norm="Av. Cândido Hartmann, 456, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:10	Informação	[PARSE-ADDR] logr="Av. Rep. Argentina" num="2777" bairro="Curitiba" cidade="Curitiba" uf="PR"
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-03-13T19:07:10.449Z
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP-PARAMS] {"origin":"AGENDA"}
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP] addr_display="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil"
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP] addr_norm="AV REP ARGENTINA, CURITIBA, CURITIBA - PR, BRASIL" (normalized in 1ms)
13 de mar. de 2026, 16:07:10	Informação	[LOOKUP] hash_key=19813a9fd4aa077f40607f6f9d348143ac2bedd6
13 de mar. de 2026, 16:07:10	Informação	[GEO-CACHE] op=READ | status=HIT | key=19813a9fd4aa077f40607f6f9d348143ac2bedd6 | origin=AGENDA | provider=l1 (3ms)
13 de mar. de 2026, 16:07:11	Informação	[AUDIT] ✅ Registrado em 164ms: cache_hit=true provider=l1
13 de mar. de 2026, 16:07:11	Informação	[LOOKUP-FIM] total=10ms | result=SUCCESS (L1 cache)
13 de mar. de 2026, 16:07:11	Informação	[PTS] 17/06 (quarta) | EQUIPE 2 | "2 (01:00) TRANSF. PORTÃO" | fonte=LUGAR | norm="Av. Rep. Argentina, 2777, Curitiba, Curitiba - PR, Brasil" (Provider: supabase)
13 de mar. de 2026, 16:07:11	Informação	🔄 Slots mudaram (agenda atualizada) — aquecendo cache completo
13 de mar. de 2026, 16:07:11	Informação	[WARMUP] Aquecendo 89 rotas em batch...
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 89 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[WARMUP] ✅ Cache aquecido
13 de mar. de 2026, 16:07:11	Informação	[FAST-PASS] Iniciando prévia rápida...
13 de mar. de 2026, 16:07:11	Informação	[FAST-PASS] Concluído em 0ms: 0 normais + 0 extras
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 19/03 (quinta) | EQUIPE 1 | livre="02:15" | pontos=2
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 19/03 (quinta) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua André Bonato, 440, Umbará, Curitiba - PR, Brasil","Avenida Rio Amazonas, 691, Santa Terezinha, Fazenda Rio Grande - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 19/03 (quinta) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[FILTER-EARLY] Descartado por distância reta: 16.94km (>12.00km)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 19/03 (quinta) | EQUIPE 2 | livre="02:00" | pontos=2
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 19/03 (quinta) | EQUIPE 2 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Sebastião Vendramin, 139, Santa Felicidade, Curitiba - PR, Brasil","Rua Wanda Wolf, 816, Santa Felicidade, Curitiba - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 19/03 (quinta) | EQUIPE 2 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 2 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:45) SANTA FELICIDADE 54468 (SANTA FELICIDADE)" @ "Rua Sebastião Vendramin, 139, Santa Felicidade, Curitiba - PR, Brasil" → novo=11733 m (11.73 km)
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:15) SANTA FELICIDADE 53725 (SANTA FELICIDADE)" @ "Rua Wanda Wolf, 816, Santa Felicidade, Curitiba - PR, Brasil" → novo=11051 m (11.05 km)
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 7 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[ESPECIAL] Candidato: 19/03 (quinta) | EQUIPE 2 | delta=5.86km
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 20/03 (sexta) | EQUIPE 1 | livre="02:15" | pontos=2
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 20/03 (sexta) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Paraná, 488, Iguaçu, Araucária - PR, Brasil","Rua Lótus, 1610, Campina da Barra, Araucária - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 20/03 (sexta) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[FILTER-EARLY] Descartado por distância reta: 23.80km (>12.00km)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 20/03 (sexta) | EQUIPE 2 | livre="03:30" | pontos=1
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 20/03 (sexta) | EQUIPE 2 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Rio São Luiz, 619, Weissópolis, Pinhais - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 20/03 (sexta) | EQUIPE 2 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:25) PINHAIS 54472 (PINHAIS)" @ "Rua Rio São Luiz, 619, Weissópolis, Pinhais - PR, Brasil" → novo=10427 m (10.43 km)
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 4 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[ESPECIAL] Candidato: 20/03 (sexta) | EQUIPE 2 | delta=6.81km
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 21/03 (sábado) | EQUIPE 1 | livre="01:30" | pontos=3
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 21/03 (sábado) | EQUIPE 1 | origem="Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470" | lat=-25.494457 lng=-49.277143
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Professor João Manoel Mondrone, 164, Vista Alegre, Curitiba - PR, Brasil","Rua Pedro Fabri, 165, Cabral, Curitiba - PR, Brasil","Rua João Schleder Sobrinho, 332, Boa Vista, Curitiba - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 21/03 (sábado) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 3 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(00:55) BOA VISTA 27493 (BOA VISTA)" @ "Rua João Schleder Sobrinho, 332, Boa Vista, Curitiba - PR, Brasil" → novo=4052 m (4.05 km)
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:00) CABRAL 27228 (CABRAL)" @ "Rua Pedro Fabri, 165, Cabral, Curitiba - PR, Brasil" → novo=3046 m (3.05 km)
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(00:45) VISTA ALEGRE OS 4482 (VISTA ALEGRE)" @ "Rua Professor João Manoel Mondrone, 164, Vista Alegre, Curitiba - PR, Brasil" → novo=5936 m (5.94 km)
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 10 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[PROGRESS] Salvo: 3 resultados, status=running
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 21/03 (sábado) | EQUIPE 2 | livre="03:00" | pontos=0
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 21/03 (sábado) | EQUIPE 2 | origem="Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470" | lat=-25.494457 lng=-49.277143
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 21/03 (sábado) | EQUIPE 2 | base=45000 m | especial=50000 m | premium=55000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[HORA MARCADA] Candidato: 21/03 (sábado) | EQUIPE 2 | tempo disponível=03:00 (precisa 150min)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 23/03 (segunda) | EQUIPE 1 | livre="01:15" | pontos=2
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 23/03 (segunda) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Engenheiros Rebouças, 1769, Rebouças, Curitiba - PR, Brasil","Rua Hermínio Cardoso, 444, Tingui, Curitiba - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 23/03 (segunda) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 2 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(03:10) REBOUÇAS 27131 (REBOUÇAS)" @ "Rua Engenheiros Rebouças, 1769, Rebouças, Curitiba - PR, Brasil" → novo=3295 m (3.29 km)
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(02:15) TINGUI 62790 (TINGUI)" @ "Rua Hermínio Cardoso, 444, Tingui, Curitiba - PR, Brasil" → novo=6541 m (6.54 km)
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 7 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 23/03 (segunda) | EQUIPE 2 | livre="04:30" | pontos=0
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 23/03 (segunda) | EQUIPE 2 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 23/03 (segunda) | EQUIPE 2 | base=150000 m | especial=155000 m | premium=160000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[HORA MARCADA] Candidato: 23/03 (segunda) | EQUIPE 2 | tempo disponível=04:30 (precisa 150min)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 24/03 (terça) | EQUIPE 1 | livre="03:45" | pontos=2
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 24/03 (terça) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Antônio de Castro Alves, 506, Vargem Grande, Pinhais - PR, Brasil","Rua Shalon, 157, Planta Deodoro, Piraquara - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 24/03 (terça) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 2 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:00) PINHAIS OS 4490 (PINHAIS)" @ "Rua Antônio de Castro Alves, 506, Vargem Grande, Pinhais - PR, Brasil" → novo=11216 m (11.22 km)
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:15) PIRAQUARA 53864 (PIRAQUARA)" @ "Rua Shalon, 157, Planta Deodoro, Piraquara - PR, Brasil" → novo=23605 m (23.60 km)
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 7 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[ESPECIAL] Candidato: 24/03 (terça) | EQUIPE 1 | delta=6.09km
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 25/03 (quarta) | EQUIPE 1 | livre="02:45" | pontos=1
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 25/03 (quarta) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Vereador Wadislau Bugalski, 1900, Botiatuba, Almirante Tamandaré - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 25/03 (quarta) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[FILTER-EARLY] Descartado por distância reta: 12.54km (>12.00km)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 26/03 (quinta) | EQUIPE 1 | livre="05:15" | pontos=0
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 26/03 (quinta) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 26/03 (quinta) | EQUIPE 1 | base=150000 m | especial=155000 m | premium=160000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[HORA MARCADA] Candidato: 26/03 (quinta) | EQUIPE 1 | tempo disponível=05:15 (precisa 150min)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 28/03 (sábado) | EQUIPE 1 | livre="04:00" | pontos=0
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 28/03 (sábado) | EQUIPE 1 | origem="Rua Deputado Néo Martins, 872 - Novo Mundo, Curitiba - PR, 81030-470" | lat=-25.494457 lng=-49.277143
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 28/03 (sábado) | EQUIPE 1 | base=45000 m | especial=50000 m | premium=55000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[HORA MARCADA] Candidato: 28/03 (sábado) | EQUIPE 1 | tempo disponível=04:00 (precisa 150min)
13 de mar. de 2026, 16:07:11	Informação	[SLOT] 30/03 (segunda) | EQUIPE 1 | livre="04:15" | pontos=2
13 de mar. de 2026, 16:07:11	Informação	[ORIGEM] 30/03 (segunda) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:11	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Euclides da Cunha, 1530, Bigorrilho, Curitiba - PR, Brasil","Rua Padre Jacinto Miensopust, 667, Cidade Industrial, Curitiba - PR, Brasil"]
13 de mar. de 2026, 16:07:11	Informação	[LIMITE] 30/03 (segunda) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:11	Informação	[OSRM-BATCH] ✅ Todas as 2 rotas vieram do cache
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(01:00) BIGORRILHO OS 4484 (BIGORRILHO)" @ "Rua Euclides da Cunha, 1530, Bigorrilho, Curitiba - PR, Brasil" → novo=6799 m (6.80 km)
13 de mar. de 2026, 16:07:11	Informação	[NEARCHK] "(00:45) CIDADE INDUSTRIAL 26831 (CIDADE INDUSTRIAL)" @ "Rua Padre Jacinto Miensopust, 667, Cidade Industrial, Curitiba - PR, Brasil" → novo=11925 m (11.93 km)
13 de mar. de 2026, 16:07:12	Informação	[OSRM-BATCH] ✅ Todas as 7 rotas vieram do cache
13 de mar. de 2026, 16:07:12	Informação	[ESPECIAL] Candidato: 30/03 (segunda) | EQUIPE 1 | delta=7.98km
13 de mar. de 2026, 16:07:12	Informação	[SLOT] 30/03 (segunda) | EQUIPE 2 | livre="03:30" | pontos=1
13 de mar. de 2026, 16:07:12	Informação	[ORIGEM] 30/03 (segunda) | EQUIPE 2 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:12	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Pedrina Costa Viski, 740, Itália, São José dos Pinhais - PR, Brasil"]
13 de mar. de 2026, 16:07:12	Informação	[LIMITE] 30/03 (segunda) | EQUIPE 2 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:12	Informação	[FILTER-EARLY] Descartado por distância reta: 17.26km (>12.00km)
13 de mar. de 2026, 16:07:12	Informação	[SLOT] 31/03 (terça) | EQUIPE 1 | livre="06:00" | pontos=0
13 de mar. de 2026, 16:07:12	Informação	[ORIGEM] 31/03 (terça) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:12	Informação	[ROTA BASE] ordem=["DEPÓSITO"]
13 de mar. de 2026, 16:07:12	Informação	[LIMITE] 31/03 (terça) | EQUIPE 1 | base=150000 m | especial=155000 m | premium=160000 m
13 de mar. de 2026, 16:07:12	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:12	Informação	[HORA MARCADA] Candidato: 31/03 (terça) | EQUIPE 1 | tempo disponível=06:00 (precisa 150min)
13 de mar. de 2026, 16:07:12	Informação	[SLOT] 01/04 (quarta) | EQUIPE 1 | livre="05:15" | pontos=1
13 de mar. de 2026, 16:07:12	Informação	[ORIGEM] 01/04 (quarta) | EQUIPE 1 | origem="R. Dr. Francisco Soares, 860, Curitiba-PR, 81030-450" | lat=-25.493498 lng=-49.276551
13 de mar. de 2026, 16:07:12	Informação	[ROTA BASE] ordem=["DEPÓSITO","Rua Lothario Boutin, 220, Pinheirinho, Curitiba - PR, Brasil"]
13 de mar. de 2026, 16:07:12	Informação	[LIMITE] 01/04 (quarta) | EQUIPE 1 | base=5000 m | especial=10000 m | premium=15000 m
13 de mar. de 2026, 16:07:12	Informação	[OSRM-BATCH] ✅ Todas as 1 rotas vieram do cache
13 de mar. de 2026, 16:07:12	Informação	[NEARCHK] "(01:15) PINHEIRINHO 63586 (PINHEIRINHO)" @ "Rua Lothario Boutin, 220, Pinheirinho, Curitiba - PR, Brasil" → novo=13909 m (13.91 km)
13 de mar. de 2026, 16:07:12	Informação	[OSRM-BATCH] ✅ Todas as 4 rotas vieram do cache
13 de mar. de 2026, 16:07:12	Informação	[PREMIUM] Candidato: 01/04 (quarta) | EQUIPE 1 | delta=13.91km
13 de mar. de 2026, 16:07:12	Informação	[EARLY-STOP] ✅ Encontrou 10 candidatos únicos em 177.8s — PARANDO BUSCA
13 de mar. de 2026, 16:07:12	Informação	[EARLY-STOP] Processados 16/135 slots (12%)
13 de mar. de 2026, 16:07:12	Informação	[CANDIDATOS] Encontrados ANTES da seleção:
13 de mar. de 2026, 16:07:12	Informação	  [NORMAIS] 5 candidatos: 21/03 (sábado) | EQUIPE 1 | Δ=1.06km, 23/03 (segunda) | EQUIPE 1 | Δ=-0.35km, 26/03 (quinta) | EQUIPE 1 | Δ=10.71km, 28/03 (sábado) | EQUIPE 1 | Δ=10.85km, 31/03 (terça) | EQUIPE 1 | Δ=10.71km
13 de mar. de 2026, 16:07:12	Informação	  [ESPECIAIS] 4 candidatos: 19/03 (quinta) | EQUIPE 2 | Δ=5.86km, 20/03 (sexta) | EQUIPE 2 | Δ=6.81km, 24/03 (terça) | EQUIPE 1 | Δ=6.09km, 30/03 (segunda) | EQUIPE 1 | Δ=7.98km
13 de mar. de 2026, 16:07:12	Informação	  [PREMIUM] 1 candidatos: 01/04 (quarta) | EQUIPE 1 | Δ=13.91km
13 de mar. de 2026, 16:07:12	Informação	  [HORA MARCADA] 5 candidatos: 21/03 (sábado) | EQUIPE 2, 23/03 (segunda) | EQUIPE 2, 26/03 (quinta) | EQUIPE 1, 28/03 (sábado) | EQUIPE 1, 31/03 (terça) | EQUIPE 1
13 de mar. de 2026, 16:07:12	Informação	[SELEÇÃO FINAL] Total selecionado: 7 | Normais: 5 | Especial: 1 | Premium: 1 | Hora Marcada: 0
13 de mar. de 2026, 16:07:12	Informação	  [SELECIONADOS NORMAIS]: 21/03 (sábado) | EQUIPE 1, 23/03 (segunda) | EQUIPE 1, 26/03 (quinta) | EQUIPE 1, 28/03 (sábado) | EQUIPE 1, 31/03 (terça) | EQUIPE 1
13 de mar. de 2026, 16:07:12	Informação	  [SELECIONADO ESPECIAL]: 19/03 (quinta) | EQUIPE 2
13 de mar. de 2026, 16:07:12	Informação	  [SELECIONADO PREMIUM]: 01/04 (quarta) | EQUIPE 1
13 de mar. de 2026, 16:07:12	Informação	[AVISO] Nenhum frete hora marcada encontrado
13 de mar. de 2026, 16:07:12	Informação	[RESULTADO ESPECIAL] 19/03 | EQUIPE 2 | frete=R$ 200
13 de mar. de 2026, 16:07:12	Informação	[RESULTADO PREMIUM] 01/04 | EQUIPE 1 | frete=R$ 300
13 de mar. de 2026, 16:07:13	Informação	[ADDRESS-FINAL] Selecionado: "Rua Jose de Alencar, 1683, Juveve, Curitiba, PR, 80040-070"
13 de mar. de 2026, 16:07:14	Informação	[SEARCH-AUDIT] ✅ Registrado em 122ms: status=success duration_ms=179006
13 de mar. de 2026, 16:07:14	Informação	[PROGRESS] Salvo: 0 resultados, status=done
13 de mar. de 2026, 16:07:14	Informação	[API-EXEC-END] Status: SUCCESS
13 de mar. de 2026, 16:07:14	Informação	[API-EXEC-END] Tempo: 179.80s
13 de mar. de 2026, 16:07:14	Informação	[API-EXEC-END] Candidatos: 7
13 de mar. de 2026, 16:07:14	Informação	========================================