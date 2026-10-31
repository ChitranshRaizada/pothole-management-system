import React, { useState } from 'react'
import { X, ShieldAlert, LogIn, Mail } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  message?: string
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  message = 'Sign in to submit and track your road complaints.',
}) => {
  const { signInWithGoogle, signInWithEmail, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrorMessage(null)
    setStatusMessage(null)

    const { error } = await signInWithGoogle()
    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setErrorMessage(null)
    setStatusMessage(null)

    const { error, message } = await signInWithEmail(email.trim())
    setLoading(false)
    if (error) {
      setErrorMessage(error.message)
    } else if (message) {
      setStatusMessage(message)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0B0F]/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-md bg-[#2A0F16] border border-[#B08D7A]/50 rounded-2xl p-6 text-[#F2E7E1] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-[#F2E7E1] transition"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-[#5B1A2A] text-[#F2E7E1] border border-[#B08D7A]/40 shadow-inner">
            <LogIn className="w-6 h-6" />
          </div>
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-[#F2E7E1]">
              Citizen & Staff Sign In
            </h2>
            <p className="text-xs text-[#B08D7A]">Municipal Pothole & Road Management</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-6">{message}</p>

        {!isConfigured && (
          <div className="mb-4 p-3 bg-amber-950/60 border border-amber-600/60 rounded-xl text-xs text-amber-200 flex gap-2 items-start">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong>Supabase Setup Required:</strong>
              <p className="mt-1">
                To connect real Google OAuth, set <code>VITE_SUPABASE_URL</code> and{' '}
                <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your <code>.env</code> file.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/70 border border-rose-500/70 rounded-xl text-xs text-rose-200">
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div className="mb-4 p-3 bg-emerald-950/70 border border-emerald-500/70 rounded-xl text-xs text-emerald-200">
            {statusMessage}
          </div>
        )}

        {/* Primary Requirement: Google OAuth via Supabase */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#F2E7E1] text-[#0B0B0F] font-semibold hover:bg-white active:scale-[0.99] transition shadow-md disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#5B1A2A] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.27-2.09 3.67-5.17 3.67-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
          )}
          <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#B08D7A]/30"></div>
          </div>
          <span className="relative px-3 bg-[#2A0F16] text-xs uppercase tracking-wider text-zinc-400">
            or sign in with email
          </span>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-[#0B0B0F]/60 border border-[#B08D7A]/40 rounded-xl text-sm text-[#F2E7E1] placeholder-zinc-500 focus:outline-none focus:border-[#B08D7A] transition"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-[#F2E7E1] text-sm font-semibold border border-[#B08D7A]/40 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Sending link...' : 'Send Magic Sign-In Link'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#B08D7A]/20 text-[11px] text-zinc-400 text-center leading-relaxed">
          <p>
            🛡️ <strong>Server-controlled roles:</strong> Administrative access is managed
            exclusively by municipal operators via database access rules.
          </p>
        </div>
      </div>
    </div>
  )
}

