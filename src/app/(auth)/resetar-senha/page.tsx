'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetarSenhaPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError('Erro ao redefinir senha: ' + updateError.message)
        setLoading(false)
        return
      }

      if (data.user?.email) {
        await registrarAuditoria('RESET_CONCLUIDO', data.user.email)
      }

      setSuccess(true)
      
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err)
      setError('Erro ao processar requisição: ' + err.message)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Senha redefinida!
            </h1>
            <p className="text-gray-600 mb-6">
              Sua senha foi redefinida com sucesso. Você será redirecionado para a página de login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Redefinir senha
          </h1>
          <p className="text-gray-600">
            Digite sua nova senha
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="mt-1 text-sm text-amber-600">
                A senha deve ter no mínimo 6 caracteres
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar nova senha
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                placeholder="Digite a senha novamente"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-sm text-red-600">
                As senhas não coincidem
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password.length < 6 || password !== confirmPassword}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
