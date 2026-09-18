'use client'

import Link from 'next/link'
import { Caveat } from 'next/font/google'
import { ArrowRight, ChevronRight, ClipboardList, Heart, Search, Star, Users } from 'lucide-react'
import { PageContainer } from '@/components/design-system'
import { Card } from '@/components/design-system/Card'
import { BrandLogo } from '@/components/BrandLogo'
import { usePermissoes } from '@/lib/hooks/usePermissoes'
import { NAVIGATION_GROUPS, type AppModuleKey } from '@/lib/auth/modulos-app'
import { SECTION_TONE_CLASSES, type SectionTone } from '@/lib/design-system/section-tones'
import { cn } from '@/lib/utils'

const script = Caveat({ subsets: ['latin'], weight: ['500', '600'] })

const SHORTCUTS: {
  moduleKey: AppModuleKey
  title: string
  description: string
  icon: React.ElementType
  tone: SectionTone
}[] = [
  { moduleKey: 'atendimento_presencial_ficha', title: 'Atendimento presencial', description: 'Registre e acompanhe o atendimento presencial.', icon: Users, tone: 'section-1' },
  { moduleKey: 'pedidos_personalizados_novo', title: 'Pedidos personalizados', description: 'Passe as vendas de novos pedidos personalizados.', icon: ClipboardList, tone: 'section-2' },
  { moduleKey: 'procurar_datas', title: 'Procurar datas', description: 'Encontre datas de entrega disponíveis.', icon: Search, tone: 'section-3' },
]

const NAVIGATION_ITEMS = NAVIGATION_GROUPS.flatMap((group) => group.items)

export function InicioBoasVindas() {
  const { loading, acessoTotal, chavesPermitidas } = usePermissoes()

  // Mesma regra de visibilidade da Sidebar; a rota vem do catálogo central de módulos.
  const shortcuts = SHORTCUTS.flatMap((shortcut) => {
    const item = NAVIGATION_ITEMS.find((i) => i.moduleKey === shortcut.moduleKey)
    if (!item) return []
    const visible =
      item.access === 'public' || (item.access === 'superadmin' ? acessoTotal : acessoTotal || chavesPermitidas.includes(item.moduleKey))
    return visible ? [{ ...shortcut, href: item.href }] : []
  })

  return (
    <PageContainer>
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-primary/10 via-white to-accent/25">
        {/* Decoração — só cores da marca, sem significado funcional */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-24 size-72 rounded-full bg-secondary/15 blur-2xl" />
          <div className="absolute -right-20 -top-16 size-64 rounded-full bg-primary/15 blur-2xl" />
          <div className="absolute -bottom-24 -right-16 size-80 rounded-full bg-accent/50 blur-2xl" />
        </div>

        <div className="relative px-5 pb-8 pt-8 sm:px-10 sm:pt-10">
          <div className="grid items-center gap-8 xl:grid-cols-[11rem_1fr_16rem]">
            {/* Coluna esquerda (só xl): sol + frase manuscrita */}
            <div aria-hidden="true" className="hidden xl:block">
              <svg viewBox="0 0 120 90" className="h-20 w-28">
                <g stroke="#FBF27B" strokeWidth="5" strokeLinecap="round">
                  <path d="M78 8v8M98 18l-6 6M108 40h-8M58 18l6 6" />
                </g>
                <circle cx="78" cy="40" r="17" fill="#FBF27B" />
                <path d="M20 78a12 12 0 0 1 4-23 16 16 0 0 1 30-3 13 13 0 0 1 8 26z" className="fill-white stroke-slate-200" />
              </svg>
              <p className={cn(script.className, '-rotate-6 pt-6 text-2xl font-semibold leading-tight text-primary')}>
                Mais que vender, acompanhamos grandes conquistas
              </p>
            </div>

            {/* Centro: marca + boas-vindas */}
            <div className="text-center xl:text-left">
              <BrandLogo className="mx-auto w-[220px] sm:w-[260px] xl:mx-0" sizes="260px" priority />
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Seja bem-vindo ao
                <span className="block text-primary">
                  app da Le Bébé!{' '}
                  <Heart aria-hidden="true" className="inline size-7 fill-rose-400 text-rose-400 sm:size-9" />
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base text-slate-600 sm:text-lg xl:mx-0">
                Tudo o que você precisa em um só lugar.
              </p>
            </div>

            {/* Direita (só xl): mamadeira + estrelas */}
            <div aria-hidden="true" className="relative hidden h-72 xl:block">
              <div className="absolute inset-x-4 bottom-12 top-2 rounded-full bg-gradient-to-br from-secondary/30 to-primary/10" />
              <svg
                viewBox="0 0 120 200"
                className="absolute left-1/2 top-4 h-52 w-32 -translate-x-1/2 rotate-12"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <path d="M60 6c-9 0-14 9-14 20v14h28V26c0-11-5-20-14-20z" fill="#FBF27B" stroke="#EAB308" strokeWidth="3" />
                <rect x="30" y="40" width="60" height="20" rx="8" fill="#00A5E6" stroke="#0080B3" strokeWidth="3" />
                <path d="M36 60h48c6 0 10 5 10 11v103c0 9-7 16-16 16H42c-9 0-16-7-16-16V71c0-6 4-11 10-11z" fill="white" stroke="#0080B3" strokeWidth="3" />
                <path d="M27 112h66v62c0 9-7 16-16 16H43c-9 0-16-7-16-16z" fill="#3BBAE8" fillOpacity=".35" />
                <path d="M74 84h12M78 100h8M74 116h12M78 132h8" stroke="#0080B3" strokeWidth="3" />
                <path d="M60 138l4.5 9.5 10.5 1.3-7.8 7.2 2 10.4-9.2-5.2-9.2 5.2 2-10.4-7.8-7.2 10.5-1.3z" fill="#FBF27B" stroke="#EAB308" strokeWidth="2.5" />
              </svg>
              <Star className="absolute right-6 top-2 size-12 rotate-12 fill-accent text-yellow-400" />
              <Star className="absolute bottom-16 left-4 size-8 -rotate-12 fill-accent text-yellow-400" />
              <p className={cn(script.className, 'absolute inset-x-0 bottom-0 rotate-3 text-center text-2xl font-semibold leading-tight text-primary')}>
                Grandes histórias começam aqui
              </p>
            </div>
          </div>

          {/* Atalhos: só módulos que o usuário pode acessar */}
          <div className="mt-10 grid min-h-[7.5rem] gap-4 xl:grid-cols-3">
            {loading
              ? SHORTCUTS.map((s) => <div key={s.moduleKey} className="h-32 animate-pulse rounded-2xl bg-white/70" />)
              : shortcuts.map((shortcut) => {
                  const tone = SECTION_TONE_CLASSES[shortcut.tone]
                  const Icon = shortcut.icon
                  return (
                    <Link
                      key={shortcut.moduleKey}
                      href={shortcut.href}
                      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Card className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
                        <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl', tone.surface, tone.icon)}>
                          <Icon aria-hidden="true" className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg font-bold text-slate-900">{shortcut.title}</span>
                          <span className="mt-1 block text-sm text-slate-600">{shortcut.description}</span>
                          <span className={cn('mt-3 inline-flex items-center gap-1 text-sm font-semibold', tone.title)}>
                            Acessar <ArrowRight aria-hidden="true" className="size-4" />
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" className="size-5 shrink-0 self-center text-slate-400 transition-transform group-hover:translate-x-0.5" />
                      </Card>
                    </Link>
                  )
                })}
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Heart aria-hidden="true" className="size-3.5 text-slate-300" />
            Facilitando a vida da equipe da Le Bébé
            <Heart aria-hidden="true" className="size-3.5 text-slate-300" />
          </p>
        </div>
      </section>
    </PageContainer>
  )
}
