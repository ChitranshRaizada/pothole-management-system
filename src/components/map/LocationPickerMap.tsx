import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createLocationPinIcon } from './MapMarkerIcon'

interface LocationPickerMapProps {
  latitude: number | null
  longitude: number | null
  accuracyMeters?: number | null
  onChangeLocation: (lat: number, lon: number) => void
  duplicateRadiusMeters?: number
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  latitude,
  longitude,
  accuracyMeters,
  onChangeLocation,
  duplicateRadiusMeters = 20,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const duplicateCircleRef = useRef<L.Circle | null>(null)
  const accuracyCircleRef = useRef<L.Circle | null>(null)

  const defaultCenter: [number, number] = [
    latitude ?? 51.505,
    longitude ?? -0.09,
  ]

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: latitude && longitude ? 17 : 13,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      onChangeLocation(e.latlng.lat, e.latlng.lng)
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update marker and radius when coords change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || latitude === null || longitude === null) return

    const latLng: [number, number] = [latitude, longitude]

    // Marker
    if (!markerRef.current) {
      const pin = L.marker(latLng, {
        icon: createLocationPinIcon(),
        draggable: true,
      }).addTo(map)

      pin.on('dragend', (e) => {
        const newPos = (e.target as L.Marker).getLatLng()
        onChangeLocation(newPos.lat, newPos.lng)
      })

      markerRef.current = pin
    } else {
      markerRef.current.setLatLng(latLng)
    }

    // 20-meter Duplicate Detection Radius Circle (Light transparent perimeter)
    if (!duplicateCircleRef.current) {
      const circle = L.circle(latLng, {
        radius: duplicateRadiusMeters,
        color: '#5B1A2A',
        fillColor: '#B08D7A',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(map)
      duplicateCircleRef.current = circle
    } else {
      duplicateCircleRef.current.setLatLng(latLng)
      duplicateCircleRef.current.setRadius(duplicateRadiusMeters)
    }

    // Accuracy Circle
    if (accuracyMeters && accuracyMeters > 0) {
      if (!accuracyCircleRef.current) {
        const acc = L.circle(latLng, {
          radius: accuracyMeters,
          color: '#B08D7A',
          fillColor: '#B08D7A',
          fillOpacity: 0.08,
          weight: 1,
        }).addTo(map)
        accuracyCircleRef.current = acc
      } else {
        accuracyCircleRef.current.setLatLng(latLng)
        accuracyCircleRef.current.setRadius(accuracyMeters)
      }
    } else if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove()
      accuracyCircleRef.current = null
    }

    map.panTo(latLng)
  }, [latitude, longitude, accuracyMeters, duplicateRadiusMeters, onChangeLocation])

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#B08D7A]/30 shadow-2xs">
      <div ref={mapContainerRef} className="w-full h-64 sm:h-72 z-10" />

      {/* Duplicate Search Zone Legend Badge (as shown in reference image) */}
      <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#B08D7A]/40 text-[11px] font-semibold text-[#2A0F16] flex items-center gap-1.5 shadow-sm pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#5B1A2A] animate-pulse" />
        <span>20m Duplicate Search Zone</span>
      </div>
    </div>
  )
}
