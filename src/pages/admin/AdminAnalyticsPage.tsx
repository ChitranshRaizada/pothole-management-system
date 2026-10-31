import React, { useMemo } from 'react'
import { useAdminComplaints } from '../../hooks/useComplaints'
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  TrendingUp,
  ShieldAlert,
  Calendar,
} from 'lucide-react'

export const AdminAnalyticsPage: React.FC = () => {
  const { data: complaints = [], isLoading } = useAdminComplaints()

  // Compute live metrics dynamically from Supabase database records
  const stats = useMemo(() => {
    const total = complaints.length
    const active = complaints.filter(
      (c) => !['Resolved', 'Closed', 'Rejected'].includes(c.status)
    ).length
    const newReports = complaints.filter((c) => c.status === 'New').length
    const underReview = complaints.filter((c) => c.status === 'Under Review').length
    const approved = complaints.filter((c) => c.status === 'Approved').length
    const assigned = complaints.filter((c) => c.status === 'Assigned').length
    const inProgress = complaints.filter((c) => c.status === 'In Progress').length
    const resolved = complaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length
    const rejected = complaints.filter((c) => c.status === 'Rejected').length

    // Duplicate clusters: master complaints with > 1 report
    const duplicateClusters = complaints.filter((c) => (c.reports_count ?? 0) > 1).length
    const totalIndividualReports = complaints.reduce(
      (acc, c) => acc + (c.reports_count ?? 1),
      0
    )

    // Priority breakdown
    const critical = complaints.filter((c) => c.priority === 'Critical').length
    const high = complaints.filter((c) => c.priority === 'High').length
    const medium = complaints.filter((c) => c.priority === 'Medium').length
    const low = complaints.filter((c) => c.priority === 'Low').length

    // Turnaround time calculation for resolved complaints (hours)
    const resolvedWithDates = complaints.filter((c) => c.resolved_at && c.created_at)
    let avgHours = 0
    if (resolvedWithDates.length > 0) {
      const totalHours = resolvedWithDates.reduce((acc, c) => {
        const diffMs = new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()
        return acc + diffMs / (1000 * 60 * 60)
      }, 0)
      avgHours = Math.round((totalHours / resolvedWithDates.length) * 10) / 10
    }

    return {
      total,
      active,
      newReports,
      underReview,
      approved,
      assigned,
      inProgress,
      resolved,
      rejected,
      duplicateClusters,
      totalIndividualReports,
      critical,
      high,
      medium,
      low,
      avgHours,
    }
  }, [complaints])

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[#B08D7A] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Computing analytics from database...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A0F16] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#F2E7E1]">
            Executive Operations & Analytics
          </h1>
          <p className="text-xs text-[#B08D7A]">
            Real-time telemetry, 20m duplicate cluster metrics, and resolution velocity.
          </p>
        </div>
        <div className="text-xs text-zinc-400 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#B08D7A]" />
          <span>Live Synchronized DB</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Total Road Hazards
            </span>
            <BarChart3 className="w-4 h-4 text-[#B08D7A]" />
          </div>
          <div className="text-3xl font-black text-[#F2E7E1] mt-2">{stats.total}</div>
          <p className="text-[10px] text-zinc-400 mt-1">
            {stats.totalIndividualReports} individual citizen submissions
          </p>
        </div>

        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Active Workflow
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-[#F2E7E1] mt-2">{stats.active}</div>
          <p className="text-[10px] text-zinc-400 mt-1">
            {stats.newReports} new / {stats.inProgress} in progress
          </p>
        </div>

        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Resolved & Repaired
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-300 mt-2">{stats.resolved}</div>
          <p className="text-[10px] text-zinc-400 mt-1">
            Avg velocity: {stats.avgHours > 0 ? `${stats.avgHours} hours` : 'Pending data'}
          </p>
        </div>

        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B08D7A]">
              20m Duplicate Clusters
            </span>
            <Copy className="w-4 h-4 text-[#B08D7A]" />
          </div>
          <div className="text-3xl font-black text-[#B08D7A] mt-2">
            {stats.duplicateClusters}
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">
            Merged reports within 20m radius
          </p>
        </div>
      </div>

      {/* Breakdown Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Pipeline Breakdown */}
        <div className="bg-[#2A0F16] border border-[#5B1A2A]/50 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#B08D7A] flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Workflow Status Pipeline</span>
          </h2>

          <div className="space-y-2.5">
            {[
              { label: 'New Submissions', count: stats.newReports, color: 'bg-[#5B1A2A]' },
              { label: 'Under Review', count: stats.underReview, color: 'bg-[#5B1A2A]/80' },
              { label: 'Approved', count: stats.approved, color: 'bg-[#B08D7A]' },
              { label: 'Assigned to Teams', count: stats.assigned, color: 'bg-[#B08D7A]/80' },
              { label: 'In Progress (Repair)', count: stats.inProgress, color: 'bg-amber-500' },
              { label: 'Resolved', count: stats.resolved, color: 'bg-emerald-500' },
              { label: 'Rejected', count: stats.rejected, color: 'bg-rose-500' },
            ].map((item) => {
              const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{item.label}</span>
                    <span className="font-mono text-zinc-200">
                      <strong>{item.count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#0B0B0F] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Priority Severity Breakdown */}
        <div className="bg-[#2A0F16] border border-[#5B1A2A]/50 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#B08D7A] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Hazard Priority Severity Distribution</span>
          </h2>

          <div className="space-y-3">
            {[
              {
                label: 'Critical Hazard (Vehicle Damage / Accidents)',
                count: stats.critical,
                badge: 'bg-red-950 text-red-200 border-red-500',
              },
              {
                label: 'High Severity (Major Thoroughfares)',
                count: stats.high,
                badge: 'bg-[#5B1A2A] text-rose-200 border-rose-400',
              },
              {
                label: 'Medium Severity (Standard Secondary Roads)',
                count: stats.medium,
                badge: 'bg-[#2A0F16] text-[#B08D7A] border-[#B08D7A]',
              },
              {
                label: 'Low Severity (Minor Surface Wear)',
                count: stats.low,
                badge: 'bg-[#0B0B0F] text-zinc-400 border-zinc-700',
              },
            ].map((p) => {
              const pct = stats.total > 0 ? Math.round((p.count / stats.total) * 100) : 0
              return (
                <div
                  key={p.label}
                  className="p-3 rounded-xl bg-[#0B0B0F]/50 border border-[#5B1A2A]/30 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#F2E7E1]">{p.label}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{pct}% of reported hazards</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${p.badge}`}
                  >
                    {p.count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
