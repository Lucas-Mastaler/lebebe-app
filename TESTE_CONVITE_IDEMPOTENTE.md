# 🧪 Teste Manual - Sistema de Convite Idempotente

## 📋 Objetivo

Testar o sistema completo de criação/convite de usuários com proteção contra duplo clique, reenvio acidental e tratamento de links expirados.

---

## ✅ Implementações Realizadas

### 1. Migration SQL (003_add_invite_tracking.sql)
- ✅ Campos `last_invite_sent_at` e `invite_status` na tabela `usuarios_permitidos`
- ✅ Índices para otimizar consultas
- ✅ Função helper `can_resend_invite()` para throttle de 60s
- ✅ Atualização de registros existentes

### 2. Backend - Endpoint Idempotente
**`/api/superadmin/adicionar-usuario`**:
- ✅ Normalização de email (trim + lowercase)
- ✅ Validação de email
- ✅ Verificação de usuário existente
- ✅ Throttle de 60 segundos
- ✅ Reativação de usuário inativo
- ✅ Resposta padronizada (`ok`, `status`, `message`)
- ✅ Logs estruturados `[INVITE]`
- ✅ Tratamento de erros

**`/api/superadmin/reenviar-convite`**:
- ✅ Endpoint público (sem auth de superadmin, mas valida email)
- ✅ Throttle de 60 segundos
- ✅ Validação de status do convite
- ✅ Logs estruturados `[RESEND INVITE]`

### 3. Frontend - Modal Adicionar Usuário
- ✅ Guard contra duplo clique (`if (addingUser) return`)
- ✅ Estados: `addingUser`, `addUserError`, `addUserSuccess`
- ✅ Inputs desabilitados durante loading
- ✅ Spinner animado no botão
- ✅ Feedback visual (erro vermelho, sucesso verde)
- ✅ Auto-fechar modal após 2s de sucesso
- ✅ Botão desabilitado se email vazio

### 4. Página /definir-senha - Tratamento OTP Expired
- ✅ Detecção de `error_code=otp_expired` ou `access_denied` na URL
- ✅ Novo step `expired` com UI dedicada
- ✅ Input de email para reenvio
- ✅ Botão "Reenviar Convite" com loading
- ✅ Guard contra duplo clique (`if (resendLoading) return`)
- ✅ Throttle respeitado (mensagem de aguardar X segundos)

---

## 🧪 Checklist de Testes

### Teste 1: Duplo Clique no Modal ✅

**Objetivo**: Garantir que apenas 1 convite seja enviado mesmo com cliques múltiplos.

**Passos**:
1. Login como superadmin
2. Ir em `/superadmin` → Tab "Usuários"
3. Clicar em "Adicionar Usuário"
4. Preencher email: `teste-duplo@lebebe.com.br`
5. **Clicar rapidamente 3x no botão "Adicionar"**

**Resultado esperado**:
- ✅ Botão fica desabilitado após primeiro clique
- ✅ Spinner aparece ("Enviando...")
- ✅ Inputs ficam desabilitados (fundo cinza)
- ✅ Apenas 1 convite enviado (verificar logs do servidor: `[INVITE] Enviando convite para...`)
- ✅ Mensagem de sucesso aparece
- ✅ Modal fecha após 2 segundos

**Verificação no console do servidor**:
```
[INVITE] Enviando convite para teste-duplo@lebebe.com.br
[INVITE] Convite enviado com sucesso para teste-duplo@lebebe.com.br
```
Deve aparecer **apenas 1 vez**, não 3.

---

### Teste 2: Reenvio Antes de 60s (Throttle) ✅

**Objetivo**: Garantir que o sistema bloqueie reenvios rápidos.

**Passos**:
1. Adicionar usuário: `teste-throttle@lebebe.com.br`
2. Aguardar mensagem de sucesso
3. **Imediatamente** (em menos de 10s), tentar adicionar o mesmo email novamente

**Resultado esperado**:
- ✅ Mensagem de erro vermelha: *"Convite já enviado recentemente. Aguarde X segundos para reenviar."*
- ✅ HTTP Status 429 (Too Many Requests)
- ✅ Variável `X` deve ser entre 50-60 segundos

**Verificação no console do servidor**:
```
[INVITE] Enviando convite para teste-throttle@lebebe.com.br
(primeira tentativa - sucesso)

[INVITE] Enviando convite para teste-throttle@lebebe.com.br
(segunda tentativa - bloqueada pelo throttle antes mesmo de chamar Supabase)
```

---

### Teste 3: Reenvio Após 60s (Sucesso) ✅

**Objetivo**: Garantir que após 60s o reenvio funciona.

**Passos**:
1. Adicionar usuário: `teste-reenvio@lebebe.com.br`
2. **Aguardar 65 segundos**
3. Tentar adicionar o mesmo email novamente

**Resultado esperado**:
- ✅ Mensagem de sucesso: *"Convite reenviado para teste-reenvio@lebebe.com.br"*
- ✅ Status: `reactivated_and_sent`
- ✅ Novo email de convite enviado
- ✅ Campo `last_invite_sent_at` atualizado no banco

**Verificação no Supabase (Table Editor)**:
```sql
SELECT email, last_invite_sent_at, invite_status 
FROM usuarios_permitidos 
WHERE email = 'teste-reenvio@lebebe.com.br';
```
O timestamp `last_invite_sent_at` deve ter sido atualizado.

---

### Teste 4: Link Expirado - Detecção ✅

**Objetivo**: Garantir que a página detecta link expirado.

**Passos**:
1. Simular URL com erro:
   ```
   http://localhost:3000/definir-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired
   ```
2. Abrir essa URL no navegador

**Resultado esperado**:
- ✅ Aparece tela com ícone de alerta (âmbar/amarelo)
- ✅ Título: "Link Expirado"
- ✅ Mensagem: "Este link de convite expirou ou já foi usado..."
- ✅ Input de email visível
- ✅ Botão "Reenviar Convite" visível
- ✅ Link "Voltar para Login"

---

### Teste 5: Reenvio de Convite (Botão na Página) ✅

**Objetivo**: Testar o fluxo de reenvio quando o usuário encontra link expirado.

**Passos**:
1. Abrir URL do Teste 4
2. Preencher email: `teste-expirado@lebebe.com.br`
3. Clicar em "Reenviar Convite"
4. Aguardar resposta

**Resultado esperado**:
- ✅ Botão muda para "Reenviando..." com spinner
- ✅ Input fica desabilitado
- ✅ Mensagem de sucesso (se usuário existe e passou throttle)
- ✅ OU mensagem de erro (se throttle ativo): *"Aguarde X segundos para reenviar"*
- ✅ Novo email enviado (se sucesso)

**Verificação no console do servidor**:
```
[RESEND INVITE] Reenviando convite para teste-expirado@lebebe.com.br
[RESEND INVITE] Convite reenviado com sucesso para teste-expirado@lebebe.com.br
```

---

### Teste 6: Reenvio Múltiplo em < 60s (Throttle no Reenvio) ✅

**Objetivo**: Garantir que o botão "Reenviar Convite" também respeita throttle.

**Passos**:
1. Abrir tela de link expirado
2. Preencher email: `teste-reenvio2@lebebe.com.br`
3. Clicar "Reenviar Convite"
4. **Imediatamente** (< 10s), clicar novamente

**Resultado esperado**:
- ✅ Primeiro clique: sucesso
- ✅ Segundo clique: mensagem de erro vermelha *"Aguarde X segundos para reenviar o convite."*
- ✅ HTTP Status 429

---

### Teste 7: Fluxo Completo - Convite Novo Usuário ✅

**Objetivo**: Testar o fluxo end-to-end sem erros.

**Passos**:
1. Adicionar usuário: `usuario-novo@lebebe.com.br`
2. Verificar email (pode demorar até 5 min em dev)
3. Clicar no link do email
4. Deve abrir `/definir-senha` com tela inicial
5. Clicar em "Continuar e Definir Senha"
6. Aguardar validação
7. Preencher senha (6+ caracteres)
8. Confirmar senha
9. Clicar em "Definir Senha e Acessar"

**Resultado esperado**:
- ✅ Email recebido
- ✅ Link abre sem erro `otp_expired`
- ✅ Tela inicial mostra botão "Continuar"
- ✅ Após clicar: formulário de senha aparece
- ✅ Validações funcionam (< 6 chars, senhas diferentes)
- ✅ Sucesso: tela "Senha Definida!"
- ✅ Redirect para `/dashboard` após 2s
- ✅ Login automático (não pede senha novamente)

**Verificação no banco**:
```sql
SELECT email, invite_status 
FROM usuarios_permitidos 
WHERE email = 'usuario-novo@lebebe.com.br';
```
Campo `invite_status` deve ser `'accepted'` (atualizar manualmente após definir senha se a migration não fizer isso automaticamente).

---

### Teste 8: Email Inválido (Validação) ✅

**Objetivo**: Garantir que emails inválidos são rejeitados.

**Passos**:
1. Tentar adicionar usuário com email: `emailinvalido`
2. Clicar "Adicionar"

**Resultado esperado**:
- ✅ Mensagem de erro: *"Email inválido"*
- ✅ HTTP Status 400
- ✅ Nenhum convite enviado

---

### Teste 9: Usuário Já Ativo (Idempotência) ✅

**Objetivo**: Garantir que não permite adicionar usuário já ativo.

**Passos**:
1. Adicionar usuário: `teste-ativo@lebebe.com.br`
2. Definir senha (completar fluxo)
3. Como superadmin, tentar adicionar o mesmo email novamente

**Resultado esperado**:
- ✅ Mensagem de erro: *"Usuário já está cadastrado e ativo no sistema"*
- ✅ HTTP Status 400
- ✅ Nenhum convite duplicado enviado

---

### Teste 10: Logs de Auditoria ✅

**Objetivo**: Verificar que todas as ações são auditadas.

**Passos**:
1. Realizar Testes 1-9
2. Ir em `/superadmin` → Tab "Auditoria"
3. Verificar logs

**Resultado esperado**:
- ✅ Ação `USUARIO_PERMITIDO_CRIADO` para cada convite
- ✅ Metadata inclui `novo_usuario` e `role`
- ✅ Para reenvios: metadata inclui `action: 'reactivated_and_sent'` ou `'resend_invite'`
- ✅ Ação `SENHA_DEFINIDA` quando usuário define senha

---

## 🐛 Cenários de Erro Conhecidos

### 1. Scanner de Email Consome Link
**Problema**: Alguns clientes de email (Gmail, Outlook) fazem preview de links, consumindo o OTP.

**Solução implementada**:
- Botão "Continuar" antes do exchange
- Scanner faz GET mas não clica
- Link permanece válido até clique manual

**Como testar**:
- Se o link abrir com `otp_expired` imediatamente ao clicar no email
- Isso indica que foi consumido pelo scanner
- Usuário deve usar botão "Reenviar Convite"

### 2. Throttle Muito Agressivo
**Problema**: 60s pode ser curto em alguns cenários.

**Ajuste**:
- Modificar no código: trocar `60` por `120` (2 minutos)
- Ou criar variável de ambiente `INVITE_THROTTLE_SECONDS`

### 3. Email Não Chega
**Problema**: SMTP não configurado ou delay no Supabase.

**Verificação**:
1. Supabase Dashboard → Logs → Auth Logs
2. Procurar por `inviteUserByEmail`
3. Se aparecer erro: configurar SMTP
4. Se não aparecer: verificar se `SUPABASE_SERVICE_ROLE_KEY` está correta

---

## 📊 Métricas de Sucesso

Após executar todos os testes, verificar:

- [ ] **0 convites duplicados** (mesmo com duplo clique)
- [ ] **Throttle de 60s respeitado** em 100% dos casos
- [ ] **Link expirado detectado** corretamente
- [ ] **Botão "Reenviar Convite" funciona** com throttle
- [ ] **Logs estruturados** aparecem no console
- [ ] **Auditoria completa** registrada
- [ ] **Validações de email** funcionam
- [ ] **Feedback visual** (loading, erro, sucesso) sempre presente
- [ ] **Inputs desabilitados** durante requisições

---

## 🔧 Troubleshooting

### Build Error: `invite_status column does not exist`
**Causa**: Migration não foi executada.

**Solução**:
```bash
# Via Supabase Dashboard
1. Ir em SQL Editor
2. Copiar conteúdo de supabase/migrations/003_add_invite_tracking.sql
3. Executar (Run)
4. Verificar: SELECT * FROM usuarios_permitidos LIMIT 1;
```

### Throttle Não Funciona
**Causa**: Timestamps não sendo salvos corretamente.

**Verificação**:
```sql
SELECT email, last_invite_sent_at 
FROM usuarios_permitidos 
ORDER BY last_invite_sent_at DESC NULLS LAST 
LIMIT 10;
```

Se `last_invite_sent_at` for NULL após envio, há problema no INSERT/UPDATE.

### Botão "Reenviar" Não Aparece
**Causa**: URL não tem `error_code=otp_expired`.

**Verificação**:
- Abrir DevTools (F12) → Console
- Verificar `window.location.hash`
- Deve conter `#error=...&error_code=otp_expired`

---

## 📝 Documentação para Usuários Finais

### Para Superadmins:

**Adicionar Novo Usuário**:
1. Ir em `/superadmin` → Usuários
2. Clicar "Adicionar Usuário"
3. Preencher email e selecionar role
4. Clicar "Adicionar" (aguardar confirmação)
5. Usuário receberá email em até 5 minutos

**Reenviar Convite**:
- Se o usuário não recebeu ou link expirou
- Aguarde **60 segundos** após último envio
- Clique "Adicionar Usuário" novamente com mesmo email
- Sistema reenviará automaticamente

### Para Novos Usuários:

**Definir Senha Após Convite**:
1. Abrir email "Convite - le bébé"
2. Clicar no link
3. Clicar em "Continuar e Definir Senha"
4. Criar senha com mínimo 6 caracteres
5. Confirmar senha
6. Acesso liberado automaticamente

**Se Link Expirou**:
1. Na tela de erro, preencher seu email
2. Clicar "Reenviar Convite"
3. Aguardar novo email
4. Repetir processo

---

**Data do documento**: 02/02/2026  
**Versão**: 1.0  
**Autor**: Sistema le bébé
