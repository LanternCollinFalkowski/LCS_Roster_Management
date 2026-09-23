import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Plus, Search, UserMinus, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/AppShell";
import { PhoneHeader } from "@/components/shell/PhoneHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { TenantStatusBadge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/misc";
import { AddResident } from "@/components/roster/AddResident";
import { RosterExportButtons, RosterExportMenu } from "@/components/roster/RosterExport";
import { RemoveDialog } from "@/components/roster/RemoveDialog";
import { useRosterActions } from "@/components/roster/useRosterActions";
import { useTenants } from "@/lib/queries";
import { SitePicker, selectionLabel, useSiteSelection } from "@/lib/site";
import { useAuth } from "@/lib/auth";
import { cn, formatDate, relativeTime, tintFor } from "@/lib/utils";
import type { Tenant } from "@/lib/types";

type Tab = "active" | "attention" | "archived";

const COLLAPSED_KEY = "ln.roster.collapsed";

/** Which site groups are folded, remembered per device. */
function useCollapsedSites() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      return new Set(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      // Not worth failing over.
    }
  }, [collapsed]);
  const toggle = (siteId: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  return { collapsed, setCollapsed, toggle };
}

/**
 * The living roster for whichever of my sites are selected — All by default.
 * The whole selection comes down in one request (every Lantern site together
 * is ~2,000 people) and search filters in memory, so typing is instant on a
 * phone with a weak signal in a stairwell. With more than one site in view the
 * list is grouped under a heading per site.
 */
export function RosterPage() {
  const { can } = useAuth();
  const { codes, setCodes, selected, sites, param, isLoading: sitesLoading } = useSiteSelection();
  const multiSite = selected.length > 1;
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "active";
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Tenant | null>(null);
  const { remove, restore } = useRosterActions();
  const { collapsed, setCollapsed, toggle: toggleSite } = useCollapsedSites();

  // "attention" is a view of the active list, so it reuses that request.
  const { data, isLoading } = useTenants(param, tab === "archived" ? "archived" : "active", selected.length > 0);
  const all = data?.items ?? [];

  const rows = useMemo(() => {
    const base = tab === "attention" ? all.filter((t) => t.needsAttention) : all;
    if (!query) return base;
    return base.filter((t) =>
      [t.displayName, t.firstName, t.lastName, t.preferredName, t.unit, multiSite ? t.site?.name : null].some((v) =>
        v?.toLowerCase().includes(query)
      )
    );
  }, [all, tab, query, multiSite]);

  // Grouped by site whenever more than one is in view. The archived tab is
  // sorted by removal date across sites, so it stays one flat list.
  const grouped = multiSite && tab !== "archived";
  const groups = useMemo(() => {
    const m = new Map<string, { count: number; attention: number }>();
    for (const t of rows) {
      const g = m.get(t.siteId) ?? { count: 0, attention: 0 };
      g.count++;
      if (t.needsAttention) g.attention++;
      m.set(t.siteId, g);
    }
    return m;
  }, [rows]);
  // A search looks through folded sites too — hiding a match would read as "not found".
  const isFolded = (siteId: string) => grouped && !query && collapsed.has(siteId);
  const allFolded = grouped && [...groups.keys()].every((id) => collapsed.has(id));

  const onRoster = selected.reduce((n, s) => n + s.activeCount, 0);
  const attention = tab === "archived" ? selected.reduce((n, s) => n + s.attentionCount, 0) : all.filter((t) => t.needsAttention).length;

  function setTab(next: Tab) {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  }

  const canAdd = can("roster.edit") && selected.length > 0;
  // Exports and printouts are of exactly this: selection, tab and search.
  const exportView = { site: param, status: tab, q };
  const subtitle = selected.length ? `${selectionLabel(codes, sites)} · ${onRoster.toLocaleString()} on roster` : undefined;

  const controls = (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or unit"
          className="min-h-[44px] pl-9 md:min-h-9"
          type="search"
          enterKeyHint="search"
        />
      </div>
      <div className="grid grid-cols-3 rounded-input bg-navsel/60 p-0.5" role="tablist">
        {(
          [
            ["active", "On roster", onRoster],
            ["attention", "Review", attention],
            ["archived", "Removed", undefined],
          ] as [Tab, string, number | undefined][]
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex min-h-[38px] items-center justify-center gap-1.5 rounded-[5px] px-2 text-[12.5px] font-bold transition-colors md:min-h-[30px]",
              tab === key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn("tabular text-micro", key === "attention" ? "text-status-amberText" : "text-muted")}>{count}</span>
            )}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex min-h-full flex-col">
      <PhoneHeader
        title="Roster"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <RosterExportMenu view={exportView} disabled={selected.length === 0} />
            {canAdd && (
              <Button onClick={() => setAdding(true)} className="min-h-[44px] px-3.5" aria-label="Add resident">
                <Plus className="h-5 w-5" /> Add
              </Button>
            )}
          </div>
        }
      >
        <div className="mt-3 flex flex-col gap-2.5">
          <SitePicker codes={codes} onChange={setCodes} />
          {controls}
        </div>
      </PhoneHeader>

      <Page className="w-full flex-1 !px-0 md:!px-7">
        <div className="hidden md:block">
          <PageHeader
            title="Roster"
            subtitle={subtitle}
            actions={
              <>
                <SitePicker codes={codes} onChange={setCodes} className="w-[240px]" />
                <RosterExportButtons view={exportView} disabled={selected.length === 0} />
                {canAdd && (
                  <Button onClick={() => setAdding(true)}>
                    <Plus className="h-4 w-4" /> Add resident
                  </Button>
                )}
              </>
            }
          />
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_340px] gap-3">{controls}</div>
        </div>

        {sitesLoading || isLoading ? (
          <LoadingState />
        ) : selected.length === 0 ? (
          <EmptyState title="No sites assigned" hint="You aren't assigned to any sites yet, so there's no roster to show. Ask an administrator to add you to one." icon={<Users className="h-8 w-8" />} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={query ? "Nobody matches" : tab === "archived" ? "Nobody removed yet" : tab === "attention" ? "Nobody to review" : "Nobody on this roster"}
            hint={query ? "Try a unit number or part of a name." : tab === "active" && canAdd ? "Tap Add to put the first person on." : undefined}
          />
        ) : (
          <>
          {grouped && (
            <div className="mb-2 flex items-center justify-between px-4 md:px-0">
              <span className="text-micro text-muted">
                {groups.size} sites{query ? " · showing matches in every site" : ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => {
                    const next = new Set(c);
                    for (const id of groups.keys()) allFolded ? next.delete(id) : next.add(id);
                    return next;
                  })
                }
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-input px-2 text-[12.5px] font-semibold text-accent hover:bg-subtle2 dark:text-white"
              >
                {allFolded ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
                {allFolded ? "Expand all" : "Collapse all"}
              </button>
            </div>
          )}
          <Card className="rounded-none border-x-0 md:rounded-card md:border-x">
            <div className="hidden grid-cols-[88px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px_32px] gap-3 border-b border-hairline px-4 py-2.5 text-micro font-bold uppercase tracking-[0.04em] text-muted md:grid">
              <span>Unit</span>
              <span>Name</span>
              <span>{tab === "archived" ? "Removed" : "Last on a form"}</span>
              <span>{tab === "archived" ? "Reason" : "Moved in"}</span>
              <span>Status</span>
              <span />
            </div>
            <ul>
              {rows.map((t, i) => (
                <Fragment key={t.id}>
                {grouped && t.siteId !== rows[i - 1]?.siteId && (
                  <li className="sticky top-0 z-[1] border-b border-hairline bg-subtle">
                    <button
                      type="button"
                      onClick={() => toggleSite(t.siteId)}
                      aria-expanded={!isFolded(t.siteId)}
                      className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left hover:bg-subtle2 md:min-h-[34px]"
                    >
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isFolded(t.siteId) && "-rotate-90")} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-[0.04em] text-muted">{t.site?.name}</span>
                      {(groups.get(t.siteId)?.attention ?? 0) > 0 && tab === "active" && (
                        <span className="shrink-0 rounded-pill bg-status-amberBg px-1.5 text-micro font-bold tabular text-status-amberText">
                          {groups.get(t.siteId)!.attention}
                        </span>
                      )}
                      <span className="shrink-0 text-micro tabular text-muted">{groups.get(t.siteId)?.count}</span>
                    </button>
                  </li>
                )}
                {!isFolded(t.siteId) && (
                <li className="border-b border-hairline last:border-0">
                  <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-rowhover md:grid md:grid-cols-[88px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px_32px] md:py-2">
                    <span className="w-[52px] shrink-0 text-center font-heading text-[14px] font-extrabold tabular text-ink md:w-auto md:text-left md:text-[13.5px]">
                      {t.unit ?? "—"}
                    </span>
                    <Link to={`/tenants/${t.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 md:flex-none">
                      <Avatar name={t.displayName} color={tintFor(t.id)} size={30} className="hidden md:inline-flex" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[14.5px] font-semibold text-ink md:text-[13.5px]">{t.displayName}</span>
                          {t.needsAttention && <span className="h-2 w-2 shrink-0 rounded-full bg-status-amberDot md:hidden" aria-label="Needs review" />}
                        </span>
                        <span className="block truncate text-micro text-muted md:hidden">
                          {tab === "archived"
                            ? `${multiSite ? `${t.site?.name} · ` : ""}Removed ${formatDate(t.archivedAt)} · ${t.archiveReason ?? ""}`
                            : t.lastActivityAt
                              ? `On a form ${relativeTime(t.lastActivityAt)}`
                              : t.preferredName
                                ? `${t.firstName} ${t.lastName}`
                                : `Added ${formatDate(t.createdAt)}`}
                        </span>
                        {t.preferredName && <span className="hidden truncate text-micro text-muted md:block">{t.firstName} {t.lastName}</span>}
                      </span>
                    </Link>
                    <span className="hidden truncate text-[13px] text-muted md:block">
                      {tab === "archived" ? formatDate(t.archivedAt) : t.lastActivityAt ? relativeTime(t.lastActivityAt) : "—"}
                    </span>
                    <span className="hidden truncate text-[13px] text-muted md:block">
                      {tab === "archived" ? t.archiveReason : formatDate(t.moveInDate)}
                    </span>
                    <span className="hidden md:block">
                      <TenantStatusBadge status={t.status} needsAttention={t.needsAttention} />
                    </span>
                    <span className="flex shrink-0 items-center">
                      {tab === "archived" ? (
                        can("roster.restore") && (
                          <Button size="sm" variant="ghost" onClick={() => void restore(t)} className="min-h-[40px] md:min-h-0">
                            Restore
                          </Button>
                        )
                      ) : can("roster.archive") ? (
                        <button
                          onClick={() => setRemoving(t)}
                          title="Remove from roster"
                          className="flex h-10 w-10 items-center justify-center rounded-input text-muted hover:bg-status-redBg hover:text-status-redText md:h-8 md:w-8 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted" />
                      )}
                    </span>
                  </div>
                </li>
                )}
                </Fragment>
              ))}
            </ul>
          </Card>
          </>
        )}
      </Page>

      {selected.length > 0 && <AddResident open={adding} onOpenChange={setAdding} sites={selected} />}
      <RemoveDialog
        tenant={removing}
        onCancel={() => setRemoving(null)}
        onConfirm={async (reason, note) => {
          const t = removing!;
          setRemoving(null);
          await remove(t, reason, note);
        }}
      />
    </div>
  );
}
