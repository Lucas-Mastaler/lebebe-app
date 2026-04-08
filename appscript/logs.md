Registros do Cloud
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP] ===== INICIANDO RESOLUÇÃO DE ENDEREÇO =====
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP-CONTEXTO] func=ResolverEnderecoComCache_ | timestamp=2026-04-08T18:18:46.751Z
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP-PARAMS] {"origin":"MODAL"}
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP] addr_display="Rua Fortaleza, 1210, cajuru, Curitiba - PR, Brasil"
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP] addr_norm="RUA FORTALEZA, CAJURU, CURITIBA - PR, BRASIL" (normalized in 2ms)
8 de abr. de 2026, 15:18:46	Informação	[LOOKUP] hash_key=cbc58d23e6a2fff2d6bc5b48d7c11a3ee1e8f1af
8 de abr. de 2026, 15:18:46	Informação	[GEO-CACHE] op=READ | status=MISS | key=cbc58d23e6a2fff2d6bc5b48d7c11a3ee1e8f1af | origin=MODAL | provider=l1 (102ms)
8 de abr. de 2026, 15:18:46	Informação	[GEO-CACHE] addr_norm="RUA FORTALEZA, CAJURU, CURITIBA - PR, BRASIL"
8 de abr. de 2026, 15:18:50	Informação	[GEO-CACHE] op=READ | status=MISS | key=cbc58d23e6a2fff2d6bc5b48d7c11a3ee1e8f1af | origin=MODAL | provider=supabase (3997ms)
8 de abr. de 2026, 15:18:50	Informação	[GEO-CACHE] addr_norm="RUA FORTALEZA, CAJURU, CURITIBA - PR, BRASIL"
8 de abr. de 2026, 15:18:50	Informação	[LOOKUP] Cache MISS → Buscando providers externos...
8 de abr. de 2026, 15:18:50	Informação	[LOOKUP-CONTEXTO] func=geocodeAddressGratisStrict_ | timestamp=2026-04-08T18:18:50.888Z
8 de abr. de 2026, 15:18:50	Informação	[LOOKUP-USUARIO] activeUser=lucas@lebebe.com.br | effectiveUser=lucas@lebebe.com.br | timezone=America/Sao_Paulo
8 de abr. de 2026, 15:18:50	Informação	[LOOKUP-PARAMS] {"addrFull":"Rua Fortaleza, 1210, cajuru, Curitiba - PR, Brasil","uf":"PR","city":"Curitiba"}
8 de abr. de 2026, 15:18:50	Informação	[GEO-PROVIDER] ===== INICIANDO CASCATA DE PROVIDERS =====
8 de abr. de 2026, 15:18:50	Informação	[GEO-PROVIDER] addr="Rua Fortaleza, 1210, cajuru, Curitiba - PR, Brasil" | uf=PR | city=Curitiba
8 de abr. de 2026, 15:18:58	Informação	[GEO-KEYS] Chaves carregadas da planilha backend em 7083ms
8 de abr. de 2026, 15:18:58	Informação	[GEO-KEYS] USER LocationIQ=MISSING | SCRIPT LocationIQ=MISSING | GLOBAL LocationIQ=CONFIGURED(***08bd)
8 de abr. de 2026, 15:18:58	Informação	[GEO-KEYS] USER maps.co=MISSING | SCRIPT maps.co=MISSING | GLOBAL maps.co=CONFIGURED(***39b9)
8 de abr. de 2026, 15:18:58	Informação	[GEO-KEYS] ⚠️ IMPORTANTE: Chaves são lidas da PLANILHA BACKEND via getConfig(). Se usuário não tem acesso à planilha, chaves ficam MISSING.
8 de abr. de 2026, 15:18:58	Informação	[GEO-PROVIDER] provider=locationiq | status=TRYING
8 de abr. de 2026, 15:18:58	Informação	[LocationIQ] Buscando estruturado: street=Rua%20Fortaleza%201210&city=Curitiba&state=PR&country=Brazil
8 de abr. de 2026, 15:18:58	Informação	[GEOCODE] HTTP 429 (locationiq-addr) em https://us1.locationiq.com/v1/search.php?key=pk.8f1f85889c924222f85eab6a32e308bd&street=Rua%20Fortaleza%201210&city=Curitiba&state=PR&country=Brazil&format=json&addressdetails=1&limit=3&countrycodes=br&accept-language=pt-BR
{"error":"Rate Limited Day"}...
8 de abr. de 2026, 15:18:58	Informação	[GEO-PROVIDER] provider=locationiq | status=FAILED (422ms) | error=Sem resultado válido
8 de abr. de 2026, 15:18:58	Informação	[GEO-PROVIDER] provider=mapsco | status=TRYING
8 de abr. de 2026, 15:18:59	Informação	[VALIDAÇÃO] FINAL=1.00 | Brasil=+0.3 | UF_OK=+0.2 | CIDADE_OK=+0.3 | CEP_N/A=+0.0 | LOGRADOURO_OK=+0.2 (hits=2)
8 de abr. de 2026, 15:18:59	Informação	[GEO-PROVIDER] provider=mapsco | status=SUCCESS (584ms) | confidence=1.00 | display="1210, Rua Fortaleza, Cajuru, Curitiba, Região Geográfica Imediata de Curitiba, R" | coords=(-25.454440,-49.206595)
8 de abr. de 2026, 15:18:59	Informação	[GEO-RESULT] ✅ SELECIONADO: mapsco (high confidence) | total=8343ms
8 de abr. de 2026, 15:18:59	Informação	[LOOKUP] Providers executados em 8346ms
8 de abr. de 2026, 15:18:59	Informação	[ViaCEP] Logradouro expandido: "Rua Fortaleza"
8 de abr. de 2026, 15:18:59	Informação	[ViaCEP] Buscando: https://viacep.com.br/ws/PR/Curitiba/Rua%20Fortaleza/json/
8 de abr. de 2026, 15:19:49	Informação	[ViaCEP] Erro: Endereço não disponível: https://viacep.com.br/ws/PR/Curitiba/Rua%20Fortaleza/json/
8 de abr. de 2026, 15:19:49	Informação	[ViaCEP] ⚠️ Sem CEP dos Correios, usando provider: 82930-000 (50056ms)
8 de abr. de 2026, 15:19:50	Informação	[AUDIT] ✅ Registrado em 310ms: cache_hit=false provider=maps.co
8 de abr. de 2026, 15:19:50	Informação	[GEO-CACHE] op=WRITE | status=HIT | key=cbc58d23e6a2fff2d6bc5b48d7c11a3ee1e8f1af | origin=MODAL | provider=l1 (122ms)
8 de abr. de 2026, 15:19:51	Informação	[GEO-CACHE] op=WRITE | status=HIT | key=cbc58d23e6a2fff2d6bc5b48d7c11a3ee1e8f1af | origin=MODAL | provider=supabase (1127ms)
8 de abr. de 2026, 15:19:51	Informação	[LOOKUP-FIM] total=64761ms | result=SUCCESS (API call cached)