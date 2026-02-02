'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from './LogoutButton'

interface NavigationProps {
  userEmail?: string
  isSuperadmin?: boolean
}

export function Navigation({ userEmail, isSuperadmin }: NavigationProps) {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-indigo-600">Le Bebê</span>
            </Link>
            <div className="ml-10 flex items-center space-x-4">
              <Link
                href="/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname === '/dashboard'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/agendamentos"
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname === '/agendamentos'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Agendamentos
              </Link>
              <Link
                href="/chamados-finalizados"
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                  pathname === '/chamados-finalizados'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Chamados Finalizados
              </Link>
              {isSuperadmin && (
                <Link
                  href="/superadmin"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    pathname === '/superadmin'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Superadmin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {userEmail && (
              <span className="text-sm text-gray-600">{userEmail}</span>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  )
}
