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
