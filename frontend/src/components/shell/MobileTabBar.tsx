import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Layers, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { PermissionKey } from "@/lib/types";
import { useReviewCount } from "./Sidebar";

/**
 * The phone's navigation. Four destinations, because four is what fits at a
 * 44px target across a phone — Activity, Admin and Profile are reached through
 * More (see `screens/More`) rather than being cut.
 */
const TABS: {
  to: string;
  label: string;
  icon: typeof Users;
  needs: PermissionKey[];
  /** Extra path prefixes that light this tab. */
  alsoActiveFor?: string[];
  exact?: boolean;
}[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, needs: ["roster.view"] },
  { to: "/roster", label: "Roster", icon: Users, needs: ["roster.view"], alsoActiveFor: ["/tenants"] },
  { to: "/review", label: "Review", icon: Layers, needs: ["roster.view"] },
  {
    to: "/more",
    label: "More",
    icon: Menu,
    // No permission gate: More always holds at least Profile.
    needs: [],
    alsoActiveFor: ["/activity", "/admin", "/profile"],
  },
];

export function MobileTabBar() {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const waiting = useReviewCount();

  const visible = TABS.filter((t) => t.needs.length === 0 || t.needs.some((p) => can(p)));

  return (
    <nav
      aria-label="Main"
      className="flex-none border-t border-hairline bg-surface px-2 pt-1.5 md:hidden"
      // 6px above the icons, 50px of icon, then the home-indicator strip —
      // which is the 6 / 50 / 38 the design's tab bar is built from once the
      // inset is a real 34px (see --safe-bottom in index.css).
      style={{ paddingBottom: "calc(4px + var(--safe-bottom))" }}
    >
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map((tab) => {
          const alsoActive = tab.alsoActiveFor?.some((prefix) => pathname.startsWith(prefix)) ?? false;
          const badge = tab.to === "/review" ? waiting : 0;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-[50px] flex-col items-center justify-center gap-[3px] rounded-input transition-colors",
                  isActive || alsoActive ? "bg-navsel text-accent dark:text-white" : "text-muted"
                )
              }
            >
              <tab.icon className="h-[22px] w-[22px]" />
              <span className="text-[10.5px] font-bold">{tab.label}</span>
              {badge > 0 && (
                <span
                  aria-label={`${badge} to review`}
                  className="absolute top-1 left-[calc(50%+8px)] flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-status-amberDot px-1 text-[10px] font-extrabold text-white"
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
