# Configuração de Logout Automático às 19h BRT

## Visão Geral

Sistema de logout automático diário que desconecta todos os usuários não-superadmin às 19:00 (horário de Brasília - America/Sao_Paulo). O objetivo é medir acessos diários na plataforma.

## Regras de Negócio

✅ **Todos os dias às 19:00 BRT**: Sessões ativas de usuários não-superadmin são encerradas

✅ **Superadmins não são desconectados**: Apenas usuários com `role !== 'superadmin'` são afetados

✅ **Auditoria completa**: Cada logout é registrado na tabela `auditoria_acesso`

✅ **Sem bloqueio**: Usuários podem fazer login novamente imediatamente após o logout

✅ **Validação em tempo real**: O middleware verifica se o usuário deve ser desconectado a cada requisição após 19h

## Arquitetura

### 1. Cron Job (Vercel)
- **Arquivo**: `src/app/api/cron/auto-logout/route.ts`
- **Execução**: Diariamente às 22:00 UTC (19:00 BRT)
- **Função**: Invalida sessões ativas do Supabase Auth para usuários não-superadmin

### 2. Middleware
- **Arquivo**: `src/middleware.ts`
- **Função**: Valida em cada requisição se o usuário deve ser desconectado
- **Trigger**: Se após 19h BRT e usuário ainda não foi desconectado hoje

### 3. Banco de Dados
- **Tabela**: `sessoes_logout_automatico`
- **Função**: Rastreia quando cada usuário foi desconectado pela última vez
- **Migration**: `supabase/migrations/006_auto_logout_audit.sql`

## Configuração

### 1. Variáveis de Ambiente

Adicione no arquivo `.env.local`:

```bash
# Cron Job Secret (gere um token seguro)
CRON_SECRET=seu_token_secreto_aqui

# Supabase Service Role Key (necessário para invalidar sessões)
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_do_supabase
```

**Como gerar CRON_SECRET:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Onde encontrar SUPABASE_SERVICE_ROLE_KEY:**
1. Acesse o dashboard do Supabase
2. Vá em Settings → API
3. Copie a chave "service_role" (⚠️ NUNCA exponha no frontend)

### 2. Executar Migration

```bash
# Local
npx supabase migration up

# Produção (via Supabase Dashboard)
1. Acesse o dashboard do Supabase
2. Vá em Database → Migrations
3. Execute a migration 006_auto_logout_audit.sql
```

### 3. Configurar Vercel Cron

O arquivo `vercel.json` já está configurado:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-logout",
      "schedule": "0 22 * * *"
    }
  ]
}
```

**⚠️ Importante:** 
- O horário está em UTC (22:00 UTC = 19:00 BRT)
- No deploy da Vercel, configure a variável `CRON_SECRET`

### 4. Deploy

```bash
# Deploy para produção
git add .
git commit -m "feat: implementar logout automático às 19h BRT"
git push

# Na Vercel, adicione as variáveis de ambiente:
# - CRON_SECRET
# - SUPABASE_SERVICE_ROLE_KEY
```

## Funcionamento Detalhado

### Fluxo do Cron Job (19:00 BRT)

1. **Vercel dispara o cron** → `/api/cron/auto-logout`
2. **Validação de segurança** → Verifica `CRON_SECRET` no header `Authorization`
3. **Busca usuários não-superadmin** → Query na tabela `usuarios_permitidos`
4. **Para cada usuário:**
   - Busca sessão ativa no Supabase Auth
   - Executa `auth.admin.signOut(userId)` para invalidar token/sessão
   - Registra na tabela `sessoes_logout_automatico`
   - Insere evento `AUTO_LOGOUT_19H` na `auditoria_acesso`
5. **Logs detalhados** no console:
   ```
   [AUTO-LOGOUT] Iniciando processo às 19h BRT (05/02/2026, 19:00:00)
   [AUTO-LOGOUT] 15 usuários não-superadmin ativos encontrados
   [AUTO-LOGOUT] ✓ Sessão encerrada para user@example.com
   [AUTO-LOGOUT] ✓ Auditoria registrada para user=user@example.com
   [AUTO-LOGOUT] 19h BRT: desconectando 15 sessões (exceto superadmin)
   ```

### Fluxo do Middleware (em tempo real)

1. **Usuário faz requisição** após 19h BRT
2. **Middleware verifica:**
   - É superadmin? → Permite acesso
   - Já foi desconectado hoje? → Verifica tabela `sessoes_logout_automatico`
   - Passou das 19h? → Verifica horário BRT
3. **Se deve desconectar:**
   - Executa `supabase.auth.signOut()`
   - Redireciona para `/login?auto_logout=true`
   - Log: `[MIDDLEWARE] Desconectando user@example.com - passou das 19h BRT`

## Auditoria

Cada logout automático gera um registro completo:

```json
{
  "acao": "AUTO_LOGOUT_19H",
  "email": "usuario@example.com",
  "ip": null,
  "user_agent": "SYSTEM_CRON",
  "metadata": {
    "motivo": "Desconectado automaticamente às 19:00 (America/Sao_Paulo)",
    "usuario_id": "uuid-do-usuario",
    "role": "user",
    "sessao_id": "uuid-do-usuario",
    "origem": "system",
    "horario_brt": "05/02/2026, 19:00:00",
    "horario_utc": "2026-02-05T22:00:00.000Z"
  },
  "created_at": "2026-02-05T22:00:01.123Z"
}
```

### Consultar Auditoria

```sql
-- Todos os logouts automáticos de hoje
SELECT 
  email,
  metadata->>'horario_brt' as horario_desconexao,
  created_at
FROM auditoria_acesso
WHERE acao = 'AUTO_LOGOUT_19H'
  AND created_at::date = CURRENT_DATE
ORDER BY created_at DESC;

-- Usuários que acessaram hoje (fizeram login após logout)
SELECT DISTINCT email, MAX(created_at) as ultimo_acesso
FROM auditoria_acesso
WHERE acao = 'LOGIN_SUCESSO'
  AND created_at::date = CURRENT_DATE
  AND created_at > (
    SELECT MAX(created_at) 
    FROM auditoria_acesso 
    WHERE acao = 'AUTO_LOGOUT_19H' 
      AND auditoria_acesso.email = email
  )
GROUP BY email;
```

## Testes

### Testar Localmente

```bash
# Testar o endpoint do cron (precisa do CRON_SECRET)
curl -X GET http://localhost:3000/api/cron/auto-logout \
  -H "Authorization: Bearer seu_cron_secret_aqui"
```

### Testar em Produção

```bash
# Usar o cron-jobs.vercel.app ou Vercel Dashboard
# Acesse: https://vercel.com/seu-projeto/settings/crons
# Clique em "Run Now" no cron job
```

### Validar Middleware

1. Faça login como usuário comum (não-superadmin)
2. Altere manualmente o horário do sistema para 19:30 BRT
3. Tente acessar qualquer página protegida
4. Deve ser redirecionado para `/login?auto_logout=true`

## Troubleshooting

### Cron não está executando

✅ Verifique se `CRON_SECRET` está configurado na Vercel
✅ Confirme que o cron está ativo no dashboard da Vercel
✅ Verifique os logs da Vercel para erros

### Usuários não sendo desconectados

✅ Confirme que `SUPABASE_SERVICE_ROLE_KEY` está correta
✅ Verifique se a migration foi executada
✅ Confirme que os usuários não são superadmin
✅ Verifique os logs do cron job

### Timezone incorreto

✅ O código usa `America/Sao_Paulo` explicitamente
✅ Não depende do timezone do servidor
✅ Logs mostram tanto UTC quanto BRT

## Métricas de Acesso

Para medir acessos diários reais:

```sql
-- Usuários que acessaram após o logout automático (acessos reais do dia)
WITH logouts_hoje AS (
  SELECT email, MAX(created_at) as horario_logout
  FROM auditoria_acesso
  WHERE acao = 'AUTO_LOGOUT_19H'
    AND created_at::date = CURRENT_DATE
  GROUP BY email
)
SELECT 
  l.email,
  l.horario_logout as desconectado_as,
  a.created_at as acessou_as,
  EXTRACT(EPOCH FROM (a.created_at - l.horario_logout))/60 as minutos_depois
FROM logouts_hoje l
INNER JOIN auditoria_acesso a ON a.email = l.email
WHERE a.acao = 'LOGIN_SUCESSO'
  AND a.created_at > l.horario_logout
  AND a.created_at::date = CURRENT_DATE
ORDER BY a.created_at DESC;
```

## Manutenção

### Desabilitar temporariamente

Comente a linha no `vercel.json`:
```json
{
  "crons": []
}
```

### Alterar horário

Edite o schedule no `vercel.json` (formato cron UTC):
```json
{
  "crons": [
    {
      "path": "/api/cron/auto-logout",
      "schedule": "0 21 * * *"  // 18:00 BRT
    }
  ]
}
```

## Segurança

⚠️ **NUNCA** exponha o `CRON_SECRET` no frontend
⚠️ **NUNCA** commite o `.env.local` no git
⚠️ Use HTTPS em produção
✅ O endpoint valida o `CRON_SECRET` antes de executar
✅ Apenas service role pode invalidar sessões
✅ Logs completos para auditoria

## Suporte

Para dúvidas ou problemas, verifique:
1. Logs da Vercel (Runtime Logs)
2. Logs do Supabase (Dashboard → Logs)
3. Tabela `auditoria_acesso` com filtro `acao = 'AUTO_LOGOUT_19H'`
