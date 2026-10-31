import React from 'react'
import type { PotholeStatus } from '../../types/database'

interface StatusBadgeProps {
  status: PotholeStatus
  size?: 'sm' | 'md' | 'lg'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStyles = () => {
    switch (status) {
      case 'New':
        return 'bg-[#2A0F16] text-[#F2E7E1] border border-[#B08D7A]/40'
      case 'Under Review':
        return 'bg-[#5B1A2A]/40 text-[#F2E7E1] border border-[#5B1A2A]'
      case 'Approved':
        return 'bg-[#5B1A2A] text-[#F2E7E1] border border-[#B08D7A]'
      case 'Assigned':
        return 'bg-[#B08D7A]/30 text-[#F2E7E1] border border-[#B08D7A]'
      case 'In Progress':
        return 'bg-[#B08D7A] text-[#0B0B0F] font-semibold border border-[#F2E7E1]'
      case 'Resolved':
        return 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/50'
      case 'Closed':
        return 'bg-zinc-800 text-zinc-300 border border-zinc-600'
      case 'Rejected':
        return 'bg-rose-950/80 text-rose-200 border border-rose-500/50'
      default:
        return 'bg-zinc-800 text-zinc-300'
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs md:text-sm px-2.5 py-1',
    lg: 'text-sm md:text-base px-3.5 py-1.5',
  }[size]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide shadow-sm transition-all ${sizeClasses} ${getStyles()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  )
}

