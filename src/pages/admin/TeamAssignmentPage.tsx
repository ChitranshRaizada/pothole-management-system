import React, { useState } from 'react'
import {
  useAdminComplaints,
  useRepairTeams,
  useAssignTeam,
} from '../../hooks/useComplaints'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { formatDate } from '../../lib/utils'
import {
  Users,
  Wrench,
  CheckCircle2,
  Phone,
  Loader2,
} from 'lucide-react'
import type { Complaint } from '../../types/database'

export const TeamAssignmentPage: React.FC = () => {
  const { data: complaints = [] } = useAdminComplaints()
  const { data: teams = [] } = useRepairTeams()
  const assignMutation = useAssignTeam()

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [assignSuccess, setAssignSuccess] = useState(false)

  // Filter complaints ready for assignment: Approved or already Assigned
  const assignableComplaints = complaints.filter(
    (c) => c.status === 'Approved' || c.status === 'Assigned' || c.status === 'Under Review'
  )

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedComplaint || !selectedTeamId) return

    try {
      await assignMutation.mutateAsync({
        complaintId: selectedComplaint.id,
        teamId: selectedTeamId,
        estimatedDate: targetDate || undefined,
      })
      setAssignSuccess(true)
      setTimeout(() => {
        setAssignSuccess(false)
        setSelectedComplaint(null)
      }, 1500)
    } catch (err: any) {
      alert(err?.message || 'Assignment failed.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A0F16] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#F2E7E1]">
            Repair Squad Dispatch & Assignments
          </h1>
          <p className="text-xs text-[#B08D7A]">
            Dispatch specialized municipal asphalt squads to approved and critical road hazards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-[#2A0F16] px-3 py-1 rounded-xl text-[#F2E7E1] border border-[#5B1A2A]">
            {teams.length} Deployed Squads
          </span>
        </div>
      </div>

      {/* Repair Squads Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teams.map((t) => (
          <div
            key={t.id}
            className="p-4 rounded-2xl bg-[#2A0F16] border border-[#5B1A2A]/40 shadow-md space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#F2E7E1]">{t.name}</span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  t.status === 'active'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                }`}
              >
                {t.status}
              </span>
            </div>

            <p className="text-xs text-zinc-300">
              Zone: <strong className="text-[#B08D7A]">{t.zone}</strong>
            </p>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-[#5B1A2A]/30">
              <span>Leader: {t.leader_name}</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-zinc-500" />
                {t.contact_number}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Assignment Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Complaints Ready for Squads (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#B08D7A]">
            Complaints Awaiting Crew Dispatch ({assignableComplaints.length})
          </h2>

          {assignableComplaints.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#2A0F16] border border-[#5B1A2A]/30 text-center text-zinc-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-semibold text-zinc-300">No Pending Dispatches</p>
              <p className="text-xs mt-1">
                All approved complaints have been allocated to active repair crews.
              </p>
            </div>
          ) : (
            assignableComplaints.map((item) => {
              const isSelected = selectedComplaint?.id === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedComplaint(item)
                    setSelectedTeamId(item.assigned_team_id || '')
                    setTargetDate(item.estimated_repair_date || '')
                  }}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#5B1A2A]/40 border-[#B08D7A] shadow-lg'
                      : 'bg-[#2A0F16] hover:bg-[#2A0F16]/80 border-[#5B1A2A]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-[#B08D7A]">
                      {item.reference_no}
                    </span>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} size="sm" />
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-[#F2E7E1]">{item.title}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{item.address}</p>

                  <div className="mt-3 pt-2 border-t border-[#5B1A2A]/30 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      Squad:{' '}
                      <strong className="text-zinc-200">
                        {item.assigned_team?.name || 'Unassigned'}
                      </strong>
                    </span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Dispatch Form Drawer (5 cols) */}
        <div className="lg:col-span-5">
          {selectedComplaint ? (
            <form
              onSubmit={handleAssign}
              className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-6 shadow-2xl space-y-5 sticky top-6"
            >
              <div className="border-b border-[#5B1A2A]/50 pb-3">
                <span className="text-xs font-mono font-bold text-[#B08D7A]">
                  Dispatching for {selectedComplaint.reference_no}
                </span>
                <h3 className="text-base font-black text-[#F2E7E1] mt-0.5">
                  {selectedComplaint.title}
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B08D7A] mb-1.5">
                  Select Repair Squad <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0B0B0F] border border-[#5B1A2A] rounded-xl text-xs sm:text-sm text-[#F2E7E1] focus:outline-none focus:border-[#B08D7A]"
                >
                  <option value="">-- Choose Assigned Repair Unit --</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.zone}) - {team.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B08D7A] mb-1.5">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0B0B0F] border border-[#5B1A2A] rounded-xl text-xs sm:text-sm text-[#F2E7E1] focus:outline-none focus:border-[#B08D7A]"
                />
              </div>

              {assignSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Squad successfully assigned! Status transitioned to Assigned.
                </div>
              )}

              <button
                type="submit"
                disabled={assignMutation.isPending || !selectedTeamId}
                className="w-full py-3 px-4 rounded-xl bg-[#5B1A2A] hover:bg-[#5B1A2A]/90 text-white font-bold text-xs sm:text-sm border border-[#B08D7A] transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#B08D7A]" />
                    <span>Dispatching Crew...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 text-[#B08D7A]" />
                    <span>Confirm Dispatch & Set Status to Assigned</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="h-full min-h-[300px] rounded-3xl bg-[#2A0F16]/50 border border-dashed border-[#5B1A2A]/50 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <Users className="w-12 h-12 mb-2 text-zinc-600" />
              <p className="text-sm font-bold text-zinc-300">Select a Complaint</p>
              <p className="text-xs mt-1">
                Choose an approved complaint to allocate an active repair squad and target date.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
