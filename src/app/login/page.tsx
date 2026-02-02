'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarAuditoria, getErrorMessage } from '@/lib/auth/helpers'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (authError) {
        await registrarAuditoria('LOGIN_FALHA', email.toLowerCase().trim(), {
          error: authError.message,
        })
        setError(getErrorMessage(authError))
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('Erro ao autenticar usuário')
        setLoading(false)
        return
      }

      const { data: usuarioPermitido, error: dbError } = await supabase
        .from('usuarios_permitidos')
        .select('ativo, role')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (dbError || !usuarioPermitido) {
        await supabase.auth.signOut()
        await registrarAuditoria('LOGIN_FALHA', email.toLowerCase().trim(), {
          reason: 'Usuário não permitido',
        })
        setError('Usuário não permitido')
        setLoading(false)
        return
      }

      if (!usuarioPermitido.ativo) {
        await supabase.auth.signOut()
        await registrarAuditoria('LOGIN_FALHA', email.toLowerCase().trim(), {
          reason: 'Usuário bloqueado',
        })
        setError('Usuário bloqueado')
        setLoading(false)
        return
      }

      await registrarAuditoria('LOGIN_SUCESSO', email.toLowerCase().trim(), {
        role: usuarioPermitido.role,
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Erro no login:', err)
      setError('Erro ao processar login')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              le bébé
            </h1>
            <p className="text-gray-600">
              Faça login para acessar o sistema
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/recuperar-senha"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
