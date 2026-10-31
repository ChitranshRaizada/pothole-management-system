import L from 'leaflet'
import type { PriorityLevel } from '../../types/database'

// Fix default Leaflet marker icon asset paths in Vite bundles
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Priority-based color specification:
// Critical -> Vibrant Red
// High -> Strong Burgundy
// Medium -> Warm Gold / Amber
// Low -> Slate Blue / Neutral
export const PRIORITY_COLORS: Record<PriorityLevel, { bg: string; border: string; text: string }> = {
  Critical: { bg: '#DC2626', border: '#FCA5A5', text: '#FFFFFF' },
  High: { bg: '#5B1A2A', border: '#F2E7E1', text: '#FFFFFF' },
  Medium: { bg: '#B08D7A', border: '#2A0F16', text: '#0B0B0F' },
  Low: { bg: '#475569', border: '#CBD5E1', text: '#FFFFFF' },
}

export function createPriorityMarkerIcon(priority: PriorityLevel = 'Medium', isSelected = false) {
  const palette = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Medium

  const pulseRing = isSelected
    ? `<span class="absolute -inset-2.5 rounded-full border-2 border-[${palette.bg}] animate-ping opacity-75"></span>`
    : ''

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-115 group">
      ${pulseRing}
      <div style="background-color: ${palette.bg}; border: 2.5px solid ${palette.border}; box-shadow: 0 4px 14px rgba(42, 15, 22, 0.4);"
           class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div style="border-top: 6px solid ${palette.bg};" class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent -mt-[1px]"></div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-priority-pin',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -40],
  })
}

// User current location pulsing pin
export function createUserLocationIcon() {
  const html = `
    <div class="relative flex items-center justify-center">
      <span class="absolute w-8 h-8 rounded-full bg-blue-500/40 animate-ping"></span>
      <div class="w-5 h-5 rounded-full bg-white border-3 border-blue-600 shadow-lg flex items-center justify-center">
        <div class="w-2 h-2 rounded-full bg-blue-600"></div>
      </div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'user-live-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export function createLocationPinIcon() {
  const html = `
    <div class="relative flex items-center justify-center">
      <span class="absolute w-8 h-8 rounded-full bg-[#B08D7A]/40 animate-ping"></span>
      <div class="w-5 h-5 rounded-full bg-[#F2E7E1] border-3 border-[#5B1A2A] shadow-lg flex items-center justify-center">
        <div class="w-1.5 h-1.5 rounded-full bg-[#5B1A2A]"></div>
      </div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'current-user-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}
