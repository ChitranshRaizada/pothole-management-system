import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getSignedPhotoUrl } from '../lib/storage'
import { isValidTransition } from '../types/database'
import type {
  Complaint,
  ComplaintReport,
  PotholeStatus,
  PriorityLevel,
  RepairTeam,
  RepairProgressNote,
  ComplaintStatusHistory,
} from '../types/database'

// Generate human-friendly reference number: POT-2026-XXXXX
export function generateReferenceNo(): string {
  const year = new Date().getFullYear()
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `POT-${year}-${randomStr}`
}

export function usePublicComplaints(filters?: {
  status?: string
  priority?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['public-complaints', filters],
    queryFn: async (): Promise<Complaint[]> => {
      if (!isSupabaseConfigured) return []

      const status = filters?.status || 'All'
      const priority = filters?.priority || 'All'
      const search = filters?.search || ''

      // Attempt 1: Query the existing database view `public_complaints_feed`
      try {
        let feedQuery = supabase
          .from('public_complaints_feed')
          .select('*')
          .order('created_at', { ascending: false })

        if (status !== 'All') {
          feedQuery = feedQuery.eq('status', status)
        }

        if (priority !== 'All') {
          feedQuery = feedQuery.eq('priority', priority)
        }

        if (search.trim() !== '') {
          feedQuery = feedQuery.or(
            `reference_no.ilike.%${search}%,title.ilike.%${search}%,address.ilike.%${search}%`
          )
        }

        const { data: feedData, error: feedError } = await feedQuery

        if (!feedError && feedData) {
          return (await Promise.all(
            (feedData || []).map(async (row: any) => {
              const photoPath = row.primary_photo_url || row.approved_photo_url
              const signedPhoto = photoPath ? await getSignedPhotoUrl(photoPath) : ''
              return {
                id: row.id,
                reference_no: row.reference_no,
                title: row.title,
                description: row.description,
                latitude: row.latitude,
                longitude: row.longitude,
                address: row.address,
                priority: row.priority,
                status: row.status,
                report_count: row.report_count || 1,
                resolution_notes: row.resolution_notes ?? null,
                resolved_at: row.resolved_at ?? null,
                created_at: row.created_at,
                updated_at: row.updated_at,
                is_public: true,
                reporter_id: '',
                assigned_team_id: null,
                estimated_repair_date: row.estimated_repair_date ?? null,
                reports_count: row.reports_count || row.report_count || 1,
                reports: photoPath
                  ? [
                    {
                      id: `att-${row.id}`,
                      complaint_id: row.id,
                      reporter_id: '',
                      description: '',
                      latitude: row.latitude,
                      longitude: row.longitude,
                      storage_path: photoPath,
                      photo_url: signedPhoto,
                      is_approved_attachment: true,
                      is_primary: true,
                      created_at: row.created_at,
                    },
                  ]
                  : [],
              }
            })
          )) as Complaint[]
        }
      } catch {
        // Fallback to table queries with RLS enforcement below
      }

      // Attempt 2: Direct query against complaints table with PostgREST joins.
      // RLS Policy "Public can view approved complaints" enforces is_public = true on server-side.
      let query = supabase
        .from('complaints')
        .select(`
          id,
          reference_no,
          title,
          description,
          latitude,
          longitude,
          address,
          priority,
          status,
          report_count,
          resolution_notes,
          resolved_at,
          created_at,
          updated_at,
          is_public,
          reports:reports(
            id,
            complaint_id,
            latitude,
            longitude,
            created_at,
            attachments:report_attachments(
              id,
              storage_path,
              public_url,
              is_approved
            )
          )
        `)
        .eq('is_public', true)
        .in('status', ['Approved', 'Assigned', 'In Progress', 'Resolved', 'Closed'])
        .order('created_at', { ascending: false })

      if (status !== 'All') {
        query = query.eq('status', status)
      }

      if (priority !== 'All') {
        query = query.eq('priority', priority)
      }

      if (search.trim() !== '') {
        query = query.or(
          `reference_no.ilike.%${search}%,title.ilike.%${search}%,address.ilike.%${search}%`
        )
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching approved public complaints:', error)
        throw error
      }

      // Filter reports so ONLY reviewed approved attachments are exposed (protecting private photos and metadata)
      const formatted = await Promise.all(
        (data || []).map(async (complaint: any) => {
          const approvedReports = (
            await Promise.all(
              (complaint.reports || []).map(async (r: any) => {
                const approvedAtt = (r.attachments || []).find((a: any) => a.is_approved)
                if (!approvedAtt) return null
                const signed = approvedAtt.storage_path
                  ? await getSignedPhotoUrl(approvedAtt.storage_path)
                  : ''
                return {
                  id: r.id,
                  complaint_id: complaint.id,
                  reporter_id: '', // Never expose citizen IDs
                  description: '', // Private description withheld
                  latitude: r.latitude,
                  longitude: r.longitude,
                  storage_path: approvedAtt.storage_path || null,
                  photo_url: signed || approvedAtt.public_url || '',
                  is_approved_attachment: true,
                  is_primary: false,
                  created_at: r.created_at,
                }
              })
            )
          ).filter(Boolean)

          return {
            ...complaint,
            reporter_id: '', // Never expose citizen reporter ID
            reports: approvedReports,
            reports_count: complaint.report_count || approvedReports.length || 1,
          }
        })
      )

      return formatted as Complaint[]
    },
    staleTime: 1000 * 30, // 30 seconds
  })
}


export function useMyComplaints(reporterId: string | undefined) {
  return useQuery({
    queryKey: ['my-complaints', reporterId],

    queryFn: async (): Promise<Complaint[]> => {
      if (!isSupabaseConfigured || !reporterId) return []

      // STEP 1: Find every report submitted by this citizen.
      // This includes original reports AND duplicate reports.
      const { data: myReports, error: reportsError } = await supabase
        .from('reports')
        .select('complaint_id')
        .eq('reporter_id', reporterId)

      if (reportsError) {
        console.error('Error fetching citizen reports:', reportsError)
        throw reportsError
      }

      // STEP 2: Extract unique complaint cluster IDs.
      const complaintIds = [
        ...new Set(
          (myReports || [])
            .map((report: any) => report.complaint_id)
            .filter((id): id is string => Boolean(id))
        ),
      ]

      // Citizen has not submitted any reports.
      if (complaintIds.length === 0) return []

      // STEP 3: Fetch all complaint clusters linked to their reports.
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          assigned_team:repair_teams(*),
          reports:reports(
            *,
            attachments:report_attachments(*)
          )
        `)
        .in('id', complaintIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching citizen complaint clusters:', error)
        throw error
      }

      // STEP 4: Format reports and generate signed photo URLs.
      const formatted = await Promise.all(
        (data || []).map(async (complaint: any) => {
          const mappedReports = await Promise.all(
            (complaint.reports || []).map(async (r: any) => {
              const att =
                (r.attachments || []).find((a: any) => a.is_approved) ||
                r.attachments?.[0]

              const storagePath =
                att?.storage_path || r.storage_path || null

              const signed = storagePath
                ? await getSignedPhotoUrl(storagePath)
                : ''

              return {
                ...r,
                storage_path: storagePath,
                photo_url:
                  signed || att?.public_url || r.photo_url || '',
                is_approved_attachment: att?.is_approved ?? false,
                attachments: r.attachments || [],
              }
            })
          )

          return {
            ...complaint,
            reports: mappedReports,
          }
        })
      )

      return formatted as Complaint[]
    },

    enabled: Boolean(reporterId),
  })
}


export function useComplaintDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['complaint-detail', id],
    queryFn: async () => {
      if (!isSupabaseConfigured || !id) return null

      // Fetch complaint
      const { data: complaint, error: complaintError } = await supabase
        .from('complaints')
        .select(`
          *,
          assigned_team:repair_teams(*)
        `)
        .eq('id', id)
        .single()

      if (complaintError) throw complaintError

      // Fetch reporter profile separately to avoid cross-schema join failure
      let reporterProfile = null
      if (complaint.reporter_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', complaint.reporter_id)
          .maybeSingle()
        reporterProfile = prof
      }

      // Fetch all individual reports with their attachments
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select(`
          *,
          attachments:report_attachments(*)
        `)
        .eq('complaint_id', id)
        .order('created_at', { ascending: true })

      if (reportsError) throw reportsError

      const reports = await Promise.all(
        (reportsData || []).map(async (r: any) => {
          const att = (r.attachments || []).find((a: any) => a.is_approved) || r.attachments?.[0]
          const storagePath = att?.storage_path || r.storage_path || null
          const signed = storagePath ? await getSignedPhotoUrl(storagePath) : ''
          return {
            ...r,
            storage_path: storagePath,
            photo_url: signed || att?.public_url || r.photo_url || '',
            is_approved_attachment: att?.is_approved ?? false,
            attachment_id: att?.id,
            reporter: { full_name: r.reporter_name },
            attachments: r.attachments || [],
          }
        })
      )

      // Fetch status history
      const { data: historyData, error: historyError } = await supabase
        .from('complaint_status_history')
        .select('*')
        .eq('complaint_id', id)
        .order('created_at', { ascending: true })

      if (historyError) throw historyError

      // Fetch changers for history
      const history = await Promise.all(
        (historyData || []).map(async (h: any) => {
          if (h.changed_by) {
            const { data: changer } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', h.changed_by)
              .maybeSingle()
            return { ...h, changer }
          }
          return h
        })
      )

      // Fetch progress notes from status history items that contain notes
      const notes: RepairProgressNote[] = (history || [])
        .filter((h: any) => h.notes)
        .map((h: any) => ({
          id: h.id,
          complaint_id: h.complaint_id,
          author_id: h.changed_by || '',
          note: h.notes,
          photo_url: null,
          created_at: h.created_at,
          author: h.changer,
        }))

      return {
        complaint: {
          ...complaint,
          reporter: reporterProfile,
        } as Complaint,
        reports: reports as ComplaintReport[],
        history: history as ComplaintStatusHistory[],
        notes: notes as RepairProgressNote[],
      }
    },
    enabled: Boolean(id),
  })
}

export function useAdminComplaints(filters?: {
  status?: string
  priority?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['admin-complaints', filters],
    queryFn: async (): Promise<Complaint[]> => {
      if (!isSupabaseConfigured) return []

      let query = supabase
        .from('complaints')
        .select(`
          *,
          assigned_team:repair_teams(*),
          reports:reports(
            *,
            attachments:report_attachments(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'All') {
        query = query.eq('status', filters.status)
      }

      if (filters?.priority && filters.priority !== 'All') {
        query = query.eq('priority', filters.priority)
      }

      if (filters?.search && filters.search.trim() !== '') {
        query = query.or(
          `reference_no.ilike.%${filters.search}%,title.ilike.%${filters.search}%,address.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching admin complaints:', error)
        throw error
      }

      const formatted = await Promise.all(
        (data || []).map(async (item: any) => {
          const mappedReports = await Promise.all(
            (item.reports || []).map(async (r: any) => {
              const att = (r.attachments || []).find((a: any) => a.is_approved) || r.attachments?.[0]
              const storagePath = att?.storage_path || r.storage_path || null
              const signed = storagePath ? await getSignedPhotoUrl(storagePath) : ''
              return {
                ...r,
                storage_path: storagePath,
                photo_url: signed || att?.public_url || r.photo_url || '',
                is_approved_attachment: att?.is_approved ?? false,
                attachments: r.attachments || [],
              }
            })
          )
          return {
            ...item,
            reports: mappedReports,
            reports_count: mappedReports.length || item.report_count || 0,
          }
        })
      )
      return formatted as Complaint[]
    },
  })
}

export function useRepairTeams() {
  return useQuery({
    queryKey: ['repair-teams'],
    queryFn: async (): Promise<RepairTeam[]> => {
      if (!isSupabaseConfigured) return []
      const { data, error } = await supabase
        .from('repair_teams')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return (data || []) as RepairTeam[]
    },
  })
}

// Upload file to Supabase Storage bucket 'pothole-reports'
export async function uploadPotholePhoto(
  file: File,
  userId: string,
  reportId?: string
): Promise<{ storagePath: string; bucket: string; publicUrl?: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.')
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const repId = reportId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rep-${Date.now()}`)
  const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
  const fileName = `${userId}/${repId}/${uniqueFileName}`

  // Exact private bucket name per project specification: 'pothole-reports'
  const bucketName = 'pothole-reports'
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    })

  if (uploadError) {
    const errObj = uploadError as any
    if (errObj.statusCode === '404' || errObj.message?.toLowerCase().includes('bucket not found')) {
      throw new Error(
        `Storage error: Bucket 'pothole-reports' not found in connected Supabase project (${import.meta.env.VITE_SUPABASE_URL}). Please verify that a private bucket named 'pothole-reports' is created.`
      )
    }
    if (errObj.statusCode === '403' || errObj.code === 'AccessDenied' || errObj.message?.includes('row-level security')) {
      throw new Error(
        `Storage error: Storage Row-Level Security (RLS) policy missing for bucket 'pothole-reports'. Please run the storage policy migration in your Supabase SQL Editor to enable citizen uploads.`
      )
    }
    if (errObj.statusCode === '415' || errObj.code === 'InvalidMimeType') {
      throw new Error(
        `Storage error: Invalid MIME type. Only JPEG, PNG, and WebP images are permitted in 'pothole-reports'.`
      )
    }
    throw uploadError
  }

  return {
    storagePath: fileName,
    bucket: bucketName,
    publicUrl: '',
  }
}

export interface SubmitComplaintParams {
  title: string
  description?: string
  latitude: number
  longitude: number
  accuracyMeters?: number
  address: string
  priority: PriorityLevel
  photoFile: File
  reporterId?: string
  reporterName?: string
  // Duplicate linking
  linkToComplaintId?: string
  distanceFromMaster?: number
}

export function useSubmitComplaint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SubmitComplaintParams) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.')
      }

      // Feature 1: Retrieve authenticated citizen session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.user) {
        throw new Error('Authentication required. Only authenticated citizens can submit pothole reports.')
      }

      const authenticatedReporterId = session.user.id
      const reportId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rep-${Date.now()}`

      // Feature 3: Upload photo to private storage bucket with path user_id/report_id/unique_filename
      const uploadResult = await uploadPotholePhoto(params.photoFile, authenticatedReporterId, reportId)
      const storagePath = uploadResult.storagePath

      // Feature 4: Trim and validate description
      const trimmedDescription = (params.description || '').trim() || 'Civic road defect reported via mobile application.'

      // Feature 5 & 6: Execute transactional backend submission with orphan file cleanup on failure
      try {
        // Step 2: Try atomic RPC function submit_pothole_report first
        const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_pothole_report', {
          p_title: params.title.trim() || 'Road Defect',
          p_description: trimmedDescription,
          p_latitude: params.latitude,
          p_longitude: params.longitude,
          p_address: params.address,
          p_priority: params.priority,
          p_photo_storage_path: storagePath,
          p_photo_public_url: null, // Private photo pending review
          p_accuracy_meters: params.accuracyMeters ?? null,
          p_link_to_complaint_id: params.linkToComplaintId ?? null,
        })

        if (!rpcError && rpcResult) {
          return {
            complaintId: rpcResult.complaint_id,
            referenceNo: rpcResult.reference_no,
            reportId: rpcResult.report_id,
            isDuplicateLinked: rpcResult.is_duplicate,
            distanceMeters: rpcResult.distance_meters,
          }
        }

        // If RPC had an explicit error (other than not found), rethrow
        if (rpcError && rpcError.code !== '42883') {
          throw rpcError
        }

        // Step 3: Fallback direct insertion (if RPC not deployed)
        if (params.linkToComplaintId) {
          // Link to existing complaint
          const { data: reportData, error: reportError } = await supabase
            .from('reports')
            .insert({
              id: reportId,
              complaint_id: params.linkToComplaintId,
              reporter_id: authenticatedReporterId,
              reporter_name: params.reporterName,
              description: trimmedDescription,
              latitude: params.latitude,
              longitude: params.longitude,
              accuracy_meters: params.accuracyMeters,
              is_primary: false,
              distance_from_master: params.distanceFromMaster ?? 0,
            })
            .select()
            .single()

          if (reportError) throw reportError

          await supabase.from('report_attachments').insert({
            report_id: reportData.id,
            complaint_id: params.linkToComplaintId,
            storage_path: storagePath,
            public_url: null,
            is_approved: false,
          })

          return {
            complaintId: params.linkToComplaintId,
            reportId: reportData.id,
            isDuplicateLinked: true,
          }
        }

        // Create new master complaint
        const referenceNo = generateReferenceNo()
        const { data: complaintData, error: complaintError } = await supabase
          .from('complaints')
          .insert({
            reference_no: referenceNo,
            title: params.title.trim() || 'Road Defect',
            description: trimmedDescription,
            latitude: params.latitude,
            longitude: params.longitude,
            address: params.address,
            priority: params.priority,
            status: 'New',
            reporter_id: authenticatedReporterId,
            is_public: false, // New reports start unapproved
          })
          .select()
          .single()

        if (complaintError) throw complaintError

        // Insert primary report into reports
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .insert({
            id: reportId,
            complaint_id: complaintData.id,
            reporter_id: authenticatedReporterId,
            reporter_name: params.reporterName,
            description: trimmedDescription,
            latitude: params.latitude,
            longitude: params.longitude,
            accuracy_meters: params.accuracyMeters,
            is_primary: true,
            distance_from_master: 0,
          })
          .select()
          .single()

        if (reportError) throw reportError

        // Insert attachment into report_attachments
        await supabase.from('report_attachments').insert({
          report_id: reportData.id,
          complaint_id: complaintData.id,
          storage_path: storagePath,
          public_url: null,
          is_approved: false,
        })

        return {
          complaintId: complaintData.id,
          referenceNo: complaintData.reference_no,
          reportId: reportData.id,
          isDuplicateLinked: false,
        }
      } catch (submissionError) {
        // Feature 8: Security - Clean up orphaned uploaded file if database submission fails
        try {
          await supabase.storage.from(uploadResult.bucket).remove([storagePath])
        } catch (cleanupErr) {
          console.warn('Orphan file cleanup warning:', cleanupErr)
        }
        throw submissionError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
    },
  })
}

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      complaintId,
      currentStatus,
      newStatus,
      notes,
    }: {
      complaintId: string
      currentStatus: PotholeStatus
      newStatus: PotholeStatus
      notes?: string
    }) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured.')
      }

      // Enforce valid transitions per Requirement 10
      if (!isValidTransition(currentStatus, newStatus)) {
        throw new Error(
          `Invalid status transition from "${currentStatus}" to "${newStatus}".`
        )
      }

      const updates: Record<string, any> = {
        status: newStatus,
        resolution_notes: notes ?? null,
      }

      if (newStatus === 'Resolved') {
        updates.resolved_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaintId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['public-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-detail', variables.complaintId] })
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] })
    },
  })
}

export function useUpdateComplaintPriority() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      complaintId,
      priority,
    }: {
      complaintId: string
      priority: PriorityLevel
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

      const { data, error } = await supabase
        .from('complaints')
        .update({ priority })
        .eq('id', complaintId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-detail', variables.complaintId] })
    },
  })
}

export function useAssignTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      complaintId,
      teamId,
      estimatedDate,
    }: {
      complaintId: string
      teamId: string
      estimatedDate?: string
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

      const { data, error } = await supabase
        .from('complaints')
        .update({
          assigned_team_id: teamId,
          estimated_repair_date: estimatedDate ?? null,
          status: 'Assigned',
        })
        .eq('id', complaintId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaint-detail', variables.complaintId] })
    },
  })
}

export function useApproveReportAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reportId,
      isApproved,
    }: {
      reportId: string
      complaintId: string
      isApproved: boolean
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

      const { data, error } = await supabase
        .from('report_attachments')
        .update({
          is_approved: isApproved,
          reviewed_at: new Date().toISOString(),
        })
        .eq('report_id', reportId)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint-detail', variables.complaintId] })
      queryClient.invalidateQueries({ queryKey: ['public-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
    },
  })
}

export function useAddProgressNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      complaintId,
      authorId,
      note,
      photoFile,
    }: {
      complaintId: string
      authorId: string
      note: string
      photoFile?: File | null
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

      let photoUrl: string | null = null
      if (photoFile) {
        const uploadResult = await uploadPotholePhoto(photoFile, authorId)
        photoUrl = uploadResult.publicUrl || null
      }

      // Query current complaint status
      const { data: comp } = await supabase
        .from('complaints')
        .select('status')
        .eq('id', complaintId)
        .single()

      const currentStatus = comp?.status || 'In Progress'
      const noteContent = photoUrl ? `${note}\n[Photo Attachment: ${photoUrl}]` : note

      const { data, error } = await supabase
        .from('complaint_status_history')
        .insert({
          complaint_id: complaintId,
          from_status: currentStatus,
          to_status: currentStatus,
          notes: noteContent,
          changed_by: authorId,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaint-detail', variables.complaintId] })
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
    },
  })
}

export function useRelinkReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reportId,
      newComplaintId,
    }: {
      reportId: string
      newComplaintId: string
    }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')

      const { data, error } = await supabase
        .from('reports')
        .update({ complaint_id: newComplaintId, is_primary: false })
        .eq('id', reportId)
        .select()
        .single()

      if (error) throw error

      // Also update attachment references to new complaint_id
      await supabase
        .from('report_attachments')
        .update({ complaint_id: newComplaintId })
        .eq('report_id', reportId)

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['public-complaints'] })
    },
  })
}
