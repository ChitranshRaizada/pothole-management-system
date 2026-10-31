import { useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { calculateDistanceMeters } from '../lib/utils'
import type { DuplicateMatchResult, Complaint } from '../types/database'

export const DUPLICATE_RADIUS_METERS = 20.0

export const useDuplicateDetection = () => {
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatchResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkDuplicates = useCallback(
    async (lat: number, lon: number): Promise<DuplicateMatchResult | null> => {
      if (!isSupabaseConfigured) {
        setDuplicateMatch(null)
        return null
      }

      setIsChecking(true)
      setError(null)

      try {
        // First try the PostgreSQL RPC haversine function
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'find_nearest_active_complaint',
          {
            p_lat: lat,
            p_lon: lon,
            p_radius_meters: DUPLICATE_RADIUS_METERS,
          }
        )

        if (!rpcError && rpcData && rpcData.length > 0) {
          const match = rpcData[0] as DuplicateMatchResult
          setDuplicateMatch(match)
          setIsChecking(false)
          return match
        }

        // Fallback: If RPC not deployed yet, query active complaints directly and calculate distance in client
        const { data: activeComplaints, error: queryError } = await supabase
          .from('complaints')
          .select('id, reference_no, title, status, priority, latitude, longitude, address, created_at')
          .not('status', 'in', '("Resolved","Closed","Rejected")')

        if (queryError) {
          throw queryError
        }

        if (activeComplaints && activeComplaints.length > 0) {
          let nearestMatch: DuplicateMatchResult | null = null
          let smallestDistance = Infinity

          for (const item of activeComplaints as Complaint[]) {
            const dist = calculateDistanceMeters(lat, lon, item.latitude, item.longitude)
            if (dist <= DUPLICATE_RADIUS_METERS && dist < smallestDistance) {
              smallestDistance = dist
              nearestMatch = {
                id: item.id,
                reference_no: item.reference_no,
                title: item.title,
                status: item.status,
                priority: item.priority,
                latitude: item.latitude,
                longitude: item.longitude,
                address: item.address,
                distance_meters: dist,
                created_at: item.created_at,
                reports_count: 1,
              }
            }
          }

          setDuplicateMatch(nearestMatch)
          setIsChecking(false)
          return nearestMatch
        }

        setDuplicateMatch(null)
        setIsChecking(false)
        return null
      } catch (err: any) {
        console.warn('Duplicate check warning:', err?.message || err)
        setError(err?.message || 'Failed to check nearby complaints.')
        setDuplicateMatch(null)
        setIsChecking(false)
        return null
      }
    },
    []
  )

  const clearDuplicateMatch = useCallback(() => {
    setDuplicateMatch(null)
    setError(null)
  }, [])

  return {
    duplicateMatch,
    isChecking,
    error,
    checkDuplicates,
    clearDuplicateMatch,
    DUPLICATE_RADIUS_METERS,
  }
}

