# Autenticação técnica para agentes

## Papel desta documentação

Este documento registra a arquitetura, os limites e a manutenção do acesso
técnico de agentes. O procedimento operacional vive exclusivamente em
`.agents/skills/autenticacao-tecnica-agentes/SKILL.md`; leia a skill quando a
tarefa exigir abrir o Preview, validar visualmente uma tela, executar E2E,
tirar screenshot ou testar uma rota autenticada.

## Estado da arquitetura

- O Preview continua protegido pela Vercel Authentication e tem Protection
  Bypass for Automation habilitado para automação autorizada.
- `/agente` e `POST /api/auth/agente` iniciam o bootstrap técnico apenas fora
  de Production; em Production, a rota continua retornando 404.
- Após o bootstrap, a aplicação usa a sessão Supabase normal em cookies.
- A conta técnica é `agente.teste@lebebe.cloud`, com role `user` e perfil
  `consultora`; não é superadmin e só possui os módulos do perfil.

O Preview é o ambiente padrão de validação autenticada. Production não deve
ser usada para bootstrap nem alterada para viabilizar um teste.

## Shareable Access da Vercel vs. Protection Bypass for Automation

São dois mecanismos distintos para atravessar a Vercel Authentication:

- **Shareable Access** (gerado sob demanda pela integração Vercel MCP, ex.
  `get_access_to_vercel_url`) não exige nenhum secret guardado no ambiente
  do agente — a integração já está autenticada na conta Vercel. É o caminho
  validado para o Claude.
- **Protection Bypass for Automation** (header `x-vercel-protection-bypass`)
  exige um secret do projeto lido de um secret store do ambiente; só é
  necessário quando não há MCP da Vercel disponível.

**Comportamento observado quando o Shareable Access expira**: a sessão de
acesso concedida dura menos que a validade da própria URL temporária. Se o
envio do formulário `/agente` demorar (ex.: aguardando preenchimento manual
do secret), a página pode continuar carregando normalmente por vir do cache
do Next.js (`x-vercel-cache: PRERENDER`), mesmo com o acesso já expirado —
só o `POST /api/auth/agente`, que nunca é cacheado, expõe o bloqueio. Nesse
caso a Vercel responde `401` com corpo
`{"error":{"code":"401","message":"Protected deployment"},...}`, distinto do
`401` genérico da própria aplicação. A renovação é gerar um novo Shareable
Access e recarregar o Preview antes de suspeitar do secret.

**Limitação específica do Claude**: a política do ambiente do Claude Code
proíbe digitar senhas/tokens/secrets em qualquer campo de formulário, mesmo
com autorização da tarefa — por isso o preenchimento de
`AGENT_TEST_BOOTSTRAP_SECRET` em `/agente` é sempre manual pelo usuário; o
Claude só para nessa tela e retoma a validação no mesmo contexto/browser
depois. É a única etapa do fluxo que exige intervenção manual — bypass,
navegação e verificação de perfil/módulos rodam sem depender do usuário.
Depois do login manual, a sessão Supabase persiste normalmente entre
navegações no mesmo contexto, sem diferença do fluxo local.

## Responsabilidades de manutenção

Mantenha o procedimento na skill e este documento focado em arquitetura. Se a
arquitetura mudar, atualize ambos somente no aspecto correspondente: o fluxo
operacional na skill, os contratos e limites aqui. O roteamento no `AGENTS.md`
é a ponte de descoberta compartilhada por Codex e Claude; não crie cópias da
skill em `.claude/skills/` ou nos adaptadores.

Credenciais e artefatos temporários permanecem fora do repositório: senha,
segredo `AGENT_TEST_BOOTSTRAP_SECRET`, Protection Bypass, tokens Supabase,
cookies, service role e URLs temporárias de Shareable Access não podem ser
registrados em Git, documentação, logs ou relatórios.
