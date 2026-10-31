export type PotholeStatus =
  | 'New'
  | 'Under Review'
  | 'Approved'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'
  | 'Rejected'

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export type UserRole = 'citizen' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at?: string
}

export interface RepairTeam {
  id: string
  name: string
  leader_name: string
  contact_number: string
  zone: string
  status: 'active' | 'busy' | 'inactive'
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id?: string | null
  member_name: string
  role_in_team: 'leader' | 'technician' | 'operator' | 'driver' | 'inspector'
  contact_phone?: string | null
  is_active: boolean
  joined_at: string
}

export interface ComplaintAttachment {
  id: string
  report_id: string
  complaint_id: string
  storage_path: string
  public_url?: string | null
  file_name?: string | null
  file_size_bytes?: number | null
  mime_type?: string | null
  review_status?: 'pending' | 'approved' | 'rejected' | string
  is_approved: boolean
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string
}

export interface ComplaintReport {
  id: string
  complaint_id: string
  reporter_id: string
  reporter_name?: string | null
  description: string
  latitude: number
  longitude: number
  accuracy_meters?: number | null
  photo_url: string
  storage_path?: string | null
  attachment_id?: string
  attachments?: ComplaintAttachment[]
  is_approved_attachment: boolean
  is_primary: boolean
  distance_from_master?: number | null
  created_at: string
  reporter?: Profile
}

export interface Complaint {
  id: string
  reference_no: string
  title: string
  description: string
  latitude: number
  longitude: number
  address: string | null
  priority: PriorityLevel
  status: PotholeStatus
  assigned_team_id: string | null
  reporter_id: string
  is_public: boolean
  report_count?: number
  estimated_repair_date: string | null
  resolution_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  // Joins
  assigned_team?: RepairTeam | null
  reporter?: Profile | null
  reports?: ComplaintReport[]
  reports_count?: number
}

export interface ComplaintStatusHistory {
  id: string
  complaint_id: string
  from_status: PotholeStatus | null
  to_status: PotholeStatus
  notes: string | null
  changed_by: string | null
  created_at: string
  changer?: Profile | null
}

export interface RepairProgressNote {
  id: string
  complaint_id: string
  author_id: string
  note: string
  photo_url?: string | null
  created_at: string
  author?: Profile | null
}

export interface DuplicateMatchResult {
  id: string
  reference_no: string
  title: string
  status: PotholeStatus
  priority: PriorityLevel
  latitude: number
  longitude: number
  address: string | null
  distance_meters: number
  created_at: string
  reports_count: number
}

// Valid status transitions map per Requirement 10
export const VALID_STATUS_TRANSITIONS: Record<PotholeStatus, PotholeStatus[]> = {
  New: ['Under Review', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Assigned', 'Rejected'],
  Assigned: ['In Progress', 'Under Review'],
  'In Progress': ['Resolved', 'Assigned'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [], // Terminal state
  Rejected: ['Under Review'], // Can be reopened for review if new proof submitted
}

export function isValidTransition(from: PotholeStatus, to: PotholeStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

