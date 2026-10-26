# Plano — Confidencialidade de custos

**Estado do planejamento:** DEFINIDO

A Fase 2 foi autorizada em 2026-10-26 e está implementada. A validação manual com os cinco perfis ainda não foi feita.

## Fase 1 — Auditoria e regra permanente

Objetivo: localizar exposições reais e registrar a política no Harness.
Dependências: nenhuma.

- [x] Confirmar chaves `consultora` e `supervisora_loja` no Supabase
- [x] Mapear módulos liberados e o caminho de autorização
- [x] Percorrer colunas de custo no banco e os pontos do código que as devolvem
- [x] Registrar `.agents/rules/confidencialidade-custos.md` e o ponteiro em `AGENTS.md` §7

Critérios de conclusão: diagnóstico com evidência e regra publicada no Harness, sem mudança de comportamento.
Validações necessárias: leitura de código e SQL de diagnóstico. Concluídas em 2026-10-26.

## Fase 2 — Omissão do custo na API e na Gestão

Objetivo: os dois perfis deixam de receber e de ver custo de Le Bébé Exclusive.
Dependências: autorização humana depois da Fase 1.

- [x] Helper único que decide a visibilidade a partir de `app_perfis_acesso.chave` e de `acessoTotal`, resolvido no servidor
- [x] Omitir `custo`, `custoUnitario` e `totalCusto` em `serializarIntegracaoProdutoSgi` e `serializarDetalhe` quando o perfil for restrito
- [x] Deixar de selecionar essas colunas na listagem e no detalhe para o mesmo perfil
- [x] Na Gestão, não renderizar coluna, total e bloco de custo; enquanto `usePermissoes` estiver carregando ou em erro, também não renderizar
- [x] Manter preço de venda, total de venda e `produtoSgi.preco`
- [x] Testes de API para `consultora`, `supervisora_loja`, `gestao`, `pos_venda` e superadmin

Critérios de conclusão: os critérios de aceite do `ESCOPO.md`. A fase permanece implementada, aguardando validação manual.
Validações necessárias: testes automatizados dos handlers e do contexto, executados em 2026-10-26. Browser autenticado fica para a validação manual, sem credencial real no relatório.

## Fase 3 — Regressão do catálogo e da criação

Objetivo: travar os caminhos que hoje já não devolvem custo, para uma mudança futura não reabri-los.
Dependências: Fase 2.

- [ ] Teste de que a pesquisa do catálogo Exclusive não devolve `custo_unitario`
- [ ] Teste de que criar e atualizar itens devolve só identificadores, sem custo
- [ ] Teste de que o texto de resumo copiável continua sem custo

Critérios de conclusão: esses contratos falham se um campo de custo entrar na resposta.
Validações necessárias: suíte já existente de Pedidos Personalizados mais os casos novos.
