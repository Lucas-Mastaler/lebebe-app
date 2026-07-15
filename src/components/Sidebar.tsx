'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Activity, Bot, Calendar, ChevronDown, ChevronLeft, ChevronRight, CheckCircle, BarChart3, LogOut, Users, ClipboardList, Clock, Package, TrendingUp, Search, Settings, ShoppingBag, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { NAVIGATION_GROUPS, type NavigationIconKey, type NavigationItemDefinition } from '@/lib/auth/modulos-app';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

type NavItem = NavigationItemDefinition & {
    icon: React.ElementType;
};

type NavGroup = {
    label: string;
    icon: React.ElementType;
    items: NavItem[];
};

const iconByKey: Record<NavigationIconKey, React.ElementType> = {
    activity: Activity,
    barChart3: BarChart3,
    bot: Bot,
    calendar: Calendar,
    checkCircle: CheckCircle,
    clipboardList: ClipboardList,
    clock: Clock,
    package: Package,
    search: Search,
    settings: Settings,
    shieldCheck: ShieldCheck,
    shoppingBag: ShoppingBag,
    trendingUp: TrendingUp,
    users: Users,
};

const navGroups: NavGroup[] = NAVIGATION_GROUPS.map((group) => ({
    label: group.label,
    icon: iconByKey[group.iconKey],
    items: group.items.map((item) => ({
        ...item,
        icon: iconByKey[item.iconKey],
    })),
}));

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'VENDAS': false,
        'PROCURAR DATAS': false,
        'OPERAÇÃO': false,
        'CONFIGURAÇÕES': false,
    });

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

    function isItemActive(item: NavItem) {
        if (item.href.includes('tab=')) {
            const tab = searchParams.get('tab') || 'usuarios';
            return pathname.startsWith('/superadmin') &&
                (item.href.includes(`tab=${tab}`) || (!searchParams.get('tab') && item.href.includes('tab=usuarios')));
        }
        return pathname.startsWith(item.href);
    }

    function isItemVisible(item: NavItem) {
        if (item.access === 'public') return true;
        if (item.access === 'superadmin') return acessoTotal;
        if (!acessoTotal && !chavesPermitidas.includes(item.moduleKey)) return false;
        return true;
    }

    function toggleGroup(label: string) {
        setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    }

    const allVisibleItems = navGroups.flatMap(g => g.items).filter(isItemVisible);

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen bg-white border-r border-slate-200 sidebar-transition flex flex-col',
                collapsed ? 'w-0 md:w-[72px] overflow-hidden' : 'w-[260px]'
            )}
        >
            <div className={cn(
                'h-16 flex items-center border-b border-slate-200',
                collapsed ? 'justify-center px-2' : 'justify-between px-4'
            )}>
                {!collapsed && (
                    <div className="flex items-center gap-2 px-2">
                        <Image
                            src="/logo.png"
                            alt="le bébé"
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

            <nav className={cn(
                'flex-1 p-3 overflow-y-auto',
                collapsed && 'hidden md:block'
            )}>
                <ul className="space-y-2">
                    {permLoading ? (
                        <li className="px-3 py-2 text-slate-400 text-xs">Carregando...</li>
                    ) : collapsed ? (
                        allVisibleItems.map((item) => {
                            const isActive = isItemActive(item);
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
                                            'justify-center px-0'
                                        )}
                                    >
                                        <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[#00A5E6]')} />
                                    </Link>
                                </li>
                            );
                        })
                    ) : (
                        navGroups.map((group) => {
                            const visibleItems = group.items.filter(isItemVisible);
                            if (visibleItems.length === 0) return null;

                            const hasActiveItem = visibleItems.some(isItemActive);
                            const isExpanded = hasActiveItem || expandedGroups[group.label] !== false;
                            const GroupIcon = group.icon;

                            return (
                                <li key={group.label}>
                                    <button
                                        onClick={() => toggleGroup(group.label)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full text-slate-600 hover:bg-slate-100"
                                    >
                                        <GroupIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-medium text-sm flex-1 text-left">{group.label}</span>
                                        <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                                    </button>
                                    {isExpanded && (
                                        <ul className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3">
                                            {visibleItems.map((item) => {
                                                const isActive = isItemActive(item);
                                                const Icon = item.icon;

                                                return (
                                                    <li key={item.href}>
                                                        <Link
                                                            href={item.href}
                                                            className={cn(
                                                                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                                                                isActive
                                                                    ? 'bg-[rgba(0,165,230,0.10)] text-[#00A5E6] border-l-4 border-[#00A5E6] -ml-0.5'
                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                            )}
                                                        >
                                                            <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-[#00A5E6]')} />
                                                            <span className={cn('font-medium text-sm', isActive && 'font-semibold')}>
                                                                {item.label}
                                                            </span>
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        })
                    )}
                </ul>
            </nav>

            <div className={cn(
                'p-3 border-t border-slate-200',
                collapsed && 'hidden md:block'
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