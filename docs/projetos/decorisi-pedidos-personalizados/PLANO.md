# Plano — Decorisi

**Estado do planejamento:** DEFINIDO

## Xadrezia e ajustes finais — D-010

- [x] Conferir fonte, 132 XP únicos/repetições e regressão dos 90 DB.
- [x] Preparar/aplicar migration incremental pelo MCP oficial; conferir 222 referências e segurança preservada.
- [x] Separar Doce Bebê/Xadrezia, pesquisa código/número e confirmação ao trocar catálogo.
- [x] Máscara automática com quatro dígitos; resumo financeiro abaixo das medidas e divisores DS.
- [x] Testes direcionados, SQL descartável e navegador com componentes reais/APIs simuladas (desktop/móvel), incluindo salvar/reabrir XP.
- [x] Conferência autenticada de 14/10 dos quatro requisitos em aplicação local/Supabase reais: XP catálogo/personalizado, salvar/reabrir, foco/erros, máscara sem blur, cálculo/resumo/separadores e móvel sem overflow; limpeza exata e revogação concluídas. Sem novas migrations ou alterações de código.
- [ ] Rehomologação do usuário na aplicação autenticada; não equivale ao preview isolado.

## Correção após homologação visual — 13/10

- [x] Perguntas contextuais, composição DS e preservação de dados com confirmações.
- [x] Máscara PT-BR, normalização ao sair/reabrir e erros por parede sem nova regra comercial.
- [x] Testes direcionados/regressões (640), lint, typecheck classificado, build e navegador desktop/móvel com componentes reais em preview isolado.
- [ ] Rehomologação pelo usuário na aplicação autenticada: rascunho/reabertura, anexos e fechamento. Procedimento nominativo e checklist abaixo continuam vigentes; nenhuma migration adicional.

## Fase 1 — Base, catálogos e cálculos

- [x] Quatro estruturas Decorisi com FKs, índices, constraints, RLS e grants do backend.
- [x] Extrair 90 referências DB reais e preparar importação com fonte/hash; preservar 12 zeros.
- [x] Catálogo PF200–PF280 pesquisável e validações compartilhadas.
- [x] Cálculo exato TS e SQL; agrupamento por altura e arredondamento por arte; painel m² exato.
- [x] Validar migrations em PostgreSQL isolado e paridade de cálculos.
- [x] Validar contra schema das dependências reais (18 tabelas via metadados MCP), em PostgreSQL 17.6 nativo descartável, sem dados de produção.
- [ ] Validar stack Supabase completo/Preview (GoTrue, gateway, Storage e E2E); alternativa nativa não equivale ao ambiente completo.

## Fase 2 — Vínculos e sincronização existente

- [x] Revalidar quatro IDs/códigos/preços/status/timestamps no cache real após carga externa autorizada.
- [x] Registrar confirmação humana das unidades comerciais.
- [x] Preparar rotina/migration fail-closed de vínculos, sem alterar cache/fornecedor.
- [x] Vínculos aplicados e quatro preços/IDs SGI revalidados no Supabase autorizado, sem nova carga.
- [ ] Confirmar próxima revalidação natural e entrega legítima do produtor com responsável VPS (fora desta execução; não alterar VPS).

## Fase 3 — Backend

- [x] Tipos, validações, criação idempotente e edição atômica de rascunhos/medidas/identificação.
- [x] Consulta autenticada de referências e pedido; escopo de unidade/propriedade.
- [x] Cotação autoritativa e fechamento com nova confirmação, locks, versão, idempotência e snapshot.
- [x] Proteger composição após venda, anexos por status e caminho genérico sem snapshot.
- [x] Testes locais de cálculo, preço, persistência e autorização; regressões Moriah/Exclusive.
- [x] Validar concorrência real entre conexões: edição, fechamento, timeout/replay, preços/repetições, snapshots e rollback parcial.
- [x] Validar repositório real → PostgREST → PostgreSQL local, consultas aninhadas, filtros, RPCs e ACLs/JWTs sintéticos.
- [x] Validar sessão/login real e Storage no Supabase atual autorizado, junto ao fluxo da Fase 4.
- [x] Integrar fechamento/etapas posteriores à API de status compartilhada; fluxo real validado, fornecedor permanece desligado.

## Fase 4 — Formulário e anexos (autorizada em 09/10/2026)

- [x] Seleção gated no formulário existente, identificação compartilhada e cards próprios Decorisi.
- [x] Pesquisa DB/PF, uma arte por card, personalizados distintos, limites 10/20/5 e prévias pelas funções de domínio.
- [x] Criar, editar e reabrir rascunho; preservar IDs/anexos; versão, idempotência, bloqueio simultâneo e recuperação de falhas.
- [x] APIs privadas de upload/substituição/abertura/remoção e fila existente de limpeza com compensação durável.
- [x] Testes locais de frontend/domínio, handlers, SQL, concorrência e regressões; ensaio de navegador com APIs simuladas.
- [x] Validar login/sessão, upload/download/URL assinada e consumidor de limpeza no Supabase atual autorizado; Preview/deploy público permanece pendente.

## Fase 5 — Gestão e fluxo operacional
- [x] Preparar gestão compartilhada com filtro por fornecedor, listagem/detalhe de itens Decorisi, referências, medidas, anexos e cotação autoritativa.
- [x] Preparar retomada de rascunho e fechamento de venda com confirmação da cotação completa, versão otimista e endpoint existente de congelamento de preços.
- [x] Preparar RPC de transições posteriores com validações, escopo, histórico e campos operacionais; migration local criada.
- [x] Revisar a migration contra metadados reais; corrigir catálogo sem anexo, cancelamento de rascunho, versão nula/ambiguidade, retorno de layout com snapshot intacto e anexos pós-venda.
- [x] Validar SQL em PostgreSQL descartável (28 cenários), concorrência (17) e anexos (8), incluindo regressões legadas e ACL/RLS.
- [x] Validar gestão/filtros/detalhes e fechamento/replay/snapshot/histórico por HTTP contra o Supabase atual.
- [x] Aplicar migration pelo MCP (versão oficial 20261013141811) e validar transições reais com registros sintéticos.
- [x] Validar concorrência, histórico, anexos e regressões no fluxo operacional após a aplicação.
- [x] Remover a fixture fechada anterior e os sete pedidos desta fase, incluindo histórico e dependentes exatos; ausência de resíduos confirmada.

## Fase 6 — Homologação técnica (autorizada; ativação comercial excluída)

- [x] Build completo com rede e fontes originais; 636 testes direcionados; typecheck comparado ao HEAD; lint e suíte completa executados.
- [x] Inicializador nominativo local com expiração e revogação; sintaxe e gate antes da migration validados.
- [x] Revogar o acesso técnico desta retomada; confirmar `disponivel=false` e zero testadores.
- [x] Conferir navegador autenticado, detalhe/histórico/anexos/resumo, filtros e responsividade; status exercitados por HTTP/RPC reais.
- [x] Confirmar ausência total de resíduos e revogação nominativa, via MCP.
- [ ] Homologação manual pelo usuário. Publicação/ativação comercial dependem de autorização futura.

## Qualidade — retomada de 13/10/2026

- Suíte completa final: 3.419 aprovados, 19 falhas, 6 ignorados; 211 arquivos aprovados / 5 com falhas. Nenhuma falha provocada pela Decorisi foi identificada. Os 5 arquivos/fluxos permanecem idênticos ao HEAD (`git diff --exit-code HEAD -- ...`).
- Procurar Datas: 8 falhas em `agenda-real-helper` dependem de autenticação Google não mockada e DNS/rede; 8 em `diagnostico` e 1 em `pesquisar-compat` reproduzem divergências de contrato/fixture do fluxo existente. Não houve alteração nesses arquivos. Não inferir falha operacional de produção a partir dessas falhas.
- Hub/Vendas: 1 asserção desatualizada espera `Cancelados:` enquanto a mensagem vigente esclarece o acumulado; alteração anterior e independente da Decorisi. Atendimento automático: 1 divergência de texto/data no exemplo fixo. Ambos preexistentes; não corrigidos fora do escopo.
- `npx tsc --noEmit`: 15 erros em testes de auth/Hub Vendas; `node scripts/decorisi/validar-typecheck.mjs` confirma `diagnosticosIdenticos=true` entre fontes HEAD e worktree. Sem diagnóstico Decorisi.
- `npm run lint`: 16 erros e 59 avisos no repositório (inclusive artefato `output/pdf`); lint do módulo encontra erro preexistente em SeletorCores e aviso de useEffect na Gestão. Não modificar módulos alheios para zerar a saída global.
- `npm run build` com rede aprovado no código final; versão sandbox falha ao buscar Caveat/Geist/Geist Mono. Nenhuma fonte ou configuração de produção substituída. Não executar build e dev ao mesmo tempo (cache .next compartilhado).
- Advisors remotos antes da tentativa: tabelas Decorisi com RLS e sem policies para acesso cliente, conforme arquitetura de backend exclusivo. Avisos de funções SECURITY DEFINER/search_path e senha vazada pertencem a funções/configurações externas ao escopo. Nenhum DDL desta retomada foi aplicado.
- 13 etapas HTTP reais aprovadas: login, RLS, DB/PF/preços, rascunho/replay, cotação, edição/conflito, arquivo inválido, upload/replay, URL privada, substituição, remoção/consumidor, gestão/filtros/detalhe, fechamento/replay/snapshot/histórico. Fase 5 adicional: quatro produtos, transições até RECEBIDO, retorno layout, cancelamentos nos cinco status, concorrência e anexos por status aprovados em HTTP/RPC reais.
- Limpeza concluída: teste antigo e sete pedidos da Fase 5 removidos por IDs comprovados; zero pedidos/itens/medidas/anexos/histórico/Storage/fila residuais e zero testadores confirmados via MCP. Nenhuma permissão permanente ampliada.

## Checklist de homologação local

**Pré-requisitos técnicos concluídos:** migration aplicada, RPC e limpeza validadas. Manter fornecedor globalmente desativado. O inicializador foi validado com acesso nominativo real e expiração automática.

1. No PowerShell: `cd C:\le-bebe`. Usar o `.env.local` já configurado, sem copiar secrets para logs. Encerrar seu `npm run dev` deste checkout antes de iniciar o script, mesmo em outra porta: ambos usam o lock `.next/dev`. Liberar a porta 3014 e não executar build simultâneo.
2. `node scripts/decorisi/homologar-local.mjs --email agente.teste@lebebe.cloud --horas 2`. A conta precisa manter seus módulos/unidades atuais; o script não concede permissões adicionais. A inicialização e a expiração foram validadas.
3. Abrir `http://127.0.0.1:3014/agente`, iniciar a sessão técnica pelo mecanismo existente e depois abrir `/pedidos-personalizados/novo`. Secret somente no formulário seguro. Para usuário autorizado diferente, informar seu email no comando e usar seu login habitual.
4. Selecionar Decorisi. Nomear cada cliente `TESTE DECORISI <identificador curto>`, registrar ID do pedido da URL e todos os arquivos de teste. Criar os quatro tipos, catálogo e personalizado, medidas múltiplas e rascunho incompleto. Salvar, reabrir e editar.
5. Digitar somente dígitos: `350` → `3,50m`, `270` → `2,70m`, `10000` → `10,00m` (quinto dígito recusado). Testar Backspace, Delete, seleção e colagem numérica. Doce Bebê/DB813 e Xadrezia/XP001, 3,50 × 2,70m: 2 rolos; XP001 usa repetição 0,50m. Catálogos não misturam DB/XP; trocar e cancelar preserva seleção, confirmar limpa só a referência incompatível. Papel personalizado também aceita XP. PF200, 1,01 × 1,01m: 1,0201m². Conferir resumo logo após medidas, cotação indisponível e altura de papel impossível sem subtotal. A UI persiste centímetros inteiros e usa os preços atuais, sem hardcode. Confirmar agrupamento por arte e limites 10 produtos/20 medidas/5 anexos.
6. Catálogo fecha sem anexo. Personalizado exige descrição/anexo por produto. Enviar PDF/imagem sintéticos, abrir, substituir e remover. Último anexo personalizado após venda não pode ser removido; produção/recebido permitem adicionar, preservando restrições de substituição/remoção.
7. Abrir `/pedidos-personalizados`, filtrar Decorisi e o nome sintético, conferir itens/medidas/anexos/cotação, fechar com lançamento sintético e avançar: VENDA FECHADA → AGUARDANDO LAYOUT → AGUARDANDO APROVAÇÃO DO CLIENTE → EM PRODUÇÃO → RECEBIDO. Informar campos obrigatórios, testar retorno para layout e cancelamento em pedido separado. Conferir histórico único, versão e snapshots.
8. Para concorrência, duas abas sobre o mesmo pedido: ação antiga deve gerar conflito, sem duplicar fechamento/histórico. Não alterar cache SGI para testar manualmente snapshots; essa variação já é coberta no SQL local.
9. Encerrar com Ctrl+C e executar `node scripts/decorisi/homologar-local.mjs --email agente.teste@lebebe.cloud --revogar` para confirmar revogação, inclusive se o terminal tiver sido encerrado à força. Prazo máximo de 8h, padrão 2h; nunca manter testador indefinidamente. Registrar IDs para operador limpar exclusivamente os testes, incluindo histórico protegido. Não usar DELETE por fornecedor nem conceder DELETE ao backend. Confirmar pedidos/itens/medidas/anexos/Storage/fila e acesso temporário zerados.
