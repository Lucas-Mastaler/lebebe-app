'use client';

import { Suspense, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const pathname = usePathname();

    const publicRoutes = ['/login', '/recuperar-senha', '/resetar-senha', '/definir-senha', '/convite'];
    const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

    if (isPublicRoute) {
        return <>{children}</>;
    }

    return (
        <>
            <Suspense fallback={null}>
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
            </Suspense>
            <Topbar sidebarCollapsed={sidebarCollapsed} />
            <main
                className={`pt-16 min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'pl-[72px]' : 'pl-[260px]'
                    }`}
            >
                <div className="p-6">
                    {children}
                </div>
            </main>
        </>
    );
}
