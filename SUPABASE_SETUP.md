# 🔐 Setup de Autenticação com Supabase

Este documento descreve o processo completo de configuração da autenticação e controle de acesso usando Supabase.

## 📋 Índice

1. [Configuração do Supabase](#configuração-do-supabase)
2. [Variáveis de Ambiente](#variáveis-de-ambiente)
3. [Instalação de Dependências](#instalação-de-dependências)
4. [Execução das Migrations](#execução-das-migrations)
5. [Configuração de Email](#configuração-de-email)
6. [Fluxo de Autenticação](#fluxo-de-autenticação)
7. [Estrutura do Projeto](#estrutura-do-projeto)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova conta ou faça login
3. Clique em "New Project"
4. Preencha:
   - **Project Name**: lebebe-app (ou nome de sua escolha)
   - **Database Password**: Crie uma senha forte (guarde-a!)
   - **Region**: South America (São Paulo)
5. Aguarde a criação do projeto (~2 minutos)

### 2. Obter Credenciais

Após a criação, vá em **Settings > API**:

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key (⚠️ **NUNCA** exponha no frontend)

---

## 🔑 Variáveis de Ambiente

### Desenvolvimento Local

Crie um arquivo `.env.local` na raiz do projeto:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# URL da aplicação (para reset de senha)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Produção (Vercel)

No painel da Vercel, vá em **Settings > Environment Variables** e adicione:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

⚠️ **IMPORTANTE**: Marque as variáveis para todos os ambientes (Production, Preview, Development)

---

## 📦 Instalação de Dependências

Execute no terminal:

```bash
npm install
```

Isso instalará:
- `@supabase/ssr` - Cliente Supabase otimizado para Next.js App Router
- `@supabase/supabase-js` - SDK JavaScript do Supabase

---

## 🗄️ Execução das Migrations

### Opção 1: Via Dashboard do Supabase (Recomendado)

1. Acesse seu projeto no Supabase
2. Vá em **SQL Editor**
3. Clique em "New Query"
4. Copie e cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
5. Clique em "Run" (ou pressione Ctrl+Enter)
6. Verifique que não houve erros

### Opção 2: Via Supabase CLI

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link com seu projeto
supabase link --project-ref seu-project-ref

# Executar migrations
supabase db push
```

### Verificação

Após executar as migrations, verifique no Supabase:

**Table Editor**:
- `usuarios_permitidos` - Deve ter 2 registros (lucas e robyson)
- `auditoria_acessos` - Deve estar vazia inicialmente

**Database > Policies**:
- Verifique que as políticas RLS estão ativas

---

## 📧 Configuração de Email

### Configurar SMTP (Produção)

Para ambientes de produção, configure um provedor SMTP:

1. Vá em **Settings > Auth**
2. Em **SMTP Settings**, configure:
   - **Sender email**: noreply@lebebe.com.br
   - **Sender name**: Le Bebê
   - **Host**: smtp.seu-provedor.com
   - **Port**: 587
   - **Username**: sua-conta-smtp
   - **Password**: sua-senha-smtp

**Provedores recomendados**:
- SendGrid
- AWS SES
- Mailgun
- Postmark

### Configurar Templates de Email

Em **Authentication > Email Templates**, customize:

- **Confirm signup**: Email de confirmação
- **Magic Link**: Login sem senha (se usar)
- **Change Email Address**: Confirmação de mudança de email
- **Reset Password**: **IMPORTANTE** - Link de recuperação de senha

Template sugerido para Reset Password:

```html
<h2>Redefinir senha - Le Bebê</h2>
<p>Olá,</p>
<p>Você solicitou a redefinição de senha. Clique no link abaixo:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir minha senha</a></p>
<p>Se você não solicitou isso, ignore este email.</p>
<p>Este link expira em 1 hora.</p>
```

### Configurar URL de Redirect

Em **Authentication > URL Configuration**:

- **Site URL**: `https://seu-dominio.vercel.app` (produção)
- **Redirect URLs**: Adicione:
  - `http://localhost:3000/resetar-senha` (desenvolvimento)
  - `https://seu-dominio.vercel.app/resetar-senha` (produção)

---

## 🔄 Fluxo de Autenticação

### 1. Login

**Rota**: `/login`

1. Usuário informa email + senha
2. Sistema valida credenciais no Supabase Auth
3. Verifica se email está em `usuarios_permitidos`
4. Verifica se `ativo = true`
5. Registra auditoria `LOGIN_SUCESSO` ou `LOGIN_FALHA`
6. Redireciona para `/dashboard`

**Possíveis erros**:
- ❌ Credenciais inválidas
- ❌ Usuário não permitido
- ❌ Usuário bloqueado

### 2. Recuperação de Senha

**Rota**: `/recuperar-senha`

1. Usuário informa email
2. Supabase envia email com link de reset
3. Registra auditoria `RESET_SOLICITADO`
4. Mensagem genérica (não revela se email existe)

### 3. Redefinir Senha

**Rota**: `/resetar-senha`

1. Usuário acessa via link do email
2. Informa nova senha + confirmação
3. Supabase atualiza senha
4. Registra auditoria `RESET_CONCLUIDO`
5. Redireciona para `/login`

### 4. Proteção de Rotas (Middleware)

O `middleware.ts` protege todas as rotas exceto:
- `/login`
- `/recuperar-senha`
- `/resetar-senha`

**Validações**:
1. Verifica sessão válida
2. Verifica se email está em `usuarios_permitidos`
3. Verifica se `ativo = true`
4. Para `/superadmin/*`, verifica `role = 'superadmin'`

Se qualquer validação falhar, redireciona para `/login`

### 5. Logout

Chamada para `/api/auth/logout`:
1. Registra auditoria `LOGOUT`
2. Encerra sessão do Supabase
3. Redireciona para `/login`

---

## 📁 Estrutura do Projeto

```
le-bebe/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Schema inicial + seed
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auditoria/
│   │   │   │   └── registrar/
│   │   │   │       └── route.ts      # Endpoint de auditoria
│   │   │   └── auth/
│   │   │       └── logout/
│   │   │           └── route.ts      # Endpoint de logout
│   │   ├── login/
│   │   │   └── page.tsx              # Página de login
│   │   ├── recuperar-senha/
│   │   │   └── page.tsx              # Página de recuperação
│   │   ├── resetar-senha/
│   │   │   └── page.tsx              # Página de reset
│   │   ├── superadmin/
│   │   │   └── page.tsx              # Área administrativa
│   │   └── dashboard/
│   │       └── page.tsx              # Dashboard principal
│   ├── lib/
│   │   ├── auth/
│   │   │   └── helpers.ts            # Funções auxiliares de auth
│   │   └── supabase/
│   │       ├── client.ts             # Cliente browser
│   │       ├── server.ts             # Cliente server
│   │       └── service.ts            # Cliente service role
│   └── types/
│       └── supabase.ts               # Tipos TypeScript
├── middleware.ts                     # Middleware de autenticação
├── .env.local                        # Variáveis de ambiente (local)
└── SUPABASE_SETUP.md                 # Este documento
```

---

## 🛡️ Superadmin

### Acesso

**Rota**: `/superadmin`

Disponível apenas para usuários com `role = 'superadmin'`

### Superadmins Iniciais

Os seguintes usuários são criados automaticamente:
- `lucas@lebebe.com.br`
- `robyson@lebebe.com.br`

**Proteções**:
- ❌ Não podem ser bloqueados
- ❌ Não podem ter a role alterada
- ❌ Não podem ser removidos
- ✅ Sistema sempre mantém pelo menos 1 superadmin ativo

### Funcionalidades

#### Tab: Usuários

**Listar usuários permitidos**:
- Email
- Role (user | superadmin)
- Status (ativo | bloqueado)
- Data de criação

**Ações**:
- ➕ Adicionar novo usuário
- 🔒 Bloquear usuário
- 🔓 Desbloquear usuário
- 🔄 Alterar role

#### Tab: Auditoria

**Visualizar logs**:
- Ação realizada
- Email do usuário
- IP de origem
- Data e hora
- Metadata (JSON)

**Filtros**:
- Por email
- Por ação
- Ordenação por data (mais recente primeiro)
- Limite de 100 registros por consulta

### Ações Auditadas

- `LOGIN_SUCESSO`
- `LOGIN_FALHA`
- `LOGOUT`
- `RESET_SOLICITADO`
- `RESET_CONCLUIDO`
- `USUARIO_PERMITIDO_CRIADO`
- `USUARIO_BLOQUEADO`
- `USUARIO_DESBLOQUEADO`
- `ROLE_ALTERADA`

---

## 🔧 Troubleshooting

### Erro: "Invalid login credentials"

**Causa**: Email/senha incorretos OU usuário não existe no Supabase Auth

**Solução**: 
1. Verifique se o usuário foi criado no Supabase Auth
2. Vá em **Authentication > Users** e crie o usuário manualmente
3. Certifique-se que o email está em `usuarios_permitidos`

### Erro: "Usuário não permitido"

**Causa**: Email não está na tabela `usuarios_permitidos`

**Solução**:
1. Faça login como superadmin
2. Vá em `/superadmin`
3. Adicione o email na lista de usuários permitidos

### Erro: "Usuário bloqueado"

**Causa**: O campo `ativo = false` na tabela `usuarios_permitidos`

**Solução**:
1. Faça login como superadmin
2. Vá em `/superadmin`
3. Desbloqueie o usuário

### Email de reset não chega

**Causas possíveis**:
1. Configuração SMTP incorreta
2. Email na pasta de spam
3. URL de redirect não configurada

**Soluções**:
1. Verifique as configurações SMTP
2. Em desenvolvimento, veja os logs do Supabase (Supabase Studio > Logs)
3. Configure os Redirect URLs corretamente

### Middleware redirecionando em loop

**Causa**: Configuração incorreta das rotas públicas

**Solução**:
1. Verifique o `middleware.ts`
2. Certifique-se que `/login` está nas `publicRoutes`
3. Limpe os cookies do navegador

### RLS bloqueando queries

**Causa**: Políticas RLS muito restritivas ou usuário sem permissão

**Solução**:
1. Verifique as policies no Supabase
2. Para auditoria, use sempre o service role (server-side)
3. Para `usuarios_permitidos`, certifique-se que o usuário é superadmin

---

## 🧪 Testando o Sistema

### 1. Teste de Login

```bash
# Criar usuário de teste via Supabase Dashboard
# Authentication > Users > Add user
Email: teste@lebebe.com.br
Password: senha123

# Adicionar à lista de permitidos (como superadmin)
1. Login como lucas@lebebe.com.br ou robyson@lebebe.com.br
2. Ir em /superadmin
3. Adicionar teste@lebebe.com.br
```

### 2. Teste de Bloqueio

```bash
1. Como superadmin, bloquear usuário
2. Tentar fazer login com o usuário bloqueado
3. Deve retornar "Usuário bloqueado"
```

### 3. Teste de Recuperação de Senha

```bash
1. Ir em /recuperar-senha
2. Informar email cadastrado
3. Verificar recebimento do email
4. Clicar no link e redefinir senha
5. Fazer login com a nova senha
```

### 4. Teste de Auditoria

```bash
1. Realizar várias ações (login, logout, etc)
2. Como superadmin, ir em /superadmin > Auditoria
3. Verificar que todos os logs estão registrados
4. Testar filtros por email e ação
```

---

## 📚 Referências

- [Documentação Supabase](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🆘 Suporte

Em caso de dúvidas ou problemas:

1. Verifique os logs do Supabase (Supabase Studio > Logs)
2. Verifique o console do navegador (F12)
3. Verifique os logs do servidor Next.js
4. Consulte este documento
5. Contate a equipe de desenvolvimento

---

**Última atualização**: 02/02/2026
