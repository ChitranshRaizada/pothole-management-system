import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from '../common/Navbar'
import { RoadsideAlert } from '../common/RoadsideAlert'
import { MobileBottomNav } from '../common/MobileBottomNav'

export const CitizenLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F2E7E1] text-[#0B0B0F] flex flex-col font-sans selection:bg-[#5B1A2A] selection:text-[#F2E7E1]">
      <RoadsideAlert />
      <Navbar />

      <main className="flex-1 pb-16 md:pb-8">
        <Outlet />
      </main>

      <MobileBottomNav />

      {/* Desktop Footer */}
      <footer className="hidden md:block bg-[#F2E7E1] border-t border-[#B08D7A]/25 py-6 text-center text-xs text-[#2A0F16]/70">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#2A0F16]">Civic Pulse Portal</span>
            <span className="text-[#B08D7A]/60">|</span>
            <span className="text-[#5B1A2A] font-medium">Municipal Citizen Issue & Infrastructure Management</span>
          </div>
          <div className="text-zinc-500 text-xs font-normal">
            Integrated with Supabase PostgreSQL, Storage, Leaflet & 20m Duplicate Clustering
          </div>
        </div>
      </footer>
    </div>
  )
}

