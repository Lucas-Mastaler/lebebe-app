import Link from 'next/link'

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Acesso negado</h1>
        <p className="text-slate-500 text-sm mb-6">
          Você não tem permissão para acessar esta página.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-[#00A5E6] hover:bg-[#0090cc] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
