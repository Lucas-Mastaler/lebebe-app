2026-04-08 19:49:28.718 [info] [API][CHAMADOS][ROUTE] POST /api/chamados-finalizados/pesquisar bodySummary= {
  hasBody: true,
  page: 1,
  perPage: 30,
  departmentsCount: 1,
  usersCount: 1,
  dataUltimoChamadoFechadoInicio: '06/04/2026',
  dataUltimoChamadoFechadoFim: '07/04/2026'
}
2026-04-08 19:49:28.718 [info] [DIGISAC][TICKETS] filtros recebidos= { departmentIds: 1, userIds: 1, page: 1, perPage: 30 }
2026-04-08 19:49:28.718 [info] [DIGISAC][TICKETS] rangeUTC= {
  inicioUtc: '2026-04-06T03:00:00.000Z',
  fimUtc: '2026-04-08T02:59:59.999Z'
}
2026-04-08 19:49:28.718 [info] [DIGISAC][TICKETS] urlFinal= /tickets?where%5BisOpen%5D=false&where%5BendedAt%5D%5B%24between%5D%5B0%5D=2026-04-06T03%3A00%3A00.000Z&where%5BendedAt%5D%5B%24between%5D%5B1%5D=2026-04-08T02%3A59%3A59.999Z&include%5B0%5D%5Bmodel%5D=contact&include%5B1%5D%5Bmodel%5D=department&include%5B2%5D%5Bmodel%5D=user&order%5B0%5D%5B0%5D=endedAt&order%5B0%5D%5B1%5D=DESC&where%5BdepartmentId%5D=4136bb72-5bc2-43bb-bf5a-bfc820a80bd1&where%5BuserId%5D=663bf28c-278a-431f-b32d-1a19282e0123&page=1&perPage=200
2026-04-08 19:49:28.718 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BisOpen%5D=false&where%5BendedAt%5D%5B%24between%5D%5B0%5D=2026-04-06T03%3A00%3A00.000Z&where%5BendedAt%5D%5B%24between%5D%5B1%5D=2026-04-08T02%3A59%3A59.999Z&include%5B0%5D%5Bmodel%5D=contact&include%5B1%5D%5Bmodel%5D=department&include%5B2%5D%5Bmodel%5D=user&order%5B0%5D%5B0%5D=endedAt&order%5B0%5D%5B1%5D=DESC&where%5BdepartmentId%5D=4136bb72-5bc2-43bb-bf5a-bfc820a80bd1&where%5BuserId%5D=663bf28c-278a-431f-b32d-1a19282e0123&page=1&perPage=200
2026-04-08 19:49:29.371 [info] [DIGISAC][TICKETS] totalRetornado= 25 apiPage=1 uiPage= 1
2026-04-08 19:49:29.371 [info] [API][CHAMADOS] antesAgregacao.tickets= 25 aposAgregacao.contatosUnicos= 23
2026-04-08 19:49:29.371 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 0a0347d3-49dc-41d1-95f6-f0224616aa26 url= /tickets?where%5BcontactId%5D=0a0347d3-49dc-41d1-95f6-f0224616aa26&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.371 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=0a0347d3-49dc-41d1-95f6-f0224616aa26&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.547 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:29.547 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 0a0347d3-49dc-41d1-95f6-f0224616aa26 ticketsAbertos= 0
2026-04-08 19:49:29.547 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= e7797531-2465-48fe-bedc-778cb743c3a2 url= /tickets?where%5BcontactId%5D=e7797531-2465-48fe-bedc-778cb743c3a2&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.547 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=e7797531-2465-48fe-bedc-778cb743c3a2&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.720 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:29.720 [info] [DIGISAC][TICKETS_ABERTOS] contactId= e7797531-2465-48fe-bedc-778cb743c3a2 ticketsAbertos= 0
2026-04-08 19:49:29.721 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 9d50e45d-be8c-41cc-a566-df69bde0476d url= /tickets?where%5BcontactId%5D=9d50e45d-be8c-41cc-a566-df69bde0476d&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.721 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=9d50e45d-be8c-41cc-a566-df69bde0476d&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.888 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:29.888 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 9d50e45d-be8c-41cc-a566-df69bde0476d ticketsAbertos= 0
2026-04-08 19:49:29.888 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 7eb1cabd-ce64-4b24-8002-e4264877298d url= /tickets?where%5BcontactId%5D=7eb1cabd-ce64-4b24-8002-e4264877298d&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:29.888 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=7eb1cabd-ce64-4b24-8002-e4264877298d&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.824 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:31.824 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 47fb8afc-093d-4590-bfad-6c1c9effa08d ticketsAbertos= 0
2026-04-08 19:49:31.824 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= b603bee9-4f05-4fa1-bea8-ca2ad432eb5c url= /tickets?where%5BcontactId%5D=b603bee9-4f05-4fa1-bea8-ca2ad432eb5c&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.824 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=b603bee9-4f05-4fa1-bea8-ca2ad432eb5c&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.000 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:32.000 [info] [DIGISAC][TICKETS_ABERTOS] contactId= b603bee9-4f05-4fa1-bea8-ca2ad432eb5c ticketsAbertos= 0
2026-04-08 19:49:32.000 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 03cba4a4-5945-4b9c-ba28-7d1d35976393 url= /tickets?where%5BcontactId%5D=03cba4a4-5945-4b9c-ba28-7d1d35976393&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.000 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=03cba4a4-5945-4b9c-ba28-7d1d35976393&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.182 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:32.182 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 03cba4a4-5945-4b9c-ba28-7d1d35976393 ticketsAbertos= 0
2026-04-08 19:49:32.182 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 8c0678c7-0cb1-4c31-8abe-1820a3ba470c url= /tickets?where%5BcontactId%5D=8c0678c7-0cb1-4c31-8abe-1820a3ba470c&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.182 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=8c0678c7-0cb1-4c31-8abe-1820a3ba470c&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.356 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:32.356 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 8c0678c7-0cb1-4c31-8abe-1820a3ba470c ticketsAbertos= 0
2026-04-08 19:49:32.356 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 42901ff6-c5b3-46af-859e-16bf86f38d90 url= /tickets?where%5BcontactId%5D=42901ff6-c5b3-46af-859e-16bf86f38d90&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.356 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=42901ff6-c5b3-46af-859e-16bf86f38d90&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:32.545 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:32.545 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 42901ff6-c5b3-46af-859e-16bf86f38d90 ticketsAbertos= 0
2026-04-08 19:49:32.545 [info] [DIGISAC][CONTACT] uniqueContactIds= 23 cacheHit= 23 fetched= 0
2026-04-08 19:49:32.546 [info] [DIGISAC][SCHEDULE] uniqueContactIds= 23 cacheHit= 23 fetched= 0
2026-04-08 19:49:32.546 [info] [API][CHAMADOS] sufixoNomeComUltimos4 ajustados= 18 comTelefone= 18 fallbackContactId= 0
2026-04-08 19:49:32.546 [info] [API][CHAMADOS] grupos= 18 retornando= 18
2026-04-08 19:49:32.547 [info] [API][CHAMADOS] agregados=18 page=1/1 time=3828ms
2026-04-08 19:49:32.547 [info] [API][CHAMADOS][ROUTE] resultado.items= 18 duplicates= 0
2026-04-08 19:49:30.054 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:30.054 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 7eb1cabd-ce64-4b24-8002-e4264877298d ticketsAbertos= 0
2026-04-08 19:49:30.054 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= ba665ae0-5de6-4534-9993-5d1e389f94f6 url= /tickets?where%5BcontactId%5D=ba665ae0-5de6-4534-9993-5d1e389f94f6&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.054 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=ba665ae0-5de6-4534-9993-5d1e389f94f6&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.266 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:30.266 [info] [DIGISAC][TICKETS_ABERTOS] contactId= ba665ae0-5de6-4534-9993-5d1e389f94f6 ticketsAbertos= 0
2026-04-08 19:49:30.267 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= d598aebb-cb68-45f8-889e-9eec1b5ae4ca url= /tickets?where%5BcontactId%5D=d598aebb-cb68-45f8-889e-9eec1b5ae4ca&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.267 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=d598aebb-cb68-45f8-889e-9eec1b5ae4ca&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.440 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:30.440 [info] [DIGISAC][TICKETS_ABERTOS] contactId= d598aebb-cb68-45f8-889e-9eec1b5ae4ca ticketsAbertos= 0
2026-04-08 19:49:30.440 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= e9f10461-6cca-4007-8d98-693fb1a44d63 url= /tickets?where%5BcontactId%5D=e9f10461-6cca-4007-8d98-693fb1a44d63&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.440 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=e9f10461-6cca-4007-8d98-693fb1a44d63&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.608 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:30.608 [info] [DIGISAC][TICKETS_ABERTOS] contactId= e9f10461-6cca-4007-8d98-693fb1a44d63 ticketsAbertos= 0
2026-04-08 19:49:30.608 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 9d1dd4d9-f12b-41fb-83c3-af80b1da4e56 url= /tickets?where%5BcontactId%5D=9d1dd4d9-f12b-41fb-83c3-af80b1da4e56&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.609 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=9d1dd4d9-f12b-41fb-83c3-af80b1da4e56&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.780 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:30.780 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 9d1dd4d9-f12b-41fb-83c3-af80b1da4e56 ticketsAbertos= 0
2026-04-08 19:49:30.780 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 8c5715bf-2694-4d32-b3d5-e14b627ce618 url= /tickets?where%5BcontactId%5D=8c5715bf-2694-4d32-b3d5-e14b627ce618&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.780 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=8c5715bf-2694-4d32-b3d5-e14b627ce618&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.948 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:30.948 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 8c5715bf-2694-4d32-b3d5-e14b627ce618 ticketsAbertos= 0
2026-04-08 19:49:30.948 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 34b52f16-9911-4931-9a9a-dd18f0b2b886 url= /tickets?where%5BcontactId%5D=34b52f16-9911-4931-9a9a-dd18f0b2b886&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:30.948 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=34b52f16-9911-4931-9a9a-dd18f0b2b886&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.121 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:31.121 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 34b52f16-9911-4931-9a9a-dd18f0b2b886 ticketsAbertos= 0
2026-04-08 19:49:31.122 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= bd14b254-c40c-4ec7-b367-848341bcf0f2 url= /tickets?where%5BcontactId%5D=bd14b254-c40c-4ec7-b367-848341bcf0f2&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.122 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=bd14b254-c40c-4ec7-b367-848341bcf0f2&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.292 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:31.292 [info] [DIGISAC][TICKETS_ABERTOS] contactId= bd14b254-c40c-4ec7-b367-848341bcf0f2 ticketsAbertos= 0
2026-04-08 19:49:31.292 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 5426fd8c-efe5-4d4c-9003-de84f417d164 url= /tickets?where%5BcontactId%5D=5426fd8c-efe5-4d4c-9003-de84f417d164&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.292 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=5426fd8c-efe5-4d4c-9003-de84f417d164&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.462 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:31.462 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 5426fd8c-efe5-4d4c-9003-de84f417d164 ticketsAbertos= 0
2026-04-08 19:49:31.462 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 2e296346-4a01-4a62-9a83-90831bdcc4bd url= /tickets?where%5BcontactId%5D=2e296346-4a01-4a62-9a83-90831bdcc4bd&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.462 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=2e296346-4a01-4a62-9a83-90831bdcc4bd&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.655 [info] [DIGISAC][TICKETS_ABERTOS] resposta (amostra)= {"data":[],"total":0,"limit":1,"skip":0,"currentPage":1,"lastPage":1,"from":0,"to":1}
2026-04-08 19:49:31.655 [info] [DIGISAC][TICKETS_ABERTOS] contactId= 2e296346-4a01-4a62-9a83-90831bdcc4bd ticketsAbertos= 0
2026-04-08 19:49:31.655 [info] [DIGISAC][TICKETS_ABERTOS] consultando contactId= 47fb8afc-093d-4590-bfad-6c1c9effa08d url= /tickets?where%5BcontactId%5D=47fb8afc-093d-4590-bfad-6c1c9effa08d&where%5BisOpen%5D=true&page=1&perPage=1
2026-04-08 19:49:31.655 [info] [DIGISAC] Request: GET /api/v1/tickets?where%5BcontactId%5D=47fb8afc-093d-4590-bfad-6c1c9effa08d&where%5BisOpen%5D=true&page=1&perPage=1