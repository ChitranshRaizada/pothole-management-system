import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePublicComplaints } from '../../hooks/useComplaints'
import { PotholeMap } from '../../components/map/PotholeMap'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PriorityBadge } from '../../components/common/PriorityBadge'
import { formatDate } from '../../lib/utils'
import {
  Search,
  PlusCircle,
  MapPin,
  List,
  Map as MapIcon,
  ChevronRight,
  AlertCircle,
  Wrench,
  Shield,
  Calendar,
  FileText,
  ArrowRight,
  Zap,
} from 'lucide-react'
import type { Complaint } from '../../types/database'

export const PublicMapPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)

  // Pass active filters to secure Supabase hook to enforce server-side querying
  const {
    data: complaints = [],
    isLoading,
    error,
  } = usePublicComplaints({
    status: statusFilter,
    priority: priorityFilter,
    search: searchTerm,
  })

  // Fast client-side filter memoization for instantaneous feedback
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesSearch =
        searchTerm.trim() === '' ||
        c.reference_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'All' || c.status === statusFilter
      const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [complaints, searchTerm, statusFilter, priorityFilter])

  // Real backend statistics from database
  const stats = useMemo(() => {
    const verifiedDefects = complaints.length
    const repairsScheduled = complaints.filter(
      (c) => c.status === 'Assigned' || c.status === 'In Progress'
    ).length
    const resolved = complaints.filter(
      (c) => c.status === 'Resolved' || c.status === 'Closed'
    ).length
    return { verifiedDefects, repairsScheduled, resolved }
  }, [complaints])

  return (
    <div className="relative min-h-screen bg-[#F2E7E1] text-[#0B0B0F] overflow-x-hidden selection:bg-[#5B1A2A] selection:text-white">
      {/* Decorative Organic Wave Canvas (Matches Reference Image) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-90">
        <svg
          className="absolute w-full h-[850px] top-0 left-0"
          viewBox="0 0 1440 850"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Gentle cream/gold layer */}
          <path
            d="M-50 480 C 250 560, 480 320, 680 200 C 920 60, 1180 80, 1500 0 L 1500 -100 L -50 -100 Z"
            fill="#EADCD3"
            opacity="0.6"
          />
          {/* Deep burgundy sweeping wave across hero & lower sides */}
          <path
            d="M-100 600 C 180 680, 420 400, 640 260 C 880 100, 1150 40, 1500 -20 L 1500 120 C 1200 160, 950 240, 720 380 C 480 530, 220 780, -100 780 Z"
            fill="#5B1A2A"
            opacity="0.95"
          />
          {/* Dark burgundy contour line */}
          <path
            d="M-100 680 C 200 760, 440 450, 660 300 C 890 140, 1160 80, 1500 20 L 1500 80 C 1180 130, 910 210, 690 350 C 450 500, 180 820, -100 820 Z"
            fill="#2A0F16"
          />
          {/* Lower right sweeping wave behind sidebar */}
          <path
            d="M1500 500 C 1350 540, 1260 640, 1220 750 C 1180 860, 1200 950, 1250 1050 L 1500 1050 Z"
            fill="#5B1A2A"
            opacity="0.9"
          />
          <path
            d="M1500 580 C 1380 610, 1310 700, 1280 800 C 1250 900, 1270 980, 1310 1050 L 1500 1050 Z"
            fill="#2A0F16"
          />
          {/* Lower left sweeping contour */}
          <path
            d="M-100 780 C 50 830, 120 920, 140 1050 L -100 1050 Z"
            fill="#2A0F16"
          />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* 4. Hero Section - Split Layout with Integrated City Skyline Photography */}
        <section className="relative overflow-hidden rounded-3xl min-h-[380px] lg:min-h-[420px] flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-8">
            {/* Left Side: Headline & Editorial Typography */}
            <div className="lg:col-span-5 pr-0 lg:pr-4 py-4 sm:py-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#B08D7A] block mb-3">
                SAFER ROADS, RESPONSIVE CITIES
              </span>

              {/* Vertical bar accent beside heading */}
              <div className="border-l-[3.5px] border-[#B08D7A] pl-4 sm:pl-5 py-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B0B0F] tracking-tight leading-[1.12] font-editorial">
                  Live Municipal <br />
                  Civic Hazard Map
                </h1>
              </div>

              <p className="mt-4 text-xs sm:text-sm text-[#2A0F16]/85 leading-relaxed max-w-md">
                Real-time verified civic hazards, potholes, open electrical wires, broken streetlights, water logging, and status tracking across our city network.
              </p>

              <div className="mt-6 sm:mt-7">
                <Link
                  to="/report"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#2A0F16] hover:bg-[#5B1A2A] text-[#F2E7E1] text-xs sm:text-sm font-semibold shadow-md transition-all duration-200 active:scale-95 group border border-[#5B1A2A]"
                >
                  <PlusCircle className="w-4 h-4 text-[#B08D7A] group-hover:scale-110 transition-transform" />
                  <span>Report Civic Hazard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B08D7A] group-hover:translate-x-1 transition-transform ml-0.5" />
                </Link>
              </div>
            </div>

            {/* Right Side: Urban Road Image with 3 Floating Metric Cards */}
            <div className="lg:col-span-7 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#B08D7A]/30 h-[280px] sm:h-[340px] lg:h-[370px]">
                {/* Modern Urban Roadway Photo */}
                <img
                  src="/road-hero.jpg"
                  alt="Modern urban road with city skyline at sunset"
                  className="w-full h-full object-cover object-center"
                />

                {/* Subtle warm burgundy gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A0F16]/85 via-[#2A0F16]/20 to-transparent" />

                {/* 3 Metric Cards positioned at the bottom of the photo */}
                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-20 grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Metric 1: Verified Hazards */}
                  <div className="bg-[#FAF5F2]/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-white/60 shadow-md flex items-center justify-between transition-transform hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2A0F16] flex items-center justify-center text-[#B08D7A] shrink-0 shadow-xs">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-lg sm:text-2xl font-black text-[#2A0F16] leading-none">
                          {stats.verifiedDefects}
                        </span>
                        <span className="text-[10px] sm:text-xs font-medium text-zinc-600 line-clamp-1 mt-0.5">
                          Verified Hazards
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 hidden sm:block" />
                  </div>

                  {/* Metric 2: Repairs Scheduled */}
                  <div className="bg-[#FAF5F2]/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-white/60 shadow-md flex items-center justify-between transition-transform hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2A0F16] flex items-center justify-center text-[#B08D7A] shrink-0 shadow-xs">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-lg sm:text-2xl font-black text-[#2A0F16] leading-none">
                          {stats.repairsScheduled}
                        </span>
                        <span className="text-[10px] sm:text-xs font-medium text-zinc-600 line-clamp-1 mt-0.5">
                          Repairs Scheduled
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 hidden sm:block" />
                  </div>

                  {/* Metric 3: Resolved */}
                  <div className="bg-[#FAF5F2]/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-white/60 shadow-md flex items-center justify-between transition-transform hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2A0F16] flex items-center justify-center text-[#B08D7A] shrink-0 shadow-xs">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-lg sm:text-2xl font-black text-[#2A0F16] leading-none">
                          {stats.resolved}
                        </span>
                        <span className="text-[10px] sm:text-xs font-medium text-zinc-600 line-clamp-1 mt-0.5">
                          Resolved
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0 hidden sm:block" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Search and Filter Section - Clean Horizontal Toolbar */}
        <section className="bg-white/95 backdrop-blur-sm border border-[#B08D7A]/30 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-2.5">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#B08D7A]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reference #, road name, or district..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF5F2] border border-[#B08D7A]/30 rounded-xl text-xs sm:text-sm text-[#0B0B0F] placeholder-zinc-500 focus:outline-none focus:border-[#5B1A2A] focus:bg-white transition"
              />
            </div>

            {/* Dropdowns & Map/List Toggle */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Verified Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#FAF5F2] border border-[#B08D7A]/30 text-xs sm:text-sm text-[#2A0F16] font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#5B1A2A] cursor-pointer"
              >
                <option value="All">All Verified Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              {/* Priority Dropdown */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-[#FAF5F2] border border-[#B08D7A]/30 text-xs sm:text-sm text-[#2A0F16] font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#5B1A2A] cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Map / List View Toggle Pill */}
              <div className="flex items-center bg-[#FAF5F2] p-1 rounded-xl border border-[#B08D7A]/30">
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'map'
                      ? 'bg-[#2A0F16] text-[#F2E7E1] shadow-xs'
                      : 'text-[#2A0F16]/70 hover:text-[#2A0F16]'
                  }`}
                  title="Map view"
                >
                  <MapIcon className="w-3.5 h-3.5 text-[#B08D7A]" />
                  <span>Map</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-[#2A0F16] text-[#F2E7E1] shadow-xs'
                      : 'text-[#2A0F16]/70 hover:text-[#2A0F16]'
                  }`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Result Counter & Verified Disclaimer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-600 pt-2 border-t border-[#B08D7A]/20 gap-1 font-normal">
            <span>
              Displaying <strong className="text-[#2A0F16] font-bold">{filteredComplaints.length}</strong> verified public hazards & civic issues
            </span>
            <span className="text-[11px] text-zinc-500 italic flex items-center gap-1">
              <span className="inline-block text-[#B08D7A] font-bold">ⓘ</span>
              * Unapproved citizen reports are withheld from the public map until verified
            </span>
          </div>
        </section>

        {/* 6. Main Dashboard Layout - Two Column (Interactive Map + Information Sidebar) */}
        {isLoading ? (
          <div className="h-[540px] rounded-3xl bg-white border border-[#B08D7A]/25 flex flex-col items-center justify-center gap-3 shadow-xs">
            <div className="w-9 h-9 border-3 border-[#5B1A2A] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-500 font-medium">Loading road network data...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-white border border-rose-200 text-rose-900 text-center max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold text-sm">Complaint Database Connection Error</p>
            <p className="text-xs text-rose-700 mt-1">
              {(error as any)?.message || 'Unable to retrieve complaints from Supabase.'}
            </p>
            {((error as any)?.code || (error as any)?.details || (error as any)?.hint) && (
              <div className="mt-3 p-3 bg-rose-50 rounded-xl text-left text-[11px] font-mono text-rose-800 space-y-1 border border-rose-200">
                {(error as any)?.code && <div><span className="font-semibold">Code:</span> {(error as any).code}</div>}
                {(error as any)?.details && <div><span className="font-semibold">Details:</span> {(error as any).details}</div>}
                {(error as any)?.hint && <div><span className="font-semibold">Hint:</span> {(error as any).hint}</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Interactive Map (Spans 8 columns on large screens) */}
            <div
              className={`lg:col-span-8 bg-white border border-[#B08D7A]/30 rounded-3xl p-2 sm:p-2.5 shadow-sm overflow-hidden ${
                viewMode === 'list' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="rounded-2xl overflow-hidden border border-[#B08D7A]/20">
                <PotholeMap
                  complaints={filteredComplaints}
                  selectedId={selectedComplaint?.id}
                  onSelectComplaint={(c) => setSelectedComplaint(c)}
                  height="570px"
                />
              </div>
            </div>

            {/* Right Column: Information Sidebar (Spans 4 columns on large screens) */}
            <div
              className={`lg:col-span-4 space-y-5 ${
                viewMode === 'map' ? 'hidden lg:block' : 'block'
              }`}
            >
              {/* Card 1: If zero complaints, show "No Complaints Match Filters" Card with gold pin badge */}
              {filteredComplaints.length === 0 ? (
                <div className="relative overflow-hidden bg-white/95 backdrop-blur-xs border border-[#B08D7A]/30 rounded-3xl p-6 sm:p-8 text-center shadow-sm">
                  {/* Road curve watermark graphic in background */}
                  <svg
                    className="absolute right-0 top-0 h-full w-40 opacity-15 pointer-events-none"
                    viewBox="0 0 100 200"
                    fill="none"
                    stroke="#B08D7A"
                    strokeWidth="8"
                  >
                    <path d="M100 0 C 40 60, 40 140, 100 200" />
                    <path d="M80 0 C 20 60, 20 140, 80 200" strokeDasharray="6 6" />
                  </svg>

                  {/* Gold circular pin badge in center */}
                  <div className="w-14 h-14 rounded-full bg-[#B08D7A] shadow-sm flex items-center justify-center mx-auto mb-3.5 border-2 border-white">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-base font-bold text-[#2A0F16]">
                    No Complaints Match Filters
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
                    Try resetting search keywords or status filters.
                  </p>
                </div>
              ) : (
                /* Matching Hazards Feed Card */
                <div className="bg-white/95 backdrop-blur-xs border border-[#B08D7A]/30 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#B08D7A]/20">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#2A0F16]">
                      Verified Hazards ({filteredComplaints.length})
                    </h3>
                    <span className="text-[11px] text-[#B08D7A] font-semibold">Click to inspect</span>
                  </div>

                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                    {filteredComplaints.map((item) => {
                      const isSelected = selectedComplaint?.id === item.id
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedComplaint(item)}
                          className={`p-3 rounded-2xl transition border cursor-pointer ${
                            isSelected
                              ? 'bg-[#FAF5F2] border-[#5B1A2A] shadow-xs'
                              : 'bg-white hover:bg-[#FAF5F2]/60 border-[#B08D7A]/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-mono font-bold text-[#5B1A2A]">
                              {item.reference_no}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge priority={item.priority} size="sm" />
                              <StatusBadge status={item.status} size="sm" />
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-[#2A0F16] mb-1 line-clamp-1">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-zinc-600 line-clamp-1 mb-2">
                            {item.address || item.description}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-zinc-400 border-t border-[#B08D7A]/15 pt-1.5">
                            <span>{formatDate(item.created_at)}</span>
                            <Link
                              to={`/complaint/${item.id}`}
                              className="inline-flex items-center gap-0.5 text-[#5B1A2A] hover:text-[#2A0F16] font-semibold transition"
                            >
                              Inspect
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Card 2: Quick Actions */}
              <div className="bg-white/95 backdrop-blur-xs border border-[#B08D7A]/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#B08D7A]" />
                  <h3 className="text-sm font-bold text-[#2A0F16]">Quick Actions</h3>
                </div>

                <div className="space-y-2.5">
                  {/* 1. Report a Civic Hazard */}
                  <Link
                    to="/report"
                    className="group flex items-center justify-between p-3 rounded-2xl border border-[#B08D7A]/20 hover:border-[#5B1A2A] bg-[#FAF5F2]/60 hover:bg-[#FAF5F2] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2A0F16] text-[#B08D7A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <PlusCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2A0F16] group-hover:text-[#5B1A2A] transition">
                          Report Civic Hazard
                        </h4>
                        <p className="text-[11px] text-zinc-500">
                          Potholes, electrical wires, water logging & more
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#5B1A2A] group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  {/* 2. View Repair Schedule */}
                  <Link
                    to="/my-complaints"
                    className="group flex items-center justify-between p-3 rounded-2xl border border-[#B08D7A]/20 hover:border-[#5B1A2A] bg-[#FAF5F2]/60 hover:bg-[#FAF5F2] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2A0F16] text-[#B08D7A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2A0F16] group-hover:text-[#5B1A2A] transition">
                          View Repair Schedule
                        </h4>
                        <p className="text-[11px] text-zinc-500">
                          Track ongoing repairs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#5B1A2A] group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  {/* 3. Community Guidelines */}
                  <div
                    onClick={() =>
                      alert(
                        'Civic Pulse Community Guidelines:\n\n1. Safety First: Never approach live electrical wires or take photos while driving.\n2. Accuracy: Capture hazards with GPS location within 20m.\n3. Categories: Open electrical wires, damaged roads/potholes, sewage/waterlogging, broken streetlights.\n4. Privacy: Avoid faces and vehicle license plates.\n5. Verification: Reports undergo municipal review before public map publishing.'
                      )
                    }
                    className="group flex items-center justify-between p-3 rounded-2xl border border-[#B08D7A]/20 hover:border-[#5B1A2A] bg-[#FAF5F2]/60 hover:bg-[#FAF5F2] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2A0F16] text-[#B08D7A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2A0F16] group-hover:text-[#5B1A2A] transition">
                          Community Guidelines
                        </h4>
                        <p className="text-[11px] text-zinc-500">
                          Safety & reporting protocols
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#5B1A2A] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
