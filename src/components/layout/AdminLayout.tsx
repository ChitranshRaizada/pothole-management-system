import React, { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  BarChart3,
  CheckSquare,
  Copy,
  Sliders,
  Users,
  Wrench,
  ArrowLeft,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react'

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { name: 'Analytics & Overview', path: '/admin', icon: BarChart3 },
    { name: 'Complaint Review', path: '/admin/review', icon: CheckSquare },
    { name: 'Duplicate Clusters (20m)', path: '/admin/duplicates', icon: Copy },
    { name: 'Prioritisation', path: '/admin/prioritisation', icon: Sliders },
    { name: 'Team Assignments', path: '/admin/teams', icon: Users },
    { name: 'Repair Progress & Status', path: '/admin/progress', icon: Wrench },
  ]

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-[#F2E7E1] flex flex-col md:flex-row font-sans selection:bg-[#5B1A2A] selection:text-[#F2E7E1]">
      {/* Mobile Top Header for Admin */}
      <header className="md:hidden bg-[#2A0F16] border-b border-[#5B1A2A] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#5B1A2A] text-[#F2E7E1] border border-[#B08D7A]/40">
            <Shield className="w-5 h-5 text-[#B08D7A]" />
          </div>
          <span className="font-bold text-sm tracking-tight text-[#F2E7E1]">Civic Pulse Admin</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl bg-[#0B0B0F] text-zinc-300"
          aria-label="Toggle admin sidebar"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Admin Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 w-64 bg-[#2A0F16] border-r border-[#5B1A2A]/60 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-3 pb-6 border-b border-[#5B1A2A]">
            <div className="w-10 h-10 rounded-xl bg-[#5B1A2A] border border-[#B08D7A]/50 flex items-center justify-center text-[#F2E7E1] shadow-md">
              <Shield className="w-5 h-5 text-[#B08D7A]" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-[#F2E7E1]">Civic Pulse</h1>
              <p className="text-[11px] font-bold text-[#B08D7A] uppercase tracking-wider">
                Admin Console
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                    active
                      ? 'bg-[#5B1A2A] text-white border border-[#B08D7A]/60 shadow-md'
                      : 'text-zinc-300 hover:text-white hover:bg-[#5B1A2A]/30'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-[#B08D7A]' : 'text-zinc-400'}`}
                  />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer info & switch back to citizen portal */}
        <div className="p-4 border-t border-[#5B1A2A] bg-[#0B0B0F]/40 space-y-3">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-[#5B1A2A] border border-[#B08D7A] flex items-center justify-center text-xs font-bold text-[#F2E7E1]">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#F2E7E1] truncate">
                {profile?.full_name || 'Admin Officer'}
              </p>
              <p className="text-[10px] text-[#B08D7A] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Server Verified
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#2A0F16] hover:bg-[#5B1A2A] text-xs font-semibold text-zinc-300 hover:text-white border border-[#B08D7A]/30 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Citizen Portal
          </Link>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-transparent hover:bg-rose-950/40 text-xs text-rose-300 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay backdrop for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
        />
      )}

      {/* Main Admin View Content */}
      <main className="flex-1 bg-[#0B0B0F] p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

