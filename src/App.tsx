import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { CitizenLayout } from './components/layout/CitizenLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { RequireAuth, RequireAdmin } from './components/auth/ProtectedRoute'

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage'
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage'

// Citizen Pages
import { PublicMapPage } from './pages/citizen/PublicMapPage'
import { ReportPotholePage } from './pages/citizen/ReportPotholePage'
import { MyComplaintsPage } from './pages/citizen/MyComplaintsPage'
import { ComplaintDetailPage } from './pages/citizen/ComplaintDetailPage'
import { ProfilePage } from './pages/citizen/ProfilePage'

// Admin Pages
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage'
import { ComplaintReviewPage } from './pages/admin/ComplaintReviewPage'
import { DuplicateManagementPage } from './pages/admin/DuplicateManagementPage'
import { PrioritisationPage } from './pages/admin/PrioritisationPage'
import { TeamAssignmentPage } from './pages/admin/TeamAssignmentPage'
import { RepairProgressPage } from './pages/admin/RepairProgressPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Dedicated Login Gateway */}
            <Route path="/login" element={<LoginPage />} />

            {/* Supabase OAuth Callback Route */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Authenticated Citizen Experience Routes (Prompt user to login first) */}
            <Route
              element={
                <RequireAuth>
                  <CitizenLayout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<PublicMapPage />} />
              <Route path="/report" element={<ReportPotholePage />} />
              <Route path="/my-complaints" element={<MyComplaintsPage />} />
              <Route path="/complaint/:id" element={<ComplaintDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Administrator Experience Routes (Protected by Server-Controlled Admin Role) */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<AdminAnalyticsPage />} />
              <Route path="review" element={<ComplaintReviewPage />} />
              <Route path="duplicates" element={<DuplicateManagementPage />} />
              <Route path="prioritisation" element={<PrioritisationPage />} />
              <Route path="teams" element={<TeamAssignmentPage />} />
              <Route path="progress" element={<RepairProgressPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
