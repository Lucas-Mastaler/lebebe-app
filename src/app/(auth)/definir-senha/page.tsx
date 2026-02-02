'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarAuditoria } from '@/lib/auth/helpers'
import { Eye, EyeOff } from 'lucide-react'

function DefinirSenhaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<'initial' | 'form' | 'success' | 'error' | 'expired'>('initial')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exchangeLoading, setExchangeLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const errorCode = searchParams.get('error_code')
    const errorDesc = searchParams.get('error_description')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    
    if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
      setStep('expired')
      setError('Link expirou ou já foi usado.')
      return
    }
    
    if (!token_hash || !type) {
      setStep('error')
      setError('Link inválido ou expirado. Solicite um novo convite ao administrador.')
    }
  }, [searchParams])

  async function handleValidateInvite() {
    setExchangeLoading(true)
    setError('')

    try {
      const supabase = createClient()
      
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!token_hash || !type) {
        setError('Link inválido. Parâmetros não encontrados.')
        setStep('error')
        setExchangeLoading(false)
        return
      }

      const { data, error: exchangeError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      })

      if (exchangeError || !data.user) {
        console.error('Erro ao validar convite:', exchangeError)
        setError('Link inválido ou expirado. Este link pode já ter sido usado ou ter expirado. Solicite um novo convite ao administrador.')
        setStep('error')
        setExchangeLoading(false)
        return
      }

      setStep('form')
      setExchangeLoading(false)
    } catch (err: any) {
      console.error('Erro ao processar convite:', err)
      setError('Erro ao processar convite: ' + err.message)
      setStep('error')
      setExchangeLoading(false)
    }
  }

  async function handleResendInvite() {
    if (!userEmail) {
      setError('Email não disponível. Por favor, contate o administrador.')
      return
    }

    if (resendLoading) return

    setResendLoading(true)
    setError('')

    try {
      const response = await fetch('/api/superadmin/reenviar-convite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Erro ao reenviar convite')
        setResendLoading(false)
        return
      }

      setStep('success')
      setError('')
      
    } catch (err: any) {
      setError('Erro ao processar requisição: ' + err.message)
    } finally {
      setResendLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
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

      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser?.email) {
        setError('Sessão inválida. Por favor, clique novamente no link do email.')
        setLoading(false)
        return
      }

      setUserEmail(currentUser.email)

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError('Erro ao definir senha: ' + updateError.message)
        setLoading(false)
        return
      }

      await registrarAuditoria('SENHA_DEFINIDA', currentUser.email)

      setStep('success')

      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)

    } catch (err: any) {
      setError('Erro ao processar requisição: ' + err.message)
      setLoading(false)
    }
  }

  if (step === 'expired') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Link Expirado
            </h1>
            <p className="text-gray-600 mb-6">
              Este link de convite expirou ou já foi usado. Solicite um novo convite ao administrador ou clique no botão abaixo para reenviar.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seu e-mail
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  disabled={resendLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  placeholder="seu@email.com"
                />
              </div>

              <button
                onClick={handleResendInvite}
                disabled={resendLoading || !userEmail}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resendLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Reenviando...
                  </>
                ) : (
                  'Reenviar Convite'
                )}
              </button>

              <a
                href="/login"
                className="block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Voltar para Login
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Link Inválido
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <a
              href="/login"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition"
            >
              Ir para Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Senha Definida!</h1>
            <p className="text-gray-600 mb-4">
              Sua senha foi configurada com sucesso. Redirecionando para o sistema...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'form') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">🔑</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              le bébé
            </h1>
            <p className="text-gray-600">
              Defina sua senha para acessar o sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  placeholder="Mínimo 6 caracteres"
                  required
                  disabled={loading}
                  minLength={6}
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
                Confirmar Senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  placeholder="Digite a senha novamente"
                  required
                  disabled={loading}
                  minLength={6}
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
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 6 || password !== confirmPassword}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Definindo senha...' : 'Definir Senha e Acessar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">✉️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo ao le bébé
          </h1>
          <p className="text-gray-600 mb-8">
            Você recebeu um convite para acessar o sistema. Clique no botão abaixo para validar seu convite e definir sua senha.
          </p>

          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          <button
            onClick={handleValidateInvite}
            disabled={exchangeLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exchangeLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Validando...
              </span>
            ) : (
              'Continuar e Definir Senha'
            )}
          </button>

          <p className="mt-6 text-sm text-gray-500">
            Este link é de uso único e expira após ser utilizado.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function DefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <DefinirSenhaContent />
    </Suspense>
  )
}
