# Status — Lebebe Exclusive em Pedidos Personalizados

Projeto: `lebebe-exclusive-pedidos-personalizados`
Estado: CONCLUIDO

## Estado final

- Implementação do banco, App/Vercel e worker SGI publicada e validada em
  produção.
- `lebebe_exclusive` pode avançar de `RASCUNHO` para `VENDA FECHADA` sem
  número de lançamento.
- O produto SGI é criado sem lançamento com o nome
  `LEBEBE EXCLUSIVE (FILIAL CLIENTE)`.
- O lançamento é obrigatório em `VENDA FECHADA → EM PRODUÇÃO`; depois disso,
  o mesmo `produto_id_sgi` é renomeado para
  `LEBEBE EXCLUSIVE (FILIAL LANÇAMENTO CLIENTE)`.
- A renomeação não repete custo nem preço e usa as operações do worker
  `CRIAR_PRODUTO` e `RENOMEAR_PRODUTO`.
- Criação real e renomeação real foram validadas com preservação do mesmo
  produto e sem duplicação.
- Durante a renomeação, a UI mostra `Atualizando produto SGI...`, consulta o
  estado real e passa automaticamente para `Produto SGI atualizado`; após
  refresh, mantém `Produto SGI criado`.
- Moriah permaneceu separado e inalterado.

## Validação

- Testes focados da Gestão: 30 aprovados.
- ESLint dos arquivos afetados: sem erros novos.
- `git diff --check`: aprovado.
- Deploy de produção confirmado como `READY`, com SHA publicado igual ao
  commit da correção de UX.

Não há pendência funcional desta frente.
