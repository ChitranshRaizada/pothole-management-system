import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AlertCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorState, setErrorState] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    let isMounted = true

    const handleOAuthCallback = async () => {
      // 1. Check for errors returned in query params by OAuth provider or Supabase
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error || errorDescription) {
        if (isMounted) {
          setErrorState(errorDescription || error || 'Authentication was cancelled or failed.')
          setIsProcessing(false)
        }
        return
      }

      // 2. Check for PKCE authorization code in query string
      const code = searchParams.get('code')

      try {
        if (code) {
          // Exchange authorization code for authenticated session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
        } else {
          // Implicit flow / hash fragment fallback or session detection
          const { data, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) {
            throw sessionError
          }
          if (!data.session) {
            // Check if hash fragment contains access_token
            const hash = window.location.hash
            if (hash && hash.includes('access_token')) {
              // Wait for supabase client's automatic detectSessionInUrl to finish
              await new Promise((resolve) => setTimeout(resolve, 500))
              const { data: hashData } = await supabase.auth.getSession()
              if (!hashData.session) {
                throw new Error('Unable to establish a secure session from the authentication response.')
              }
            }
          }
        }

        if (isMounted) {
          setIsProcessing(false)
          // Clean redirect to citizen portal home
          navigate('/', { replace: true })
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[Auth Callback Error]:', err)
          setErrorState(
            err?.message || 'Failed to complete Google authentication. Please try signing in again.'
          )
          setIsProcessing(false)
        }
      }
    }

    handleOAuthCallback()

    return () => {
      isMounted = false
    }
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4 selection:bg-[#5B1A2A] selection:text-[#F2E7E1]">
      <div className="max-w-md w-full bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-8 text-center text-[#F2E7E1] shadow-2xl space-y-5">
        {isProcessing ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#5B1A2A] border border-[#B08D7A]/50 flex items-center justify-center text-[#B08D7A] shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#F2E7E1]">Authenticating with Google</h2>
              <p className="text-xs text-[#B08D7A] mt-1.5">
                Verifying your secure session with Civic Pulse...
              </p>
            </div>
            <div className="w-full bg-[#0B0B0F] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#B08D7A] h-full rounded-full w-2/3 animate-pulse" />
            </div>
          </>
        ) : errorState ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-300 shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-rose-200">Authentication Error</h2>
              <p className="text-xs text-zinc-300 mt-2 leading-relaxed bg-[#0B0B0F]/60 p-3.5 rounded-xl border border-rose-500/30 text-left">
                {errorState}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/"
                className="w-full py-3 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-sm font-bold text-white transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-[#B08D7A]" />
                Return to Civic Pulse Home
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-emerald-200">Authentication Verified</h2>
            <p className="text-xs text-zinc-400">Redirecting to your portal...</p>
          </>
        )}
      </div>
    </div>
  )
}

