# RoadCare: Production Pothole Reporting & Management System

A production-oriented, mobile-first web application for road defect reporting and municipal management built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, **React Router 7**, **TanStack Query v5**, and **Supabase** (PostgreSQL & Storage).

---

## 🎨 Palette Specifications (from Design Image)
The visual identity and design system are strictly derived from the provided color palette:
- **Base Noir (`#0B0B0F`)**: Deep viewport canvas backdrop, high contrast dark theme base.
- **Deep Wine (`#2A0F16`)**: Surfaces, elevated cards, navigation containers, dialog backdrops.
- **Velvet Wine (`#5B1A2A`)**: Primary brand accents, action buttons, active navigation states.
- **Warm Taupe (`#B08D7A`)**: Secondary brand borders, hazard indicators, cluster markers, timestamps.
- **Linen Cream (`#F2E7E1`)**: High legibility roadside typography, light contrast accents.

---

## 🚀 Key Production Capabilities

1. **Dual Role-Based Portals**:
   - **Citizen Portal**: Roadside hazard reporting with rear-camera snapshot, GPS coordinates, live 20m duplicate alert, public OpenStreetMap, personal complaints list, and status timeline.
   - **Administrator Portal**: Real-time analytics, intake photo review & attachment verification, 20m duplicate cluster management, priority matrix triage, repair squad assignment, and repair progress notes.
2. **Server-Controlled Administrator Role**:
   - Role defaults to `'citizen'` upon Google OAuth sign-in.
   - Database Row Level Security (RLS) prevents client-side self-escalation.
   - Admin routes guarded by verified database query (`role === 'admin'`).
3. **20-Meter Duplicate Detection (Requirement 8)**:
   - PostgreSQL Haversine distance calculator function `find_nearest_active_complaint(lat, lon, 20.0)`.
   - When multiple active complaints match within 20m, automatically selects the nearest eligible complaint.
   - Preserves every citizen's individual photograph, description, reporter identity, GPS coordinates, and timestamp in `complaint_reports`.
4. **Public Map Privacy (Requirement 9)**:
   - Unapproved complaints (`New`, `Under Review`, `Rejected`) and unreviewed report attachments remain hidden from the public map.
   - Visible on public map only once approved by administrators (`Approved`, `Assigned`, `In Progress`, `Resolved`, `Closed`).
5. **Strict Status Lifecycle (Requirement 10)**:
   - Statuses: `New`, `Under Review`, `Approved`, `Assigned`, `In Progress`, `Resolved`, `Closed`, `Rejected`.
   - Valid transition state machine enforced both in PostgreSQL trigger `trg_validate_complaint_status_transition` and frontend client.

---

## 📦 Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Project Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

---

## 🛠️ Supabase Database & Dashboard Setup

### 1. Run Database Migrations
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Open [`supabase/migrations/20261030_init_pothole_system.sql`](supabase/migrations/20261030_init_pothole_system.sql).
3. Paste the contents into the SQL Editor and click **Run**.
   - This sets up `profiles`, `repair_teams`, `complaints`, `complaint_reports`, `complaint_status_history`, `repair_progress_notes`, RLS policies, the 20m Haversine distance function, and status transition triggers.

### 2. Configure Google OAuth in Supabase
1. In the Supabase Dashboard, navigate to **Authentication** -> **Providers** -> **Google**.
2. Toggle **Enable Google provider**.
3. Create OAuth 2.0 Credentials in [Google Cloud Console](https://console.cloud.google.com/):
   - Set **Authorized redirect URIs** to: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client Secret** into your Supabase Google Provider settings.
4. Save the configuration.

### 3. Provisioning the Initial Administrator
Because self-escalation is strictly prohibited by database RLS, designate an administrator account using the Supabase SQL Editor:

```sql
-- Replace with the Google account email of your administrator
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

### 4. Storage Bucket Configuration
The migration automatically configures the `pothole-photos` storage bucket with public read for approved photos and authenticated upload for users. Verify in **Storage** -> **pothole-photos** that the bucket exists and is set to public.

---

## 🧪 Testing & Verification

Run the test suite:
```bash
npm test
```
The test suite validates:
- Image palette compliance (`#0B0B0F`, `#2A0F16`, `#5B1A2A`, `#B08D7A`, `#F2E7E1`).
- Geospatial Haversine calculation and 20-meter boundary detection.
- Nearest active duplicate selection algorithm.
- Status transition validation rules.
- Reference number format validation (`POT-YYYY-XXXXX`).

Build the production bundle:
```bash
npm run build
```

Run preview:
```bash
npm run preview
```
