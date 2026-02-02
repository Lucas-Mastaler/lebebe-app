# Histórico detalhado — Convites/Reset via Supabase + Resend (le bébé)

## 1) Objetivo (definido no início)

Implementar um fluxo **robusto e idempotente** de convite de usuários com Supabase, evitando:
- duplo clique no front enviando múltiplos convites
- reenvio acidental (throttle)
- links expirando por reenvio ou consumo acidental

E depois **migrar o envio de e-mail** (convite e reset) para **Resend**, deixando o Supabase **somente** como gerador de links seguros.

---

## 2) Linha do tempo das mudanças (cronológica)

### 2.1. Ajustes de base do projeto (Next.js)
- Migração das páginas de auth para route group `(auth)`.
- Correções de build relacionadas ao `useSearchParams` fora de `Suspense`.

Arquivos envolvidos:
- `src/app/(auth)/...`
- `src/app/(auth)/definir-senha/page.tsx`

---

### 2.2. Controle de status do convite no banco (idempotência / throttle)
Foi criada uma migration para rastrear envio do convite:

- **Migration**: `supabase/migrations/003_add_invite_tracking.sql`
- Campos:
  - `last_invite_sent_at` (TIMESTAMPTZ)
  - `invite_status` (sent/accepted/expired/failed)
- Índices para performance

Objetivo:
- Aplicar throttle de 60s (não reenviar se foi enviado recentemente)
- Ter rastreio do estado

---

### 2.3. Endpoints de convite (backend Next.js)
Foram criados/refatorados endpoints:

- `POST /api/superadmin/adicionar-usuario`
  - normaliza email
  - valida input
  - idempotência + throttle (60s)
  - envia convite
  - atualiza `usuarios_permitidos`

- `POST /api/superadmin/reenviar-convite`
  - reenvio com throttle

---

### 2.4. Frontend: modal Adicionar Usuário (proteção duplo clique)
- Guard: impede múltiplos submits simultâneos
- Botão/input desabilitados durante loading
- Feedback: sucesso/erro

Arquivo:
- `src/app/superadmin/page.tsx`

---

## 3) Migração do envio de email para Resend

### 3.1. Dependência
- Instalado: `resend`

### 3.2. Helper do Resend + templates HTML
- Criado: `src/lib/email/resend.ts`
  - `enviarEmail({ to, subject, html })`
  - templates:
    - `gerarHtmlConvite({ confirmUrl, email })`
    - `gerarHtmlResetSenha({ confirmUrl, email })`

Logo no template:
- `https://phsoawbdvhurroryfnok.supabase.co/storage/v1/object/public/logo/logo.png`

### 3.3. Auditoria (ações novas)
- Atualizado: `src/types/supabase.ts`
- Novas ações:
  - `INVITE_EMAIL_SENT`
  - `INVITE_EMAIL_FAILED`
  - `RESET_EMAIL_SENT`
  - `RESET_EMAIL_FAILED`

### 3.4. Endpoint de recuperação de senha server-side
- Criado: `src/app/api/auth/recuperar-senha/route.ts`
  - gera link com `supabaseAdmin.auth.admin.generateLink({ type: 'recovery' })`
  - envia email via Resend

- Alterado frontend:
  - `src/app/(auth)/recuperar-senha/page.tsx` passou a chamar `/api/auth/recuperar-senha`

### 3.5. Problema na Vercel: RESEND_API_KEY ausente
Sintoma:
- Build falhou na Vercel com:
  - `Missing API key. Pass it to the constructor new Resend("re_123")`

Causa:
- Variáveis de ambiente não configuradas na Vercel.

Ação:
- Configurar env vars na Vercel (RESEND_API_KEY, etc.).

---

## 4) Problemas encontrados ao tentar fazer o link funcionar

### 4.1. URLs com barra dupla `//`
Sintoma:
- Links no email contendo `https://lebebe.cloud//definir-senha`

Causa:
- `NEXT_PUBLIC_APP_URL` com `/` no final + concatenação com `/${path}`.

Correção:
- normalização usando `.replace(/\/$/, '')`.

---

### 4.2. Supabase ainda enviando email (duplicado)
Sintoma:
- chegavam **2 emails**:
  - 1 do Resend
  - 1 do Supabase (supabaseoauth)

Causa:
- uso de `inviteUserByEmail()` envia email automaticamente pelo Supabase.

Correção aplicada:
- substituir `inviteUserByEmail()` por `generateLink({ type: 'invite' })`.
  - O Supabase passa a **somente gerar o link**, sem enviar email.

---

### 4.3. Link não funcionava: tela “Link inválido ou expirado”

#### Caso A: link com `#access_token=...`
Sintoma:
- link chegava com hash `#access_token=...` e a página esperava `token_hash` / `type` via `searchParams`.

Correção:
- `src/app/(auth)/definir-senha/page.tsx` passou a detectar `window.location.hash` contendo `access_token` e abrir diretamente o formulário quando existe sessão.

#### Caso B: link redirecionando para `otp_expired`
Sintoma:
- clicar no link do email e cair em:
  - `error=access_denied&error_code=otp_expired`

Hipótese levantada:
- scanners de email (Gmail/Outlook) acessando o link antes do usuário e consumindo o OTP.

---

## 5) Solução tentativa: Token intermediário (anti-scanner)

Para evitar consumo por scanner, foi criado um fluxo novo:

1) Email não contém mais link Supabase diretamente.
2) Email contém link para o próprio backend:
   - `/api/auth/convite/[token]`
3) Ao acessar este endpoint:
   - valida token
   - (apenas então) gera link Supabase com `generateLink(type='invite')`
   - redireciona para o link Supabase

### 5.1. Migration do token intermediário
- Criada: `supabase/migrations/004_add_invite_token.sql`
- Adiciona:
  - `invite_token TEXT UNIQUE`
  - `invite_token_expires_at TIMESTAMPTZ`

### 5.2. Gerador de token
- Criado: `src/lib/crypto/tokens.ts`
  - `gerarTokenConvite()`

### 5.3. Endpoint público do token
- Criado: `src/app/api/auth/convite/[token]/route.ts`

### 5.4. Ajustes nos endpoints de convite
- `POST /api/superadmin/adicionar-usuario` e `POST /api/superadmin/reenviar-convite`
  - passaram a gerar e salvar `invite_token` e mandar email com:
    - `${APP_URL}/api/auth/convite/${inviteToken}`

---

## 6) Problemas técnicos após token intermediário

### 6.1. Erro de build (Next.js): params agora é Promise
Sintoma:
- erro de TypeScript no build:
  - `context.params: Promise<{ token: string }>`

Correção:
- endpoint `/api/auth/convite/[token]` foi ajustado para:
  - `{ params }: { params: Promise<{ token: string }> }`
  - `const { token } = await params`

---

### 6.2. `invalid_token` ao abrir `/api/auth/convite/<token>`
Sintoma:
- `/api/auth/convite/<token>` redirecionava para:
  - `/definir-senha?error=invalid_token`

Causa provável:
- RLS bloqueando o `select` em `usuarios_permitidos` quando usando cliente anônimo.

Correção aplicada:
- endpoint `/api/auth/convite/[token]` passou a buscar o registro usando **service role** (`createServiceClient()`), ignorando RLS.

---

## 7) Estado atual (no momento deste documento)

### 7.1. Sintoma atual reportado
1) Na tela de superadmin ao criar convite:
- Retorna:
  - `{ ok: false, message: "Erro ao criar registro de permissão" }`

2) Mesmo assim, o usuário ainda recebeu um email e o link ainda deu erro.

### 7.2. Hipóteses mais prováveis para o erro “Erro ao criar registro de permissão”
Esse erro vem do backend quando o `insert` em `usuarios_permitidos` falha.
Possíveis causas:
- **Migration 004 não aplicada no banco correto** (prod vs dev), e a API está tentando inserir colunas `invite_token` / `invite_token_expires_at` que não existem.
- RLS/Policy impedindo insert/update (menos provável, porque esses endpoints normalmente usam service role para DB; mas precisamos conferir qual client está sendo usado no insert).
- Conflito de constraint (ex: `invite_token` UNIQUE e gerou duplicado — improvável, mas possível).
- Conflito de constraint já existente (ex: unique no email), e lógica tentou inserir quando deveria atualizar.

### 7.3. Por que pode estar chegando email mesmo com erro
Porque atualmente o fluxo pode estar:
- enviando o email via Resend
- depois falhando no insert/update do `usuarios_permitidos`

Ou o inverso dependendo da ordem do código.

---

## 8) Checklist do que já foi tentado

- [x] Idempotência + throttle no backend
- [x] Guard contra duplo clique no frontend
- [x] Migration 003 (invite tracking)
- [x] Migração do envio de email para Resend
- [x] Troca `inviteUserByEmail` -> `generateLink` para evitar email do Supabase
- [x] Correção de `//` no redirect URL
- [x] Ajuste de `/definir-senha` para ler `#access_token`
- [x] Implementação de token intermediário anti-scanner
- [x] Correção de types do Next (params como Promise)
- [x] Correção do endpoint público para usar service role na busca do token (RLS)

---

## 9) Próximos passos recomendados (para finalmente estabilizar)

### Passo 1 — Capturar o erro real do insert
No backend `POST /api/superadmin/adicionar-usuario`, precisamos:
- logar `insertError` completo
- retornar um `error_code` seguro para a UI

Exemplos de causas (que o log vai mostrar):
- `column "invite_token" does not exist`
- `duplicate key value violates unique constraint`
- `new row violates row-level security policy`

### Passo 2 — Confirmar migrations no Supabase do ambiente PROD
Garantir que no projeto Supabase apontado pela Vercel:
- migration 003 foi aplicada
- migration 004 foi aplicada

### Passo 3 — Ordenar operações no endpoint
Recomendação:
1) garantir que o registro em `usuarios_permitidos` foi criado/atualizado com token
2) só depois enviar email

Assim não acontece “envia email mas falha ao salvar estado”.

### Passo 4 — Melhorar UX de erro em /definir-senha
Atualmente `/definir-senha` reage bem a `otp_expired` via hash, mas:
- quando cair em `?error=invalid_token` ou `?error=token_expired`, devemos mostrar a UI de reenvio com email pré-preenchido.

---

## 10) Referências rápidas (arquivos)

- Resend helper/templates:
  - `src/lib/email/resend.ts`

- Convite token intermediário:
  - `src/lib/crypto/tokens.ts`
  - `src/app/api/auth/convite/[token]/route.ts`

- Endpoints:
  - `src/app/api/superadmin/adicionar-usuario/route.ts`
  - `src/app/api/superadmin/reenviar-convite/route.ts`
  - `src/app/api/auth/recuperar-senha/route.ts`

- Página definir senha:
  - `src/app/(auth)/definir-senha/page.tsx`

- Migrations:
  - `supabase/migrations/003_add_invite_tracking.sql`
  - `supabase/migrations/004_add_invite_token.sql`

---

## 11) Anexos (observações importantes)

- Scanners de email podem consumir links do Supabase.
- `generateLink(type='invite')` cria link que redireciona para `/auth/v1/verify?...`.
- Rotas públicas que consultam tabelas protegidas por RLS devem usar service role (ou policy específica).

