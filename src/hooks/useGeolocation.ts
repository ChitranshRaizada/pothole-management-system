import { useState, useEffect, useCallback } from 'react'

export interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speed: number | null
  timestamp: number | null
  error: string | null
  isLoading: boolean
}

export const useGeolocation = (autoFetch = false) => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    altitude: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
    isLoading: false,
  })

  const getCurrentLocation = useCallback((enableHighAccuracy = true) => {
    if (!('geolocation' in navigator)) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser.',
        isLoading: false,
      }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
          error: null,
          isLoading: false,
        })
      },
      (error) => {
        let msg = 'Unable to retrieve your location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Location permission was denied. Please allow GPS access for roadside reporting.'
            break
          case error.POSITION_UNAVAILABLE:
            msg = 'Location information is currently unavailable.'
            break
          case error.TIMEOUT:
            msg = 'Location request timed out. Please retry outdoors with clear GPS reception.'
            break
        }
        setState((prev) => ({
          ...prev,
          error: msg,
          isLoading: false,
        }))
      },
      {
        enableHighAccuracy,
        timeout: 15000,
        maximumAge: 10000,
      }
    )
  }, [])

  useEffect(() => {
    if (autoFetch) {
      getCurrentLocation()
    }
  }, [autoFetch, getCurrentLocation])

  return {
    ...state,
    getCurrentLocation,
  }
}

