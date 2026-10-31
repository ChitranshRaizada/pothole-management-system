import React from 'react'
import type { PriorityLevel } from '../../types/database'

interface PriorityBadgeProps {
  priority: PriorityLevel
  size?: 'sm' | 'md'
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  const getStyles = () => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-950/90 text-red-200 border border-red-500 animate-pulse font-bold'
      case 'High':
        return 'bg-[#5B1A2A] text-[#F2E7E1] border border-rose-400 font-semibold'
      case 'Medium':
        return 'bg-[#2A0F16] text-[#B08D7A] border border-[#B08D7A]'
      case 'Low':
        return 'bg-zinc-900 text-zinc-300 border border-zinc-700'
      default:
        return 'bg-zinc-800 text-zinc-300'
    }
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md uppercase tracking-wider ${sizeClasses} ${getStyles()}`}
    >
      {priority === 'Critical' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
      )}
      {priority}
    </span>
  )
}

