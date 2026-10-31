import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2E7E1] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-[#5B1A2A] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#2A0F16] font-medium">Verifying Civic Pulse session...</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2E7E1] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-[#5B1A2A] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#2A0F16] font-medium">Verifying administrator clearance...</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#2A0F16] border border-rose-500/40 rounded-2xl p-6 text-center text-[#F2E7E1] shadow-xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-300">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-2">Restricted Administrator Area</h1>
          <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
            Your authenticated account (<code>{user.email}</code>) currently holds the <strong>Citizen</strong> role.
            Administrative privileges are strictly server-controlled and cannot be self-granted by users.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-sm font-semibold transition text-[#F2E7E1]"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Citizen Portal
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
