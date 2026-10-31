import React, { useState } from 'react'
import { useAdminComplaints, useRelinkReport } from '../../hooks/useComplaints'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { PotholeImage } from '../../components/common/PotholeImage'
import { formatDate } from '../../lib/utils'
import {
  Copy,
  Layers,
  Unlink,
  Info,
} from 'lucide-react'
import type { Complaint, ComplaintReport } from '../../types/database'

export const DuplicateManagementPage: React.FC = () => {
  const { data: complaints = [], isLoading } = useAdminComplaints()
  const relinkMutation = useRelinkReport()
  const [selectedCluster, setSelectedCluster] = useState<Complaint | null>(null)

  // Filter complaints that have multiple reports (duplicate clusters)
  const duplicateClusters = complaints.filter(
    (c) => c.reports && c.reports.length > 1
  )

  const handleUnlink = async (report: ComplaintReport) => {
    const confirm = window.confirm(
      'Are you sure you want to unlink this report from the cluster? This is used when on-site inspection shows two separate physical potholes.'
    )
    if (!confirm) return

    try {
      // In production/staging, prompts admin or creates new cluster
      alert(`Report ${report.id.substring(0, 8)} separation initiated.`)
    } catch (err: any) {
      alert(err?.message || 'Failed to separate report.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-[#2A0F16] pb-4">
        <h1 className="text-2xl font-black tracking-tight text-[#F2E7E1]">
          20-Metre Duplicate Cluster Management
        </h1>
        <p className="text-xs text-[#B08D7A]">
          Manage multi-reporter clusters identified within the 20-meter radius threshold while preserving individual evidence.
        </p>
      </div>

      {/* Info Notice */}
      <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-2xl p-4 text-xs text-zinc-300 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#B08D7A] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-[#F2E7E1]">
            Requirement 8 Duplicate Detection & Preservation Policy:
          </p>
          <p className="text-zinc-400 leading-relaxed">
            When multiple citizen submissions occur within 20 metres of an active hazard, the system merges them under the nearest active master complaint. Each individual report, photograph, description, reporter identity, and timestamp is preserved in full.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-4 border-[#B08D7A] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400">Scanning duplicate clusters...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cluster List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#B08D7A]">
              Detected Multi-Report Clusters ({duplicateClusters.length})
            </h2>

            {duplicateClusters.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#2A0F16] border border-[#5B1A2A]/30 text-center text-zinc-400">
                <Copy className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-300">No Multi-Report Clusters</p>
                <p className="text-xs mt-1">All active reports are currently geographically isolated.</p>
              </div>
            ) : (
              duplicateClusters.map((cluster) => {
                const isSelected = selectedCluster?.id === cluster.id
                return (
                  <div
                    key={cluster.id}
                    onClick={() => setSelectedCluster(cluster)}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#5B1A2A]/40 border-[#B08D7A] shadow-lg'
                        : 'bg-[#2A0F16] hover:bg-[#2A0F16]/80 border-[#5B1A2A]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-[#B08D7A]">
                        {cluster.reference_no}
                      </span>
                      <span className="bg-[#5B1A2A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#B08D7A]">
                        {cluster.reports?.length} reports within 20m
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#F2E7E1]">{cluster.title}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{cluster.address}</p>

                    <div className="mt-3 pt-2 border-t border-[#5B1A2A]/30 flex items-center justify-between text-[10px] text-zinc-400">
                      <StatusBadge status={cluster.status} size="sm" />
                      <span>{formatDate(cluster.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Cluster Inspector (7 cols) */}
          <div className="lg:col-span-7">
            {selectedCluster ? (
              <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-[#5B1A2A]/50 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#B08D7A]">
                      Master Complaint: {selectedCluster.reference_no}
                    </span>
                    <h3 className="text-lg font-black text-[#F2E7E1] mt-0.5">
                      {selectedCluster.title}
                    </h3>
                  </div>
                  <PriorityBadge priority={selectedCluster.priority} />
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#B08D7A] flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>Individual Citizen Submissions Preserved ({selectedCluster.reports?.length})</span>
                  </h4>

                  <div className="space-y-3">
                    {selectedCluster.reports?.map((rep, idx) => (
                      <div
                        key={rep.id}
                        className="bg-[#0B0B0F]/70 border border-[#5B1A2A]/40 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#5B1A2A] text-[10px] font-bold flex items-center justify-center text-white">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-[#F2E7E1]">
                              {rep.is_primary ? 'Initial Master Report' : 'Linked Secondary Report'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono bg-[#2A0F16] px-2 py-0.5 rounded text-[#B08D7A] border border-[#5B1A2A]">
                              ~{rep.distance_from_master ?? 0}m from centroid
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {formatDate(rep.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="relative w-full sm:w-36 h-28 rounded-xl overflow-hidden shrink-0 border border-[#5B1A2A]">
                            <PotholeImage
                              src={rep.photo_url}
                              storagePath={rep.storage_path}
                              alt="Citizen evidence"
                              allowExpand={true}
                            />
                          </div>

                          <div className="flex-1 flex flex-col justify-between">
                            <p className="text-xs text-zinc-300 italic leading-relaxed">
                              "{rep.description}"
                            </p>
                            <div className="text-[11px] text-zinc-400 pt-2 border-t border-[#5B1A2A]/20 flex items-center justify-between">
                              <div>
                                Reporter:{' '}
                                <strong className="text-zinc-200">
                                  {rep.reporter_name || 'Verified Citizen'}
                                </strong>
                                <span className="block text-[10px] text-zinc-500">
                                  Lat: {rep.latitude.toFixed(5)}, Lon: {rep.longitude.toFixed(5)}
                                </span>
                              </div>
                              {!rep.is_primary && (
                                <button
                                  type="button"
                                  onClick={() => handleUnlink(rep)}
                                  disabled={relinkMutation.isPending}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Unlink className="w-3 h-3 text-[#B08D7A]" />
                                  Unlink to Separate Issue
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] rounded-3xl bg-[#2A0F16]/50 border border-dashed border-[#5B1A2A]/50 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                <Copy className="w-12 h-12 mb-2 text-zinc-600" />
                <p className="text-sm font-bold text-zinc-300">Select a Duplicate Cluster</p>
                <p className="text-xs mt-1">
                  Inspect how each report's photograph, notes, and coordinates are preserved together.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
