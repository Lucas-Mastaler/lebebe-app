# Inteligencia Comercial - influencia temporal e historico de chamados

Data: 2026-07-14

## Pedido

Ajustar a analise por IA da tela de Inteligencia Comercial para interpretar melhor influencia comercial quando o atendimento Digisac ocorre antes do fechamento da venda, mas contem combinacoes de ida a loja, produto pronto/separado ou finalizacao presencial.

Caso de referencia: venda `65431`.

## Arquivos realmente envolvidos

- `src/app/api/sgi/ia/processar-proximo/route.ts`
  - Monta o prompt individual de cada chamado.
  - Monta o prompt consolidado da venda.
  - Busca metadados da venda, vinculo com ciclo e conversa Digisac.
- `src/lib/ia/transcript.ts`
  - Monta o transcript enviado para a IA.
  - Preserva horarios no texto e agora tambem retorna as mensagens ordenadas para calculo deterministico.
- `src/lib/ia/contexto-temporal-chamados.ts`
  - Novo helper de contexto temporal e chamados anteriores.
- `src/lib/ia/contexto-temporal-chamados.test.ts`
  - Testes unitarios dos cenarios temporais e de historico.

Nao foram alterados:

- sincronizacao Digisac;
- regra de vinculacao/ciclo de venda;
- metricas comerciais;
- frontend;
- registros antigos no banco.

## Validacao Supabase realizada

Antes da alteracao, foram conferidas via MCP Supabase as colunas usadas nas tabelas:

- `sgi_documentos_saida`
- `sgi_documentos_saida_contatos`
- `digisac_conversas_resumo`
- `venda_conversa_vinculos`
- `digisac_chamados_analise_ia`

Campos confirmados e usados:

- Venda: `numero_lancamento`, `telefone_normalizado`, `emissao_texto`, `data_fechamento`, `status`.
- Contatos: `numero_lancamento`, `telefone_normalizado`, `telefone_normalizado_ddi`.
- Conversas Digisac: `digisac_ticket_id`, `protocolo`, `telefone_normalizado`, `telefone_normalizado_ddi`, `department_nome`, `user_nome`, `status`, `comments`, `started_at`, `ended_at`, `inicio_chamado`.
- Vinculos: `numero_lancamento`, `digisac_ticket_id`, `telefone_normalizado`, `telefone_normalizado_ddi`, `data_conversa`, `inicio_chamado`, `considerada_no_ciclo_venda`, `data_inicio_ciclo_venda`, `data_fim_ciclo_venda`, `numero_lancamento_venda_anterior`.
- Analise IA: `numero_lancamento`, `digisac_ticket_id`, `status`, `resumo_chamado`.

## Diagnostico confirmado

O transcript ja preservava os horarios das mensagens no formato `[dd/mm/yyyy HH:mm] Autor: ...`.

O problema era que o prompt nao recebia uma comparacao temporal estruturada. No individual, a venda era formatada apenas como data, sem hora. No consolidado, a data do chamado tambem era enviada sem um bloco que comparasse:

- inicio do chamado;
- fechamento real da venda;
- ultima mensagem antes do fechamento;
- primeira mensagem depois do fechamento;
- quantidade de mensagens antes/depois da venda.

Com isso, um atendimento pre-venda com conteudo operacional de finalizacao podia ser lido pela IA como "sem influencia" ou "pos-venda", mesmo quando o chamado comecou antes da venda e o cliente confirmou ida a loja.

## Caso 65431

Dados reais conferidos no Supabase:

- Venda `65431`
- `data_fechamento`: `2026-07-07 20:59:26+00`
- `emissao_texto`: `07/07/2026 17:59:26`
- Ticket do ciclo: `cf445253-edce-4b2d-a561-c9d9ee626b07`
- Protocolo: `2026070671185`
- `started_at`: `2026-07-06 15:44:49.111+00`
- `data_inicio_ciclo_venda`: `2026-06-22 15:44:50+00`
- `data_fim_ciclo_venda`: `2026-07-07 20:59:26+00`
- `inicio_chamado`: `ativo`
- Departamento: `PORTAO`
- Consultora: `CAROL M. - CONSULTORA`
- Interacoes: `9`

Nao foram encontrados chamados anteriores ao ciclo da venda `65431` pelo criterio seguro de telefone no banco atual.

## Alteracao aplicada

Foi criado um helper deterministico que calcula, para cada chamado:

- se o chamado comecou antes do fechamento;
- intervalo entre inicio do chamado e fechamento;
- intervalo entre ultima mensagem anterior ao fechamento e venda;
- quantidade de mensagens antes e depois do fechamento;
- ultima mensagem antes da venda;
- primeira mensagem depois da venda;
- se a hora do fechamento esta disponivel no dado original.

O prompt individual agora recebe o bloco `CONTEXTO TEMPORAL DA VENDA E DO CHAMADO`.

O prompt consolidado tambem recebe um bloco temporal por chamado, reaproveitando a rebusca de transcripts que ja existia para extrair trechos fatuais.

## Chamados anteriores

Foi incluido um bloco separado `CHAMADOS ANTERIORES - CONTEXTO HISTORICO`.

Regra aplicada:

- buscar ate 3 chamados imediatamente anteriores ao ciclo da venda atual;
- criterio seguro: mesmo telefone normalizado/DDI da venda;
- ordenar do mais recente para o mais antigo;
- excluir chamados do ciclo atual;
- usar apenas como contexto historico, nao como prova automatica de influencia;
- limitar trechos extraidos deterministicamente para evitar prompt grande.

## Regras de IA ajustadas

Foram reforcadas as regras para:

- classificar como `Parcialmente` quando o chamado pre-venda ajudou ida a loja, produto pronto/separado, pagamento ou finalizacao presencial;
- usar grau `Medio` quando o chamado ajudou a avancar/finalizar, mas nao foi comprovado como fator principal;
- nao classificar como `Nao/Nenhum` apenas porque a conversa tem aparencia operacional, se ocorreu antes do fechamento e conduziu a jornada;
- tratar logistica como sem influencia somente quando posterior ao fechamento ou sem elo com decisao, visita, produto, pagamento ou continuidade comercial;
- declarar limitacao quando a hora exata da venda nao estiver disponivel.

## Testes adicionados

`src/lib/ia/contexto-temporal-chamados.test.ts` cobre:

1. Convite a loja seguido de fechamento no mesmo dia.
2. Cliente confirma ida a loja no dia seguinte.
3. Produto deixado pronto antes da venda.
4. Conversa logistica antes do fechamento.
5. Conversa logistica depois do fechamento.
6. Ultima mensagem poucas horas antes da venda.
7. Chamado antigo sem relacao automatica com venda.
8. Tres chamados anteriores mostrando continuidade.
9. Cliente sem chamados anteriores.
10. Historico anterior contraditorio.
11. Chamado posterior a venda.
12. Venda sem hora de fechamento disponivel.
13. Venda `65431`.

## Validacoes automatizadas

- `npx vitest run src/lib/ia/contexto-temporal-chamados.test.ts`
  - Resultado: 13 testes passando.
  - Observacao: no sandbox falhou com `spawn EPERM`; reexecutado fora do sandbox.
- `npx tsc --noEmit --pretty false`
  - Resultado: exit 0.
- `npx eslint src/app/api/sgi/ia/processar-proximo/route.ts src/lib/ia/transcript.ts src/lib/ia/contexto-temporal-chamados.ts src/lib/ia/contexto-temporal-chamados.test.ts`
  - Resultado: exit 0.
- `npx next build`
  - Resultado: build passou fora do sandbox.
  - Observacao: no sandbox falhou com `EPERM` ao remover `.next/app-path-routes-manifest.json`; no build final apareceram avisos conhecidos de `Dynamic server usage` em rotas autenticadas, sem falhar a build.

## Pendencias

- Reanalise real da venda `65431` em ambiente autenticado/DeepSeek ainda precisa ser executada para confirmar o novo resultado gravado.
- A mudanca altera o prompt para novas analises/reanalises; registros antigos nao foram recalculados automaticamente.
