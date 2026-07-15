# Inteligencia Comercial - mensagens do contato sem ticket Digisac

Data: 2026-07-15
Status: Implementado no fluxo de IA. Reanalise real da venda `65431` ainda nao executada.

## 1. Objetivo

Auditar se a analise IA da Inteligencia Comercial pode usar mensagens do mesmo contato Digisac que nao estao vinculadas ao ticket principal, como contexto complementar seguro.

Caso obrigatorio: venda `65431`.

## 2. Conclusao executiva

O sistema agora usa mensagens por `contactId` como contexto complementar da IA Comercial, sem alterar a UI `Ver conversa` e sem alterar a regra de vinculacao de ciclo.

O transcript principal continua usando tickets vinculados em `venda_conversa_vinculos` e, para cada ticket, busca mensagens por:

```text
GET /messages?where[ticketId]=...
```

O novo bloco complementar busca mensagens do mesmo `digisac_contact_id` por:

```text
GET /messages?where[contactId]=...
```

O botao `Ver conversa` da tela continua usando somente `ticketId`, por decisao de escopo.

No caso `65431`, a API Digisac por `contactId` retornou 90 mensagens do contato, das quais 78 estavam sem `ticketId`. A busca por ticket retornou apenas 12 mensagens. Os sinais comerciais fortes de carrinho, cor/modelo, preco, parcelamento, link/pagamento, antifraude e ida a loja apareceram nas mensagens sem ticket.

## 3. Arquivos auditados

### Frontend

- `src/components/inteligencia-comercial/ModalDetalheVenda.tsx`
  - Renderiza o bloco `Historico do atendimento`.
  - Renderiza `Nº {ordem_ciclo}`, protocolo e botao `Ver conversa`.
  - Chama `fetch('/api/sgi/digisac/mensagens?ticketId=...')`.

### APIs internas

- `src/app/api/sgi/digisac/mensagens/route.ts`
  - Exige usuario comercial via `validateComercialUser`.
  - Exige `ticketId`.
  - Chama `buscarMensagensTicketPaginado(ticketId)`.
  - Retorna apenas `id`, `text`, `isFromMe`, `timestamp`.
- `src/app/api/sgi/digisac/chamados-ciclo/route.ts`
  - Busca chamados do ciclo por `numero_lancamento`.
  - Parte de `venda_conversa_vinculos`.
- `src/app/api/sgi/ia/iniciar-analise/route.ts`
  - Cria job de IA com um registro por `digisac_ticket_id` do ciclo.
- `src/app/api/sgi/ia/processar-proximo/route.ts`
  - Monta prompt individual e consolidado.
  - Chama `montarTranscriptChamado(ticketId)`.
- `src/app/api/sgi/ia/analise-status/route.ts`
  - Retorna chamados analisados enriquecidos com protocolo, data, telefone, loja e consultora.

### Helpers

- `src/lib/digisac/clienteDigisac.ts`
  - Cliente HTTP base, usa `DIGISAC_BASE_URL` e `DIGISAC_TOKEN`.
  - Nao expor token em logs.
- `src/lib/digisac/sgi-sync.ts`
  - `buscarMensagensTicketPaginado(ticketId)` busca mensagens por `where[ticketId]`, `perPage`, `page`.
  - Filtra apenas `type === 'chat'`, `visible !== false`, `isComment !== true`.
  - Nao possui busca por `where[contactId]`.
- `src/lib/ia/transcript.ts`
  - Monta transcript a partir de `buscarMensagensTicketPaginado(ticketId)`.
  - Trunca acima de 22.000 caracteres usando primeiras 20 e ultimas 20 linhas.
- `src/lib/ia/contexto-temporal-chamados.ts`
  - Busca chamados anteriores por telefone em `digisac_conversas_resumo`.
  - Ainda depende de tickets e de `montarTranscriptChamado(ticketId)`.

## 4. Auditoria do frontend

Bloco auditado: `Historico do atendimento`, `Nº 1`, protocolo e botao `Ver conversa`.

Respostas:

1. Componente: `PainelAnaliseIA` dentro de `src/components/inteligencia-comercial/ModalDetalheVenda.tsx`.
2. Funcao chamada: handler inline do botao `Ver conversa`.
3. API interna usada: `GET /api/sgi/digisac/mensagens?ticketId={digisac_ticket_id}`.
4. Identificador usado: `ticketId`.
5. A tela recebe apenas mensagens do ticket; nao recebe todas as mensagens do contato.
6. Existe codigo reutilizavel para transcript: `montarTranscriptChamado(ticketId)`, mas ele tambem usa somente ticket.
7. A tela nao diferencia mensagens sem ticket, porque elas nao sao buscadas.
8. O botao `Ver conversa` nao exibe dados mais amplos do que a IA recebe. Ambos usam busca por ticket.

## 5. Auditoria do backend atual

1. Tickets do ciclo sao buscados em `venda_conversa_vinculos`.
2. Mensagens de cada ticket sao buscadas em `buscarMensagensTicketPaginado(ticketId)`.
3. Transcript e montado em `src/lib/ia/transcript.ts`.
4. Truncamento ocorre em `transcript.ts`, limite `TRANSCRIPT_MAX_CHARS = 22000`, mantendo inicio/fim.
5. Prompt individual recebe o transcript em `montarPromptChamado`.
6. Consolidado rebusca transcripts por ticket para `extrairTrechosFatuais`.
7. `contactId` esta disponivel em `digisac_conversas_resumo.digisac_contact_id`, mas nao entra no prompt atual.
8. `contactId` ja e salvo no banco em `digisac_conversas_resumo.digisac_contact_id`. Tambem existe em fluxos separados como `atendimento_automatico_*`, `usuarios_info`, `digisac_triagem_loja` e finalizacoes automaticas.
9. Nao foi encontrado helper atual de busca de mensagens por contato para IA Comercial.
10. Nao foi encontrada chamada atual a `/messages` com `where[contactId]` no fluxo de Inteligencia Comercial.

## 6. Validacao Supabase

MCP Supabase confirmou as colunas reais das tabelas:

- `digisac_conversas_resumo`
- `venda_conversa_vinculos`
- `sgi_documentos_saida`
- `sgi_documentos_saida_contatos`
- `digisac_chamados_analise_ia`
- `ia_analise_comercial_fila`
- `venda_analise_comercial_ia`

Campos relevantes confirmados:

- `digisac_conversas_resumo.digisac_contact_id`
- `digisac_conversas_resumo.digisac_ticket_id`
- `digisac_conversas_resumo.service_id`
- `digisac_conversas_resumo.telefone_normalizado`
- `digisac_conversas_resumo.telefone_normalizado_ddi`
- `venda_conversa_vinculos.digisac_ticket_id`
- `venda_conversa_vinculos.telefone_normalizado`
- `venda_conversa_vinculos.telefone_normalizado_ddi`
- `venda_conversa_vinculos.data_inicio_ciclo_venda`
- `venda_conversa_vinculos.data_fim_ciclo_venda`
- `sgi_documentos_saida_contatos.telefone_normalizado`
- `sgi_documentos_saida_contatos.telefone_normalizado_ddi`

## 7. Caso 65431 - dados de banco

Venda atual:

- `numero_lancamento`: `65431`
- `data_fechamento`: `2026-07-07T20:59:26+00:00`
- `emissao_texto`: `07/07/2026 17:59:26`
- cliente: mesmo cliente da venda anterior `65295`

Venda anterior usada como inicio de janela:

- `numero_lancamento`: `65295`
- `data_fechamento`: `2026-06-22T15:44:50+00:00`
- `emissao_texto`: `22/06/2026 12:44:50`

Ticket do ciclo:

- `digisac_ticket_id`: `cf445253-edce-4b2d-a561-c9d9ee626b07`
- protocolo: `2026070671185`
- `digisac_contact_id`: `67e15f97-a406-445b-9e6d-ae8ecc1f8a55`
- `service_id`: `c60d720f-5ad5-4a1b-bedb-e51495dee686`
- `service_nome`: `PORTAO (41 8442-6528)`
- `department_nome`: `PORTAO`
- `started_at`: `2026-07-06T15:44:49.111+00:00`
- `ended_at`: `2026-07-09T12:38:53.635+00:00`
- `quantidade_interacoes` no resumo salvo: `9`

Contato/telefone:

- SGI venda `65431` tem dois telefones normalizados.
- O ticket Digisac foi salvo com telefone na variacao sem nono digito: `4192569293` / `554192569293`.
- No banco atual, esse telefone/contactId aparece com 1 `digisac_contact_id` e 1 ticket salvo em `digisac_conversas_resumo`.

## 8. Comportamento real da API Digisac

Consulta controlada, sem registrar conteudo integral de conversa, usando `DIGISAC_BASE_URL` e `DIGISAC_TOKEN` do projeto.

### Busca por contato

Endpoint testado:

```text
GET /messages
where[contactId]=67e15f97-a406-445b-9e6d-ae8ecc1f8a55
where[visible]=true
where[type][$ne]=reaction
includeTicketTransfer=true
order timestamp DESC
paginate=false
```

Resultados:

- `paginate=false` retorna array direto.
- Com `limit=20`, retornou 20 mensagens.
- Com `limit=200`, retornou 90 mensagens.
- Sem `limit`, retornou 90 mensagens.
- Nao foi confirmado limite maximo oculto acima de 90, porque o contato tinha 90 mensagens nesse filtro.
- Intervalo retornado: `2026-07-02T20:19:40.169Z` ate `2026-07-09T12:38:53.635Z`.
- Dentro da janela entre venda anterior e atual: 89 mensagens.
- Mensagens com `ticketId` do ticket do ciclo: 12.
- Mensagens sem `ticketId`: 78.
- Outros tickets dentro da janela: 0.

Tipos encontrados:

- `chat`: 75
- `image`: 7
- `ptt`: 2
- `video`: 3
- `ticket`: 3

Eventos tecnicos:

- `type=ticket`: 3
- `data.ticketTransfer=true`: 1
- reactions: 0 no filtro usado
- invisiveis: 0 no filtro usado
- comentarios internos: 0 no filtro usado

Midia:

- imagens/videos vieram com `file` e `preview`.
- audios `ptt` vieram com `file`, sem `text`, `isTranscribing=false`, `transcribeError=false`.
- Audio transcrito nao foi confirmado nesse caso.

### Busca por ticket

Endpoint atual do sistema:

```text
GET /messages?where[ticketId]=cf445253-edce-4b2d-a561-c9d9ee626b07&perPage=100&page=1
```

Resultados:

- Retorna objeto paginado com `data`, `total`, `currentPage`, `lastPage`, `limit`, `skip`.
- Total retornado: 12 mensagens.
- Dentro da janela entre venda anterior e atual: 11 mensagens.
- Todas com `ticketId` do ciclo.
- Tipos: `chat` 9, `ticket` 3.

### Paginacao

Testes por contato:

- `perPage=10&page=1`: objeto paginado, `total=90`, `lastPage=9`, `limit=10`, `skip=0`.
- `perPage=10&page=2`: objeto paginado, `total=90`, `lastPage=9`, `limit=10`, `skip=10`.
- `limit=10` sem `paginate=false`: a API ignorou o `limit=10` e usou `limit=15` padrao.
- `skip` e `offset` junto com `limit=10` tambem nao mudaram o padrao nesse teste.

Conclusao: para buscar tudo com controle, usar paginacao `perPage/page` ou `paginate=false` com `limit` explicitamente testado. Para producao, preferir paginar por `perPage/page` com limite maximo defensivo.

## 9. Conteudo comercial do caso 65431

Foi feita contagem por termos sem imprimir texto de conversa.

Dentro da janela entre a venda anterior `65295` e a venda atual `65431`:

### Mensagens do ticket atual

- total: 11
- chat: 9
- midias: 0
- termos de carrinho/modelo: 0
- termos de cor/modelo: 0
- termos de preco: 3
- termos de parcelamento: 0
- termos de link/pagamento: 0
- termos de antifraude/reprovacao: 0
- termos de loja/presencial: 3

### Mensagens sem ticket

- total: 78
- chat: 66
- midias: 12
- termos de carrinho/modelo: 4
- termos de cor/modelo: 3
- termos de preco: 11
- termos de parcelamento: 6
- termos de link/pagamento: 15
- termos de antifraude/reprovacao: 1
- termos de loja/presencial: 15

Conclusao do caso: as mensagens de escolha do carrinho aparecem na busca por contato e nao aparecem na busca atual por ticket. A IA atualmente nao recebe essas mensagens.

Impacto esperado depois de reanalise real: a classificacao da venda `65431` tende a mudar para `Influenciou = Sim` e `Grau = Alto`, porque ha evidencias de produto/modelo/cor, preco, parcelamento, link de pagamento, tentativa de pagamento e tentativa de fechamento presencial. Isso ainda precisa ser confirmado por reanalise real da fila IA.

## 10. Separacao necessaria das mensagens

Campos suficientes para classificar:

1. Mensagens do ticket atual:
   - `message.ticketId === digisac_ticket_id`.
2. Mensagens de outros tickets no periodo:
   - `message.ticketId` preenchido e diferente do ticket atual.
3. Mensagens sem ticket:
   - `message.ticketId` ausente/null.
4. Eventos tecnicos/descartados:
   - `type=ticket`
   - `data.ticketTransfer=true`
   - `type=reaction`
   - `visible=false`
   - `isComment=true`
   - sem texto e sem midia comercialmente descritivel.

Campos uteis adicionais:

- `id`
- `contactId`
- `serviceId`
- `timestamp`
- `type`
- `origin`
- `isFromMe`
- `from`
- `file`
- `preview`
- `quotedMessage`
- `isTranscribing`
- `transcribeError`

## 11. Filtro recomendado

Entrada da busca complementar:

- `contactId` vindo de `digisac_conversas_resumo.digisac_contact_id` dos tickets do ciclo.
- `serviceId` deve ser considerado para reduzir mistura entre conexoes quando necessario.
- Janela temporal:
  - inicio: `data_fechamento` da venda anterior do mesmo cliente/telefone;
  - fim: `data_fechamento` da venda atual.

Fallback quando nao houver venda anterior:

1. usar `data_inicio_ciclo_venda`, se existir;
2. se nao existir, usar o primeiro chamado conhecido do ciclo;
3. se ainda nao existir, aplicar janela maxima defensiva a definir por decisao de produto. Nao foi implementada janela arbitraria nesta auditoria.

Mensagem entra no contexto complementar se:

- `visible !== false`;
- `type !== 'reaction'`;
- `isComment !== true`;
- tiver `id`;
- estiver dentro da janela;
- for `chat` com texto, ou midia com indicio util (`file`, `preview`, `quotedMessage`);
- nao for `type=ticket` nem `data.ticketTransfer=true`.

## 12. Deduplicacao recomendada

Preferencia:

1. deduplicar por `message.id`;
2. fallback apenas se `id` ausente:
   - `timestamp`;
   - `isFromMe`/remetente;
   - `type`;
   - conteudo normalizado ou identificador de arquivo.

Nao usar apenas texto para deduplicar quando `id` existir.

Quoted messages:

- nao devem virar uma segunda mensagem independente;
- devem ser tratadas como contexto da mensagem principal, com cuidado para nao duplicar evidencias.

Eventos `ticketTransfer`:

- devem entrar em contagem de descartados/diagnostico, nao no transcript comercial.

## 13. Estrutura sugerida para prompt futuro

Bloco separado, apos o transcript do ticket ou apos o contexto temporal:

```text
CONTEXTO COMPLEMENTAR DO CONTATO - MENSAGENS FORA DO TICKET PRINCIPAL

Estas mensagens pertencem ao mesmo contato e ocorreram dentro do periodo comercial da venda.
Algumas podem nao estar associadas a um ticket Digisac.

Use-as para reconstruir a jornada comercial, mas:
- nao invente protocolo;
- nao trate automaticamente como novo chamado;
- nao atribua influencia sem evidencia;
- diferencie mensagens vinculadas e nao vinculadas a tickets.
```

O bloco deve listar, de forma resumida:

- periodo usado;
- total analisado;
- total do ticket atual;
- total de outros tickets;
- total sem ticket;
- total descartado;
- trechos fatuais limitados e ordenados cronologicamente.

## 14. Riscos

- Mesmo telefone/contactId pode ser compartilhado ou migrado entre conexoes.
- Mensagens antigas sem ticket podem pertencer a uma jornada diferente.
- `contactId` pode variar quando o numero foi reconectado ou recriado no Digisac.
- `serviceId` precisa ser preservado para nao misturar loja/conexao indevidamente.
- Prompt pode crescer muito se enviar todas as mensagens do contato.
- Midias e audios podem ser relevantes, mas nem sempre tem transcricao.
- Eventos tecnicos podem poluir a IA se nao forem filtrados.

## 15. Plano minimo de implementacao

Implementado em 2026-07-15.

1. Criado helper dedicado:
   - `buscarMensagensContatoPaginado(contactId, options)`.
   - Usar `perPage/page` com limite maximo de paginas.
   - Janela temporal aplicada por cliente.
   - Limites defensivos: `perPage=100`, `maxPages=10`, `maxMessages=1000`.
2. Criado helper em `src/lib/ia`:
   - classificar mensagens em `ticket_atual`, `outros_tickets`, `sem_ticket`, `descartadas`;
   - deduplicar por `message.id`;
   - fallback de deduplicacao por `timestamp + remetente + type + conteudo normalizado`;
   - extrair trechos fatuais limitados;
   - montar bloco complementar separado.
3. Alterado `processar-proximo`:
   - buscar `digisac_contact_id` e `service_id` em `digisac_conversas_resumo`;
   - calcular janela venda anterior -> venda atual, com fallback de 30 dias antes da venda atual quando nao houver venda anterior;
   - injetar bloco complementar no prompt individual.
4. Alterado consolidado:
   - reaproveitar o mesmo contexto por contato/ticket ou consolidar uma vez por venda;
   - evitar duplicar trechos ja usados nos transcripts de tickets.
5. Nao implementado por escopo:
   - expor diagnostico na UI, sem mostrar token/status tecnico;
   - permitir `Ver conversa completa do contato` separado de `Ver conversa` do ticket.

## 16. Arquivos que provavelmente mudariam

- `src/lib/digisac/sgi-sync.ts`
- `src/lib/digisac/mensagens-contato.ts`
- `src/lib/ia/contexto-complementar-contato.ts`
- `src/app/api/sgi/ia/processar-proximo/route.ts`
- `src/lib/digisac/mensagens-contato.test.ts`
- `src/lib/ia/contexto-complementar-contato.test.ts`

Nao alterados por escopo:

- `src/app/api/sgi/digisac/mensagens/route.ts`
- `src/components/inteligencia-comercial/ModalDetalheVenda.tsx`
- migrations Supabase

## 17. Testes necessarios

Testes implementados e aprovados:

- Busca por contato paginada por `perPage/page`.
- Filtro de janela temporal.
- Limite de paginas com `truncado=true`.
- Limite de mensagens com `truncado=true`.
- Deduplicacao por `message.id` entre paginas.
- Mensagens sem `ticketId`.
- Mensagens de outro ticket no periodo.
- Remocao das mensagens do ticket principal do prompt complementar.
- Evento `type=ticket` descartado.
- `data.ticketTransfer=true` descartado.
- Reaction descartada.
- Mensagem invisivel descartada.
- Mensagem sem `visible=true` descartada.
- Comentario interno descartado.
- Registro apagado ou vazio descartado.
- Deduplicacao por `message.id`.
- Fallback de deduplicacao sem `id`.
- Janela venda anterior -> venda atual.
- Fallback de 30 dias quando nao ha venda anterior.
- API Digisac com erro nao quebra analise principal.
- Truncamento prioriza sinais comerciais.
- URL mascarada no prompt como `[link]`.
- Midia interpretavel resumida sem tentar transcrever.
- Caso `65431` com `contactId=67e15f97-a406-445b-9e6d-ae8ecc1f8a55`, `ticketId=cf445253-edce-4b2d-a561-c9d9ee626b07`, 11 mensagens do ticket principal e 78 mensagens sem ticket.

Comandos executados:

- `npx vitest run src/lib/digisac/mensagens-contato.test.ts src/lib/ia/contexto-complementar-contato.test.ts` - falhou no sandbox com `spawn EPERM`.
- Mesmo comando fora do sandbox - 2 arquivos, 26 testes aprovados.
- `npx tsc --noEmit --pretty false` - aprovado.
- `npx eslint src/lib/digisac/sgi-sync.ts src/lib/digisac/mensagens-contato.ts src/lib/digisac/mensagens-contato.test.ts src/lib/ia/contexto-complementar-contato.ts src/lib/ia/contexto-complementar-contato.test.ts src/app/api/sgi/ia/processar-proximo/route.ts` - aprovado.
- `npx next build` - falhou no sandbox com `EPERM` ao remover `.next/app-path-routes-manifest.json`.
- `npx next build` fora do sandbox - aprovado; a build exibiu avisos/logs existentes de `Dynamic server usage` em rotas autenticadas que usam `cookies`, mas finalizou com sucesso.

## 18. Implementacao realizada

### Busca por contato

Arquivo: `src/lib/digisac/mensagens-contato.ts`.

Contrato:

- entrada: `contactId`, janela opcional, `perPage`, `maxPages`, `maxMessages`;
- endpoint: `/messages?where[contactId]=...&perPage=...&page=...&order[0][0]=timestamp&order[0][1]=DESC`;
- saida: mensagens na janela, `totalApi`, `paginasBuscadas`, `totalColetado`, `truncado`;
- ordenacao final: cronologica ASC.

### Contexto complementar

Arquivo: `src/lib/ia/contexto-complementar-contato.ts`.

Regras implementadas:

- `contactId` vem apenas de `digisac_conversas_resumo.digisac_contact_id`;
- janela: fechamento da venda anterior ate fechamento da venda atual;
- fallback: 30 dias antes do fechamento atual quando nao ha venda anterior;
- remove mensagens dos tickets principais para nao duplicar transcript;
- separa `sem ticket` e `outros tickets`;
- descarta `visible !== true`, `reaction`, `ticket`, `ticketTransfer`, comentario interno, apagadas, vazias e sem conteudo interpretavel;
- deduplica por `message.id`, com fallback defensivo;
- limita prompt por quantidade e caracteres;
- prioriza mensagens sem ticket, sinais comerciais e proximidade temporal;
- preserva ordem cronologica no bloco final;
- mascara URLs como `[link]`;
- logs somente agregados.

### Prompt individual

Arquivo: `src/app/api/sgi/ia/processar-proximo/route.ts`.

Alteracoes:

- query de `digisac_conversas_resumo` agora inclui `digisac_contact_id` e `service_id`;
- monta `CONTEXTO COMPLEMENTAR DO CONTATO - MENSAGENS FORA DO TICKET PRINCIPAL`;
- injeta o bloco antes do transcript principal;
- instrui a IA a usar mensagens sem ticket como evidencia complementar sem inventar protocolo/chamado/numero discado.

### Prompt consolidado

Arquivo: `src/app/api/sgi/ia/processar-proximo/route.ts`.

Alteracoes:

- coleta `digisac_contact_id` dos tickets analisados;
- deduplica contatos;
- remove todos os tickets principais do bloco complementar;
- injeta o mesmo bloco antes dos resumos;
- adiciona regra explicita para citar evidencias como `contexto complementar do contato`.

### Log seguro esperado

Exemplo:

```text
[IA][CONTEXTO-CONTATO] venda=65431 contatos=1 totalApi=90 naJanela=89 ticketAtual=11 outrosTickets=0 semTicket=78 descartadas=... deduplicadas=... enviadasPrompt=... truncado=false
```

## 19. Pontos nao confirmados

- Limite maximo oculto do Digisac acima de 90 mensagens para `paginate=false`.
- Se ha casos reais com multiplos `contactId` para o mesmo telefone alem do caso `65431`.
- Se audios transcritos aparecem em algum outro contato.
- Se a UI deve continuar com `Ver conversa` apenas por ticket ou ganhar uma acao separada por contato.
- Resultado real da reanalise IA da venda `65431`; os testes cobrem o fixture, mas a fila IA real nao foi executada neste ajuste.
