'use client'

import { FormEvent, useState } from 'react'

const GENERIC_ERROR = 'Não foi possível iniciar a sessão técnica.'

export default function AgentBootstrapPage() {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/agente', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })

      if (!response.ok) {
        setError(GENERIC_ERROR)
        return
      }

      window.location.assign('/inicio')
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="text-center text-3xl font-bold text-gray-900">le bébé</h1>
      <p className="mt-2 text-center text-gray-600">Autenticação técnica para testes</p>

      <label htmlFor="agent-bootstrap-secret" className="mt-8 block text-sm font-medium text-gray-700">
        Secret de teste
      </label>
      <input
        id="agent-bootstrap-secret"
        name="secret"
        type="password"
        required
        autoComplete="off"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Autenticando...' : 'Iniciar sessão de teste'}
      </button>
    </form>
  )
}
