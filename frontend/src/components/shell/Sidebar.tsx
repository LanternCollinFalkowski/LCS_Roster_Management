import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Layers, History, Settings,
  LogOut, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { PermissionKey } from "@/lib/types";
import { usePrefs } from "@/lib/prefs";
import { Avatar } from "@/components/ui/avatar";
import { useSites } from "@/lib/queries";
import { ThemedLogo } from "@/components/shell/ThemedLogo";

/**
 * Everyday destinations only. Configuration lives under Admin, navigated from
 * inside the page (see ConfigLayout) rather than growing the sidebar.
 */
const MAIN_NAV: {
  to: string;
  label: string;
  icon: typeof Users;
  /** Shown when the role grants any one of these. */
  needs: PermissionKey[];
  alsoActiveFor?: string[];
  badge?: "review";
}[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, needs: ["roster.view"] },
  { to: "/roster", label: "Roster", icon: Users, needs: ["roster.view"], alsoActiveFor: ["/tenants"] },
  { to: "/review", label: "Review", icon: Layers, needs: ["roster.view"], badge: "review" },
  { to: "/activity", label: "Activity", icon: History, needs: ["roster.view"] },
  {
    to: "/admin",
    label: "Admin",
    icon: Settings,
    needs: ["sites.manage", "users.manage", "integrations.manage", "settings.manage"],
  },
];

/** People waiting in the review queue across every site the user can see. */
export function useReviewCount(): number {
  const { data } = useSites();
  return (data ?? []).reduce((n, s) => n + s.attentionCount, 0);
}

function NavItem({ to, label, Icon, collapsed, alsoActiveFor, count }: {
  to: string;
  label: string;
  Icon: React.ElementType;
  collapsed: boolean;
  /** Extra path prefixes that should light this item up. */
  alsoActiveFor?: string[];
  count?: number;
}) {
  const { pathname } = useLocation();
  const alsoActive = alsoActiveFor?.some((p) => pathname.startsWith(p)) ?? false;
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex h-10 w-full items-center overflow-hidden rounded-input text-[13.5px] font-semibold transition-colors",
          isActive || alsoActive ? "bg-navsel text-accent dark:text-white" : "text-muted hover:bg-navsel/60 hover:text-ink"
        )
      }
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <Icon className="h-[18px] w-[18px]" />
        {collapsed && (count ?? 0) > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-amberDot" />}
      </span>
      <span className={cn("flex-1 overflow-hidden whitespace-nowrap transition-all duration-200", collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100")}>
        {label}
      </span>
      {!collapsed && (count ?? 0) > 0 && (
        <span className="mr-2 rounded-pill bg-status-amberBg px-1.5 py-0.5 text-micro font-bold tabular text-status-amberText">
          {count! > 999 ? "999+" : count}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { user, logout, can } = useAuth();
  const { collapsed, toggleCollapsed } = usePrefs();
  const reviewCount = useReviewCount();

  return (
    <aside
      style={{ width: collapsed ? 64 : 214 }}
      // Hidden on a phone: 214px of the 402px viewport, and the bottom tab bar
      // covers the same destinations. `hidden md:flex` rather than a conditional
      // render so the collapse preference survives a rotation without the whole
      // aside remounting.
      className={cn("hidden h-full shrink-0 flex-col border-r border-hairline bg-sidebar py-5 transition-[width,padding] duration-200 md:flex", collapsed ? "px-3" : "px-[15px]")}
    >
      {/* Brand lockup */}
      <div className="mb-5 flex items-center">
        <span className="flex h-11 w-10 shrink-0 items-center justify-center">
          <ThemedLogo />
        </span>
        <div className={cn("flex items-center overflow-hidden transition-all duration-200", collapsed ? "max-w-0 gap-0 opacity-0" : "max-w-[150px] gap-3 opacity-100")}>
          {/* ml-3 pairs with the container's gap-3 so the rule sits centred in
              the space between the mark and the wordmark. */}
          <span className="ml-3 h-9 w-[1.5px] shrink-0 bg-hairline" />
          <span className="whitespace-nowrap font-heading text-[21px] font-extrabold text-accent dark:text-white">Roster</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto scroll-thin">
        {MAIN_NAV.filter((n) => n.needs.some((p) => can(p))).map((n) => (
          <NavItem key={n.to} to={n.to} label={n.label} Icon={n.icon} collapsed={collapsed} alsoActiveFor={n.alsoActiveFor} count={n.badge === "review" ? reviewCount : undefined} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? "Expand" : "Collapse"}
        className="mb-2 flex h-10 w-full items-center overflow-hidden rounded-input text-[12.5px] font-semibold text-muted transition-colors hover:bg-navsel/60 hover:text-ink"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </span>
        <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-200", collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100")}>
          Collapse
        </span>
      </button>

      {/* User chip */}
      <div className="w-full overflow-hidden border-t border-hairline pt-3">
        <div className="flex w-full items-center">
          <NavLink to="/profile" className="flex h-8 w-10 shrink-0 items-center justify-center"><Avatar name={user?.name ?? "?"} color={user?.avatarColor} /></NavLink>
          <div className={cn("min-w-0 overflow-hidden transition-all duration-200", collapsed ? "max-w-0 flex-none opacity-0" : "max-w-[140px] flex-1 opacity-100")}>
            <NavLink to="/profile" className="block truncate text-[13px] font-semibold text-ink hover:text-accent dark:hover:text-white">{user?.name}</NavLink>
            <p className="truncate text-micro text-muted">{user?.role?.name}</p>
          </div>
          {!collapsed && (
            <button onClick={() => logout()} title="Sign out" className="shrink-0 text-muted hover:text-ink"><LogOut className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    </aside>
  );
}
