import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useComplaintDetail } from '../../hooks/useComplaints'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { PotholeImage } from '../../components/common/PotholeImage'
import { StatusTimeline } from '../../components/report/StatusTimeline'
import { PotholeMap } from '../../components/map/PotholeMap'
import { formatDate } from '../../lib/utils'
import {
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  AlertCircle,
  FileCheck,
  EyeOff,
} from 'lucide-react'

export const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()
  const { data, isLoading, error } = useComplaintDetail(id)

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[#B08D7A] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading complaint record...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-[#F2E7E1]">
        <div className="bg-[#2A0F16] border border-rose-500/40 rounded-3xl p-8 shadow-xl space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
          <h2 className="text-lg font-bold">Complaint Not Found</h2>
          <p className="text-xs text-zinc-400">
            This road hazard report could not be found or you do not have permission to view it.
          </p>
          <Link
            to="/"
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-[#5B1A2A] text-xs font-bold text-white"
          >
            Back to Public Map
          </Link>
        </div>
      </div>
    )
  }

  const { complaint, reports, history, notes } = data
  const isReporter = user?.id === complaint.reporter_id

  // Requirement 9: Keep unapproved complaints and unreviewed report attachments hidden from the public map/viewers.
  // Admins and the complaint owner can see unapproved attachments; general public sees only approved ones.
  const visibleReports = reports.filter((r) => {
    if (isAdmin || isReporter || r.reporter_id === user?.id) return true
    return r.is_approved_attachment
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#B08D7A] hover:text-[#F2E7E1] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Road Map
        </Link>

        {isAdmin && (
          <Link
            to="/admin/review"
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-[#5B1A2A] text-white border border-[#B08D7A]/50"
          >
            Admin Review Desk &rarr;
          </Link>
        )}
      </div>

      {/* Main Complaint Header Card */}
      <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#5B1A2A]/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base sm:text-lg font-black text-[#B08D7A]">
              {complaint.reference_no}
            </span>
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Reported {formatDate(complaint.created_at)}</span>
          </div>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#F2E7E1]">{complaint.title}</h1>
          <p className="text-xs sm:text-sm text-zinc-300 mt-2 leading-relaxed">
            {complaint.description}
          </p>
        </div>

        {/* Location & Team Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="bg-[#0B0B0F]/60 p-3.5 rounded-xl border border-[#5B1A2A]/40 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#B08D7A] shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                Defect Location
              </span>
              <p className="text-xs text-[#F2E7E1] mt-0.5">
                {complaint.address || 'Address not listed'}
              </p>
              <code className="text-[10px] text-zinc-400 mt-1 block">
                {complaint.latitude.toFixed(6)}, {complaint.longitude.toFixed(6)}
              </code>
            </div>
          </div>

          <div className="bg-[#0B0B0F]/60 p-3.5 rounded-xl border border-[#5B1A2A]/40 flex items-start gap-3">
            <Users className="w-4 h-4 text-[#B08D7A] shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                Repair Team Assignment
              </span>
              {complaint.assigned_team ? (
                <>
                  <p className="text-xs font-bold text-[#F2E7E1] mt-0.5">
                    {complaint.assigned_team.name}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    Leader: {complaint.assigned_team.leader_name} ({complaint.assigned_team.zone})
                  </p>
                </>
              ) : (
                <p className="text-xs text-zinc-500 italic mt-0.5">No crew assigned yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mini-map */}
      <div className="rounded-2xl overflow-hidden border border-[#2A0F16]">
        <PotholeMap
          complaints={[complaint]}
          selectedId={complaint.id}
          center={[complaint.latitude, complaint.longitude]}
          zoom={16}
          height="280px"
        />
      </div>

      {/* Photographic Evidence Gallery (Requirement 8 & 9) */}
      <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#B08D7A] flex items-center gap-2">
            <span>Photographic Evidence & Citizen Reports</span>
            <span className="bg-[#5B1A2A] text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
              {visibleReports.length}
            </span>
          </h3>
          <span className="text-[11px] text-zinc-400">
            20m Duplicate Clustering Preserved
          </span>
        </div>

        {visibleReports.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No approved photo evidence available to the public.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleReports.map((report) => (
              <div
                key={report.id}
                className="bg-[#0B0B0F]/70 border border-[#5B1A2A]/50 rounded-2xl overflow-hidden shadow-md flex flex-col"
              >
                <div className="relative h-48 bg-black">
                  <PotholeImage
                    src={report.photo_url}
                    storagePath={report.storage_path}
                    alt="Road defect proof"
                    allowExpand={true}
                  />
                  {report.is_primary ? (
                    <span className="absolute top-2 left-2 bg-[#5B1A2A] text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#B08D7A]/50 shadow">
                      Primary Initial Report
                    </span>
                  ) : (
                    <span className="absolute top-2 left-2 bg-[#2A0F16]/90 text-[#B08D7A] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#B08D7A]/40 shadow">
                      Duplicate Endorsement ({report.distance_from_master}m)
                    </span>
                  )}

                  {!report.is_approved_attachment && (
                    <span className="absolute top-2 right-2 bg-amber-950/80 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/50 flex items-center gap-1 shadow">
                      <EyeOff className="w-3 h-3" />
                      Pending Approval
                    </span>
                  )}
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <p className="text-xs text-zinc-300 leading-relaxed italic">
                    "{report.description}"
                  </p>
                  <div className="pt-2 border-t border-[#5B1A2A]/30 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>By: {report.reporter_name || 'Citizen'}</span>
                    <span>{formatDate(report.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repair Crew Progress Notes */}
      {notes && notes.length > 0 && (
        <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-3xl p-6 shadow-xl space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#B08D7A] flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            <span>Repair Crew Work Updates</span>
          </h3>
          <div className="space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-[#0B0B0F]/60 border border-[#5B1A2A]/30 text-xs space-y-2"
              >
                <p className="text-zinc-200">{n.note}</p>
                {n.photo_url && (
                  <img
                    src={n.photo_url}
                    alt="Crew update"
                    className="w-full sm:w-64 h-36 rounded-lg object-cover border border-[#5B1A2A]"
                  />
                )}
                <div className="text-[10px] text-zinc-400 pt-1">
                  Posted by {n.author?.full_name || 'Crew Member'} • {formatDate(n.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-3xl p-6 shadow-xl">
        <h2 className="text-base font-bold text-[#F2E7E1] mb-4">
          Lifecycle Progression & Audit Trail
        </h2>
        <StatusTimeline currentStatus={complaint.status} history={history} />
      </div>
    </div>
  )
}
