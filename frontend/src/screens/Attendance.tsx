import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ClipboardCheck, Plus, Search } from "lucide-react";
import { Page } from "@/components/shell/AppShell";
import { PhoneHeader } from "@/components/shell/PhoneHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/misc";
import { AttendanceExportButtons, AttendanceExportMenu } from "@/components/attendance/AttendanceExport";
import { useAttendanceList } from "@/lib/queries";
import { SitePicker, selectionLabel, useSiteSelection } from "@/lib/site";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/utils";
import type { AttendanceEvent } from "@/lib/types";

/**
 * Past attendance entries for whichever of my sites are selected, with a
 * "Take attendance" action and the same print/export pipeline as the roster.
 */
export function AttendancePage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { codes, setCodes, selected, param, isLoading: sitesLoading } = useSiteSelection();
  const [q, setQ] = useState("");
  const multiSite = selected.length > 1;
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useAttendanceList(param, q.trim(), selected.length > 0);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const canTake = can("roster.edit") && selected.length > 0;
  const exportView = { site: param, q: q.trim() };
  const subtitle = selected.length ? selectionLabel(codes, selected) : undefined;

  function takeAttendance() {
    const one = selected.length === 1 ? selected[0].code : undefined;
    navigate(one ? `/attendance/new?site=${encodeURIComponent(one)}` : "/attendance/new");
  }

  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or description" className="min-h-[44px] pl-9 md:min-h-9" type="search" enterKeyHint="search" />
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <PhoneHeader
        title="Attendance"
        subtitle={subtitle}
        back={{ to: "/more", label: "More" }}
        actions={
          <div className="flex gap-2">
            <AttendanceExportMenu view={exportView} disabled={selected.length === 0} />
            {canTake && (
              <Button onClick={takeAttendance} className="min-h-[44px] px-3.5" aria-label="Take attendance">
                <Plus className="h-5 w-5" /> Take
              </Button>
            )}
          </div>
        }
      >
        <div className="mt-3 flex flex-col gap-2.5">
          <SitePicker codes={codes} onChange={setCodes} />
          {search}
        </div>
      </PhoneHeader>

      <Page className="w-full flex-1 !px-0 md:!px-7">
        <div className="hidden md:block">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[23px] font-heading font-extrabold text-ink md:text-[24px]">Attendance</h1>
              {subtitle && <p className="mt-1 text-[13px] text-muted md:text-[13.5px]">{subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SitePicker codes={codes} onChange={setCodes} className="w-[240px]" />
              <AttendanceExportButtons view={exportView} disabled={selected.length === 0} />
              {canTake && (
                <Button onClick={takeAttendance}>
                  <Plus className="h-4 w-4" /> Take attendance
                </Button>
              )}
            </div>
          </div>
          <div className="mb-4">{search}</div>
        </div>

        {sitesLoading || isLoading ? (
          <LoadingState />
        ) : isError ? (
          <EmptyState title="Could not load attendance" hint={error instanceof Error ? error.message : "Try again in a moment."} />
        ) : selected.length === 0 ? (
          <EmptyState title="No sites assigned" hint="You aren't assigned to any sites yet." icon={<ClipboardCheck className="h-8 w-8" />} />
        ) : items.length === 0 ? (
          <EmptyState
            title={q ? "No matching attendance" : "No attendance taken yet"}
            hint={q ? "Try a different title or description." : canTake ? "Tap Take attendance to record the first one." : undefined}
            icon={<ClipboardCheck className="h-8 w-8" />}
          />
        ) : (
          <>
            <Card className="rounded-none border-x-0 md:rounded-card md:border-x">
              <ul>
                {items.map((e) => (
                  <AttendanceRow key={e.id} e={e} multiSite={multiSite} />
                ))}
              </ul>
            </Card>
            {hasNextPage && (
              <div className="flex justify-center py-5">
                <Button variant="secondary" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                  {isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </Page>
    </div>
  );
}

function AttendanceRow({ e, multiSite }: { e: AttendanceEvent; multiSite: boolean }) {
  return (
    <li className="border-b border-hairline last:border-0">
      <Link to={`/attendance/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-rowhover">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{e.title}</span>
          <span className="block truncate text-micro text-muted">
            {multiSite ? `${e.site.name} · ` : ""}
            {relativeTime(e.occurredAt)} · {e.createdByName}
          </span>
        </span>
        <span className="shrink-0 text-right text-micro text-muted">
          <span className="block font-semibold tabular text-ink">{e.presentCount} present</span>
          <span className="block tabular">{e.signedCount} signed</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
