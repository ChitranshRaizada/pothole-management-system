import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AuthModal } from '../auth/AuthModal'
import { CivicPulseLogo } from './CivicPulseLogo'
import {
  PlusCircle,
  Shield,
  LogIn,
  LogOut,
  Menu,
  X,
  AlertCircle,
  Map as MapIcon,
  ClipboardList,
} from 'lucide-react'

export const Navbar: React.FC = () => {
  const { user, profile, isAdmin, signOut, isConfigured } = useAuth()
  const location = useLocation()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F2E7E1] border-b border-[#B08D7A]/25 text-[#0B0B0F] shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <Link to="/" className="group" aria-label="Civic Pulse Home">
              <CivicPulseLogo size={36} showText variant="light" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive('/')
                    ? 'bg-[#2A0F16] text-[#F2E7E1] shadow-xs border border-[#5B1A2A]'
                    : 'text-[#2A0F16]/80 hover:text-[#2A0F16] hover:bg-[#B08D7A]/15'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 text-[#B08D7A]" />
                Public Map
              </Link>

              <Link
                to="/report"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive('/report')
                    ? 'bg-[#2A0F16] text-[#F2E7E1] shadow-xs'
                    : 'text-[#2A0F16]/80 hover:text-[#2A0F16] hover:bg-[#B08D7A]/15'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#2A0F16]/70" />
                Report Issue
              </Link>

              {user && (
                <Link
                  to="/my-complaints"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive('/my-complaints')
                      ? 'bg-[#2A0F16] text-[#F2E7E1] shadow-xs'
                      : 'text-[#2A0F16]/80 hover:text-[#2A0F16] hover:bg-[#B08D7A]/15'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5 text-[#2A0F16]/70" />
                  My Complaints
                </Link>
              )}

              {/* Administrator Portal Button: Strictly hidden until verified admin login */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive('/admin') || location.pathname.startsWith('/admin')
                      ? 'bg-[#2A0F16] text-[#F2E7E1]'
                      : 'text-[#5B1A2A] hover:bg-[#5B1A2A]/10 border border-[#5B1A2A]/30'
                  }`}
                  title="Administrator Portal"
                >
                  <Shield className="w-3.5 h-3.5 text-[#B08D7A]" />
                  Admin Portal
                </Link>
              )}
            </nav>

            {/* User Profile / Auth Area */}
            <div className="hidden md:flex items-center gap-3">
              {!isConfigured && (
                <span
                  title="Supabase configuration missing in .env"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-100 text-amber-800 border border-amber-300"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Setup Needed
                </span>
              )}

              {user ? (
                <div className="flex items-center gap-3 pl-3 border-l border-[#B08D7A]/30">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 group hover:opacity-90 transition"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Avatar"
                        className="w-7 h-7 rounded-full border border-[#B08D7A]/50 object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#5B1A2A] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <span className="text-xs font-medium text-[#2A0F16] max-w-[150px] truncate">
                      {profile?.full_name || user.email?.split('@')[0]}
                    </span>
                  </Link>

                  <button
                    onClick={() => signOut()}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-[#5B1A2A] hover:bg-[#B08D7A]/15 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5B1A2A] hover:bg-[#2A0F16] text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#B08D7A]" />
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-white/70 text-[#2A0F16] border border-[#B08D7A]/30 transition"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4 text-[#2A0F16]" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#F2E7E1] border-b border-[#B08D7A]/30 px-4 pt-2 pb-4 space-y-1.5">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-xs font-semibold text-[#2A0F16] hover:bg-[#B08D7A]/20"
            >
              Public Map
            </Link>
            <Link
              to="/report"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-xs font-semibold bg-[#5B1A2A] text-white"
            >
              Report Issue
            </Link>
            {user && (
              <Link
                to="/my-complaints"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-semibold text-[#2A0F16] hover:bg-[#B08D7A]/20"
              >
                My Complaints
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-semibold text-[#5B1A2A] border border-[#5B1A2A]/30"
              >
                Admin Portal
              </Link>
            )}
            {user ? (
              <div className="pt-2 border-t border-[#B08D7A]/30">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-medium text-[#2A0F16]"
                >
                  Signed in as: {profile?.full_name || user.email?.split('@')[0]}
                </Link>
                <button
                  onClick={() => {
                    signOut()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  setAuthModalOpen(true)
                }}
                className="w-full text-center py-2.5 rounded-xl bg-[#5B1A2A] text-white text-xs font-bold mt-2"
              >
                Sign In with Google
              </button>
            )}
          </div>
        )}
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  )
}
