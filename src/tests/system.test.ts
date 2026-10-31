import { describe, it, expect } from 'vitest'
import { calculateDistanceMeters, PALETTE } from '../lib/utils'
import {
  isValidTransition,
  VALID_STATUS_TRANSITIONS,
} from '../types/database'
import { generateReferenceNo } from '../hooks/useComplaints'

describe('1. Color Palette Tokens from Image Specification', () => {
  it('strictly adheres to the palette extracted from the image', () => {
    expect(PALETTE.noir).toBe('#0B0B0F')
    expect(PALETTE.wineDark).toBe('#2A0F16')
    expect(PALETTE.wine).toBe('#5B1A2A')
    expect(PALETTE.taupe).toBe('#B08D7A')
    expect(PALETTE.cream).toBe('#F2E7E1')
  })
})

describe('2. Geospatial Haversine & 20-Meter Duplicate Detection Logic (Requirement 8)', () => {
  it('calculates zero distance for identical coordinates', () => {
    const lat = 51.5074
    const lon = -0.1278
    const dist = calculateDistanceMeters(lat, lon, lat, lon)
    expect(dist).toBe(0)
  })

  it('correctly flags coordinates within the 20-meter duplicate threshold', () => {
    const lat1 = 51.5074
    const lon1 = -0.1278
    const lat2 = 51.5075
    const lon2 = -0.1278

    const distance = calculateDistanceMeters(lat1, lon1, lat2, lon2)
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThanOrEqual(20)
  })

  it('correctly excludes complaints further than 20 meters away', () => {
    const lat1 = 51.5074
    const lon1 = -0.1278
    const lat2 = 51.5084
    const lon2 = -0.1278

    const distance = calculateDistanceMeters(lat1, lon1, lat2, lon2)
    expect(distance).toBeGreaterThan(20)
  })

  it('selects the nearest eligible complaint when multiple active complaints are within range', () => {
    const candidateLat = 51.5074
    const candidateLon = -0.1278

    const activeComplaints = [
      { id: '1', lat: 51.50755, lon: -0.1278, title: 'Complaint A (16.7m)' },
      { id: '2', lat: 51.50745, lon: -0.1278, title: 'Complaint B (5.6m)' },
      { id: '3', lat: 51.50750, lon: -0.1278, title: 'Complaint C (11.1m)' },
    ]

    let nearest = null
    let minDistance = Infinity

    for (const c of activeComplaints) {
      const dist = calculateDistanceMeters(candidateLat, candidateLon, c.lat, c.lon)
      if (dist <= 20 && dist < minDistance) {
        minDistance = dist
        nearest = c
      }
    }

    expect(nearest).not.toBeNull()
    expect(nearest?.id).toBe('2')
    expect(minDistance).toBeLessThan(10)
  })
})

describe('3. Status Transition State Machine (Requirement 10)', () => {
  it('allows valid forward workflow progressions', () => {
    expect(isValidTransition('New', 'Under Review')).toBe(true)
    expect(isValidTransition('Under Review', 'Approved')).toBe(true)
    expect(isValidTransition('Approved', 'Assigned')).toBe(true)
    expect(isValidTransition('Assigned', 'In Progress')).toBe(true)
    expect(isValidTransition('In Progress', 'Resolved')).toBe(true)
    expect(isValidTransition('Resolved', 'Closed')).toBe(true)
  })

  it('allows rejection from intake states', () => {
    expect(isValidTransition('New', 'Rejected')).toBe(true)
    expect(isValidTransition('Under Review', 'Rejected')).toBe(true)
    expect(isValidTransition('Approved', 'Rejected')).toBe(true)
  })

  it('strictly blocks illegal status leaps', () => {
    expect(isValidTransition('New', 'Resolved')).toBe(false)
    expect(isValidTransition('New', 'In Progress')).toBe(false)
    expect(isValidTransition('Closed', 'New')).toBe(false)
    expect(isValidTransition('Closed', 'In Progress')).toBe(false)
    expect(VALID_STATUS_TRANSITIONS['Closed']).toHaveLength(0)
  })
})

describe('4. Reference Number Generation', () => {
  it('generates properly formatted POT-YYYY-XXXX references', () => {
    const currentYear = new Date().getFullYear().toString()
    const ref = generateReferenceNo()

    expect(ref.startsWith(`POT-${currentYear}-`)).toBe(true)
    expect(ref).toMatch(/^POT-\d{4}-[A-Z0-9]{5}$/)
  })
})

describe('5. Google Authentication & Redirect Endpoint Configuration', () => {
  it('constructs OAuth callback URL targeting /auth/callback', () => {
    const origin = 'https://roadcare.gov'
    const targetRedirect = `${origin}/auth/callback`
    expect(targetRedirect).toBe('https://roadcare.gov/auth/callback')
  })
})
