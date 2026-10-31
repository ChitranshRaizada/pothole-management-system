import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export const RoadsideAlert: React.FC = () => {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <aside
      aria-label="Roadside Safety Notice"
      className="bg-[#2A0F16] border-b border-[#5B1A2A] text-[#F2E7E1] px-4 py-2 text-xs md:text-xs font-medium flex items-center justify-between shadow-xs"
    >
      <div className="flex items-center gap-2 max-w-5xl mx-auto">
        <AlertTriangle className="w-3.5 h-3.5 text-[#B08D7A] shrink-0" />
        <span className="text-[#F2E7E1]">
          <strong className="text-[#B08D7A] font-semibold">Roadside Safety Notice:</strong> Always park safely away from traffic before capturing photos. Never use your phone while operating a vehicle.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:text-[#B08D7A] transition text-zinc-400 hover:bg-[#5B1A2A]/40 rounded cursor-pointer"
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  )
}

