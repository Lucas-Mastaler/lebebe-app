'use client';

interface TopbarProps {
    sidebarCollapsed: boolean;
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
    return (
        <header
            className={`fixed top-0 right-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 transition-all duration-300 ${sidebarCollapsed ? 'left-[72px]' : 'left-[260px]'
                }`}
        >
            {/* Left - Logo and Title */}
            <div className="flex items-center gap-3">
                {/* Logo moved to Sidebar */}
            </div>

            {/* Right - Future features area */}
            <div className="flex items-center gap-4">
                {/* Placeholder for future features like notifications, user menu, etc. */}
            </div>
        </header>
    );
}
