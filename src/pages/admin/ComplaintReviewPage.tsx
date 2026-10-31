import React, { useState } from 'react'
import {
  useAdminComplaints,
  useUpdateComplaintStatus,
  useUpdateComplaintPriority,
  useApproveReportAttachment,
} from '../../hooks/useComplaints'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { PotholeImage } from '../../components/common/PotholeImage'
import { formatDate } from '../../lib/utils'
import {
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Sliders,
  Loader2,
  FileCheck2,
  MapPin,
} from 'lucide-react'
import type { Complaint, ComplaintReport, PriorityLevel, PotholeStatus } from '../../types/database'
import { Link } from 'react-router-dom'

export const ComplaintReviewPage: React.FC = () => {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const { data: complaints = [], isLoading } = useAdminComplaints()

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const statusMutation = useUpdateComplaintStatus()
  const priorityMutation = useUpdateComplaintPriority()
  const attachmentMutation = useApproveReportAttachment()

  const pendingComplaints = complaints.filter(
    (c) => c.status === 'New' || c.status === 'Under Review'
  )
  const displayed = filter === 'pending' ? pendingComplaints : complaints

  const handleStatusChange = async (newStatus: PotholeStatus) => {
    if (!selectedComplaint) return
    try {
      await statusMutation.mutateAsync({
        complaintId: selectedComplaint.id,
        currentStatus: selectedComplaint.status,
        newStatus,
        notes: reviewNotes || `Admin moved status to ${newStatus}`,
      })
      // Update local selection
      setSelectedComplaint({
        ...selectedComplaint,
        status: newStatus,
      })
      setReviewNotes('')
    } catch (err: any) {
      alert(err?.message || 'Status transition failed.')
    }
  }

  const handlePriorityChange = async (priority: PriorityLevel) => {
    if (!selectedComplaint) return
    try {
      await priorityMutation.mutateAsync({
        complaintId: selectedComplaint.id,
        priority,
      })
      setSelectedComplaint({
        ...selectedComplaint,
        priority,
      })
    } catch (err: any) {
      alert(err?.message || 'Failed to update priority.')
    }
  }

  const handleToggleAttachmentApproval = async (report: ComplaintReport) => {
    if (!selectedComplaint) return
    try {
      await attachmentMutation.mutateAsync({
        reportId: report.id,
        complaintId: selectedComplaint.id,
        isApproved: !report.is_approved_attachment,
      })
      // Update local report list
      const updatedReports = (selectedComplaint.reports || []).map((r) =>
        r.id === report.id ? { ...r, is_approved_attachment: !r.is_approved_attachment } : r
      )
      setSelectedComplaint({
        ...selectedComplaint,
        reports: updatedReports,
      })
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle attachment visibility.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A0F16] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#F2E7E1]">
            Complaint Verification & Intake Review
          </h1>
          <p className="text-xs text-[#B08D7A]">
            Vet photographic proof, enforce priority ratings, and approve public map visibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'pending'
                ? 'bg-[#5B1A2A] text-white border border-[#B08D7A]'
                : 'bg-[#2A0F16] text-zinc-400 hover:text-white'
            }`}
          >
            Pending Review ({pendingComplaints.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-[#5B1A2A] text-white border border-[#B08D7A]'
                : 'bg-[#2A0F16] text-zinc-400 hover:text-white'
            }`}
          >
            All Reports ({complaints.length})
          </button>
        </div>
      </div>

      {/* Main Review Layout */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#B08D7A]" />
          <p className="text-xs text-zinc-400">Loading intake inbox...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* List of complaints (5 columns) */}
          <div className="lg:col-span-5 space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {displayed.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#2A0F16] border border-[#5B1A2A]/40 text-center text-zinc-400">
                <FileCheck2 className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-300">All Caught Up!</p>
                <p className="text-xs mt-1">No reports pending administrative verification.</p>
              </div>
            ) : (
              displayed.map((c) => {
                const isSelected = selectedComplaint?.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedComplaint(c)
                      setReviewNotes(c.resolution_notes || '')
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#5B1A2A]/40 border-[#B08D7A] shadow-lg'
                        : 'bg-[#2A0F16] hover:bg-[#2A0F16]/80 border-[#5B1A2A]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-[#B08D7A]">
                        {c.reference_no}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={c.priority} size="sm" />
                        <StatusBadge status={c.status} size="sm" />
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-[#F2E7E1] line-clamp-1">{c.title}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{c.description}</p>

                    <div className="mt-3 pt-2 border-t border-[#5B1A2A]/20 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{c.address || 'Address unlisted'}</span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Verification Detail & Action Drawer (7 columns) */}
          <div className="lg:col-span-7">
            {selectedComplaint ? (
              <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-6 shadow-2xl space-y-5 sticky top-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#5B1A2A]/50 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#B08D7A]">
                      {selectedComplaint.reference_no}
                    </span>
                    <h2 className="text-lg font-black text-[#F2E7E1] mt-0.5">
                      {selectedComplaint.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={selectedComplaint.priority} />
                    <StatusBadge status={selectedComplaint.status} />
                  </div>
                </div>

                {/* Description & Location */}
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed bg-[#0B0B0F]/50 p-3.5 rounded-xl border border-[#5B1A2A]/30">
                    {selectedComplaint.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-[#B08D7A]" />
                    <span>{selectedComplaint.address || 'GPS Location'}</span>
                    <code className="text-[10px] text-zinc-500">
                      ({selectedComplaint.latitude.toFixed(5)}, {selectedComplaint.longitude.toFixed(5)})
                    </code>
                  </div>
                </div>

                {/* Priority Adjuster */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#B08D7A] mb-1.5 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Adjust Operational Priority</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Low', 'Medium', 'High', 'Critical'] as PriorityLevel[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePriorityChange(p)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          selectedComplaint.priority === p
                            ? 'bg-[#5B1A2A] text-white border-[#B08D7A]'
                            : 'bg-[#0B0B0F] text-zinc-400 border-[#5B1A2A]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photographic Evidence & Attachment Approval (Requirement 9) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#B08D7A]">
                      Attached Proof ({selectedComplaint.reports?.length || 0})
                    </label>
                    <span className="text-[10px] text-zinc-400">
                      Req 9: Toggle visibility on public map
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedComplaint.reports?.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl overflow-hidden border border-[#5B1A2A]/50 bg-[#0B0B0F] p-2 space-y-2"
                      >
                        <div className="relative h-36 rounded-lg overflow-hidden border border-[#5B1A2A]/40">
                          <PotholeImage
                            src={r.photo_url}
                            storagePath={r.storage_path}
                            alt={`Hazard evidence for ${selectedComplaint.reference_no}`}
                            allowExpand={true}
                          />
                        </div>
                        <div className="text-[10px] text-zinc-300 line-clamp-1 italic">
                          "{r.description}"
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-[#5B1A2A]/30">
                          <span
                            className={`text-[9px] font-bold uppercase ${
                              r.is_approved_attachment ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {r.is_approved_attachment ? 'Publicly Visible' : 'Hidden'}
                          </span>
                          <button
                            onClick={() => handleToggleAttachmentApproval(r)}
                            disabled={attachmentMutation.isPending}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                              r.is_approved_attachment
                                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                : 'bg-[#5B1A2A] text-white hover:bg-[#5B1A2A]/80'
                            }`}
                          >
                            {r.is_approved_attachment ? (
                              <>
                                <EyeOff className="w-3 h-3" /> Hide
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3" /> Approve for Map
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review Notes */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#B08D7A] mb-1">
                    Administrative Notes / Reason
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Verified from photos; emergency crew dispatched."
                    className="w-full px-3 py-2 bg-[#0B0B0F] border border-[#5B1A2A] rounded-xl text-xs text-[#F2E7E1] focus:outline-none focus:border-[#B08D7A]"
                  />
                </div>

                {/* State Transition Actions (Enforcing Status Transitions per Req 10) */}
                <div className="pt-2 border-t border-[#5B1A2A]/50 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Execute Legal Status Transition
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {/* Move from New -> Under Review */}
                    {selectedComplaint.status === 'New' && (
                      <button
                        onClick={() => handleStatusChange('Under Review')}
                        disabled={statusMutation.isPending}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Start Official Review
                      </button>
                    )}

                    {/* Approve complaint (New or Under Review -> Approved) */}
                    {(selectedComplaint.status === 'New' ||
                      selectedComplaint.status === 'Under Review') && (
                      <button
                        onClick={() => handleStatusChange('Approved')}
                        disabled={statusMutation.isPending}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#5B1A2A] hover:bg-[#B08D7A] hover:text-[#0B0B0F] text-white text-xs font-bold border border-[#B08D7A] transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve for Public Map & Assignment
                      </button>
                    )}

                    {/* Reject complaint */}
                    {['New', 'Under Review', 'Approved'].includes(selectedComplaint.status) && (
                      <button
                        onClick={() => handleStatusChange('Rejected')}
                        disabled={statusMutation.isPending}
                        className="py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold border border-rose-500/40 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject Report
                      </button>
                    )}

                    <Link
                      to={`/complaint/${selectedComplaint.id}`}
                      className="py-2 px-3 rounded-xl bg-[#0B0B0F] text-zinc-300 hover:text-white text-xs font-medium border border-[#5B1A2A] transition"
                    >
                      Full Details & Timeline
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] rounded-3xl bg-[#2A0F16]/50 border border-dashed border-[#5B1A2A]/50 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                <FileCheck2 className="w-12 h-12 mb-2 text-zinc-600" />
                <p className="text-sm font-bold text-zinc-300">Select a Complaint to Review</p>
                <p className="text-xs mt-1">
                  Click any complaint from the list on the left to verify photo proof and execute transitions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
