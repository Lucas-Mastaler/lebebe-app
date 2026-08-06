Você está trabalhando no repositório do projeto Le Bébé App.

Antes de analisar, planejar ou alterar qualquer arquivo, siga obrigatoriamente o protocolo abaixo.

OBJETIVO DESTA INSTRUÇÃO

Esta instrução define como navegar pelo projeto, localizar regras, consultar documentação, validar o código real e registrar continuidade entre agentes.

Ela não substitui as regras específicas existentes no repositório. Sempre leia os arquivos reais antes de executar uma tarefa.

1. HIERARQUIA DE FONTES DO PROJETO

Use esta ordem de prioridade:

1. Código real atualmente presente no repositório.
2. Regras aplicáveis em `.devin/rules/`.
3. Documentação específica da funcionalidade em `docs/`.
4. Histórico de continuidade em `docs/ia/log_progress.md`.
5. Skills e workflows existentes em `.devin/skills/` e `.devin/workflows/`.
6. Descrição fornecida pelo usuário na tarefa atual.

Em caso de divergência:

* Não escolha silenciosamente uma versão.
* Informe claramente a divergência.
* Considere o código real como evidência do comportamento implementado.
* Considere os documentos de escopo explicitamente identificados como contratos de escopo.
* Não altere regra de negócio sem confirmação explícita.
* Quando não puder confirmar algo, registre: “não confirmado no código”.

2. LEITURA OBRIGATÓRIA DE `.devin/rules`

Antes de qualquer tarefa relevante:

1. Liste os arquivos existentes em `.devin/rules/`.
2. Leia todas as regras com aplicação global ou `trigger: always_on`.
3. Identifique regras específicas relacionadas ao módulo da tarefa.
4. Aplique todas as regras compatíveis em conjunto.
5. Não considere que o nome do arquivo é suficiente para entender a regra; leia seu conteúdo.

As regras em `.devin/rules/` são obrigatórias para o projeto.

Não ignore uma regra por ela ter sido criada originalmente para outro agente ou ferramenta. Elas também devem orientar o trabalho realizado pelo Codex.

Caso existam regras aparentemente duplicadas:

* Não descarte nenhuma automaticamente.
* Consolide as exigências.
* Em caso de conflito real, informe o conflito antes de editar.

3. USO DE `.devin/skills`

A pasta `.devin/skills/` contém orientações especializadas.

Antes de começar:

1. Liste as skills disponíveis.
2. Verifique se alguma corresponde à tecnologia, módulo ou tipo de tarefa atual.
3. Leia apenas as skills relevantes para a tarefa.
4. Use a skill como orientação complementar, sem substituir a leitura do código e das rules.

Não execute uma skill apenas pelo nome. Leia seu conteúdo e confirme que se aplica à tarefa.

4. USO DE `.devin/workflows`

A pasta `.devin/workflows/` contém processos padronizados para determinados tipos de trabalho.

Antes de implementar:

1. Liste os workflows disponíveis.
2. Verifique se existe workflow relacionado à tarefa solicitada.
3. Leia o workflow aplicável antes de alterar arquivos.
4. Siga suas etapas quando forem compatíveis com as regras globais e com o pedido atual.

Não execute workflows sem relação com a tarefa.

Não amplie o escopo para completar etapas opcionais ou paralelas que o usuário não solicitou.

5. NAVEGAÇÃO DA PASTA `docs`

A pasta `docs/` contém documentos de contexto, contratos de escopo, decisões, planos, auditorias e registros técnicos.

Antes de editar um módulo:

1. Liste os arquivos e subpastas relevantes dentro de `docs/`.
2. Pesquise pelo nome do módulo, rota, integração, tabela, funcionalidade e termos relacionados à tarefa.
3. Leia os documentos diretamente relacionados.
4. Verifique especialmente a pasta `docs/ia/`.
5. Não leia somente o primeiro documento encontrado quando houver outros documentos claramente relacionados.

Trate a documentação como contexto e registro de decisões.

Não trate documentação antiga como prova absoluta do estado atual. Confirme no código real.

Documentos explicitamente definidos como “contrato de escopo” devem ser respeitados. Caso o código atual esteja diferente do contrato, informe a divergência antes de alterar.

6. CONTINUIDADE ENTRE AGENTES

Antes de iniciar qualquer tarefa relevante, leia:

`docs/ia/log_progress.md`

Use esse arquivo para entender:

* trabalhos recentes;
* decisões já tomadas;
* arquivos alterados;
* validações realizadas;
* pendências;
* riscos conhecidos;
* próximos passos recomendados.

O arquivo é um resumo de continuidade, não uma fonte absoluta da verdade.

Sempre valide no código real qualquer informação necessária para a tarefa.

Não assuma que algo foi implementado apenas porque aparece no log.

7. ATUALIZAÇÃO OBRIGATÓRIA DO LOG

Ao finalizar uma tarefa relevante, atualize:

`docs/ia/log_progress.md`

Registre:

* data;
* agente ou ferramenta utilizada;
* resumo do trabalho;
* arquivos lidos;
* arquivos criados ou alterados;
* validações realizadas;
* comandos executados;
* resultados dos comandos;
* pendências;
* riscos conhecidos;
* próximo passo recomendado.

Não registre:

* secrets;
* tokens;
* senhas;
* chaves de API;
* cookies;
* dados pessoais sensíveis;
* conteúdo desnecessário do chat.

Não invente validações.

Quando algo não tiver sido confirmado, registre explicitamente como “não confirmado”.

8. PRESERVAÇÃO DE ENCODING DO LOG

Ao editar `docs/ia/log_progress.md`:

1. Leia o arquivo antes de alterá-lo.
2. Preserve o encoding existente.
3. Preserve o padrão de quebra de linha existente quando possível.
4. Adicione somente a nova entrada necessária.
5. Não reformate o documento inteiro.
6. Não altere entradas antigas sem solicitação explícita.

Não use comandos como:

`echo "texto com acento" >> arquivo`

Não use redirecionamentos de terminal que possam corromper caracteres especiais.

Prefira a ferramenta de edição de arquivos do ambiente.

Caso seja necessário usar script, prefira Node.js com leitura e gravação explícita em UTF-8:

* `fs.readFileSync(caminho, 'utf8')`
* `fs.writeFileSync(caminho, conteudo, 'utf8')`

Se o arquivo já apresentar caracteres corrompidos:

* não tente corrigir todo o histórico durante uma tarefa não relacionada;
* informe o problema;
* limite a edição à nova entrada;
* não regrave o documento inteiro.

9. INVESTIGAÇÃO ANTES DE ALTERAR

Nunca altere um arquivo imediatamente após receber a tarefa.

Primeiro identifique o fluxo real envolvido.

Investigue, quando aplicável:

* página ou rota de entrada;
* componente principal;
* componentes filhos;
* hooks;
* schemas;
* tipos;
* helpers;
* services;
* API routes;
* server actions;
* autenticação;
* permissões;
* queries;
* tabelas;
* integrações externas;
* retorno para a interface;
* testes relacionados.

Não conclua comportamento usando apenas:

* nome de arquivo;
* nome de função;
* comentário;
* documentação isolada;
* memória de tarefa anterior.

Toda conclusão deve ser baseada em leitura real.

10. RESPOSTA ANTES DE EDITAR

Antes de aplicar alterações relevantes, apresente de forma objetiva:

1. Entendimento do pedido.
2. Regras e documentos consultados.
3. Arquivos realmente envolvidos.
4. Diagnóstico confirmado no código.
5. Hipóteses ou pontos não confirmados.
6. Validação do banco, quando aplicável.
7. Plano mínimo de alteração.
8. Impactos esperados.
9. O que permanecerá intacto.

Não apresente como confirmado aquilo que ainda é hipótese.

11. ESCOPO E MUDANÇA MÍNIMA

Trabalhe somente no que foi solicitado.

É proibido, sem autorização explícita:

* fazer refactors paralelos;
* reorganizar arquivos por estética;
* renomear funções, tipos ou componentes fora do escopo;
* alterar layout não relacionado;
* alterar textos não relacionados;
* substituir arquitetura existente;
* introduzir nova biblioteca sem necessidade;
* corrigir problemas extras encontrados;
* mudar regras de negócio como “melhoria”;
* ampliar a tarefa por conveniência técnica.

Quando encontrar outro problema:

* não o corrija automaticamente;
* liste-o separadamente;
* explique o risco;
* mantenha a tarefa atual no escopo solicitado.

Prefira sempre a menor alteração capaz de resolver a demanda.

12. BANCO DE DADOS E SUPABASE

Quando a tarefa envolver qualquer um dos itens abaixo, consulte obrigatoriamente o MCP do Supabase antes de implementar:

* tabelas;
* colunas;
* tipos;
* enums;
* migrations;
* foreign keys;
* joins;
* views;
* índices;
* triggers;
* funções SQL;
* constraints;
* RLS;
* policies;
* autenticação;
* persistência;
* queries de leitura ou escrita.

Nunca assuma a estrutura do banco com base apenas no código ou em migrations antigas.

Valide no MCP:

* estrutura atual;
* tipos reais;
* relações;
* constraints;
* policies;
* possíveis dados existentes;
* impacto da mudança.

Caso o MCP do Supabase não esteja disponível:

* não invente a estrutura;
* marque a validação como pendente;
* informe exatamente o que precisa ser verificado;
* evite alterações de banco que dependam dessa confirmação.

13. INTEGRAÇÕES EXTERNAS

Quando a tarefa tocar uma integração externa:

1. Localize onde ela é configurada.
2. Localize onde é chamada.
3. Leia os tipos, adaptadores e tratamentos de erro.
4. Confirme payload e resposta no código ou documentação oficial disponível.
5. Não invente campos, status ou comportamento.
6. Não exponha credenciais em logs ou respostas.

Integrações relevantes podem incluir, entre outras:

* Digisac;
* Google;
* Supabase;
* Resend;
* OSRM;
* serviços de geocodificação;
* SGI;
* Redis.

14. NOVAS TELAS E PERMISSÕES

Antes de criar ou alterar uma tela interna, leia obrigatoriamente:

`docs/ia/padrao-novas-telas-permissoes.md`

Verifique:

* cadastro do módulo em `app_modulos`;
* proteção com `checkModuleAndWindowAccess(moduleKey)`;
* item do Sidebar com `moduleKey`;
* redirect para `/acesso-negado`;
* redirect para `/fora-do-horario`;
* fallback neutro para `/inicio`;
* classificação correta de páginas públicas, webhooks, callbacks OAuth e crons.

Não crie tela interna sem investigar o padrão atual de permissões.

15. MÓDULO DE RECEBIMENTO

O módulo de recebimento é crítico.

Qualquer alteração relacionada a recebimento deve validar impacto em:

* listagem;
* conferência;
* itens;
* volumes;
* OS;
* divergências;
* timer;
* inatividade;
* recálculo;
* finalização;
* cancelamento;
* `matic_sku`;
* Google Sheets;
* importação de XML;
* permissões.

Não altere cálculos de volumes, timer, OS, divergências ou finalização sem ler o fluxo completo.

Se envolver banco, consulte o MCP do Supabase antes de assumir qualquer estrutura.

16. INTELIGÊNCIA COMERCIAL

Em tarefas relacionadas à Inteligência Comercial, considere o SGI como fonte operacional primária para auditoria dos dados.

Quando houver divergência, investigue nesta ordem:

1. relatório original no SGI;
2. HTML bruto capturado;
3. parser;
4. JSON processado;
5. importador;
6. Supabase;
7. API do aplicativo;
8. cálculo e exibição no frontend.

O bloco sem cliente deve ser ignorado integralmente nos cálculos, salvo decisão explícita que altere essa regra.

Não altere indicadores sem validar:

* filtros;
* status;
* operações;
* devoluções;
* pagamentos;
* crédito de troca;
* pendência;
* frete;
* descontos;
* ticket médio;
* exclusão de registros sem cliente.

17. REGRA ESPECIAL PARA `/procurar-datas`

Toda tarefa relacionada ao motor `/procurar-datas` deve ser classificada antes de qualquer orientação ou alteração:

* Frente 0 / Controle: escopo, documentação, checklist, decisões, regras e critérios de aceite.
* Frente 1 / esquerda: distância, agenda, geocodificação, OSRM, Haversine, origem, delta de inserção e helpers puros.
* Frente 2 / meio: candidatos, classificação, adaptação do legado e ranking.
* Frente 3 / direita: rota diagnóstica `/api/procurar-datas/v2/diagnostico`, flags, snippets DevTools e validações manuais.

Informe explicitamente a frente correta no início da análise.

Antes de trabalhar em `/procurar-datas`, leia obrigatoriamente:

* `docs/procurar-datas-escopo-equivalencia-legado-v2.md`
* `docs/procurar-datas-motor-v2-progresso.md`
* `docs/ia/log_progress.md`

O arquivo `docs/procurar-datas-escopo-equivalencia-legado-v2.md` é o contrato de escopo da migração.

A v2 deve preservar equivalência funcional com o legado Apps Script nas regras de negócio.

Consulte como fonte de verdade do legado:

* `appscript/CEP-APIBACK.gs`
* `appscript/CEP-CONFIG.gs`

Quando houver dúvida sobre:

* distância;
* frete;
* delta;
* agenda;
* origem;
* sábado;
* fallback;
* candidatos;
* classificação;
* ranking;
* fonte de dados;
* comportamento esperado;

leia o legado antes de alterar ou propor qualquer comportamento.

Não invente regra ausente.

Se o trecho necessário não estiver disponível, registre a pendência e informe exatamente qual código legado precisa ser fornecido.

OSRM é o cálculo oficial de rota e distância quando assim utilizado pelo legado.

Haversine somente pode ser usado como apoio, filtro, ordenação preliminar ou fallback nos pontos em que o legado também o utiliza dessa forma.

Não use Haversine como cálculo oficial de `kmAdicionalNaRotaM` sem confirmação explícita no legado.

Não avance alterações da Frente 2 enquanto a equivalência OSRM entre legado e v2 não estiver validada.

Quando uma regra da migração for validada, uma pendência for resolvida ou um risco mudar, atualize também:

`docs/procurar-datas-escopo-equivalencia-legado-v2.md`

Preserve o encoding e não reformate o documento inteiro.

18. VALIDAÇÕES APÓS ALTERAR

Depois da implementação:

1. Revise o diff completo.
2. Confirme que somente arquivos do escopo foram alterados.
3. Execute as validações apropriadas disponíveis no projeto.
4. Execute typecheck, lint, testes e build quando forem pertinentes e viáveis.
5. Registre os comandos realmente executados.
6. Informe resultados e erros encontrados.
7. Não diga que algo foi validado quando o comando não foi executado.
8. Não esconda falhas preexistentes.
9. Diferencie erro causado pela alteração de erro já existente.
10. Verifique se arquivos temporários ou logs indevidos foram criados.

Não corrija automaticamente erros preexistentes fora do escopo.

19. FORMATO DO RELATÓRIO FINAL

Ao finalizar, informe:

1. Resumo do que foi feito.
2. Arquivos lidos.
3. Arquivos criados ou alterados.
4. Mudanças realizadas.
5. Validações executadas.
6. Resultados.
7. O que não foi validado.
8. Riscos conhecidos.
9. Pendências.
10. Próximo passo recomendado.

Não use frases genéricas como “tudo corrigido” ou “implementação concluída com sucesso” sem evidências.

20. REGRA FINAL

Antes de qualquer alteração:

* leia as rules aplicáveis;
* leia o log de progresso;
* localize documentação específica;
* investigue o fluxo completo no código;
* consulte o MCP Supabase quando houver banco;
* apresente diagnóstico e plano mínimo;
* faça somente a alteração solicitada;
* valide o resultado;
* atualize o log com segurança.

Nunca substitua investigação real por suposição.
