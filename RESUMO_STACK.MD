Vou analisar a stack tecnológica do seu projeto. Primeiro, preciso explorar a estrutura do diretório e os arquivos de configuração.







# Resumo Técnico da Stack do Projeto Le-Bébé

## **Framework & Core**
- **Next.js 16.1.4** - Framework React com App Router
- **React 19.2.3** - Biblioteca UI principal
- **TypeScript 5** - Tipagem estática

## **UI & Styling**
- **TailwindCSS 4** - Framework CSS com PostCSS
- **shadcn/ui** - Sistema de componentes (Radix UI + New York style)
- **Lucide React** - Biblioteca de ícones
- **class-variance-authority** + **clsx** + **tailwind-merge** - Utilitários CSS

## **Backend & Database**
- **Supabase** - Banco de dados PostgreSQL + Auth + Storage
  - @supabase/ssr e @supabase/supabase-js
- **API Routes** - Endpoints REST no Next.js

## **Integrações Externas**
- **Google APIs** - Google Auth Library + Google Apps Script
- **Digisac** - Plataforma de comunicação (WhatsApp)
- **Resend** - Serviço de email transacional
- **Upstash Redis** - Rate limiting e cache

## **Analytics & Monitoring**
- **Vercel Analytics** - Métricas de uso
- **Vercel Speed Insights** - Performance

## **Utilitários**
- **date-fns** - Manipulação de datas
- **react-day-picker** - Calendário
- **recharts** - Gráficos
- **xml2js** - Parser XML (NFe)

## **Infraestrutura**
- **Vercel** - Hosting com cron jobs (auto-logout diário)
- **ESLint** - Linting
- **Path aliases** - `@/*` para `src/*`

## **Arquitetura**
- **App Router** do Next.js
- **Server Components** (RSC)
- **Middleware** para autenticação
- **Migrations Supabase** para schema do banco

O projeto é uma aplicação web moderna full-stack com foco em e-commerce/gestão, integrando múltiplos serviços externos e utilizando boas práticas de desenvolvimento React/Next.js.