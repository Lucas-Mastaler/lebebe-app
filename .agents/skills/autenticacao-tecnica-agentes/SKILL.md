---
name: autenticacao-tecnica-agentes
description: "Use quando uma tarefa exigir validação visual, browser test/E2E, screenshot, rota protegida ou teste autenticado no Preview do Le Bébé App. Ensina o acesso técnico sem login Google e sem alterar permissões. NÃO use para correções puramente estáticas, typecheck, lint ou tarefas que não abrem a aplicação."
metadata:
  author: le-bebe-app
  version: "1.0.0"
---

# Autenticação técnica para agentes

Use este procedimento somente quando a tarefa realmente precisar abrir ou
testar uma área autenticada. O ambiente padrão é **Preview**, nunca
Production.

## Escolha do acesso ao Preview

- **Codex visual / Claude:** quando o MCP da Vercel estiver disponível
  (`get_access_to_vercel_url` ou equivalente), use o mecanismo oficial de
  Shareable Access temporário para o deployment de Preview. É o caminho
  validado para o Claude — não precisa de nenhum secret manual. Não persista
  nem registre a URL temporária.
- **Codex HTTP:** para uma requisição protegida, use `vercel curl` quando ele
  estiver disponível e for adequado ao teste.
- **Sem MCP da Vercel disponível:** leia o Protection Bypass for Automation
  no secret store seguro do ambiente e envie-o no header
  `x-vercel-protection-bypass`. Nunca coloque o valor em código, Git,
  documentação, logs ou mensagens.

Não desative Vercel Authentication, não mude a proteção do deployment e não
use uma credencial de bypass fora do secret store autorizado.

## Sessão da aplicação

Depois de ultrapassar a proteção da Vercel:

1. Abra `/agente` no mesmo contexto de browser.
2. **Preenchimento do secret**: se a política do agente permitir, obtenha
   `AGENT_TEST_BOOTSTRAP_SECRET` no secret store do ambiente e use-o somente
   no formulário. **O Claude, especificamente, é impedido pela política do
   seu próprio ambiente de digitar senhas/tokens/secrets em qualquer campo —
   isso vale mesmo com autorização explícita da tarefa.** Nesse caso o
   Claude deve: parar exatamente na tela `/agente`, antes do campo do
   secret; pedir ao usuário para preencher manualmente; e só depois continuar,
   **no mesmo contexto/browser** (mesma sessão, mesmos cookies), sem abrir
   um novo contexto nem repetir o bypass.
3. Deixe o Supabase criar a sessão normal em cookies.
4. Preserve esse mesmo contexto/cookies para navegar e validar a tarefa.
5. Se necessário, confirme a sessão em `/api/me/permissoes`.

Não tente login Google como alternativa ao fluxo técnico. Nunca amplie
permissões automaticamente para contornar essa etapa.

## Diagnóstico: formulário retornou erro genérico

Se `/agente` carrega mas o `POST /api/auth/agente` volta com a mensagem
genérica de erro, **não suspeite do secret antes de confirmar que a
requisição chegou à aplicação**:

1. Verifique os logs de runtime do deployment (Preview) para o path
   `/api/auth/agente`. Se não houver nenhuma entrada, a requisição não
   chegou ao Next.js.
2. Distinga a origem do bloqueio pelo corpo da resposta:
   - `{"error":{"code":"401","message":"Protected deployment"},...}` é da
     **própria Vercel** (Deployment Protection barrando a requisição antes
     do app) — isso não tem relação com o secret.
   - `{"ok":false,"message":"..."}` é da **aplicação** — só nesse caso vale
     investigar o secret.
3. Causa típica do bloqueio da Vercel: o Shareable Access expirou entre o
   carregamento da página e o envio do formulário. Uma página `/agente`
   ainda pode aparecer normalmente porque foi servida do cache
   (`x-nextjs-prerender`/`x-vercel-cache: PRERENDER`), mesmo com o acesso já
   expirado — só o `POST`, que nunca é cacheado, revela o bloqueio.
4. Se o bloqueio for da Vercel: gere um **novo** Shareable Access, recarregue
   o Preview e peça o preenchimento manual de novo. Não rotacione
   `AGENT_TEST_BOOTSTRAP_SECRET` por causa disso.
5. Só depois de confirmar (via logs) que o `POST` chegou ao Next.js e a
   aplicação devolveu 401 é que faz sentido investigar secret incorreto,
   variável de ambiente ausente/divergente, ou usuário técnico no Supabase.

## Limites de permissão

A conta técnica é `agente.teste@lebebe.cloud`, com role `user` e perfil
`consultora`. Ela só recebe os módulos atuais desse perfil; não é
superadmin. Se a rota ou a ação exigir módulo indisponível, informe o bloqueio
e pare — nunca amplie permissões, troque perfil ou altere usuário para concluir
um teste.

## Produção e segurança

O bootstrap é permitido somente fora de Production. Em Production, `/agente`
deve continuar retornando 404; não tente habilitá-lo nem contorná-lo.

Nunca persista senha, segredo de bypass, token de acesso/refresh do Supabase,
cookie, service role ou URL temporária. Ao relatar a validação, descreva só o
método utilizado e o resultado, sem valores de credenciais.
