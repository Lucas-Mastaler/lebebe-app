# Escopo — Higiene Estrutural do Repositório

**Estado:** CONCLUÍDO (2026-08-11 — Ondas 1 a 6 executadas, todos os
critérios de aceite abaixo satisfeitos; contrato geral aprovado pelo
proprietário em 2026-08-10, Fase C2.1)

## Objetivo

Organizar o repositório Le Bébé App — documentação solta, scripts, SQL
auxiliares, dados operacionais e legado de compatibilidade (`.devin/`) —
sem alterar comportamento funcional e sem perder documentação válida,
histórico útil, referências, scripts ainda necessários ou compatibilidade
deliberada.

## Problema resolvido

O repositório acumulou, ao longo de fases anteriores (Fase B/B2 — log
global; Fase C1 — congelamento de `CONTEXTO DO PROJETO.MD`), arquivos soltos
na raiz e em `docs/` sem organização temática, possíveis fontes concorrentes
de verdade, scripts/SQL de propósito ambíguo, e um diretório de legado
(`.devin/`) ainda intacto aguardando decisão de compatibilidade. Isso gera
risco de confusão operacional (qual documento/script é o vigente) e
dificulta a navegação do projeto.

## Regras de negócio

Nenhuma. Este projeto é puramente estrutural/organizacional — não deve
alterar regra de negócio, schema, API ou comportamento do app.

## Restrições

- Nenhuma remoção, movimentação ou renome ocorre sem identificar e
  atualizar os consumidores/referências daquele arquivo.
- Nenhum dado sensível (segredo, token, PII) é copiado para os artefatos
  deste projeto.
- Documentos históricos não são reescritos apenas para parecer atuais.
- `docs/ia/log_progress.md` permanece congelado (Fase B2) — este projeto
  não escreve nele, sem exceção. Continuidade corrente vive nos quatro
  artefatos deste projeto; consulta ao log antigo é só histórica e dirigida.

## Dentro do escopo

- Documentação solta na raiz e em `docs/` (ex.: `RESUMO_STACK.MD`, guias de
  setup, documentos técnicos e históricos sem pasta temática).
- Duplicados e fontes concorrentes (ex.: SQL solto na raiz vs.
  `supabase/migrations/`, SQL auxiliar em `appscript/` vs. migrations
  oficiais).
- Documentos históricos já identificados como congelados
  (`CONTEXTO DO PROJETO.MD`) — apenas organização física futura, não
  reabertura de conteúdo.
- Runbooks, backups e outputs soltos (ex.: `desloc_backup.md`).
- Scripts e dados auxiliares soltos na raiz (ex.: `procvlojas.md`,
  `deslocamentos.gs`, `digisac_docs.md`, `scriptsreal.md`) frente às pastas
  já existentes `scripts/` e `appscript/`.
- Dados sensíveis/PII identificados (ex.: `appscript/logs.md`).
- Legado `.devin/` — tratado como onda separada e tardia (gate próprio).
- Referências quebráveis por qualquer movimentação acima.
- Nomes/locais problemáticos, apenas quando houver impacto real
  identificado (não cosmética isolada).

## Fora do escopo

- Payload de exemplo, dados de exemplo, ou qualquer sanitização adicional
  em `test-apps-script.ps1` — decisão do proprietário (D-004, 2026-08-10):
  trabalho de segredo/token desse script é anterior e considerado
  encerrado para fins deste projeto. Um segredo literal atual encontrado
  no futuro é questão de segurança independente, fora desta iniciativa.
- Refactor funcional de qualquer módulo.
- Alteração de regra de negócio.
- Mudança de schema/banco, migrations novas ou alteração de APIs.
- Redesign de qualquer tela ou fluxo.
- Qualquer mudança em `/procurar-datas` (motor, fixtures, regra) — módulo
  crítico com regra própria (`.agents/rules/procurar-datas.md`); documentos
  candidatos relacionados são apenas listados, nunca movidos/consolidados
  aqui.
- Mudança das regras centrais do Harness (`AGENTS.md`, `.agents/rules/`,
  `.agents/skills/`) — exceto pointer estritamente necessário para este
  projeto existir.
- Reescrita ampla de histórico Git sem decisão humana específica.

## Critérios de aceite

- Raiz do repositório mais limpa (documentos/scripts soltos organizados ou
  com decisão explícita de permanecer onde estão).
- Fontes canônicas inequívocas (sem documento concorrente sem aviso de
  status).
- Documentos históricos claramente marcados como históricos.
- Scripts e dados auxiliares junto de seus consumidores, quando fizer
  sentido, ou com decisão registrada de manter separados.
- Zero referência quebrada conhecida após qualquer movimentação.
- `.devin/` tratado conforme decisão explícita de compatibilidade (D-005,
  pendente).
- Nenhum comportamento funcional alterado pela higiene.
- Itens sensíveis (token, PII) tratados com segurança antes de qualquer
  reorganização física que os exponha mais.

## Decisões funcionais já aprovadas

- Ver `DECISOES.md` — D-001 a D-015, todas APROVADAS (nenhuma PENDENTE).
  D-005 (`.devin/`) resolvida na Onda 5 (usuário confirmou uso ativo do
  Devin; pasta mantida como adaptador de compatibilidade mínimo). D-006
  (`appscript/logs.md`) resolvida na Onda 2 (arquivo removido). D-015
  registra o fechamento da Onda 6.
