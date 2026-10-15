# Decisões — Decorisi

## D-011 — Commit e push na main

- Data: 2026-10-14; APROVADA expressamente pelo usuário nesta conversa.
- Autoriza versionar e enviar para `main` exclusivamente as alterações Decorisi e suas integrações, testes, scripts e migrations já aplicadas. Substitui a restrição anterior de commit/push para esta entrega.
- Não autoriza deploy manual, ativação comercial, alteração SGI/VPS ou inclusão de trabalhos paralelos. Artefatos locais de `output/`, secrets e alterações de outros projetos ficam fora do commit.

## D-010 — Xadrezia e ajustes finais do formulário

- Data: 2026-10-13; APROVADA expressamente pelo usuário: **XP = Xadrezia**. Doce Bebê permanece DB701–DB745/DB801–DB845. Papel catálogo e personalizado podem usar ambos; painéis continuam Fofura/arte personalizada.
- Fonte atual recuperada da calculadora oficial: 132 XP001–XP132 distintos; 90 DB conferidos contra a extração anterior, sem diferenças de repetição. SHA256 `9234cbe66712f156dfb3fbf66cd25311ba5bab646ddd0424adcb9386a294047e`. O HTML original completo não estava preservado no repositório; reextração atual arquivada em `output/decorisi-fonte-xadrezia.html`. JSON XP contém fonte, data e hash.
- DB e XP pertencem ao mesmo objeto `modeloRepeticoes` e à mesma fórmula da fonte: largura 0,62m, comprimento 10m, margem 5cm. Não encontrada ramificação física/comercial por prefixo nessa calculadora. Mantidos produtos SGI 36565/36566 para papel; preços não modificados. O arredondamento comercial existente por arte foi preservado.
- Origem do catálogo é identificada pelo prefixo persistido; nomes técnicos `referencia_db_id` e resposta `db` foram preservados por compatibilidade e agora abrangem DB/XP. A escolha de catálogo da interface não acrescenta campos ao contrato da RPC.
- Migration incremental submetida pelo MCP oficial e aceita: `20261013204930_decorisi_catalogo_xadrezia.sql`. Amplia apenas a constraint de referências e insere os 132 XP; não altera funções, triggers, grants, RLS, preços ou pedidos. Os 90 registros DB permaneceram integralmente iguais na comparação antes/depois. Nome local alinhado ao registro remoto, sem reaplicação de migrations anteriores.
- Máscara autorizada específica Decorisi: entrada em centésimos de metro, até quatro dígitos (99,99m), vírgula automática e duas casas. Substitui a digitação decimal manual da rodada anterior; domínio SQL em centímetros e máscaras dos outros módulos não mudam. Dados antigos carregados não são truncados automaticamente.

## D-009 — Aplicação e homologação nominativa autorizadas

- Data: 2026-10-13; APROVADA explicitamente pelo usuário após as rejeições anteriores.
- Migration Fase 5 revisada aplicada exclusivamente por `apply_migration`; MCP registrou versão 20261013141811. Arquivo local renomeado para essa versão, sem alterar SQL nem reaplicar as seis migrations anteriores.
- Autorizada limpeza exata do teste antigo e de novos sintéticos, após consulta dos relacionamentos/IDs. Histórico removido somente pelo operador MCP; nenhuma alteração de auditoria/grant do backend. Limpeza em lote teve erro de sessão da ferramenta; leituras confirmaram ausência de execução, e transações menores por fixture concluíram pelo mesmo canal.
- Validações reais concluíram fluxo completo, retorno, cancelamentos, concorrência e anexos por status. Ordenação explícita de itens/medidas/anexos e resumo específico Decorisi corrigem falhas observadas sem alterar regra comercial ou fornecedores existentes.
- Interrupção forçada pelo terminal pode impedir o handler de saída do processo. Acrescentado `--revogar` ao inicializador para revogação explícita; expiração no banco e encerramento por timer continuam como proteção adicional. Zero acesso temporário ao final foi confirmado.

## D-008 — Finalização para homologação sem publicação

- Data: 2026-10-13; APROVADA pelo pedido de automação e retomada do usuário.
- A autorização atual substitui os limites temporais de D-002/D-006 quanto à Fase 5, aplicação da migration pendente pelo mecanismo revisado e testes sintéticos no Supabase atual. Não autoriza contornar rejeições, liberar globalmente, alterar SGI/VPS, commit, push ou deploy.
- Preservar o histórico append-only para service_role. Limpeza de fixture fechada exige operador autorizado pelos IDs registrados; não conceder DELETE ao backend apenas para testes.
- Homologação local reutiliza a tabela de testadores já existente, expiração explícita de 1–8h (padrão 2h) e revogação ao encerrar. O inicializador recusa abrir acesso enquanto a RPC Fase 5 não estiver instalada. Sem novo bypass ou ampliação de módulo/unidade.

## D-001 — Contrato comercial e composição

- Data: 2026-10-09.
- Status: APROVADA.
- Decisão: preservar arquitetura compartilhada/específica e regras descritas no ESCOPO aprovado; centímetros, um card por arte, repetições DB reais, PF opcional somente em painel personalizado, anexo de catálogo opcional, confirmação de cotação alterada.
- Impacto: não reaproveitar arredondamento/limites comerciais Moriah; cálculos e composição Decorisi independentes.

## D-002 — Execução local sem ativação

- Data: 2026-10-09.
- Status: APROVADA.
- Decisão: executar o máximo seguro das Fases 1–3 localmente. Não aplicar migrations, ativar fornecedor, alterar VPS, disparar integrações reais ou fazer commit/push.
- Impacto: flags não configurados; dependências externas não impedem trabalho local independente.

## D-003 — Cache existente e unidades confirmadas

- Data: 2026-10-09.
- Status: APROVADA.
- Decisão: carga inicial feita por outro Codex às 14:33 BRT; nunca repetir. Usuário confirmou unidade papel = rolo, painéis = m². Revalidado via MCP no projeto phsoawbdvhurroryfnok: quatro pares ID/código, preços 530/660/230/320, ativos/em linha, timestamps 17:33:02–04 UTC.
- Impacto: preparar vínculos usando a FK existente. Nenhum novo sincronizador, preço ou unidade alterado.

## D-004 — Isolamento técnico da entrega inicial

- Data: 2026-10-09.
- Status: APROVADA (execução técnica dentro do escopo D-002).
- Decisão: APIs específicas Decorisi, cotação na rota compartilhada nova; gate PEDIDOS_DECORISI_BACKEND=true mais fornecedor disponível. Fechamento específico com proteção no cabeçalho contra fechamento genérico sem snapshot. Rotinas Moriah/Exclusive não alteradas.
- Impacto: conectar posteriormente o dispatch da API de status compartilhada e o fluxo pós-venda; assinatura antiga preservada. PGlite temporário valida SQL em fixture estrutural mínima, sem dependência nova na aplicação. E2E/concorrência entre conexões reais continuam pendentes.

## D-005 — Validação nativa com schema relevante e HTTP

- Data: 2026-10-09.
- Status: EXECUTADA dentro da autorização de validação local; substitui a limitação de concorrência de D-004.
- Decisão: com Docker indisponível, usar PostgreSQL 17.6 nativo descartável e PostgREST 16.4 oficial, somente loopback. Reproduzir os metadados das 18 tabelas que fecham as FKs do módulo, incluindo funções/ACLs/policies/triggers; criar somente dados sintéticos. Nenhum dump de registros de produção ou dependência adicionada ao aplicativo.
- Provisionamento: instalação temporária via npm de @embedded-postgres/windows-x64@17.6.0-beta.15 e pg; binário PostgREST obtido na release oficial v16.4. DECORISI_PG_DEPS aponta ao node_modules temporário e DECORISI_POSTGREST_BIN ao executável. Scripts encerram processos e removem cada cluster criado, após checagem do caminho temporário.
- Impacto: concorrência e transporte HTTP do repositório validados; JWTs locais testam PostgREST/roles, sem equivalência com login GoTrue. Sem gateway/Storage/Preview nem confirmação da versão PostgREST de produção. Essas validações permanecem gates operacionais anteriores à ativação; Fase 4 depende de aprovação humana.

## D-006 — Autorização da Fase 4

- Data: 2026-10-09; APROVADA pelo pedido atual anexado.
- Executar formulário e anexos localmente, preservando os gates de disponibilidade/autorização. Reabertura pelo formulário existente com decorisiPedido na URL, sem criar tela de gestão. Número de lançamento permanece no fechamento; não integra o rascunho Decorisi.
- Fase 5, migrations remotas, ativação, deploy, VPS/SGI e commit/push continuam não autorizados.

## D-007 — Upload idempotente e compensação durável

- Data: 2026-10-09; IMPLEMENTADA localmente.
- Reservar a compensação na fila Storage existente antes do upload; janela técnica de 24h. Registrar metadados e concluir essa reserva na mesma transação. Recusar reserva próxima do vencimento para não disputar objeto com consumidor.
- Path determinístico por chave UUID e SHA-256 dos bytes permitem conferir replay sem upsert. Resposta perdida nunca dispara exclusão imediata de objeto potencialmente confirmado. Substituição/remoção enfileiram caminho antigo atomicamente; exclusão do produto inclui anexos na transação.
- Reutilizar StorageAnexos, validador de assinatura/MIME/tamanho e consumidor existente. Metadados ficam na FK de item Decorisi. Parser compartilhado conserva dois slots por padrão; Decorisi pede cinco explicitamente.
- Congelar payload de criação/envio enquanto confirmação estiver incerta; recarga após edição ambígua/conflito exige confirmação. Gerenciar anexos exige primeiro salvar alterações locais, evitando perda ao reidratar.
- Ensaio visual em Vite loopback, componentes reais e APIs simuladas; nenhuma rota de bypass no aplicativo. Storage/GoTrue reais continuam pendentes.

## D-012 — Homologação no localhost normal

- Data: 2026-10-14; autorizada pelo usuário.
- `npm run dev` prepara acesso nominativo após autenticação, módulo, janela e unidade; somente NODE_ENV=development, loopback e sem VERCEL_ENV. Reutiliza testadores, com prazo fixo máximo de oito horas por processo, sem renovação por requisição/HMR. Não sobrescreve acessos ativos nem finalidade diferente.
- Produção mantém o gate anterior e disponibilidade comercial desativada. Sem migration, mudança SGI ou bypass de autenticação. Revogação antecipada pelo script existente; encerrar o processo não revoga imediatamente, mas o prazo no banco permanece obrigatório.

## D-013 — Papel de catálogo dispensa layout e aprovação

- Data: 2026-10-14; regra comercial confirmada pelo usuário.
- Quando há itens e TODOS são PAPEL/CATALOGO, o fluxo é VENDA FECHADA → EM PRODUÇÃO → RECEBIDO. Papel personalizado, painel Fofura, painel personalizado e qualquer mistura mantêm layout/aprovação. Não inferir pelo primeiro item nem pelo catálogo DB/XP.
- RPC Decorisi calcula a condição na composição persistida sob lock do pedido; rejeita layout/aprovação para dispensados e produção direta para demais. Compra, data do pedido, comprador e previsão de entrega continuam obrigatórios ao entrar direto em produção. Histórico contém somente as transições executadas; versão/concorrência/ACL/escopo permanecem preservados.
- Nenhum pedido existente foi reclassificado ou atualizado pela migration. Funções, triggers, políticas e permissões compartilhadas Moriah/Exclusive não são alteradas. Sem nova etapa, preço, cálculo, referência ou ativação comercial.
