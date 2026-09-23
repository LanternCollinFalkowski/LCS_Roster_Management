import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import type { PermissionKey } from "./lib/types";
import { AppShell } from "./components/shell/AppShell";
import { ConfigLayout } from "./components/shell/ConfigLayout";
import { LoadingState } from "./components/ui/misc";

import { SignInPage } from "./screens/SignIn";
import { DashboardPage } from "./screens/Dashboard";
import { RosterPage } from "./screens/Roster";
import { ReviewPage } from "./screens/Review";
import { TenantDetailPage } from "./screens/TenantDetail";
import { ActivityPage } from "./screens/Activity";
import { AttendancePage } from "./screens/Attendance";
import { TakeAttendancePage } from "./screens/TakeAttendance";
import { AttendanceDetailPage } from "./screens/AttendanceDetail";
import { ProfilePage } from "./screens/Profile";
import { MorePage } from "./screens/More";
import { AdminSites } from "./screens/admin/Sites";
import { AdminImport } from "./screens/admin/Import";
import { AdminPeople } from "./screens/admin/People";
import { AdminSettings, AdminSignInAccess } from "./screens/admin/Settings";
import { AdminApiKeys, AdminWebhooks, AdminWordPress } from "./screens/admin/Integrations";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-height grid place-items-center bg-appbg"><LoadingState /></div>;
  // Carry the requested path through sign-in so a shared link lands where it pointed.
  if (!user) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/signin?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Route-level permission gate. Hiding a nav item isn't access control; the API
 * enforces the same permissions — this only avoids rendering a screen of 403s.
 */
function RequirePermission({ anyOf }: { anyOf: PermissionKey[] }) {
  const { can, loading } = useAuth();
  if (loading) return <div className="grid h-full place-items-center"><LoadingState /></div>;
  if (!anyOf.some((p) => can(p))) return <Navigate to="/" replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.defaultLandingPage ?? "/review"} replace />;
}

/** First admin screen this person can actually open. */
function AdminHome() {
  const { can } = useAuth();
  if (can("sites.manage")) return <Navigate to="/admin/sites" replace />;
  if (can("users.manage")) return <Navigate to="/admin/people" replace />;
  if (can("integrations.manage")) return <Navigate to="/admin/api-keys" replace />;
  return <Navigate to="/admin/settings" replace />;
}

export function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/signin" element={user && !loading ? <HomeRedirect /> : <SignInPage />} />

      <Route element={<Protected><AppShell /></Protected>}>
        <Route index element={<HomeRedirect />} />
        <Route element={<RequirePermission anyOf={["roster.view"]} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/tenants/:id" element={<TenantDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/attendance/new" element={<TakeAttendancePage />} />
          <Route path="/attendance/:id" element={<AttendanceDetailPage />} />
        </Route>

        <Route element={<RequirePermission anyOf={["sites.manage", "users.manage", "integrations.manage", "settings.manage"]} />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route element={<ConfigLayout />}>
            <Route element={<RequirePermission anyOf={["sites.manage"]} />}>
              <Route path="/admin/sites" element={<AdminSites />} />
              <Route path="/admin/import" element={<AdminImport />} />
            </Route>
            <Route element={<RequirePermission anyOf={["users.manage"]} />}>
              <Route path="/admin/people" element={<AdminPeople />} />
            </Route>
            <Route element={<RequirePermission anyOf={["settings.manage"]} />}>
              <Route path="/admin/sign-in" element={<AdminSignInAccess />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
            <Route element={<RequirePermission anyOf={["integrations.manage"]} />}>
              <Route path="/admin/api-keys" element={<AdminApiKeys />} />
              <Route path="/admin/webhooks" element={<AdminWebhooks />} />
              <Route path="/admin/wordpress" element={<AdminWordPress />} />
            </Route>
          </Route>
        </Route>

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/more" element={<MorePage />} />
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
