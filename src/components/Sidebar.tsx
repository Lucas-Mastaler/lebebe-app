'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle, BarChart3, LogOut, Users, ClipboardList, Clock, Package, TrendingUp, Search, Settings, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissoes } from '@/lib/hooks/usePermissoes';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    moduleKey?: string;
};

const navItems: NavItem[] = [
    { label: 'DASHBOARD',                href: '/dashboard',               icon: BarChart3,  moduleKey: 'dashboard' },
    { label: 'AGENDAMENTOS',             href: '/agendamentos',            icon: Calendar,   moduleKey: 'agendamentos' },
    { label: 'HORÁRIOS AGENDAMENTOS',    href: '/horarios-agendamentos',   icon: Clock },
    { label: 'PROCURAR DATAS',           href: '/procurar-datas',          icon: Search,     moduleKey: 'procurar_datas' },
    { label: 'CHAMADOS FINALIZADOS',     href: '/chamados-finalizados',    icon: CheckCircle, moduleKey: 'chamados_finalizados' },
    { label: 'INTELIGÊNCIA COMERCIAL',   href: '/inteligencia-comercial',  icon: TrendingUp, moduleKey: 'inteligencia_comercial' },
    { label: 'PÓS-VENDA',               href: '/pos-venda',               icon: ShoppingBag, moduleKey: 'pos_venda' },
    { label: 'RECEBIMENTO',             href: '/recebimento',             icon: Package,    moduleKey: 'recebimento' },
];

const superadminNavItems: NavItem[] = [
    { label: 'USUÁRIOS',    href: '/superadmin?tab=usuarios',         icon: Users },
    { label: 'AUDITORIA',   href: '/superadmin?tab=auditoria',        icon: ClipboardList },
    { label: 'CONFIG BUSCA', href: '/configuracoes/procurar-datas',   icon: Settings },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    const { loading: permLoading, acessoTotal, chavesPermitidas } = usePermissoes();

    async function handleLogout() {
        setLoggingOut(true);
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            setLoggingOut(false);
        }
    }

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen bg-white border-r border-slate-200 sidebar-transition flex flex-col',
                collapsed ? 'w-0 md:w-[72px] overflow-hidden' : 'w-[260px]'
            )}
        >
            {/* Header */}
            <div className={cn(
                "h-16 flex items-center border-b border-slate-200",
                collapsed ? "justify-center px-2" : "justify-between px-4"
            )}>
                {!collapsed && (
                    <div className="flex items-center gap-2 px-2">
                        <Image
                            src="/logo.png"
                            alt="le bebé"
                            width={120}
                            height={40}
                            className="object-contain h-10 w-auto"
                            priority
                        />
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 flex-shrink-0"
                    aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <ChevronLeft className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className={cn(
                "flex-1 p-3",
                collapsed && "hidden md:block"
            )}>
                <ul className="space-y-2">
                    {permLoading ? (
                        <li className="px-3 py-2 text-slate-400 text-xs">Carregando...</li>
                    ) : (
                        <>
                            {navItems.map((item) => {
                                // Sem moduleKey = público (ex: horarios-agendamentos), sempre visível
                                if (item.moduleKey && !acessoTotal && !chavesPermitidas.includes(item.moduleKey)) {
                                    return null;
                                }

                                const isActive = pathname.startsWith(item.href);
                                const Icon = item.icon;

                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                                                isActive
                                                    ? 'bg-[rgba(0,165,230,0.10)] text-[#00A5E6] border-l-4 border-[#00A5E6] -ml-0.5'
                                                    : 'text-slate-600 hover:bg-slate-100',
                                                collapsed && 'justify-center px-0'
                                            )}
                                        >
                                            <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[#00A5E6]')} />
                                            {!collapsed && (
                                                <span className={cn('font-medium text-sm', isActive && 'font-semibold')}>
                                                    {item.label}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}

                            {acessoTotal && (
                                <>
                                    {superadminNavItems.map((item) => {
                                        const tab = searchParams.get('tab') || 'usuarios';
                                        const isActive =
                                            pathname.startsWith('/superadmin') &&
                                            (item.href.includes(`tab=${tab}`) || (!searchParams.get('tab') && item.href.includes('tab=usuarios')));
                                        const Icon = item.icon;

                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                                                        isActive
                                                            ? 'bg-[rgba(0,165,230,0.10)] text-[#00A5E6] border-l-4 border-[#00A5E6] -ml-0.5'
                                                            : 'text-slate-600 hover:bg-slate-100',
                                                        collapsed && 'justify-center px-0'
                                                    )}
                                                >
                                                    <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[#00A5E6]')} />
                                                    {!collapsed && (
                                                        <span className={cn('font-medium text-sm', isActive && 'font-semibold')}>
                                                            {item.label}
                                                        </span>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </>
                            )}
                        </>
                    )}
                </ul>
            </nav>

            <div className={cn(
                "p-3 border-t border-slate-200",
                collapsed && "hidden md:block"
            )}>
                <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed',
                        collapsed && 'justify-center px-0'
                    )}
                    aria-label="Sair"
                    title={collapsed ? 'Sair' : undefined}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                        <span className="font-medium text-sm">
                            {loggingOut ? 'Saindo...' : 'Sair'}
                        </span>
                    )}
                </button>
            </div>
        </aside>
    );
}
