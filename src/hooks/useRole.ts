import { useAuth } from './useAuth'
import type { UserRole } from '../types/database'

export interface RoleState {
  role: UserRole
  isAdmin: boolean
  isCitizen: boolean
  isLoading: boolean
  refreshRole: () => Promise<void>
  userId: string | undefined
}

/**
 * Reusable role hook that derives permissions strictly from the server-controlled
 * user_roles and profiles database records.
 */
export const useRole = (): RoleState => {
  const { user, profile, isAdmin, isLoading, refreshProfile } = useAuth()

  const role: UserRole = isAdmin ? 'admin' : (profile?.role || 'citizen')

  return {
    role,
    isAdmin,
    isCitizen: !isAdmin,
    isLoading,
    refreshRole: refreshProfile,
    userId: user?.id,
  }
}

/**
 * Lightweight hook for checking administrator privileges in UI components.
 */
export const useIsAdmin = (): boolean => {
  const { isAdmin } = useRole()
  return isAdmin
}

