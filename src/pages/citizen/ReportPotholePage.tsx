import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useDuplicateDetection } from '../../hooks/useDuplicateDetection'
import { useSubmitComplaint } from '../../hooks/useComplaints'
import { PhotoCapture } from '../../components/report/PhotoCapture'
import { LocationPickerMap } from '../../components/map/LocationPickerMap'
import { DuplicateMatchAlert } from '../../components/report/DuplicateMatchAlert'
import { AuthModal } from '../../components/auth/AuthModal'
import {
  Navigation,
  MapPin,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Shield,
  Users,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import type { PriorityLevel } from '../../types/database'

export const ReportPotholePage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Geolocation: autoFetch is set to false per Requirement 2 (Request GPS only when user clicks)
  const {
    latitude: geoLat,
    longitude: geoLon,
    accuracy,
    isLoading: geoLoading,
    error: geoError,
    getCurrentLocation,
  } = useGeolocation(false)

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [priority, setPriority] = useState<PriorityLevel>('Medium')
  const [customLat, setCustomLat] = useState<number | null>(null)
  const [customLon, setCustomLon] = useState<number | null>(null)

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Duplicate detection (20m radius)
  const { duplicateMatch, isChecking, checkDuplicates, DUPLICATE_RADIUS_METERS } =
    useDuplicateDetection()
  const [linkAsDuplicate, setLinkAsDuplicate] = useState(true)

  // Mutation
  const submitMutation = useSubmitComplaint()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<{
    referenceNo?: string
    isDuplicate: boolean
  } | null>(null)

  // Active coordinates
  const activeLat = customLat ?? geoLat
  const activeLon = customLon ?? geoLon

  // Run duplicate check whenever coordinates change
  useEffect(() => {
    if (activeLat !== null && activeLon !== null) {
      checkDuplicates(activeLat, activeLon)
    }
  }, [activeLat, activeLon, checkDuplicates])

  // Reverse geocoding via OpenStreetMap Nominatim
  useEffect(() => {
    if (activeLat !== null && activeLon !== null && !address) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${activeLat}&lon=${activeLon}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'CivicPulse-Pothole-Management-App' } }
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.display_name) {
            setAddress(data.display_name)
          }
        })
        .catch(() => {
          // Gracefully ignore geocoding network errors
        })
    }
  }, [activeLat, activeLon, address])

  const handlePhotoSelected = (file: File) => {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handlePhotoRemoved = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    // Requirement 8: Prevent multiple submissions from repeated button clicks
    if (isSubmitting || submitMutation.isPending) {
      return
    }

    // Requirement 1: Only authenticated citizens can submit pothole reports
    if (!user) {
      setAuthModalOpen(true)
      return
    }

    if (!photoFile) {
      setSubmitError('A clear roadside photograph (JPEG, PNG, or WebP) is required for verification.')
      return
    }

    if (activeLat === null || activeLon === null) {
      setSubmitError('Please click "Get Current Location" or select the hazard spot directly on the map.')
      return
    }

    // Requirement 4: Validate and trim description input
    const trimmedDesc = description.trim()
    if (trimmedDesc.length > 1000) {
      setSubmitError('Description must be 1000 characters or fewer.')
      return
    }

    setIsSubmitting(true)

    try {
      const isLinking = duplicateMatch !== null && linkAsDuplicate

      const result = await submitMutation.mutateAsync({
        title: title.trim() || 'Road Defect',
        description: trimmedDesc,
        latitude: activeLat,
        longitude: activeLon,
        accuracyMeters: accuracy ?? undefined,
        address,
        priority,
        photoFile,
        reporterId: user.id,
        reporterName: profile?.full_name || user.email?.split('@')[0],
        linkToComplaintId: isLinking ? duplicateMatch.id : undefined,
        distanceFromMaster: isLinking ? duplicateMatch.distance_meters : 0,
      })

      setSubmitSuccess({
        referenceNo: result.referenceNo,
        isDuplicate: Boolean(result.isDuplicateLinked),
      })
    } catch (err: any) {
      console.error('Submission failed:', err)
      setSubmitError(err?.message || 'Failed to submit report. Please retry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success Feedback Screen (Requirement 7)
  if (submitSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center text-[#0B0B0F]">
        <div className="bg-white border border-[#B08D7A]/40 rounded-3xl p-8 sm:p-10 shadow-lg space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#FAF5F2] border-2 border-[#B08D7A] flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[#2A0F16]">
            {submitSuccess.isDuplicate ? 'Report Successfully Linked!' : 'Report Filed Successfully!'}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-md mx-auto">
            {submitSuccess.isDuplicate
              ? 'A pothole has already been reported nearby. Your report has been added to the existing complaint.'
              : 'Your road hazard complaint has been securely submitted for administrative review and public map verification.'}
          </p>

          {submitSuccess.referenceNo && (
            <div className="bg-[#FAF5F2] p-4 rounded-2xl border border-[#B08D7A]/30 inline-block font-mono text-sm font-bold text-[#5B1A2A]">
              Complaint Tracking ID: {submitSuccess.referenceNo}
            </div>
          )}

          <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/my-complaints')}
              className="px-6 py-3 rounded-xl bg-[#5B1A2A] hover:bg-[#2A0F16] text-xs sm:text-sm font-bold text-white transition cursor-pointer shadow-xs"
            >
              View My Complaints
            </button>
            <button
              onClick={() => {
                setSubmitSuccess(null)
                setTitle('')
                setDescription('')
                setPhotoFile(null)
                setPhotoPreview(null)
              }}
              className="px-6 py-3 rounded-xl bg-[#FAF5F2] hover:bg-[#EADCD3] text-xs sm:text-sm font-semibold text-[#2A0F16] border border-[#B08D7A]/30 transition cursor-pointer"
            >
              Report Another Issue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Severity config options
  const severityOptions: {
    level: PriorityLevel
    title: string
    desc: string
    icon: React.ReactNode
  }[] = [
    {
      level: 'Low',
      title: 'Low',
      desc: 'Small, minimal risk',
      icon: <HelpCircle className="w-4 h-4" />,
    },
    {
      level: 'Medium',
      title: 'Medium',
      desc: 'Noticeable, moderate risk',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      level: 'High',
      title: 'High',
      desc: 'Large, safety concern',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      level: 'Critical',
      title: 'Critical',
      desc: 'Severe, immediate attention',
      icon: <AlertCircle className="w-4 h-4" />,
    },
  ]

  return (
    <div className="relative min-h-screen bg-[#F2E7E1] text-[#0B0B0F] overflow-x-hidden selection:bg-[#5B1A2A] selection:text-white py-6 sm:py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* 4. Page Header with Benefit Indicators */}
        <div className="text-center space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B08D7A] block">
            SAFER ROADS, STRONGER COMMUNITIES
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#2A0F16] tracking-tight font-editorial">
            Report a Road Hazard
          </h1>
          <p className="text-xs sm:text-sm text-[#2A0F16]/75 max-w-xl mx-auto leading-relaxed">
            Help us build safer neighborhoods. Report open electrical wires, road potholes, broken streetlights, sewage overflows or other public hazards with accurate GPS and photos.
          </p>

          {/* Three Compact Benefit Indicators */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] sm:text-xs text-[#2A0F16]/80 font-medium">
            <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-3 py-1.5 rounded-full border border-[#B08D7A]/25 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#B08D7A]" />
              <span><strong>Fast Reporting</strong> – Under a minute</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-3 py-1.5 rounded-full border border-[#B08D7A]/25 shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-[#B08D7A]" />
              <span><strong>Accurate Location</strong> – 20m duplicate detection</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-3 py-1.5 rounded-full border border-[#B08D7A]/25 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-[#B08D7A]" />
              <span><strong>Safer Communities</strong> – Helps everyone</span>
            </div>
          </div>
        </div>

        {/* Citizen Authentication Status Card (Requirement 1) */}
        {!user ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#B08D7A]/40 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#5B1A2A]/10 text-[#5B1A2A] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[#5B1A2A]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#2A0F16]">
                  Citizen Authentication Required
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Only authenticated citizens can submit reports. Session tokens verify evidence authenticity.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#5B1A2A] hover:bg-[#2A0F16] text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              Sign In to Report
            </button>
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-2xl bg-white/80 border border-[#B08D7A]/30 flex items-center justify-between text-xs text-[#2A0F16]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Reporting as: <strong>{profile?.full_name || user.email}</strong></span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#FAF5F2] text-[#B08D7A] border border-[#B08D7A]/30">
              Verified Citizen
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 5. Section One – Roadside Photo Evidence */}
          <div className="bg-white border border-[#B08D7A]/30 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#B08D7A]/20">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#FAF5F2] border border-[#B08D7A]/40 text-[#5B1A2A] text-xs font-black flex items-center justify-center shadow-2xs">
                  01
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#2A0F16]">
                    Roadside Photo Evidence <span className="text-rose-500">*</span>
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Add a clear photo of the road hazard for municipal verification
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#FAF5F2] text-[#B08D7A] border border-[#B08D7A]/30">
                Required
              </span>
            </div>

            <PhotoCapture
              photoFile={photoFile}
              photoPreview={photoPreview}
              onPhotoSelected={handlePhotoSelected}
              onPhotoRemoved={handlePhotoRemoved}
            />
          </div>

          {/* 6. Section Two – GPS Location & 20m Perimeter */}
          <div className="bg-white border border-[#B08D7A]/30 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#B08D7A]/20">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#FAF5F2] border border-[#B08D7A]/40 text-[#5B1A2A] text-xs font-black flex items-center justify-center shadow-2xs">
                  02
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#2A0F16]">
                    GPS Location & 20m Perimeter <span className="text-rose-500">*</span>
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Pinpoint the pothole location and check for existing duplicate reports
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => getCurrentLocation(true)}
                disabled={geoLoading}
                className="px-3.5 py-1.5 rounded-xl bg-[#FAF5F2] hover:bg-[#EADCD3] border border-[#B08D7A]/35 text-xs font-semibold text-[#2A0F16] flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-60"
              >
                <Navigation className={`w-3.5 h-3.5 text-[#5B1A2A] ${geoLoading ? 'animate-spin' : ''}`} />
                <span>{geoLoading ? 'Acquiring GPS...' : 'Get Current Location'}</span>
              </button>
            </div>

            {geoError && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{geoError}</span>
              </div>
            )}

            {/* Interactive Leaflet Map with 20m duplicate circle */}
            <LocationPickerMap
              latitude={activeLat}
              longitude={activeLon}
              accuracyMeters={accuracy}
              duplicateRadiusMeters={DUPLICATE_RADIUS_METERS}
              onChangeLocation={(lat, lon) => {
                setCustomLat(lat)
                setCustomLon(lon)
              }}
            />

            {/* Coordinates and accuracy indicator */}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 font-normal">
              <span>
                {activeLat && activeLon ? (
                  <>
                    GPS Coordinates:{' '}
                    <strong className="text-[#2A0F16] font-mono">
                      {activeLat.toFixed(5)}, {activeLon.toFixed(5)}
                    </strong>
                    {accuracy ? ` (±${Math.round(accuracy)}m accuracy)` : ''}
                  </>
                ) : (
                  'Waiting for GPS coordinates...'
                )}
              </span>
              <span className="text-[11px] text-zinc-400">Tap or drag pin to pinpoint hazard</span>
            </div>

            {/* Road Name / Nearby Landmark */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-[#2A0F16] mb-1.5">
                Location Address / Nearby Landmark
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#B08D7A]" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Near Transformer Pole 4B, Sector 62 / Main Market Road"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF5F2] border border-[#B08D7A]/30 rounded-xl text-xs sm:text-sm text-[#0B0B0F] placeholder-zinc-400 focus:outline-none focus:border-[#5B1A2A] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Duplicate Detection Warning (20m radius) */}
          {isChecking ? (
            <div className="p-4 rounded-2xl bg-white border border-[#B08D7A]/30 text-xs text-zinc-600 flex items-center gap-2.5 shadow-2xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#5B1A2A]" />
              <span>Scanning 20-metre radius for existing road hazard reports...</span>
            </div>
          ) : duplicateMatch ? (
            <DuplicateMatchAlert
              match={duplicateMatch}
              isLinked={linkAsDuplicate}
              onToggleLink={setLinkAsDuplicate}
            />
          ) : null}

          {/* 7. Section Three – Hazard Details */}
          <div className="bg-white border border-[#B08D7A]/30 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#B08D7A]/20">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#FAF5F2] border border-[#B08D7A]/40 text-[#5B1A2A] text-xs font-black flex items-center justify-center shadow-2xs">
                  03
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#2A0F16]">
                    Hazard Details <span className="text-rose-500">*</span>
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Provide description and assess hazard severity
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#FAF5F2] text-[#B08D7A] border border-[#B08D7A]/30">
                Required
              </span>
            </div>

            {/* Issue Category Quick Selector */}
            <div>
              <label className="block text-xs font-bold text-[#2A0F16] mb-1.5">
                Issue Category <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { id: 'electrical', label: '⚡ Open Electrical Wire', defaultTitle: 'Exposed / Damaged Electrical Wire' },
                  { id: 'pothole', label: '🕳️ Pothole / Road Damage', defaultTitle: 'Deep Pothole / Damaged Road Surface' },
                  { id: 'drainage', label: '💧 Waterlogging / Sewage', defaultTitle: 'Open Drain / Severe Waterlogging' },
                  { id: 'streetlight', label: '💡 Streetlight Defect', defaultTitle: 'Non-Functional / Broken Streetlight' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (!title || title.startsWith('Exposed') || title.startsWith('Deep') || title.startsWith('Open') || title.startsWith('Non-Functional')) {
                        setTitle(cat.defaultTitle)
                      }
                    }}
                    className="p-2.5 rounded-xl border border-[#B08D7A]/30 bg-[#FAF5F2]/80 hover:bg-[#FAF5F2] hover:border-[#5B1A2A] text-left text-xs font-semibold text-[#2A0F16] transition cursor-pointer"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title / Short Summary */}
            <div>
              <label className="block text-xs font-bold text-[#2A0F16] mb-1.5">
                Title / Short Summary <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dangling live wire near pedestrian crossing or deep road crater"
                className="w-full px-4 py-2.5 bg-[#FAF5F2] border border-[#B08D7A]/30 rounded-xl text-xs sm:text-sm text-[#0B0B0F] placeholder-zinc-400 focus:outline-none focus:border-[#5B1A2A] focus:bg-white transition"
              />
            </div>

            {/* Detailed Description (Requirement 4: Optional description field) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#2A0F16]">
                  Description <span className="text-[11px] font-normal text-zinc-500">(Optional)</span>
                </label>
                <span className={`text-[11px] font-mono ${description.length > 1000 ? 'text-rose-600 font-bold' : 'text-zinc-400'}`}>
                  {description.length} / 1000 characters
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe defect details, size/depth, traffic hazard, pedestrian risk, or repair urgency (optional)..."
                className="w-full px-4 py-2.5 bg-[#FAF5F2] border border-[#B08D7A]/30 rounded-xl text-xs sm:text-sm text-[#0B0B0F] placeholder-zinc-400 focus:outline-none focus:border-[#5B1A2A] focus:bg-white transition leading-relaxed"
              />
            </div>

            {/* Assessed Hazard Severity Grid */}
            <div>
              <label className="block text-xs font-bold text-[#2A0F16] mb-2.5">
                Assessed Hazard Severity
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {severityOptions.map((opt) => {
                  const isSelected = priority === opt.level
                  return (
                    <button
                      key={opt.level}
                      type="button"
                      onClick={() => setPriority(opt.level)}
                      className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#FAF5F2] border-[#5B1A2A] ring-1 ring-[#5B1A2A] shadow-xs'
                          : 'bg-white hover:bg-[#FAF5F2]/50 border-[#B08D7A]/25'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#5B1A2A] text-white'
                              : 'bg-[#FAF5F2] text-[#B08D7A]'
                          }`}
                        >
                          {opt.icon}
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#5B1A2A] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-[#2A0F16]">
                          {opt.title}
                        </span>
                        <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                          {opt.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {submitError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2.5 shadow-2xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{submitError}</span>
            </div>
          )}

          {/* 8. Form Submission Action Bar */}
          <div className="bg-white border border-[#B08D7A]/30 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-[#B08D7A]/40 hover:border-[#5B1A2A] text-xs sm:text-sm font-semibold text-[#2A0F16] hover:bg-[#FAF5F2] transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitMutation.isPending || isSubmitting || !photoFile || activeLat === null}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#5B1A2A] hover:bg-[#2A0F16] active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitMutation.isPending || isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#B08D7A]" />
                  <span>Submitting Evidence...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#B08D7A]" />
                  <span>
                    {duplicateMatch && linkAsDuplicate
                      ? 'Submit & Link to Cluster'
                      : 'Submit Civic Hazard Report'}
                  </span>
                </>
              )}
            </button>
          </div>

          <p className="text-center text-[11px] text-zinc-500">
            All submissions are logged with your secure citizen profile and verified GPS coordinates.
          </p>
        </form>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          message="Please sign in with Google to submit and follow up on road complaints."
        />
      </div>
    </div>
  )
}
