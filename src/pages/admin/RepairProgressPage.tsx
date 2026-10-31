import React, { useState } from 'react'
import {
  useAdminComplaints,
  useUpdateComplaintStatus,
  useAddProgressNote,
} from '../../hooks/useComplaints'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { VALID_STATUS_TRANSITIONS } from '../../types/database'
import { formatDate } from '../../lib/utils'
import {
  Wrench,
  CheckCircle,
  PlusCircle,
  Camera,
  Loader2,
} from 'lucide-react'
import type { Complaint, PotholeStatus } from '../../types/database'

export const RepairProgressPage: React.FC = () => {
  const { user } = useAuth()
  const { data: complaints = [], isLoading } = useAdminComplaints()
  const statusMutation = useUpdateComplaintStatus()
  const noteMutation = useAddProgressNote()

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [transitionNotes, setTransitionNotes] = useState('')

  // New progress note inputs
  const [progressText, setProgressText] = useState('')
  const [progressPhoto, setProgressPhoto] = useState<File | null>(null)
  const [progressPhotoPreview, setProgressPhotoPreview] = useState<string | null>(null)

  const activeInField = complaints.filter((c) =>
    ['Assigned', 'In Progress', 'Resolved'].includes(c.status)
  )

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProgressPhoto(file)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setProgressPhotoPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleStatusTransition = async (nextStatus: PotholeStatus) => {
    if (!selectedComplaint) return

    try {
      await statusMutation.mutateAsync({
        complaintId: selectedComplaint.id,
        currentStatus: selectedComplaint.status,
        newStatus: nextStatus,
        notes: transitionNotes || `Status updated to ${nextStatus}`,
      })

      setSelectedComplaint({
        ...selectedComplaint,
        status: nextStatus,
      })
      setTransitionNotes('')
    } catch (err: any) {
      alert(err?.message || 'Status transition failed.')
    }
  }

  const handleAddProgressNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedComplaint || !progressText.trim() || !user) return

    try {
      await noteMutation.mutateAsync({
        complaintId: selectedComplaint.id,
        authorId: user.id,
        note: progressText,
        photoFile: progressPhoto,
      })

      setProgressText('')
      setProgressPhoto(null)
      setProgressPhotoPreview(null)
      alert('Repair progress note recorded!')
    } catch (err: any) {
      alert(err?.message || 'Failed to submit progress note.')
    }
  }

  const allowedTransitions = selectedComplaint
    ? VALID_STATUS_TRANSITIONS[selectedComplaint.status] || []
    : []

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A0F16] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#F2E7E1]">
            Field Repair Execution & Status Lifecycle
          </h1>
          <p className="text-xs text-[#B08D7A]">
            Log asphalt filling progress, upload completion photos, and enforce state transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-[#5B1A2A] px-3 py-1 rounded-xl text-white border border-[#B08D7A]/50 font-bold">
            {activeInField.length} Active Field Tasks
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#B08D7A]" />
          <p className="text-xs text-zinc-400">Loading active repairs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Complaints list (5 cols) */}
          <div className="lg:col-span-5 space-y-3 max-h-[750px] overflow-y-auto pr-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#B08D7A]">
              Active Field Work Orders ({activeInField.length})
            </h2>

            {activeInField.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#2A0F16] border border-[#5B1A2A]/30 text-center text-zinc-400">
                <Wrench className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-300">No Active Field Work Orders</p>
                <p className="text-xs mt-1">Assign teams from the Squad Dispatch page to begin.</p>
              </div>
            ) : (
              activeInField.map((item) => {
                const isSelected = selectedComplaint?.id === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedComplaint(item)}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#5B1A2A]/40 border-[#B08D7A] shadow-lg'
                        : 'bg-[#2A0F16] hover:bg-[#2A0F16]/80 border-[#5B1A2A]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-[#B08D7A]">
                        {item.reference_no}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={item.priority} size="sm" />
                        <StatusBadge status={item.status} size="sm" />
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-[#F2E7E1]">{item.title}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{item.address}</p>

                    <div className="mt-3 pt-2 border-t border-[#5B1A2A]/30 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Squad: {item.assigned_team?.name || 'Assigned Crew'}</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Action Center (7 cols) */}
          <div className="lg:col-span-7">
            {selectedComplaint ? (
              <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-6 shadow-2xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#5B1A2A]/50 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#B08D7A]">
                      {selectedComplaint.reference_no}
                    </span>
                    <h3 className="text-lg font-black text-[#F2E7E1] mt-0.5">
                      {selectedComplaint.title}
                    </h3>
                  </div>
                  <StatusBadge status={selectedComplaint.status} />
                </div>

                {/* State Machine Transition Enforcer (Requirement 10) */}
                <div className="bg-[#0B0B0F]/60 p-4 rounded-2xl border border-[#5B1A2A]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#B08D7A]">
                      Enforced Status Transition
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Current: <strong>{selectedComplaint.status}</strong>
                    </span>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={transitionNotes}
                      onChange={(e) => setTransitionNotes(e.target.value)}
                      placeholder="Notes for status transition (e.g. Surface compacted and sealed)..."
                      className="w-full px-3 py-2 bg-[#2A0F16] border border-[#5B1A2A] rounded-xl text-xs text-[#F2E7E1] placeholder-zinc-500 focus:outline-none focus:border-[#B08D7A]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {allowedTransitions.length === 0 ? (
                      <span className="text-xs text-zinc-500 italic">
                        Terminal state reached (No further transitions allowed).
                      </span>
                    ) : (
                      allowedTransitions.map((nextStatus) => {
                        const isResolved = nextStatus === 'Resolved'
                        const isClosed = nextStatus === 'Closed'
                        return (
                          <button
                            key={nextStatus}
                            onClick={() => handleStatusTransition(nextStatus)}
                            disabled={statusMutation.isPending}
                            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                              isResolved
                                ? 'bg-emerald-950 text-emerald-200 border border-emerald-500 hover:bg-emerald-900'
                                : isClosed
                                ? 'bg-zinc-800 text-zinc-200 border border-zinc-600 hover:bg-zinc-700'
                                : 'bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-white border border-[#B08D7A]'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Transition to: {nextStatus}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Progress Note & Photo Upload Form */}
                <form
                  onSubmit={handleAddProgressNote}
                  className="bg-[#0B0B0F]/60 p-4 rounded-2xl border border-[#5B1A2A]/40 space-y-3"
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#B08D7A]">
                    Record Repair Progress Note & Photo Proof
                  </label>

                  <textarea
                    required
                    rows={2}
                    value={progressText}
                    onChange={(e) => setProgressText(e.target.value)}
                    placeholder="Enter crew work log, materials used (e.g. 50kg hot asphalt mix), weather conditions..."
                    className="w-full px-3 py-2 bg-[#2A0F16] border border-[#5B1A2A] rounded-xl text-xs text-[#F2E7E1] placeholder-zinc-500 focus:outline-none focus:border-[#B08D7A]"
                  />

                  {/* Optional Completion Photo */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2A0F16] hover:bg-[#5B1A2A] text-xs font-semibold text-zinc-300 hover:text-white border border-[#5B1A2A] cursor-pointer transition">
                      <Camera className="w-4 h-4 text-[#B08D7A]" />
                      <span>{progressPhoto ? 'Change Photo' : 'Attach Repair Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>

                    {progressPhotoPreview && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Proof attached</span>
                      </div>
                    )}
                  </div>

                  {progressPhotoPreview && (
                    <img
                      src={progressPhotoPreview}
                      alt="Repair Preview"
                      className="w-32 h-20 rounded-lg object-cover border border-[#5B1A2A]"
                    />
                  )}

                  <button
                    type="submit"
                    disabled={noteMutation.isPending || !progressText.trim()}
                    className="py-2 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {noteMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Update...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3.5 h-3.5 text-[#B08D7A]" />
                        <span>Log Progress Note</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="h-full min-h-[300px] rounded-3xl bg-[#2A0F16]/50 border border-dashed border-[#5B1A2A]/50 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                <Wrench className="w-12 h-12 mb-2 text-zinc-600" />
                <p className="text-sm font-bold text-zinc-300">Select an Active Repair Order</p>
                <p className="text-xs mt-1">
                  Enforce legal status transitions and record crew work updates.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
