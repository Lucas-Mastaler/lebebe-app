'use client';

import { ChevronRight } from 'lucide-react';

interface TopbarProps {
    sidebarCollapsed: boolean;
    onToggle: () => void;
}

export function Topbar({ sidebarCollapsed, onToggle }: TopbarProps) {
    return (
        <header
            className={`absolute md:fixed top-0 right-0 z-30 h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 transition-all duration-300 ${sidebarCollapsed ? 'left-0 md:left-[72px]' : 'left-[260px]'
                }`}
        >
            {/* Left - Logo and Title */}
            <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile toggle button - only show when sidebar is collapsed */}
                {sidebarCollapsed && (
                    <button
                        onClick={onToggle}
                        className="md:hidden p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
                        aria-label="Expandir menu"
                    >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>

            {/* Right - Future features area */}
            <div className="flex items-center gap-3 sm:gap-4">
                {/* Placeholder for future features like notifications, user menu, etc. */}
            </div>
        </header>
    );
}
