import Link from 'next/link'

export default function ForaDoHorarioPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Fora do horário de acesso</h1>
        <p className="text-slate-500 text-sm mb-6">
          Seu perfil não permite acesso ao sistema neste horário.
        </p>
        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 bg-[#00A5E6] hover:bg-[#0090cc] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
