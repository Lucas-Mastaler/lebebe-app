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

Validacao manual autenticada desta Fase 3 foi executada posteriormente pelo usuario e aprovada antes da Fase 4.

### Validacao manual registrada em 2026-07-15

O usuario confirmou validacao manual bem-sucedida para:

- criacao de rascunho;
- unidade automatica;
- selecao de unidade;
- regras de consultora;
- autosave;
- recuperacao apos refresh;
- recuperacao apos fechar e reabrir;
- cache local;
- sincronizacao apos offline;
- prevencao de conflito entre abas;
- destaque visual de `RASCUNHO`;
- permissoes;
- vinculo com unidades.

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

Fase 3 validada manualmente pelo usuario. Proximo passo: Fase 4 da Ficha funcional sem misturar fechamento comercial.

## Fase 4 - Ficha de Atendimento real em modo rascunho (2026-07-15)

Status: implementada localmente.

### Escopo entregue

- Campo tecnico de teste removido da rota ativa da Ficha.
- `/atendimento-presencial/ficha` agora usa uma ficha real em seis etapas.
- Atendimento continua somente como `status = 'rascunho'`.
- Nenhuma conclusao funcional foi criada.
- Nenhuma migration nova foi criada.
- Nenhuma tabela nova foi criada.
- Dados funcionais da ficha ficam temporariamente em `dados_rascunho` validado.
- `cliente_id` continua como campo proprio de `atendimento_presencial_atendimentos`.

### Etapas da ficha

1. Cliente.
2. Crianca.
3. Interesses.
4. Resultado do atendimento.
5. Observacoes.
6. Revisao.

A interface mostra `Etapa X de 6`, barra de progresso, botoes grandes e acao principal fixa no rodape da ficha quando ha rascunho ativo.

### Schema do rascunho

Arquivo central: `src/lib/atendimento-presencial/ficha-schema.ts`.

Payload permitido:

- `cliente`
- `criancas`
- `departamentos`
- `produtosInteresse`
- `resultadoAtendimento`
- `motivosResultado`
- `motivoOutro`
- `observacoes`
- `etapaAtual`

Chaves desconhecidas sao rejeitadas. `unidadeId`, `consultoraUsuarioId`, `status`, `version` e outros IDs protegidos nao sao aceitos dentro do JSONB.

### Compatibilidade com Fase 3

- Rascunhos antigos com `notaTecnica` nao quebram ao abrir.
- `notaTecnica` e aceita apenas como chave legada de entrada.
- O valor tecnico antigo e ignorado na migracao de payload.
- A interface final nao exibe `notaTecnica`.
- Nao foi criada migration SQL para limpar `notaTecnica`.

### Cliente

- Busca cliente existente por nome ou telefone usando a API ja validada.
- Seleciona cliente existente.
- Cadastra nova cliente dentro da ficha.
- Cadastro reaproveita a API de clientes e a regra de duplicidade por telefone.
- Apos selecionar ou cadastrar, o atendimento e salvo com `cliente_id`.
- Dados completos da cliente nao sao duplicados no JSONB.
- Parentesco continua pertencendo ao cadastro da cliente.

### Criancas

- Permite multiplas criancas.
- Cada crianca usa identificador local estavel.
- Situacoes implementadas: `gestacao`, `ja_nasceu`, `presente_outra_pessoa`, `nao_informado`.
- Gestacao aceita data local `YYYY-MM-DD` sem conversao UTC.
- Crianca ja nascida usa botoes para meses `1..11` e anos `1..6`.
- Nome da crianca e opcional.
- Sexo e opcional.
- Remocao fica disponivel antes de conclusao futura.

### Interesses

- Departamentos com chaves tecnicas estaveis:
  - `p_pesada`
  - `moveis`
  - `p_leve`
  - `enxoval`
  - `decoracao`
  - `roupinhas`
- Selecao multipla por botoes/cartoes.
- Produtos de interesse em tags livres.
- Enter adiciona produto e nao envia o formulario inteiro.
- Item vazio e ignorado.
- Duplicidade identica no rascunho e ignorada.
- Produtos podem ser removidos.

### Resultado e motivos

- Resultado salvo apenas no rascunho: `sim`, `nao`, `negociacao`.
- Motivos agrupados por Produto, Condicao comercial, Prazo e necessidade, Decisao e Outro.
- Motivos sao multisselecao.
- `Outro` exige complemento para avancar.
- Numero do lancamento nao foi implementado.

### Observacoes

- Campo opcional multilinha.
- Preserva quebras de linha.
- Limite de caracteres aplicado no frontend/schema.
- Conteudo nao e registrado em logs.

### Revisao

- Mostra resumo de unidade, consultora, cliente, telefone, parentesco, criancas, departamentos, produtos, resultado, motivos e observacoes.
- Cada bloco possui acao `Editar` para retornar a etapa correspondente.
- `Concluir atendimento` aparece desabilitado.
- Aviso exibido: o numero do lancamento sera solicitado ao concluir a ficha.

### Autosave e cache

- Autosave da Fase 3 foi preservado.
- Cache local permanece separado por usuario e `draft_client_id`.
- Cache agora valida schema ao recuperar.
- Payload invalido no cache e descartado.
- Cache local nao sobrescreve banco mais novo quando a versao local e menor.
- Ao voltar online, a tela tenta sincronizar novamente.
- Estados mantidos: ocioso, salvando, salvo, offline, conflito e erro.

### APIs

Rotas reaproveitadas:

- `GET /api/atendimento-presencial/atendimentos/rascunhos`
- `POST /api/atendimento-presencial/atendimentos/rascunhos`
- `GET /api/atendimento-presencial/atendimentos/[id]/rascunho`
- `PATCH /api/atendimento-presencial/atendimentos/[id]/rascunho`
- APIs existentes de clientes.

Alteracao funcional no `PATCH`: agora aceita `clienteId` fora do JSONB, valida cliente ativa e atualiza `cliente_id` no atendimento com controle de versao.

### Validacao MCP

Consulta MCP Supabase em 2026-07-15 confirmou:

- `public.atendimento_presencial_clientes` existe.
- `public.atendimento_presencial_atendimentos` existe.
- `public.atendimento_presencial_criancas` nao existe.
- `public.atendimento_presencial_departamentos` nao existe.
- `public.atendimento_presencial_produtos_interesse` nao existe.
- `public.atendimento_presencial_motivos` nao existe.
- `public.atendimento_presencial_fechamentos` nao existe.
- Banco atual: 2 clientes, 3 atendimentos/rascunhos, 9 vinculos usuario-unidade.
- Colunas reais de clientes e atendimentos conferidas antes de alterar persistencia.

### Arquivos criados

- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/ficha-schema.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`

### Arquivos alterados

- `src/app/atendimento-presencial/ficha/page.tsx`
- `src/app/atendimento-presencial/ficha/PageClient.tsx`
- `src/lib/atendimento-presencial/rascunhos.ts`
- `src/lib/atendimento-presencial/rascunhos.test.ts`
- `src/lib/atendimento-presencial/rascunho-cache.ts`
- `src/lib/atendimento-presencial/rascunho-cache.test.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Comandos e resultados

- `npm run test -- src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/lib/atendimento-presencial/rascunho-cache.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts`: passou, 5 arquivos e 23 testes.
- `npm run test -- src/lib/atendimento-presencial/telefone.test.ts src/lib/atendimento-presencial/clientes.test.ts src/lib/atendimento-presencial/migration.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/lib/atendimento-presencial/rascunho-cache.test.ts src/lib/atendimento-presencial/rascunhos-migration.test.ts src/app/api/atendimento-presencial/clientes/route.test.ts src/app/api/atendimento-presencial/clientes/[id]/route.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts`: passou, 12 arquivos e 63 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint ...`: passou nos arquivos da Fase 4.
- `npm run build`: primeira tentativa no sandbox falhou com `EPERM` ao remover `.next/app-path-routes-manifest.json`; repetido fora do sandbox, passou.
- `git diff --check`: passou, com avisos de CRLF do checkout.

### Teste manual pendente

Ainda nao executado neste turno:

1. Entrar como consultora.
2. Iniciar novo atendimento.
3. Buscar cliente por nome parcial.
4. Buscar por trecho de telefone.
5. Selecionar cliente.
6. Trocar cliente.
7. Cadastrar cliente nova dentro da ficha.
8. Adicionar uma crianca em gestacao.
9. Adicionar uma crianca ja nascida.
10. Selecionar idade em meses.
11. Selecionar idade em anos.
12. Selecionar varios departamentos.
13. Adicionar produtos usando Enter.
14. Remover produto.
15. Selecionar resultado.
16. Selecionar varios motivos.
17. Testar Outro.
18. Digitar observacoes.
19. Atualizar pagina.
20. Confirmar recuperacao.
21. Fechar e reabrir.
22. Confirmar etapa recuperada.
23. Ficar offline.
24. Alterar dados.
25. Voltar online.
26. Confirmar sincronizacao.
27. Abrir revisao.
28. Editar cada secao.
29. Testar no celular.
30. Confirmar que nao existe conclusao funcional ainda.

### Pendencias

- Fazer validacao manual autenticada no navegador/celular.
- Decidir proxima fase de conclusao real e numero de lancamento.

### Riscos conhecidos

- Validacao visual mobile real nao foi executada neste turno.
- O schema JSONB e temporario para rascunho, nao substitui a futura modelagem definitiva do atendimento concluido.
- `localStorage` continua dependendo da seguranca do navegador local.
- O arquivo antigo `PageClient.tsx` foi mantido apenas como reexport porque a remocao direta falhou no OneDrive.

### Rollback

- Reapontar `page.tsx` para o placeholder/cliente antigo, se necessario.
- Remover `FichaPageClient.tsx`.
- Remover `ficha-schema.ts` e testes associados.
- Restaurar validacao anterior de `validarDadosRascunho`, se a Fase 4 precisar ser desativada.
- Reverter alteracao do `PATCH` que aceita `clienteId`.
- Nenhuma migration precisa ser revertida porque nenhuma migration foi criada nesta fase.

### Proximo passo recomendado

Executar a validacao manual da Fase 4 em browser autenticado e celular. Depois, planejar a fase de conclusao real, com numero de lancamento e persistencia definitiva fora do JSONB temporario.

## 2026-07-15 - Ajuste de fluxo da Fase 4: ficha unificada e preenchimento nao linear

### Escopo executado

- Reduzido o fluxo ativo da ficha para quatro marcos operacionais:
  1. Filial e consultora.
  2. Ficha de Atendimento.
  3. Resultado do Atendimento.
  4. Revisao.
- A etapa `Ficha de Atendimento` agora exibe na mesma tela:
  - Cliente.
  - Dados da crianca.
  - Interesses.
  - Produtos.
  - Observacoes.
- A ficha deixou de exigir passagem linear por `Cliente -> Crianca -> Interesses -> Observacoes`.
- Apos cadastrar ou selecionar cliente, a cliente fica vinculada ao rascunho atual e a tela continua automaticamente na ficha principal.
- O texto "Quem esta sendo atendida?" nao fica visivel depois que a cliente ja esta vinculada.

### Compatibilidade de rascunhos antigos

- `etapaAtual = cliente` agora migra para `ficha`.
- `etapaAtual = criancas` agora migra para `ficha`.
- `etapaAtual = interesses` agora migra para `ficha`.
- `etapaAtual = observacoes` agora migra para `ficha`.
- `etapaAtual = resultado` permanece em `resultado`.
- `etapaAtual = revisao` permanece em `revisao`.
- Nao houve migration nova; a compatibilidade ficou no schema TypeScript do JSONB de rascunho.

### Data prevista de nascimento

- O campo deixou de depender do `input type="date"` controlado diretamente pelo valor ISO.
- A digitacao usa `DD/MM/AAAA`, aceita colagem numerica e colagem ISO `AAAA-MM-DD`.
- Valores parciais ficam somente no estado local da tela.
- O rascunho so recebe `AAAA-MM-DD` quando a data esta completa e valida.
- Conversao usa validacao local por ano/mes/dia, sem conversao UTC.

### Nome da crianca

- A digitacao aceita letras, espacos, acentos, hifen e apostrofo.
- Numeros, simbolos indevidos e emoji sao filtrados na UI.
- A normalizacao final reduz espacos e aplica trim no schema, sem impedir a digitacao de espaco no campo.

### Arquivos alterados nesta etapa

- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/ficha-schema.test.ts`
- `src/lib/atendimento-presencial/rascunho-cache.test.ts`
- `src/lib/atendimento-presencial/rascunhos.test.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Validacoes realizadas

- MCP Supabase consultado para confirmar colunas reais de `public.atendimento_presencial_atendimentos` usadas pelo rascunho:
  - `id`
  - `cliente_id`
  - `dados_rascunho`
  - `version`
  - `updated_at`
- `npm run test -- src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunho-cache.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts`: passou, 4 arquivos e 23 testes.
- `npx tsc --noEmit`: passou.
- `npx eslint src/app/atendimento-presencial/ficha/FichaPageClient.tsx src/lib/atendimento-presencial/ficha-schema.ts src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunho-cache.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts`: passou.
- `npm run lint`: falhou por erros preexistentes fora do escopo em `procurar-datas` e `digisac`; nao houve erro nos arquivos da ficha.
- `git diff --check`: passou, com avisos de CRLF do checkout.
- `npm run build`: primeira tentativa no sandbox falhou por `EPERM` em `.next`; primeira tentativa fora do sandbox compilou mas falhou por lock temporario `EBUSY` em `.next`; segunda tentativa fora do sandbox passou.

### Roteiro manual recomendado

1. Abrir `/atendimento-presencial/ficha` como usuario com permissao.
2. Iniciar novo atendimento selecionando filial e consultora.
3. Confirmar progresso `Etapa 2 de 4` na ficha ativa.
4. Buscar cliente por nome.
5. Selecionar cliente e confirmar que a ficha permanece disponivel sem etapa intermediaria.
6. Trocar cliente e selecionar outra.
7. Cadastrar cliente nova e confirmar vinculo automatico ao rascunho.
8. Adicionar crianca em gestacao.
9. Digitar `20122026` e confirmar exibicao `20/12/2026`.
10. Digitar data parcial e confirmar que dia/mes nao somem durante a digitacao.
11. Colar `2026-12-20` e confirmar exibicao `20/12/2026`.
12. Digitar nome com acento, espaco, hifen e apostrofo.
13. Tentar inserir numero, simbolo indevido e emoji no nome da crianca.
14. Adicionar departamentos em qualquer ordem.
15. Adicionar e remover produtos.
16. Preencher observacoes antes de preencher dados da crianca.
17. Avancar para Resultado.
18. Selecionar resultado e motivos.
19. Avancar para Revisao.
20. Usar `Editar` nos blocos da revisao e confirmar retorno para a etapa correta.
21. Atualizar a pagina e confirmar recuperacao do rascunho.
22. Fechar e reabrir o navegador e confirmar cache/rascunho.
23. Testar offline, alterar dados, voltar online e confirmar sincronizacao.
24. Validar em viewport mobile.

### Fora do escopo mantido

- Sem conclusao final funcional.
- Sem persistencia definitiva de atendimento concluido.
- Sem historico completo.
- Sem integracao SGI, Digisac ou Inteligencia Comercial.
- Sem alteracao de permissoes, crons ou migrations.

### Riscos conhecidos

- Edicao real de filial/consultora apos o rascunho existir continua nao implementada porque exigiria novo contrato de persistencia.
- Validacao manual autenticada em navegador/celular ainda precisa ser executada.
- `dados_rascunho` permanece como JSONB temporario de rascunho, nao como modelo definitivo da ficha concluida.

## 2026-07-16 - Ajuste final da Fase 4 e Fase 5

Status: Fase 4 validada apos ajuste de consultora/unidade; Fase 5 implementada localmente.

### Ajuste final da Fase 4

- A API de rascunhos passou a retornar `unidadeIds` para cada consultora disponivel.
- A selecao inicial da ficha agora filtra consultoras por unidade e unidades por consultora.
- Perfis gerenciais selecionam consultora antes da unidade quando necessario.
- Consultora sem unidade vinculada fica bloqueada para iniciar ficha e recebe aviso operacional.
- O backend preserva a validacao `Consultora nao vinculada a unidade`.
- Nao foi criada lista manual de excecoes para emails administrativos; a exibicao segue o perfil e os vinculos reais do banco.

### Fase 5 - Persistencia definitiva

- Criada migration `20260716100000_conclude_atendimento_presencial.sql`.
- `atendimento_presencial_atendimentos.status` passa a aceitar `rascunho` e `concluido`.
- Foram adicionados campos definitivos de conclusao: resultado, motivo outro, observacoes, numero de lancamento e `concluido_em`.
- Criadas tabelas definitivas: criancas, departamentos, produtos de interesse, motivos e historico.
- Criada funcao transacional `public.atendimento_presencial_concluir(...)`.
- RLS das novas tabelas fica ativo, sem acesso direto para `authenticated`, com uso via service role nas APIs protegidas.

### Interface e APIs

- `/atendimento-presencial/ficha` agora conclui a ficha na revisao.
- Quando o resultado e `Sim`, a tela exige numero do lancamento.
- Quando o resultado e `Nao` ou `Ainda em negociacao`, o numero do lancamento e limpo e nao enviado.
- Antes de concluir, a tela faz um PATCH imediato para salvar o rascunho mais recente.
- Apos concluir, o cache local do rascunho e removido.
- Criada rota `POST /api/atendimento-presencial/atendimentos/[id]/concluir`.
- Criada rota `GET /api/atendimento-presencial/atendimentos` para registros concluidos.
- Criada rota `GET /api/atendimento-presencial/atendimentos/[id]` para detalhe de registro concluido.
- `/atendimento-presencial/registros` deixou de ser placeholder e passou a listar registros concluidos com detalhe basico.

### Validacao Supabase

- MCP Supabase consultado antes da Fase 5.
- Confirmado que, antes desta migration, existiam `atendimento_presencial_atendimentos` e `atendimento_presencial_clientes`.
- Confirmado que as tabelas definitivas de criancas, departamentos, produtos, motivos e historico ainda nao existiam.
- Confirmado que a constraint de status existente aceitava somente `rascunho`.
- Confirmado que RLS estava ativo nas tabelas atuais e que o padrao era negar acesso direto a `authenticated`.

### Arquivos criados

- `src/lib/atendimento-presencial/rascunhos-shared.ts`
- `src/app/api/atendimento-presencial/atendimentos/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`
- `src/app/atendimento-presencial/registros/RegistrosPageClient.tsx`
- `supabase/migrations/20260716100000_conclude_atendimento_presencial.sql`

### Arquivos alterados

- `src/app/api/atendimento-presencial/atendimentos/rascunhos/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/app/atendimento-presencial/registros/page.tsx`
- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/ficha-schema.test.ts`
- `src/lib/atendimento-presencial/rascunhos.ts`
- `src/lib/atendimento-presencial/rascunhos.test.ts`

### Validacoes realizadas

- `npm run test -- src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts`: passou, 2 arquivos e 14 testes, validando o ajuste final da Fase 4.
- `npm run test -- src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`: passou, 5 arquivos e 31 testes.
- `npx tsc --noEmit`: passou.
- `npm run lint -- ...`: passou nos arquivos alterados da Fase 5.
- `npm run build`: falhou no sandbox por rede bloqueada ao buscar Google Fonts.
- `npm run build` com rede liberada: falhou antes da compilacao por `EPERM` persistente ao remover arquivo em `.next/static`, problema local de lock Windows/OneDrive.

### Nao validado

- Migration ainda nao foi aplicada no Supabase remoto neste turno.
- SQL da migration nao foi executado contra banco local/remoto neste turno.
- Fluxo manual autenticado de conclusao e consulta de registro ainda nao foi executado em navegador/celular.

### Fora do escopo preservado

- Sem integracao SGI.
- Sem Digisac automatico.
- Sem Inteligencia Comercial.
- Sem fechamento posterior separado.
- Sem filtros avancados, relatorios, exportacao ou edicao pos-conclusao.

### Proximo passo recomendado

Aplicar a migration em ambiente controlado, executar a conclusao manual com usuario real e validar `/atendimento-presencial/registros` com dados concluidos reais.

## 2026-07-16 - Revisao da migration Fase 5 antes de aplicacao

### Escopo

- Revisada e corrigida somente a migration pendente `20260716100000_conclude_atendimento_presencial.sql`.
- A migration nao foi aplicada no Supabase neste turno.
- Mantida a estrutura funcional ja implementada da Fase 5; o foco foi seguranca, autorizacao, integridade e contrato da RPC.

### Diagnostico confirmado

- A migration anterior aceitava `p_perfil` e `p_role` na RPC, confiando em parametros vindos da API.
- O MCP Supabase confirmou que `usuarios_permitidos.role` aceita somente `user` e `superadmin`; perfil operacional precisa vir de `app_usuarios_perfis`/`app_perfis_acesso`.
- O MCP Supabase confirmou que a tabela real `atendimento_presencial_atendimentos` ainda aceita somente `status = 'rascunho'` e que as tabelas normalizadas da Fase 5 ainda nao existem no banco remoto.
- O contrato correto e concluir via service role, mas com a propria RPC revalidando executor, perfil, consultora responsavel, unidade, cliente e JSONB.

### Correcao implementada

- RPC `public.atendimento_presencial_concluir` agora recebe apenas `p_atendimento_id`, `p_expected_version`, `p_usuario_id` e `p_numero_lancamento`.
- A RPC busca role real em `usuarios_permitidos` e perfil real em `app_usuarios_perfis`/`app_perfis_acesso`.
- `superadmin` e tratado por role real; `consultora`, `supervisora_loja` e `gestao` sao tratados por perfil operacional real.
- Revalidada unidade ativa, consultora responsavel ativa, perfil consultora da responsavel, vinculo da consultora com a unidade e cliente ativo.
- O JSONB do rascunho e validado antes da normalizacao: chaves permitidas, arrays obrigatorios, tipos, limites de texto, quantidade de itens, duplicidades e regras por resultado.
- A conclusao permanece atomica com `FOR UPDATE`, checagem de versao e persistencia normalizada antes de limpar o rascunho.
- `dados_rascunho` passa a guardar apenas marcador minimo de schema concluido apos a normalizacao.
- Novas tabelas continuam com RLS ativo, sem grants diretos para `anon`/`authenticated`; acesso direto e bloqueado por policies falsas e uso previsto via service role.

### Arquivos alterados nesta revisao

- `supabase/migrations/20260716100000_conclude_atendimento_presencial.sql`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`
- `src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts`
- `src/lib/atendimento-presencial/conclusao-migration.test.ts`

### Validacoes realizadas

- `npm run test -- src/lib/atendimento-presencial/conclusao-migration.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts`: passou, 3 arquivos e 13 testes.
- `npm run test -- src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts src/lib/atendimento-presencial/conclusao-migration.test.ts`: passou, 7 arquivos e 42 testes.
- `npx tsc --noEmit`: passou.
- `npx eslint src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts src/lib/atendimento-presencial/conclusao-migration.test.ts`: passou.
- `git diff --check`: passou, com avisos de CRLF/LF do checkout Windows.
- `npm run lint`: falhou por erros preexistentes fora do escopo em `/procurar-datas` e `digisac`.
- `npm run build`: falhou no sandbox por rede bloqueada ao buscar Google Fonts; repetido com rede liberada, falhou duas vezes por `EPERM` em `.next/static`, ruido local Windows/OneDrive.

### Pendencias

- SQL ainda nao executado contra banco local ou remoto.
- Migration ainda nao aplicada no Supabase remoto.
- Fluxo manual autenticado de conclusao e consulta de registro ainda nao validado em navegador/celular.

### Proximo passo recomendado

Aplicar a migration em ambiente controlado somente apos autorizacao explicita, testar uma conclusao real por perfil permitido e validar que registros concluidos nao sao afetados pelo cron de limpeza de rascunhos.

## 2026-07-16 - Ajuste final do limite JSONB da migration Fase 5

### Escopo

- Ajustado somente o limite de tamanho de `dados_rascunho` na migration pendente da Fase 5 e no schema funcional correspondente.
- A migration ainda nao foi aplicada no Supabase.
- Nenhum limite funcional de produtos, criancas, motivos, observacoes ou motivo outro foi alterado.

### Diagnostico confirmado

- O limite anterior de 4 KB (`pg_column_size(dados_rascunho) <= 4096`) era insuficiente para o payload maximo permitido pelo schema funcional.
- O payload maximo testado contem 8 criancas, 6 departamentos, 20 produtos com 80 caracteres, 24 motivos, motivo Outro com 120 caracteres e observacoes com 2.000 caracteres.
- Tamanho medido do payload maximo valido em JSON UTF-8: 5.993 bytes.
- Novo limite adotado: 16.384 bytes.
- Margem restante medida: 10.391 bytes.
- MCP Supabase confirmou 5 rascunhos atuais e maior `dados_rascunho` com 300 bytes; todos continuariam compativeis.

### Regra da consultora responsavel

- `consultora_usuario_id` permanece representando uma usuaria com perfil operacional `consultora`.
- Supervisora e gestao podem executar a conclusao quando autorizadas, mas nao sao gravadas como consultora responsavel por padrao.
- A validacao `apa.chave = 'consultora'` na RPC permanece intencional para garantir que a responsavel registrada e consultora real.

### Arquivos alterados nesta revisao

- `supabase/migrations/20260716100000_conclude_atendimento_presencial.sql`
- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/conclusao-migration.test.ts`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Validacoes realizadas

- `npm run test -- src/lib/atendimento-presencial/conclusao-migration.test.ts`: passou, 1 arquivo e 8 testes.
- `npm run test -- src/lib/atendimento-presencial/conclusao-migration.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`: passou, 2 arquivos e 11 testes.
- `npm run test -- src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts src/lib/atendimento-presencial/conclusao-migration.test.ts`: passou, 7 arquivos e 44 testes.
- `npx tsc --noEmit`: passou.
- `npx eslint src/lib/atendimento-presencial/conclusao-migration.test.ts src/lib/atendimento-presencial/ficha-schema.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts`: passou.
- `git diff --check`: passou, com avisos de CRLF/LF do checkout Windows.

### Proximo passo recomendado

Aplicar a migration em ambiente controlado somente apos autorizacao explicita e validar uma conclusao real com consultora responsavel, supervisora/gestao executora autorizada e registros concluidos.

## 2026-07-16 - Correcao da fila serial de autosave

### Escopo

- Corrigida a corrida de autosaves concorrentes na Ficha de Atendimento Presencial.
- Nenhuma migration foi criada ou alterada nesta etapa.
- Nenhuma RPC, constraint, RLS, grant, permissao, cron ou dado manual no Supabase foi alterado.

### Diagnostico confirmado

- O rascunho de teste `a3583b33-fd65-498c-9b95-f55cad53dde9` foi confirmado via MCP Supabase como `status = rascunho`, `version = 6`, ativo, com cliente, consultora e unidade vinculadas.
- O fluxo antigo tinha dois caminhos de PATCH: autosave debounced no `useEffect` e salvamento imediato antes de concluir.
- Ambos usavam `ativo.version` capturado no state React.
- O primeiro PATCH podia atualizar o banco e incrementar a versao, enquanto PATCHs seguintes ainda enviavam a versao anterior, causando 409 em sequencia.
- O mecanismo antigo `saveSeq` descartava respostas antigas na UI, mas nao impedia multiplas requisicoes simultaneas no servidor.

### Correcao implementada

- Criado helper `AutosaveSerialQueue` para manter no maximo um PATCH em andamento por rascunho.
- A fila usa versao corrente fora do state React e atualiza a versao imediatamente apos PATCH 200.
- Alteracoes durante PATCH em andamento apenas marcam pendencia e o proximo PATCH usa a versao retornada pelo anterior.
- Payloads sao deduplicados por serializacao canonica, ignorando estados visuais.
- O debounce passou a ser unico e controlado pela fila, com cancelamento no unmount e antes da conclusao.
- O cache local passa a usar a versao corrente da fila e nao reduz a versao do servidor.

### Tratamento de conflito

- Em 409, a fila para retry automatico e cancela timer pendente.
- Se o servidor ja contem o mesmo payload, a versao local e atualizada e o status volta para salvo sem exibir erro.
- Se o payload diverge, o estado local e o cache sao preservados, o status fica `conflito` e a tela oferece acao para recarregar a versao do servidor.
- Nao foi removido `expectedVersion` e a protecao contra duas abas permanece ativa.

### Conclusao

- `Concluir atendimento` agora usa `garantirRascunhoSalvoAntesDeConcluir`.
- A funcao cancela debounce, aguarda PATCH em andamento, salva o payload mais recente se necessario e chama a conclusao com a versao final retornada.
- O botao usa bloqueio sincronico por ref para evitar duplo clique.
- Durante a conclusao, novos efeitos de autosave ficam suspensos.

### Logs tecnicos seguros

- Adicionados logs temporarios sem dados pessoais:
  - inicio do autosave com draft mascarado e versao enviada;
  - sucesso com nova versao e pendencia;
  - conflito com versao do servidor e indicacao de payload igual;
  - conclusao aguardando autosave.
- Nenhum payload completo, cliente, telefone, crianca, produto, observacao ou token e logado.

### Arquivos alterados nesta etapa

- `src/lib/atendimento-presencial/autosave-fila.ts`
- `src/lib/atendimento-presencial/autosave-fila.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Validacoes realizadas

- `npm run test -- src/lib/atendimento-presencial/autosave-fila.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`: passou, 3 arquivos e 12 testes.
- `npm run test -- src/lib/atendimento-presencial/autosave-fila.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunho-cache.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/cron/atendimento-presencial-limpar-rascunhos/route.test.ts src/lib/atendimento-presencial/conclusao-migration.test.ts`: passou, 9 arquivos e 54 testes.
- `npx tsc --noEmit`: passou.
- `npx eslint src/app/atendimento-presencial/ficha/FichaPageClient.tsx src/lib/atendimento-presencial/autosave-fila.ts src/lib/atendimento-presencial/autosave-fila.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`: passou.
- `git diff --check`: passou, com avisos CRLF/LF do checkout Windows.
- `npm run build`: falhou no sandbox por rede bloqueada ao buscar Google Fonts; repetido com rede liberada, passou. Permaneceram logs conhecidos de rotas dinamicas por uso de `cookies`.

### Pendencias

- Teste manual autenticado/mobile ainda pendente.
- Validar manualmente: edicoes rapidas, troca imediata para Revisao, conclusao logo apos editar, duas abas com conflito real, ausencia de loop 409, offline e retorno online.

### Riscos conhecidos

- A validacao de duas abas e offline depende de navegador real autenticado.
- A fila protege o frontend atual; chamadas externas diretas ao PATCH continuam corretamente protegidas por `expectedVersion`.

### Proximo passo recomendado

Executar o roteiro manual em navegador autenticado antes de aplicar a migration da Fase 5 em ambiente controlado.

## 2026-07-16 - Registros concluidos e separacao visual da ficha

### Escopo

- Corrigida a leitura de observacoes e cliente vinculada na tela de Registros de Atendimento Presencial.
- Melhorada a separacao visual interna da Ficha de Atendimento em secoes: Cliente, Dados da crianca, Departamentos, Produtos de interesse e Observacoes.
- Nenhuma migration, RPC, RLS, grant, permissao, cron, constraint ou dado manual no Supabase foi alterado.

### Diagnostico confirmado

- MCP Supabase confirmou um atendimento concluido real com `observacoes` preenchida, `cliente_id` preenchido e `dados_rascunho` reduzido ao marcador `{"schema":"atendimento_presencial_concluido_v1"}`.
- A tela de registros lia `selecionado.atendimento.dadosRascunho.observacoes`, fonte incorreta para atendimentos concluidos.
- A API de detalhe nao retornava objeto `cliente` explicito para o contrato da tela.

### Correcao implementada

- Criado contrato central em `src/lib/atendimento-presencial/registros.ts`.
- API de detalhe agora busca cliente por `cliente_id` diretamente, sem filtro de status, e retorna `cliente` explicita.
- API de lista usa a mesma normalizacao de cliente e passa a tratar erro em consultas auxiliares como erro real, sem fallback silencioso.
- Tela de registros passou a renderizar `atendimento.observacoes` como fonte final.
- Ficha ganhou wrapper visual `SecaoFicha`, mantendo handlers, autosave, schema, validacoes e etapas existentes.

### Validacoes realizadas

- `npm run test -- src/lib/atendimento-presencial/registros.test.ts src/app/api/atendimento-presencial/atendimentos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts`: passou, 3 arquivos e 5 testes.
- `npm run test -- src/lib/atendimento-presencial/registros.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/rascunhos.test.ts src/lib/atendimento-presencial/autosave-fila.test.ts src/app/api/atendimento-presencial/atendimentos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/rascunho/route.test.ts src/app/api/atendimento-presencial/atendimentos/rascunhos/route.test.ts src/app/api/atendimento-presencial/clientes/route.test.ts src/app/api/atendimento-presencial/clientes/[id]/route.test.ts`: passou, 11 arquivos e 56 testes.
- `npx tsc --noEmit`: passou.
- `npx eslint src/lib/atendimento-presencial/registros.ts src/lib/atendimento-presencial/registros.test.ts src/app/api/atendimento-presencial/atendimentos/route.ts src/app/api/atendimento-presencial/atendimentos/route.test.ts "src/app/api/atendimento-presencial/atendimentos/[id]/route.ts" "src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts" src/app/atendimento-presencial/registros/RegistrosPageClient.tsx src/app/atendimento-presencial/ficha/FichaPageClient.tsx`: passou.

### Pendencias

- Validacao manual autenticada/mobile ainda pendente.
- Migration da Fase 5 continua nao aplicada neste ajuste.

### Proximo passo recomendado

Validar manualmente um registro concluido real em `/atendimento-presencial/registros` e confirmar no celular a leitura da observacao final e a separacao visual da ficha.

## 2026-07-17 - UI/UX: crianca automatica, Select de situacao e cores nas secoes

### Escopo

- Primeira crianca agora nasce automaticamente na abertura da ficha, sem clique manual.
- Situacao da crianca trocou de botoes OpcaoButton para Radix Select.
- Secoes da ficha ganharam cores distintas por variante.
- Botao remover crianca oculto quando ha apenas uma.
- Mensagem "Nenhuma crianca adicionada" removida (sempre ha pelo menos uma).
- Nenhuma migration, RPC, RLS, grant, permissao, cron, constraint, API ou dado manual no Supabase foi alterado.

### Diagnostico confirmado

- `criarCriancaRascunho` retornava `situacao: 'nao_informado'` — alterado para `situacao: 'gestacao'`.
- `criarPayloadInicial` retornava `criancas: []` — agora inclui uma crianca pre-criada.
- `aplicarRascunho` preservava array vazio de criancas do servidor — agora adiciona uma inicial se vazio.
- `SecaoFicha` nao tinha variant de cor — adicionado sistema com 5 variantes.
- Situacao usava 4 OpcaoButton em grid — substituido por Select/SelectTrigger/SelectContent/SelectItem.
- Componente Radix Select ja existia em `src/components/ui/select.tsx`.

### Implementacao

- `ficha-schema.ts`: `criarCriancaRascunho` agora retorna `situacao: 'gestacao'`.
- `FichaPageClient.tsx`:
  - Import de `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`.
  - `criarPayloadInicial` inclui `criarCriancaRascunho(gerarIdLocal('crianca'))`.
  - `aplicarRascunho` adiciona crianca inicial se payload migrado tiver 0 criancas.
  - `SecaoFicha` aceita `variant?: 'azul' | 'rosa' | 'amarelo' | 'lilas' | 'verde'` com mapa de classes.
  - Cliente=azul, Crianca=rosa, Departamentos=amarelo, Produtos=lilas, Observacoes=verde.
  - Situacao substituida por Radix Select com `position="popper"`.
  - Botao remover oculto quando `ficha.criancas.length === 1`.
  - Mensagem "Nenhuma crianca adicionada" removida.
- `ficha-schema.test.ts`: teste de `criarCriancaRascunho` atualizado para `situacao: 'gestacao'`.

### Arquivos alterados

- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/ficha-schema.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Validacoes realizadas

- `npx vitest run src/lib/atendimento-presencial/ficha-schema.test.ts`: passou, 1 arquivo e 13 testes.
- `npx tsc --noEmit`: passou sem erros.
- `npx eslint src/app/atendimento-presencial/ficha/FichaPageClient.tsx src/lib/atendimento-presencial/ficha-schema.ts src/lib/atendimento-presencial/ficha-schema.test.ts --quiet`: passou.

### Impactos esperados

- Rascunhos existentes sem criancas passarao a exibir uma crianca inicial em gestacao na UI.
- Autosave pode disparar uma vez ao abrir rascunho vazio antigo, por diferenca real de payload — nao e loop.
- Schema de validacao continua aceitando array vazio (nao quebra rascunhos legados).

### O que nao foi alterado

- Migration, banco, RPC, RLS, grants, cron, APIs.
- Fila de autosave, cache, versionamento.
- Permissoes, modulos.
- Tela de Registros.
- Regras de clientes, conclusao, validacao.
- Componentes OpcaoButton (ainda usados em outras partes da ficha).

### Pendencias

- Validacao manual autenticada/mobile ainda pendente.
- Migration da Fase 5 continua nao aplicada.

### Proximo passo recomendado

Validar manualmente no celular: abertura da ficha com crianca automatica, troca de situacao via Select, cores das secoes, e fluxo completo de conclusao.

## 2026-07-17 - Codex - Historico da cliente, virada de cartao e filtros de registros

### Escopo

- Implementado historico resumido da cliente na Ficha, com atendimentos anteriores e compras SGI associadas ao telefone.
- Adicionado `nomeNaoInformado` no schema do rascunho e controle "Nao sabe o nome ainda" na crianca.
- Adicionada validacao visual por secao com resumo clicavel e rolagem/foco para o primeiro erro.
- Etapa Resultado reorganizada em secoes coloridas com motivo `virada_cartao` e campo DD/MM.
- Registros agora exibem labels amigaveis de departamentos, virada do cartao na lista/detalhe e filtro De/Ate por DD/MM.
- Criada migration local para colunas definitivas de virada, `nome_nao_informado`, historico `editado` e RPCs.

### Arquivos criados

- `src/app/api/atendimento-presencial/clientes/[id]/historico/route.ts`
- `src/lib/atendimento-presencial/historico-cliente.ts`
- `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql`

### Arquivos alterados

- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/app/atendimento-presencial/registros/RegistrosPageClient.tsx`
- `src/app/api/atendimento-presencial/atendimentos/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/route.ts`
- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/ficha-schema.test.ts`
- `src/lib/atendimento-presencial/rascunhos.ts`
- `src/lib/atendimento-presencial/rascunhos-shared.ts`
- `src/lib/atendimento-presencial/registros.ts`

### Validacoes realizadas

- Supabase MCP: confirmadas tabelas, colunas, constraints, policies, indices, RPC de conclusao atual e ausencia de `atendimento_presencial_editar_concluido`.
- `npx tsc --noEmit --pretty false`: passou sem erros.
- `npm run test -- src/lib/atendimento-presencial/ficha-schema.test.ts src/lib/atendimento-presencial/registros.test.ts src/app/api/atendimento-presencial/atendimentos/route.test.ts`: passou, 3 arquivos e 19 testes.

### Nao validado

- Migration nova nao aplicada no Supabase.
- SQL da migration nova nao executado contra banco local/remoto.
- Browser autenticado/mobile nao executado.
- Edicao controlada ainda nao tem formulario/PATCH funcional completo; detalhe ja retorna `podeEditar`, `motivoBloqueio` e `limiteEdicaoEm`, mas o botao permanece sem fluxo de salvamento.

### Riscos conhecidos

- Codigo que seleciona colunas novas (`virada_cartao_dia`, `virada_cartao_mes`) depende da migration antes do uso em ambiente remoto.
- O filtro De/Ate por virada e aplicado em memoria apos buscar ate 200 registros por escopo; pode precisar migrar para SQL/RPC se o volume crescer.
- A migration local de edicao precisa de revisao antes de aplicacao; a RPC de edicao preparada ainda deve ser alinhada ao PATCH definitivo que substitui tabelas filhas atomicamente.

### Proximo passo recomendado

Revisar e completar o fluxo de edicao controlada antes de aplicar a migration: formulario/drawer de edicao, PATCH dedicado, chamada real da RPC, historico de campos alterados e validacao manual autenticada.

## 2026-07-17 - Codex - Revisao integral da migration local 20260717

### Escopo

- Revisada a migration local `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql`.
- A migration nao foi aplicada no Supabase.
- A RPC `atendimento_presencial_concluir` deixou de ser uma versao simplificada e voltou a preservar o contrato validado da conclusao, com acrescimos para `virada_cartao`, DD/MM e `nomeNaoInformado`.
- A RPC `atendimento_presencial_editar_concluido` passou a atualizar dados definitivos normalizados: atendimento, cliente vinculado, criancas, departamentos, produtos, motivos e historico.

### Arquivos criados

- `src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts`

### Arquivos alterados

- `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql`

### Validacoes realizadas

- Supabase MCP: confirmada definicao remota atual de `atendimento_presencial_concluir(uuid, integer, uuid, integer)`; confirmada ausencia remota de `atendimento_presencial_editar_concluido`; confirmadas tabelas, colunas, constraints, RLS/policies, indices, grants e triggers de `atendimento_presencial_*`.
- Supabase MCP: confirmado que `atendimento_presencial_atendimentos_touch()` incrementa `NEW.version = OLD.version + 1`.
- `npm run test -- src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts`: passou, 1 arquivo e 5 testes.
- `npm run test -- src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts`: passou, 2 arquivos e 20 testes.
- `git diff --check`: passou sem erros; apenas avisos CRLF/LF do checkout Windows.

### Nao validado

- SQL da migration nao foi executado contra banco local/remoto.
- Migration nao foi aplicada.
- Fluxo manual autenticado/mobile nao foi executado.
- Nao foi criado PATCH/UI final de edicao neste turno; a revisao foi restrita a migration local e teste de regressao.

### Riscos conhecidos

- A migration precisa ser executada em ambiente controlado para validar sintaxe SQL e comportamento transacional real.
- O contrato final de API/UI para chamar `atendimento_presencial_editar_concluido` ainda precisa ser integrado.

### Proximo passo recomendado

Executar a migration em banco de teste ou ambiente controlado, validar conclusao e edicao com perfis reais, e so depois integrar o PATCH/UI de edicao controlada.

## 2026-07-17 - Codex - Segunda revisao da migration local 20260717

### Escopo

- Ajustada novamente a migration local `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql`.
- A migration nao foi aplicada no Supabase.
- A revisao corrigiu regressao de assinatura da RPC de conclusao, whitelist do payload real, constraint de virada, perfis ativos, regras preservadas da RPC aplicada e edicao sem mudancas.

### Correcoes principais

- `atendimento_presencial_concluir` voltou a `returns table(id uuid, version integer)`, sem `DROP FUNCTION`.
- `etapaAtual` e `notaTecnica` sao aceitas no payload e descartadas do JSON normalizado.
- `clienteId` so e aceito quando `p_permitir_cliente_id = true`.
- Constraint de virada exige dia e mes ambos nulos ou ambos preenchidos e validos.
- Todas as consultas de perfil usam `apa.ativo = true` e `EXISTS`.
- Departamentos continuam obrigatorios, 1 a 6, com valores permitidos e sem duplicidade.
- Motivos continuam obrigatorios, 1 a 24, com `virada_cartao` adicionado ao catalogo e sem regra nova por resultado.
- Criancas continuam 0 a 8, com `id` obrigatorio, data de gestacao opcional e validacoes condicionais completas.
- Produtos voltaram a rejeitar duplicidade por `lower(trim(...))`.
- Edicao valida unidade ativa e consultora responsavel ativa/com perfil/vinculo atual.
- Edicao compara snapshots funcionais antes de apagar dados e lança `nenhuma_alteracao` sem atualizar versao ou historico.
- Historico registra somente metadados tecnicos e quantidades, sem payload, telefone, nomes, observacoes completas ou produtos completos.

### Arquivos alterados

- `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql`
- `src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts`

### Validacoes realizadas

- Supabase MCP: confirmada assinatura remota `atendimento_presencial_concluir(uuid, integer, uuid, integer)` com `RETURNS TABLE(id uuid, version integer)`.
- Supabase MCP: confirmadas constraints, indices, RLS/policies, grants, trigger de versionamento, colunas das tabelas filhas, perfis ativos e existencia de dados concluidos.
- `npm run test -- src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts`: passou, 1 arquivo e 12 testes.
- `npm run test -- src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts`: passou, 2 arquivos e 27 testes.
- `git diff --check`: passou sem erros; apenas avisos CRLF/LF do checkout Windows.

### Nao validado

- SQL real da migration nao foi compilado em banco local porque `psql` e Supabase CLI nao estao no PATH e o Docker engine nao estava ativo.
- Nenhuma transacao de validacao foi executada no Supabase remoto principal.
- UI/API final de edicao controlada continua fora deste escopo.

### Riscos conhecidos

- A migration ainda precisa de validacao SQL real em banco local, branch Supabase ou ambiente descartavel antes de aplicacao.
- A RPC de edicao ainda depende de integracao posterior com PATCH/UI.

### Proximo passo recomendado

Validar a migration em banco local/descartavel com rollback ou branch de desenvolvimento, depois integrar a rota PATCH/UI de edicao controlada.

## 2026-07-17 - Codex - Integracao PATCH/UI da edicao de atendimento concluido

### Escopo

- Continuada a implementacao da Ficha/Registros de Atendimento Presencial a partir do estado atual do projeto.
- A migration `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql` foi tratada como ja aplicada e validada no Supabase principal, conforme instrucao da tarefa.
- Nenhuma migration anterior foi alterada ou reaplicada.

### Supabase/MCP

- Confirmadas no Supabase as RPCs `atendimento_presencial_concluir`, `atendimento_presencial_editar_concluido` e `atendimento_presencial_normalizar_payload_ficha`.
- Confirmado que as RPCs principais seguem com `SECURITY DEFINER`, `search_path` explicito e grants restritos a `service_role`.
- Confirmadas colunas novas usadas pela UI/API: `virada_cartao_dia`, `virada_cartao_mes` e `nome_nao_informado`.

### Implementacao

- Ajustado o peso visual dos titulos dos grupos de motivos na etapa final da ficha.
- Adicionado PATCH dedicado em `/api/atendimento-presencial/atendimentos/[id]`, chamando somente a RPC `atendimento_presencial_editar_concluido`.
- O PATCH valida payload pelo schema existente, valida dados obrigatorios de conclusao, confere `version`, restringe o registro a `status = concluido` e mapeia erros de conflito, acesso, registro inexistente, payload invalido e nenhuma alteracao.
- A tela de Registros agora abre edicao controlada apenas quando `podeEditar = true`, mantendo cliente, unidade e consultora como leitura.
- A edicao reutiliza os mesmos catalogos/helpers da ficha para criancas, departamentos, produtos, resultado, motivos, virada de cartao, observacoes e numero de lancamento.
- O detalhe passa a exibir historico tecnico quando disponivel.

### Arquivos alterados neste passo

- `src/app/api/atendimento-presencial/atendimentos/[id]/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/app/atendimento-presencial/registros/RegistrosPageClient.tsx`
- `src/lib/atendimento-presencial/registros.ts`
- `src/lib/atendimento-presencial/registros.test.ts`

### Validacoes realizadas

- `npm run test -- src/lib/atendimento-presencial/registros.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts src/app/api/atendimento-presencial/atendimentos/route.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`: passou, 5 arquivos e 27 testes.
- `npm run test -- src/lib/atendimento-presencial/registros.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts`: passou, 2 arquivos e 8 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/app/atendimento-presencial/ficha/FichaPageClient.tsx src/app/atendimento-presencial/registros/RegistrosPageClient.tsx src/app/api/atendimento-presencial/atendimentos/[id]/route.ts src/app/api/atendimento-presencial/atendimentos/[id]/route.test.ts src/lib/atendimento-presencial/registros.ts src/lib/atendimento-presencial/registros.test.ts`: passou sem erros.

### Nao validado

- Browser autenticado/mobile nao foi executado neste turno.
- Nao foi feita nova aplicacao de migration, por instrucao de tratar a migration como ja aplicada.

### Riscos conhecidos

- A validacao manual ainda precisa confirmar o fluxo real com consultora dentro e fora do prazo, supervisora vinculada, superadmin e gestao bloqueada.
- O historico exibido depende do snapshot gravado pela RPC aplicada.

### Proximo passo recomendado

Executar validacao manual autenticada em `/atendimento-presencial/registros`: editar atendimento concluido, salvar sem alteracao, simular conflito por versao e conferir historico/visibilidade por perfil.

## 2026-07-17 - Codex - Terceira revisao final da migration local 20260717

### Escopo

- Revisada novamente a migration local `supabase/migrations/20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql`.
- A migration nao foi aplicada no Supabase principal.
- O ajuste ficou restrito a dois pontos funcionais confirmados: `etapaAtual` na edicao de concluido e precedencia de multiplos perfis na conclusao.

### Correcoes realizadas

- `atendimento_presencial_normalizar_payload_ficha` agora exige `etapaAtual` somente quando `p_permitir_cliente_id = false`, preservando o contrato de conclusao de rascunho.
- Na edicao de concluido (`p_permitir_cliente_id = true`), `etapaAtual` e opcional; quando enviada, precisa ser string.
- `notaTecnica` permanece opcional, precisa ser string quando enviada e continua descartada do payload normalizado.
- A conclusao passou a autorizar por precedencia efetiva: superadmin, supervisora vinculada, gestao vinculada, consultora propria vinculada, bloqueio.
- A prioridade representativa de historico foi mantida como supervisora, consultora, gestao e nulo.
- A edicao manteve a precedencia ja desejada: superadmin, supervisora vinculada, propria consultora no prazo, bloqueio; gestao continua bloqueada quando nao houver outro perfil autorizado.

### Validacoes realizadas

- Supabase MCP: confirmada novamente a RPC remota aplicada `atendimento_presencial_concluir(uuid, integer, uuid, integer)` com retorno `TABLE(id uuid, version integer)` e ausencia remota de `atendimento_presencial_editar_concluido`.
- `npm run test -- src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts`: passou com 1 arquivo e 13 testes.
- `npm run test -- src/lib/atendimento-presencial/melhorias-ficha-edicao-migration.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts`: passou com 2 arquivos e 28 testes.
- `rg` de regressao nao encontrou `DROP FUNCTION`, retorno estendido, limite antigo de motivos, exigencia de crianca minima nem bloco antigo `supervisora or gestao`.

### Validacao SQL real

- Nao executada.
- `psql` e Supabase CLI nao estao no PATH.
- Docker CLI existe, mas o Docker Desktop engine nao ficou disponivel apos tentativa de inicializacao e espera de 3 minutos.
- A consulta de branches Supabase pelo MCP falhou por erro interno do conector.
- Nenhuma transacao DDL foi executada no projeto principal.

### Riscos conhecidos

- A migration ainda precisa compilar em Postgres/Supabase descartavel antes da aplicacao.
- Testes SQL minimos de normalizador, conclusao e edicao seguem pendentes por falta de ambiente descartavel ativo.
- A RPC de edicao ainda depende de integracao posterior com PATCH/UI.

### Proximo passo recomendado

Rodar a migration em Supabase branch, Supabase local ou Postgres temporario assim que houver ambiente descartavel ativo, executar os testes SQL minimos e somente depois aprovar a aplicacao no projeto principal.

## 2026-07-17 - Codex - Estado final deste turno

- Estado adotado neste turno: migration `20260717120000_atendimento_presencial_melhorias_ficha_edicao.sql` tratada como ja aplicada e validada no Supabase principal, conforme instrucao recebida.
- MCP confirmou a existencia remota de `atendimento_presencial_editar_concluido`, alem das colunas novas usadas por API/UI.
- Integracao PATCH/UI de edicao de atendimento concluido implementada e validada por testes focados, typecheck e lint.
- Pendencia restante: validacao manual autenticada/mobile em ambiente real.

## 2026-07-17 - Codex - Correcao de historico SGI por telefone e conclusao com resultado Nao

### Escopo

- Corrigidos dois problemas confirmados na Ficha de Atendimento Presencial.
- Nenhuma migration, RPC, regra de permissao ou estrutura geral da ficha foi alterada.

### Historico SGI

- Causa confirmada: `gerarVariacoesTelefone` nao gerava a variante com nono digito quando a entrada era DDD + 8 digitos, por exemplo `4196246875`.
- O caso RAQUEL GARCIA foi confirmado no Supabase: os lancamentos `64196` e `64685` possuem contatos `41996246875` e `5541996246875`, alem do contato principal `4199640086`/`554199640086`.
- O helper compartilhado da Inteligencia Comercial agora gera variantes com e sem DDI e com e sem nono digito para estruturas moveis seguras.
- Telefones fixos plausiveis continuam sem insercao de nono digito.
- A busca da Ficha continua usando `sgi_documentos_saida_contatos` nos campos `telefone_normalizado` e `telefone_normalizado_ddi`, deduplicando vendas por documento.

### Conclusao e resultado

- Causa confirmada: o serializador do autosave nao considerava `viradaCartaoDia` e `viradaCartaoMes`, permitindo divergencia entre revisao local e rascunho salvo.
- A rota de conclusao agora normaliza `row.dados_rascunho` com `validarFichaDadosRascunho` antes de aplicar `validarFichaParaConclusao`.
- Os valores canonicos de resultado permanecem `sim`, `nao` e `negociacao`; labels traduzidas nao sao aceitas como valor interno.
- A revisao exibe o resumo de validacao perto do botao `Concluir atendimento`.
- Ao clicar em erro de resultado ou virada, a ficha abre a etapa Resultado e tenta focar a secao/campo correspondente.

### Arquivos alterados/criados neste passo

- `src/lib/digisac/sgi-sync.ts`
- `src/lib/digisac/sgi-sync.test.ts`
- `src/lib/atendimento-presencial/historico-cliente.test.ts`
- `src/lib/atendimento-presencial/autosave-fila.ts`
- `src/lib/atendimento-presencial/autosave-fila.test.ts`
- `src/lib/atendimento-presencial/ficha-schema.ts`
- `src/lib/atendimento-presencial/ficha-schema.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.ts`
- `src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`

### Validacoes realizadas

- Supabase MCP: confirmadas colunas reais de `sgi_documentos_saida`, `sgi_documentos_saida_contatos`, `sgi_documentos_saida_produtos`, `sgi_documentos_saida_pagamentos`, `atendimento_presencial_clientes` e `atendimento_presencial_atendimentos`.
- Supabase MCP: confirmados os lancamentos `64196` e `64685` vinculados a RAQUEL GARCIA com contato secundario `41996246875`/`5541996246875`.
- `npm run test -- src/lib/digisac/sgi-sync.test.ts src/lib/atendimento-presencial/historico-cliente.test.ts src/lib/atendimento-presencial/autosave-fila.test.ts src/lib/atendimento-presencial/ficha-schema.test.ts src/app/api/atendimento-presencial/atendimentos/[id]/concluir/route.test.ts`: passou, 5 arquivos e 38 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint` nos arquivos tocados: passou.
- `git diff --check`: passou; apenas avisos CRLF/LF conhecidos do checkout Windows.

### Nao validado

- Browser autenticado/mobile nao executado neste turno.
- Fluxo manual completo com RAQUEL GARCIA nao foi executado na UI.

### Proximo passo recomendado

Validar manualmente em navegador autenticado: selecionar/criar RAQUEL GARCIA com `(41) 9624-6875`, abrir historico, confirmar vendas `64685` e `64196`, concluir atendimento com `Resultado: Nao`, `Virada de cartao` e `20/07`, e testar erro intencional sem resultado.

## 2026-07-17 - Codex - UI/UX do modal de historico da cliente

### Escopo

- Ajustada a apresentacao visual do modal de historico da cliente na Ficha de Atendimento Presencial.
- O foco ficou em legibilidade, hierarquia visual e alinhamento com o padrao do modal de detalhe da Inteligencia Comercial.
- Nenhuma migration, RPC, regra de busca por telefone, deduplicacao ou regra de negocio foi alterada.

### Referencia adotada

- A referencia visual foi `src/components/inteligencia-comercial/ModalDetalheVenda.tsx`.
- Foram reaproveitados o espirito de secoes com bordas/fundos leves, labels fortes, chips de departamento, destaque de valores e tabela de produtos.

### Implementacao

- O modal passou a ter cabecalho mais claro com nome e telefone da cliente.
- A secao de atendimentos presenciais anteriores ficou separada em bloco proprio, com estado vazio claro.
- A secao de compras SGI passou a organizar cada venda em blocos de resumo, departamentos, pagamento e itens/produtos.
- O DTO de historico SGI foi ampliado de forma minima para expor `vendedor`, `status`, `departamentos` e produtos estruturados, usando colunas ja confirmadas no Supabase.
- Produtos agora aparecem em tabela responsiva com nome, departamento, quantidade e valor quando os detalhes estruturados estao disponiveis.

### Arquivos alterados

- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/lib/atendimento-presencial/historico-cliente.ts`
- `src/lib/atendimento-presencial/historico-cliente.test.ts`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Validacoes

- Supabase MCP: confirmadas colunas reais usadas na apresentacao (`vendedor`, `status`, `valor_total`, `departamento_classificado`, `subgrupo_classificado` e dados relacionados).
- `npm run test -- src/lib/atendimento-presencial/historico-cliente.test.ts`: passou, 1 arquivo e 2 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/app/atendimento-presencial/ficha/FichaPageClient.tsx src/lib/atendimento-presencial/historico-cliente.ts src/lib/atendimento-presencial/historico-cliente.test.ts`: passou.
- `git diff --check`: passou, com avisos CRLF/LF conhecidos do checkout Windows.

### Nao validado

- Browser autenticado/mobile nao executado neste turno.
- Validacao visual manual do modal aberto com vendas reais ainda pendente.

### Proximo passo recomendado

Abrir a Ficha em navegador autenticado, consultar uma cliente com compras SGI reais e conferir desktop/mobile se resumo, vendedor, departamentos, pagamento e tabela de itens ficam imediatamente legiveis.

## 2026-07-17 - Codex - Historico da cliente em Ficha, Registros e Clientes

### Escopo

- O modal de historico da cliente foi extraido da Ficha para um componente reutilizavel.
- A mesma visualizacao passou a estar disponivel tambem em Registros de Atendimentos Presenciais e Clientes do Atendimento Presencial.
- Nenhuma migration, RPC, regra de normalizacao de telefone ou regra de busca SGI foi alterada.

### Implementacao

- Criado `HistoricoClienteModal` com a UI ja usada no historico da Ficha, incluindo o label claro `Venda fechada?`.
- A Ficha passou a usar o componente compartilhado e continua enviando `atendimentoAtualId` para excluir o atendimento atual do historico anterior.
- Registros passou a exibir `Ver historico` no bloco de cliente do detalhe selecionado.
- Clientes passou a exibir `Ver historico` em cada resultado de busca.

### Arquivos alterados/criados

- `src/components/atendimento-presencial/HistoricoClienteModal.tsx`
- `src/components/atendimento-presencial/HistoricoClienteModal.test.ts`
- `src/app/atendimento-presencial/ficha/FichaPageClient.tsx`
- `src/app/atendimento-presencial/registros/RegistrosPageClient.tsx`
- `src/app/atendimento-presencial/clientes/PageClient.tsx`
- `docs/ficha-atendimento-presencial-progresso.md`
- `docs/ia/log_progress.md`

### Validacoes realizadas

- `npm run test -- src/components/atendimento-presencial/HistoricoClienteModal.test.ts`: passou, 1 arquivo e 3 testes.
- `npx tsc --noEmit --pretty false`: passou.
- `npx eslint src/components/atendimento-presencial/HistoricoClienteModal.tsx src/components/atendimento-presencial/HistoricoClienteModal.test.ts src/app/atendimento-presencial/ficha/FichaPageClient.tsx src/app/atendimento-presencial/registros/RegistrosPageClient.tsx src/app/atendimento-presencial/clientes/PageClient.tsx`: passou.

### Nao validado

- Browser autenticado/mobile nao executado neste turno.
- Abertura manual do modal em Registros e Clientes com dados reais ainda pendente.

### Proximo passo recomendado

Validar em navegador autenticado as tres entradas do historico: Ficha, detalhe de Registros e resultado de Clientes, confirmando que o mesmo modal abre e carrega dados da API existente.
