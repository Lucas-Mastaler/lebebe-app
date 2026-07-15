# Ficha de Atendimento Presencial - Progresso

## Objetivo

Planejar a implementacao tecnica do modulo "Ficha de Atendimento Presencial" sem implementar o modulo completo nesta fase.

O modulo funcional previsto tem tres areas:
- Ficha de Atendimento
- Registros de Atendimentos
- Clientes

## Escopo aprovado

Fase 0 apenas:
- auditar autenticacao, permissoes, usuarios, unidades e Inteligencia Comercial;
- confirmar estruturas reais no codigo e no Supabase;
- propor arquitetura, modelo conceitual, matriz de permissoes e harness de validacao;
- dividir a entrega em fases pequenas;
- nao criar migrations;
- nao alterar Inteligencia Comercial;
- nao implementar Digisac automatico;
- nao implementar o modulo completo.

## Documentos lidos

- `docs/PLANO FUNCIONAL ATUALIZADO - FICHA DE ATENDIMENTO PRESENCIAL.md`
- `docs/ia/log_progress.md`
- `docs/ia/padrao-novas-telas-permissoes.md`
- `.devin/rules/gerais.md`
- `.devin/rules/continuidade-agente.md`
- `.devin/rules/supabase.md`
- `.agents/skills/supabase/SKILL.md`
- `package.json`
- `vercel.json`

Observacao: algumas leituras de documentos com acentos aparecem com mojibake no terminal. Nao foi feita correcao de encoding nesta etapa.

## Arquivos realmente envolvidos

### Autenticacao e sessao

- `src/middleware.ts`: valida sessao Supabase, `usuarios_permitidos`, usuario ativo, auto-logout e parte do gate de `/superadmin` e `/configuracoes`.
- `src/lib/supabase/server.ts`: cria client server-side com cookies via `@supabase/ssr`.
- `src/lib/supabase/client.ts`: cria client browser-side via `@supabase/ssr`.
- `src/lib/supabase/service.ts`: cria service client server-side com `SUPABASE_SERVICE_ROLE_KEY`.
- `src/lib/auth/api-auth.ts`: helper central de API para sessao, usuario permitido, ativo e role.

### Permissoes, menu e janelas

- `src/lib/auth/modulos-app.ts`: catalogo central de modulos e grupos do Sidebar.
- `src/lib/auth/module-access.ts`: resolve acesso por modulo usando `usuarios_permitidos`, `app_modulos`, `app_permissoes_usuario`, `app_usuarios_perfis` e `app_permissoes_perfil`; tambem combina modulo + janela.
- `src/lib/auth/access-window.ts`: valida janela de horario por perfil em `app_janelas_acesso_perfil`; janelas individuais existem, mas nao sao aplicadas.
- `src/lib/hooks/usePermissoes.ts`: carrega permissoes para o Sidebar via `/api/me/permissoes`.
- `src/app/api/me/permissoes/route.ts`: retorna modulos permitidos, perfil atual e janelas para a UI.
- `src/components/Sidebar.tsx`: renderiza menu a partir de `NAVIGATION_GROUPS` e `chavesPermitidas`.
- `src/app/superadmin/page.tsx`: wrapper da area Superadmin, permitindo `tab=usuarios` via `superadmin_usuarios` e mantendo `perfis`/`auditoria` superadmin-only.
- `src/app/superadmin/PageClient.tsx`: tela de usuarios, perfis, unidades e auditoria.
- `src/app/superadmin/_components/PerfilEditor.tsx`: editor de permissoes por perfil e janelas.

### APIs administrativas de usuarios

- `src/app/api/superadmin/usuarios/route.ts`: lista usuarios com perfil e unidades.
- `src/app/api/superadmin/unidades/route.ts`: lista unidades ativas.
- `src/app/api/superadmin/usuarios/[id]/unidades/route.ts`: altera vinculos usuario-unidade.
- `src/app/api/superadmin/usuarios/[id]/perfil/route.ts`: atribui/remove perfil.
- `src/app/api/superadmin/perfis/route.ts`: lista perfis.
- `src/app/api/superadmin/perfis/[id]/permissoes/route.ts`: le/salva permissoes por perfil.
- `src/lib/auth/superadmin-users-access.ts`: gate especifico para area Usuarios via `superadmin_usuarios`.

### Inteligencia Comercial e SGI

- `src/app/api/sgi/vendas/route.ts`: lista vendas, filtra por telefone, cliente, filial, vendedor e numero de lancamento.
- `src/app/api/sgi/vendas/[numero_lancamento]/route.ts`: detalhe da venda e historico do cliente por telefone.
- `src/types/sgi.ts`: tipos usados por vendas, contatos, produtos e pagamentos.
- `src/lib/digisac/sgi-sync.ts`: normalizacao atual de telefone, variacoes para Digisac, tickets e vinculos venda-conversa.
- `src/components/inteligencia-comercial/TabelaVendas.tsx`: usa `numero_lancamento`, cliente, filial, vendedor e departamentos.
- `src/components/inteligencia-comercial/ModalDetalheVenda.tsx`: exibe contatos, historico e chamados.

### Infraestrutura e padroes

- `vercel.json`: crons existentes.
- `src/app/api/cron/auto-logout/route.ts`: cron de auto-logout.
- `src/app/api/cron/digisac-finalizacoes-automaticas/route.ts`: cron Digisac.
- `src/components/ui/*`: componentes Radix/Tailwind existentes.
- `src/app/layout.tsx`: `Toaster` do `sonner`.
- `supabase/migrations/*`: padrao de migrations idempotentes.

## Fluxo atual confirmado

### Autenticacao

O login usa Supabase Auth. O middleware chama `supabase.auth.getUser()`, consulta `usuarios_permitidos` por email e bloqueia usuarios ausentes ou inativos. Rotas `/api/*` nao dependem do middleware; cada API precisa validar sessao.

APIs internas usam `requireAuthenticatedUser()` quando protegidas. Para dados de permissao e administracao, o padrao atual usa `createServiceClient()` no servidor.

### Permissoes

O modelo atual e:
1. `usuarios_permitidos.role = 'superadmin'` tem acesso total.
2. Usuario comum precisa estar ativo e ter modulo liberado.
3. Modulo fica em `app_modulos`.
4. Excecao individual fica em `app_permissoes_usuario`.
5. Perfil do usuario fica em `app_usuarios_perfis`.
6. Permissao do perfil fica em `app_permissoes_perfil`.
7. Ausencia de linha de permissao equivale a bloqueado.
8. Horario e validado por `app_janelas_acesso_perfil`.

Para nova tela interna, o padrao confirmado e: adicionar catalogo em `src/lib/auth/modulos-app.ts`, criar migration idempotente de `app_modulos`, proteger pagina com `checkModuleAndWindowAccess(moduleKey)`, proteger APIs com `requireModuleAccess(moduleKey)` e liberar manualmente em Superadmin > Perfis.

### Tela de usuarios, roles, perfis e unidades

`/superadmin?tab=usuarios` lista usuarios de `usuarios_permitidos`, perfil de `app_usuarios_perfis` e unidades de `app_usuarios_unidades`/`app_unidades`.

Roles confirmadas no codigo/banco: `user` e `superadmin`.

Perfis confirmados por migration/codigo:
- `consultora`
- `supervisora_loja`
- `pos_venda`
- `recebimento` (desativado por migration)
- `gestao`

Unidades confirmadas por migration/codigo:
- `bigorrilho` / `BIGORRILHO`
- `portao` / `PORTAO`
- `marechal` / `MARECHAL`
- `feira` / `FEIRA`
- `pos_venda` / `POS VENDA`

MCP confirmou em 2026-07-15 que `app_unidades` possui 5 linhas e `app_usuarios_unidades` possui 5 vinculos. Portanto a estrutura existe e ja ha vinculos reais iniciados pelo sistema atual.

### Usuarios com mais de uma filial

O modelo permite varios vinculos por usuario em `app_usuarios_unidades` com unique `(usuario_id, unidade_id)`.

Nao foi encontrado helper de negocio pronto para "filial ativa atual" da sessao. Para a Ficha, a filial deve ser derivada das unidades vinculadas:
- 0 unidades: bloquear criacao e orientar configuracao administrativa;
- 1 unidade: preencher automaticamente;
- 2+ unidades: selecionar no atendimento atual.

### Inteligencia Comercial

O numero de lancamento esta em `sgi_documentos_saida.numero_lancamento`, com indice unique confirmado por MCP.

Telefones do SGI ficam em:
- `sgi_documentos_saida.telefone_principal`
- `sgi_documentos_saida.telefone_normalizado`
- `sgi_documentos_saida_contatos.telefone_original`
- `sgi_documentos_saida_contatos.telefone_normalizado`
- `sgi_documentos_saida_contatos.telefone_normalizado_ddi`

A tela comercial relaciona cliente por telefone usando variacoes em `gerarVariacoesTelefone()`. Existe tambem `inteligencia_comercial_clientes`, mas ela e uma estrutura especifica da IA/comercial, com `telefone_normalizado`, `telefone_normalizado_ddi`, `cliente_nome`, origem e confianca. Nao deve ser reutilizada diretamente como tabela principal da Ficha sem decisao explicita, porque o contrato funcional pede cadastro proprio de cliente presencial.

## Validacao no MCP do Supabase

Projeto consultado: `phsoawbdvhurroryfnok`.

### Tabelas confirmadas

- `usuarios_permitidos`: RLS enabled, 11 linhas.
- `app_modulos`: RLS enabled, 16 linhas.
- `app_perfis_acesso`: RLS enabled, 5 linhas.
- `app_usuarios_perfis`: RLS enabled, 9 linhas.
- `app_permissoes_perfil`: RLS enabled, 39 linhas.
- `app_permissoes_usuario`: RLS enabled, 0 linhas.
- `app_janelas_acesso_perfil`: RLS enabled, 15 linhas.
- `app_janelas_acesso_usuario`: RLS enabled, 0 linhas.
- `app_auditoria_permissoes`: RLS enabled, 20 linhas.
- `app_unidades`: RLS enabled, 5 linhas.
- `app_usuarios_unidades`: RLS enabled, 5 vinculos confirmados em 2026-07-15.
- `sgi_documentos_saida`: RLS enabled, 1311 linhas.
- `sgi_documentos_saida_contatos`: RLS enabled, 2272 linhas.
- `sgi_documentos_saida_produtos`: RLS enabled, 6184 linhas.
- `digisac_conversas_resumo`: RLS enabled, 707 linhas.
- `venda_conversa_vinculos`: RLS enabled, 760 linhas.
- `inteligencia_comercial_clientes`: RLS enabled, 7 linhas.

### Colunas principais confirmadas

Permissoes:
- `usuarios_permitidos`: `id`, `email`, `role`, `ativo`, convite e timestamps.
- `app_modulos`: `id`, `chave`, `nome`, `descricao`, `rota_base`, `categoria`, `publico`, `somente_superadmin`, `ativo`, `ordem`, timestamps.
- `app_perfis_acesso`: `id`, `chave`, `nome`, `descricao`, `ativo`, `sistema`, `ordem`, timestamps.
- `app_usuarios_perfis`: `usuario_id`, `perfil_id`, `atribuido_por`.
- `app_permissoes_perfil`: `perfil_id`, `modulo_id`, `permitido`.
- `app_permissoes_usuario`: `usuario_id`, `modulo_id`, `permitido`, `concedido_por`, `motivo`.
- `app_unidades`: `id`, `chave`, `nome`, `ativo`, `ordem`.
- `app_usuarios_unidades`: `usuario_id`, `unidade_id`, `atribuido_por`.

SGI/Comercial:
- `sgi_documentos_saida`: `numero_lancamento`, `cliente`, `telefone_principal`, `telefone_normalizado`, `filial`, `vendedor`, `status`, `data_fechamento`, valores, departamentos.
- `sgi_documentos_saida_contatos`: `numero_lancamento`, `telefone_original`, `telefone_normalizado`, `telefone_normalizado_ddi`, `principal`.
- `sgi_documentos_saida_produtos`: `numero_lancamento`, `codigo`, `produto`, `quantidade`, `valor_total`, `departamento_classificado`, `subgrupo_classificado`.
- `inteligencia_comercial_clientes`: `telefone_normalizado`, `telefone_normalizado_ddi`, `cliente_nome`, `nome_bebe`, `previsao_nascimento_bebe`, `origem_dado`, `numero_lancamento_origem`, `digisac_ticket_id_origem`, `confianca_dado`.

### Constraints e relacionamentos confirmados

- `usuarios_permitidos.email` unique.
- `usuarios_permitidos.role` tem check constraint.
- `app_modulos.chave` unique.
- `app_perfis_acesso.chave` unique.
- `app_usuarios_perfis.usuario_id` unique.
- `app_permissoes_perfil` unique `(perfil_id, modulo_id)`.
- `app_permissoes_usuario` unique `(usuario_id, modulo_id)`.
- `app_janelas_acesso_perfil` unique `(perfil_id, tipo)`.
- `app_unidades.chave` unique.
- `app_usuarios_unidades` unique `(usuario_id, unidade_id)`.
- `sgi_documentos_saida.numero_lancamento` unique.
- `inteligencia_comercial_clientes.telefone_normalizado_ddi` unique parcial quando nao nulo.
- `venda_conversa_vinculos` unique `(numero_lancamento, digisac_ticket_id)`.

### Indices confirmados

Foram confirmados indices por `pg_indexes`, incluindo:
- indices de `app_*` em chaves, usuario, perfil, modulo, unidade e created_at de auditoria;
- indices SGI em `numero_lancamento`, `telefone_normalizado`, `telefone_normalizado_ddi`, `filial`, `vendedor`, `status`, `data_fechamento`;
- indice parcial unique de `inteligencia_comercial_clientes.telefone_normalizado_ddi`.

### Functions e triggers confirmados

Functions:
- `is_superadmin()` security definer.
- `is_own_record(record_email text)` security definer.
- `is_comercial_user()` security definer.
- `update_updated_at_column()` trigger.
- `validar_superadmin_ativo()` trigger.

Triggers:
- `updated_at` em tabelas `app_*` principais e `usuarios_permitidos`.
- `trigger_validar_superadmin_ativo` em `usuarios_permitidos` para UPDATE/DELETE.

### Policies RLS confirmadas

`usuarios_permitidos`:
- SELECT: `is_superadmin() OR is_own_record(email)`.
- INSERT/UPDATE/DELETE: `is_superadmin()`.

SGI/Comercial:
- `sgi_documentos_saida`, contatos e produtos: select por `is_comercial_user()`; escrita majoritariamente por `is_superadmin()`.
- `digisac_conversas_resumo` e `venda_conversa_vinculos`: select por `is_comercial_user()`, escrita superadmin.
- `inteligencia_comercial_clientes`: policies para `authenticated` usando `is_comercial_user()`.

`app_*`:
- MCP confirmou RLS enabled, mas `pg_policies` retornou zero policies para tabelas `app_%`.
- O acesso atual acontece via service role em rotas server-side protegidas.

### Nao confirmado no MCP

Algumas consultas de dados detalhados de valores reais retornaram erro interno do MCP apos consultas estruturais. Valores de perfis/unidades foram confirmados por migrations e codigo, e contagens foram confirmadas pela listagem de tabelas.

## Diagnostico

### Reutilizavel

- Sistema de login e usuario permitido.
- Catalogo de modulos em `app_modulos` + `src/lib/auth/modulos-app.ts`.
- Liberação de tela por perfil/usuario.
- Janela de horario por perfil.
- Tela administrativa de usuarios.
- Vinculo usuario-unidade ja modelado.
- Service role server-side para camada administrativa.
- Padrao Server Component wrapper + `PageClient`.
- `sonner`, Radix, Tailwind, lucide-react.
- Vercel Cron ja existe e pode hospedar limpeza de rascunhos.
- SGI/Inteligencia Comercial pode ser relacionado futuramente por telefone e numero de lancamento.

### Precisa ser criado

- Tres modulos novos no catalogo e no banco: sugestao `atendimento_presencial_ficha`, `atendimento_presencial_registros`, `atendimento_presencial_clientes`.
- Tabelas proprias para clientes presenciais, criancas, atendimentos, departamentos, produtos livres, motivos, fechamentos e historico.
- Helper central de telefone para a Ficha, com contrato claro e testes.
- APIs protegidas por modulo.
- Cache local/rascunho e reconciliacao.
- Rotina de limpeza de rascunhos vencidos.
- Auditoria de alteracoes do modulo.
- Regras de concorrencia/idempotencia.

## Pontos nao confirmados

- Nao confirmado no codigo: helper existente que resolva "filial ativa" por usuario para uso operacional.
- Confirmado no banco em 2026-07-15: `app_usuarios_unidades` possui 5 vinculos, sem inconsistencias de FK/ativo na consulta realizada.
- Nao confirmado: mapeamento entre `app_unidades` e valores textuais de `sgi_documentos_saida.filial`.
- Nao confirmado: tabela existente adequada para cliente presencial; `inteligencia_comercial_clientes` parece especifica de IA/comercial, nao cadastro operacional.
- Nao confirmado: regra final se um atendimento pode ter varios fechamentos.
- Nao confirmado: regra final se um lancamento pode vincular mais de um atendimento.
- Nao confirmado: quem pode editar/excluir fechamento salvo.
- Nao confirmado: se a Ficha devera consultar vendas SGI em tempo real na primeira versao.

## Arquitetura proposta

### Frontend

Criar paginas:
- `/atendimento-presencial/ficha`
- `/atendimento-presencial/registros`
- `/atendimento-presencial/clientes`

Padrao:
- `page.tsx` server wrapper com `checkModuleAndWindowAccess`.
- `PageClient.tsx` para interacao.
- Ficha mobile-first em etapas curtas, com botao principal fixo, progresso e selecao por cards.
- Registros e Clientes com experiencia desktop responsiva, filtros e tabelas/listas.

Componentes propostos:
- `UnidadeAtendimentoSelector`
- `ConsultoraResponsavelSelector`
- `ClienteSearchPanel`
- `ClienteForm`
- `CriancaCard`
- `DepartamentoCards`
- `ProdutosTagsInput`
- `MotivosSelector`
- `ResultadoAtendimentoStep`
- `DraftStatusBar`
- `AtendimentoReview`
- `FechamentoForm`
- `HistoricoAlteracoesTimeline`
- `RegistrosFilters`
- `ClientesFilters`

### Backend/API

APIs internas sob sugestao:
- `src/app/api/atendimento-presencial/clientes/route.ts`
- `src/app/api/atendimento-presencial/clientes/[id]/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/fechamentos/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/historico/route.ts`
- `src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.ts`

Cada API deve usar `requireModuleAccess()` com o modulo correto, alem de validar usuario ativo, unidade permitida e perfil.

### Banco

Criar migrations novas, nao alterar migrations antigas. RLS desde a criacao. Usar constraints para telefone normalizado, lancamento, status, versao e unicidade.

### Permissoes

Adicionar modulos no catalogo e liberar manualmente por perfil:
- Ficha de Atendimento
- Registros de Atendimentos
- Clientes

As permissoes de acao fina (selecionar consultora, editar depois de 3 dias, incluir fechamento) devem ser aplicadas no backend por perfil/role/unidade, nao apenas por UI.

### Cache local e rascunhos

Proposta:
- usar `localStorage` ou IndexedDB para cache local;
- usar tabela de atendimento com `status = 'rascunho'` no banco quando houver dados minimos;
- usar `draft_client_id` gerado no navegador e salvo no banco para idempotencia;
- sincronizar por `version`/`updated_at`;
- cache local nunca deve sobrescrever banco mais novo sem alerta de conflito.

Preferencia tecnica para a Ficha:
- `localStorage` para payload pequeno inicial e recuperacao rapida;
- avaliar IndexedDB apenas se anexos, volume alto ou payloads grandes entrarem no escopo.

Riscos:
- `localStorage`: simples, mas limitado e sincronizacao manual.
- IndexedDB: melhor para offline robusto, mas mais complexa e sem dependencia atual dedicada.
- somente banco: perde protecao contra queda de internet/fechamento antes do primeiro save.

### Expiracao de rascunhos

O projeto ja usa Vercel Cron em `vercel.json`. Proposta inicial: criar cron diario para excluir rascunhos vencidos no backend com bearer `CRON_SECRET`, reaproveitando padrao dos crons atuais. A limpeza nao deve depender de abertura da tela.

### Historico

Proposta hibrida:
- aplicacao registra contexto rico: usuario, perfil, origem, motivo, acao;
- triggers podem proteger `updated_at` e, se necessario, auditoria basica contra alteracoes fora da API;
- historico deve armazenar entidade, entidade_id, campo, antes, depois, usuario, role/perfil, origem e timestamps.

### Fechamentos

Fechamento posterior deve ser entidade separada. Inclusao de fechamento nao altera o resultado original do atendimento.

Primeira versao manual:
- localizar cliente/atendimento por telefone;
- clicar `Incluir fechamento`;
- informar filial, data, consultora, canal, lancamento e observacoes.

## Modelo conceitual dos dados

Nomes finais dependem de aprovacao e migration futura. Sugestao inicial:

- `atendimento_presencial_clientes`
  - id, nome, telefone_informado, telefone_normalizado, telefone_normalizado_ddi, parentesco, status, version, timestamps.
- `atendimento_presencial_criancas`
  - id, cliente_id, nome, sexo, situacao, data_prevista_nascimento, idade_valor, idade_unidade, timestamps.
- `atendimento_presencial_atendimentos`
  - id, cliente_id, consultora_usuario_id, unidade_id, iniciado_em, concluido_em, status, resultado, observacoes, lancamento_imediato, criado_por, atualizado_por, expira_em, version, timestamps.
- `atendimento_presencial_departamentos`
  - atendimento_id, departamento.
- `atendimento_presencial_produtos_interesse`
  - atendimento_id, descricao, ordem.
- `atendimento_presencial_motivos`
  - atendimento_id, motivo, complemento.
- `atendimento_presencial_fechamentos`
  - id, atendimento_id, cliente_id, unidade_id, consultora_usuario_id, canal, data_fechamento, numero_lancamento, observacoes, criado_por, atualizado_por, version, timestamps.
- `atendimento_presencial_historico`
  - id, entidade, entidade_id, campo, valor_anterior, valor_novo, ator_usuario_id, perfil_chave, role, origem, created_at.

Relacionamentos:
- cliente 1:N criancas.
- cliente 1:N atendimentos.
- atendimento 1:N departamentos/produtos/motivos.
- atendimento 0:N fechamentos, decisao pendente se limitar a 1.
- fechamento pode referenciar `sgi_documentos_saida.numero_lancamento` no futuro, mas nao deve depender de FK imediata se SGI pode estar atrasado.

## Matriz de permissoes proposta

Baseada na logica existente, ainda pendente de aprovacao de negocio.

| Acao | Consultora | Supervisora loja | Gestao | Superadmin | Sem acesso |
|---|---:|---:|---:|---:|---:|
| Ver Ficha | depende modulo | depende modulo | depende modulo | sim | nao |
| Criar atendimento | propria unidade | unidades permitidas | unidades permitidas | sim | nao |
| Selecionar consultora | nao | sim, nas unidades permitidas | sim | sim | nao |
| Selecionar filial | se tiver 2+ unidades | sim | sim | sim | nao |
| Ver proprios atendimentos | sim | sim | sim | sim | nao |
| Ver outras consultoras | nao, salvo decisao | sim na unidade | sim | sim | nao |
| Editar em 3 dias | proprios | unidade permitida | sim | sim | nao |
| Editar depois de 3 dias | nao | sim, se aprovado | sim | sim | nao |
| Incluir fechamento | proprios ou por decisao | sim | sim | sim | nao |
| Editar fechamento | pendente | pendente | pendente | sim | nao |
| Historico de alteracoes | proprio/resumido pendente | sim | sim | sim | nao |

Decisao importante: a matriz final nao deve ser codificada ate confirmar se `Gestao` usa apenas permissoes de modulo existentes ou regras especiais de acao.

## Harness de validacao

### Banco

- criar cliente com telefone;
- criar cliente sem telefone;
- normalizar telefone;
- impedir duplicidade por telefone normalizado quando aplicavel;
- permitir cliente sem telefone sem unique falso;
- vincular atendimento por telefone existente;
- criar atendimento rascunho;
- expirar rascunho;
- criar varias criancas;
- criar varios departamentos;
- criar produtos livres;
- exigir motivos na conclusao;
- fechamento imediato com lancamento;
- fechamento posterior;
- historico de alteracoes;
- RLS por usuario/perfil/unidade;
- constraints de lancamento entre 1 e 999999;
- concorrencia em cliente por telefone.

### API

- 401 sem sessao;
- 403 sem modulo;
- usuario sem perfil;
- usuario fora da janela;
- consultora alterando consultora responsavel;
- consultora acessando unidade nao vinculada;
- supervisora escolhendo consultora/unidade permitida;
- lancamento invalido, zero, maior que 999999 e alfanumerico;
- conclusao sem motivo;
- venda sem lancamento;
- editar dentro e depois de 3 dias;
- incluir fechamento posterior;
- criar fechamento duplicado por duplo clique;
- conflito de versao;
- rascunho expirado.

### Frontend

- celular pequeno;
- celular comum;
- orientacao vertical;
- teclado aberto;
- desktop;
- perda de conexao;
- refresh;
- fechamento do navegador;
- recuperacao do cache;
- recuperacao do rascunho banco;
- conflito cache x banco;
- campos obrigatorios;
- multiplas criancas;
- selecao por botoes/cards;
- produtos com Enter;
- rascunho destacado;
- tabelas/filtros de Registros e Clientes.

### Permissoes e RLS

- superadmin em qualquer horario;
- perfil autorizado dentro da janela;
- perfil autorizado fora da janela;
- perfil nao autorizado;
- usuario sem perfil;
- acesso direto por URL;
- chamada direta de API sem permissao;
- tentativa de acessar unidade de outro usuario;
- tentativa de ler/editar atendimento fora do escopo.

## Plano tecnico por fases

### Fase 0 - Auditoria, arquitetura e harness

- Objetivo: documentar arquitetura e plano.
- Arquivos: docs apenas.
- Banco: nenhuma migration.
- Riscos: decisoes de negocio ainda pendentes.
- Testes: leitura de codigo e MCP.
- Aceite: documento de progresso e log atualizados.
- Rollback: remover documentos criados nesta fase.

### Fase 1 - Base de permissoes e navegacao

- Objetivo: cadastrar tres telas no catalogo/menu e banco, sem funcionalidade ampla.
- Arquivos previstos: `src/lib/auth/modulos-app.ts`, teste do catalogo, pages wrapper, migration de `app_modulos`.
- Banco: inserts idempotentes em `app_modulos`.
- Riscos: liberar modulo sem APIs protegidas.
- Testes: `modulos-app.test.ts`, acesso direto, perfil autorizado/nao autorizado.
- Aceite: telas placeholder protegidas e visiveis na matriz de Perfis.
- Rollback: migration inversa de desativacao dos modulos novos.

### Fase 2 - Estrutura de cliente e telefone

- Objetivo: criar cadastro base de cliente e helper de telefone.
- Arquivos previstos: lib de telefone, APIs de clientes, tests.
- Banco: tabela clientes, indices e RLS.
- Riscos: duplicidade por telefone compartilhado.
- Testes: unitarios de telefone, API e RLS.
- Aceite: busca/criacao de cliente sem Ficha completa.
- Rollback: desativar modulo/API ou migration reversa planejada.

### Fase 3 - Atendimento basico e rascunho

- Objetivo: criar atendimento com status rascunho/concluido e autosave minimo.
- Banco: atendimentos com `expira_em`, `version`, `status`.
- Riscos: duplicidade por refresh/offline.
- Testes: idempotencia, versionamento, rascunho expirado.
- Aceite: criar/continuar rascunho autenticado.
- Rollback: bloquear APIs e manter dados sem exclusao destrutiva.

### Fase 4 - Ficha mobile

- Objetivo: fluxo mobile-first de etapas.
- Banco: sem novas tabelas amplas, se Fase 3 cobrir payload basico.
- Riscos: UI complexa demais para celular.
- Testes: mobile/desktop, teclado, refresh, offline.
- Aceite: consultora completa atendimento simples.
- Rollback: ocultar modulo no perfil.

### Fase 5 - Criancas, departamentos, produtos e motivos

- Objetivo: persistir estruturas complementares.
- Banco: tabelas filhas.
- Riscos: payload parcial inconsistente.
- Testes: multiplas criancas, tags, motivos obrigatorios.
- Aceite: atendimento completo com itens filhos.
- Rollback: manter tabelas, desativar UI/API.

### Fase 6 - Conclusao, lancamento, edicao e auditoria

- Objetivo: validar conclusao, prazo de 3 dias, historico.
- Banco: historico e constraints de lancamento.
- Riscos: edicao sem historico.
- Testes: prazo, perfil, unidade, auditoria.
- Aceite: alteracoes auditaveis.
- Rollback: bloquear edicao e manter leitura.

### Fase 7 - Registros e Clientes

- Objetivo: consulta, filtros, pagina cliente.
- Banco: indices de filtros, se necessario.
- Riscos: queries lentas.
- Testes: filtros, paginacao, permissao por unidade.
- Aceite: listagens responsivas e filtraveis.
- Rollback: ocultar telas.

### Fase 8 - Fechamentos posteriores

- Objetivo: entidade de fechamento manual.
- Banco: `atendimento_presencial_fechamentos`.
- Riscos: lancamento duplicado/relacao ambigua.
- Testes: idempotencia, duplicidade, permissao, historico.
- Aceite: `Incluir fechamento` sem alterar resultado original.
- Rollback: desabilitar botao/API, preservar registros.

### Fase 9 - Indicadores e integracoes futuras

- Objetivo: indicadores e preparacao Digisac/SGI.
- Banco: views/consultas, se aprovadas.
- Riscos: conclusoes comerciais incorretas.
- Testes: casos reais, comparacao SGI.
- Aceite: relatorios validados.
- Rollback: ocultar indicadores.

## Primeira fase recomendada

Fase 1: criar somente a base de permissoes e navegacao para as tres telas, com paginas placeholder protegidas.

Motivo: e a menor entrega segura, reaproveita o sistema atual e permite validar liberacao por perfil antes de modelar dados sensiveis.

## O que nao sera alterado nesta fase

- Nenhum codigo funcional.
- Nenhuma migration criada.
- Nenhuma tabela alterada.
- Nenhuma regra de autenticacao.
- Nenhuma regra de permissoes existente.
- Nenhuma regra de unidades existente.
- Nenhum fluxo de Inteligencia Comercial.
- Nenhuma integracao Digisac automatica.
- Nenhuma regra de SGI.
- Nenhum layout existente.

## Pendencias de decisao

1. Popular `app_usuarios_unidades` para os usuarios reais antes de usar a Ficha?
2. Mapeamento oficial entre `app_unidades` e nomes de filial do SGI.
3. Um atendimento pode ter mais de um fechamento?
4. Um numero de lancamento pode estar em mais de um atendimento?
5. Quem pode incluir fechamento em atendimento de outra consultora?
6. Quem pode editar ou cancelar fechamento salvo?
7. Cliente pode ter mais de um telefone na primeira versao?
8. Telefones compartilhados entre familiares devem ser permitidos?
9. `Gestao` tera regras especiais de acao ou apenas modulos liberados?
10. Qual texto/chave final dos tres novos modulos.

## Riscos

- `app_usuarios_unidades` ja possui vinculos iniciados; a cobertura completa por usuario/perfil ainda precisa ser validada antes da Ficha operacional.
- Tabelas `app_*` estao sem policies e dependem de service role server-side; novas tabelas da Ficha devem nascer com RLS propria.
- Telefone como identificador de negocio pode colidir em telefone compartilhado.
- Corrigir nono digito automaticamente pode vincular cliente errada; nao fazer sem regra aprovada.
- Fechamento posterior precisa ser separado para nao distorcer resultado original.
- Logs nao podem conter telefone completo, observacoes, tokens ou dados pessoais.

## Validacoes realizadas

- Leitura do documento funcional.
- Leitura de regras `.devin`.
- Leitura de `docs/ia/log_progress.md`.
- Leitura de `docs/ia/padrao-novas-telas-permissoes.md`.
- Leitura dos arquivos de autenticacao, permissoes, usuarios, unidades, Sidebar e SGI listados acima.
- MCP Supabase `_list_tables` em schema `public`.
- MCP Supabase `_execute_sql` para colunas, constraints, indices, policies, functions e triggers.

## Comandos executados e resultados

- `rg` para localizar Ficha/atendimento presencial: encontrou apenas documento funcional e referencias gerais em IA/Inteligencia Comercial.
- `rg` para autenticao/permissoes/unidades/filiais/modulos: localizou fluxo atual em `src/lib/auth`, `src/app/superadmin`, `src/components/Sidebar.tsx`, SGI e migrations.
- `Get-Content` nos arquivos listados: leitura concluida.
- `git status --short`: antes das edicoes, havia `docs/PLANO FUNCIONAL ATUALIZADO - FICHA DE ATENDIMENTO PRESENCIAL.md` como untracked.
- MCP `_list_tables`: confirmou tabelas e contagens.
- MCP `_execute_sql`: confirmou estrutura, constraints, indices, policies, functions e triggers.
- Algumas consultas de dados detalhados do MCP retornaram erro interno; valores foram complementados por migrations/codigo e marcados quando nao confirmados por MCP.

## Andamento

Fase 0 concluida nesta etapa com auditoria e plano tecnico. Implementacao aguardando aprovacao da primeira fase.

## Pendencias

- Decisoes listadas acima.
- Validacao autenticada em browser nao realizada.
- Nenhum teste automatizado rodado, pois nao houve codigo funcional.

## Proximo passo recomendado

Aprovar Fase 1 com nomes finais de moduleKey/rotas. Depois implementar somente placeholders protegidos e catalogo/migration de modulos, sem criar schema de atendimento ainda.

## Fase 1 - Base de permissoes e navegacao (2026-07-15)

Status: implementada localmente.

### Escopo entregue

- Tres modulos cadastrados no catalogo central `src/lib/auth/modulos-app.ts`.
- Novo grupo de menu `ATENDIMENTO PRESENCIAL`.
- Tres paginas placeholder protegidas por `checkModuleAndWindowAccess`.
- Migration idempotente criada apenas para `public.app_modulos`.
- Testes do catalogo/permissoes/migrations atualizados.
- Nenhuma API operacional de atendimento presencial criada.
- Nenhuma tabela operacional de clientes, criancas, atendimentos, rascunhos, produtos, motivos ou fechamentos criada.

### Chaves, nomes e rotas

| Chave | Nome | Rota |
|---|---|---|
| `atendimento_presencial_ficha` | `Ficha de Atendimento` | `/atendimento-presencial/ficha` |
| `atendimento_presencial_registros` | `Registros de Atendimentos` | `/atendimento-presencial/registros` |
| `atendimento_presencial_clientes` | `Clientes` | `/atendimento-presencial/clientes` |

Categoria logica no banco/catalogo: `atendimento_presencial`.

### Decisoes tecnicas

- Os modulos usam `access = 'profile'`, `publico = false`, `somenteSuperadmin = false`, `ativo = true`.
- As ordens escolhidas foram `61`, `62` e `63`, entre `FINALIZACOES DIGISAC` (`60`) e `PROCURAR DATAS` (`70`).
- O Sidebar continua consumindo `NAVIGATION_GROUPS`; apenas o estado inicial do novo grupo foi adicionado em `Sidebar.tsx`.
- As paginas novas declaram `dynamic = 'force-dynamic'` porque o guard usa cookies no servidor.
- As tres chaves foram adicionadas a `MODULE_KEYS_WITHOUT_AUTOMATIC_PROFILE_GRANT` para impedir concessao automatica em migrations.

### Arquivos criados

- `src/app/atendimento-presencial/ficha/page.tsx`
- `src/app/atendimento-presencial/registros/page.tsx`
- `src/app/atendimento-presencial/clientes/page.tsx`
- `supabase/migrations/20260715160000_add_atendimento_presencial_modules.sql`

### Arquivos alterados

- `src/lib/auth/modulos-app.ts`
- `src/lib/auth/modulos-app.test.ts`
- `src/components/Sidebar.tsx`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Migration

Migration: `supabase/migrations/20260715160000_add_atendimento_presencial_modules.sql`.

Conteudo: `INSERT INTO public.app_modulos (...) VALUES (...) ON CONFLICT (chave) DO UPDATE ...`.

Nao altera migrations antigas, nao cria tabelas operacionais, nao remove modulos existentes e nao insere linhas em `app_permissoes_perfil`.

### Validacoes realizadas

- MCP Supabase `_execute_sql`: confirmou colunas reais de `public.app_modulos`.
- MCP Supabase `_execute_sql`: confirmou que as tres chaves/rotas ainda nao existiam no banco consultado antes da migration.
- Leitura das migrations recentes confirmou o padrao idempotente de catalogo.
- Leitura de `Sidebar.tsx`, `module-access.ts`, paginas wrapper existentes e teste `modulos-app.test.ts`.

### Comandos e resultados

- `npm run test -- src/lib/auth/modulos-app.test.ts`: passou, 1 arquivo e 17 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/lib/auth/modulos-app.ts src/lib/auth/modulos-app.test.ts src/components/Sidebar.tsx src/app/atendimento-presencial/ficha/page.tsx src/app/atendimento-presencial/registros/page.tsx src/app/atendimento-presencial/clientes/page.tsx`: passou.
- `npm run build`: primeira tentativa falhou com `EPERM` ao remover artefato em `.next`; repetido fora do sandbox, passou.
- `git diff --check`: passou, com avisos de CRLF no checkout.

### Pendencias

- Aplicar a migration no ambiente correto pelo fluxo aprovado.
- Validar manualmente com usuarios reais/perfis reais apos aplicar a migration.
- Testar fora da janela de horario em ambiente apropriado.
- Popular/validar `app_usuarios_unidades` permanece pendencia para fases futuras; nao foi alterado nesta fase.

### Riscos conhecidos

- Enquanto a migration nao for aplicada, as paginas existem no codigo mas usuarios comuns nao terao linha correspondente em `app_modulos`.
- O build ainda registra `DYNAMIC_SERVER_USAGE` em rotas existentes que usam cookies sem `dynamic = 'force-dynamic'`; isso nao foi alterado nesta fase.
- A exibicao na matriz de Perfis depende do banco atualizado com a migration.

### Rollback

- Remover a migration nova antes de aplicar, ou criar migration reversa removendo apenas as tres chaves se ja aplicada.
- Remover os tres itens de `APP_MODULES`, `NAVIGATION_GROUPS` e `MODULE_KEYS_WITHOUT_AUTOMATIC_PROFILE_GRANT`.
- Remover as tres paginas placeholder.
- Remover os testes especificos adicionados para Atendimento Presencial.

### Proximo passo recomendado

Aplicar a migration em ambiente adequado, liberar manualmente apenas `Ficha de Atendimento` para um perfil de teste e validar o roteiro manual antes de iniciar qualquer modelagem operacional.

## Atualizacao de validacao manual da Fase 1 (2026-07-15)

Status: validada manualmente pelo usuario.

- Tres modulos visiveis para superadmin.
- Tres modulos disponiveis na tela de Perfis.
- Permissoes configuraveis pela estrutura existente.
- Paginas placeholder protegidas.
- Mensagem `Modulo em preparacao` confirmada.
- Grupo `ATENDIMENTO PRESENCIAL` funcionando no Sidebar.

## Fase 2 - Estrutura de clientes presenciais e telefone (2026-07-15)

Status: implementada localmente.

### Escopo entregue

- Tabela propria `public.atendimento_presencial_clientes` em migration local.
- Normalizacao centralizada de telefone em `src/lib/atendimento-presencial/telefone.ts`.
- Criacao e busca de clientes por API protegida.
- Busca por nome e telefone.
- Prevencao de duplicidade por telefone normalizado.
- Interface minima em `/atendimento-presencial/clientes`.
- Testes de helper, migration e API.

### Estado atual de unidades no MCP

- `app_unidades`: 5 registros.
- `app_usuarios_unidades`: 5 vinculos.
- `usuarios_permitidos`: 11 registros.
- `app_usuarios_perfis`: 9 registros.
- `app_perfis_acesso`: 5 registros.
- Vínculos por unidade: `bigorrilho` 2, `portao` 1, `marechal` 1, `feira` 0, `pos_venda` 1.
- Vínculos inconsistentes por FK/ativo na consulta realizada: 0.

### Schema

Tabela: `public.atendimento_presencial_clientes`.

Campos:

- `id`
- `nome`
- `telefone_informado`
- `telefone_normalizado`
- `telefone_normalizado_ddi`
- `parentesco`
- `parentesco_outro`
- `status`
- `version`
- `criado_por`
- `atualizado_por`
- `created_at`
- `updated_at`

FKs:

- `criado_por` -> `public.usuarios_permitidos(id)`
- `atualizado_por` -> `public.usuarios_permitidos(id)`

### Parentesco

Chaves internas sem acento:

- `mae`
- `pai`
- `avo_masculino`
- `avo_feminino`
- `tio`
- `tia`
- `irmao`
- `irma`
- `padrinho`
- `madrinha`
- `amigo`
- `amiga`
- `outro`

Labels amigaveis ficam no TypeScript/UI. `outro` exige complemento entre 2 e 60 caracteres.

### Telefone

- Telefone continua opcional.
- Telefones validos podem ter 10 ou 11 digitos nacionais.
- DDI `55` e aceito e normalizado.
- Nao corrige nono digito automaticamente.
- Nao inventa DDD.
- Retorna telefone nacional e telefone com DDI.

### Duplicidade e concorrencia

- API busca cliente ativa existente antes de inserir.
- Unique parcial `uq_atendimento_presencial_clientes_telefone_ativo` bloqueia duas clientes ativas com o mesmo `telefone_normalizado`.
- Se houver conflito concorrente, a API busca a cliente existente e retorna `clienteExistente: true`.
- Varios clientes sem telefone sao permitidos.

### RLS e acesso

- RLS habilitada em `atendimento_presencial_clientes`.
- `anon` e `authenticated` sem grants diretos.
- Policies explicitas de negacao direta para `authenticated`.
- Acesso funcional ocorre apenas via APIs internas protegidas por `requireModuleAccess('atendimento_presencial_clientes')` e janela de acesso.
- Service role e usado somente no backend, seguindo padrao atual do projeto.

### APIs

- `GET /api/atendimento-presencial/clientes`
- `POST /api/atendimento-presencial/clientes`
- `GET /api/atendimento-presencial/clientes/[id]`

`PATCH` foi adiado porque edicao segura deve considerar concorrencia/auditoria em etapa propria.

### Interface

`/atendimento-presencial/clientes` agora possui:

- busca por nome ou telefone;
- lista simples;
- estado vazio;
- loading;
- erro;
- formulario simples;
- telefone opcional;
- parentesco por botoes;
- complemento para `Outro`;
- feedback para cliente criada;
- feedback para cliente existente localizada.

### Arquivos criados

- `src/lib/atendimento-presencial/telefone.ts`
- `src/lib/atendimento-presencial/clientes.ts`
- `src/lib/atendimento-presencial/api-auth.ts`
- `src/lib/atendimento-presencial/telefone.test.ts`
- `src/lib/atendimento-presencial/migration.test.ts`
- `src/app/api/atendimento-presencial/clientes/route.ts`
- `src/app/api/atendimento-presencial/clientes/route.test.ts`
- `src/app/api/atendimento-presencial/clientes/[id]/route.ts`
- `src/app/api/atendimento-presencial/clientes/[id]/route.test.ts`
- `src/app/atendimento-presencial/clientes/PageClient.tsx`
- `supabase/migrations/20260715170000_create_atendimento_presencial_clientes.sql`

### Arquivos alterados

- `src/app/atendimento-presencial/clientes/page.tsx`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Comandos e resultados

- `supabase migration new create_atendimento_presencial_clientes`: falhou porque a CLI `supabase` nao esta instalada no ambiente.
- `npm run test -- src/lib/atendimento-presencial/telefone.test.ts src/lib/atendimento-presencial/migration.test.ts src/app/api/atendimento-presencial/clientes/route.test.ts src/app/api/atendimento-presencial/clientes/[id]/route.test.ts`: passou, 4 arquivos e 20 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint ...`: passou nos arquivos da Fase 2.
- `npm run build`: primeira tentativa no sandbox falhou com `EPERM` em `.next`; repetido fora do sandbox, passou.
- `git diff --check`: passou, com avisos de CRLF no checkout.

### Validacao MCP

- Fase 1 aplicada em `app_modulos`.
- `atendimento_presencial_clientes` ainda nao existe no banco consultado antes da nova migration.
- Estruturas de usuarios/unidades confirmadas.
- Contagem atual de vinculos de unidades confirmada.
- Inconsistencias de vinculos consultadas: 0.

### Pendencias

- Aplicar a migration da Fase 2 no ambiente correto.
- Validar RLS/policies no banco apos aplicar a migration.
- Validar manualmente com usuario com e sem permissao.
- Testar cadastro e busca no celular real.
- Decidir regra futura para telefone compartilhado.
- Planejar PATCH com concorrencia e auditoria antes de liberar edicao.

### Riscos conhecidos

- Enquanto a migration nao for aplicada, APIs retornarao erro de tabela inexistente no ambiente.
- Busca por nome usa `ilike`; sem `unaccent`, busca pode ser sensivel a acentos conforme comportamento do banco.
- A regra atual assume uma cliente ativa por telefone normalizado; telefone compartilhado fica pendente.
- RLS bloqueia acesso direto e a autorizacao funcional fica concentrada na API protegida.

### Rollback

- Remover a migration da Fase 2 antes de aplicar, se ainda nao aplicada.
- Se aplicada, criar migration reversa para remover policies, trigger, funcao, indices e tabela `atendimento_presencial_clientes`.
- Reverter `/atendimento-presencial/clientes` para placeholder.
- Remover APIs e helpers `src/lib/atendimento-presencial`.

### Proximo passo recomendado

Aplicar a migration em ambiente adequado, validar o harness manual de clientes e, somente depois, iniciar a proxima fase de estrutura da Ficha sem criar rascunhos ou atendimentos antes dessa validacao.

## Ajustes finais da Fase 2 - Mascara e busca flexivel (2026-07-15)

Status: implementado e validado.

- Fase 2 validada manualmente pelo usuario antes desta etapa.
- Migration da Fase 2 aplicada no Supabase antes desta etapa.
- Duplicidade por telefone validada manualmente pelo usuario e preservada no backend.
- Campo de telefone da tela de Clientes agora aplica mascara brasileira progressiva.
- Colagem com telefone formatado e `+55` e aceita, exibindo formato nacional.
- Busca por nome agora separa termos e exige que todos aparecam no nome.
- Busca por telefone agora aceita trecho numerico parcial.
- Criacao de cliente continua usando correspondencia exata de telefone normalizado.

### Validacao intermediaria

- Testes focados da Fase 2: 4 arquivos, 29 testes, passou.
- Typecheck: passou.
- Lint dos arquivos alterados da Fase 2: passou.
- MCP Supabase:
  - `LU`: 1 resultado agregado no banco atual.
  - `Lu Ma`: 1 resultado agregado no banco atual.
  - trecho `8707`: 1 resultado agregado no banco atual.
  - maior quantidade de clientes ativas por telefone normalizado: 1.
- Nenhuma migration adicional foi necessaria para mascara e busca.

## Fase 3 - Estrutura basica de atendimento e rascunhos (2026-07-15)

Status: implementada e aplicada no Supabase.

### Escopo entregue

- Tabela basica `public.atendimento_presencial_atendimentos`.
- Status unico desta fase: `rascunho`.
- Cliente opcional.
- Consultora responsavel obrigatoria.
- Unidade obrigatoria.
- `draft_client_id` idempotente.
- `dados_rascunho jsonb` restrito a payload tecnico permitido.
- Versionamento.
- APIs protegidas.
- Autosave com debounce.
- Cache local em `localStorage`.
- Recuperacao/listagem de rascunhos ativos.
- Expiracao por ultima atividade + 5 dias.
- Cron backend para exclusao fisica de rascunhos vencidos.
- Tela minima em `/atendimento-presencial/ficha`.

### O que nao foi criado

- Ficha completa.
- Criancas estruturadas.
- Departamentos.
- Produtos.
- Motivos.
- Resultado de fechamento.
- Numero de lancamento.
- Fechamento comercial.
- SGI.
- Digisac.
- Inteligencia Comercial.

### Schema

Tabela: `public.atendimento_presencial_atendimentos`.

Campos:

- `id`
- `cliente_id`
- `consultora_usuario_id`
- `unidade_id`
- `status`
- `draft_client_id`
- `dados_rascunho`
- `iniciado_em`
- `ultima_atividade_em`
- `expira_em`
- `version`
- `criado_por`
- `atualizado_por`
- `created_at`
- `updated_at`

FKs:

- `cliente_id` -> `public.atendimento_presencial_clientes(id)`
- `consultora_usuario_id` -> `public.usuarios_permitidos(id)`
- `unidade_id` -> `public.app_unidades(id)`
- `criado_por` -> `public.usuarios_permitidos(id)`
- `atualizado_por` -> `public.usuarios_permitidos(id)`

### RLS

- RLS habilitada.
- `anon` e `authenticated` sem grants diretos.
- Policies explicitas de negacao direta para select, insert, update e delete.
- `service_role` tem acesso operacional.
- Autorizacao funcional fica nas APIs protegidas por modulo, janela, perfil, unidade e propriedade do rascunho.

### Consultoras e unidades

- `consultora`: backend fixa `consultora_usuario_id` como o proprio usuario.
- `consultora`: tentativa de enviar outra consultora e rejeitada.
- `consultora`: unidade deve estar nos vinculos de `app_usuarios_unidades`.
- `supervisora_loja`: pode selecionar consultora, validada contra a unidade escolhida.
- `gestao`: regra mantida restritiva por vinculo de unidade, porque escopo amplo nao esta confirmado no codigo.
- `superadmin`: pode acessar todas as unidades.
- `usuarios_permitidos.id` e usado para consultora, criador e atualizador.

### APIs

- `GET /api/atendimento-presencial/atendimentos/rascunhos`
- `POST /api/atendimento-presencial/atendimentos/rascunhos`
- `GET /api/atendimento-presencial/atendimentos/[id]/rascunho`
- `PATCH /api/atendimento-presencial/atendimentos/[id]/rascunho`
- `GET /api/cron/atendimento-presencial-limpar-rascunhos`

`DELETE` manual nao foi criado, porque descarte manual nao foi aprovado nesta fase.

### Cache local e autosave

- Cache em `localStorage`.
- Chave por usuario e `draft_client_id`.
- Nao armazena tokens, sessao ou secrets.
- Payload atual do cache e apenas `notaTecnica`.
- Autosave com debounce de 900 ms.
- Estados visuais: ocioso, salvando, salvo, sem conexao, conflito e erro.
- Em conflito de versao, a API retorna `409` e nao sobrescreve automaticamente.

### Expiracao e cron

- Marco: cinco dias desde a ultima atividade valida.
- PATCH valido atualiza `ultima_atividade_em` e `expira_em`.
- Rascunho expirado retorna `410`.
- Cron diario adicionado em `vercel.json`: `/api/cron/atendimento-presencial-limpar-rascunhos`.
- Cron protegido por `Authorization: Bearer CRON_SECRET`.
- Cron exclui fisicamente somente `status = 'rascunho'` com `expira_em` vencido.

### Validacao MCP

- `atendimento_presencial_clientes`: existe.
- Clientes atuais no banco consultado: 2.
- `atendimento_presencial_atendimentos`: nao existia antes da Fase 3 e foi criada.
- `app_usuarios_unidades`: 5 vinculos.
- Perfis ativos reais: `consultora`, `supervisora_loja`, `pos_venda`, `gestao`.
- Usuarios ativos com perfil `consultora` no momento da consulta: 0.
- RLS da nova tabela: ativo.
- Policies da nova tabela: negacao direta para authenticated.
- Indices confirmados, incluindo `draft_client_id`, status/expiracao, consultora, unidade, cliente, criado_por e atualizado_por.
- Trigger `trg_atendimento_presencial_atendimentos_touch` confirmado.
- Funcao `atendimento_presencial_atendimentos_touch` confirmada com `search_path=public`.
- Grants confirmados para `service_role`; sem grants para `anon`/`authenticated`.

### Advisors Supabase

- Advisors apontaram problemas antigos fora do escopo em outras tabelas/views/funcoes.
- Advisor apontou dois pontos na nova tabela: FKs `criado_por`/`atualizado_por` sem indice e funcao sem `search_path`.
- Corrigido por migration incremental `20260715181000_harden_atendimento_presencial_atendimentos.sql`.

### Comandos e resultados

- `npm run test -- ...`: passou, 11 arquivos e 54 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint ...`: passou nos arquivos alterados.
- `npm run build`: primeira tentativa no sandbox falhou com `EPERM` em `.next`; repetido fora do sandbox, passou.

### Testes manuais

Roteiro documentado para executar com usuario autenticado:

1. Entrar como consultora com uma unidade.
2. Abrir `/atendimento-presencial/ficha`.
3. Confirmar unidade automatica.
4. Iniciar rascunho.
5. Editar o campo tecnico.
6. Atualizar a pagina.
7. Confirmar recuperacao.
8. Fechar e abrir o navegador.
9. Confirmar recuperacao pelo cache/local + banco.
10. Simular offline.
11. Editar conteudo.
12. Retornar conexao.
13. Confirmar sincronizacao.
14. Abrir duas abas.
15. Criar conflito.
16. Confirmar que versao antiga nao sobrescreve nova.
17. Testar consultora com varias unidades.
18. Testar unidade nao permitida.
19. Testar usuario sem modulo.
20. Testar cron em ambiente seguro.

Validacao manual autenticada desta Fase 3 ainda nao foi executada neste turno.

### Pendencias

- Validar em browser autenticado com perfis reais.
- Criar/atribuir usuario com perfil `consultora` se o ambiente precisar testar o caminho real de consultora.
- Testar cron em ambiente seguro com `CRON_SECRET`.
- Definir se `gestao` deve ter escopo amplo ou continuar restrita por vinculos.
- Definir descarte manual de rascunho, se desejado.

### Riscos conhecidos

- `localStorage` pode ser lido por quem tiver acesso ao navegador; por isso o payload atual foi mantido minimo.
- Busca parcial por telefone usa `LIKE`/`ILIKE` e pode exigir indice trigram se crescer muito.
- Atualmente nao ha usuarios ativos com perfil `consultora` no banco consultado.
- Advisors ainda listam problemas antigos fora do escopo.

### Rollback

- Criar migration reversa para remover cron do `vercel.json` no deploy e dropar policies, trigger, funcao, indices e tabela `atendimento_presencial_atendimentos`.
- Remover APIs de rascunho e cron.
- Reverter `/atendimento-presencial/ficha` para placeholder.
- Remover helpers `rascunhos.ts` e `rascunho-cache.ts`.

### Proximo passo recomendado

Executar validacao manual autenticada da Fase 3 com perfil consultora/supervisora e, somente depois, planejar a Fase 4 da Ficha funcional sem misturar fechamento comercial.
