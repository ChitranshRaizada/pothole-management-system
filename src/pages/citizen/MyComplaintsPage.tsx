import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMyComplaints } from '../../hooks/useComplaints'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { PotholeImage } from '../../components/common/PotholeImage'
import { formatDate } from '../../lib/utils'
import { AuthModal } from '../../components/auth/AuthModal'
import {
  ClipboardList,
  PlusCircle,
  ChevronRight,
  Clock,
  MapPin,
  LogIn,
  AlertCircle,
} from 'lucide-react'

export const MyComplaintsPage: React.FC = () => {
  const { user } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'resolved'>('all')

  const { data: complaints = [], isLoading, error } = useMyComplaints(user?.id)

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-[#F2E7E1]">
        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-8 shadow-xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#5B1A2A] border border-[#B08D7A]/40 flex items-center justify-center text-[#B08D7A]">
            <LogIn className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold">Sign In to View Your Complaints</h2>
          <p className="text-xs text-zinc-300">
            Sign in with Google to monitor your road reports, track repair team progress, and receive status updates.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full py-3 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-sm font-bold text-white transition border border-[#B08D7A]/50 cursor-pointer"
          >
            Sign In with Google
          </button>
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    )
  }

  const filtered = complaints.filter((c) => {
    if (filterTab === 'active') return !['Resolved', 'Closed', 'Rejected'].includes(c.status)
    if (filterTab === 'resolved') return ['Resolved', 'Closed'].includes(c.status)
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#F2E7E1] tracking-tight">
            My Submitted Complaints
          </h1>
          <p className="text-xs text-[#B08D7A]">
            Track the live municipal review and repair timeline for your reports.
          </p>
        </div>

        <Link
          to="/report"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-white text-xs font-bold border border-[#B08D7A]/40 shadow transition"
        >
          <PlusCircle className="w-4 h-4 text-[#B08D7A]" />
          New Report
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2A0F16] pb-3">
        {(['all', 'active', 'resolved'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${filterTab === tab
              ? 'bg-[#5B1A2A] text-white border border-[#B08D7A]/60'
              : 'text-zinc-400 hover:text-white bg-[#0B0B0F]'
              }`}
          >
            {tab} Reports
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="h-64 rounded-2xl bg-[#2A0F16] border border-[#5B1A2A] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-[#B08D7A] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400">Loading your submissions...</p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-center">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-400" />
          <p className="text-xs font-semibold">Could not load reports</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-3xl p-10 text-center text-zinc-400 space-y-3">
          <ClipboardList className="w-10 h-10 mx-auto text-zinc-600" />
          <h3 className="text-base font-bold text-zinc-200">No Complaints In This Category</h3>
          <p className="text-xs max-w-sm mx-auto">
            You haven't filed any reports matching this filter tab yet.
          </p>
          <Link
            to="/report"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5B1A2A] text-white text-xs font-bold transition"
          >
            <PlusCircle className="w-4 h-4 text-[#B08D7A]" />
            Report Road Hazard Now
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const primaryReport = item.reports?.find((r) => r.is_primary) || item.reports?.[0]

            return (
              <Link
                key={item.id}
                to={`/complaint/${item.id}`}
                className="block p-4 sm:p-5 rounded-2xl bg-[#2A0F16] hover:bg-[#2A0F16]/80 border border-[#5B1A2A]/40 transition group shadow-md"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    {primaryReport?.photo_url || primaryReport?.storage_path ? (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#5B1A2A] shrink-0">
                        <PotholeImage
                          src={primaryReport.photo_url}
                          storagePath={primaryReport.storage_path}
                          alt="Thumbnail"
                          allowExpand={false}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#0B0B0F] border border-[#5B1A2A] flex items-center justify-center shrink-0">
                        <MapPin className="w-6 h-6 text-zinc-600" />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-[#B08D7A]">
                          {item.reference_no}
                        </span>
                        <PriorityBadge priority={item.priority} size="sm" />
                      </div>
                      <h3 className="text-sm font-bold text-[#F2E7E1] group-hover:text-[#B08D7A] transition">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                        {item.address || 'Location on map'}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {formatDate(item.created_at)}
                        </span>
                        {((item.report_count ?? item.reports_count ?? item.reports?.length ?? 1) > 1) && (
                          <span className="bg-[#0B0B0F] px-2 py-0.5 rounded text-[10px] text-[#B08D7A]">
                            {item.report_count ?? item.reports_count ?? item.reports?.length} citizen reports
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <StatusBadge status={item.status} size="sm" />
                    <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-[#F2E7E1] group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

