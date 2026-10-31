import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Map, PlusCircle, ClipboardList, User } from 'lucide-react'

export const MobileBottomNav: React.FC = () => {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0B0F]/95 backdrop-blur-lg border-t border-[#2A0F16] px-2 py-1 shadow-2xl">
      <nav aria-label="Mobile Bottom Navigation" className="flex items-center justify-around">
        <Link
          to="/"
          className={`flex flex-col items-center py-2 px-3 rounded-xl transition ${
            isActive('/') ? 'text-[#F2E7E1] font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Map className={`w-5 h-5 ${isActive('/') ? 'text-[#B08D7A]' : ''}`} />
          <span className="text-[10px] mt-1">Map</span>
        </Link>

        {/* Highlighted roadside Action Button */}
        <Link
          to="/report"
          className="flex flex-col items-center -mt-4 group"
        >
          <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#5B1A2A] to-[#B08D7A] p-0.5 shadow-lg group-active:scale-95 transition-transform">
            <div className="w-full h-full rounded-full bg-[#2A0F16] flex items-center justify-center text-[#F2E7E1]">
              <PlusCircle className="w-7 h-7 text-[#F2E7E1]" />
            </div>
          </div>
          <span className="text-[10px] mt-0.5 font-bold text-[#F2E7E1]">Report</span>
        </Link>

        <Link
          to="/my-complaints"
          className={`flex flex-col items-center py-2 px-3 rounded-xl transition ${
            isActive('/my-complaints') ? 'text-[#F2E7E1] font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ClipboardList className={`w-5 h-5 ${isActive('/my-complaints') ? 'text-[#B08D7A]' : ''}`} />
          <span className="text-[10px] mt-1">My Reports</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center py-2 px-3 rounded-xl transition ${
            isActive('/profile') ? 'text-[#F2E7E1] font-bold' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className={`w-5 h-5 ${isActive('/profile') ? 'text-[#B08D7A]' : ''}`} />
          <span className="text-[10px] mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  )
}

