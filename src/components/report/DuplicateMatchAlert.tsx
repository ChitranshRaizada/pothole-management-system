import React from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import type { DuplicateMatchResult } from '../../types/database'
import { StatusBadge } from '../common/StatusBadge'

interface DuplicateMatchAlertProps {
  match: DuplicateMatchResult
  isLinked: boolean
  onToggleLink: (link: boolean) => void
}

export const DuplicateMatchAlert: React.FC<DuplicateMatchAlertProps> = ({
  match,
  isLinked,
  onToggleLink,
}) => {
  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-white border-2 border-[#B08D7A]/50 shadow-sm text-[#0B0B0F] animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#5B1A2A]/10 text-[#5B1A2A] shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-[#5B1A2A]" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B1A2A]">
              Active Road Hazard Detected Nearby
            </span>
            <span className="text-xs font-mono font-bold bg-[#FAF5F2] border border-[#B08D7A]/30 px-2.5 py-0.5 rounded-lg text-[#2A0F16]">
              {match.distance_meters}m away
            </span>
          </div>

          <p className="text-sm font-bold text-[#2A0F16]">{match.title}</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Ref: <span className="font-mono text-[#5B1A2A] font-semibold">{match.reference_no}</span>
            {match.address ? ` • ${match.address}` : ''}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <StatusBadge status={match.status} size="sm" />
            <span className="text-[11px] text-zinc-500">
              ({match.reports_count} {match.reports_count === 1 ? 'citizen report' : 'reports'} on file)
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#B08D7A]/20 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => onToggleLink(true)}
              className={`flex-1 py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isLinked
                  ? 'bg-[#5B1A2A] text-white shadow-xs'
                  : 'bg-[#FAF5F2] text-[#2A0F16] border border-[#B08D7A]/30 hover:border-[#5B1A2A]'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Link Photo to This Cluster (Recommended)
            </button>
            <button
              type="button"
              onClick={() => onToggleLink(false)}
              className={`py-2 px-3.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                !isLinked
                  ? 'bg-[#2A0F16] text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:text-[#2A0F16]'
              }`}
            >
              File Separate Master Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
