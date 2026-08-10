# log_progress_legacy — certificado de congelamento

## Status

`docs/ia/log_progress.md` é **histórico legado congelado**. A partir desta
fase (Fase B2, ver `.agents/README.md`), a escrita global nesse arquivo foi
aposentada — nenhum agente deve mais adicioná-lo como destino de
continuidade corrente.

## Regra de escrita

Nenhum agente deve, sob nenhuma circunstância:

- adicionar entrada nova;
- editar entrada existente;
- corrigir encoding ou mojibake histórico;
- normalizar quebra de linha (CRLF/LF);
- reorganizar ou reordenar conteúdo;
- resumir ou compactar o próprio arquivo.

O arquivo permanece no caminho atual, intocado, como registro histórico.

## Estado de preservação (congelado em 2026-08-10)

- **SHA-256:** `333b30193680f8ade809456a061975b55840c313311577991cc589ee6a51d69`
- **Tamanho:** 1.944.665 bytes
- **Linhas físicas:** 24.213
- **Quebra de linha predominante:** CRLF (minoria de LF solto, residual)
- **Replacement characters (mojibake histórico conhecido):** presentes,
  herdados de incidente de encoding anterior a este congelamento — não
  corrigidos, não devem ser corrigidos por este certificado.

Qualquer divergência futura desses valores (hash, tamanho, linhas) indica
que o arquivo foi tocado após o congelamento e deve ser investigada antes
de qualquer nova ação sobre ele.

## Consulta histórica

Quando houver necessidade real de consultar o histórico:

1. Nunca ler o arquivo inteiro.
2. Buscar por termo dirigido — módulo, feature, arquivo, decisão, termo de
   negócio ou data aproximada.
3. Abrir apenas um pequeno trecho de contexto ao redor do resultado
   encontrado.
4. Código e documentação atuais sempre vencem o histórico quando houver
   divergência.
5. Uma entrada antiga nunca prova comportamento atual — é só um registro
   do que se acreditava ou se fez naquele momento.

## Continuidade atual (pós-congelamento)

- **Tarefa normal:** código + worktree + Harness (`AGENTS.md`) + relatório
  final ao usuário. Sem persistência global automática.
- **Trabalho com continuidade real e estrutura substancial:**
  `docs/projetos/<slug>/` (`STATUS.md`, `PLANO.md`, `ESCOPO.md`,
  `DECISOES.md`) — ver `.agents/skills/projeto-multifase/SKILL.md`.
- **Histórico anterior a este congelamento:** Git + busca dirigida neste
  arquivo, seguindo a regra de consulta acima.

## Referências históricas

Código, migrations e documentos antigos podem conter apontamentos para
entradas específicas de `docs/ia/log_progress.md` (ex.:
`src/lib/auth/access-window.ts`, migrations de `supabase/migrations/`,
planos de feature em `docs/`). Esses apontamentos continuam válidos como
referência histórica e não precisam ser migrados em massa nesta fase. Se
uma pendência apontada dessa forma voltar a ser trabalhada, ela deve
ganhar uma fonte corrente apropriada naquele momento (Projeto Multifase,
documentação canônica atualizada, ou decisão registrada), em vez de nova
entrada neste arquivo.
