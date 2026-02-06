'use client';

import { Suspense, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const pathname = usePathname();

    const [isMounted, setIsMounted] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (pathname?.startsWith('/horarios-agendamentos')) {
            const checkAuth = async () => {
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                setIsAuthenticated(!!session);
            };
            checkAuth();
        }
    }, [pathname]);

    const publicRoutes = ['/login', '/recuperar-senha', '/resetar-senha', '/definir-senha', '/convite'];

    // Rota pública "pura" OU rota híbrida sem autenticação
    const isPublicRoute =
        publicRoutes.some(route => pathname?.startsWith(route)) ||
        (pathname?.startsWith('/horarios-agendamentos') && !isAuthenticated);

    if (isPublicRoute) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                {/* Public Header */}
                <header className="bg-white border-b border-slate-200 h-24 shadow-sm sticky top-0 z-50">
                    <div className="w-[90%] md:w-[80%] mx-auto h-full flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Use img tag temporarily or import Image if verified available in LayoutWrapper scope. 
                                Since LayoutWrapper is a client component, standard img is safe or dynamic import of Image. 
                                However, to match Sidebar, I'll assume standard img for simplicity or re-use same logic if Image is imported.
                                Let's use simple img to avoid missing import errors in this block, or use a dynamic import.
                                Actually better: I will add Image import to LayoutWrapper next if needed, but for now standard img works.
                              */}
                            <img
                                src="/logo.png"
                                alt="le bebé"
                                className="h-16 w-auto object-contain"
                            />
                        </div>
                        <div className="text-sm text-slate-500 hidden sm:block">
                            Agendamentos
                        </div>
                    </div>
                </header>

                <main className="flex-1 w-full w-[90%] md:w-[80%] mx-auto py-10 mb-10">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>

                <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
                    <div className="w-[90%] md:w-[80%] mx-auto text-center text-slate-400 text-sm">
                        © {new Date().getFullYear()} le bebé. Todos os direitos reservados.
                    </div>
                </footer>
            </div>
        );
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
