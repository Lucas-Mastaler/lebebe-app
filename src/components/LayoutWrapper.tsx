'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <>
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
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
