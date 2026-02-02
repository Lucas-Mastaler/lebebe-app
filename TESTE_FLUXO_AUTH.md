# 🧪 Teste Manual - Fluxo de Autenticação

## ✅ Implementações Realizadas

### 1. Telas de Auth Sem Sidebar/Header
- ✅ Criado grupo de rotas `(auth)` com layout isolado
- ✅ Todas as páginas de auth movidas para `src/app/(auth)/`:
  - `/login`
  - `/recuperar-senha`
  - `/resetar-senha`
  - `/definir-senha`
- ✅ Layout centralizado com fundo claro, sem sidebar/topbar

### 2. Correção "Link Expirado" no Invite
- ✅ Página `/definir-senha` mostra botão "Continuar e Definir Senha"
- ✅ Exchange do token (`verifyOtp`) só ocorre **no clique do botão**
- ✅ Evita que scanners de email "gastem" o link (fazem GET mas não clicam)
- ✅ Verificado: não existe `/auth/callback` fazendo exchange duplicado
- ✅ Mensagens de erro amigáveis para link inválido/expirado

### 3. Validações e UX
- ✅ Campo "Senha":
  - Mínimo 6 caracteres (bloqueado via `minLength={6}` e validação JS)
  - Ícone olho para mostrar/ocultar (toggle password/text)
  - Mensagem "Senha deve ter no mínimo 6 caracteres" se < 6
- ✅ Campo "Confirmar Senha":
  - Ícone olho para mostrar/ocultar
  - Validação de igualdade com senha principal
  - Mensagem "As senhas não coincidem" se diferentes
- ✅ Botão submit desabilitado se:
  - Senha < 6 caracteres
  - Senhas não coincidem
  - Carregando

---

## 📋 Teste Manual Completo

### Pré-requisitos
1. Projeto rodando: `npm run dev`
2. Supabase configurado com Redirect URLs:
   - `http://localhost:3000/definir-senha`
   - `http://lebebe.cloud/definir-senha`
3. Usuário superadmin logado

---

### Teste 1: Enviar Convite

**Passo a passo:**
1. Fazer login como superadmin
2. Ir em `/superadmin` → Tab "Usuários"
3. Clicar em "Adicionar Usuário"
4. Preencher:
   - Email: `teste@lebebe.com.br`
   - Role: `user`
5. Clicar em "Adicionar"

**Resultado esperado:**
- ✅ Mensagem: "Convite enviado com sucesso! O usuário receberá um email..."
- ✅ Email recebido (verificar caixa de spam em dev)
- ✅ Usuário aparece na lista com status "Ativo"

---

### Teste 2: Abrir Link do Convite

**Passo a passo:**
1. Abrir o email recebido
2. Clicar no link do convite
3. **IMPORTANTE**: Abrir em janela anônima do navegador

**Resultado esperado:**
- ✅ Página `/definir-senha` carrega sem sidebar/header
- ✅ Aparece card centralizado com:
  - Título "Bem-vindo ao le bébé"
  - Texto explicativo sobre o convite
  - Botão "Continuar e Definir Senha"
  - Aviso: "Este link é de uso único..."
- ✅ **NÃO deve aparecer erro "Link expirado" neste momento**

---

### Teste 3: Validar Convite e Definir Senha

**Passo a passo:**
1. Clicar no botão "Continuar e Definir Senha"
2. Aguardar validação (spinner aparece)
3. Após validação, tentar definir senha:
   - Digitar senha com 3 caracteres
   - Observar mensagem de erro
   - Digitar senha com 6+ caracteres
   - Confirmar com senha diferente
   - Observar mensagem de erro
   - Confirmar com senha igual
4. Clicar no ícone "olho" em ambos os campos
5. Clicar em "Definir Senha e Acessar"

**Resultado esperado:**
- ✅ Após clicar "Continuar":
  - Spinner de "Validando..." aparece
  - Formulário de senha aparece
- ✅ Validações funcionando:
  - "Senha deve ter no mínimo 6 caracteres" aparece se < 6
  - "As senhas não coincidem" aparece se diferentes
  - Botão desabilitado enquanto validações não passam
- ✅ Ícone olho:
  - Alterna entre mostrar/ocultar senha
  - Funciona em ambos os campos
- ✅ Após definir senha:
  - Tela de sucesso: "Senha Definida!"
  - Redirecionamento para `/dashboard` em ~2s
  - Login automático (não pede senha novamente)

---

### Teste 4: Tentar Usar o Mesmo Link Novamente

**Passo a passo:**
1. Copiar o link do email original
2. Abrir em nova aba anônima
3. Clicar em "Continuar e Definir Senha"

**Resultado esperado:**
- ✅ Ao clicar "Continuar":
  - Aparece tela de erro: "Link Inválido"
  - Mensagem: "Link inválido ou expirado. Este link pode já ter sido usado..."
  - Botão "Ir para Login"
- ✅ **Comportamento correto**: Link é one-time, não pode ser reutilizado

---

### Teste 5: Reset de Senha (Verificar que Funciona)

**Passo a passo:**
1. Ir em `/login`
2. Clicar em "Esqueci minha senha"
3. Informar email cadastrado
4. Verificar email
5. Clicar no link de reset
6. Deve abrir `/resetar-senha` (sem sidebar)
7. Definir nova senha com validações
8. Fazer login com a nova senha

**Resultado esperado:**
- ✅ Página `/resetar-senha` sem sidebar
- ✅ Validações de senha funcionando (igual `/definir-senha`)
- ✅ Toggle olho nos campos de senha
- ✅ Após redefinir: redirect para `/login`
- ✅ Login com nova senha funciona

---

### Teste 6: Login Normal

**Passo a passo:**
1. Ir em `/login` (sem sidebar)
2. Fazer login com usuário criado no Teste 1
3. Verificar que entra no sistema
4. Verificar que sidebar/topbar aparecem no dashboard

**Resultado esperado:**
- ✅ Página `/login` sem sidebar/topbar
- ✅ Após login: redirect para `/dashboard`
- ✅ Dashboard tem sidebar e topbar normalmente

---

## 🐛 Troubleshooting

### "Link expirado" aparece imediatamente ao abrir

**Causa**: Scanner de email ou preview consumiu o link antes de você.

**Solução aplicada**: 
- Agora o exchange só ocorre no clique do botão
- Scanner faz GET mas não clica no botão
- Link fica válido até o usuário clicar

### Sidebar aparece na tela de definir senha

**Causa**: Rota não está no grupo `(auth)` ou `LayoutWrapper` não reconhece como pública.

**Verificar**:
- Arquivo está em `src/app/(auth)/definir-senha/page.tsx`?
- `LayoutWrapper.tsx` tem `/definir-senha` nas `publicRoutes`?

### Email não chega

**Em desenvolvimento**:
- Verificar logs do Supabase
- Verificar spam
- Email pode demorar até 5 min

**Em produção**:
- Verificar configuração SMTP no Supabase
- Verificar Redirect URLs configuradas

---

## 📊 Checklist Final

Antes de considerar concluído, verificar:

- [ ] `/login` abre sem sidebar
- [ ] `/recuperar-senha` abre sem sidebar
- [ ] `/resetar-senha` abre sem sidebar
- [ ] `/definir-senha` abre sem sidebar
- [ ] Invite envia email
- [ ] Link do invite abre com botão "Continuar" (não erro)
- [ ] Clicar "Continuar" valida o link
- [ ] Validação senha mínima 6 chars funciona
- [ ] Validação senhas iguais funciona
- [ ] Toggle olho funciona em ambos campos
- [ ] Definir senha redireciona para dashboard
- [ ] Usar mesmo link 2x mostra erro "já usado"
- [ ] Dashboard tem sidebar/topbar normalmente

---

## 📝 Notas Técnicas

### Estrutura de Arquivos
```
src/app/
├── (auth)/                    # Grupo de rotas sem layout principal
│   ├── layout.tsx            # Layout simples (centralizado, fundo claro)
│   ├── login/page.tsx
│   ├── recuperar-senha/page.tsx
│   ├── resetar-senha/page.tsx
│   └── definir-senha/page.tsx
├── dashboard/
├── superadmin/
└── layout.tsx                # Layout principal (com sidebar/topbar)
```

### Fluxo de Exchange do Token

**Antes (❌ problema):**
```
1. Usuário abre link
2. useEffect() executa imediatamente
3. Exchange do token acontece no load
4. Scanner de email já consumiu → "Link expirado"
```

**Depois (✅ correção):**
```
1. Usuário abre link
2. Mostra tela inicial com botão
3. Usuário clica "Continuar"
4. Exchange acontece no clique
5. Scanner não clica → link permanece válido
```

### Redirect URLs no Supabase

Configurar em **Authentication → URL Configuration**:
- `http://localhost:3000/definir-senha`
- `http://lebebe.cloud/definir-senha`
- `http://localhost:3000/resetar-senha`
- `http://lebebe.cloud/resetar-senha`

**⚠️ IMPORTANTE**: Sem essas URLs, os links dos emails não funcionarão!

---

**Data do documento**: 02/02/2026  
**Versão**: 1.0
