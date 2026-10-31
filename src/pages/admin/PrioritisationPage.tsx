import React, { useState } from 'react'
import {
  useAdminComplaints,
  useUpdateComplaintPriority,
} from '../../hooks/useComplaints'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { formatDate } from '../../lib/utils'
import { Search, Filter } from 'lucide-react'
import type { PriorityLevel } from '../../types/database'

export const PrioritisationPage: React.FC = () => {
  const { data: complaints = [], isLoading } = useAdminComplaints()
  const priorityMutation = useUpdateComplaintPriority()

  const [filterPriority, setFilterPriority] = useState<string>('All')
  const [search, setSearch] = useState('')

  const activeComplaints = complaints.filter(
    (c) => !['Resolved', 'Closed', 'Rejected'].includes(c.status)
  )

  const filtered = activeComplaints.filter((c) => {
    const matchesPriority = filterPriority === 'All' || c.priority === filterPriority
    const matchesSearch =
      c.reference_no.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
    return matchesPriority && matchesSearch
  })

  const handleSetPriority = async (complaintId: string, priority: PriorityLevel) => {
    try {
      await priorityMutation.mutateAsync({ complaintId, priority })
    } catch (err: any) {
      alert(err?.message || 'Failed to update priority.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A0F16] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#F2E7E1]">
            Hazard Prioritisation & Severity Triage
          </h1>
          <p className="text-xs text-[#B08D7A]">
            Elevate road risks based on traffic density, depth, and emergency danger levels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-[#5B1A2A] px-2.5 py-1 rounded-lg text-white border border-[#B08D7A]/50 font-bold">
            {activeComplaints.length} Active in Triage
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ref, title, or address..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0B0B0F] border border-[#5B1A2A] rounded-xl text-xs text-[#F2E7E1] focus:outline-none focus:border-[#B08D7A]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#B08D7A]" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-[#0B0B0F] border border-[#5B1A2A] text-xs text-[#F2E7E1] rounded-xl px-3 py-1.5 focus:outline-none"
          >
            <option value="All">All Priority Levels</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Prioritisation Table */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-4 border-[#B08D7A] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400">Loading active complaints...</p>
        </div>
      ) : (
        <div className="bg-[#2A0F16] border border-[#5B1A2A]/50 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0B0F]/70 text-[#B08D7A] uppercase tracking-wider text-[10px] border-b border-[#5B1A2A]">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Complaint</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold">Current Priority</th>
                  <th className="py-3.5 px-4 font-bold text-center">Change Priority Rating</th>
                  <th className="py-3.5 px-4 font-bold text-right">Filed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#5B1A2A]/20">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-400">
                      No complaints found matching this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-[#5B1A2A]/10 transition">
                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-mono font-bold text-[#B08D7A] text-[11px]">
                          {item.reference_no}
                        </div>
                        <div className="font-bold text-[#F2E7E1] truncate mt-0.5">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          {item.address || 'Location on map'}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} size="sm" />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <PriorityBadge priority={item.priority} size="sm" />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {(['Low', 'Medium', 'High', 'Critical'] as PriorityLevel[]).map((p) => {
                            const isCurrent = item.priority === p
                            return (
                              <button
                                key={p}
                                onClick={() => handleSetPriority(item.id, p)}
                                disabled={isCurrent || priorityMutation.isPending}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                                  isCurrent
                                    ? p === 'Critical'
                                      ? 'bg-red-950 text-red-200 border-red-500 font-extrabold shadow'
                                      : 'bg-[#5B1A2A] text-white border-[#B08D7A] shadow'
                                    : 'bg-[#0B0B0F] text-zinc-400 border-[#5B1A2A]/60 hover:text-white'
                                }`}
                              >
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right text-zinc-400 whitespace-nowrap font-mono text-[10px]">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
