import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { CivicPulseLogo } from '../../components/common/CivicPulseLogo'
import { LogIn, Mail, ShieldAlert, ArrowRight, ShieldCheck, MapPin, Zap } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen bg-[#F2E7E1] flex flex-col justify-between selection:bg-[#5B1A2A] selection:text-white">
      {/* Top minimal header */}
      <header className="p-6 sm:px-12 flex items-center justify-between">
        <CivicPulseLogo size={36} showText variant="light" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#B08D7A] bg-white/70 px-3 py-1.5 rounded-full border border-[#B08D7A]/30">
          Official Municipal Portal
        </span>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-[#B08D7A]/35 rounded-3xl p-7 sm:p-9 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF5F2] border border-[#B08D7A]/30 flex items-center justify-center mx-auto text-[#5B1A2A] shadow-2xs">
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2A0F16] tracking-tight font-editorial">
              Sign In to Civic Pulse
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-sm mx-auto leading-relaxed">
              Authenticate with your verified email to report hazards, track status timelines, and access role permissions.
            </p>
          </div>

          {!isConfigured && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong>Configuration Notice:</strong>
                <p className="mt-0.5 text-[11px]">
                  Ensure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> are active in your <code>.env</code>.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800">
              {statusMessage}
            </div>
          )}

          {/* Primary Action: Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#FAF5F2] hover:bg-[#EADCD3] text-[#2A0F16] border border-[#B08D7A]/40 font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-[0.99] shadow-2xs cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-[#5B1A2A] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#B08D7A]/20"></div>
            </div>
            <span className="relative px-3 bg-white text-[11px] uppercase tracking-wider text-zinc-400">
              or sign in with email
            </span>
          </div>

          {/* Email Magic Link Form */}
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#2A0F16] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#B08D7A]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF5F2] border border-[#B08D7A]/30 rounded-xl text-xs sm:text-sm text-[#0B0B0F] placeholder-zinc-400 focus:outline-none focus:border-[#5B1A2A] focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#2A0F16] text-white text-xs sm:text-sm font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Sending link...' : 'Send Magic Sign-In Link'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Info Features */}
          <div className="pt-4 border-t border-[#B08D7A]/15 grid grid-cols-3 gap-2 text-center text-[10px] text-zinc-500">
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5B1A2A]" />
              <span>Role-Protected</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#5B1A2A]" />
              <span>20m Clustered</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#5B1A2A]" />
              <span>Instant Dispatch</span>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="p-6 text-center text-[11px] text-zinc-500">
        Civic Pulse &bull; Municipal Citizen Hazard & Infrastructure Reporting System
      </footer>
    </div>
  )
}
