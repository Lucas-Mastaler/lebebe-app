# Status — Lebebe Exclusive em Pedidos Personalizados

Projeto: lebebe-exclusive-pedidos-personalizados
Estado: EM VALIDAÇÃO
Fase atual: Smoke visual autenticado e entrega

## Última etapa concluída

- Raiz canônica confirmada em `C:/le-bebe`.
- Regras globais, adaptador Devin, regras de banco/permissões e skills aplicáveis lidas.
- Três arquivos legados recebidos, lidos integralmente e movidos sem alteração
  para `legado-apps-script/`.
- Fluxo atual confirmado como Moriah do frontend às functions do banco.
- Supabase real confirmado: fornecedor `lebebe_exclusive` já existe, mas está
  indisponível e sem produtos/pedidos; tabelas atuais usam RLS, sem policies e
  com grants somente para `service_role`.
- Tabela geral de produtos confirmada sem coleção, custo e preço, e com
  unicidade `(fornecedor_id, codigo)`.
- Interface de criação de produto no SGI não encontrada no repositório.
- CSV real recebido e perfilado: 3.078 linhas, sem campos obrigatórios vazios e
  com 14 referências normalizadas repetidas.
- Decisões finais aprovadas: cinco status globais, dois status exclusivos da
  Moriah, fluxo Exclusive sem layout e descarte somente da duplicata integral
  `76029`.
- Os cinco pedidos personalizados de teste foram reconfirmados, seus vínculos
  foram auditados e a exclusão controlada foi concluída e reconciliada no banco
  e no Storage.
- As migrations `20260813164120` e `20260813164134` foram ensaiadas com
  `ROLLBACK`, aplicadas via MCP e confirmadas no histórico remoto.
- O catálogo foi importado com 3.077 produtos ativos e códigos técnicos
  únicos; a duplicata integral `76029` ficou com uma ocorrência.
- APIs, criação, edição de rascunho, busca manual, cards, detalhes, resumos e
  transições foram adaptados por fornecedor.
- A regressão focada passou com 21 arquivos e 463 testes; ESLint focado e build
  de produção também passaram.

## Diagnóstico vigente

- A seleção do fornecedor não é geral: criação, validação, opções,
  persistência, card, detalhe, resumo e transições estão codificados para
  `moriah_tapetes`.
- O fluxo anterior era `CADASTRADO → AGUARDANDO LAYOUT → AGUARDANDO APROVAÇÃO
  DO CLIENTE → EM PRODUÇÃO → RECEBIDO`. A decisão aprovada substitui
  tecnicamente `CADASTRADO` por `RASCUNHO → VENDA FECHADA` e separa as
  transições posteriores por fornecedor.
- Reutilizar esse fluxo para Exclusive contrariaria a separação de regras do
  pedido; alterar o fluxo sem definição humana mudaria regra de negócio.
- O legado confirma busca manual com mínimo de três caracteres, filtros
  combinados, seleção acumulada, limite visual de 150 resultados, quantidade
  em linha e total `preço × quantidade`.
- O arquivo `salvarPedidos.gs` é uma variante antiga e foi mantido somente como
  evidência histórica.
- A função remota ativa confirmou as dependências Moriah que precisam ser
  preservadas. Depois da limpeza autorizada, não restou pedido personalizado,
  tapete, histórico, anexo ou objeto de Storage pertencente aos cinco testes.
- A modelagem aprovada reutiliza a tabela geral de produtos, adiciona extensão
  1:1 Exclusive e itens históricos com snapshots de preço e custo.

## Próximo passo

Executar o smoke visual autenticado com um usuário que possua os módulos de
novo pedido e Gestão; depois, publicar o código da aplicação pelo fluxo normal
de deploy para alinhar o frontend/API de produção ao banco já migrado.

## Pendências

- A interface externa de cadastro de produto no SGI não foi encontrada; nenhum
  botão ou integração fictícia foi criado.
- O smoke local foi redirecionado para `Acesso negado` nas duas sessões de
  navegador disponíveis; a validação visual autenticada não foi concluída.
- O código ainda não foi publicado. Como as migrations já estão no banco, o
  deploy da aplicação é a próxima operação recomendada.

## Decisões aguardando aprovação

- Nenhuma decisão de negócio pendente para a fase atual.

## Arquivos principais envolvidos

- `src/components/pedidos-personalizados/`
- `src/lib/pedidos-personalizados/`
- `src/app/api/pedidos-personalizados/`
- `src/app/pedidos-personalizados/`
- `supabase/migrations/20260813164120_pedidos_personalizados_lebebe_exclusive.sql`
- `supabase/migrations/20260813164134_pedidos_personalizados_lebebe_exclusive_funcoes.sql`
- `supabase/tests/pedidos_personalizados_lebebe_exclusive.sql`
- `scripts/importar-catalogo-lebebe-exclusive.mjs`
- `legado-apps-script/`

## Validações já realizadas

- Auditoria local completa do fluxo relacionado.
- Consultas somente leitura no projeto Supabase `lebebe.app` para schema,
  dados, migrations, constraints, índices, RLS, grants, functions e extensões.
- Verificação por SHA-256 de que os três legados permaneceram idênticos depois
  da movimentação.
- Perfil somente leitura do CSV e confirmação remota, via MCP, da função de
  status, fornecedor, produtos, extensões, RLS e grants vigentes.
- Exclusão remota controlada validada: 5 pedidos, 5 tapetes, 5 eventos de
  histórico, 2 registros de anexos e 2 objetos de Storage removidos; zero
  registros remanescentes para os IDs autorizados.
- Ensaio integral das duas migrations em transação com `ROLLBACK` e aplicação
  remota confirmada nas versões `20260813164120` e `20260813164134`.
- Importação reconciliada: 3.078 linhas de origem, 3.077 produtos finais,
  3.077 produtos ativos e uma ocorrência da referência `76029`.
- Grants confirmados: sem `SELECT` para `anon`/`authenticated` e com acesso de
  `service_role`; RLS habilitado sem policies por desenho server-only.
- Fluxo Exclusive real validado em `BEGIN/ROLLBACK`, incluindo snapshots
  imutáveis e `RASCUNHO → VENDA FECHADA → EM PRODUÇÃO → RECEBIDO`;
  zero pedidos permaneceram após o rollback.
- Regressão SQL Moriah validada com anexo e retorno de aprovação para layout;
  o teste transacional versionado passou e terminou com zero pedidos/históricos.
- `npm run test -- --run src/lib/pedidos-personalizados
  src/components/pedidos-personalizados`: 21 arquivos e 463 testes aprovados.
- ESLint focado nos arquivos alterados: aprovado.
- `npm run build`: aprovado. O `tsc --noEmit` isolado continua bloqueado somente
  por erros preexistentes de tipos em `hub-vendas/alertas/teste/route.test.ts`.

## Não refazer

- Não reler `docs/ia/log_progress.md` integralmente.
- Não tratar migrations locais ou memória como estado atual do banco.
- Não tocar nas alterações locais de Hub/Vendas.

## Consultar

- `ESCOPO.md` para requisitos funcionais.
- `PLANO.md` para fases e critérios de aceite.
- `DECISOES.md` para decisões aprovadas.
- `legado-apps-script/` para comportamento anterior.
