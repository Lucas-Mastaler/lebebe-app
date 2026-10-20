# Plano — Prancheta Virtual

**Estado do planejamento:** DEFINIDO

Contrato funcional: ESCOPO.md. Decisões: DECISOES.md. Marcar somente tarefas realmente executadas e validadas.

## Cadastro, filtros e rascunhos — D-031 (19/10/2026)

Plano aprovado expressamente pelo usuário; execução local autorizada. Banco remoto e publicação permanecem em etapa posterior autorizada.
- [x] Editor compartilhado de nome/telefone na Prancheta e Clientes, PATCH parcial com versão, duplicidade e conflito explícito.
- [x] Validação BR apenas nas novas escritas do cadastro; máscara sem corte silencioso; telefone legado preservado em alteração somente de nome.
- [x] Nome canônico de consultora em leitores/escritores locais, sugestões e filtros; nomenclatura Consultora do atendimento.
- [x] Filtros de início/virada separados, tipo, telefone, lançamento, contato, departamentos/motivos múltiplos e visita; contagens globais antes de paginação.
- [x] Rascunhos com nome vinculado/pendente, consultora do JSON, filtros operacionais, paginação, ordenação estável e estado de navegação preservado.
- [x] Cards com hierarquia e retirada da recusa das apresentações operacionais; fato técnico preservado.
- [x] Migration local de normalização/proteção de novas escritas, com preflight/integridade, transação, ACL e preservação de vínculos/datas.
- [x] 439 testes em 41 arquivos; SQL PostgreSQL/WASM sintético; browser sintético a 390/1366px, incluindo cadastro relatado e os dois editores; lint dirigido.
- [x] Build de produção aprovado; typecheck global com 15 falhas preexistentes fora do escopo e nenhum erro nesta entrega; diff dirigido aprovado.
- [ ] Homologação autenticada/integrada do candidato e em dispositivos físicos; depende do procedimento autorizado, sem contornar D-025/D-026.
- [x] Aplicação remota autorizada D-032: 20261019145305, banco real reconferido, novos registros e hashes preservados; recarregar formulários.
- [x] Commit/push/publicação autorizados D-032: 0c966f5 em origin/main; Vercel READY/production, alias lebebe.cloud confirmado.

## Atendimentos Salvos / Situação da Venda — 19/10/2026

Autorização: implementação/validação locais; publicação autorizada explicitamente em 19/10/2026.
- [x] Conferir persistência real, status/conclusão, rascunhos e filtros; separar confirmado de hipótese.
- [x] Padronizar aba, situação sem inferências e filtro DS combinado com reset de página.
- [x] Preservar acesso e leitura/edição; contagens vazias e leitura em lotes.
- [x] 411 testes/39 arquivos, incluindo SSR e 1.005 registros; lint dirigido aprovado.
- [x] Build de produção e diff dirigido aprovados.
- [ ] Homologação visual/mobile/autenticada de caso individual; respeitar D-025/D-026.
- [x] Autorização específica de publicação recebida em 19/10/2026.
- [x] Commit 57389d5 e push confirmados; dpl_Eqc86fZWWbfkmChqWpcDDqk2p4jZ READY/production, lebebe.cloud sem aliasError.

## Correção pós-homologação — D-030

- [x] Feedback imediato nos dois resultados, bloqueio de cliques e rodapé estável durante validação; resultado atualizado somente após validação aprovada.
- [x] Comparação de lojasMotivos no autosave; teste de alteração isolada/remoção e estabilidade da ordem das chaves.
- [x] 395 testes/38 arquivos, lint dirigido, build e browser sintético mobile; loja A → B confirmada no PostgreSQL local e reaberta por ID.
- [x] Commit 9a21e81 e push confirmados; deployment dpl_nP1vWKPfvQdZnj4znq8FX1ZFbn7r READY/production com lebebe.cloud e SHA corretos.
- [ ] Reteste humano no iPhone pelo atalho da tela inicial.

## Refinamento funcional — D-028 (preparação local)

- [x] Listas por resultado e visita, complementos de loja e compatibilidade histórica na leitura/edição.
- [x] Autosave novo condicionado a filial/consultora/tipo; retomada e fila preservadas.
- [x] Crianças antigas sem IDs; confirmar nova criança no rascunho, cartão compacto e alteração/remoção.
- [x] Modal de telefone por tentativa, validação SQL/API vinculada ao atendimento/versão/cliente e destaque na gestão.
- [x] Atalho Produto que não trabalhamos, sem duplicidade.
- [x] Testes focais/SQL isolado, lint, typecheck executado com 15 falhas preexistentes, build e browser sintético a 390/1366px; limites no STATUS.
- [x] D-029: migration 20261016215502 aplicada/verificada, commit ce23f9c enviado à main e deployment READY com lebebe.cloud confirmado.
- [ ] Homologação de uso no site, aparelhos reais e aceite humano para lojas.

Sequência: contratos/migration → formulário/gestão → regressões locais → preparação de homologação. Reutilizar complemento dos motivos, adicionar somente telefone_recusa_confirmada nullable, manter snapshots antigos e ACLs. Aplicação transacional com preflight de funções e timeouts; abortar divergências. Recuperação preserva novas colunas/dados, suspende escrita e restaura versão compatível, sem desfazer histórico.

## Entrega 1 — Compatibilidade e validações

Complexidade média; risco elevado. Encerrada operacionalmente em 15/10/2026 conforme validação das lojas e D-012. Exceções técnicas abaixo permanecem abertas, sem impedir exclusivamente a preparação local da Entrega 2.

- [ ] Reproduzir controladamente incidente do lançamento e distinguir aviso antigo de nova rejeição; rastrear DOM/estado/payload/API/RPC, recuperação e autosave.
- [ ] Corrigir causa confirmada sem alterar inteiro 1–999999; distinguir vazio/formato/faixa e remover erro corrigido.
- [x] Resolver incompatibilidade entradasFormulario/autosave/normalizador SQL, preservando entradas intermediárias e dados definitivos.
- [ ] Validar regressões, testes focais, typecheck, lint/diff e integração controlada possível; registrar limitações reais.

Progresso verificável:
- [x] Identificar falha local com lançamento 256: JSON real rejeitado pelo normalizador; SELECT sem entradasFormulario passa, sem exigir virada. Nenhuma conclusão real executada pelo agente.
- [x] Corrigir mensagens de lançamento, normalização sem transformar formatos inválidos, erro local/limpeza e encaminhamento de field; incompatibilidade SQL não será apresentada como obrigatoriedade ausente.
- [x] Preparar migration mínima, preflight por hash, validação SQL somente leitura e recuperação com guarda de versão da função.
- [x] Aplicar correção pontual por SQL direto conforme D-011 e validar normalizador somente leitura; histórico de migrations não reconciliado. Ver STATUS.md.
Aplicação convencional da migration substituída pela correção SQL direta D-011 acima; não reaplicar nem registrar artificialmente. Reconciliação futura separada exige autorização.
- [ ] Confirmar causa da mensagem original publicada (Informe o numero do lancamento), distinta da incompatibilidade local comprovada.
- [ ] Homologar interface/integração e fechar Entrega 1 antes de iniciar Entrega 2.

Exceção aprovada D-012: encerramento operacional com relato de validação real pelas lojas; não é prova individual dos três resultados nem dos critérios completos de DOM/payload/reabertura/mobile. Itens ainda abertos permanecem como pendências técnicas separadas. Não há autorização para publicar o frontend local da Entrega 1.

Aceite: 22, 225, 2234, 34566, 1 e 999999 aceitos com demais requisitos válidos; vazio, zero, negativo, fração, caracteres e excesso tratados especificamente. Conferir valor exibido/enviado, tentativa após erro, reabertura, autosave pendente, concorrência e ausência de perda. A suíte isolada não prova RPC real. Se produção for necessária para migration, parar com artefato revisável e solicitar autorização.

## Entrega 2 — Contratos e persistência

Complexidade alta. Depende de 1.

- [x] Contratos versionados para tipo, motivo de visita e observação complementar; adaptar rascunho/conclusão/edição e SQL/constraints.
- [x] Preservar códigos comerciais, permissões, RLS e histórico; não clientes sem cliente/resultado/lançamento fictícios.
- [x] Validar schema e migrations remotas antes de preparar mudança; procedimento de recuperação e integração transacional.

Preparação local validada em 15/10/2026: 27 arquivos/296 testes focais e 50 verificações PostgreSQL isoladas, incluindo recuperação e rollback após falha. APIs e SQL bloqueiam conclusão/edição v2; rascunho guarda novos campos e ramos ocultos. Função de gate SQL retorna false, sem configuração enviada pelo cliente. Sem alteração visual. Migration 20261015185406 não aplicada; integração no Supabase e homologação dos leitores/editores ainda necessárias antes de ativar os novos fluxos.

Aceite: novo e legado compatíveis; ramo ativo validado no servidor; observação vazio/300 aceitos e 301 rejeitado; falha não deixa conclusão parcial. Migration produção exige autorização.

## Entrega 3 — Leitura compatível

Complexidade média. Depende de 2.

- [ ] Adaptar finalizados, detalhe, edição e histórico aos novos contratos e registros sem cliente.
- [ ] Preservar campos novos e motivos antigos; separar não clientes de contagens comerciais; manter consultas SGI/pedidos.

Aceite: ler/editar legado e novos registros sem perda, respeitar acesso e filtros. Não criar KPI ou fórmula de conversão nova.

## Entrega 4 — Formulário dinâmico e erros locais

Complexidade alta. Depende de 2–3.

- [x] Implementar identificação dinâmica e quatro caminhos em até duas etapas, removendo revisão e movendo lançamento.
- [x] Erros locais em todos os campos/grupos, API field preservado, foco/rolagem após renderização e limpeza ao corrigir.
- [ ] Preservar ramos ocultos no rascunho e somente concluir ativo; reset conforme D-002.
- [x] Sugestões D-015: até quatro consultoras distintas por uso recente em atendimentos concluídos, isoladas por login/unidade, com seleção explícita e formulários independentes; validar vazio/um/quatro/mais/repetições e permissões.

Preparação local validada: 328 testes focais e dez grupos de verificações no browser sintético. O item de efetivação/reset permanece aberto por depender da conclusão v2 real bloqueada.

Autorização local vigente: D-014 e D-015. A preparação da Entrega 4 pode avançar com as Entregas 2–3 homologadas somente em fixtures; aplicação de migration e liberação de conclusão v2 continuam proibidas. Consulta das sugestões reutiliza dados e índices existentes, sem tabela/migration nova. A conclusão real e o reset após sucesso v2 dependem do banco preparado e da homologação integrada, não de enfraquecimento do gate.

Aceite: troca Cliente→Não cliente após preencher/cadastrar cliente não conclui dados comerciais nem associa crianças; cadastro permanente já criado permanece. Voltar não perde dados. Mobile com teclado/rodapé e notebook, duplo clique e falha de rede. Campos específicos nunca dependem só do topo.

## Entrega 5 — Crianças reutilizáveis

- [x] Adendo UX final P1 de 16/10/2026: revelar erros de finalização e mantê-los após autosave, botões responsivos iguais, orientação/asterisco condicional do lançamento e duplicidade por telefone com escolha explícita; testes focais e browser sintético aprovados. Sem avanço P2/P3; limites no STATUS.

- [x] Adendo P1 de 16/10/2026: retirar parentesco geral da interface/cadastro; lista e atalhos por criança; cartões com área inteira selecionável preservando confirmação histórica. Validações locais e regressão isolada aprovadas; compatibilidade legada e gates no STATUS.

Complexidade alta. Depende de 1; leitores compatíveis antes da ativação.

- [x] Preparar localmente cadastro permanente, vínculo/parentesco, referência opcional no retrato do atendimento e correspondência histórica separada.
- [x] Preparar consulta e confirmação histórica atômica/idempotente independente da conclusão; validar em SQL isolado e APIs simuladas.
- [x] Seleção compacta, exclusão das já selecionadas, adicionar/trocar/retirar sem exclusão permanente; limite oito; validar em navegador sintético.
- [ ] Homologar banco controlado, concorrência multiconexão, autorização e fluxo integrado antes de ativar.

Autorização local D-016. Preparação da Entrega 5 preservada; Entrega 6 posteriormente preparada conforme D-018/STATUS. Gates reais fechados e migrations não aplicadas. Adendo UX D-017 (aviso/cópias locais) mantido pendente por escolha explícita do usuário; mecanismos atuais preservados. Validações atualizadas da consolidação na seção de preparação final abaixo.

Aceite: primeira confirmação e atendimento posterior sem reconfirmação, homônimos/ambiguidades, vínculo por cliente, origem intacta, confirmação concorrente/repetida/resposta perdida/falha parcial sem duplicar. Não unir por nome. Nova criança preparada efetivada na conclusão.

## Entrega 6 — Presente e idade aproximada

Autorizada localmente por D-018, junto à homologação possível da Entrega 7. Prioridade anterior: regressões urgentes de criação/retentativa, navegação protegida, telefone/SGI e conclusão/reset. Conferir produção em leitura, reproduzir com fixtures, corrigir origem confirmada e separar patch urgente de contratos v2. Banco real e publicação permanecem gates externos.

Complexidade alta. Depende de 5.

- [x] Preparar Presente com Já nasceu? compartilhando campos e regras de idade/gestação; validar browser sintético móvel/notebook.
- [x] Preparar referência estimada DATE e idade dinâmica, sem confundir nascimento real/previsão; preservar legado sem inventar datas; validar PostgreSQL isolado.
- [ ] Homologação autenticada da Entrega 6 com banco controlado atualizado e aprovação visual humana.

Resultado local D-018: migration aditiva 20261015212015 não aplicada, 21 verificações SQL da Entrega 6 e dois tamanhos de browser aprovados. Referência persistida/reutilizada, leitura/editor e recuperação preparados. Gates reais fechados.

Aceite: 15/10/2026 com 3 meses→01/07/2026; 1 ano→01/10/2025; consultas futuras, virada de ano, preservação da referência na reutilização e idade atual além das faixas de entrada.

## Entrega 7 — Homologação integrada

Complexidade média. Depende de todas.

- [ ] Quatro caminhos reais em ambiente controlado; histórico, edição, autorização e transações.
- [ ] Mesmo login em dois dispositivos: novos formulários independentes, mesmo rascunho com conflito; unidade única/múltipla e consultora limpa.
- [ ] Crianças históricas/permanentes/novas, idade/Presente, erros/foco/mobile, rede, recuperação e resposta perdida.
- [ ] Validar suíte focal, typecheck/lint e integração SQL; autorizações de produção separadas.

Progresso local da Entrega 7 em D-018 (não encerra os itens autenticados acima):
- [x] Quatro fluxos do componente real com HTTP de fixture e RPCs PostgreSQL/WASM efêmeras; sucesso/reset/novo e falha sem perda.
- [x] Dois contextos mesmo login, duas abas mesmo rascunho com conflito, offline/recarga, PATCH com resposta perdida, confirmação histórica e reutilização independente.
- [x] 365 testes focais, lint/diff/sintaxe e build local; SQL anterior 50+28 e Entrega 6 21 verificações. Typecheck geral mantém 15 erros preexistentes fora do escopo.
- [ ] APIs/autenticação/Supabase reais em ambiente controlado atualizado, concorrência multiconexão, autorização real das unidades e dispositivo móvel físico; avaliação visual humana.

Urgências independentes: patch contra HEAD publicado em scripts/prancheta/urgentes-producao.patch, aplicado em worktree isolado; 291 testes/lint/diff e build completo aprovados após ajustes mínimos de assinatura/exports Next. Homologação autenticada bloqueada por ausência de Preview/configuração verificável; detalhes no STATUS. Publicação não autorizada/executada. Causas confirmadas, não confirmadas e limites detalhados no STATUS; não misturar liberação urgente com publicação de P1.

## Publicação pessoal direta — plano vigente D-024 (16/10/2026)

Rodada D-026: apresentação histórica e idade por toque compartilhada; transição de rodapé e etapas após render; feedback de conclusão com guard, commit DOM e oportunidade de pintura antes de validações/autosave. Testes focais 376/lint/diff e build completo aprovados; publicação em andamento. Navegador limitado conforme D-025, reteste no celular real antes do aceite. P2/P3 e reabertura dependem de decisão posterior.

Publicação D-026 concluída: main/origin 1d03bde325db07208912b3d68b02bb4468475dfb, deployment dpl_AnubYMrjFnMoTfnZK5RiJDWuZ2j1 READY com lebebe.cloud. Registro local pós-deploy. Próxima etapa é aceite humano no celular; não iniciar P2 automaticamente.

Correções UX D-025: testes focais 372/lint/diff e build completo final aprovados. Publicar allowlist de dois componentes e três Harness na main; verificar SHA/READY/alias Vercel. Navegador final dispensado nesta rodada por decisão explícita após bloqueio da revisão automática; usuário valida feedback/rolagem/reset, crianças e rodapé em celular/notebook antes de reabrir lojas. Recuperação para versão P1 95ba0b2 sem alteração de banco.

Publicação D-025 executada: ccf0d963d49efd65b979b2005ec92edfba74ad79 na main/origin; dpl_5NYCVKb8k1wZ6Lj8YcKg19jsoZX4 READY/production com lebebe.cloud. Homologação manual e reabertura das lojas continuam pendentes. Identificação final registrada localmente após o deploy.

Substitui exigências anteriores de Preview/allowlist piloto. Sem novo banco/estrutura/permissões; lojas suspensas operacionalmente, usuário testa pessoalmente.

- [x] Remover gates temporários de UI/API, inclusive editor de registros; preservar validações, acesso/unidades, versionamento e impedir downgrade.
- [x] Confirmar sucesso somente após releitura persistida coerente de ID/status/versão e preservar reset condicionado da UI.
- [x] Distinguir testes por Consultora HOMOLOGACAO Lucas; excluir da listagem padrão/sugestões, consultar com filtro explícito. Sem novo schema; extrações externas precisam excluir o prefixo.
- [x] 426 testes e 14 grupos browser isolado aprovados; lint dirigido; SQL de ativação dos gates existentes ensaiado sem mudar ACL.
- [x] Build completo final aprovado, diff/allowlist revisados (54 fontes + quatro Harness + três SQLs auxiliares necessários, 61 arquivos); commit/push somente esses arquivos.
- [x] Deployment produção READY no commit 95ba0b214e0dd88bc9c76aec7fb5ca2f9d32f2ba, alias lebebe.cloud e smoke de leitura; ambos gates SQL true sem migration nova e pós-verificação de contratos/ACL aprovada.
- [ ] Usuário executar roteiro real abaixo com marcadores, sem alterar atendimentos comerciais reais; aceite antes de reabrir lojas.

Recuperação/versão anterior e limites no STATUS D-024. Testes reais: preencher HOMOLOGACAO Lucas a cada atendimento (reset limpa consultora), usar cliente/criança claramente de teste e telefone sob controle, não cliente → venda fechada com lançamento → negociação → venda perdida → reutilização/permanente/histórico confirmado → Presente/idade → recarregar rascunho/autosave → sucesso/reset/novo. Reabrir registros pelo filtro de consultora HOMOLOGACAO Lucas, conferir persistência. Não finalizar os dois rascunhos v2 comerciais preexistentes como testes. Limpeza posterior somente com análise de dependências e autorização.

## Banco concluído e publicação controlada — registro anterior D-023 (16/10/2026)

Substitui o bloqueio D-022 abaixo. Entrega 2 não reaplicada; Entregas 5/6 executadas via editor SQL oficial autenticado, com arquivos integrais/hashes aprovados. Histórico remoto não recebe eventos automaticamente nesse método. Não usar repair/replay para tentar alinhar.

- [x] Revalidar projeto/banco/schema/usuário, etapa 2, ausência de 5/6, transações/locks, hashes, integridade e recuperação offline da cópia criptografada limitada ao módulo.
- [x] Aplicar Entrega 5 integral e validar etapa 5, tabelas vazias, RLS/ACL/constraints/gates e preservação dos 1.090 registros/dois rascunhos v2 antes de seguir.
- [x] Aplicar Entrega 6 integral e validar etapa 6, referências DATE, preservação de datas reais, ausência de backfill, gates e integridade pos6.
- [x] Revalidar contratos da Entrega 2 na estrutura final (verificador 6 contempla colunas/constraints/gate/RPCs finais), ACL/policies originais idênticas, constraints validadas, índices válidos e ausência de transações pendentes. Não executar verificador pós-2 antigo esperando hashes anteriores aos substituídos deliberadamente por 5/6.
- [x] Conferir candidato de 54 arquivos e SHA por arquivo/patch; repetir 420 testes, 99 verificações SQL isoladas, lint dos 50 arquivos; typecheck sem novos erros.
- [x] Build completo Next 16.1.4/webpack aprovado, exit 0; resultado/log e falha inicial de filesystem registrados em STATUS.
- [x] Identificar gates adicionais da UI/API e preparar procedimento abaixo; sem ativação global.
- [ ] Definir identidades/unidades piloto e estratégia verificável de exclusão dos testes dos relatórios; preparar a habilitação restrita e revisar novo diff/manifesto/testes se o candidato mudar.
- [ ] Apresentar candidato executável/restrito, resultados, recuperação e aguardar autorização específica para commit/push/deploy. Banco pronto não autoriza publicar automaticamente.
- [ ] Após publicação autorizada, executar homologação real supervisionada e obter aceite antes de abrir lojas.
- [ ] Tratar reconciliação futura de histórico em trabalho autorizado próprio; impedir que ferramentas reapliquem 1/5/6 por ausência no histórico. Não registrar eventos antigos falsos ou executar migration repair.

### Ativação controlada — preparada, não executada

1. Confirmar login(s)/unidade(s) de homologação autorizados e um controle no servidor que negue escrita v2/confirmar crianças a demais usuários, preservando permissões/unidades existentes. Ainda não há allowlist piloto implementada; suspensão informal das lojas não é prova de restrição. Não criar usuários privilegiados, desativar RLS ou habilitar /agente em produção.
2. Definir controles explícitos para que registros de teste não contaminem relatórios/operações comerciais. Prefixo identificador é necessário para rastreio, mas insuficiente para excluir métricas. Sem esse controle aprovado, continuar apenas leitura/fixtures; não alterar atendimentos reais ou inventar coluna/flag de testes.
3. Preparar habilitação consistente: FichaPageClient bloqueia conclusão; fluxoNovoAindaNaoLiberado bloqueia APIs de conclusão/edição; PATCH rejeita versao_fluxo. Dois gates SQL continuam false. Rever todos os pontos, leitores/edição/cadastro/histórico e restrição piloto juntos, revalidar aspectos alterados e atualizar manifesto se houver código novo. Não publicar transform dos harnesses sintéticos.
4. Apresentar resultado final/build/recuperação ao usuário. Somente com autorização específica, commit/push/deploy do candidato explicitamente aprovado, preservando demais alterações do workspace. Primeiro deploy pode conservar gates SQL false para smoke autenticado de acesso/rascunho; não declarar conclusão homologada nessa condição.
5. Após comprovar restrição piloto e controles dos testes, habilitar gates coordenadamente em janela autorizada, executar a matriz abaixo e registrar resultado HTTP/persistência/reabertura sem PII. Habilitação SQL futura precisa de procedimento/SQL revisável aprovado; não executada agora.
6. Se falhar: suspender escrita piloto e fechar ambos gates com recuperar-entrega6.sql (autorização própria antes da execução); conservar dados novos/DATEs e leitores compatíveis. Não remover tabelas/colunas/vínculos, restaurar snapshot antigo sobre produção ativa ou reverter a código incapaz de ler dados v2. Cópia criptografada ajuda recuperar os dados originais do módulo, não toda a plataforma; conferir dados posteriores antes de qualquer restauração real.
7. Reabrir consultoras somente após todos os casos reais/perfis/unidades aprovados, aceite explícito e autorização de abertura. Manter P2/P3 fora do escopo.

### Roteiro para o usuário no site publicado

Com sessão normal do piloto autorizado e notebook/celular, depois da habilitação controlada:

- Não cliente: motivos de visita, conclusão sem cliente/criança/lançamento, reabertura e exclusão das métricas comerciais.
- Venda fechada: cliente, criança, lançamento obrigatório; conclusão única, limpeza completa e reabertura correta.
- Negociação e venda perdida: motivo/observação, Voltar preservando dados, lançamento opcional, conclusão/reset/reabertura.
- Cliente existente com telefone e edição manual; novo com telefone normalizado duplicado → Usar cadastro existente; incompleto/ambíguo/falha sem associação/criação indevida.
- Crianças novas/permanentes/históricas: 13 parentescos/atalhos/Outro, cartão e confirmação explícita, sem união por nome; reutilização, homônimos, limite oito e retirada sem apagar identidade.
- Presente/Já nasceu?/idade aproximada: referência dia 1 persistida e reutilizada, datas reais preservadas, legado sem referência inventada.
- Consultoras recentes: origem no login/unidade autorizados, atalho preenche, consultora limpa após conclusão; formulários independentes em dispositivos.
- Rascunhos/autosave: criar, recarregar, recuperar, Ver rascunhos, erro/rede/retentativa sem duplicação. Dois rascunhos v2 reais preexistentes devem ser preservados; não finalizá-los como testes sem autorização dos responsáveis.
- Erros: foco no campo/alerta, mensagem visível após autosave, retentativa preservando preenchimento e reset somente após sucesso confirmado.
- Acessos/unidades: piloto permitido, demais usuários negados ao fluxo de homologação, unidade única/múltipla e acesso cruzado negado; conflito real entre abas/conexões.

Todos esses casos autenticados seguem pendentes. Publicar versão com gates ainda fechados permite somente smoke parcial; não homologação de conclusão.

## Execução em produção — registro anterior D-022 (16/10/2026)

Este plano substitui a exigência de banco isolado/Preview em D-021 abaixo. Homologação será em produção, sem segundo Supabase e sem reorganização DEV/PROD. Lojas suspenderam somente a Prancheta; preservar demais módulos e cron existente. Autorização para migrations vigente, publicação depende de autorização específica posterior.

- [x] Confirmar projeto/ref real, Entrega 1 já efetivada, ausência inicial de 2/5/6, dependências, hashes aprovados, RLS/ACL e preflight etapa 0.
- [x] Confirmar indisponibilidade de backup agendado/PITR no plano Free; registrar resposta humana permitindo prosseguir ou alternativa rápida.
- [x] Criar cópia lógica criptografada das sete tabelas/funções/estrutura do módulo e testar restauração offline. Localização/SHA/limitações no STATUS; não cobre Auth/Storage/outros módulos e depende da máquina/usuário Windows.
- [x] Aplicar Entrega 2 integral e imutável via apply_migration; evento real 20261016143217 / p1_entrega2_fonte_20261015185406.
- [x] Verificar etapa 2, gates fechados, ACL/policies originais e integridade dos 1.090 registros/dois rascunhos v2.
- [ ] Resolver falha externa da integração na Entrega 5: duas chamadas retornaram Invalid or expired requestState; não aplicada, estado pós-2 revalidado após ambas. Não repetir cegamente, fragmentar SQL ou usar ferramenta de leitura para DDL.
- [ ] Antes de retomar: revalidar etapa 2, hashes fontes, integridade e acesso à cópia; confirmar ausência de aplicação em andamento/estrutura 5 parcial. Aplicar somente fonte 20261015203309 via mecanismo DDL suportado e verificar etapa 5/integridade antes de seguir.
- [ ] Aplicar somente fonte 20261015212015; verificar etapa 6/integridade/histórico/ACL e ausência de impacto indevido nos módulos compartilhados. Não reaplicar 1/2.
- [ ] Reconfirmar candidato de 54 arquivos, repetir build/testes essenciais e preparar restrição de homologação em UI/API/servidor; suspensão informal das lojas não substitui controle de acesso.
- [ ] Definir estratégia verificável para testes sem contaminação de relatórios; não alterar atendimentos reais e não presumir que prefixo no nome exclui registros dos relatórios.
- [ ] Apresentar banco/migrations/build, controle de acesso e recuperação; aguardar autorização específica para commit/push/deploy.
- [ ] Após publicação autorizada, executar matriz real abaixo com autenticação normal e registros de teste autorizados, perfis/unidades, rascunhos/concorrência e dispositivos. Não usar /agente ou bootstrap em produção.
- [ ] Reabrir consultoras/lojas somente após homologação real e aceite explícito, com gates coordenados e leitores compatíveis.

### Recuperação e sequência restante

Ponto atual seguro: Entrega 2 validada, gate false, aplicação publicada anterior preservada. Falha da ferramenta não justifica desfazer automaticamente a etapa 2. Se houver necessidade real, recuperação pós-2 já preparada em `scripts/prancheta/sql/recuperar-entrega2.sql`, com autorização específica; nunca usá-la após 5/6. Procedimentos por estágio do runbook abaixo permanecem aplicáveis. Cópia criptografada pode ser revalidada offline com `node scripts/prancheta/backup-modulo-p1.mjs <caminho-absoluto-enc.json>` sob o mesmo usuário Windows. Comparação remota somente leitura: `node scripts/prancheta/verificar-integridade-p1.mjs pos2` (depois pos5/pos6). Não restaurar snapshot automaticamente sobre dados novos.

Sequência restante exata: verificar etapa2 → aplicar arquivo completo Entrega5 com hash aprovado → verificar etapa5 + integridade → aplicar arquivo completo Entrega6 com hash aprovado → verificar etapa6 + integridade/histórico → build/testes/restrição → relatório para autorização de publicação → publicação autorizada → homologação autenticada → aceite/reabertura. Qualquer divergência material para somente a escrita afetada; continuar leituras/preparação independentes. Sem migration repair, db push, replay legado, alteração de arquivos aprovados ou registros comerciais para facilitar execução.

## Preparação final de banco e homologação P1 — registro anterior D-021 (16/10/2026)

Complexidade/risco: crítica pelo banco e autorização; continuidade do plano vigente, sem nova auditoria geral. Usuário aprovou visualmente as duas etapas. Preparação não é autorização para migrar produção, habilitar gates, criar Preview, commit/push/deploy ou iniciar P2/P3.

- [x] Registrar pendência futura de público fora da faixa etária/catálogo no ESCOPO, sem solução presumida.
- [x] Consolidar urgências com Entregas 2–6; integrar apenas os ajustes de build já validados no worktree urgente. Handlers de procurar-datas idênticos ao código anterior, Frente 0/Controle.
- [x] Revalidar banco real somente em leitura: normalizador Entrega 1, schemas, constraints, RLS/ACL, dependências e histórico divergente.
- [x] Executar testes focais, SQL isolado, build, lint, regressão de urgências e retomada legada na P1.
- [x] Preparar quatro verificações somente leitura para estados 0/2/5/6 e executar etapa 0 no banco real; gates permanecem fechados.
- [x] Preparar candidato local/manifesto e procedimento de homologação abaixo.
- [ ] Disponibilizar banco isolado + aplicação autenticada ligada exclusivamente a ele; liberar gates somente nesse ambiente com autorização específica.
- [ ] Executar matriz autenticada e concorrência real, com evidências por caso, antes de liberar aplicação/produção.
- [ ] Autorizar janela, aplicação produtiva 2→5→6 e estratégia explícita do registro histórico, sem repair/replay.
- [ ] Autorizar commit/push/deploy, liberação dos gates e reabertura às lojas após aceite.

### Identidade e congelamento

Produção consultada: Supabase `lebebe.app`, ref `phsoawbdvhurroryfnok`, PostgreSQL 17.6.1.063. Não usar esse banco para dados comerciais fictícios. A identidade do banco de homologação deverá ser comprovadamente distinta e registrada antes da primeira escrita. Nome “Preview”, localhost ou bootstrap habilitado não comprovam isolamento do banco.

Candidato local: `output/prancheta-p1-consolidada.patch`, 54 arquivos de fonte/testes/SQL, com base/allowlist/SHA por arquivo em `output/prancheta-p1-candidato.json`. Não aplicado nem versionado nesta etapa. Exclui Mere IA, Moriah, configurações/env, node_modules, logs, Harness e scripts locais de validação. O Harness permanece no checkout separado do pacote de publicação. A migration da Entrega 1 está incluída somente como fonte/teste de correção já efetivada; **não integra a sequência de aplicação**. Não usar o diff integral do workspace. Alteração posterior no candidato invalida seu hash e exige revalidar o aspecto alterado.

### Sequência exata de aplicação controlada — preparada, NÃO executada

Antes de qualquer DDL remoto: obter autorização para o alvo e a janela, comprovar backup recuperável e acesso de recuperação; registrar schema/ACL/funções/constraints e baseline dos registros históricos em armazenamento privado. Contagens desta investigação não são um snapshot congelado: lojas continuam operando. Capturar baseline novo no início da janela; não transportar dados pessoais para o repositório.

No banco isolado, reproduzir a base atual e a correção Entrega 1 já efetivada. Não executar seu arquivo local contra um alvo já corrigido. Executar somente arquivos completos, uma transação por migration, verificando cada pós-condição antes de seguir:

| Ordem | Arquivo relativo ao checkout | Resultado exigido / ponto de parada |
|---|---|---|
| 0 | `scripts/prancheta/sql/validar-normalizador-entrega1.sql` | `normalizador_validado_sem_mutacao`; assinatura/ACL preservadas. Somente leitura |
| 1 | `scripts/prancheta/sql/verificar-p1-etapa0.sql` | `etapa_0_verificada_gates_fechados`; hashes atuais, constraints esperadas e estruturas novas ausentes |
| 2 | `supabase/migrations/20261015185406_atendimento_presencial_contratos_fluxo_v2.sql` | Executar integralmente BEGIN→COMMIT. Sem outras migrations. lock_timeout 5s / statement_timeout 30s |
| 3 | `scripts/prancheta/sql/verificar-p1-etapa2.sql` | `etapa_2_verificada_gates_fechados`; gate v2 false, novas colunas nullable, ACL e hashes esperados. Parar se divergir |
| 4 | `supabase/migrations/20261015203309_atendimento_presencial_criancas_permanentes.sql` | Entrega 2 confirmada, gate fechado, cadastro permanente ainda ausente; executar inteiro |
| 5 | `scripts/prancheta/sql/verificar-p1-etapa5.sql` | `etapa_5_verificada_gates_fechados`; três tabelas com RLS/revogação direta, funções privadas, dois gates false |
| 6 | `supabase/migrations/20261015212015_atendimento_presencial_presente_idade_aproximada.sql` | Entregas 2/5 confirmadas; hashes/constraint de criança esperados; executar inteiro |
| 7 | `scripts/prancheta/sql/verificar-p1-etapa6.sql` | `etapa_6_verificada_gates_fechados`; DATE/boolean nullable, constraints, ACL e hashes finais corretos; ambos gates false |
| 8 | Conferência histórica em leitura | Registros preexistentes preservados, sem backfill de referências, identidade/correspondências não inferidas por nome; comparar baseline anterior sem considerar novas colunas nullable |

Gerador e validação isolada das verificações: `node scripts/prancheta/preparar-preflight-p1.mjs`. Ele executa os SQLs somente em PostgreSQL/WASM efêmero e gera `output/prancheta-p1-preflight.json` com hashes e estados. Não lê env nem se conecta ao Supabase. Não regenerar as migrations para “fazer o preflight passar”. Verificações 2/5/6 ainda não foram executadas no Supabase real, pois suas dependências não existem nele.

SHA256 dos arquivos aprovados nesta preparação:

- Entrega 2: `c07f36cb4389dc2a04cf455b6c46d0c24c5bb79d4dce90a90f9bbf1939b29513`.
- Entrega 5: `98db8f5c2899dc489f214bf2414af3d962d68b273e00e35e79395fa437958d72`.
- Entrega 6: `68c7296d3fffcc603389ac621dc5194d2d0c85400a30ed889d2a02b557bfb53f`.

**Parar** diante de alvo não comprovado, backup/recuperação indisponível, hash/ACL/constraint divergente, estrutura parcialmente existente, gate aberto inesperadamente, timeout/lock, falha de pós-verificação ou alteração de histórico não explicada. Não repetir DDL cegamente. Arquivos têm preflight deliberadamente não reaplicável; timeout transacional exige confirmar rollback/estado antes de retomar. Não executar `db push`, `migration repair`, replay antigo ou `INSERT` manual em `schema_migrations`.

Histórico conhecido: 88 versões remotas; Entrega 1 corrigida por SQL direto sem registro de versão. Três nomes antigos têm versões locais/remotas distintas (STATUS). A aplicação futura deve autorizar explicitamente o mecanismo que executa **somente** o arquivo selecionado e como será registrado seu novo evento, sem fingir que a Entrega 1 foi aplicada por migration. O runbook não reconcilia essas divergências automaticamente.

### Recuperação e interrupção

- Falha dentro de uma migration: não seguir à próxima; confirmar rollback da transação e reexecutar a verificação do estado anterior. Em caso de dúvida, manter acesso ao novo fluxo suspenso e investigar o objeto divergente.
- Após somente Entrega 2: `scripts/prancheta/sql/recuperar-entrega2.sql` exige hashes pós-2, fecha gate e restaura as três funções capturadas, mantendo colunas/constraints/registros. Não usar depois de 5/6: hashes não correspondem mais.
- Após Entrega 5: `scripts/prancheta/sql/recuperar-entrega5.sql` fecha ambos gates, sem excluir cadastro, vínculos, correspondências ou retratos.
- Após Entrega 6: `scripts/prancheta/sql/recuperar-entrega6.sql` fecha ambos gates, preservando DATEs, identidade e histórico. Não restaurar normalizadores antigos sobre dados novos.
- Fechar gates não desfaz os dados já gravados nem constitui rollback de publicação. Se houver dados v2, conservar leitores compatíveis; não promover código antigo incapaz de interpretá-los. Reabertura só após diagnóstico e autorização. Todas as recuperações remotas exigem autorização específica; foram testadas somente em banco efêmero.

### Homologação autenticada preparada

Bloqueio atual confirmado: só um projeto Supabase acessível, zero branches; zero deployments Preview do projeto Vercel `lebebe-app`; consulta de env com decrypt=false retorna 403 e CLI Vercel não instalada. Não há prova de credenciais/banco isolado. Localhost 3205 usa Vite/HTTP sintético e não é ambiente autenticado. Não criar testes fictícios no projeto produtivo nem habilitar bootstrap de produção para contornar isso.

Quando houver autorização/ambiente: confirmar ref isolada nas configurações do backend, servidor e navegador; aplicar/verificar sequência acima; disponibilizar Preview do candidato e seguir `.agents/skills/autenticacao-tecnica-agentes/SKILL.md` (acesso temporário oficial, `/agente`, sessão normal e mesmo contexto, `/api/me/permissoes`). Nunca persistir secrets, cookies ou links temporários. Conta técnica de gestão não comprova todos os perfis: utilizar usuários de teste autorizados do banco isolado para consultora/supervisora/negativos, sem elevar permissões automaticamente.

Há bloqueios de aplicação além dos SQLs: `FichaPageClient.tsx` interrompe conclusão v2; `fluxoNovoAindaNaoLiberado` em `ficha-schema.ts` bloqueia conclusão/edição nas APIs; PATCH concluído também rejeita `row.versao_fluxo != null`. Os dois gates SQL são criados false. **Aplicar migrations ou abrir apenas os gates SQL não libera o fluxo.** Preparar/autorizar uma habilitação restrita ao ambiente controlado e revalidar esses pontos antes da homologação autenticada; nenhuma remoção ou ativação global feita agora. O transform dos harnesses sintéticos não pode ser usado como código de publicação.

Para cada caso registrar perfil/unidade/rota, resultado esperado/obtido, status HTTP, persistência/reabertura, console e evidência sem PII. Todos seguem pendentes em ambiente real:

| Caso | Aceite autenticado exigido |
|---|---|
| Não cliente | Oito visitas; conclusão sem cliente/crianças/lançamento comercial; fora das contagens comerciais |
| Venda fechada | Lançamento obrigatório 1–999999, sem motivos de não fechamento; concluir uma vez, limpar tela e reabrir registro |
| Negociação / Venda perdida | Duas etapas, motivo, observação até 300, Voltar preserva; sem lançamento obrigatório; persistência e reset |
| Crianças | Nova/permanente/histórica, parentesco por vínculo, 13 opções/atalhos, limite oito, retirada sem exclusão; histórico confirma explicitamente, idempotência/concorrência real e homônimos distintos |
| Presente / idade | Sim/Não, mês/ano, DATE dia 1 no fuso de atendimento, referência preservada na reutilização e leitura futura; sem data inventada para legado |
| Cliente / telefone | Nome/telefone recuperados, edição manual preservada, exato normalizado, ação explícita para duplicado, falha/ambiguidade/corrida sem novo cadastro incorreto |
| Rascunhos | Criar, retentar sem duplicar, Ver rascunhos/aba correta, recuperar legado e os formatos v2 já presentes no JSON; autosave independente da etapa |
| Rede / sessões | Offline/recarga, resposta perdida/rebase, mesmo login em dispositivos independentes, duas abas em conflito, duas conexões reais sem sobrescrita |
| Conclusão / erros | Foco/rolagem campo ou alerta, alerta persiste após autosave; 503/422 e 200 inválido sem sucesso falso; reset só após confirmação válida |
| Acessos / unidades | Módulo/janela/perfis, acesso direto negado, atendimento de outro executor/unidade rejeitado, unidade única/múltipla e reset correspondente |
| Leitores / histórico | Finalizados/detalhe/edição/SGI, registros anteriores, novas referências; não misturar reconstrução com prova histórica |
| Dispositivos | Notebook e celular físico, teclado virtual, cabeçalhos/rodapé/foco e área de toque |

### Publicação e reabertura às lojas

Somente após a matriz real, aprovação final e autorizações separadas para banco e publicação. Reconfirmar produção/base e hashes do candidato; rever allowlist, recuperação e baseline no momento da janela. Manter a versão produtiva atual enquanto a P1 está bloqueada. Não promover esta UI de prévia com finalização desabilitada para lojas em operação. Coordenar janela, migrations, leitores compatíveis, habilitação de aplicação/SQL e validação supervisionada; abrir lojas somente quando quatro fluxos concluírem/reabrirem corretamente, permissões/unidades estiverem aprovadas e houver recuperação viável. Sem registros comerciais fictícios em produção. Se qualquer gate falhar, não reabrir nem ampliar permissões para forçar aceite.

### Riscos legados

Banco atual exige cliente/resultado/motivos; crianças são por atendimento e parentesco é geral. Entradas de edição não são contrato definitivo SQL. Novos dados exigem leitores antes da escrita. Não habilitar formulário nas lojas sem Entrega 7. Rollback preserva dados/colunas e suspende escrita incompatível. P2/P3 somente conforme novo escopo autorizado.

## D-034 — Parentesco, diálogo e motivo Cliente Retira

- [x] Cabeçalho dos cards: criança e parentesco por vínculo; múltiplas crianças e ausência de parentesco.
- [x] Filtro salvo multisseleção com as 13 opções do seletor; combinar OR interno com AND para filtros diferentes antes de contar/paginar.
- [x] Hierarquia dos títulos de grupos do filtro reforçada pelo Design System.
- [x] Diálogos de confirmação limitados a aproximadamente 80vw e ao max-width atual.
- [x] Adicionar `cliente_retira` à venda perdida e aos validadores; migration aplicada no Supabase remoto antes da publicação.
- [x] Preservar regra e fluxo atual da confirmação de telefone, inclusive para venda fechada; sem nova opção.
- [x] Testes dirigidos (434 aprovados), ESLint e `git diff --check`; build bloqueado por indisponibilidade de Google Fonts.
