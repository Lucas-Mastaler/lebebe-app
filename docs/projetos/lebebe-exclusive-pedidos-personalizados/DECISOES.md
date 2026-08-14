# Decisões — Lebebe Exclusive em Pedidos Personalizados

## D-001 — Isolamento por fornecedor

- Data: 2026-08-13
- Decisão: compartilhar apenas os blocos realmente gerais; manter produtos
  Lebebe Exclusive separados de tapetes, medidas, cores, layout e anexos Moriah.
- Impacto: a arquitetura deve evitar condicionais específicas espalhadas sem
  promover abstração genérica excessiva.
- Status: APROVADA

## D-002 — Catálogo operacional no Supabase

- Data: 2026-08-13
- Decisão: usar a planilha somente como fonte da migração inicial; novas
  operações não dependerão de Google Sheets nem Apps Script.
- Impacto: exige busca paginada/limitada no backend e importação repetível.
- Status: APROVADA

## D-003 — Preço e custo históricos

- Data: 2026-08-13
- Decisão: persistir por item os valores de preço e custo usados no pedido,
  além dos totais recuperáveis com precisão.
- Impacto: alterações futuras no catálogo não mudam pedidos antigos.
- Status: APROVADA

## D-004 — SGI fora sem interface real

- Data: 2026-08-13
- Decisão: implementar a integração SGI nesta frente somente se a interface real
  estiver confirmada; não criar mock, endpoint falso ou botão decorativo.
- Impacto: a modelagem preserva os totais necessários e a integração pode ficar
  como fase posterior documentada.
- Status: APROVADA

## D-005 — Status definidos por fornecedor

- Data: 2026-08-13
- Decisão: os status globais são `RASCUNHO`, `VENDA FECHADA`, `EM PRODUÇÃO`,
  `RECEBIDO` e `CANCELADO`. `AGUARDANDO LAYOUT` e `AGUARDANDO APROVAÇÃO DO
  CLIENTE` permanecem exclusivos da Moriah. `CADASTRADO` será removido
  tecnicamente.
- Impacto: a função de transição deve despachar pelo fornecedor, preservar as
  regras de anexos/layout da Moriah e impedir esses estados na Exclusive.
- Status: APROVADA

## D-006 — Rascunho e venda fechada

- Data: 2026-08-13
- Decisão: todo novo pedido começa em `RASCUNHO`; a passagem para `VENDA
  FECHADA` exige confirmação explícita na interface e não cria produto no SGI.
- Impacto: pedidos em rascunho permanecem editáveis e fora do fluxo operacional
  efetivo; a elegibilidade futura ao SGI começa em `VENDA FECHADA`.
- Status: APROVADA

## D-007 — Duplicata integral do catálogo

- Data: 2026-08-13
- Decisão: importar uma única ocorrência das linhas 621/652, referência
  `76029`, porque todos os campos são idênticos. Não deduplicar por referência.
- Impacto: o catálogo final esperado possui 3.077 produtos e preserva produtos
  distintos que compartilham referência exata ou normalizada.
- Status: APROVADA

## D-008 — Limpeza dos pedidos de teste

- Data: 2026-08-13
- Decisão: remover de forma controlada os cinco pedidos personalizados então
  existentes, todos confirmados como testes, incluindo somente seus vínculos e
  objetos de Storage relacionados.
- Impacto: não há conversão semântica de testes antigos para `VENDA FECHADA` e
  a alteração de constraints pode partir de zero pedidos existentes.
- Status: EXECUTADA

## D-009 — Lançamento obrigatório ao fechar venda

- Data: 2026-08-13
- Decisão: a transição de `RASCUNHO` para `VENDA FECHADA` exige número de
  lançamento numérico de até seis dígitos para qualquer fornecedor. Na Lebebe
  Exclusive, os dados comerciais continuam editáveis em `VENDA FECHADA` até a
  entrada em produção.
- Impacto: a regra é validada na interface, API e função transacional do banco;
  a Moriah preserva as regras posteriores de layout, anexos e produção.
- Status: APROVADA E EXECUTADA

## D-010 — Integração SGI manual e retomável

- Data: 2026-08-14
- Decisão: a interface HTTP real do SGI foi confirmada na VPS e a criação do
  produto consolidado será manual, exclusiva da Lebebe Exclusive e acionável
  somente em `VENDA FECHADA`. O App persistirá estado/IDs por etapa; um worker
  outbound na VPS consultará rotas internas autenticadas do App, sem endpoint
  público na VPS. Nome, custo e preço serão congelados na primeira tentativa e
  não haverá sincronização depois da conclusão.
- Impacto: exige persistência 1:1 por pedido, claim concorrente, checkpoints
  autenticados, estado local de recuperação no worker e UI compartilhada entre
  card e detalhe. O fluxo Moriah permanece intocado.
- Status: APROVADA PELO PEDIDO ATUAL E EM EXECUÇÃO
