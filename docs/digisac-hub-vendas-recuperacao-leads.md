MAPA DO FLUXO — HUB VENDAS → LOJAS → RECUPERAÇÃO AUTOMÁTICA

1. OBJETIVO
- Medir quantos leads entram pelo número Hub/Vendas
- Medir quantos realmente chamam uma loja
- Descobrir qual loja foi chamada primeiro
- Marcar se o cliente chamou mais de uma loja
- Recuperar automaticamente quem não chamou nenhuma loja
- Fazer isso com segurança, sem exagero de envios e sem risco desnecessário

2. CONEXÕES ENVOLVIDAS
- Hub / Vendas
- Loja Portão
- Loja Bigorrilho
- Loja Hauer
- Observação: Hauer / Marechal = mesma conexão

3. MENSAGEM DE SAUDAÇÃO QUE IDENTIFICA O FLUXO
Seja bem-vindo à Central de Atendimento Le🌟Bébé!

Por favor, clique na loja que você deseja falar:

🛒 Loja Portão http://wa.me/+554184426528

🛒 Loja Bigorrilho http://wa.me/+554188043042

🛒 Loja Hauer http://wa.me/+554192220492

4. MOMENTO DE ENTRADA NO FLUXO
- A entrada do lead será registrada quando a saudação for enviada ao cliente na conexão Hub/Vendas

5. IDENTIFICADOR PRINCIPAL
- Chave principal: telefone normalizado
- Não depender do contactId como chave principal
- O padrão exato de normalização deve reaproveitar o padrão já existente no sistema
- Fazer auditoria no código antes de implementar

6. CICLO DO LEAD
- O ciclo do lead acompanha a lógica de 14 dias
- Se o cliente voltar e receber nova saudação depois desse período, inicia novo ciclo
- Cada ciclo é independente para:
  - conversão
  - recuperação
  - tentativa automática
  - loja principal
  - métricas

7. JANELA DE CONVERSÃO
- Depois da entrada no hub, observar as lojas por 24 horas
- Só considerar mensagens:
  - com mesmo telefone
  - após a entrada no hub
  - dentro da janela de 24h
  - em conexão de loja monitorada

8. REGRA DE ATRIBUIÇÃO
- Loja principal = primeira loja chamada
- Também registrar:
  - chamou mais de uma loja? sim/não
  - quantas lojas chamou
  - quais lojas chamou

9. RECUPERAÇÃO AUTOMÁTICA
- Se o cliente não chamou nenhuma loja dentro da janela, entra no fluxo de recuperação
- Cada cliente recebe apenas 1 tentativa automática por ciclo

10. LIMITE DE ENVIO
- Máximo de 15 abordagens automáticas por dia por conexão
- Portão: até 15/dia
- Bigorrilho: até 15/dia
- Hauer: até 15/dia

11. EXCEDENTE DO LIMITE
- Quem não couber no limite diário:
  - entra em fila para o próximo dia, se ainda estiver elegível
  - ou aparece em lista de contato manual
- Deve existir uma listagem tipo:
  - cliente
  - telefone
  - data/hora da entrada
  - conexão prevista
  - motivo: limite diário atingido

12. PRAZO MÁXIMO PARA AUTOMAÇÃO
- O lead pode ficar elegível para automação até 48 horas após a entrada no hub
- Depois de 48 horas:
  - sai da fila automática
  - vai para lista de contato manual

13. HORÁRIO PERMITIDO
- Segunda a sábado
- Das 09:00 às 18:00
- Nunca no domingo
- Nunca fora desse horário
- Usar fuso America/Sao_Paulo

14. RODÍZIO DAS CONEXÕES
- Ordem fixa:
  1. Portão
  2. Bigorrilho
  3. Hauer
  4. repetir
- A conexão que fizer a abordagem assume a responsabilidade pelo lead

15. INTERVALO ENTRE ENVIOS
- Não usar intervalos fechados de 3, 4 ou 5 minutos
- Usar intervalo aleatório entre:
  - 180 segundos
  - 300 segundos
- Com variação real em segundos
- Exemplos:
  - 3min43s
  - 4min25s
  - 3min58s
  - 4min51s

16. REGRA DO INTERVALO
- O intervalo deve ser calculado por conexão
- Exemplo:
  - Portão envia para cliente A
  - sorteia 243s
  - agenda próximo envio de Portão
- Cada conexão tem sua própria sequência de horários
- As conexões podem operar em paralelo

17. COMO O PROCESSAMENTO DEVE FUNCIONAR
- Não deixar uma execução aberta esperando minutos entre um envio e outro
- O correto:
  A) Cron da manhã prepara a fila
  B) outro processo curto executa os itens quando o horário programado vencer

18. CRON / PREPARAÇÃO DA FILA
- Rodar pela manhã
- Preferência: entre 09:00 e 10:00
- Funções:
  - reconciliar pendentes
  - confirmar se o cliente chamou loja
  - selecionar elegíveis
  - respeitar limite diário
  - escolher conexão pelo rodízio
  - escolher versão da mensagem
  - programar horário de envio
  - jogar excedentes em fila / manual

19. RECONCILIAÇÃO
- Antes de enviar qualquer abordagem:
  - verificar novamente nas conexões de loja se o cliente realmente não chamou
- Isso serve como fallback caso webhook falhe ou atrase

20. WEBHOOK
- O webhook será a captura principal
- Ele precisa ser leve
- Deve:
  - filtrar eventos irrelevantes antes de consultar banco
  - identificar conexão
  - normalizar telefone
  - consultar o banco só quando necessário
  - responder rápido
- Não deve salvar tudo

21. O QUE NÃO DEVE SER SALVO
- Não salvar payload completo de todos os webhooks
- Não salvar todas as mensagens de todas as conexões
- Não salvar conversas inteiras
- Não salvar anexos/mídias desse fluxo
- Salvar apenas o necessário para operação e auditoria do fluxo

22. O QUE DEVE SER SALVO
- telefone normalizado
- entrada no hub
- ciclo
- status
- loja principal
- lojas adicionais
- se chamou mais de uma loja
- conexão responsável
- mensagem escolhida
- horário programado
- horário enviado
- resultado do envio
- resposta posterior
- erro relevante
- motivo de bloqueio/manual, se houver

23. STATUS SUGERIDOS
- aguardando_conversao
- convertido_organicamente
- chamou_mais_de_uma_loja
- recuperacao_pendente
- recuperacao_agendada
- recuperacao_processando
- recuperacao_enviada
- recuperacao_respondida
- aguardando_limite_diario
- fila_manual
- erro_recuperacao
- pausado

24. PROTEÇÕES OBRIGATÓRIAS
- pausa geral da automação
- pausa por conexão
- pausa automática por erros consecutivos
- trava contra duplicidade
- reserva do item antes do envio
- validação final antes do envio
- impedir envio fora do horário
- impedir mais de 1 tentativa por ciclo

25. PAUSA AUTOMÁTICA POR ERRO
- Se ocorrerem erros consecutivos em uma conexão:
  - pausar essa conexão automaticamente
  - mostrar alerta na tela
- A pausa geral também deve existir

26. VALIDAÇÃO FINAL ANTES DE CADA ENVIO
Conferir:
- o cliente chamou alguma loja?
- já recebeu abordagem neste ciclo?
- está dentro do horário permitido?
- a conexão está ativa?
- o limite diário não foi atingido?
- o telefone está válido?
- a automação está despausada?

27. MENSAGENS
- Ter pelo menos 5 versões de mensagens
- As versões serão aprovadas manualmente antes de usar
- Registrar qual versão foi usada em cada envio
- Depois medir desempenho por versão

28. PAINEL / TELA
A tela deve mostrar pelo menos:
- total de entradas no hub
- total convertido organicamente
- Portão / Bigorrilho / Hauer
- não chamaram nenhuma loja
- chamaram mais de uma loja
- recuperações enviadas
- recuperações respondidas
- erros
- fila por limite diário
- fila manual
- automação pausada ou ativa

29. LISTAS IMPORTANTES
- Leads aguardando conversão
- Leads convertidos
- Leads que chamaram mais de uma loja
- Leads programados para recuperação
- Leads enviados
- Leads com erro
- Leads que ficaram fora por limite diário
- Leads em fila manual

30. SUPABASE — DIRETRIZ
- O fluxo não deve depender de volume alto de requisições pesadas
- Requisições da API de dados no plano grátis são ilimitadas
- O maior cuidado deve ser com:
  - tamanho do banco
  - egress
  - excesso de dados salvos
- Estratégia:
  - salvar pouco
  - consultar pouco
  - usar consultas curtas
  - usar índices
  - não guardar payloads completos
  - não transformar o Supabase em cópia do Digisac

31. LIMITES / CUIDADOS DE INFRA
Pontos a monitorar:
- tamanho do banco
- egress
- erros do webhook
- erros de envio
- quantidade de leads/dia
- quantidade de itens em fila
- pausas automáticas acionadas

32. ARQUITETURA LÓGICA
ENTRADA
Hub/Vendas envia saudação
→ registra lead

CONVERSÃO
Cliente chama loja
→ webhook identifica
→ marca conversão

RECONCILIAÇÃO
Cron revisa pendentes
→ confirma se chamou loja

RECUPERAÇÃO
Se não chamou
→ entra na fila
→ recebe conexão pelo rodízio
→ recebe horário programado
→ processador envia no horário

PÓS-RECUPERAÇÃO
Se respondeu
→ marcar resposta
Se não respondeu
→ encerrar ciclo automático

33. REGRAS FINAIS FECHADAS
- chave principal: telefone
- nova saudação segue ciclo de 14 dias
- loja principal = primeira chamada
- múltiplas lojas = registrar
- limite diário = 15 por conexão
- elegibilidade automática = até 48h
- depois = fila manual
- segunda a sábado, 09h às 18h
- domingo = sem envio
- intervalo entre envios = 180 a 300 segundos, com segundos reais
- 1 tentativa automática por ciclo
- rodízio = Portão → Bigorrilho → Hauer
- Hauer/Marechal = mesma conexão
- cron prepara fila
- processador curto executa no horário
- reconciliação antes do envio
- pausas e travas obrigatórias

34. PRÓXIMO PASSO RECOMENDADO
- transformar esse mapa em plano técnico de implementação
- auditar:
  - webhook atual do Digisac
  - função atual de normalização de telefone
  - fluxo atual de envio de mensagens
  - estrutura atual do banco
- só depois partir para implementação