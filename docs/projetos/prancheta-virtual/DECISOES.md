# Decisões — Prancheta Virtual

## D-051 — Publicação de nomes e filtros de consultoras (22/10/2026)

Usuário aprovou verificar e publicar em main as duas melhorias pendentes: nomes de consultora sem diferenças de acentuação e filtros de Registros com opções atualizadas ao abrir, carregamento paginado completo e filtros adicionais antes de Virada do cartão. Preservar autenticação, janela, escopo por perfil/unidade e dados comerciais. Migration 20261020135931 já aplicada e confirmada no MCP, função/gatilhos vigentes e nomes canônicos; não reaplicar nem fazer novo backfill. Publicar somente este pacote, testes e suas seções documentais, preservando alterações de outras tarefas.

Complemento D-050 (22/10/2026): usuário autorizou o agente a executar commit, push e deploy somente dos arquivos desta entrega. Substitui a reserva anterior de commit/push ao usuário; demais limites e exclusão de alterações paralelas permanecem.

## D-050 — Histórico comercial entre filiais; publicação pelo Git (22/10/2026)

Usuário aprovou explicitamente substituir a restrição comercial de D-049: pessoas já autorizadas ao Atendimento Presencial consultam as compras do cliente em todas as filiais, por telefone ou pela associação segura da Prancheta, inclusive sem telefone e sem atendimento próprio prévio. Mantidos os dez documentos mais recentes após união/deduplicação. Isto não libera registros completos, edição, módulos administrativos nem pedidos personalizados de outras unidades.

O parâmetro de atendimento exato continua restrito ao detalhe autorizado; histórico usa NULL exclusivamente no backend. Candidatos e ambiguidades continuam globais; diagnósticos são contados somente no escopo original de unidade/consultora. A resposta comercial não inclui IDs, início, observações ou conteúdo interno dos atendimentos de origem. Função permanece STABLE/INVOKER, executável apenas por service_role, com autenticação/módulo/janela e contexto verificados nas APIs. Não alterar grants de usuários, RLS, tabelas, índices ou importador.

Publicação autorizada somente pelo mecanismo estabelecido, sem commit/push pelo agente e sem contorno. MCP Vercel confirmou produção de origem Git/main, SHA 5765d72b6f91bdb38b72f7c536bae3455f162b3a, deployment dpl_HKC7A6QCszwLDP6u9AM61We6ymww, domínio lebebe.cloud. Correção local depende de commit/push pelo usuário para entrar nesse fluxo. Não publicar árvore anterior nem enviar arquivos por mecanismo alternativo. A nova função pode ser aplicada independentemente: só acrescenta a leitura comercial já autorizada e mantém o contrato/ACL anterior.

## D-049 — Associação dinâmica SGI por cadastro da Prancheta (21/10/2026)

Usuário aprovou implementação: lançamento exato + filial explicitamente mapeada + diferença absoluta de até dois dias de calendário entre início do atendimento e fechamento SGI, em America/Sao_Paulo. Atendimento concluído/venda fechada, cliente ativo/nome preenchido, documento válido e importação concluída sem erros. Telefone é opcional na associação complementar por cliente_id; não localizar por nome, criar cadastro, sobrescrever cliente/SGI ou persistir vínculos. Unir com a busca telefônica existente, deduplicar pelo ID SGI e limitar dez após a união. Ambiguidades globais pertinentes bloqueiam antes dos filtros de apresentação; detalhes de concorrentes nunca são expostos.

Função SQL STABLE/SECURITY INVOKER, restrita a service_role, sem cron/worker/tabela/índice novo. API fornece usuário/perfil/unidades autenticados e valida a janela de acesso. Consultora continua limitada aos atendimentos próprios e unidades autorizadas; a busca telefônica exige atendimento próprio concluído, inclusive negociação/perda, enquanto a associação complementar exige venda fechada. Variantes telefônicas anteriores só são usadas se ainda corresponderem ao cadastro no snapshot SQL. Nome/telefone contraditório bloqueia a associação complementar. Mudanças antigas de nome/telefone não podem ser reconstruídas sem snapshots independentes, que não existem nos dados auditados.

Pendência técnica SEPARADA: UNIQUE(numero_lancamento) e upsert global podem sobrescrever documentos de filiais diferentes. Não corrigir chave/importador/constraints nesta entrega; datas não recuperam registros sobrescritos. Importação Python e indicadores permanecem intactos. Usuário proibiu commit/push; publicação do app não foi executada.

Revisão automática rejeitou uma variante que retirava o vínculo próprio da consultora da busca telefônica. Ela não foi aplicada. A alternativa aprovada preserva explicitamente o vínculo próprio; não houve concessão de perfil/módulo ou ampliação de unidades.

## D-042 — Migration e publicação de Produtos/PV, enxoval e comemoração (20/10/2026)

Usuário aprovou a prévia e autorizou commit, push, deploy e migration desta entrega. Aplicada isoladamente pelo MCP como 20261020193639 / prancheta_produtos_pv, após conferir os cinco hashes reais, índice único e ausência das novas colunas. Nome local alinhado à versão registrada pelo Supabase, sem replay/repair. Pós-verificação: três campos nullable sem defaults, trigger ativo, validação de nomes repetidos aceita, RLS/policies preservadas, helper sem EXECUTE para anon/authenticated. Hash dos 172 produtos anteriores preservado: 86608eb4d5a1d3700c4f318cfb974274; uma nova linha comercial foi criada pela operação durante a janela, sem classificação dos históricos pela migration.

Vercel MCP retornou 403 para leitura/configuração de variáveis de produção; CLI não disponível. Usuário configurou e confirmou NEXT_PUBLIC_PRANCHETA_PRODUTOS_V2=1 em Production antes do push, sem redeploy manual. A flag será incorporada pelo build do commit autorizado. Sem alteração de .env local. Alterações preexistentes de consultoras/filtros e outros módulos ficam fora do commit, inclusive hunks mistos em ficha-schema/RegistrosPageClient. Homologação autenticada comercial e em aparelho físico continua separada e não é inferida da aprovação visual sintética.

Candidato selecionado validado: 475 testes/44 arquivos e ESLint aprovados; build de produção com flag=1 aprovado. Quatro testes adicionais de consultoras do workspace não pertencem ao commit. A seleção parcial inicial deslocou JSX no index; a exportação/teste detectou antes de qualquer commit, e a seleção foi reconstruída sem mudar os arquivos de trabalho. No ambiente descartável, somente a raiz de resolução do Turbopack foi adaptada para reutilizar dependências do workspace; next.config.ts publicado permanece intacto. Diff-check aprovado, exceto espaços finais intencionais da captura SQL original, necessários ao hash do fixture.

Publicação em andamento: verificar SHA enviado, build READY e domínio lebebe.cloud antes de declarar encerrada. Recuperação preserva colunas, metadados e leitores compatíveis; para suspender entrada, desativar a flag em novo build, sem restaurar escritores/normalizadores antigos sobre dados estruturados.

## D-041 — Marcação, edição dos produtos e comemoração do PV (20/10/2026)

Usuário aprovou o refinamento local: entrada/+, botões Lista de enxoval e Produto que não trabalhamos, cabeçalho Produto | Qtd | Vendido, linhas e PV. Marcar alterna para ✓ Vendido verde, preservando quantidade; × permanece visível e com alvo de 44px. Percentual sem teto, com barra limitada à largura: 6=120%, 7=140%. Substitui a posição/chave da D-040.

Nome editável na linha: Enter/blur confirma, Esc cancela; maiúsculas, acentos, espaços simples, até 80 caracteres e nome não vazio. Marcador especial não é renomeável. Edição pode produzir nomes iguais; não mesclar nem somar. Inclusão pela barra incrementa somente a primeira correspondência normalizada, preservando seu estado Vendido; esta escolha substitui a seleção explícita antes prevista para múltiplas correspondências históricas. Validadores TS/SQL aceitam repetições estruturadas. Ajuste incorporado somente à migration local ainda não aplicada: remover o índice único por descrição após preflight exato, sem backfill, consolidação ou alteração dos registros existentes.

Comemoração compartilhada com /preview-pv-batido: somente após resposta válida de conclusão com Venda fechada e PV ≥ 5, usando o rascunho sincronizado antes do reset. Exibir quantidade/percentual reais, foguetes/fogos finitos, fechar em cerca de 5s ou por Continuar/×/Esc. Som Web Audio local de três notas ascendentes suaves, total de 1,5s, preparado no gesto de finalização e tocado uma vez após sucesso; bloqueio do áudio não interfere na venda. Fechar interrompe notas; redução de movimento apresenta cena estática. Sem comemoração em erros, perda/negociação, edição ou recarga; sem novo atendimento automático. Solicitação adicional do usuário: substituir a estrela pela logo oficial existente em public/logo.png, reutilizando BrandLogo sem modificar o arquivo da marca.

Implementação e testes locais autorizados. Migration remota, ativação, commit, push e deploy permanecem etapas separadas; não foram autorizados por este refinamento. Testes sintéticos não substituem homologação autenticada/integrada ou dispositivo físico.

## D-040 — Referência visual de produtos e PV (20/10/2026)

Usuário solicitou revisar o desenho e forneceu imagem de referência: entrada com placeholder, cabeçalho ciano, produtos em cartões brancos, quantidade agrupada, chave de venda azul/cinza e PV em faixa com ícone/meta/percentual. Explicitou que o × de remoção deve continuar visível em cada produto. Ajuste local no componente compartilhado/CSS, sem alterar cálculo, contratos ou persistência. Mantidos alvos de 44px e adaptação por largura útil; acesso de enxoval fica após o bloco de produtos. Prévia sintética em localhost:3224 com os quatro produtos do exemplo, sem gravação no banco. Sem publicação.

## D-038 — Produtos e PV: implementação local aprovada (20/10/2026)

Usuário aprovou o plano desta conversa e pediu implementação. Venda aplica-se a toda a quantidade da linha; Negociação/Perda com item vendido avisa sem bloquear; históricos mantêm Não informado; marcador genérico preservado e fora do PV. PV é derivado dos itens, com referência visual 5, sem inferir venda pelo resultado comercial. Compatibilidade por leitura de strings/objetos e versaoProdutos=2; campos novos nullable, sem backfill. Edição de outro campo deve preservar IDs/datas/grafia dos produtos.

Controle de ativação escolhido para cumprir a publicação gradual aprovada: NEXT_PUBLIC_PRANCHETA_PRODUTOS_V2=1 habilita novas escritas; ausente permanece desligado. Leitores/editores continuam preservando dados já estruturados mesmo se a ativação for desligada. Sem alteração de arquivos de ambiente. Migration 20261020162142_prancheta_produtos_pv gerada pela CLI oficial e preparada a partir das definições reais/hashes MCP; não aplicada remotamente. Publicação e homologação integrada permanecem gates separados.

## D-039 — Enxoval: materiais fornecidos e vinculação autorizada (20/10/2026)

Usuário forneceu INVERNO 1–4 e VERÃO 1–4 e autorizou vinculá-los. Arquivos copiados sem alteração para public/listas-enxoval; hashes iguais aos originais. Modal oficial DS, escolha de estação e páginas em ordem, abertura do original. A semelhança de conteúdo nas páginas Verão 3/4 foi observada; não autoriza substituir/corrigir o material. Não houve conversão, upload remoto ou publicação.

## D-030 — Feedback dos resultados e autosave das lojas autorizados (16/10/2026)

Após auditoria do relato de demora em iPhone com atalho da tela inicial, usuário autorizou corrigir feedback visual de Negociação/Venda perdida e a alteração isolada do nome da loja, incluindo commit, push e deploy completos. Reutilizar loading/guard/oportunidade de pintura já existentes na conclusão; validar antes de alterar o resultado nesses dois caminhos e preservar regras comerciais. Incluir lojasMotivos na comparação canônica do autosave. Sem nova migration ou mudança de permissões. Validação sintética não substitui reteste no iPhone físico; não atribuir causa exata aos 5–10 segundos sem perfilamento.

## D-029 — Migration, commit, push e deploy autorizados (16/10/2026)

Usuário autorizou explicitamente publicar o refinamento D-028, incluindo aplicar a migration preparada, commit e push na main e deploy para homologação em lebebe.cloud. Aplicar somente esta migration, validar schema/ACL e integridade de históricos, publicar allowlist da Prancheta e dependências de testes revisadas, preservar alterações de outros módulos. Sem repair/replay/backfill, automações, novas permissões ou reabertura automática das lojas. Homologação humana permanece posterior à publicação. Autorização substitui os gates de publicação local de D-028, não o escopo funcional.

## D-028 — Refinamento funcional autorizado localmente (16/10/2026)

Pedido atual aprova listas separadas de Negociação/Venda perdida, sete motivos de Não cliente, nomes opcionais das lojas por motivo, apresentação histórica sem IDs, início de novo autosave após filial/consultora/tipo, confirmação compacta de nova criança no rascunho, recusa explícita de telefone por finalização e destaque SEM TELEFONE, e atalho Produto que não trabalhamos. Substitui exclusivamente as reservas anteriores D-003/D-004/D-007 relativas a estes itens. Preservar motivos históricos sem conversão, crianças novas efetivadas somente na conclusão, permissões e demais P2/P3. Preparar migration aditiva e testes locais; nenhuma migration remota, repair, backfill, commit, push ou deploy autorizados nesta rodada. Homologação humana e reabertura de lojas permanecem pendentes.

## D-018 — Correções urgentes e execução autônoma das Entregas 6–7

Em 15/10/2026 o usuário autorizou investigar produção somente em leitura e corrigir localmente navegação, telefone/histórico SGI, criação/autosave e conclusão/reset; depois implementar Entrega 6 e executar toda homologação isolada/sintética possível da Entrega 7. Autonomia para escolhas técnicas e correções dentro do escopo aprovado; bloqueios parciais não interrompem frentes independentes. Sem dados comerciais fictícios em produção, migrations v2 remotas, repair/replay, commits, push, deploy ou abertura dos gates publicados. Correções urgentes devem ser identificadas separadamente para possível publicação anterior à P1. D-017 permanece pendente; autorização não dispensa aprovação visual humana da revisão da Entrega 5.

## D-016 — Entrega 5 autorizada para desenvolvimento local

Em 15/10/2026 o usuário aprovou visualmente o fluxo sintético da Entrega 4 e autorizou exclusivamente a Entrega 5: crianças permanentes, vínculo/parentesco por cliente, correspondência histórica, seleção/reutilização e confirmação explícita atômica/idempotente independente da conclusão. Novas crianças seguem efetivação na conclusão. A Entrega 4 não está integralmente homologada: banco real/finalização v2 pendentes. Sem alterações reais, migrations em produção, deploy, commit, push ou abertura do salvamento v2. Não antecipar Presente/estimativa de nascimento/idade dinâmica da Entrega 6 nem P2/P3. Estruturas preparadas localmente e testes sintéticos não autorizam ativação.

## D-017 — Simplificação da recuperação local pendente

Adendo à Entrega 5 solicita retirar o aviso e botões de cópias locais, preservando autosave e recuperação segura. A investigação confirmou que existem caches sem atendimentoId, anteriores à criação no servidor, cujo único acesso atual são esses controles. Foi proposta ação discreta Recuperar preenchimento, sob demanda e com escolha explícita, sem versões técnicas. O usuário escolheu “Manter esse ajuste pendente por enquanto”. Não ocultar os controles nem recuperar automaticamente uma cópia antiga; preservar proteção atual até nova decisão. Nenhuma ampliação das outras entregas.

Todas as decisões abaixo foram aprovadas pelo usuário em 15/10/2026. Status: APROVADA, salvo indicação explícita diferente.

## D-001 — Execução limitada à P1 por entregas

Sete entregas aprovadas; concluir e validar Entrega 1 antes de avançar. Registrar quatro documentos e índice antes de alterar código/banco. Sem commits, push, publicação ou migrations em produção sem nova autorização. Operações destrutivas não autorizadas.

## D-002 — Unidade e consultora em login compartilhado

Unidade única automática pelas permissões, inclusive após sucesso; múltiplas unidades: limpar seleção. Sempre limpar consultora após sucesso. Não compartilhar preferências entre dispositivos. Rascunhos existentes mantêm autorização e conflitos por versão.

## D-003 — Resultados e lançamento

Venda fechada conserva sim, exige lançamento inteiro 1–999999 e finaliza na primeira tela, sem motivos. Negociação conserva negociacao e perda conserva nao; ambas usam segunda etapa e lista comercial atual compartilhada. Observação complementar opcional até 300 caracteres. Remover revisão, preservar histórico e motivos antigos na edição.

## D-004 — Não cliente e troca de tipo

Oito motivos sem agrupamento, seleção única, conclusão direta sem dados comerciais fictícios. Troca de tipo preserva ramo oculto no rascunho, mas somente ramo ativo é efetivado. Cadastro de cliente anteriormente salvo permanece. Não cliente fora de indicadores comerciais.

## D-005 — Crianças históricas e parentesco

Criar identidade permanente e vínculo com parentesco; antecipar essa estrutura da P2. Sugestões históricas dispensam redigitação. Confirmação explícita salva cadastro/vínculo imediatamente e de modo atômico/idempotente; não depende da conclusão comercial. Preservar origem com correspondência separada. Não unir por nome. Próximos atendimentos não reconfirmam vínculo salvo. Novas crianças preparadas no rascunho seguem efetivação na conclusão.

## D-006 — Presente e idade aproximada

Presente/Já nasceu? pertence à P1 e ao contexto da criança no atendimento. Reutilizar campos. Estimativa DATE no dia 1, derivada da idade e data do atendimento, exibida dinamicamente e distinguida de data real/previsão. Sem backfill histórico especulativo.

## D-007 — Telefone reservado à P2

Opcional na P1. Obrigatoriedade, presente, atendimento misto, recusa e números evidentemente inválidos serão definidos na P2. Não antecipar exigência.

## D-008 — Erros específicos e incidente de lançamento

Mensagem junto a cada campo/grupo, destaque DS, foco/rolagem, limpeza ao corrigir e preservação de dados. Mensagens gerais apenas para operações. Reproduzir incidente dos quatro números válidos e corrigir causa comprovada; não justificar falha com regra inventada.

## D-009 — Compatibilidade e liberação

Migrations aditivas, leitores/escritores compatíveis antes de ativar escrita nova, histórico preservado e recuperação sem rollback destrutivo. Homologação dos quatro caminhos antes de lojas. P2/P3 fora da autorização.

## D-010 — Autorização condicional da migration da Entrega 1

Usuário autorizou exclusivamente 20261015182000_atendimento_presencial_normalizador_entradas.sql em produção, seguida somente de validações SQL de leitura. Exige hash/objeto esperados, alteração restrita, alvo ainda não aplicado, ausência de divergências históricas e recuperação disponível/validada. Qualquer divergência obriga interromper sem aplicar. Sem atendimentos reais alterados, deploy, commit, push ou Entrega 2. Registrar resultado e parar aguardando próxima autorização. Gate histórico não satisfeito: ver STATUS.md.

## D-011 — Correção urgente por SQL direto, sem registro artificial de migration

Em 15/10/2026 o usuário substituiu a preparação isolada pela autorização explícita de corrigir somente o normalizador em produção via SQL direto, preservando hash, assinatura, permissões, demais validações e recuperação. Aplicado em transação; validação somente leitura aprovada. Migration local preservada, com correção de terminador SQL, mas NÃO registrada como aplicada no remoto. Reconciliação futura deve considerar que o corpo novo já está efetivado e impedir execução duplicada. Homologação publicada somente por tentativa real acompanhada ou atendimento de teste autorizado, sem criar dados comerciais fictícios. Sem frontend publicado, outras migrations, repair, commits, push ou Entrega 2.

## D-012 — Encerramento operacional da Entrega 1 e preparação da Entrega 2

Em 15/10/2026 o usuário informou que as lojas validaram em produção a correção SQL e voltaram a finalizar os atendimentos. Autorizou exclusivamente a preparação da Entrega 2, sem commits, push, deploy ou aplicação de migrations em produção. Essa autorização substitui o impedimento de iniciar a Entrega 2 em D-001/D-011, sem dispensar os critérios técnicos ainda não comprovados: causa da mensagem original de lançamento, homologação individual dos três resultados e demais verificações de interface permanecem exceções explícitas. Não impedem a preparação local, mas continuam pendentes para liberação integrada. Reconciliação do histórico é trabalho separado, sem repair ou replay autorizado. Entrega 3 não autorizada automaticamente.

## D-013 — Execução exclusiva da Entrega 3

Em 15/10/2026 o usuário autorizou desenvolver e testar localmente a leitura compatível, detalhe, edição, histórico e filtros da Entrega 3 sobre os contratos preparados na Entrega 2. Sem modificar registros reais, aplicar migrations em produção, ativar fluxos, alterar permissões, executar repair/replay, commit, push ou deploy. Escrita de teste somente sintética e controlada. Preservar os gates anteriores e registrar dependência da homologação futura com banco v2; não iniciar Entrega 4 nem cadastro permanente de crianças. PLANO somente deve mudar se houver alteração de dependências/planejamento.

## D-014 — Entrega 4 autorizada exclusivamente em preparação local

Em 15/10/2026 o usuário autorizou implementar o formulário dinâmico, identificação inicial, oito visitas, três resultados em até duas etapas, observação de não fechamento e erros locais, com avaliação no localhost. Esta autorização permite avançar apesar da homologação integrada pendente das Entregas 2–3; não declara essas pendências encerradas. Preservar bloqueios de conclusão v2, sem migration, escrita comercial fictícia em produção, commit, push ou deploy. Crianças mantêm o fluxo atual; Entrega 5 não autorizada. Reset após sucesso deve limpar consultora e manter unidade somente quando única autorizada; sucesso v2 só pode ser homologado futuramente em banco controlado.

## D-015 — Sugestões de últimas consultoras na Entrega 4

Requisito adicional explícito de 15/10/2026: manter digitação manual e mostrar até quatro nomes distintos, do uso mais recente ao mais antigo, em botões compactos sob “Últimas consultoras”; ocultar área sem histórico. Deduplicar espaços e maiúsculas/minúsculas. Fonte: atendimentos concluídos existentes, exclusivamente do login autenticado e da unidade selecionada/autorizada, sem usar rascunhos. Sugestões podem ser compartilhadas entre dispositivos desse login/unidade; o valor preenchido não é preferência compartilhada, não é selecionado automaticamente e continua vazio em atendimento novo. Clique apenas preenche o campo; não chama conclusão nem acrescenta etapa, preservando o autosave de rascunho já existente. Consulta paginada até quatro distintos ou esgotamento, sem tabela ou migration nova. Esta decisão complementa D-002 somente quanto às sugestões, mantendo os formulários independentes. Não modifica as demais entregas.

## D-019 — Adendo de cadastro de crianças à consolidação P1

Em 16/10/2026 o usuário autorizou incorporar à consolidação P1 vigente a retirada do parentesco geral da interface/cadastro do cliente, as 13 opções padronizadas por criança com atalhos Mãe/Avó/Tia e cartões selecionáveis acessíveis, preservando a confirmação histórica explícita. Sem tarefa paralela, migrations, deploy, commit ou push exclusivamente pelo adendo. Dados históricos preservados. Compatibilidade técnica local: schema real exige parentesco geral; ausência em novo cadastro usa marcador explícito outro / Não informado, sem inferir relação e sem copiá-lo para crianças. Homologação local sintética aprovada; autenticação/banco real e avaliação humana mantêm gates próprios, conforme STATUS.

## D-020 — Ajustes finais de UX incorporados à P1

Em 16/10/2026 o usuário autorizou rolagem/foco de erros de finalização, botões responsivos iguais para crianças, orientação e indicador condicional do lançamento, verificação de telefone existente e detecção segura de telefone duplicado em novo cadastro com ação explícita Usar cadastro existente. Preservar preenchimento, regras, autorização e parentesco por vínculo. Telefone permanece opcional; não iniciar P2/P3. Consulta exata no endpoint autorizado existente e UNIQUE ativo já presente, sem schema/migration. Consolidação local e testes sintéticos não autorizam nem comprovam publicação ou homologação autenticada. Sem migrations, commit, push ou deploy apenas pelo adendo. Resultados e pendências no STATUS.

## D-021 — Preparação final de banco/homologação e aprovação visual da P1

Em 16/10/2026 o usuário informou que realizou a validação visual das duas etapas e autorizou a preparação final de banco, homologação integrada possível e publicação consolidada. Preservar auditorias/código existentes; conferir urgências/Entregas 2–6 e estado real do Supabase somente em leitura; preparar sequência, pré/pós-verificações, recuperação e pontos de parada. Testes fictícios não podem modificar registros comerciais de produção. Sem ambiente controlado, registrar bloqueio exato e preparar procedimentos, sem declarar homologação completa. Não executar migration repair, migrations de produção, commit, push ou deploy sem nova autorização. Não iniciar P2/P3. Pendência futura de atendimento fora da faixa/catálogo registrada literalmente no ESCOPO, sem fluxo/classificação presumidos. Ajustes indispensáveis de build do pacote urgente integrados ao candidato consolidado com comparação de handlers, sem alterar motor ou regras de negócio. Resultado, gates e autorização seguinte em STATUS/PLANO.

## D-022 — Homologação controlada em produção e alternativa de recuperação

Em 16/10/2026 o usuário substituiu a exigência de segundo Supabase/Preview pela homologação diretamente em produção, com uso da Prancheta suspenso pelas lojas, sem presumir suspensão dos demais módulos. Autorizou migrations 2→5→6 condicionadas à identidade, Entrega 1 já efetivada, hashes/estrutura/ACL/dependências e recuperação, verificando cada estágio e parando diante de risco não resolvido. Preservar dois rascunhos v2 e histórico; sem repair, exclusão comercial ou reabertura automática. A ferramenta registra cada novo evento com timestamp atual e ID fonte no nome, sem reconciliar histórico legado.

Após evidência de plano Free sem backup agendado/PITR e pergunta sobre backup manual, usuário respondeu: “nao temos, pode fazer sem backup, ou outra sugestao para resolver rapidamente”. Adotada cópia lógica criptografada do módulo com restauração offline verificada antes do primeiro DDL, limitada às sete tabelas/funções/estrutura; não é recuperação global do projeto. Chave vinculada à máquina/usuário Windows. Resultado: Entrega 2 aplicada/validada, Entrega 5 não aplicada por falha da integração em duas chamadas, Entrega 6 não tentada; detalhes e retomada em STATUS/PLANO.

Preparar publicação para homologação somente após migrations validadas, candidato/build/testes e restrição efetiva de acesso. Apresentar resultados, estado do banco e recuperação antes de pedir autorização específica para commit/push/deploy. Registros de testes claramente identificados devem evitar contaminação comercial; prefixo isolado não comprova exclusão de relatórios. Não modificar atendimentos reais. Homologação real e aceite precedem reabertura das lojas. P2/P3 e reorganização DEV/PROD fora do escopo.

## D-023 — Acesso alternativo autorizado e execução integral das Entregas 5/6

Em 16/10/2026 o usuário autorizou explicitamente método alternativo já disponível e seguro para aplicar 5/6, preservando hashes, transações, recuperação e verificações, sem repetir indefinidamente autenticação falha. Utilizado editor SQL oficial na sessão autenticada do projeto produtivo confirmado, não conexão PostgreSQL direta inventada. Entrega 2 não reaplicada; 5/6 executadas integralmente e validadas via MCP de leitura, integridade histórica e gates false. Cópia criptografada do módulo revalidada offline; não backup integral. Não foram extraídas credenciais nem alteradas autenticação/permissões para obter acesso.

Execução SQL direta não registra automaticamente 5/6 no histórico remoto. Documentar aplicação real/arquivos/hashes e planejar reconciliação futura própria, sem repair, registro artificial, replay ou duplicação de objetos. Não interpretar ausência no histórico como ausência no schema. Entrega 1 também efetivada por SQL direto anteriormente. Publicação e abertura às lojas continuam dependentes de autorizações específicas e homologação real; registros comerciais fictícios continuam proibidos sem controles explícitos de exclusão das operações/relatórios. Candidato de 54 arquivos preservado; gates adicionais UI/API identificados para ativação controlada futura.

## D-024 — Publicação/ativação P1 para homologação pessoal direta

Em 16/10/2026 o usuário autorizou preparar e executar commit/push/deploy da P1 aprovada e habilitar finalização/edição v2 para testar pessoalmente no lebebe.cloud. Sem Preview, novo banco, novas estruturas de homologação ou permissões adicionais; substitui a exigência de allowlist piloto de D-023. Manter permissões/validações e suspensão operacional das lojas, sem declarar reabertura. Gates SQL existentes podem ser ativados coordenadamente com o código; sem migrations novas ou repair.

Teste identificado pelo prefixo HOMOLOGACAO seguido de espaço/nome no campo Consultora (exemplo HOMOLOGACAO Lucas), respeitando validação existente de letras/espaços e máximo 30 caracteres. Excluir da listagem padrão e sugestões recentes, permitir consulta pelo filtro explícito de consultora. Nomes de clientes/crianças de teste identificados e telefone controlado pelo usuário; sem contaminar cadastros reais. Não criar registros automaticamente nem excluir diretamente sem dependências. Extrações externas precisam excluir o marcador; não inventar flag estrutural. Homologação pessoal segue pendente até execução real; publicação não equivale a aceite ou abertura das lojas.

## D-025 — Correções de UX e publicação com validação manual final

Em 16/10/2026 o usuário esclareceu que Negociação/Venda perdida concluíam, mas faltava feedback visível. Aprovou retorno imediato ao topo, aviso de sucesso e botão verde desabilitado com check por três segundos, seguido do estado inicial, além dos ajustes de rodapé mobile, crianças e recuperação local solicitados nesta rodada. Preservar validações, autosave e confirmação real de persistência.

Autorizou commit/push na main e publicação somente das correções pertinentes após testes focais/build aprovados. Determinou não insistir no navegador bloqueado pela revisão automática; registrar a limitação e deixar validação manual final no lebebe.cloud a seu cargo. Sem migrations, alterações em registros reais ou reabertura automática às lojas. Versão anterior compatível para recuperação desta rodada: commit 95ba0b214e0dd88bc9c76aec7fb5ca2f9d32f2ba, deployment dpl_HM7VnGRWkMveSpKkzRyFviKeDzrN; sem reversão de banco nesta correção de interface.

## D-026 — Última rodada de UX P1 antes do aceite

Em 16/10/2026 o usuário autorizou os ajustes finais de apresentação/idade da criança histórica, entrada suave do rodapé, rolagem após renderização de etapas e feedback de finalização na primeira oportunidade de pintura. Compartilhar seleção por toque e limites existentes entre criança nova/histórica, preservando validações, cálculo e dados originais. Feedback não dispensa confirmação de persistência. Publicar na main após testes/lint/build/diff aprovados; sem migrations, registros reais, outros módulos, início de P2/P3 ou reabertura às lojas. Validação humana no celular é indispensável. Mantida limitação de automação de navegador registrada em D-025; não contorná-la.

## D-031 — Cadastro, filtros e rascunhos aprovados (19/10/2026)

Usuário aprovou o plano completo, escolheu período pela data de início do atendimento e filtros operacionais nos rascunhos, e substituiu a nomenclatura proposta por **Consultora do atendimento**. Autorizou implementar localmente em seguida. Produção, migration remota, commit/push/deploy ficam para etapa posterior autorizada, após resultados da validação.

Telefone rejeitado foi informado como cadastro de nova cliente na Prancheta. Número relatado passa no normalizador anterior TS/SQL; causa histórica não reproduzida e logs fora da retenção. A nova política usa formato brasileiro, sem inferir inexistência de linha pela repetição de dígitos. Os sete telefones antigos fora do formato novo ficam preservados com aviso; não exigem mudança em edição somente de nome. Contrato genérico compartilhado com outros módulos permanece.

Normalização agrupa somente grafias equivalentes, preservando ANA C como nome diferente de ANA, IDs/vínculos e snapshots de auditoria. Com/Sem telefone usa presença no cadastro atual; Não cliente não entra nessas categorias. Consultora do atendimento é o nome registrado naquele atendimento, não a origem do cliente ou o e-mail do login. Nenhuma exclusão adicional autorizada nesta implementação.

Migration preparada localmente: 20261019145305_prancheta_cadastro_filtros_normalizacao.sql. Atuação remota pendente: revalidar estrutura/trigger real, preparar janela de atualização de versões, conferir integridade antes/depois e aplicar somente esta migration, sem replay/repair. Os novos gatilhos protegem nomes e novas escritas de telefone; RLS e contratos de outros módulos preservados. Integridade transacional desconsidera somente campos canônicos/version/updated_at, abortando mudança em outros dados. Recuperação de aplicação deve conservar valores normalizados e telefones existentes; qualquer desativação de gatilho em produção exige diagnóstico e autorização da janela.

## D-032 — Publicação do cadastro e filtros (19/10/2026)

Usuário autorizou verificar registros novos, aplicar migration e publicar após cessar o preenchimento. Dois atendimentos e dois clientes novos compatíveis e preservados. Migration 20261019145305 aplicada via MCP; contagens e hashes dos dados de negócio idênticos antes/depois. Sem exclusões, repair, replay ou mudança de RLS. Recarregar formulários por atualização de versões. Commit/push/deploy autorizados somente para este pacote, mantendo alterações preexistentes fora dele. Limites de homologação D-031 permanecem.

## D-034 — Parentesco nos cards/filtros, largura dos diálogos e motivo Cliente Retira (20/10/2026)

Pedido atual acrescenta o parentesco da criança ao cabeçalho dos atendimentos salvos e um filtro multisseleção com as 13 opções exibidas pelo seletor de parentesco. Os títulos de grupos dos filtros devem ganhar contraste e separação. Diálogos de confirmação devem respeitar largura de 80% da viewport, limitados ao tamanho máximo existente no componente.

Novo motivo de Venda perdida: `cliente_retira`, exibido como “Cliente Retira (Retirou apenas o item já comprado)”. A validação atual no cliente, na RPC e no CHECK do banco precisa aceitar essa chave. Na aprovação inicial, migration local preparada e aplicação remota não autorizada; autorização posterior e aplicação constam em D-035/STATUS.

A confirmação de telefone mantém exatamente os ramos e ações atuais. Código já confirma venda fechada, negociação e venda perdida quando o telefone é inválido; nenhuma nova opção ou persistência será criada. Na aprovação inicial, a publicação não estava autorizada; autorização posterior registrada em D-035.

## D-035 — Publicação do pacote D-034 na main (20/10/2026)

Usuário autorizou publicar todas as edições pendentes deste pacote na `main`. Aplicar antes do código a migration aditiva `20261020130618_prancheta_motivo_cliente_retira`, necessária para a chave `cliente_retira`; preservar o fluxo de telefone. Depois, commit/push apenas dos arquivos do pacote e confirmar o deployment de produção/domínio no Vercel. Alterações preexistentes fora do escopo devem permanecer fora do commit.

Publicação concluída: migration `20261020130618` aplicada e verificada; commit `8f0b0f4ff7445122f852a0b40f1f8355b84095b` enviado a `origin/main`. Vercel deployment `dpl_7cDQbF8KiEFJ7YeG2JYsNZvJ8vnf` ficou `READY` em produção, com SHA correspondente e alias `lebebe.cloud` sem erro. Build remoto compilou com sucesso; homologação autenticada comercial e em aparelho físico não foi executada nesta publicação.

## D-036 — Consultoras sem distinção de acentos e atualização automática do filtro (20/10/2026)

“Virada do cartão” fica após Interesses e Motivos. O seletor de consultora obtém as opções dos atendimentos concluídos, atualiza ao ser aberto e não exige cadastro manual. A listagem é paginada e respeita o perfil/unidades do usuário. Uma consultora sem atendimento concluído ainda não aparece como opção porque não há registro histórico para listá-la.

Consultoras passam a ser normalizadas sem acentos além de trim, espaços simples e maiúsculas; LETICIA/LETÍCIA são uma única grafia canônica `LETICIA`. Aplicação remota inclui nomes de atendimentos, `consultoraNome` em rascunhos e origem da consultora nos clientes, preservando IDs, vínculos e linhas. Não consolidar ou excluir atendimentos: “mesma consultora” significa a mesma opção/valor canônico.

Migration `20261020135931_prancheta_consultoras_sem_acentos` aplicada pelo MCP Supabase após validar extensão, dicionário, tabelas e triggers reais. Pré/pós-hash aborta qualquer alteração em campos fora da normalização, `version` e `updated_at`; trigger de origem foi temporariamente desabilitado só durante o backfill e confirmado habilitado ao final. O registro de 4 ocorrências `LETÍCIA` e 14 `LETICIA` agora mostra `LETICIA` (18 atendimentos). A CLI Supabase não está instalada neste ambiente; o MCP aplicou a migration e retornou a versão usada no arquivo local.

Código local validado com 73 testes dirigidos, ESLint e diff-check. Typecheck integral continua com 15 erros anteriores em testes de Auth/Hub. Commit/push/deploy e browser autenticado não autorizados nem executados nesta decisão.

Advisors de segurança/performance foram consultados: não apontaram a nova função de canonicalização; mantêm achados prévios, entre eles search_path mutável em `atendimento_presencial_clientes_touch` e FKs sem índice na área da Prancheta. Fora do escopo desta alteração.

## D-037 — Desfecho do telefone antes da conclusão (20/10/2026)

Usuário aprovou o fluxo: no modal de cliente sem telefone, recusa confirmada conclui como hoje; “Não pedi o número” troca o conteúdo do modal; telefone válido é salvo no cadastro e conclui automaticamente; “Não pedi, cliente já foi embora” conclui sem telefone. Os dois novos estados precisam ser consultáveis no banco e aparecer no histórico.

Implementação local adiciona `telefone_desfecho` nullable com os valores `telefone_informado`, `cliente_recusou` e `cliente_ausente_sem_solicitacao`, sem backfill. Preserva `telefone_recusa_confirmada`: false para telefone válido, true para recusa e null para ausência sem solicitação. Rascunhos, Não clientes e históricos sem classificação permanecem null. A RPC verifica a escolha vinculada a atendimento/versão/cliente e grava o estado no snapshot; o PATCH existente atualiza o telefone antes da conclusão.

Validação local: 44 testes dirigidos, ESLint, diff-check e build aprovados. Typecheck standalone permanece com erros preexistentes nos testes de Auth/Hub, sem ocorrência nos arquivos desta entrega. Autorização posterior recebida para aplicar migration e publicar.

Conclusão D-037: migration `20261020155331_prancheta_desfecho_telefone` aplicada via MCP, sem backfill; coluna nullable presente e CHECK validado, com zero linhas classificadas após a aplicação. Commit funcional `c0cc67462cd281da5df7f7f32a0237eb77228cf2` e alinhamento do nome local da migration ao histórico remoto `c0f1bce1f7f35e2b0c6be288129b6be08d0556dd` enviados a `origin/main`. Deployment final `dpl_GuMLNaYa9zGcVy9suzwVA12jbcbH` `READY` em produção no Vercel, com SHA correspondente e alias `lebebe.cloud` sem erro. Testes focados (31), ESLint e diff-check aprovados; build remoto compilado. Homologação autenticada do fluxo não executada.
