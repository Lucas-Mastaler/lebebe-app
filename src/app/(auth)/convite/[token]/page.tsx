'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ConvitePage() {
  const params = useParams<{ token: string }>()
  const token = params?.token

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirmar() {
    if (!token || typeof token !== 'string') {
      setError('Token inválido.')
      return
    }

    if (loading) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/auth/convite/${token}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setError(data?.message || 'Não foi possível confirmar o convite.')
        setLoading(false)
        return
      }

      const redirectUrl = data?.redirectUrl
      if (!redirectUrl) {
        setError('Resposta inválida do servidor.')
        setLoading(false)
        return
      }

      window.location.href = redirectUrl
    } catch (e: any) {
      setError(e?.message || 'Erro ao confirmar convite.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <img
            src="https://phsoawbdvhurroryfnok.supabase.co/storage/v1/object/public/logo/logo.png"
            alt="le bébé"
            className="mx-auto w-20 h-20 object-contain mb-4"
          />

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Confirmar convite
          </h1>

          <p className="text-gray-600 mb-6">
            Para continuar, clique no botão abaixo. Isso vai gerar um link seguro para definir sua senha.
          </p>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Confirmando...' : 'Confirmar convite'}
          </button>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
