'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

const navItems = [
    {
        label: 'AGENDAMENTOS',
        href: '/agendamentos',
        icon: Calendar,
    },
    {
        label: 'CHAMADOS FINALIZADOS',
        href: '/chamados-finalizados',
        icon: CheckCircle,
    },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen bg-white border-r border-slate-200 sidebar-transition flex flex-col',
                collapsed ? 'w-[72px]' : 'w-[260px]'
            )}
        >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
                {!collapsed && (
                    <span className="text-lg font-semibold text-slate-900">Menu</span>
                )}
                <button
                    onClick={onToggle}
                    className={cn(
                        'p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600',
                        collapsed && 'mx-auto'
                    )}
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
            <nav className="flex-1 p-3">
                <ul className="space-y-2">
                    {navItems.map((item) => {
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
                </ul>
            </nav>
        </aside>
    );
}
