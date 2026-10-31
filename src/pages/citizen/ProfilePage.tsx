import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMyComplaints } from '../../hooks/useComplaints'
import { supabase } from '../../lib/supabase'
import { AuthModal } from '../../components/auth/AuthModal'
import {
  User,
  Mail,
  Calendar,
  LogOut,
  Edit2,
  ClipboardList,
  CheckCircle2,
  Lock,
  Clock,
} from 'lucide-react'

export const ProfilePage: React.FC = () => {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)

  const { data: myComplaints = [] } = useMyComplaints(user?.id)

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-[#F2E7E1]">
        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-8 shadow-xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#5B1A2A] border border-[#B08D7A]/40 flex items-center justify-center text-[#B08D7A]">
            <User className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold">Sign In Required</h2>
          <p className="text-xs text-zinc-300">
            Please sign in with Google to view and manage your citizen profile.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-sm font-bold text-white transition cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    )
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdating(true)
    setUpdateMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setIsEditing(false)
      setUpdateMsg('Profile name updated successfully!')
    } catch (err: any) {
      setUpdateMsg(err?.message || 'Failed to update profile.')
    } finally {
      setUpdating(false)
    }
  }

  const activeReportsCount = myComplaints.filter(
    (c) => !['Resolved', 'Closed', 'Rejected'].includes(c.status)
  ).length
  const resolvedCount = myComplaints.filter((c) =>
    ['Resolved', 'Closed'].includes(c.status)
  ).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Profile Header */}
      <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-24 h-24 rounded-full border-2 border-[#B08D7A] object-cover shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#5B1A2A] border-2 border-[#B08D7A] flex items-center justify-center text-3xl font-extrabold text-[#F2E7E1] shadow-lg">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <h1 className="text-2xl font-black text-[#F2E7E1]">
                {profile?.full_name || 'Citizen Reporter'}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                  isAdmin
                    ? 'bg-[#5B1A2A] text-white border-[#B08D7A]'
                    : 'bg-[#0B0B0F] text-[#B08D7A] border-[#B08D7A]/40'
                }`}
              >
                {isAdmin ? '🛡️ Administrator' : 'Citizen'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#B08D7A]" />
                {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#B08D7A]" />
                Member since {new Date(profile?.created_at || Date.now()).getFullYear()}
              </span>
            </div>

            {/* Edit Display Name */}
            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="px-3 py-1.5 rounded-xl bg-[#0B0B0F] border border-[#5B1A2A] text-xs text-[#F2E7E1]"
                />
                <button
                  type="submit"
                  disabled={updating}
                  className="px-3 py-1.5 rounded-xl bg-[#5B1A2A] text-white text-xs font-bold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-1.5 text-xs text-zinc-400"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setFullName(profile?.full_name || '')
                  setIsEditing(true)
                }}
                className="inline-flex items-center gap-1 text-xs text-[#B08D7A] hover:text-[#F2E7E1] transition pt-1 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                Change display name
              </button>
            )}

            {updateMsg && <p className="text-xs text-emerald-400 pt-1">{updateMsg}</p>}
          </div>

          <button
            onClick={() => signOut()}
            className="self-center sm:self-start p-2.5 rounded-xl bg-[#0B0B0F] hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 border border-[#5B1A2A]/40 transition cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Citizen Activity Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-2xl p-4 text-center">
          <ClipboardList className="w-6 h-6 mx-auto mb-1 text-[#B08D7A]" />
          <span className="text-2xl font-black text-[#F2E7E1]">{myComplaints.length}</span>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-1">
            Total Filed
          </p>
        </div>

        <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-2xl p-4 text-center">
          <Clock className="w-6 h-6 mx-auto mb-1 text-amber-400" />
          <span className="text-2xl font-black text-[#F2E7E1]">{activeReportsCount}</span>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-1">
            In Municipal Workflow
          </p>
        </div>

        <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-2xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
          <span className="text-2xl font-black text-[#F2E7E1]">{resolvedCount}</span>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-1">
            Resolved Road Repairs
          </p>
        </div>
      </div>

      {/* Security Architecture & Role Enforcement Notice */}
      <div className="bg-[#0B0B0F] border border-[#2A0F16] rounded-2xl p-5 text-xs text-zinc-400 space-y-2">
        <div className="flex items-center gap-2 text-[#F2E7E1] font-bold">
          <Lock className="w-4 h-4 text-[#B08D7A]" />
          <span>Server-Controlled Role Enforcement</span>
        </div>
        <p className="leading-relaxed">
          Per municipal security compliance, account roles are controlled strictly via server-side database Row Level Security policies. Users are prevented by database constraints from self-escalating permissions. Administrative rights can only be provisioned by authorized municipal database administrators.
        </p>
      </div>
    </div>
  )
}
