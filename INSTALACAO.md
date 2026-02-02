# 🚀 Guia Rápido de Instalação

## Passo 1: Instalar Dependências

```bash
npm install
```

Isso instalará as dependências do Supabase que foram adicionadas ao `package.json`.

## Passo 2: Configurar Supabase

### 2.1. Criar Projeto

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Anote a **URL** e as **Keys** (Settings > API)

### 2.2. Executar Migration

1. No dashboard do Supabase, vá em **SQL Editor**
2. Abra o arquivo `supabase/migrations/001_initial_schema.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor e execute (Run)
5. Verifique que as tabelas foram criadas com sucesso

## Passo 3: Configurar Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Passo 4: Configurar Email no Supabase

1. Vá em **Settings > Auth**
2. Configure SMTP (ou use o email padrão do Supabase para testes)
3. Em **URL Configuration**, adicione:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/resetar-senha`

## Passo 5: Criar Usuários de Teste

### Via Supabase Dashboard

1. Vá em **Authentication > Users**
2. Clique em "Add user"
3. Crie os superadmins:
   - `lucas@lebebe.com.br` com senha
   - `robyson@lebebe.com.br` com senha

⚠️ **IMPORTANTE**: Os emails já estão na tabela `usuarios_permitidos` (via migration), mas você precisa criar as contas no Supabase Auth manualmente.

## Passo 6: Executar o Projeto

```bash
npm run dev
```

Acesse: `http://localhost:3000/login`

## Passo 7: Primeiro Login

1. Faça login com `lucas@lebebe.com.br` ou `robyson@lebebe.com.br`
2. Acesse `/superadmin` para gerenciar outros usuários
3. Teste a auditoria para verificar que os logs estão sendo gravados

---

## 📋 Checklist de Verificação

- [ ] Dependências instaladas (`npm install`)
- [ ] Projeto criado no Supabase
- [ ] Migration executada com sucesso
- [ ] Variáveis de ambiente configuradas
- [ ] Email configurado no Supabase
- [ ] Usuários superadmin criados no Auth
- [ ] Consegue fazer login
- [ ] Middleware protege rotas corretamente
- [ ] Área superadmin acessível
- [ ] Auditoria registrando ações
- [ ] Recuperação de senha funcionando

---

## 🔧 Deploy na Vercel

### 1. Configurar Variáveis de Ambiente

No painel da Vercel (Settings > Environment Variables):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

### 2. Atualizar Supabase

No Supabase (**Settings > Auth > URL Configuration**):

- Site URL: `https://seu-dominio.vercel.app`
- Redirect URLs: `https://seu-dominio.vercel.app/resetar-senha`

### 3. Deploy

```bash
git add .
git commit -m "Add Supabase authentication"
git push
```

O deploy acontecerá automaticamente na Vercel.

---

## 📚 Documentação Completa

Para detalhes sobre arquitetura, fluxos e troubleshooting, consulte:
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Documentação completa

---

## 🆘 Problemas Comuns

### Erro ao fazer login
- Verifique se o usuário existe no Supabase Auth
- Verifique se o email está em `usuarios_permitidos` e `ativo = true`

### Email não chega
- Em desenvolvimento, use logs do Supabase
- Em produção, configure SMTP corretamente

### Lint errors sobre @supabase
- Execute `npm install` primeiro
- Os erros desaparecerão após a instalação

---

**Data**: 02/02/2026
