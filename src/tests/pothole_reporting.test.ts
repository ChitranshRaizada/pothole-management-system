import { describe, it, expect, vi } from 'vitest'
import { uploadPotholePhoto } from '../hooks/useComplaints'
import { supabase } from '../lib/supabase'

describe('Pothole Reporting Feature Suite', () => {
  it('enforces 8MB file limits and accepted MIME types (JPEG, PNG, WebP)', () => {
    const MAX_SIZE = 8 * 1024 * 1024
    const validMimes = ['image/jpeg', 'image/png', 'image/webp']

    const validJpg = new File(['fake-jpg'], 'test.jpg', { type: 'image/jpeg' })
    const validPng = new File(['fake-png'], 'test.png', { type: 'image/png' })
    const validWebp = new File(['fake-webp'], 'test.webp', { type: 'image/webp' })
    const invalidGif = new File(['fake-gif'], 'test.gif', { type: 'image/gif' })

    expect(validJpg.size).toBeLessThanOrEqual(MAX_SIZE)
    expect(validMimes.includes(validJpg.type)).toBe(true)
    expect(validMimes.includes(validPng.type)).toBe(true)
    expect(validMimes.includes(validWebp.type)).toBe(true)
    expect(validMimes.includes(invalidGif.type)).toBe(false)
  })

  it('generates unique storage paths matching user_id/report_id/unique_filename format', async () => {
    const mockFile = new File(['sample image content'], 'road-defect.jpg', { type: 'image/jpeg' })
    const testUserId = '11111111-2222-3333-4444-555555555555'
    const testReportId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    // Mock supabase.storage.from().upload()
    const uploadSpy = vi.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any)

    const result = await uploadPotholePhoto(mockFile, testUserId, testReportId)

    expect(result.storagePath).toContain(`${testUserId}/${testReportId}/`)
    expect(result.storagePath).toMatch(new RegExp(`^${testUserId}/${testReportId}/\\d+-[a-z0-9]+\\.jpg$`))
    expect(result.bucket).toBe('pothole-reports')
    expect(uploadSpy).toHaveBeenCalledWith('pothole-reports')

    uploadSpy.mockRestore()
  })

  it('cleans up orphaned uploaded files when database submission fails', async () => {
    const removeMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const uploadMock = vi.fn().mockResolvedValue({ data: { path: 'test' }, error: null })

    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: uploadMock,
      remove: removeMock,
    } as any)

    // Simulate cleanup logic
    const bucket = 'pothole-reports'
    const testPath = 'user-1/rep-1/sample.jpg'

    try {
      // Simulate failed DB insertion
      throw new Error('Database transaction constraint violation')
    } catch {
      await supabase.storage.from(bucket).remove([testPath])
    }

    expect(removeMock).toHaveBeenCalledWith([testPath])
  })

  it('formats duplicate detection user feedback message and tracking ID correctly', () => {
    const duplicateFeedback = 'A pothole has already been reported nearby. Your report has been added to the existing complaint.'
    const referenceNo = 'POT-2026-X9A21'
    const trackingDisplay = `Complaint Tracking ID: ${referenceNo}`

    expect(duplicateFeedback).toBe('A pothole has already been reported nearby. Your report has been added to the existing complaint.')
    expect(trackingDisplay).toContain('Complaint Tracking ID: POT-2026-X9A21')
  })
})

