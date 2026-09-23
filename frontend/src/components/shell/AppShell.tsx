import { Link, Outlet } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";

/**
 * Full-page shell.
 *
 * Desktop: fixed sidebar beside a scrollable main column. Phone: the sidebar is
 * gone and the same main column sits above a bottom tab bar. The bar is a flex
 * sibling rather than a fixed overlay, so `<main>`'s own scroll region ends
 * exactly where the bar begins — screens with their own sticky footer (the
 * bill review's approve bar) then stack against it correctly, which they cannot
 * do against something floating outside the layout.
 */
export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-appbg md:flex-row">
      <Sidebar />
      {/* scrollbar-gutter keeps the scrollbar's space reserved even when the
          page is short, so content doesn't jump sideways when a list grows or
          shrinks past the fold (collapsing roster sites, filtering). */}
      <main className="min-h-0 flex-1 overflow-y-auto scroll-thin bg-surface [scrollbar-gutter:stable]">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}

/**
 * Standard page container.
 *
 * The phone gutter is 16px against the desktop's 28px — at 402px wide, 28px a
 * side spends a seventh of the screen on margin.
 */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1240px] px-4 py-4 md:px-7 md:py-7 ${className ?? ""}`}>{children}</div>;
}

/**
 * The way back out of a screen the phone reaches through More.
 *
 * Phone-only: on desktop the sidebar is permanently on screen, so the same link
 * would be a second, redundant route to a destination already one click away.
 */
export function MobileBackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 px-2 text-[13.5px] font-semibold text-accent dark:text-white md:hidden"
    >
      <ChevronLeft className="h-[17px] w-[17px]" /> {label}
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-6 md:gap-4">
      <div className="min-w-0">
        <h1 className="text-[23px] font-heading font-extrabold text-ink md:text-[24px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted md:text-[13.5px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
