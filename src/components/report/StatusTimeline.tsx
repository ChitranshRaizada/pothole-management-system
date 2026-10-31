import React from 'react'
import type { ComplaintStatusHistory, PotholeStatus } from '../../types/database'
import { formatDate } from '../../lib/utils'
import { Clock, XCircle, ArrowRight } from 'lucide-react'

interface StatusTimelineProps {
  currentStatus: PotholeStatus
  history: ComplaintStatusHistory[]
}

const ORDERED_STAGES: PotholeStatus[] = [
  'New',
  'Under Review',
  'Approved',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
]

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ currentStatus, history }) => {
  const isRejected = currentStatus === 'Rejected'
  const currentIndex = ORDERED_STAGES.indexOf(currentStatus)

  return (
    <div className="space-y-6">
      {/* High-level progress tracker */}
      {!isRejected ? (
        <div className="bg-[#2A0F16] border border-[#5B1A2A] rounded-2xl p-4 shadow-md">
          <div className="relative flex items-center justify-between">
            {/* Background Line */}
            <div className="absolute left-2 right-2 top-3 h-1 bg-[#0B0B0F] z-0" />
            <div
              className="absolute left-2 top-3 h-1 bg-[#B08D7A] z-0 transition-all duration-500"
              style={{
                width: `${Math.max(0, (currentIndex / (ORDERED_STAGES.length - 1)) * 100)}%`,
              }}
            />

            {ORDERED_STAGES.map((stage, idx) => {
              const isPast = idx < currentIndex
              const isCurrent = idx === currentIndex

              return (
                <div key={stage} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                      isCurrent
                        ? 'bg-[#5B1A2A] border-[#B08D7A] text-[#F2E7E1] scale-125 shadow-lg'
                        : isPast
                        ? 'bg-[#B08D7A] border-[#F2E7E1] text-[#0B0B0F]'
                        : 'bg-[#0B0B0F] border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`hidden sm:block text-[10px] mt-2 font-medium tracking-tight text-center max-w-[65px] ${
                      isCurrent
                        ? 'text-[#F2E7E1] font-bold'
                        : isPast
                        ? 'text-[#B08D7A]'
                        : 'text-zinc-500'
                    }`}
                  >
                    {stage}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/60 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-rose-200">Complaint Rejected</h4>
            <p className="text-xs text-rose-300">
              The municipal authority reviewed this report and marked it as rejected.
            </p>
          </div>
        </div>
      )}

      {/* Detailed Audit Trail History */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#B08D7A]">
          Official Status Log & Notes
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No transition history logged yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#5B1A2A]">
            {history.map((item) => (
              <div key={item.id} className="relative group">
                {/* Bullet */}
                <div className="absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full bg-[#5B1A2A] border-2 border-[#B08D7A]" />

                <div className="bg-[#2A0F16] border border-[#5B1A2A]/40 rounded-xl p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F2E7E1]">
                      {item.from_status ? (
                        <>
                          <span className="text-zinc-400">{item.from_status}</span>
                          <ArrowRight className="w-3 h-3 text-[#B08D7A]" />
                        </>
                      ) : null}
                      <span className="text-[#B08D7A]">{item.to_status}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed bg-[#0B0B0F]/40 p-2 rounded-lg border border-[#5B1A2A]/20">
                      {item.notes}
                    </p>
                  )}

                  {item.changer && (
                    <div className="mt-2 text-[10px] text-zinc-400">
                      Updated by:{' '}
                      <span className="text-zinc-300 font-medium">
                        {item.changer.full_name || item.changer.email} ({item.changer.role})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
