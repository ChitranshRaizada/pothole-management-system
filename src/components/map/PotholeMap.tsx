import React, { useState, useEffect, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import {
  LocateFixed,
  Loader2,
  ZoomIn,
  ZoomOut,
  Users,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import type { Complaint } from '../../types/database'
import {
  createPriorityMarkerIcon,
  createUserLocationIcon,
  PRIORITY_COLORS,
} from './MapMarkerIcon'
import { PotholeImage } from '../common/PotholeImage'

interface PotholeMapProps {
  complaints: Complaint[]
  selectedId?: string
  onSelectComplaint?: (complaint: Complaint) => void
  center?: [number, number]
  zoom?: number
  height?: string
  autoLocate?: boolean
}

// Controller component to smoothly center on selected complaint, user location, or fit bounds
const MapBoundsController: React.FC<{
  complaints: Complaint[]
  selectedId?: string
  userPos: [number, number] | null
}> = ({ complaints, selectedId, userPos }) => {
  const map = useMap()

  useEffect(() => {
    // Priority 1: Focus on specifically selected complaint
    if (selectedId) {
      const match = complaints.find((c) => c.id === selectedId)
      if (match?.latitude && match?.longitude) {
        map.flyTo([match.latitude, match.longitude], 16, { duration: 0.8 })
        return
      }
    }

    // Priority 2: If user's real location is active, stay focused on user
    if (userPos) {
      return
    }

    // Priority 3: Fallback to fitting visible complaint pins
    if (complaints.length > 0) {
      const bounds = L.latLngBounds([])
      complaints.forEach((c) => {
        if (c.latitude && c.longitude) {
          bounds.extend([c.latitude, c.longitude])
        }
      })
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
      }
    }
  }, [complaints, selectedId, userPos, map])

  return null
}

// Custom Zoom Controls Component
const CustomZoomControls: React.FC = () => {
  const map = useMap()

  return (
    <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 shadow-md">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-[#B08D7A]/40 text-[#2A0F16] hover:bg-[#5B1A2A] hover:text-white flex items-center justify-center transition shadow-xs cursor-pointer"
        title="Zoom In"
        aria-label="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-[#B08D7A]/40 text-[#2A0F16] hover:bg-[#5B1A2A] hover:text-white flex items-center justify-center transition shadow-xs cursor-pointer"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
    </div>
  )
}

// User Geolocation Locator Button & Marker
const LocateUserControl: React.FC<{
  userPos: [number, number] | null
  setUserPos: (pos: [number, number] | null) => void
  autoLocate?: boolean
  selectedId?: string
}> = ({ userPos, setUserPos, autoLocate = true, selectedId }) => {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const hasAutoLocated = useRef(false)

  const handleLocate = (isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) {
        setErrorMsg('Geolocation is not supported by your browser.')
      }
      return
    }

    setLocating(true)
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const pos: [number, number] = [latitude, longitude]
        setUserPos(pos)
        setLocating(false)

        try {
          sessionStorage.setItem('pms_user_lat', latitude.toString())
          sessionStorage.setItem('pms_user_lng', longitude.toString())
        } catch {
          // Ignore storage quota
        }

        // Smoothly fly to user's real location unless user explicitly selected a complaint
        if (!selectedId) {
          map.flyTo(pos, 15, { duration: 1.2 })
        }
      },
      (err) => {
        setLocating(false)
        if (!isAuto) {
          setErrorMsg(err.message || 'Unable to retrieve your location.')
          setTimeout(() => setErrorMsg(null), 4000)
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Automatic geolocation on site/map launch
  useEffect(() => {
    if (autoLocate && !hasAutoLocated.current && !selectedId) {
      hasAutoLocated.current = true
      handleLocate(true)
    }
  }, [autoLocate, selectedId])

  return (
    <>
      <div className="absolute bottom-6 right-3 z-[1000]">
        <button
          type="button"
          onClick={() => handleLocate(false)}
          disabled={locating}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-[#B08D7A]/40 text-[#2A0F16] hover:bg-[#5B1A2A] hover:text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-60 active:scale-95"
          title="Locate my position"
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#5B1A2A]" />
          ) : (
            <LocateFixed className="w-4 h-4 text-[#5B1A2A] group-hover:text-white" />
          )}
          <span className="hidden sm:inline">
            {locating ? 'Detecting Location...' : 'Locate Me'}
          </span>
        </button>

        {errorMsg && (
          <div className="absolute right-0 bottom-11 bg-rose-950 text-rose-100 text-[11px] p-2 rounded-lg shadow-lg border border-rose-500 whitespace-nowrap">
            {errorMsg}
          </div>
        )}
      </div>

      {userPos && (
        <Marker position={userPos} icon={createUserLocationIcon()}>
          <Popup>
            <div className="p-1 text-xs">
              <span className="font-bold text-blue-700">Your Current Location</span>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                {userPos[0].toFixed(5)}, {userPos[1].toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  )
}

export const PotholeMap: React.FC<PotholeMapProps> = ({
  complaints,
  selectedId,
  onSelectComplaint,
  center,
  zoom = 14,
  height = '560px',
  autoLocate = true,
}) => {
  // If user previously permitted location in this session, use it directly as starting center
  const [initialCenter] = useState<[number, number]>(() => {
    if (center) return center
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const cachedLat = sessionStorage.getItem('pms_user_lat')
      const cachedLng = sessionStorage.getItem('pms_user_lng')
      if (cachedLat && cachedLng) {
        const lat = parseFloat(cachedLat)
        const lng = parseFloat(cachedLng)
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng]
        }
      }
    }
    // Default fallback before browser geolocation resolves
    return [20.5937, 78.9629]
  })

  const [userPos, setUserPos] = useState<[number, number] | null>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const cachedLat = sessionStorage.getItem('pms_user_lat')
      const cachedLng = sessionStorage.getItem('pms_user_lng')
      if (cachedLat && cachedLng) {
        const lat = parseFloat(cachedLat)
        const lng = parseFloat(cachedLng)
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng]
        }
      }
    }
    return null
  })

  return (
    <div
      style={{ height, width: '100%' }}
      className="relative rounded-2xl overflow-hidden border border-[#B08D7A]/30 shadow-sm z-10 font-sans"
    >
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        zoomControl={false} // Customized zoom control placed cleanly
        attributionControl={true}
        style={{ height: '100%', width: '100%' }}
      >
        {/* OpenStreetMap Standard Tiles with visible attribution */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* Dynamic Zoom & Locate Controls */}
        <CustomZoomControls />
        <LocateUserControl
          userPos={userPos}
          setUserPos={setUserPos}
          autoLocate={autoLocate}
          selectedId={selectedId}
        />

        {/* Bounds & Selection Sync */}
        <MapBoundsController
          complaints={complaints}
          selectedId={selectedId}
          userPos={userPos}
        />

        {/* Priority Legend Pill */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-md border border-[#B08D7A]/30 rounded-xl px-2.5 py-1.5 shadow-xs flex items-center gap-2 text-[10px] font-semibold text-[#2A0F16]">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 mr-0.5">Priority:</span>
          {(['Critical', 'High', 'Medium', 'Low'] as const).map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span
                style={{ backgroundColor: PRIORITY_COLORS[p].bg }}
                className="w-2 h-2 rounded-full inline-block"
              />
              <span className="hidden sm:inline">{p}</span>
            </span>
          ))}
        </div>

        {/* Consolidated Approved Complaint Markers */}
        {complaints.map((c) => {
          if (!c.latitude || !c.longitude) return null

          const isSelected = c.id === selectedId
          const icon = createPriorityMarkerIcon(c.priority, isSelected)

          // Identify approved photograph from reviewed report attachments
          const approvedReport = (c.reports || []).find((r) => r.is_approved_attachment && (r.photo_url || r.storage_path))
          const approvedPhoto = approvedReport?.photo_url || null
          const approvedStoragePath = approvedReport?.storage_path || null

          // Count of citizen submissions contributing to this consolidated complaint
          const reportsCount = c.reports_count || c.reports?.length || 1

          // Latest progress note from history
          const latestUpdate = c.resolution_notes || null

          return (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectComplaint?.(c),
              }}
            >
              <Popup className="custom-complaint-popup" minWidth={260} maxWidth={320}>
                <div className="p-1 space-y-2.5 text-[#0B0B0F]">
                  {/* Header: Reference # and Priority */}
                  <div className="flex items-center justify-between border-b border-[#B08D7A]/25 pb-1.5">
                    <span className="font-mono text-xs font-bold text-[#5B1A2A]">
                      {c.reference_no}
                    </span>
                    <span
                      style={{
                        backgroundColor: PRIORITY_COLORS[c.priority]?.bg || '#5B1A2A',
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white tracking-wider"
                    >
                      {c.priority}
                    </span>
                  </div>

                  {/* Approved Photograph (Only shown if passed attachment review) */}
                  {(approvedPhoto || approvedStoragePath) ? (
                    <div className="relative rounded-xl overflow-hidden border border-[#B08D7A]/25 h-32 bg-[#FAF5F2]">
                      <PotholeImage
                        src={approvedPhoto}
                        storagePath={approvedStoragePath}
                        alt="Verified hazard evidence"
                        allowExpand={true}
                        badge={
                          <div className="bg-black/70 backdrop-blur-xs text-white text-[9px] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            Verified Photo
                          </div>
                        }
                      />
                    </div>
                  ) : null}

                  {/* Title and Physical Location */}
                  <div>
                    <h4 className="text-xs font-bold text-[#2A0F16] leading-snug line-clamp-2">
                      {c.title}
                    </h4>
                    <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-2 leading-tight">
                      {c.address || `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`}
                    </p>
                  </div>

                  {/* Metrics: Status and Citizen Reports Count */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-[#FAF5F2] p-2 rounded-lg border border-[#B08D7A]/20">
                    <div>
                      <span className="text-zinc-500 block">Status:</span>
                      <strong className="text-[#5B1A2A] font-semibold">{c.status}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Reports:</span>
                      <strong className="text-[#2A0F16] font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#B08D7A]" />
                        {reportsCount} {reportsCount === 1 ? 'citizen' : 'citizens'}
                      </strong>
                    </div>
                  </div>

                  {/* Latest Public Progress Update */}
                  {latestUpdate && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-900 leading-snug">
                      <strong className="font-semibold block text-emerald-800 mb-0.5">
                        Latest Progress Update:
                      </strong>
                      {latestUpdate}
                    </div>
                  )}

                  {/* Inspect Details Link */}
                  <div className="pt-1 flex items-center justify-end">
                    <Link
                      to={`/complaint/${c.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#5B1A2A] hover:bg-[#2A0F16] text-white text-[11px] font-semibold transition shadow-xs"
                    >
                      <span>Full Timeline</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
