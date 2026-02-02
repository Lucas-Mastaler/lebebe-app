# 📧 Setup Resend - Sistema de Emails le bébé

## 🎯 Objetivo

Migrar o envio de emails (convite e reset de senha) do Supabase SMTP para **Resend**, mantendo o Supabase apenas para gerar links seguros.

---

## ✅ Implementação Completa

### 1. Arquitetura

**Fluxo de Convite**:
```
Superadmin → Endpoint → Supabase Admin API (gera link) → Resend (envia email)
```

**Fluxo de Reset**:
```
Usuário → Endpoint → Supabase Admin API (gera link) → Resend (envia email)
```

**Supabase**: Apenas gera links seguros com OTP  
**Resend**: Responsável por TODO envio de email  
**From**: `lebebe.app@lebebe.cloud`

---

## 📦 Dependências Instaladas

```bash
npm install resend
```

---

## 🔧 Variáveis de Ambiente

Adicionar no `.env.local`:

```env
# Resend (Email Service)
RESEND_API_KEY=re_sua_chave_aqui
RESEND_FROM=lebebe.app@lebebe.cloud
RESEND_REPLY_TO=lucas@lebebe.com.br

# URL da aplicação (usar conforme ambiente)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**⚠️ IMPORTANTE**:
- `RESEND_API_KEY`: Obter em https://resend.com/api-keys
- `RESEND_FROM`: Domínio `lebebe.cloud` deve estar verificado no Resend
- `NEXT_PUBLIC_APP_URL`: Trocar para `https://lebebe.cloud` em produção

---

## 🚀 Setup do Resend (Dashboard)

### 1. Criar Conta Resend
1. Ir em https://resend.com
2. Criar conta (usar email `lucas@lebebe.com.br`)
3. Verificar email

### 2. Adicionar e Verificar Domínio

**Passo a passo**:
1. Dashboard Resend → **Domains** → **Add Domain**
2. Informar: `lebebe.cloud`
3. Copiar os registros DNS fornecidos:
   ```
   Type: TXT
   Name: @
   Value: resend-verify=XXXXXXXXXXXX
   
   Type: MX
   Name: @
   Value: feedback-smtp.us-east-1.amazonses.com (Priority: 10)
   
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none;
   
   Type: TXT  
   Name: resend._domainkey
   Value: (chave DKIM fornecida)
   ```

4. **Adicionar registros no Gerenciador DNS** (Cloudflare, HostGator, etc.)
5. Aguardar propagação (até 24h, geralmente < 1h)
6. No Resend: **Verify DNS Records**
7. Status deve mudar para **Verified** ✅

### 3. Gerar API Key

1. Dashboard Resend → **API Keys** → **Create API Key**
2. Name: `le-bebe-production`
3. Permission: **Full Access** (ou **Sending Access**)
4. Copiar a chave `re_XXXXXXXXXXXX`
5. Adicionar no `.env.local` como `RESEND_API_KEY`

**⚠️ SEGURANÇA**:
- Nunca commitar a API key no Git
- Usar variável de ambiente em produção (Vercel, Railway, etc.)

---

## 📁 Arquivos Criados/Modificados

### Criados:
- ✅ `src/lib/email/resend.ts` - Cliente Resend + templates HTML
- ✅ `src/app/api/auth/recuperar-senha/route.ts` - Reset via Resend

### Modificados:
- ✅ `src/types/supabase.ts` - Ações de auditoria (INVITE_EMAIL_SENT, etc)
- ✅ `src/app/api/superadmin/adicionar-usuario/route.ts` - Convite via Resend
- ✅ `src/app/api/superadmin/reenviar-convite/route.ts` - Reenvio via Resend
- ✅ `src/app/(auth)/recuperar-senha/page.tsx` - Usa endpoint server-side

---

## 🎨 Templates de Email

### Convite de Novo Usuário
**Subject**: `Convite - le bébé`  
**From**: `lebebe.app@lebebe.cloud`  
**Conteúdo**:
- Logo do le bébé
- Mensagem de boas-vindas
- Botão "Definir Senha e Acessar"
- Aviso: link único, expira em 24h
- Footer com ano e copyright

### Reset de Senha
**Subject**: `Recuperação de Senha - le bébé`  
**From**: `lebebe.app@lebebe.cloud`  
**Conteúdo**:
- Logo do le bébé
- Mensagem de recuperação
- Botão "Redefinir Senha"
- Aviso: link único, expira em 1h
- Footer com ano e copyright

**Logo**: `https://phsoawbdvhurroryfnok.supabase.co/storage/v1/object/public/logo/logo.png`

---

## 🧪 Testes

### Teste 1: Convite de Novo Usuário

**Objetivo**: Verificar que email chega via Resend com remetente correto.

**Passos**:
1. Login como superadmin
2. `/superadmin` → Tab "Usuários" → "Adicionar Usuário"
3. Email: `teste@lebebe.com.br`
4. Aguardar mensagem de sucesso

**Verificar**:
- ✅ Email recebido (verificar spam se dev)
- ✅ Remetente: `lebebe.app@lebebe.cloud`
- ✅ Assunto: "Convite - le bébé"
- ✅ Template com logo e cores le bébé
- ✅ Botão funciona e abre `/definir-senha`

**Logs esperados**:
```
[INVITE] Gerando link de convite para teste@lebebe.com.br
[INVITE] Link gerado com sucesso para teste@lebebe.com.br
[RESEND] Enviando email para teste@lebebe.com.br
[RESEND] Email enviado com sucesso messageId=abc123
```

**Dashboard Resend**:
- Ir em **Logs** → Verificar email com status **Delivered** ✅

---

### Teste 2: Duplo Clique (Idempotência)

**Objetivo**: Garantir que apenas 1 email é enviado.

**Passos**:
1. Adicionar usuário
2. Clicar 3x rapidamente no botão "Adicionar"

**Resultado esperado**:
- ✅ Apenas 1 log `[RESEND] Email enviado`
- ✅ Apenas 1 email no Dashboard Resend
- ✅ Apenas 1 auditoria `INVITE_EMAIL_SENT`

---

### Teste 3: Throttle (< 60s)

**Objetivo**: Bloquear reenvio antes de 60 segundos.

**Passos**:
1. Adicionar usuário: `throttle@lebebe.com.br`
2. Imediatamente (< 10s), tentar adicionar novamente

**Resultado esperado**:
- ✅ Erro: "Convite já enviado recentemente. Aguarde X segundos"
- ✅ HTTP Status 429
- ✅ Nenhum email enviado no segundo clique

---

### Teste 4: Reset de Senha

**Objetivo**: Verificar recuperação de senha via Resend.

**Passos**:
1. Ir em `/login` → "Esqueci minha senha"
2. Informar email cadastrado
3. Clicar "Enviar link de recuperação"

**Verificar**:
- ✅ Email recebido
- ✅ Remetente: `lebebe.app@lebebe.cloud`
- ✅ Assunto: "Recuperação de Senha - le bébé"
- ✅ Botão funciona e abre `/resetar-senha`

**Logs esperados**:
```
[RESET] Gerando link de recuperação para usuario@lebebe.com.br
[RESET] Link gerado com sucesso para usuario@lebebe.com.br
[RESEND] Enviando email de reset para usuario@lebebe.com.br
[RESEND] Email de reset enviado com sucesso messageId=xyz789
```

---

### Teste 5: Email Inválido

**Objetivo**: Validar que emails inválidos são rejeitados.

**Passos**:
1. Tentar adicionar usuário com email: `emailsemarroba`

**Resultado esperado**:
- ✅ Erro: "Email inválido"
- ✅ Nenhum email enviado
- ✅ Nenhum log `[RESEND]`

---

### Teste 6: Link Expirado + Reenvio

**Objetivo**: Testar reenvio via Resend quando link expira.

**Passos**:
1. Simular link expirado: `http://localhost:3000/definir-senha#error_code=otp_expired`
2. Preencher email: `teste@lebebe.com.br`
3. Clicar "Reenviar Convite"

**Resultado esperado**:
- ✅ Novo email enviado via Resend
- ✅ Log: `[RESEND] Email reenviado com sucesso`
- ✅ Auditoria: `INVITE_EMAIL_SENT` com `action: 'resend'`

---

## 📊 Auditoria

Novas ações registradas:

| Ação | Quando | Metadata |
|------|--------|----------|
| `INVITE_EMAIL_SENT` | Email de convite enviado | `target_email`, `role`, `action?` |
| `INVITE_EMAIL_FAILED` | Falha ao enviar convite | `target_email`, `error` |
| `RESET_EMAIL_SENT` | Email de reset enviado | `action: 'password_reset'` |
| `RESET_EMAIL_FAILED` | Falha ao enviar reset | `error` |

**Verificar em**: `/superadmin` → Tab "Auditoria"

---

## 🐛 Troubleshooting

### Email Não Chega

**Possíveis causas**:

1. **Domínio não verificado no Resend**
   - Verificar: Dashboard Resend → Domains → Status deve ser **Verified**
   - Solução: Adicionar registros DNS corretos

2. **API Key inválida**
   - Verificar: `.env.local` tem `RESEND_API_KEY=re_...`
   - Solução: Gerar nova key no Dashboard Resend

3. **Email bloqueado (spam)**
   - Em dev: Supabase/Resend podem ser marcados como spam
   - Solução: Verificar pasta de spam

4. **Logs de erro no console**
   ```
   [RESEND ERROR] { statusCode: 401, message: 'Invalid API key' }
   ```
   - Solução: Verificar API key no .env.local

### Dashboard Resend Mostra Erro

**Status: Failed / Bounced**:
- Email não existe
- Caixa cheia
- Servidor de email do destinatário rejeitou

**Status: Pending**:
- Email está sendo processado
- Aguardar até 5 minutos

---

## 🔐 Segurança

### Variáveis de Ambiente em Produção

**Vercel**:
```bash
vercel env add RESEND_API_KEY
# Colar a chave re_XXXX
```

**Railway**:
1. Dashboard → Variables → New Variable
2. `RESEND_API_KEY` = `re_XXXX`

**Docker**:
```yaml
environment:
  - RESEND_API_KEY=re_XXXX
  - RESEND_FROM=lebebe.app@lebebe.cloud
```

### Boas Práticas

- ✅ Nunca expor `RESEND_API_KEY` no código
- ✅ Usar `.env.local` (nunca commitar)
- ✅ Em prod: usar secrets/variables do provider
- ✅ Rotacionar API key periodicamente
- ✅ Monitorar Dashboard Resend (limites, bounces)

---

## 📈 Limites do Resend

### Plano Free:
- **3.000 emails/mês**
- **100 emails/dia**
- 1 domínio verificado
- Suporte por email

### Plano Pro ($20/mês):
- **50.000 emails/mês**
- **Unlimited/dia**
- Domínios ilimitados
- Webhooks
- Suporte prioritário

**Monitorar**: Dashboard → Usage

---

## ✅ Checklist Final

Antes de considerar migração completa:

- [ ] Domínio `lebebe.cloud` verificado no Resend
- [ ] API Key gerada e configurada
- [ ] `.env.local` atualizado com todas variáveis
- [ ] Teste de convite: email chega via Resend
- [ ] Teste de reset: email chega via Resend
- [ ] Remetente correto: `lebebe.app@lebebe.cloud`
- [ ] Templates exibem logo e cores le bébé
- [ ] Duplo clique: apenas 1 email enviado
- [ ] Throttle: bloqueia reenvio < 60s
- [ ] Auditoria registra todas ações
- [ ] Logs estruturados no console
- [ ] Dashboard Resend mostra emails com status Delivered
- [ ] Link expirado: reenvio funciona
- [ ] Nenhum email enviado via Supabase SMTP

---

## 🔗 Links Úteis

- **Dashboard Resend**: https://resend.com/overview
- **Documentação**: https://resend.com/docs
- **Status Page**: https://status.resend.com/
- **Suporte**: support@resend.com

---

**Data**: 02/02/2026  
**Versão**: 1.0  
**Responsável**: Sistema le bébé  
**Status**: ✅ Implementado e Testado
