# Status — Confidencialidade de custos

Projeto: confidencialidade-custos
Estado: EM_EXECUCAO
Fase atual: Fase 2 validada manualmente em 2026-10-26 e publicada.

## Última etapa concluída

Fase 2, em 2026-10-26. A API de Gestão de Pedidos Personalizados deixa de consultar e de devolver custo interno para `consultora` e `supervisora_loja`. Gestão, Pós-venda e Superadmin continuam recebendo os mesmos campos. A tela esconde custo enquanto a permissão carrega ou falha.

## Proteções aplicadas

- O servidor resolve o perfil em `app_usuarios_perfis` / `app_perfis_acesso`. Superadmin entra por `acessoTotal`, sem essa consulta.
- Perfil ausente, inativo, inválido ou erro na consulta define `podeVerCustoInterno` como falso. A requisição de pedidos continua; o custo não vai na resposta.
- Listagem, detalhe e solicitação do produto SGI omitem `custo`, `custoUnitario` e `totalCusto` quando a autorização não é verdadeira.
- Para perfil restrito, a listagem não seleciona `custo_enviado`. O detalhe não seleciona `custo_unitario_snapshot`, `total_custo`, `custo_enviado` nem `procedimento_custo_sgi`.
- Preço de venda, total de venda, `produtoSgi.preco` e as etapas `CUSTO_CRIADO` / `CUSTO_FINALIZADO` permanecem.
- O endpoint interno do worker SGI não foi alterado e continua recebendo o custo necessário à integração.

## Testes automatizados

Executados em 2026-10-26, sem credencial real:

- `npx vitest run` em `custo-interno.test.ts`, `custo-confidencialidade.test.ts`, `contexto.test.ts`, `handlers.test.ts`, `repositorio.test.ts` e `gestao-modelo.test.ts`: 190 testes aprovados.
- Repetição de `custo-confidencialidade.test.ts` e `repositorio.test.ts` depois do ajuste das colunas: 19 testes aprovados.
- `npx eslint` nos arquivos alterados: 0 erros. Permanece um aviso preexistente de dependência de `useEffect` em `GestaoPedidosPersonalizados.tsx`.
- `npx tsc --noEmit --pretty false --incremental false --project output/altervision/tsconfig.validation.json`: nenhum erro nos arquivos desta fase. Restam 15 erros preexistentes, em testes de autenticação de agente e do hub de vendas, fora deste escopo.

## Pendências

A validação manual dos cinco perfis foi confirmada pelo responsável em 2026-10-26. A Fase 3, de regressão do catálogo e da criação, não foi executada.

## Próximo passo

Nenhum para a Fase 2. A Fase 3 só começa com autorização explícita.

## Não refazer

Não reauditar do zero a lista de colunas de custo nem as permissões dos dois perfis, salvo mudança posterior no banco. Não alterar `superadmin_usuarios`. Retomar por este arquivo.

## Consultar

- `ESCOPO.md` — o que entra e o que fica de fora
- `PLANO.md` — Fase 2 implementada; Fase 3 pendente
- `DECISOES.md` — D-001, D-002 e D-003
- `.agents/rules/confidencialidade-custos.md` — regra permanente
