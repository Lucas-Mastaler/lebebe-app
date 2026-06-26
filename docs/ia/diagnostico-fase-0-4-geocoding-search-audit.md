# Diagnostico Fase 0.4 - geocoding_audit e search_execution_audit

Data: 2026-06-26
Agente/ferramenta: Codex
Tipo: diagnostico e plano. Nenhum SQL, migration, RLS, grant ou codigo funcional foi alterado.

## 1. Resumo executivo

| tabela | pronto para RLS + revoke imediato? | resumo |
|---|---|---|
| `geocoding_audit` | Nao | Existe uso confirmado pelo Apps Script legado via REST com `SUPABASE_ANON_KEY`. Revogar `anon` agora quebraria os inserts legados de geocoding. |
| `search_execution_audit` | Nao | A v2 Next.js usa service role, mas o Apps Script legado tambem insere via REST com `SUPABASE_ANON_KEY`. Revogar `anon` agora quebraria a telemetria legada. |

Conclusao: as duas tabelas seguem com risco critico no banco, mas a Etapa 0.4 nao deve aplicar o mesmo patch da 0.3 sem uma etapa previa para trocar o legado para caminho server-side/service role ou outra autenticacao controlada.

## 2. Relacao com a Fase 0

A Etapa 0.3 fechou `sessoes_logout_automatico`, `geo_cache`, `provider_costs` e `forex_config` porque o uso funcional estava confirmado via service role. A Etapa 0.4 avalia duas tabelas de auditoria/telemetria ligadas a `/procurar-datas` e ao legado Apps Script.

Diferença relevante em relacao a 0.3: aqui ha uso externo confirmado com a anon key do Supabase dentro do Apps Script (`CEP-APIBACK.gs`). Portanto, aplicar apenas `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM anon/authenticated` teria risco funcional real.

## 3. Validacao MCP Supabase

| tabela | existe? | RLS atual | grants anon | grants authenticated | grants PUBLIC | policies | linhas aprox. | risco atual |
|---|---:|---|---|---|---|---|---:|---|
| `geocoding_audit` | sim | OFF | ALL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) | ALL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) | nenhum grant direto confirmado | nenhuma | 35.604 | Critico: dados de geocoding, endereco, email e performance expostos/modificaveis por roles publicas. |
| `search_execution_audit` | sim | OFF | ALL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) | ALL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) | nenhum grant direto confirmado | nenhuma | 1.010 | Critico: dados de pesquisa, email, CEP/endereco e telemetria expostos/modificaveis por roles publicas. |

Colunas principais confirmadas:

| tabela | colunas |
|---|---|
| `geocoding_audit` | `id bigint`, `chave_endereco varchar`, `endereco_completo text`, `cache_hit boolean`, `provider varchar`, `confidence numeric`, `user_email text`, `origin varchar`, `created_at timestamptz`, `duration_ms integer` |
| `search_execution_audit` | 29 colunas: `id`, `client_token`, `origin`, `user_email`, `cep`, `endereco_pesquisado`, `endereco_curto`, `tempo_necessario`, `is_rural`, `is_condominio`, metricas de duracao/candidatos/slots, `status`, `error_message`, `started_at`, `finished_at`, `created_at`, `motor`, `rota`, `tipo_execucao`, `run_id` |

Constraints, indices, triggers e dependencias:

| item | `geocoding_audit` | `search_execution_audit` |
|---|---|---|
| PK | `geocoding_audit_pkey (id)` | `search_execution_audit_pkey (id)` |
| FKs | nenhuma confirmada | nenhuma confirmada |
| indices | 8: pkey, `chave_endereco`, `cache_hit`, `created_at`, `provider`, `created_at+provider`, `created_at+duration_ms`, `duration_ms` parcial | 6: pkey, `created_at desc`, `total_duration_ms desc`, `motor+created_at`, `origin+created_at`, `status+created_at` |
| triggers | nenhum | nenhum |
| funcoes relacionadas por corpo SQL | nenhuma confirmada | nenhuma confirmada |
| views dependentes | 10 views, todas com `SELECT` para `anon` e `authenticated` | 5 views, todas com `SELECT` para `anon` e `authenticated` |
| advisory relacionado | `rls_disabled_in_public` / RLS disabled | `rls_disabled_in_public` / RLS disabled |

Views dependentes confirmadas:

- `geocoding_audit`: `vw_cache_speedup`, `vw_economia_mensal`, `vw_economia_por_provider`, `vw_economia_real_diaria`, `vw_economia_ultimos_30_dias`, `vw_enderecos_lentos`, `vw_performance_30_dias`, `vw_performance_diaria`, `vw_performance_por_provider`, `vw_top_enderecos_cacheados`.
- `search_execution_audit`: `vw_search_capacidade_resultado`, `vw_search_execucoes_lentas`, `vw_search_performance_30_dias`, `vw_search_performance_diaria`, `vw_search_performance_origem`.

Advisors de seguranca tambem apontam varias dessas views como `security_definer_view`. Isso aumenta o risco de leitura indireta e deve ser tratado em etapa propria junto com grants das views.

## 4. Uso real no codigo

| arquivo | funcao/bloco | tabela | operacao | camada | client usado | depende de usuario autenticado? | depende de Apps Script/legado? | risco se remover grants anon/authenticated |
|---|---|---|---|---|---|---|---|---|
| `appscript/CEP-APIBACK.gs` | `RegistrarGeocodingAudit_` | `geocoding_audit` | `insert` via REST `/rest/v1/geocoding_audit` | Apps Script legado | `SUPABASE_ANON_KEY` em `apikey` e `Authorization: Bearer` | Nao confirmado como sessao app; usa `Session.getActiveUser()` do Apps Script para email | Sim | Quebra insert de auditoria de geocoding no legado se `anon` perder `INSERT` ou RLS bloquear. |
| `appscript/CEP-APIBACK.gs` | chamadas de `RegistrarGeocodingAudit_` em hit L1, hit Supabase e chamada provider | `geocoding_audit` | `insert` indireto | Apps Script legado | `SUPABASE_ANON_KEY` | Nao confirmado como sessao app | Sim | Quebra telemetria de cache/provider legado. |
| `appscript/CEP-APIBACK.gs` | `RegistrarExecucaoPesquisaAudit_` | `search_execution_audit` | `insert` via REST `/rest/v1/search_execution_audit` | Apps Script legado | `SUPABASE_ANON_KEY` em `apikey` e `Authorization: Bearer` | Nao confirmado como sessao app; usa `Session.getActiveUser()` para email | Sim | Quebra insert de telemetria de pesquisa no legado. |
| `appscript/CEP-APIBACK.gs` | chamadas de `RegistrarExecucaoPesquisaAudit_` em sucesso/cache/erro | `search_execution_audit` | `insert` indireto | Apps Script legado | `SUPABASE_ANON_KEY` | Nao confirmado como sessao app | Sim | Quebra telemetria de execucao legada. |
| `src/lib/procurar-datas/v2/auditoria-search.ts` | `registrarAuditoriaSearchV2` | `search_execution_audit` | `insert` | helper backend Next.js | `createServiceClient()` -> `SUPABASE_SERVICE_ROLE_KEY` | Recebe email da rota autenticada | Nao | Nao quebra se service role permanecer; service role bypassa RLS. |
| `src/app/api/procurar-datas/v2/pesquisar-compat-async/route.ts` | chamadas de `registrarAuditoriaSearchV2` em sucesso e erro | `search_execution_audit` | `insert` indireto | API route Next.js | service role pelo helper | Sim, passa por `validarAcessoProcurarDatas()` | Nao | Nao quebra se service role permanecer. |

Buscas diretas no `src/`:

- `geocoding_audit`: zero referencias confirmadas no codigo Next.js.
- `search_execution_audit`: uma referencia funcional confirmada no helper `auditoria-search.ts`.
- `from('geocoding_audit')`: zero ocorrencias.
- `from('search_execution_audit')`: uma ocorrencia, insert no helper v2.

## 5. Possivel vinculo com legado, Apps Script ou `/procurar-datas`

Confirmado:

- Apps Script legado insere em `geocoding_audit` e `search_execution_audit` via Supabase REST.
- A chave usada pelo Apps Script e `SUPABASE_ANON_KEY`, carregada da planilha por `getConfig('SUPABASE_ANON_KEY', cfgSheet)`.
- `search_execution_audit` tambem recebe inserts da v2 Next.js via service role.
- As rotas de `/procurar-datas` sao autenticadas no Next.js por `validarAcessoProcurarDatas()`, que usa `validateComercialUser()`.

Hipoteses:

- As views de performance/cache podem ser usadas por relatorios ou consultas manuais. O uso atual dessas views em UI/API nao foi confirmado no codigo desta tarefa.
- `Session.getActiveUser()` no Apps Script pode refletir o usuario do Google/execucao do script, nao necessariamente a sessao autenticada do Le Bebe App. Isso e comportamento externo; nao confirmado no codigo do Next.js.

Pendencias:

- Confirmar se ainda existe fluxo operacional usando o Apps Script legado como fallback/manual para pesquisa completa.
- Decidir se o Apps Script deve deixar de escrever diretamente no Supabase com anon key.
- Auditar uso real das views dependentes antes de revogar grants nelas.

## 6. Classificacao de risco por tabela

| tabela | classificacao | justificativa |
|---|---|---|
| `geocoding_audit` | 3. Nao segura para alterar ainda | Ha insert confirmado via Apps Script legado usando `SUPABASE_ANON_KEY`. RLS + revoke imediato tende a bloquear esse caminho. |
| `search_execution_audit` | 3. Nao segura para alterar ainda | A v2 esta segura via service role, mas o legado Apps Script ainda insere com `SUPABASE_ANON_KEY`. |

## 7. Proposta tecnica

### `geocoding_audit`

Opcao recomendada: **Opcao D - Criar rota/helper server-side primeiro e depois fechar grants**.

Motivo: o produtor confirmado e externo ao Next.js e usa anon key. A correcao segura e mover a escrita para um ponto server-side com segredo interno ou service role, ou trocar a credencial do Apps Script para um endpoint interno protegido. Depois disso, aplicar RLS + revoke.

Impacto esperado: mantem telemetria legada durante a transicao; reduz risco de quebrar geocoding/auditoria.

Rollback futuro: se uma migration futura for aplicada e quebrar o legado, rollback seria `DISABLE ROW LEVEL SECURITY` + restaurar grants necessarios para `anon`/`authenticated`, alem de reverter policies/grants de views se alteradas.

Testes necessarios: executar validacao de endereco/pesquisa legada que gere hit cache e miss provider; confirmar novo registro em `geocoding_audit`; testar SELECT anon negado apos fechamento; testar views se forem mantidas/fechadas.

Precisa migration futura: sim, mas somente apos remover dependencia de anon key.

Precisa alteracao de codigo futura: sim, no Apps Script ou em uma rota server-side intermediaria.

### `search_execution_audit`

Opcao recomendada: **Opcao D - Criar rota/helper server-side primeiro e depois fechar grants**.

Motivo: `src/lib/procurar-datas/v2/auditoria-search.ts` ja usa service role e suportaria RLS + revoke, mas `RegistrarExecucaoPesquisaAudit_` no Apps Script usa `SUPABASE_ANON_KEY`.

Impacto esperado: v2 continua funcionando; legado precisa migrar sua escrita antes de fechar grants.

Rollback futuro: se uma migration futura for aplicada e quebrar o legado, rollback seria `DISABLE ROW LEVEL SECURITY` + restaurar grants, ou reativar temporariamente `INSERT` para `anon` com uma policy muito restrita se houver justificativa.

Testes necessarios: pesquisa v2 autenticada, pesquisa legado/Apps Script, caminho de erro do legado, caminho de cache do legado, verificacao de inserts e consultas de views.

Precisa migration futura: sim, apos resolver Apps Script.

Precisa alteracao de codigo futura: sim, para parar de usar anon key diretamente no Apps Script.

## 8. SQL proposto, se aplicavel

Nao aplicar agora. SQL conceitual para etapa futura, apos remover a dependencia do Apps Script em `SUPABASE_ANON_KEY`:

```sql
ALTER TABLE public.geocoding_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_execution_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.geocoding_audit FROM anon;
REVOKE ALL ON TABLE public.geocoding_audit FROM authenticated;
REVOKE ALL ON TABLE public.search_execution_audit FROM anon;
REVOKE ALL ON TABLE public.search_execution_audit FROM authenticated;
```

Se houver necessidade de leitura por superadmin no banco, avaliar policy SELECT similar a `auditoria_acessos`:

```sql
CREATE POLICY "Superadmins podem ler geocoding_audit"
ON public.geocoding_audit
FOR SELECT
TO authenticated
USING (public.is_superadmin());

CREATE POLICY "Superadmins podem ler search_execution_audit"
ON public.search_execution_audit
FOR SELECT
TO authenticated
USING (public.is_superadmin());
```

Observacao: as views dependentes tambem precisam de decisao propria. Fechar apenas as tabelas pode nao fechar leitura indireta se views `SECURITY DEFINER` e grants publicos permanecerem.

## 9. Testes necessarios antes/depois

Antes de implementar:

- Confirmar com o usuario se o legado Apps Script ainda precisa gravar telemetria.
- Testar pesquisa legado que chama `RegistrarExecucaoPesquisaAudit_`.
- Testar geocoding legado que chama `RegistrarGeocodingAudit_`.
- Testar pesquisa v2 em `/api/procurar-datas/v2/pesquisar-compat-async`.
- Mapear uso real das 15 views dependentes.

Depois de uma implementacao futura:

- Confirmar inserts em `geocoding_audit` e `search_execution_audit` via novo caminho seguro.
- Confirmar que anon/authenticated nao conseguem `SELECT`, `INSERT`, `UPDATE`, `DELETE` direto nas tabelas.
- Confirmar que service role continua inserindo.
- Confirmar que superadmin consegue ler apenas se policy SELECT for criada.
- Confirmar que views nao vazam dados indevidamente.

## 10. Pendencias

- Definir substituto para o insert direto do Apps Script com `SUPABASE_ANON_KEY`.
- Auditar e decidir grants/security das views dependentes.
- Confirmar se docs antigos que diziam uso de `geocoding_audit` no Next.js estao desatualizados; nesta leitura atual, isso nao foi confirmado no codigo.
- Definir se leitura operacional dessas auditorias sera por tela futura, SQL admin ou views protegidas.

## 11. Proximo passo recomendado

Nao executar implementacao de RLS/revoke ainda. A proxima tarefa recomendada e desenhar a mudanca minima para o Apps Script parar de usar `SUPABASE_ANON_KEY` nessas duas escritas, preferencialmente chamando uma rota server-side interna protegida ou outro mecanismo com service role no backend. Depois disso, criar migration da Etapa 0.4 incluindo tambem a decisao sobre views dependentes.
