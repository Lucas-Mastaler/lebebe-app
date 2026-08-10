# Configuração Google OAuth - le bébé

## 1. Criar credenciais OAuth no Google Cloud Console

### 1.1. Acessar Google Cloud Console
1. Ir para: https://console.cloud.google.com/
2. Criar novo projeto ou selecionar existente
3. Nome sugerido: `le-bebe-auth`

### 1.2. Ativar Google+ API
1. Menu lateral → APIs & Services → Library
2. Buscar: "Google+ API"
3. Clicar em "Enable"

### 1.3. Criar credenciais OAuth 2.0
1. Menu lateral → APIs & Services → Credentials
2. Clicar em "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: `le bébé - Production`

### 1.4. Configurar URLs autorizadas

**Authorized JavaScript origins:**
```
https://lebebe.cloud
```

**Authorized redirect URIs:**
```
https://phsoawbdvhurroryfnok.supabase.co/auth/v1/callback
```

5. Clicar em "Create"
6. **COPIAR**: Client ID e Client Secret (vão usar no Supabase)

---

## 2. Configurar Google Provider no Supabase

### 2.1. Acessar Supabase Dashboard
1. Ir para: https://supabase.com/dashboard
2. Selecionar projeto: `phsoawbdvhurroryfnok`

### 2.2. Configurar Google OAuth
1. Menu lateral → Authentication → Providers
2. Encontrar **Google** na lista
3. Clicar em "Google" para expandir
4. Habilitar: **Enable Sign in with Google**

### 2.3. Inserir credenciais do Google
- **Client ID (for OAuth)**: colar o Client ID do passo 1.4
- **Client Secret (for OAuth)**: colar o Client Secret do passo 1.4

### 2.4. Configurar Redirect URL
- Confirm URL: `https://lebebe.cloud`
- Site URL: `https://lebebe.cloud`

5. Clicar em **Save**

---

## 3. Testar Login com Google

### 3.1. Aguardar deploy da Vercel
- Deploy automático após push do commit

### 3.2. Teste em produção
1. Abrir: `https://lebebe.cloud/login`
2. Clicar em "Entrar com Google"
3. Selecionar conta Google permitida (`lucas@lebebe.com.br` ou outro email em `usuarios_permitidos`)
4. Deve redirecionar para `/dashboard` ✅

### 3.3. Fluxo completo
```
Login → Clica "Entrar com Google" 
→ Popup do Google 
→ Seleciona conta 
→ Autoriza 
→ Callback valida se email está em usuarios_permitidos 
→ Se permitido e ativo: redireciona para /dashboard 
→ Se não permitido: redireciona para /login?error=not_allowed
```

---

## 4. Adicionar novos usuários ao Google OAuth

Para permitir que um email faça login via Google:

1. O email **deve estar** na tabela `usuarios_permitidos`
2. O campo `ativo` deve ser `true`
3. O campo `role` define as permissões (`user` ou `superadmin`)

**Não é mais necessário**:
- Enviar convite por email
- Usuário definir senha
- Lidar com links expirando

**O usuário simplesmente**:
- Vai no `/login`
- Clica "Entrar com Google"
- Seleciona a conta do Google que está permitida
- Pronto ✅

---

## 5. Vantagens desta solução

✅ **Sem problemas de scanner de email** consumindo links  
✅ **Sem links expirando**  
✅ **Login em 2 cliques**  
✅ **Não precisa criar/lembrar senha**  
✅ **Autenticação delegada ao Google** (muito mais segura)  
✅ **Auditoria mantida** (`LOGIN_SUCESSO` com `provider: 'google'`)  
✅ **Compatível com login por senha** (mantém ambos funcionando)

---

## 6. Rollback (se necessário)

Se precisar desabilitar Google OAuth temporariamente:

1. Supabase Dashboard → Authentication → Providers → Google
2. Desabilitar: "Enable Sign in with Google"
3. Save

O login por email/senha continua funcionando normalmente.

---

## 7. Troubleshooting

### Erro: "not_allowed"
- Email não está em `usuarios_permitidos` ou `ativo = false`
- Solução: adicionar email via `/superadmin`

### Erro: "auth_failed"
- Credenciais OAuth inválidas
- Solução: verificar Client ID/Secret no Supabase

### Redirect não funciona
- Verificar Authorized redirect URIs no Google Cloud Console
- Deve ser exatamente: `https://phsoawbdvhurroryfnok.supabase.co/auth/v1/callback`
